'use strict';

function numberOption(value, fallback, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(Math.trunc(parsed), maximum));
}

function abortError(message = '请求已取消') {
  const error = new Error(message);
  error.name = 'AbortError';
  error.code = 'TASK_CANCELLED';
  return error;
}

function defaultTransientClassifier(value) {
  if (value?.transient === true) return true;
  if (value?.transient === false) return false;
  const code = String(value?.code || value?.cause?.code || '').toUpperCase();
  const message = String(value?.message || '').toUpperCase();
  const status = Number(value?.upstreamStatus || value?.status || 0);
  if (status >= 500 || status === 408 || status === 429) return true;
  if (status >= 400) return false;
  return /TIMEOUT|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|SOCKET HANG UP|NETWORK|FETCH FAILED/.test(`${code} ${message}`);
}

function providerCooldownMs(value) {
  const explicit = Number(value?.retryAfterMs || value?.request?.retryAfterMs || 0);
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.max(1, Math.min(Math.trunc(explicit), 10 * 60 * 1000));
  }
  const code = String(value?.code || '').toUpperCase();
  const status = Number(value?.upstreamStatus || value?.status || 0);
  if (status === 524 || code.includes('ORIGIN_TIMEOUT_524')) return 120 * 1000;
  if (code.includes('SKIPPED_MAINLINE')) return 60 * 1000;
  return 0;
}

class ImageRequestScheduler {
  constructor(options = {}) {
    this.globalConcurrency = numberOption(options.globalConcurrency, 3, 1, 20);
    this.perDomainConcurrency = numberOption(options.perDomainConcurrency, 1, 1, 10);
    this.maxQueued = numberOption(options.maxQueued, 30, 1, 1000);
    this.domainStartIntervalMs = numberOption(options.domainStartIntervalMs, 0, 0, 60 * 1000);
    this.circuitThreshold = numberOption(options.circuitThreshold, 3, 1, 20);
    this.circuitWindowMs = numberOption(options.circuitWindowMs, 5 * 60 * 1000, 1000);
    this.circuitOpenMs = numberOption(options.circuitOpenMs, 60 * 1000, 1000);
    this.rollingWindowSize = numberOption(options.rollingWindowSize, 5, 2, 20);
    this.rollingFailureThreshold = numberOption(options.rollingFailureThreshold, 2, 1, this.rollingWindowSize);
    this.rollingMinimumSamples = numberOption(
      options.rollingMinimumSamples,
      this.rollingFailureThreshold,
      this.rollingFailureThreshold,
      this.rollingWindowSize
    );
    this.isTransient = options.isTransient || defaultTransientClassifier;
    this.now = options.now || (() => Date.now());
    this.queue = [];
    this.active = new Map();
    this.activeByDomain = new Map();
    this.activeByUser = new Map();
    this.lastStartedByUser = new Map();
    this.lastStartedByDomain = new Map();
    this.circuits = new Map();
    this.nextId = 1;
    this.wakeTimer = null;
  }

  schedule(run, metadata = {}) {
    if (typeof run !== 'function') return Promise.reject(new TypeError('run 必须是函数'));
    if (this.queue.length >= this.maxQueued) {
      const error = new Error('图片生成队列已满，请稍后重试');
      error.code = 'GENERATION_QUEUE_FULL';
      error.status = 429;
      error.retryAfter = 5;
      return Promise.reject(error);
    }

    const job = {
      id: metadata.id || `provider_job_${this.nextId++}`,
      taskId: String(metadata.taskId || ''),
      userId: String(metadata.userId || 'anonymous'),
      failureDomain: String(metadata.failureDomain || 'default'),
      createdAt: this.now(),
      run,
      onStatus: typeof metadata.onStatus === 'function' ? metadata.onStatus : null,
      resolve: null,
      reject: null
    };
    const promise = new Promise((resolve, reject) => {
      job.resolve = resolve;
      job.reject = reject;
    });
    this.queue.push(job);
    this.notifyQueue();
    this.drain();
    return promise;
  }

  cancelTask(taskId, reason = '任务已取消') {
    const target = String(taskId || '');
    if (!target) return false;
    let changed = false;
    const kept = [];
    for (const job of this.queue) {
      if (job.taskId !== target) {
        kept.push(job);
        continue;
      }
      changed = true;
      job.reject(abortError(reason));
    }
    this.queue = kept;
    for (const active of this.active.values()) {
      if (active.job.taskId !== target) continue;
      changed = true;
      active.controller.abort(reason);
    }
    if (changed) {
      this.notifyQueue();
      this.drain();
    }
    return changed;
  }

  queuePosition(taskId) {
    const target = String(taskId || '');
    if (!target) return 0;
    const index = this.orderedQueue().findIndex((job) => job.taskId === target);
    return index < 0 ? 0 : index + 1;
  }

  snapshot() {
    const now = this.now();
    const circuits = {};
    for (const [domain, state] of this.circuits.entries()) {
      circuits[domain] = {
        consecutiveFailures: state.failures.length,
        recentAttempts: state.outcomes.length,
        recentTransientFailures: state.outcomes.filter((outcome) => outcome.transientFailure).length,
        open: state.openUntil > now,
        coolingDown: state.cooldownUntil > now,
        retryAfterMs: Math.max(0, state.openUntil - now, state.cooldownUntil - now),
        reason: state.reason || ''
      };
    }
    return {
      mode: 'bounded-fair',
      globalConcurrency: this.globalConcurrency,
      perDomainConcurrency: this.perDomainConcurrency,
      domainStartIntervalMs: this.domainStartIntervalMs,
      active: this.active.size,
      queued: this.queue.length,
      activeByDomain: Object.fromEntries(this.activeByDomain),
      circuits
    };
  }

  orderedQueue() {
    return [...this.queue].sort((left, right) => {
      const leftStarted = this.lastStartedByUser.get(left.userId) || 0;
      const rightStarted = this.lastStartedByUser.get(right.userId) || 0;
      if (leftStarted !== rightStarted) return leftStarted - rightStarted;
      return left.createdAt - right.createdAt;
    });
  }

  circuitState(domain) {
    if (!this.circuits.has(domain)) {
      this.circuits.set(domain, {
        failures: [],
        outcomes: [],
        openUntil: 0,
        cooldownUntil: 0,
        reason: ''
      });
    }
    return this.circuits.get(domain);
  }

  circuitRetryAfter(domain) {
    const state = this.circuitState(domain);
    return Math.max(0, state.openUntil - this.now(), state.cooldownUntil - this.now());
  }

  domainStartRetryAfter(domain) {
    const lastStartedAt = this.lastStartedByDomain.get(domain) || 0;
    return Math.max(0, lastStartedAt + this.domainStartIntervalMs - this.now());
  }

  domainRetryAfter(domain) {
    return Math.max(this.circuitRetryAfter(domain), this.domainStartRetryAfter(domain));
  }

  canRun(job) {
    if (this.active.size >= this.globalConcurrency) return false;
    if ((this.activeByDomain.get(job.failureDomain) || 0) >= this.perDomainConcurrency) return false;
    if ((this.activeByUser.get(job.userId) || 0) >= 1) return false;
    return this.domainRetryAfter(job.failureDomain) <= 0;
  }

  drain() {
    if (this.active.size >= this.globalConcurrency || !this.queue.length) {
      this.scheduleCircuitWake();
      return;
    }
    let started = false;
    for (const candidate of this.orderedQueue()) {
      if (!this.canRun(candidate)) continue;
      const index = this.queue.indexOf(candidate);
      if (index >= 0) this.queue.splice(index, 1);
      this.start(candidate);
      started = true;
      if (this.active.size >= this.globalConcurrency) break;
    }
    this.notifyQueue();
    if (started && this.active.size < this.globalConcurrency) {
      queueMicrotask(() => this.drain());
    } else {
      this.scheduleCircuitWake();
    }
  }

  start(job) {
    const controller = new AbortController();
    this.active.set(job.id, { job, controller });
    this.activeByDomain.set(job.failureDomain, (this.activeByDomain.get(job.failureDomain) || 0) + 1);
    this.activeByUser.set(job.userId, (this.activeByUser.get(job.userId) || 0) + 1);
    this.lastStartedByUser.set(job.userId, this.now());
    this.lastStartedByDomain.set(job.failureDomain, this.now());
    this.notify(job, 'running', 0);

    Promise.resolve()
      .then(() => job.run(controller.signal))
      .then((result) => {
        if (result && result.success === false && this.isTransient(result)) {
          this.recordTransientFailure(job.failureDomain, result);
        } else {
          this.recordSuccess(job.failureDomain);
        }
        job.resolve(result);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && this.isTransient(error)) {
          this.recordTransientFailure(job.failureDomain, error);
        } else if (error?.name !== 'AbortError') {
          this.recordSuccess(job.failureDomain);
        }
        job.reject(error);
      })
      .finally(() => {
        this.active.delete(job.id);
        this.decrement(this.activeByDomain, job.failureDomain);
        this.decrement(this.activeByUser, job.userId);
        this.notifyQueue();
        this.drain();
      });
  }

  recordTransientFailure(domain, value) {
    const now = this.now();
    const state = this.circuitState(domain);
    state.failures = state.failures.filter((timestamp) => now - timestamp <= this.circuitWindowMs);
    state.failures.push(now);
    this.recordOutcome(state, now, true);
    const cooldownMs = providerCooldownMs(value);
    if (cooldownMs > 0) {
      state.cooldownUntil = Math.max(state.cooldownUntil, now + cooldownMs);
      state.reason = String(value?.code || value?.upstreamStatus || 'PROVIDER_COOLDOWN');
    }
    const rollingFailures = state.outcomes.filter((outcome) => outcome.transientFailure).length;
    if (
      state.failures.length >= this.circuitThreshold ||
      (state.outcomes.length >= this.rollingMinimumSamples && rollingFailures >= this.rollingFailureThreshold)
    ) {
      state.openUntil = now + this.circuitOpenMs;
      state.reason = String(value?.code || value?.upstreamStatus || 'TRANSIENT_FAILURE_THRESHOLD');
    }
  }

  recordSuccess(domain) {
    const state = this.circuitState(domain);
    const now = this.now();
    this.recordOutcome(state, now, false);
    state.failures = [];
    if (state.openUntil <= now) state.openUntil = 0;
    if (state.cooldownUntil <= now) state.cooldownUntil = 0;
    if (!state.openUntil && !state.cooldownUntil) state.reason = '';
  }

  recordOutcome(state, at, transientFailure) {
    state.outcomes = state.outcomes
      .filter((outcome) => at - outcome.at <= this.circuitWindowMs)
      .slice(-(this.rollingWindowSize - 1));
    state.outcomes.push({ at, transientFailure });
  }

  decrement(map, key) {
    const next = Math.max(0, (map.get(key) || 0) - 1);
    if (next) map.set(key, next);
    else map.delete(key);
  }

  notifyQueue() {
    const ordered = this.orderedQueue();
    ordered.forEach((job, index) => {
      this.notify(job, 'pending', index + 1);
    });
  }

  notify(job, status, queuePosition) {
    if (!job.onStatus) return;
    const circuitRetryAfterMs = this.circuitRetryAfter(job.failureDomain);
    const retryAfterMs = this.domainRetryAfter(job.failureDomain);
    const circuit = this.circuitState(job.failureDomain);
    try {
      job.onStatus({
        status,
        stage: status === 'pending' && circuitRetryAfterMs > 0 ? 'provider_degraded' : undefined,
        queueMode: 'bounded-fair',
        queuePosition,
        pendingCount: this.queue.length,
        failureDomain: job.failureDomain,
        retryAfterMs,
        degradedReason: circuitRetryAfterMs > 0 ? circuit.reason : ''
      });
    } catch {}
  }

  scheduleCircuitWake() {
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    const waits = this.queue
      .map((job) => this.domainRetryAfter(job.failureDomain))
      .filter((value) => value > 0);
    if (!waits.length) {
      this.wakeTimer = null;
      return;
    }
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null;
      this.drain();
    }, Math.min(...waits) + 5);
  }
}

module.exports = {
  ImageRequestScheduler,
  abortError,
  defaultTransientClassifier,
  providerCooldownMs
};

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
  const code = String(value?.code || value?.cause?.code || '').toUpperCase();
  const message = String(value?.message || '').toUpperCase();
  const status = Number(value?.upstreamStatus || value?.status || 0);
  if (status >= 500 || status === 408 || status === 429) return true;
  if (status >= 400) return false;
  return /TIMEOUT|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|SOCKET HANG UP|NETWORK|FETCH FAILED/.test(`${code} ${message}`);
}

class ImageRequestScheduler {
  constructor(options = {}) {
    this.globalConcurrency = numberOption(options.globalConcurrency, 3, 1, 20);
    this.perDomainConcurrency = numberOption(options.perDomainConcurrency, 1, 1, 10);
    this.maxQueued = numberOption(options.maxQueued, 30, 1, 1000);
    this.circuitThreshold = numberOption(options.circuitThreshold, 3, 1, 20);
    this.circuitWindowMs = numberOption(options.circuitWindowMs, 5 * 60 * 1000, 1000);
    this.circuitOpenMs = numberOption(options.circuitOpenMs, 60 * 1000, 1000);
    this.isTransient = options.isTransient || defaultTransientClassifier;
    this.now = options.now || (() => Date.now());
    this.queue = [];
    this.active = new Map();
    this.activeByDomain = new Map();
    this.activeByUser = new Map();
    this.lastStartedByUser = new Map();
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
        open: state.openUntil > now,
        retryAfterMs: Math.max(0, state.openUntil - now)
      };
    }
    return {
      mode: 'bounded-fair',
      globalConcurrency: this.globalConcurrency,
      perDomainConcurrency: this.perDomainConcurrency,
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
      this.circuits.set(domain, { failures: [], openUntil: 0 });
    }
    return this.circuits.get(domain);
  }

  circuitRetryAfter(domain) {
    const state = this.circuitState(domain);
    return Math.max(0, state.openUntil - this.now());
  }

  canRun(job) {
    if (this.active.size >= this.globalConcurrency) return false;
    if ((this.activeByDomain.get(job.failureDomain) || 0) >= this.perDomainConcurrency) return false;
    if ((this.activeByUser.get(job.userId) || 0) >= 1) return false;
    return this.circuitRetryAfter(job.failureDomain) <= 0;
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
    this.notify(job, 'running', 0);

    Promise.resolve()
      .then(() => job.run(controller.signal))
      .then((result) => {
        if (result && result.success === false && this.isTransient(result)) {
          this.recordTransientFailure(job.failureDomain);
        } else {
          this.recordSuccess(job.failureDomain);
        }
        job.resolve(result);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && this.isTransient(error)) {
          this.recordTransientFailure(job.failureDomain);
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

  recordTransientFailure(domain) {
    const now = this.now();
    const state = this.circuitState(domain);
    state.failures = state.failures.filter((timestamp) => now - timestamp <= this.circuitWindowMs);
    state.failures.push(now);
    if (state.failures.length >= this.circuitThreshold) {
      state.openUntil = now + this.circuitOpenMs;
    }
  }

  recordSuccess(domain) {
    const state = this.circuitState(domain);
    state.failures = [];
    state.openUntil = 0;
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
    const retryAfterMs = this.circuitRetryAfter(job.failureDomain);
    try {
      job.onStatus({
        status,
        queueMode: 'bounded-fair',
        queuePosition,
        pendingCount: this.queue.length,
        failureDomain: job.failureDomain,
        retryAfterMs
      });
    } catch {}
  }

  scheduleCircuitWake() {
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    const waits = this.queue
      .map((job) => this.circuitRetryAfter(job.failureDomain))
      .filter((value) => value > 0);
    if (!waits.length) {
      this.wakeTimer = null;
      return;
    }
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null;
      this.drain();
    }, Math.min(...waits) + 5);
    if (typeof this.wakeTimer.unref === 'function') this.wakeTimer.unref();
  }
}

module.exports = {
  ImageRequestScheduler,
  abortError,
  defaultTransientClassifier
};

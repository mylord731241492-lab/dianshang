'use strict';

class GenerationTaskService {
  constructor(options = {}) {
    this.repository = options.repository;
    this.scheduler = options.scheduler;
    this.executeItem = options.executeItem;
    this.onTerminal = options.onTerminal || (() => {});
    this.retryDelayMs = Math.max(100, Number(options.retryDelayMs || 1000));
    this.enqueued = new Set();
    this.retryTimers = new Map();
    if (!this.repository || !this.scheduler || typeof this.executeItem !== 'function') {
      throw new TypeError('GenerationTaskService 缺少 repository、scheduler 或 executeItem');
    }
  }

  start() {
    const recovered = this.repository.recoverInterruptedTasks();
    recovered.forEach((task) => this.onTerminal(task));
    this.repository.listPendingTasks().forEach((task) => this.enqueue(task.id));
    return recovered;
  }

  submit(input) {
    const result = this.repository.createReservedTask(input);
    if (!result.replayed) this.enqueue(result.task.id);
    return result;
  }

  getTask(taskId) {
    return this.repository.getTask(taskId, true);
  }

  listTasks(limit) {
    return this.repository.listTasks(limit);
  }

  cancel(taskId, options = {}) {
    const task = this.repository.cancelTask(taskId, options);
    this.scheduler.cancelTask(taskId, options.reason || '任务已取消');
    const timer = this.retryTimers.get(taskId);
    if (timer) clearTimeout(timer);
    this.retryTimers.delete(taskId);
    this.enqueued.delete(taskId);
    this.onTerminal(task);
    return task;
  }

  enqueue(taskId) {
    if (!taskId || this.enqueued.has(taskId)) return false;
    const task = this.repository.getTask(taskId);
    if (!task || task.status !== 'pending') return false;
    this.enqueued.add(taskId);
    this.scheduler.schedule(
      (signal) => this.runOneItem(taskId, signal),
      {
        taskId,
        userId: task.userId,
        failureDomain: task.failureDomain,
        onStatus: (state) => {
          this.repository.updateQueueState(taskId, {
            ...state,
            stage: state.status === 'running' ? 'preparing' : (state.stage || 'queued')
          });
        }
      }
    ).catch((error) => {
      const current = this.repository.getTask(taskId);
      if (!current || !['pending', 'running'].includes(current.status)) return;
      if (error?.code === 'GENERATION_QUEUE_FULL') {
        this.scheduleRetry(taskId);
        return;
      }
      if (error?.name === 'AbortError' || error?.code === 'TASK_CANCELLED') return;
      const failed = this.repository.failTask(taskId, {
        errorCode: error?.code || 'GENERATION_WORKER_ERROR',
        errorMessage: error?.message || '生图任务执行失败'
      });
      this.onTerminal(failed);
    }).finally(() => {
      this.enqueued.delete(taskId);
      const current = this.repository.getTask(taskId);
      if (current?.status === 'pending' && !this.retryTimers.has(taskId)) {
        queueMicrotask(() => this.enqueue(taskId));
      } else if (current && ['success', 'failed', 'cancelled'].includes(current.status)) {
        this.onTerminal(current);
      }
    });
    return true;
  }

  scheduleRetry(taskId) {
    if (this.retryTimers.has(taskId)) return;
    const timer = setTimeout(() => {
      this.retryTimers.delete(taskId);
      this.enqueued.delete(taskId);
      this.enqueue(taskId);
    }, this.retryDelayMs);
    if (typeof timer.unref === 'function') timer.unref();
    this.retryTimers.set(taskId, timer);
  }

  async runOneItem(taskId, signal) {
    const claimed = this.repository.claimNextItem(taskId);
    if (!claimed) return { success: true, skipped: true };
    const { task, item } = claimed;
    const attempt = this.repository.recordAttemptStart({
      taskId,
      itemIndex: item.itemIndex,
      attemptNo: item.attemptCount,
      failureDomain: task.failureDomain,
      phase: 'provider'
    });
    try {
      this.repository.markTaskStage(taskId, 'awaiting_provider');
      const result = await this.executeItem(task, item, signal);
      if (!result || result.success === false) {
        const errorCode = result?.code || 'PROVIDER_IMAGE_FAILED';
        const errorMessage = result?.message || '图片生成接口调用失败';
        this.repository.recordAttemptFinish(attempt.id, {
          status: 'failed',
          upstreamStatus: result?.upstreamStatus,
          errorCode,
          errorMessage,
          requestMeta: result?.request || result?.upstreamItem || {}
        });
        const failed = this.repository.failTask(taskId, {
          errorCode,
          errorMessage,
          requestMeta: result?.request || result?.upstreamItem || null
        });
        this.onTerminal(failed);
        return result || { success: false, code: errorCode, message: errorMessage };
      }

      this.repository.markTaskStage(taskId, 'persisting', result.request || {});
      const completed = this.repository.completeItem({
        taskId,
        itemIndex: item.itemIndex,
        images: result.images,
        requestMeta: result.request || {},
        generationIdFactory: result.generationIdFactory
      });
      this.repository.recordAttemptFinish(attempt.id, {
        status: 'success',
        upstreamStatus: result.upstreamStatus || 200,
        requestMeta: result.request || {}
      });
      if (completed && ['success', 'failed', 'cancelled'].includes(completed.status)) {
        this.onTerminal(completed);
      }
      return { ...result, success: true };
    } catch (error) {
      const current = this.repository.getTask(taskId);
      const cancelled = current?.status === 'cancelled' || error?.name === 'AbortError' || error?.code === 'TASK_CANCELLED';
      this.repository.recordAttemptFinish(attempt.id, {
        status: cancelled ? 'cancelled' : 'failed',
        errorCode: cancelled ? (current?.errorCode || 'TASK_CANCELLED') : (error?.code || 'GENERATION_WORKER_ERROR'),
        errorMessage: cancelled
          ? (current?.errorMessage || error?.message || '任务已取消')
          : (error?.message || '生图任务执行失败'),
        requestMeta: error?.requestMeta || {}
      });
      if (!cancelled) {
        const failed = this.repository.failTask(taskId, {
          errorCode: error?.code || 'GENERATION_WORKER_ERROR',
          errorMessage: error?.message || '生图任务执行失败',
          requestMeta: error?.requestMeta || null
        });
        this.onTerminal(failed);
      }
      throw error;
    }
  }

  async waitForTerminal(taskId, timeoutMs = 280000, intervalMs = 100) {
    const deadline = Date.now() + Math.max(0, Number(timeoutMs || 0));
    while (Date.now() <= deadline) {
      const task = this.repository.getTask(taskId, true);
      if (!task || ['success', 'failed', 'cancelled'].includes(task.status)) return task;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return this.repository.getTask(taskId, true);
  }
}

module.exports = {
  GenerationTaskService
};

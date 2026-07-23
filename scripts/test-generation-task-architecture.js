'use strict';

const assert = require('assert');
const Database = require('better-sqlite3');
const { createGenerationTaskRepository } = require('../backend/generation/task-repository');
const { ImageRequestScheduler } = require('../backend/provider/image-request-scheduler');
const { GenerationTaskService } = require('../backend/generation/generation-task-service');

function createDatabase() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT,
      email TEXT,
      password_hash TEXT,
      role TEXT,
      balance REAL,
      status TEXT
    );
    CREATE TABLE balance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      type TEXT,
      change_amount REAL,
      before_balance REAL,
      after_balance REAL,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE generations (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      model_key TEXT,
      prompt TEXT,
      result_url TEXT,
      cost REAL,
      status TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function taskInput(overrides = {}) {
  return {
    id: overrides.id || 'task_1',
    userId: overrides.userId || 'user_1',
    idempotencyKey: overrides.idempotencyKey || 'idem_1',
    requestHash: overrides.requestHash || 'hash_1',
    routeId: 'route_1',
    routeKey: 'route_1',
    routeDisplayName: '测试线路',
    failureDomain: overrides.failureDomain || 'provider-a',
    modelKey: 'gpt-image-2',
    prompt: '测试商品主图',
    imageCount: overrides.imageCount || 1,
    unitCost: overrides.unitCost || 10,
    reservedCost: (overrides.imageCount || 1) * (overrides.unitCost || 10),
    requestPayload: { body: { prompt: '测试商品主图' } },
    requestMeta: { referenceImageCount: 0 }
  };
}

function testAtomicBillingAndIdempotency() {
  const db = createDatabase();
  db.prepare("INSERT INTO users (id,username,email,password_hash,role,balance,status) VALUES ('user_1','u1','u1@example.test','x','user',10,'active')").run();
  const repository = createGenerationTaskRepository({ db });

  const first = repository.createReservedTask(taskInput());
  assert.equal(first.replayed, false);
  assert.equal(first.remainingBalance, 0);
  const replay = repository.createReservedTask(taskInput());
  assert.equal(replay.replayed, true);
  assert.equal(db.prepare("SELECT balance FROM users WHERE id='user_1'").get().balance, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM balance_logs WHERE user_id='user_1'").get().count, 1);

  assert.throws(
    () => repository.createReservedTask(taskInput({ requestHash: 'different' })),
    (error) => error.code === 'IDEMPOTENCY_KEY_REUSED'
  );
  assert.throws(
    () => repository.createReservedTask(taskInput({ id: 'task_2', idempotencyKey: 'idem_2' })),
    (error) => error.code === 'INSUFFICIENT_BALANCE'
  );
  assert.equal(db.prepare("SELECT balance FROM users WHERE id='user_1'").get().balance, 0);
  db.close();
}

function testPartialSettlementAndRefund() {
  const db = createDatabase();
  db.prepare("INSERT INTO users (id,username,email,password_hash,role,balance,status) VALUES ('user_1','u1','u1@example.test','x','user',50,'active')").run();
  let nextId = 1;
  const repository = createGenerationTaskRepository({
    db,
    idFactory: (prefix) => `${prefix}${nextId++}`
  });
  repository.createReservedTask(taskInput({ imageCount: 2 }));
  assert.equal(db.prepare("SELECT balance FROM users WHERE id='user_1'").get().balance, 30);

  const claimed = repository.claimNextItem('task_1');
  assert.equal(claimed.item.itemIndex, 0);
  const afterFirst = repository.completeItem({
    taskId: 'task_1',
    itemIndex: 0,
    images: [{ url: '/uploads/generated/one.png' }]
  });
  assert.equal(afterFirst.status, 'pending');

  const second = repository.claimNextItem('task_1');
  assert.equal(second.item.itemIndex, 1);
  const finalTask = repository.failTask('task_1', {
    errorCode: 'PROVIDER_IMAGE_TIMEOUT',
    errorMessage: '上游超时'
  });
  assert.equal(finalTask.status, 'success');
  assert.equal(finalTask.request.partial, true);
  assert.equal(finalTask.settledCost, 10);
  assert.equal(finalTask.billingStatus, 'partially_settled');
  assert.equal(db.prepare("SELECT balance FROM users WHERE id='user_1'").get().balance, 40);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM generations WHERE task_id='task_1'").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM balance_logs WHERE task_id='task_1'").get().count, 2);
  db.close();
}

function testCancellationAndRecovery() {
  const db = createDatabase();
  db.prepare("INSERT INTO users (id,username,email,password_hash,role,balance,status) VALUES ('user_1','u1','u1@example.test','x','user',50,'active')").run();
  const repository = createGenerationTaskRepository({ db });
  repository.createReservedTask(taskInput());
  const cancelled = repository.cancelTask('task_1', { reason: '测试取消' });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.billingStatus, 'refunded');
  assert.equal(db.prepare("SELECT balance FROM users WHERE id='user_1'").get().balance, 50);

  repository.createReservedTask(taskInput({ id: 'task_2', idempotencyKey: 'idem_2' }));
  repository.claimNextItem('task_2');
  const recovered = repository.recoverInterruptedTasks();
  assert.equal(recovered.length, 1);
  assert.equal(repository.getTask('task_2').errorCode, 'WORKER_INTERRUPTED_UNKNOWN');
  assert.equal(db.prepare("SELECT balance FROM users WHERE id='user_1'").get().balance, 50);
  db.close();
}

function testPersistentQueueLimit() {
  const db = createDatabase();
  const insertUser = db.prepare("INSERT INTO users (id,username,email,password_hash,role,balance,status) VALUES (?,?,?,?,?,?,?)");
  for (let index = 1; index <= 3; index += 1) {
    insertUser.run(`user_${index}`, `u${index}`, `u${index}@example.test`, 'x', 'user', 50, 'active');
  }
  const repository = createGenerationTaskRepository({ db, maxQueued: 2 });
  repository.createReservedTask(taskInput());
  repository.createReservedTask(taskInput({
    id: 'task_2',
    userId: 'user_2',
    idempotencyKey: 'idem_2',
    requestHash: 'hash_2'
  }));
  assert.throws(
    () => repository.createReservedTask(taskInput({
      id: 'task_3',
      userId: 'user_3',
      idempotencyKey: 'idem_3',
      requestHash: 'hash_3'
    })),
    (error) => error.code === 'GENERATION_QUEUE_FULL' && error.status === 429 && error.retryAfter === 5
  );
  assert.equal(db.prepare("SELECT balance FROM users WHERE id='user_3'").get().balance, 50);
  db.close();
}

async function testFairBoundedScheduler() {
  const scheduler = new ImageRequestScheduler({
    globalConcurrency: 3,
    perDomainConcurrency: 1,
    maxQueued: 30,
    circuitOpenMs: 50
  });
  let active = 0;
  let maxActive = 0;
  const activeByDomain = new Map();
  let maxDomain = 0;
  const starts = [];
  const promises = [];
  for (let round = 1; round <= 2; round += 1) {
    for (let user = 1; user <= 10; user += 1) {
      const userId = `user_${user}`;
      const domain = `provider-${user % 3}`;
      promises.push(scheduler.schedule(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        const domainActive = (activeByDomain.get(domain) || 0) + 1;
        activeByDomain.set(domain, domainActive);
        maxDomain = Math.max(maxDomain, domainActive);
        starts.push(`${round}:${userId}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        activeByDomain.set(domain, domainActive - 1);
        return { success: true };
      }, {
        taskId: `${round}:${userId}`,
        userId,
        failureDomain: domain
      }));
    }
  }
  await Promise.all(promises);
  assert.ok(maxActive <= 3, `全局并发超限: ${maxActive}`);
  assert.ok(maxDomain <= 1, `失败域并发超限: ${maxDomain}`);
  const firstSecondRound = starts.findIndex((value) => value.startsWith('2:'));
  const firstRoundBeforeSecond = new Set(starts.slice(0, firstSecondRound).map((value) => value.split(':')[1]));
  assert.equal(firstRoundBeforeSecond.size, 10, `第二轮开始前只有 ${firstRoundBeforeSecond.size} 个用户获得首轮执行机会`);
}

async function testSchedulerCapacityAndCircuitRecovery() {
  const capacityScheduler = new ImageRequestScheduler({
    globalConcurrency: 1,
    perDomainConcurrency: 1,
    maxQueued: 2
  });
  let releaseBlocker;
  const blocker = capacityScheduler.schedule(
    () => new Promise((resolve) => { releaseBlocker = resolve; }),
    { taskId: 'blocker', userId: 'user_1', failureDomain: 'provider-a' }
  );
  const queuedA = capacityScheduler.schedule(
    async () => ({ success: true }),
    { taskId: 'queued-a', userId: 'user_2', failureDomain: 'provider-a' }
  );
  const queuedB = capacityScheduler.schedule(
    async () => ({ success: true }),
    { taskId: 'queued-b', userId: 'user_3', failureDomain: 'provider-a' }
  );
  await assert.rejects(
    capacityScheduler.schedule(
      async () => ({ success: true }),
      { taskId: 'overflow', userId: 'user_4', failureDomain: 'provider-a' }
    ),
    (error) => error.code === 'GENERATION_QUEUE_FULL' && error.status === 429
  );
  releaseBlocker({ success: true });
  await Promise.all([blocker, queuedA, queuedB]);

  let currentTime = 1000;
  const circuitScheduler = new ImageRequestScheduler({
    globalConcurrency: 1,
    perDomainConcurrency: 1,
    maxQueued: 10,
    circuitThreshold: 3,
    circuitWindowMs: 5000,
    circuitOpenMs: 1000,
    now: () => currentTime
  });
  const transientCases = [
    Object.assign(new Error('simulated timeout'), { code: 'ETIMEDOUT' }),
    Object.assign(new Error('simulated disconnect'), { code: 'ECONNRESET' })
  ];
  for (const error of transientCases) {
    await assert.rejects(circuitScheduler.schedule(
      async () => { throw error; },
      { userId: 'user_1', failureDomain: 'provider-a' }
    ));
  }
  await circuitScheduler.schedule(
    async () => ({ success: false, upstreamStatus: 503, code: 'PROVIDER_5XX' }),
    { userId: 'user_1', failureDomain: 'provider-a' }
  );
  assert.equal(circuitScheduler.snapshot().circuits['provider-a'].open, true);
  let recoveredStarted = false;
  const recovered = circuitScheduler.schedule(
    async () => {
      recoveredStarted = true;
      return { success: true };
    },
    { userId: 'user_2', failureDomain: 'provider-a' }
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(recoveredStarted, false, '熔断窗口内不应向上游发送新请求');
  currentTime += 1001;
  circuitScheduler.drain();
  await recovered;
  assert.equal(recoveredStarted, true);
  assert.equal(circuitScheduler.snapshot().circuits['provider-a'].open, false);
}

async function testPersistenceFailureRefund() {
  const db = createDatabase();
  db.prepare("INSERT INTO users (id,username,email,password_hash,role,balance,status) VALUES ('user_1','u1','u1@example.test','x','user',50,'active')").run();
  const repository = createGenerationTaskRepository({ db });
  const scheduler = new ImageRequestScheduler({ globalConcurrency: 1, perDomainConcurrency: 1 });
  const service = new GenerationTaskService({
    repository,
    scheduler,
    executeItem: async () => {
      const error = new Error('模拟结果落盘失败');
      error.code = 'GENERATION_RESULT_PERSIST_FAILED';
      throw error;
    }
  });
  service.submit(taskInput());
  const task = await service.waitForTerminal('task_1', 2000, 10);
  assert.equal(task.status, 'failed');
  assert.equal(task.errorCode, 'GENERATION_RESULT_PERSIST_FAILED');
  assert.equal(task.billingStatus, 'refunded');
  assert.equal(db.prepare("SELECT balance FROM users WHERE id='user_1'").get().balance, 50);
  db.close();
}

async function main() {
  testAtomicBillingAndIdempotency();
  testPartialSettlementAndRefund();
  testCancellationAndRecovery();
  testPersistentQueueLimit();
  await testFairBoundedScheduler();
  await testSchedulerCapacityAndCircuitRecovery();
  await testPersistenceFailureRefund();
  console.log('Generation task repository and fair scheduler regression passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

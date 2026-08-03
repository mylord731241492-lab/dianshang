'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Database = require('better-sqlite3');

const { createCanvasAgentSiteTools } = require('../backend/canvas-agent/site-tools');

function createFixture() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      data TEXT DEFAULT '{}',
      created_at TEXT,
      updated_at TEXT
    );
    INSERT INTO projects (id,user_id,name,data,created_at,updated_at) VALUES
      ('project_a','user_a','A 主画布','{"nodes":[1,2],"connections":[1]}','2026-01-01','2026-01-02'),
      ('project_b','user_b','B 私有画布','{"nodes":[1],"connections":[]}','2026-01-01','2026-01-02');
  `);
  const submitted = [];
  const updatedAssets = [];
  const tools = createCanvasAgentSiteTools({
    db,
    generationTaskService: {
      listTasks() {
        return [
          { id: 'task_a', userId: 'user_a', status: 'success', stage: 'done', billingStatus: 'settled', images: [{ assetId: 'asset_a' }] },
          { id: 'task_b', userId: 'user_b', status: 'failed', stage: 'done', billingStatus: 'refunded', images: [] }
        ];
      }
    },
    promptService: {
      listPublishedSystemPrompts() {
        return { items: [{ id: 'system_1', title: '系统主图提示', content: '系统内容', category: '主图', tags: ['电商'] }] };
      },
      listUserPrompts(userId) {
        return { items: [{ id: `${userId}_prompt`, title: '我的提示', content: '私有内容', category: '收藏', tags: [] }] };
      }
    },
    assetService: {
      listAssets(userId) {
        return { items: [{ id: `${userId}_asset`, kind: 'image', name: '商品图', tags: [], source: 'upload' }], nextCursor: null };
      },
      createAccessUrl(_userId, id) {
        return Promise.resolve({ url: `/api/asset-content/${id}?expires=1&sig=test` });
      },
      getAsset(userId, id) {
        if (id !== `${userId}_asset`) throw new Error('不存在');
        return { id, kind: 'image', name: '商品图', tags: [] };
      },
      updateAsset(userId, id, patch) {
        updatedAssets.push({ userId, id, patch });
        return { id, kind: 'image', ...patch };
      }
    },
    listRoutes() {
      return [{ id: 'route_image', displayName: '灵算图片线路', isDefault: true, enabled: true, defaultModelKey: 'gpt-image-2' }];
    },
    listModels() {
      return [{ modelKey: 'gpt-image-2', displayName: 'GPT Image 2', enabled: true, points: 10 }];
    },
    async submitGeneration(input) {
      submitted.push(input);
      return { task: { id: 'task_created', status: 'pending', stage: 'queued' }, replayed: false, remainingBalance: 90 };
    }
  });
  return { tools, submitted, updatedAssets };
}

test('站点读取工具只返回当前账号的项目、任务、提示词和资产', async () => {
  const { tools } = createFixture();
  const base = { userId: 'user_a', projectId: 'project_a', sessionId: 'session_a', browserSessionId: 'browser_a', callId: 'call_read' };

  const projects = await tools.execute({ ...base, name: 'canvas_list_projects', input: {} });
  assert.deepEqual(projects.items.map((item) => item.id), ['project_a']);
  assert.equal(projects.items[0].nodeCount, 2);

  const tasks = await tools.execute({ ...base, name: 'generation_get_status', input: {} });
  assert.deepEqual(tasks.tasks.map((item) => item.id), ['task_a']);
  assert.equal(tasks.tasks[0].billingStatus, 'settled');

  const prompts = await tools.execute({ ...base, name: 'prompts_search', input: { keyword: '提示' } });
  assert.deepEqual(prompts.items.map((item) => item.scope), ['system', 'user']);
  assert.equal(JSON.stringify(prompts).includes('user_b'), false);

  const assets = await tools.execute({ ...base, name: 'assets_list', input: {} });
  assert.deepEqual(assets.items.map((item) => item.id), ['user_a_asset']);
  assert.match(assets.items[0].accessUrl, /^\/api\/asset-content\//);
});

test('图片生成工具复用持久任务并把 callId 作为幂等键，不直接调用 Provider', async () => {
  const { tools, submitted } = createFixture();
  const result = await tools.execute({
    userId: 'user_a',
    projectId: 'project_a',
    sessionId: 'session_a',
    browserSessionId: 'browser_a',
    callId: 'call_generate_1',
    name: 'workbench_image_generate',
    write: true,
    input: { prompt: '白底商品主图', model: 'gpt-image-2', size: '1:1', quality: '1K', count: 1 }
  });
  assert.equal(result.taskId, 'task_created');
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].idempotencyKey, 'agent_call_generate_1');
  assert.equal(submitted[0].userId, 'user_a');
});

test('配置读取来自现有线路模型，资产写只允许操作当前账号已有资产', async () => {
  const { tools, updatedAssets } = createFixture();
  const base = { userId: 'user_a', projectId: 'project_a', sessionId: 'session_a', browserSessionId: 'browser_a', callId: 'call_config' };
  const config = await tools.execute({ ...base, name: 'workbench_image_get_config', input: {} });
  assert.equal(config.routes[0].id, 'route_image');
  assert.equal(config.models[0].modelKey, 'gpt-image-2');

  const updated = await tools.execute({
    ...base,
    name: 'assets_add',
    write: true,
    input: { kind: 'image', assetId: 'user_a_asset', title: '已确认商品图', tags: ['商品'] }
  });
  assert.equal(updated.asset.id, 'user_a_asset');
  assert.deepEqual(updatedAssets, [{ userId: 'user_a', id: 'user_a_asset', patch: { name: '已确认商品图', tags: ['商品'] } }]);

  await assert.rejects(
    () => tools.execute({
      ...base,
      name: 'assets_add',
      write: true,
      input: { kind: 'image', assetId: 'user_b_asset', title: '越权资产' }
    }),
    /不存在/
  );
});

test('未开放的视频生成返回明确错误，不伪装成功', async () => {
  const { tools } = createFixture();
  await assert.rejects(
    () => tools.execute({
      userId: 'user_a',
      projectId: 'project_a',
      sessionId: 'session_a',
      browserSessionId: 'browser_a',
      callId: 'call_video',
      name: 'workbench_video_generate',
      write: true,
      input: { prompt: '商品视频' }
    }),
    (error) => error.code === 'CANVAS_AGENT_VIDEO_NOT_AVAILABLE'
  );
});

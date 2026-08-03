'use strict';

// Agent Skills：管理员维护 + 会话绑定 + planner 纯提示词注入。

const assert = require('node:assert/strict');
const test = require('node:test');
const Database = require('better-sqlite3');

const { createAgentSkillRepository } = require('../backend/agent-skills/skill-repository');
const { createCanvasAgentRepository } = require('../backend/canvas-agent/session-repository');
const { createCanvasAgentRuntime } = require('../backend/canvas-agent/runtime-service');
const { createCanvasAgentPlanner } = require('../backend/canvas-agent/provider-planner');

function fixture() {
  const db = new Database(':memory:');
  let seq = 0;
  const idFactory = (prefix) => `${prefix}${++seq}`;
  const skills = createAgentSkillRepository({ db, idFactory });
  const repository = createCanvasAgentRepository({ db, idFactory });
  return { db, skills, repository, idFactory };
}

function makeRuntime(fixtureResult, planCapture) {
  const runtime = createCanvasAgentRuntime({
    repository: fixtureResult.repository,
    planner: {
      async plan(input) {
        if (planCapture) planCapture.push(input);
        return { text: 'ok', toolCalls: [] };
      }
    },
    siteTools: { async execute() { return { ok: true }; } },
    idFactory: fixtureResult.idFactory,
    resolveSkills: (ids, options) => fixtureResult.skills.resolveEnabledSkills(ids, options)
  });
  return runtime;
}

const scope = { userId: 'user_a', projectId: 'project_a', browserSessionId: 'browser_a' };
const snapshot = { projectId: 'project_a', title: 't', nodes: [], connections: [], selectedNodeIds: [], viewport: { x: 0, y: 0, k: 1 } };

test('管理员 CRUD 与输入校验', () => {
  const { skills } = fixture();
  const created = skills.create({ name: '白底图专家', description: '生成电商白底主图', markdown: '# 角色\n你是白底图专家。' });
  assert.equal(created.enabled, true);
  assert.equal(skills.listEnabled().length, 1);
  assert.deepEqual(skills.listEnabled().map(skills.publicSkill)[0].markdown, undefined);

  const updated = skills.update(created.id, { enabled: false });
  assert.equal(updated.enabled, false);
  assert.equal(skills.listEnabled().length, 0);
  assert.equal(skills.listAll().length, 1);

  assert.throws(() => skills.create({ name: '', markdown: 'x' }), (e) => e.code === 'AGENT_SKILL_NAME_INVALID');
  assert.throws(() => skills.create({ name: 'x', markdown: '' }), (e) => e.code === 'AGENT_SKILL_MARKDOWN_INVALID');
  assert.throws(
    () => skills.create({ name: 'x', markdown: 'a'.repeat(8001) }),
    (e) => e.code === 'AGENT_SKILL_MARKDOWN_INVALID'
  );

  assert.deepEqual(skills.remove(created.id), { deleted: true, id: created.id });
  assert.equal(skills.getById(created.id), null);
  assert.throws(() => skills.remove(created.id), (e) => e.code === 'AGENT_SKILL_NOT_FOUND');
});

test('技能解析：严格模式拒绝停用/不存在，宽松模式自动过滤，最多 3 个', () => {
  const { skills } = fixture();
  const a = skills.create({ name: 'a', markdown: 'm1' });
  const b = skills.create({ name: 'b', markdown: 'm2' });
  skills.update(b.id, { enabled: false });

  assert.deepEqual(skills.resolveEnabledSkills([a.id]).map((s) => s.id), [a.id]);
  assert.throws(() => skills.resolveEnabledSkills([a.id, b.id]), (e) => e.code === 'AGENT_SKILL_UNAVAILABLE');
  assert.deepEqual(skills.resolveEnabledSkills([a.id, b.id], { strict: false }).map((s) => s.id), [a.id]);
  assert.throws(
    () => skills.resolveEnabledSkills([a.id, a.id, 'x', 'y', 'z']),
    (e) => e.code === 'AGENT_SKILL_TOO_MANY'
  );
});

test('会话绑定技能并持久化，运行时停用技能不影响发消息', async () => {
  const f = fixture();
  const skill = f.skills.create({ name: '白底图专家', markdown: '# 白底规则' });
  const planInputs = [];
  const runtime = makeRuntime(f, planInputs);

  assert.throws(() => runtime.createSession({ ...scope, skillIds: ['missing'] }), (e) => e.code === 'AGENT_SKILL_UNAVAILABLE');
  const session = runtime.createSession({ ...scope, skillIds: [skill.id] });
  assert.deepEqual(session.skillIds, [skill.id]);

  const restored = runtime.getSession({ ...scope, sessionId: session.id });
  assert.deepEqual(restored.session.skillIds, [skill.id]);

  await runtime.sendMessage({ ...scope, sessionId: session.id, text: '生成白底图', snapshot });
  assert.equal(planInputs.length, 1);
  assert.deepEqual(planInputs[0].skills, [{ name: '白底图专家', markdown: '# 白底规则' }]);

  f.skills.update(skill.id, { enabled: false });
  await runtime.sendMessage({ ...scope, sessionId: session.id, text: '再来一张', snapshot });
  assert.deepEqual(planInputs[1].skills, []);
});

test('更换会话技能：校验严格并写事件', () => {
  const f = fixture();
  const a = f.skills.create({ name: 'a', markdown: 'm1' });
  const b = f.skills.create({ name: 'b', markdown: 'm2' });
  const runtime = makeRuntime(f);
  const session = runtime.createSession({ ...scope });

  assert.throws(() => runtime.updateSessionSkills({ ...scope, sessionId: session.id }, ['nope']), (e) => e.code === 'AGENT_SKILL_UNAVAILABLE');
  const updated = runtime.updateSessionSkills({ ...scope, sessionId: session.id }, [b.id, a.id]);
  assert.deepEqual(updated.skillIds, [b.id, a.id]);
  const events = f.repository.listEvents({ ...scope, sessionId: session.id });
  const skillEvent = events.find((event) => event.type === 'session_skills_updated');
  assert.deepEqual(skillEvent.payload.skillNames, ['b', 'a']);
});

test('planner 把启用技能注入 system 上下文且不泄露密钥', async () => {
  let providerInput;
  const planner = createCanvasAgentPlanner({
    async callProvider(input) {
      providerInput = input;
      return { success: true, output: [{ type: 'message', content: [{ type: 'output_text', text: '好' }] }] };
    }
  });
  await planner.plan({
    userId: 'user_a',
    projectId: 'project_a',
    sessionId: 'session_a',
    browserSessionId: 'browser_a',
    message: '生成主图',
    history: [],
    snapshot,
    attachments: [],
    toolDefinitions: [],
    toolResults: [],
    skills: [{ name: '白底图专家', markdown: '# 角色\n所有结果必须是纯白背景。' }],
    signal: new AbortController().signal
  });
  const system = providerInput[0].content;
  assert.equal(system.includes('## 技能：白底图专家'), true);
  assert.equal(system.includes('所有结果必须是纯白背景'), true);
  assert.equal(system.includes('已启用技能是用户显式选择'), true);
  assert.equal(JSON.stringify(providerInput).includes('secret'), false);

  // 无技能时 system 不含技能段
  await planner.plan({
    userId: 'user_a', projectId: 'project_a', sessionId: 'session_a', browserSessionId: 'browser_a',
    message: 'hi', history: [], snapshot, attachments: [], toolDefinitions: [], toolResults: [], skills: [],
    signal: new AbortController().signal
  });
  assert.equal(providerInput[0].content.includes('## 技能：'), false);
});

'use strict';

const crypto = require('crypto');
const {
  canvasAgentToolDefinitions,
  compactCanvasState,
  prepareToolCall
} = require('./tool-contracts');
const { agentError, sanitizeForStorage } = require('./session-repository');

function createCanvasAgentRuntime(options = {}) {
  const repository = options.repository;
  const planner = options.planner;
  const siteTools = options.siteTools;
  if (!repository) throw new TypeError('Canvas Agent Runtime 缺少 repository');
  if (!planner || typeof planner.plan !== 'function') throw new TypeError('Canvas Agent Runtime 缺少 planner');
  if (!siteTools || typeof siteTools.execute !== 'function') throw new TypeError('Canvas Agent Runtime 缺少 siteTools');

  const idFactory = options.idFactory || ((prefix) => `${prefix}${crypto.randomUUID()}`);
  // 解析并校验会话绑定的 Agent 技能（管理员维护，enabled 过滤在仓库层完成）。
  const resolveSkills = typeof options.resolveSkills === 'function' ? options.resolveSkills : () => [];
  const controllers = new Map();
  const subscribers = new Map();
  const toolDefinitions = canvasAgentToolDefinitions();

  function scopeKey(scope) {
    return `${scope.userId}\u0000${scope.projectId}\u0000${scope.browserSessionId}\u0000${scope.sessionId}`;
  }

  function emit(scope, event) {
    const listeners = subscribers.get(scopeKey(scope));
    if (!listeners) return;
    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // SSE 客户端断开由路由层移除；单个监听器异常不能影响会话持久化。
      }
    });
  }

  function appendEvent(scope, type, payload = {}) {
    const event = repository.appendEvent({ ...scope, type, payload });
    emit(scope, event);
    return event;
  }

  function start() {
    return repository.recoverInterrupted();
  }

  function createSession(input) {
    if (!input.userId || !input.projectId || !input.browserSessionId) {
      throw agentError(400, 'CANVAS_AGENT_SCOPE_REQUIRED', '缺少 Agent 会话隔离字段');
    }
    // 绑定前校验技能存在且启用；非法 id 直接 400，不写入会话。
    if (input.skillIds !== undefined) resolveSkills(input.skillIds);
    const session = repository.createSession(input);
    const scope = { ...input, sessionId: session.id };
    appendEvent(scope, 'session_created', { title: session.title, skillIds: session.skillIds });
    return session;
  }

  function updateSessionSkills(scope, skillIds) {
    const skills = resolveSkills(skillIds);
    const session = repository.updateSessionSkills(scope, skills.map((skill) => skill.id));
    appendEvent(scope, 'session_skills_updated', { skillIds: session.skillIds, skillNames: skills.map((skill) => skill.name) });
    return session;
  }

  function listSessions(scope) {
    return repository.listSessions(scope).map((session) => {
      const sessionScope = { ...scope, sessionId: session.id };
      const events = repository.listEvents(sessionScope, { limit: 200 });
      const calls = repository.listToolCalls(sessionScope);
      const lastMessage = [...events].reverse().find((event) => ['user_message', 'assistant_message'].includes(event.type));
      return {
        ...session,
        pendingToolCount: calls.filter((call) => ['pending', 'approved'].includes(call.status)).length,
        preview: String(lastMessage?.payload?.text || '').slice(0, 120)
      };
    });
  }

  function getSession(scope) {
    return {
      session: repository.getSession(scope),
      events: repository.listEvents(scope),
      toolCalls: repository.listToolCalls(scope)
    };
  }

  function deleteSession(scope) {
    controllers.get(scope.sessionId)?.abort();
    controllers.delete(scope.sessionId);
    appendEvent(scope, 'session_deleted', {});
    const result = repository.deleteSession(scope);
    subscribers.delete(scopeKey(scope));
    return result;
  }

  function subscribe(scope, listener) {
    repository.getSession(scope);
    const key = scopeKey(scope);
    const listeners = subscribers.get(key) || new Set();
    listeners.add(listener);
    subscribers.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) subscribers.delete(key);
    };
  }

  function conversationHistory(scope) {
    return repository.listEvents(scope, { limit: 200 })
      .filter((event) => ['user_message', 'assistant_message', 'tool_executed', 'tool_failed'].includes(event.type))
      .slice(-40)
      .map((event) => ({
        type: event.type,
        text: String(event.payload?.text || event.payload?.summary || ''),
        result: event.type === 'tool_executed' ? event.payload?.result : undefined
      }));
  }

  function safeMentions(mentions) {
    return (Array.isArray(mentions) ? mentions : []).slice(0, 12).flatMap((item) => {
      if (!item || typeof item !== 'object' || (!item.nodeId && !item.attachmentId) || !item.label) return [];
      return [{
        label: String(item.label).slice(0, 40),
        nodeId: item.nodeId ? String(item.nodeId).slice(0, 160) : undefined,
        attachmentId: item.attachmentId ? String(item.attachmentId).slice(0, 160) : undefined,
        accessUrl: typeof item.accessUrl === 'string' && (item.accessUrl.startsWith('/api/asset-content/') || item.accessUrl.startsWith('/uploads/')) ? item.accessUrl.slice(0, 500) : undefined,
        title: String(item.title || '').slice(0, 120),
        kind: String(item.kind || '').slice(0, 20)
      }];
    });
  }

  function safeAttachments(attachments) {
    return (Array.isArray(attachments) ? attachments : []).slice(0, 8).flatMap((item) => {
      if (!item || typeof item !== 'object' || !item.id || !item.assetId) return [];
      return [{
        id: String(item.id).slice(0, 160),
        assetId: String(item.assetId).slice(0, 160),
        name: String(item.name || '参考图').slice(0, 240),
        type: String(item.type || 'image/png').slice(0, 120),
        width: Number(item.width) || 0,
        height: Number(item.height) || 0,
        accessUrl: typeof item.accessUrl === 'string' && item.accessUrl.startsWith('/api/asset-content/')
          ? item.accessUrl
          : ''
      }];
    });
  }

  function titleFromMessage(text) {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    return compact ? compact.slice(0, 28) : '新对话';
  }

  async function sendMessage(input) {
    const scope = {
      userId: input.userId,
      projectId: input.projectId,
      browserSessionId: input.browserSessionId,
      sessionId: input.sessionId
    };
    const current = repository.getSession(scope);
    if (current.status === 'running') {
      throw agentError(409, 'CANVAS_AGENT_SESSION_BUSY', '当前 Agent 会话仍在处理中');
    }
    const text = String(input.text || '').trim();
    const attachments = safeAttachments(input.attachments);
    const mentions = safeMentions(input.mentions);
    if (!text && !attachments.length) {
      throw agentError(400, 'CANVAS_AGENT_MESSAGE_REQUIRED', '请输入消息或上传参考图');
    }
    const snapshot = compactCanvasState(input.snapshot);
    if (snapshot.projectId && snapshot.projectId !== scope.projectId) {
      throw agentError(409, 'CANVAS_AGENT_PROJECT_MISMATCH', '画布快照与 Agent 会话项目不一致');
    }

    if (current.title === '新对话' && text) {
      // 标题自动生成属于显示元数据，不改变会话隔离和业务状态。
      const rawDbUpdate = options.renameSession;
      if (typeof rawDbUpdate === 'function') rawDbUpdate(scope, titleFromMessage(text));
    }

    const turnId = idFactory('agent_turn_');
    // 已绑定技能在发送时宽松解析：管理员后来停用的技能自动失效，不阻断对话。
    const activeSkills = resolveSkills(current.skillIds || [], { strict: false });
    appendEvent(scope, 'user_message', {
      turnId,
      text,
      attachments: attachments.map(({ accessUrl, ...item }) => item),
      mentions,
      selectedNodeIds: snapshot.selectedNodeIds
    });
    repository.updateSessionStatus(scope, 'running');
    appendEvent(scope, 'turn_started', {
      turnId,
      selectedNodeCount: snapshot.selectedNodeIds.length,
      attachmentCount: attachments.length,
      skillNames: activeSkills.map((skill) => skill.name)
    });

    const controller = new AbortController();
    controllers.set(scope.sessionId, controller);
    let toolResults = [];
    let pendingCount = 0;
    let assistantText = '';

    try {
      for (let round = 0; round < 4; round += 1) {
        const planned = await planner.plan({
          userId: scope.userId,
          projectId: scope.projectId,
          sessionId: scope.sessionId,
          turnId,
          browserSessionId: scope.browserSessionId,
          message: text,
          history: conversationHistory(scope),
          snapshot,
          attachments: attachments.map(({ accessUrl, ...item }) => item),
          toolDefinitions,
          toolResults,
          mentions,
          skills: activeSkills.map((skill) => ({ name: skill.name, markdown: skill.markdown })),
          signal: controller.signal
        });
        if (controller.signal.aborted) break;
        assistantText = String(planned?.text || '').trim();
        const calls = Array.isArray(planned?.toolCalls) ? planned.toolCalls.slice(0, 12) : [];
        const nextToolResults = [];

        for (const rawCall of calls) {
          const callId = idFactory('agent_call_');
          const prepared = prepareToolCall(rawCall?.name, rawCall?.input, {
            snapshot,
            attachments,
            callId,
            idFactory
          });
          if (prepared.requiresConfirmation) {
            const toolCall = repository.insertToolCall({
              ...scope,
              id: callId,
              name: prepared.name,
              input: prepared.input,
              summary: prepared.summary,
              execution: prepared.execution,
              status: 'pending'
            });
            pendingCount += 1;
            appendEvent(scope, 'tool_proposed', { toolCall });
            continue;
          }

          appendEvent(scope, 'tool_started', {
            callId,
            name: prepared.name,
            summary: prepared.summary || prepared.name
          });
          try {
            const result = prepared.execution.kind === 'read_result'
              ? prepared.execution.result
              : await siteTools.execute({
                userId: scope.userId,
                projectId: scope.projectId,
                sessionId: scope.sessionId,
                browserSessionId: scope.browserSessionId,
                callId,
                name: prepared.execution.name,
                input: prepared.execution.input,
                write: false,
                signal: controller.signal,
                snapshot
              });
            const safeResult = sanitizeForStorage(result);
            appendEvent(scope, 'tool_executed', {
              callId,
              name: prepared.name,
              summary: prepared.summary || prepared.name,
              result: safeResult,
              readOnly: true
            });
            nextToolResults.push({ callId, name: prepared.name, result: safeResult });
          } catch (error) {
            const failure = {
              callId,
              name: prepared.name,
              error: error?.message || '工具执行失败'
            };
            appendEvent(scope, 'tool_failed', failure);
            nextToolResults.push(failure);
          }
        }

        if (assistantText) appendEvent(scope, 'assistant_message', { text: assistantText });
        if (pendingCount || !nextToolResults.length) break;
        toolResults = nextToolResults;
      }

      if (controller.signal.aborted || repository.getSession(scope).status === 'stopped') {
        return getSession(scope);
      }
      repository.updateSessionStatus(scope, pendingCount ? 'waiting_confirmation' : 'idle');
      appendEvent(scope, pendingCount ? 'turn_waiting_confirmation' : 'turn_completed', {
        pendingToolCount: pendingCount
      });
      return getSession(scope);
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') {
        if (repository.getSession(scope).status !== 'stopped') {
          repository.updateSessionStatus(scope, 'stopped');
          appendEvent(scope, 'turn_stopped', {});
        }
        return getSession(scope);
      }
      repository.updateSessionStatus(scope, 'error');
      appendEvent(scope, 'turn_error', {
        code: error?.code || 'CANVAS_AGENT_PLAN_FAILED',
        message: error?.message || 'Agent 处理失败'
      });
      throw error;
    } finally {
      if (controllers.get(scope.sessionId) === controller) controllers.delete(scope.sessionId);
    }
  }

  function nextSessionStatus(scope) {
    const calls = repository.listToolCalls(scope);
    if (calls.some((call) => call.status === 'pending')) return 'waiting_confirmation';
    if (calls.some((call) => call.status === 'approved')) return 'waiting_result';
    return 'idle';
  }

  async function confirmToolCall(input) {
    const scope = {
      userId: input.userId,
      projectId: input.projectId,
      browserSessionId: input.browserSessionId,
      sessionId: input.sessionId
    };
    const approved = repository.approveToolCall(scope, input.callId);
    if (!approved.changed) {
      return {
        session: repository.getSession(scope),
        toolCall: approved.toolCall,
        execute: false,
        replayed: true
      };
    }
    appendEvent(scope, 'tool_approved', {
      callId: approved.toolCall.id,
      name: approved.toolCall.name,
      summary: approved.toolCall.summary
    });
    repository.updateSessionStatus(scope, 'waiting_result');

    if (approved.toolCall.execution?.kind !== 'site_tool') {
      return {
        session: repository.getSession(scope),
        toolCall: approved.toolCall,
        execution: approved.toolCall.execution,
        execute: true,
        replayed: false
      };
    }

    try {
      const result = await siteTools.execute({
        userId: scope.userId,
        projectId: scope.projectId,
        sessionId: scope.sessionId,
        browserSessionId: scope.browserSessionId,
        callId: approved.toolCall.id,
        name: approved.toolCall.execution.name,
        input: approved.toolCall.execution.input,
        write: true
      });
      const finished = repository.finishToolCall(scope, approved.toolCall.id, {
        result: sanitizeForStorage(result)
      });
      appendEvent(scope, 'tool_executed', {
        callId: finished.toolCall.id,
        name: finished.toolCall.name,
        summary: finished.toolCall.summary,
        result: finished.toolCall.result
      });
      repository.updateSessionStatus(scope, nextSessionStatus(scope));
      return {
        session: repository.getSession(scope),
        toolCall: finished.toolCall,
        execute: false,
        replayed: false
      };
    } catch (error) {
      const finished = repository.finishToolCall(scope, approved.toolCall.id, {
        error: error?.message || '站点工具执行失败'
      });
      appendEvent(scope, 'tool_failed', {
        callId: finished.toolCall.id,
        name: finished.toolCall.name,
        summary: finished.toolCall.summary,
        error: finished.toolCall.error
      });
      repository.updateSessionStatus(scope, nextSessionStatus(scope));
      return {
        session: repository.getSession(scope),
        toolCall: finished.toolCall,
        execute: false,
        replayed: false
      };
    }
  }

  function reportToolResult(input) {
    const scope = {
      userId: input.userId,
      projectId: input.projectId,
      browserSessionId: input.browserSessionId,
      sessionId: input.sessionId
    };
    const finished = repository.finishToolCall(scope, input.callId, {
      result: sanitizeForStorage(input.result),
      error: input.error
    });
    if (finished.changed) {
      appendEvent(scope, input.error ? 'tool_failed' : 'tool_executed', {
        callId: finished.toolCall.id,
        name: finished.toolCall.name,
        summary: finished.toolCall.summary,
        result: finished.toolCall.result,
        error: finished.toolCall.error
      });
    }
    const session = repository.updateSessionStatus(scope, nextSessionStatus(scope));
    if (session.status === 'idle') appendEvent(scope, 'turn_completed', { pendingToolCount: 0 });
    return {
      session: repository.getSession(scope),
      toolCall: repository.getToolCall(scope, input.callId),
      replayed: !finished.changed
    };
  }

  function rejectToolCall(input) {
    const scope = {
      userId: input.userId,
      projectId: input.projectId,
      browserSessionId: input.browserSessionId,
      sessionId: input.sessionId
    };
    const rejected = repository.rejectToolCall(scope, input.callId, input.reason);
    if (rejected.changed) {
      appendEvent(scope, 'tool_rejected', {
        callId: rejected.toolCall.id,
        name: rejected.toolCall.name,
        summary: rejected.toolCall.summary,
        reason: input.reason || '用户拒绝执行'
      });
    }
    const session = repository.updateSessionStatus(scope, nextSessionStatus(scope));
    if (session.status === 'idle') appendEvent(scope, 'turn_completed', { pendingToolCount: 0 });
    return {
      session: repository.getSession(scope),
      toolCall: repository.getToolCall(scope, input.callId),
      execute: false,
      replayed: !rejected.changed
    };
  }

  function stopSession(scope) {
    repository.getSession(scope);
    controllers.get(scope.sessionId)?.abort();
    controllers.delete(scope.sessionId);
    const session = repository.updateSessionStatus(scope, 'stopped');
    appendEvent(scope, 'turn_stopped', {});
    return { session };
  }

  return {
    start,
    createSession,
    listSessions,
    getSession,
    deleteSession,
    subscribe,
    sendMessage,
    confirmToolCall,
    reportToolResult,
    rejectToolCall,
    stopSession,
    updateSessionSkills
  };
}

module.exports = {
  createCanvasAgentRuntime
};

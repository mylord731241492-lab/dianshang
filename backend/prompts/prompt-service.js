'use strict';

// 双层云端提示词库业务层（Task 7）：字段校验、长度上限、版本自增规则、copy-system。
// 校验与上限常量风格参照 backend/assets；错误统一走 err.status/err.code，由 server.js 错误中间件输出。

const {
  createPromptRepository,
  PROMPT_TITLE_MAX,
  PROMPT_CONTENT_MAX,
  PROMPT_CATEGORY_MAX,
  PROMPT_TAG_MAX_LENGTH,
  PROMPT_TAGS_MAX_COUNT
} = require('./prompt-repository');

const SYSTEM_PROMPT_STATUSES = ['draft', 'published', 'disabled'];

function promptError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeTitle(value) {
  const title = String(value === undefined || value === null ? '' : value).trim();
  if (!title) throw promptError(400, 'PROMPT_TITLE_REQUIRED', '标题去除首尾空白后必填');
  if (title.length > PROMPT_TITLE_MAX) throw promptError(400, 'PROMPT_TITLE_TOO_LONG', `标题长度不能超过 ${PROMPT_TITLE_MAX} 字`);
  return title;
}

function normalizeContent(value) {
  const content = String(value === undefined || value === null ? '' : value).trim();
  if (!content) throw promptError(400, 'PROMPT_CONTENT_REQUIRED', '内容去除首尾空白后必填');
  if (content.length > PROMPT_CONTENT_MAX) throw promptError(400, 'PROMPT_CONTENT_TOO_LONG', `内容长度不能超过 ${PROMPT_CONTENT_MAX} 字`);
  return content;
}

function normalizeCategory(value) {
  const category = String(value === undefined || value === null ? '' : value).trim();
  if (category.length > PROMPT_CATEGORY_MAX) throw promptError(400, 'PROMPT_CATEGORY_TOO_LONG', `分类长度不能超过 ${PROMPT_CATEGORY_MAX} 字`);
  return category;
}

function normalizeTags(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw promptError(400, 'PROMPT_TAGS_INVALID', '标签必须是字符串数组');
  if (value.length > PROMPT_TAGS_MAX_COUNT) throw promptError(400, 'PROMPT_TAGS_INVALID', `标签数量不能超过 ${PROMPT_TAGS_MAX_COUNT} 个`);
  return value.map((tag) => {
    const normalized = String(tag === undefined || tag === null ? '' : tag).trim();
    if (!normalized || normalized.length > PROMPT_TAG_MAX_LENGTH) {
      throw promptError(400, 'PROMPT_TAGS_INVALID', `单个标签须为 1-${PROMPT_TAG_MAX_LENGTH} 字`);
    }
    return normalized;
  });
}

function normalizeStatus(value, fallback = 'draft') {
  if (value === undefined || value === null || value === '') return fallback;
  const status = String(value).trim();
  if (!SYSTEM_PROMPT_STATUSES.includes(status)) {
    throw promptError(400, 'PROMPT_STATUS_INVALID', `状态只支持 ${SYSTEM_PROMPT_STATUSES.join('/')}`);
  }
  return status;
}

function normalizeSortOrder(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const sortOrder = Number(value);
  if (!Number.isFinite(sortOrder)) throw promptError(400, 'PROMPT_SORT_ORDER_INVALID', '排序值必须是数字');
  return Math.trunc(sortOrder);
}

function notFound() {
  return promptError(404, 'PROMPT_NOT_FOUND', '提示词不存在');
}

function createPromptService(options = {}) {
  const repository = options.promptRepository || createPromptRepository(options);

  // ---------------- 我的提示词（当前登录用户私有） ----------------

  function listUserPrompts(userId, query = {}) {
    const result = repository.listUserPrompts(userId, query);
    if (result.error === 'cursor') throw promptError(400, 'PROMPT_CURSOR_INVALID', '分页游标无效');
    return result;
  }

  function createUserPrompt(userId, body = {}) {
    const id = repository.newPromptId();
    return repository.insertUserPrompt({
      id,
      userId,
      title: normalizeTitle(body.title),
      content: normalizeContent(body.content),
      category: normalizeCategory(body.category),
      tags: normalizeTags(body.tags),
      isFavorite: body.isFavorite === true
    });
  }

  function getUserPrompt(userId, id) {
    const item = repository.getUserPrompt(userId, id);
    if (!item) throw notFound();
    return item;
  }

  function updateUserPrompt(userId, id, body = {}) {
    const existing = repository.getUserPrompt(userId, id);
    if (!existing) throw notFound();
    return repository.updateUserPrompt(userId, id, {
      title: body.title !== undefined ? normalizeTitle(body.title) : existing.title,
      content: body.content !== undefined ? normalizeContent(body.content) : existing.content,
      category: body.category !== undefined ? normalizeCategory(body.category) : existing.category,
      tags: body.tags !== undefined ? normalizeTags(body.tags) : existing.tags,
      isFavorite: body.isFavorite !== undefined ? body.isFavorite === true : existing.isFavorite
    });
  }

  function deleteUserPrompt(userId, id) {
    if (!repository.softDeleteUserPrompt(userId, id)) throw notFound();
    return { deleted: true, id };
  }

  // 复制已发布默认提示词为当前用户私有副本；副本独立编辑，不回写默认提示词。
  function copySystemPrompt(userId, body = {}) {
    const systemPromptId = String(body.systemPromptId || body.id || '').trim();
    if (!systemPromptId) throw promptError(400, 'PROMPT_SYSTEM_ID_REQUIRED', '缺少默认提示词 ID');
    const source = repository.getPublishedSystemPrompt(systemPromptId);
    if (!source) throw notFound();
    return repository.insertUserPrompt({
      id: repository.newPromptId(),
      userId,
      title: source.title,
      content: source.content,
      category: source.category,
      tags: source.tags,
      isFavorite: false
    });
  }

  // ---------------- 默认提示词（admin 维护；普通用户只读已发布） ----------------

  function listPublishedSystemPrompts(query = {}) {
    const result = repository.listPublishedSystemPrompts(query);
    if (result.error === 'cursor') throw promptError(400, 'PROMPT_CURSOR_INVALID', '分页游标无效');
    return result;
  }

  function listSystemPromptsAdmin(query = {}) {
    const status = String(query.status || '').trim();
    if (status && !SYSTEM_PROMPT_STATUSES.includes(status)) {
      throw promptError(400, 'PROMPT_STATUS_INVALID', `状态只支持 ${SYSTEM_PROMPT_STATUSES.join('/')}`);
    }
    const result = repository.listSystemPromptsAdmin({ ...query, status });
    if (result.error === 'cursor') throw promptError(400, 'PROMPT_CURSOR_INVALID', '分页游标无效');
    return result;
  }

  function createSystemPrompt(operatorId, body = {}) {
    return repository.insertSystemPrompt({
      id: repository.newPromptId(),
      operatorId,
      title: normalizeTitle(body.title),
      content: normalizeContent(body.content),
      category: normalizeCategory(body.category),
      tags: normalizeTags(body.tags),
      status: normalizeStatus(body.status, 'draft'),
      sortOrder: normalizeSortOrder(body.sortOrder, 0)
    });
  }

  function getSystemPrompt(id) {
    const item = repository.getSystemPrompt(id);
    if (!item) throw notFound();
    return item;
  }

  function updateSystemPrompt(operatorId, id, body = {}) {
    const existing = repository.getSystemPrompt(id);
    if (!existing) throw notFound();
    const next = {
      title: body.title !== undefined ? normalizeTitle(body.title) : existing.title,
      content: body.content !== undefined ? normalizeContent(body.content) : existing.content,
      category: body.category !== undefined ? normalizeCategory(body.category) : existing.category,
      tags: body.tags !== undefined ? normalizeTags(body.tags) : existing.tags,
      status: body.status !== undefined ? normalizeStatus(body.status, existing.status) : existing.status,
      sortOrder: body.sortOrder !== undefined ? normalizeSortOrder(body.sortOrder, existing.sortOrder) : existing.sortOrder
    };
    // 只有内容字段（标题/内容/分类/标签）变化才自增 version；仅改状态或排序不自增。
    const bumpVersion = next.title !== existing.title
      || next.content !== existing.content
      || next.category !== existing.category
      || JSON.stringify(next.tags) !== JSON.stringify(existing.tags);
    return repository.updateSystemPrompt(id, next, { bumpVersion, operatorId });
  }

  function deleteSystemPrompt(id) {
    if (!repository.softDeleteSystemPrompt(id)) throw notFound();
    return { deleted: true, id };
  }

  return {
    listUserPrompts,
    createUserPrompt,
    getUserPrompt,
    updateUserPrompt,
    deleteUserPrompt,
    copySystemPrompt,
    listPublishedSystemPrompts,
    listSystemPromptsAdmin,
    createSystemPrompt,
    getSystemPrompt,
    updateSystemPrompt,
    deleteSystemPrompt
  };
}

module.exports = {
  createPromptService,
  promptError,
  SYSTEM_PROMPT_STATUSES
};

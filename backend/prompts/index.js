'use strict';

// backend/prompts 模块入口：默认提示词 + 我的提示词双层云端提示词库（Task 7）。
// server.js 只负责 createPromptService + registerPromptRoutes 挂载。

const { createPromptService, promptError, SYSTEM_PROMPT_STATUSES } = require('./prompt-service');
const { createPromptRepository } = require('./prompt-repository');
const { registerPromptRoutes } = require('./routes');

module.exports = {
  createPromptService,
  createPromptRepository,
  registerPromptRoutes,
  promptError,
  SYSTEM_PROMPT_STATUSES
};

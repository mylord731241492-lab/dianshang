'use strict';

// backend/assets 模块入口：账号隔离云端资产库（ADR-0006）。
// server.js 只负责 createAssetService + registerAssetRoutes 挂载。

const { createAssetService, DEFAULT_ACCESS_URL_TTL_SECONDS } = require('./asset-service');
const { registerAssetRoutes } = require('./routes');
const { createAssetRepository } = require('./asset-repository');
const { FakeObjectStorage, UnavailableObjectStorage, storageError } = require('./object-storage');
const magicBytes = require('./magic-bytes');

module.exports = {
  createAssetService,
  registerAssetRoutes,
  createAssetRepository,
  FakeObjectStorage,
  UnavailableObjectStorage,
  storageError,
  magicBytes,
  DEFAULT_ACCESS_URL_TTL_SECONDS
};

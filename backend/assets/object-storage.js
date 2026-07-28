'use strict';

// ObjectStorage 统一接口（ADR-0006）：
//   putObject({ key, body, contentType, checksumSha256 }): Promise<void>
//   createSignedReadUrl({ key, expiresInSeconds }): Promise<string>
//   headObject(key): Promise<{ sizeBytes, contentType }>
// Fake 实现与将来的 S3 兼容实现实现同一接口；浏览器不感知差异。
// Fake 额外暴露 readObject(key)，供后端签名内容路由读回文件（等价于 S3 的 GetObject）。

const fs = require('fs');
const path = require('path');

const SAFE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;

function storageError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

class FakeObjectStorage {
  constructor(options = {}) {
    if (!options.rootDir) throw new TypeError('FakeObjectStorage 缺少 rootDir');
    if (typeof options.signReadUrl !== 'function') throw new TypeError('FakeObjectStorage 缺少 signReadUrl 回调');
    this.provider = 'fake';
    this.rootDir = path.resolve(options.rootDir);
    this.signReadUrl = options.signReadUrl;
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  resolveKey(key) {
    const normalized = String(key || '').replace(/\\/g, '/');
    if (!SAFE_KEY_PATTERN.test(normalized) || normalized.includes('..')) {
      throw storageError(400, 'ASSET_OBJECT_KEY_INVALID', '非法对象键');
    }
    const fullPath = path.resolve(this.rootDir, normalized);
    if (fullPath !== this.rootDir && !fullPath.startsWith(this.rootDir + path.sep)) {
      throw storageError(400, 'ASSET_OBJECT_KEY_INVALID', '对象键不得越出存储根目录');
    }
    return fullPath;
  }

  async putObject({ key, body, contentType, checksumSha256 }) {
    const fullPath = this.resolveKey(key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, body);
    fs.writeFileSync(`${fullPath}.meta.json`, JSON.stringify({ contentType, checksumSha256 }));
  }

  async createSignedReadUrl({ key, expiresInSeconds }) {
    this.resolveKey(key);
    return this.signReadUrl({ key, expiresInSeconds });
  }

  async headObject(key) {
    const fullPath = this.resolveKey(key);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      throw storageError(404, 'ASSET_OBJECT_NOT_FOUND', '对象不存在');
    }
    let contentType = 'application/octet-stream';
    try {
      contentType = JSON.parse(fs.readFileSync(`${fullPath}.meta.json`, 'utf8')).contentType || contentType;
    } catch {}
    return { sizeBytes: stat.size, contentType };
  }

  async readObject(key) {
    const fullPath = this.resolveKey(key);
    if (!fs.existsSync(fullPath)) throw storageError(404, 'ASSET_OBJECT_NOT_FOUND', '对象不存在');
    const { contentType } = await this.headObject(key);
    return { body: fs.readFileSync(fullPath), contentType };
  }
}

// 真实云存储暂缓（2026-07-27 用户拍板，未批准任何 SDK）。
// ENABLE_REAL_STORAGE=true 时使用本实现：所有操作一律 503，绝不静默回退服务器本地 uploads。
class UnavailableObjectStorage {
  constructor() {
    this.provider = 'unavailable';
    console.warn('[ASSETS] ENABLE_REAL_STORAGE=true，但真实对象存储驱动尚未实施（SDK 未批准）。资产存储接口将返回 503 ASSET_STORAGE_UNAVAILABLE，不会回退本地 uploads。');
  }

  unavailable() {
    throw storageError(503, 'ASSET_STORAGE_UNAVAILABLE', '真实云存储尚未接入，请配置 ENABLE_REAL_STORAGE=false 使用候选 Fake Storage，或等待存储方案确认');
  }

  async putObject() { this.unavailable(); }
  async createSignedReadUrl() { this.unavailable(); }
  async headObject() { this.unavailable(); }
  async readObject() { this.unavailable(); }
}

module.exports = {
  FakeObjectStorage,
  UnavailableObjectStorage,
  storageError
};

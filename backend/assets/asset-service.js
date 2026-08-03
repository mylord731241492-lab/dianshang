'use strict';

// 账号隔离云端资产库服务：上传校验（magic bytes + 大小）、对象键生成、
// generations 导入、15 分钟签名读取 URL（HMAC）、软删除。
// 决策依据 ADR-0006：Fake 与真实实现同一 ObjectStorage 接口；
// ENABLE_REAL_STORAGE=true 且真实驱动未实施时一律 503，不回退本地 uploads。

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createAssetRepository } = require('./asset-repository');
const { FakeObjectStorage, UnavailableObjectStorage, storageError } = require('./object-storage');
const {
  sniffAssetType,
  declaredMimeMatches,
  maxBytesForKind,
  extensionForMime
} = require('./magic-bytes');

const DEFAULT_ACCESS_URL_TTL_SECONDS = 900; // 15 分钟，2026-07-27 用户拍板

function createAssetService(options = {}) {
  const db = options.db;
  if (!db) throw new TypeError('缺少 SQLite 数据库连接');
  const repository = createAssetRepository({ db, idFactory: options.idFactory });
  const uploadDir = path.resolve(options.uploadDir || 'uploads');
  const signingSecret = String(options.signingSecret || '').trim();
  if (!signingSecret) throw new TypeError('缺少资产签名密钥（ASSET_URL_SIGNING_SECRET 或 JWT_SECRET 派生值）');
  const accessUrlTtlSeconds = Math.max(60, Number(options.accessUrlTtlSeconds || DEFAULT_ACCESS_URL_TTL_SECONDS));

  // 签名内容 URL：/api/asset-content/:assetId?expires=<unix>&sig=<hmac>
  // 浏览器 <img> 无法携带 Authorization，签名即能力凭证；过期必须重新经后端签发。
  function sign(assetId, expires) {
    return crypto.createHmac('sha256', signingSecret).update(`${assetId}.${expires}`).digest('hex');
  }

  function signReadUrl({ key }) {
    const segments = String(key).split('/');
    const assetId = segments[2] === 'assets' ? segments[3] : '';
    if (!assetId) throw storageError(400, 'ASSET_OBJECT_KEY_INVALID', '对象键缺少资产 ID');
    const expires = Math.floor(Date.now() / 1000) + accessUrlTtlSeconds;
    return `/api/asset-content/${encodeURIComponent(assetId)}?expires=${expires}&sig=${sign(assetId, expires)}`;
  }

  const storage = options.storage || (options.enableRealStorage
    ? new UnavailableObjectStorage()
    : new FakeObjectStorage({ rootDir: options.fakeStorageRoot, signReadUrl }));

  function verifyContentSignature(assetId, expires, sig) {
    const expiresNumber = Number(expires);
    if (!assetId || !Number.isFinite(expiresNumber) || !sig || !/^[0-9a-f]{64}$/i.test(String(sig))) {
      throw storageError(403, 'ASSET_URL_INVALID', '资产访问 URL 签名无效');
    }
    const expected = Buffer.from(sign(assetId, expiresNumber), 'utf8');
    const provided = Buffer.from(String(sig), 'utf8');
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
      throw storageError(403, 'ASSET_URL_INVALID', '资产访问 URL 签名无效');
    }
    if (expiresNumber < Math.floor(Date.now() / 1000)) {
      throw storageError(403, 'ASSET_URL_EXPIRED', '资产访问 URL 已过期，请重新签发');
    }
  }

  // 服务端生成 safe-file-name：随机名 + 按真实类型白名单扩展名，不使用用户原始文件名拼接。
  function safeFileName(mime) {
    return `${crypto.randomBytes(12).toString('hex')}${extensionForMime(mime)}`;
  }

  function validateUpload(buffer, declaredMime) {
    const sniffed = sniffAssetType(buffer);
    if (!sniffed) {
      throw storageError(400, 'ASSET_TYPE_NOT_ALLOWED', '不支持的文件类型：仅允许 PNG/JPEG/WebP 图片与 MP4/WebM/MP3/WAV/M4A 音视频，SVG 等格式被拒绝');
    }
    // declaredMime 为空（如 generations 导入）时以文件头识别结果为准；客户端声明了类型则必须一致。
    if (declaredMime && !declaredMimeMatches(sniffed.mime, declaredMime)) {
      throw storageError(400, 'ASSET_MIME_MISMATCH', `声明类型 ${declaredMime || '(空)'} 与文件真实类型 ${sniffed.mime} 不一致`);
    }
    const maxBytes = maxBytesForKind(sniffed.kind);
    if (buffer.length > maxBytes) {
      throw storageError(413, 'ASSET_FILE_TOO_LARGE', sniffed.kind === 'image' ? '图片单文件不能超过 20MB' : '视频/音频单文件不能超过 50MB');
    }
    return sniffed;
  }

  async function storeValidatedBuffer({ userId, buffer, declaredMime, name, source, prompt }) {
    const sniffed = validateUpload(buffer, declaredMime);
    const assetId = repository.newAssetId();
    const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const objectKey = `users/${userId}/assets/${assetId}/${safeFileName(sniffed.mime)}`;
    await storage.putObject({ key: objectKey, body: buffer, contentType: sniffed.mime, checksumSha256 });
    const asset = repository.insertAsset({
      id: assetId,
      userId,
      kind: sniffed.kind,
      name: String(name || `资产 ${assetId}`).trim().slice(0, 200) || `资产 ${assetId}`,
      objectKey,
      storageProvider: storage.provider,
      mimeType: sniffed.mime,
      sizeBytes: buffer.length,
      checksumSha256,
      source: source || 'upload',
      prompt: String(prompt || '').slice(0, 4000)
    });
    return asset;
  }

  // 生图任务成功结果落云端资产库（Task 8）：字节已由生图管道校验过，仍以 magic bytes 复核；
  // source='generated' 与手动上传（upload）、历史导入（generation）区分；
  // 图片编辑工具结果（Task 9）传 source='tool' 与生图任务结果区分。
  async function storeGeneratedAsset({ userId, buffer, name, source, prompt }) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      throw storageError(400, 'ASSET_FILE_REQUIRED', '缺少生成结果文件');
    }
    return storeValidatedBuffer({
      userId,
      buffer,
      declaredMime: '',
      name: String(name || '').trim() || '生成图片',
      source: source === 'tool' ? 'tool' : 'generated',
      prompt: String(prompt || '').slice(0, 4000)
    });
  }

  // 同步签发 15 分钟读取 URL：只做 HMAC，不触存储；供任务轮询响应附带 assetId 的短时展示 URL。
  function signAccessUrl(assetId) {
    const id = String(assetId || '').trim();
    if (!id) throw storageError(400, 'ASSET_ID_REQUIRED', '缺少资产 ID');
    const expires = Math.floor(Date.now() / 1000) + accessUrlTtlSeconds;
    return {
      url: `/api/asset-content/${encodeURIComponent(id)}?expires=${expires}&sig=${sign(id, expires)}`,
      expiresAt: new Date(expires * 1000).toISOString(),
      expiresInSeconds: accessUrlTtlSeconds
    };
  }

  async function uploadAsset({ userId, file }) {
    if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length) {
      throw storageError(400, 'ASSET_FILE_REQUIRED', '缺少上传文件');
    }
    const displayName = String(file.originalname || '').trim() || '未命名资产';
    return storeValidatedBuffer({
      userId,
      buffer: file.buffer,
      declaredMime: file.mimetype,
      name: displayName,
      source: 'upload'
    });
  }

  // generations 记录导入资产库：仅支持本地 /uploads/ 下的生成文件，复制进对象存储，原文件保留。
  async function importGeneration({ userId, generationId }) {
    const generation = db.prepare('SELECT * FROM generations WHERE id=? AND user_id=?')
      .get(String(generationId || '').trim(), userId);
    if (!generation) throw storageError(404, 'ASSET_GENERATION_NOT_FOUND', '生成记录不存在');
    const resultUrl = String(generation.result_url || '').trim();
    if (!resultUrl.startsWith('/uploads/')) {
      throw storageError(422, 'ASSET_IMPORT_UNSUPPORTED', '仅支持导入本地生成的图片记录');
    }
    const relativePath = resultUrl.slice('/uploads/'.length).replace(/\\/g, '/');
    const sourcePath = path.resolve(uploadDir, relativePath);
    if (sourcePath !== uploadDir && !sourcePath.startsWith(uploadDir + path.sep)) {
      throw storageError(422, 'ASSET_IMPORT_UNSUPPORTED', '生成记录路径非法');
    }
    let buffer;
    try {
      buffer = fs.readFileSync(sourcePath);
    } catch {
      throw storageError(422, 'ASSET_IMPORT_SOURCE_MISSING', '生成记录对应的文件已不存在');
    }
    return storeValidatedBuffer({
      userId,
      buffer,
      declaredMime: '',
      name: path.basename(sourcePath),
      source: 'generation'
    });
  }

  function listAssets(userId, query) {
    return repository.listAssets(userId, query);
  }

  function getAsset(userId, id) {
    const asset = repository.getAsset(userId, String(id || '').trim());
    if (!asset) throw storageError(404, 'ASSET_NOT_FOUND', '资产不存在');
    return asset;
  }

  function updateAsset(userId, id, patch) {
    const asset = repository.updateAsset(userId, String(id || '').trim(), patch);
    if (!asset) throw storageError(404, 'ASSET_NOT_FOUND', '资产不存在');
    return asset;
  }

  function softDeleteAsset(userId, id) {
    // 软删除：只标记 deleted_at，不物理删除云对象（项目 JSON 仍可能引用 assetId）。
    const deleted = repository.softDeleteAsset(userId, String(id || '').trim());
    if (!deleted) throw storageError(404, 'ASSET_NOT_FOUND', '资产不存在');
  }

  async function createAccessUrl(userId, id) {
    const asset = getAsset(userId, id);
    const row = repository.getAssetByObjectId(asset.id);
    const url = await storage.createSignedReadUrl({ key: row.objectKey, expiresInSeconds: accessUrlTtlSeconds });
    return {
      url,
      expiresAt: new Date((Math.floor(Date.now() / 1000) + accessUrlTtlSeconds) * 1000).toISOString(),
      expiresInSeconds: accessUrlTtlSeconds
    };
  }

  async function readAssetContent({ assetId, expires, sig }) {
    verifyContentSignature(String(assetId || ''), expires, sig);
    const row = repository.getAssetByObjectId(String(assetId || ''));
    if (!row) throw storageError(404, 'ASSET_NOT_FOUND', '资产不存在或已删除');
    const { body, contentType } = await storage.readObject(row.objectKey);
    return { body, contentType: row.mimeType || contentType };
  }

  return {
    repository,
    storage,
    uploadAsset,
    importGeneration,
    storeGeneratedAsset,
    signAccessUrl,
    listAssets,
    getAsset,
    updateAsset,
    softDeleteAsset,
    createAccessUrl,
    readAssetContent
  };
}

module.exports = {
  createAssetService,
  DEFAULT_ACCESS_URL_TTL_SECONDS
};

'use strict';

// /api/user/assets* 与 /api/asset-content/:assetId 路由。
// server.js 只调用 registerAssetRoutes 挂载，不内联任何资产逻辑。

const multer = require('multer');
const { createAssetService, DEFAULT_ACCESS_URL_TTL_SECONDS } = require('./asset-service');
const { storageError } = require('./object-storage');
const { MEDIA_MAX_BYTES } = require('./magic-bytes');

function registerAssetRoutes(app, options = {}) {
  const auth = options.auth;
  if (typeof auth !== 'function') throw new TypeError('缺少 auth 中间件');
  const service = options.assetService || createAssetService(options);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MEDIA_MAX_BYTES, files: 1 }
  });

  function assetUpload(req, res, next) {
    upload.single('file')(req, res, (error) => {
      if (!error) return next();
      if (error && error.code === 'LIMIT_FILE_SIZE') {
        return next(storageError(413, 'ASSET_FILE_TOO_LARGE', '文件超过大小限制：图片 ≤20MB，视频/音频 ≤50MB'));
      }
      return next(error);
    });
  }

  const wrap = (handler) => async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };

  const withAccessUrl = async (userId, asset) => {
    const access = await service.createAccessUrl(userId, asset.id);
    return { ...asset, accessUrl: access.url };
  };

  app.get('/api/user/assets', auth, wrap(async (req, res) => {
    const { items, nextCursor } = service.listAssets(req.user.userId, {
      q: req.query.q,
      kind: req.query.kind,
      source: req.query.source,
      cursor: req.query.cursor,
      limit: req.query.limit
    });
    // 列表项附带 15 分钟短时效 accessUrl 供封面与插入展示；项目数据仍只保存 assetId。
    const itemsWithAccess = await Promise.all(items.map((asset) => withAccessUrl(req.user.userId, asset)));
    res.json({ success: true, items: itemsWithAccess, nextCursor });
  }));

  app.post('/api/user/assets/upload', auth, assetUpload, wrap(async (req, res) => {
    const asset = await service.uploadAsset({ userId: req.user.userId, file: req.file });
    res.json({ success: true, asset: await withAccessUrl(req.user.userId, asset) });
  }));

  app.post('/api/user/assets/import-generation', auth, wrap(async (req, res) => {
    const generationId = String(req.body?.generationId || req.body?.id || '').trim();
    if (!generationId) throw storageError(400, 'ASSET_GENERATION_ID_REQUIRED', '缺少生成记录 ID');
    const asset = await service.importGeneration({ userId: req.user.userId, generationId });
    res.json({ success: true, asset: await withAccessUrl(req.user.userId, asset) });
  }));

  app.get('/api/user/assets/:id', auth, wrap(async (req, res) => {
    const asset = service.getAsset(req.user.userId, req.params.id);
    res.json({ success: true, asset: await withAccessUrl(req.user.userId, asset) });
  }));

  app.get('/api/user/assets/:id/access-url', auth, wrap(async (req, res) => {
    const access = await service.createAccessUrl(req.user.userId, req.params.id);
    res.json({ success: true, ...access });
  }));

  app.put('/api/user/assets/:id', auth, wrap(async (req, res) => {
    const patch = {};
    if (req.body?.name !== undefined) patch.name = req.body.name;
    if (req.body?.tags !== undefined) patch.tags = req.body.tags;
    const asset = service.updateAsset(req.user.userId, req.params.id, patch);
    res.json({ success: true, asset: await withAccessUrl(req.user.userId, asset) });
  }));

  app.delete('/api/user/assets/:id', auth, wrap(async (req, res) => {
    service.softDeleteAsset(req.user.userId, req.params.id);
    res.json({ success: true, deleted: true, id: req.params.id });
  }));

  // 签名内容读取：无需登录态，HMAC 签名 + 过期时间即能力凭证；已软删除资产返回 404。
  app.get('/api/asset-content/:assetId', wrap(async (req, res) => {
    const { body, contentType } = await service.readAssetContent({
      assetId: req.params.assetId,
      expires: req.query.expires,
      sig: req.query.sig
    });
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'private, max-age=300');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(body);
  }));
}

module.exports = {
  registerAssetRoutes,
  DEFAULT_ACCESS_URL_TTL_SECONDS
};

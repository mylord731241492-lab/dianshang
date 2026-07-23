const MAX_EDGE = 1024;
const WEBP_QUALITY = 0.82;
const MAX_IDLE_ENTRIES = 24;
const IDLE_TTL_MS = 30_000;
const MAX_CONCURRENCY = 2;

const previewPool = new Map();
const previewQueue = [];
let activeBuilds = 0;
let poolGeneration = 0;

function directResult(source, extra = {}) {
  return { url: source, owned: false, direct: true, ...extra };
}

function compactSourceIdentity(source) {
  if (source.length <= 2048) return `url:${source}@${MAX_EDGE}`;
  const prefix = source.slice(0, 512);
  const suffix = source.slice(-512);
  return `source:${source.length}:${prefix}:${suffix}@${MAX_EDGE}`;
}

function previewIdentity(source, options = {}) {
  const stableAssetIdentity = options.assetHash || options.assetId;
  return stableAssetIdentity ? `${stableAssetIdentity}@${MAX_EDGE}` : compactSourceIdentity(source);
}

function shouldKeepOriginal(source, options = {}) {
  const mimeType = String(options.mimeType || '').slice(0, 64).toLowerCase();
  const prefix = String(source || '').slice(0, 96).toLowerCase();
  const suffix = String(source || '').slice(-16).split(/[?#]/)[0].toLowerCase();
  return mimeType === 'image/gif'
    || mimeType === 'image/svg+xml'
    || prefix.startsWith('data:image/gif')
    || prefix.startsWith('data:image/svg+xml')
    || suffix.endsWith('.gif')
    || suffix.endsWith('.svg');
}

function hasSmallKnownDimensions(options = {}) {
  const width = Number(options.width || 0);
  const height = Number(options.height || 0);
  return width > 0 && height > 0 && Math.max(width, height) <= MAX_EDGE;
}

function previewSize(width, height) {
  const sourceWidth = Number(width || 0);
  const sourceHeight = Number(height || 0);
  if (!sourceWidth || !sourceHeight || Math.max(sourceWidth, sourceHeight) <= MAX_EDGE) return null;
  const scale = MAX_EDGE / Math.max(sourceWidth, sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale))
  };
}

function decodedBitmap(bitmap) {
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    cleanup() {
      if (typeof bitmap.close === 'function') bitmap.close();
    }
  };
}

async function decodeBlob(blob, resizeTarget = null) {
  if (typeof createImageBitmap === 'function') {
    if (resizeTarget) {
      try {
        const bitmap = await createImageBitmap(blob, {
          resizeWidth: resizeTarget.width,
          resizeHeight: resizeTarget.height,
          resizeQuality: 'high'
        });
        return decodedBitmap(bitmap);
      } catch (_) {}
    }
    try {
      return decodedBitmap(await createImageBitmap(blob));
    } catch (_) {}
  }

  if (typeof Image !== 'function') throw new Error('当前环境无法解码图片预览');
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve({
      source: image,
      width: image.naturalWidth || image.width || 0,
      height: image.naturalHeight || image.height || 0,
      cleanup() {
        URL.revokeObjectURL(objectUrl);
      }
    });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片预览解码失败'));
    };
    image.src = objectUrl;
  });
}

function canvasToWebp(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY);
  });
}

async function buildPreview(source, options = {}) {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`图片预览读取失败：${response.status}`);
  const blob = await response.blob();
  if (shouldKeepOriginal(source, { ...options, mimeType: blob.type || options.mimeType })) {
    return directResult(source, { reason: 'animated-or-vector' });
  }

  const knownWidth = Number(options.width || 0);
  const knownHeight = Number(options.height || 0);
  const knownPreviewSize = previewSize(knownWidth, knownHeight);
  const decoded = await decodeBlob(blob, knownPreviewSize);
  let canvas = null;
  try {
    const sourceWidth = knownWidth || Number(decoded.width || 0);
    const sourceHeight = knownHeight || Number(decoded.height || 0);
    const target = knownPreviewSize || previewSize(sourceWidth, sourceHeight);
    if (!target) {
      return directResult(source, { width: sourceWidth, height: sourceHeight, reason: 'small-image' });
    }

    canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d');
    if (!context) return directResult(source, { reason: 'canvas-context-unavailable' });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(decoded.source, 0, 0, target.width, target.height);
    const previewBlob = await canvasToWebp(canvas);
    if (!previewBlob) return directResult(source, { reason: 'preview-encode-failed' });
    return {
      url: URL.createObjectURL(previewBlob),
      owned: true,
      direct: false,
      width: target.width,
      height: target.height,
      mimeType: previewBlob.type || 'image/webp',
      bytes: previewBlob.size || 0
    };
  } finally {
    decoded.cleanup();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

function drainQueue() {
  while (activeBuilds < MAX_CONCURRENCY && previewQueue.length) {
    const item = previewQueue.shift();
    if (item.generation !== poolGeneration) {
      item.resolve(directResult(item.fallback, { reason: 'pool-cleared' }));
      continue;
    }
    activeBuilds += 1;
    Promise.resolve()
      .then(item.run)
      .then(item.resolve, item.reject)
      .finally(() => {
        activeBuilds = Math.max(0, activeBuilds - 1);
        drainQueue();
      });
  }
}

function schedulePreview(run, fallback) {
  return new Promise((resolve, reject) => {
    previewQueue.push({ run, resolve, reject, fallback, generation: poolGeneration });
    drainQueue();
  });
}

function revokeResult(result) {
  if (result && result.owned && result.url && result.url.startsWith('blob:')) {
    URL.revokeObjectURL(result.url);
  }
}

function evictEntry(key, entry) {
  if (previewPool.get(key) !== entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  previewPool.delete(key);
  if (entry.result) revokeResult(entry.result);
  else if (entry.promise) entry.promise.then(revokeResult).catch(() => {});
}

function enforceIdleLimit() {
  const idleEntries = Array.from(previewPool.entries())
    .filter(([, entry]) => entry.refs === 0)
    .sort((left, right) => left[1].lastUsed - right[1].lastUsed);
  while (idleEntries.length > MAX_IDLE_ENTRIES) {
    const [key, entry] = idleEntries.shift();
    evictEntry(key, entry);
  }
}

export async function acquireCanvasImagePreview(source, options = {}) {
  if (typeof source !== 'string' || !source) return directResult('');
  if (hasSmallKnownDimensions(options) || shouldKeepOriginal(source, options)) {
    return directResult(source);
  }

  const key = previewIdentity(source, options);
  let entry = previewPool.get(key);
  if (entry) {
    entry.refs += 1;
    entry.lastUsed = Date.now();
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
  } else {
    entry = {
      refs: 1,
      lastUsed: Date.now(),
      timer: null,
      result: null,
      promise: null
    };
    previewPool.set(key, entry);
    entry.promise = schedulePreview(
      () => buildPreview(source, options).catch(() => directResult(source, { reason: 'preview-fallback' })),
      source
    ).then((result) => {
      if (previewPool.get(key) !== entry) {
        revokeResult(result);
        return directResult(source, { reason: 'stale-preview' });
      }
      entry.result = result;
      entry.promise = null;
      return result;
    });
  }

  const result = entry.result || await entry.promise;
  return { ...result, key, released: false };
}

export function releaseCanvasImagePreview(handle) {
  if (!handle || handle.released) return;
  handle.released = true;
  if (handle.key === undefined || handle.key === null) return;
  const entry = previewPool.get(handle.key);
  if (!entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
  entry.lastUsed = Date.now();
  if (entry.refs === 0) {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => evictEntry(handle.key, entry), IDLE_TTL_MS);
  }
  enforceIdleLimit();
}

export function clearCanvasImagePreviewPool() {
  poolGeneration += 1;
  while (previewQueue.length) {
    const item = previewQueue.shift();
    item.resolve(directResult(item.fallback, { reason: 'pool-cleared' }));
  }
  const entries = Array.from(previewPool.entries());
  previewPool.clear();
  entries.forEach(([, entry]) => {
    if (entry.timer) clearTimeout(entry.timer);
    if (entry.result) revokeResult(entry.result);
    else if (entry.promise) entry.promise.then(revokeResult).catch(() => {});
  });
}

export function getCanvasImagePreviewStats() {
  const entries = Array.from(previewPool.values());
  return {
    entryCount: entries.length,
    referenceCount: entries.reduce((sum, entry) => sum + entry.refs, 0),
    ownedEntryCount: entries.filter((entry) => entry.result && entry.result.owned).length,
    ownedBytes: entries.reduce((sum, entry) => sum + Number(entry.result?.bytes || 0), 0),
    idleEntryCount: entries.filter((entry) => entry.refs === 0).length,
    activeBuilds,
    queuedBuilds: previewQueue.length,
    maxEdge: MAX_EDGE,
    maxIdleEntries: MAX_IDLE_ENTRIES,
    idleTtlMs: IDLE_TTL_MS,
    maxConcurrency: MAX_CONCURRENCY
  };
}

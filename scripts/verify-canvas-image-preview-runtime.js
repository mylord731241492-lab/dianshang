const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

async function main() {
  const runtimePath = path.join(root, 'assets/canvas-image-preview-runtime.js');
  assert(fs.existsSync(runtimePath), '画布图片运行时预览模块尚未安装');

  const runtime = fs.readFileSync(runtimePath, 'utf8');
  const projects = read('assets/projects-BtxGnToV.js');
  const canvas = read('assets/Canvas-B8bY9_QL.js');
  const entry = read('assets/index-DglIsp_g.js');
  const html = read('index.html');

  assert(html.includes('index-DglIsp_g.js?v=20260723stablequeue1'), '首页入口未命中图片预览性能版本');
  assert(entry.includes('Canvas-B8bY9_QL.js?v=20260723stablequeue1'), '入口未命中图片预览性能版本');
  assert(canvas.includes('projects-BtxGnToV.js?v=20260715serverstore1'), 'Canvas 未命中项目图片预览版本');
  assert(canvas.includes('canvas-image-preview-runtime.js?v=20260714opperf4'), 'Canvas 未加载图片运行时预览模块');

  assert(projects.includes('Nt=Object.freeze({w1024:1024,w500:500,w200:200,w100:100})'), '本地素材未生成 w1024 预览');
  assert(projects.includes('resolveLocalAssetPreviewObjectUrl='), '本地素材预览解析器缺失');
  assert(projects.includes('resolveLocalAssetPreviewObjectUrl as I'), '本地素材预览解析器未导出');

  assert(runtime.includes('const MAX_EDGE = 1024;'), '运行时预览最长边不是 1024px');
  assert(runtime.includes('const MAX_IDLE_ENTRIES = 24;'), '运行时预览池上限不是 24');
  assert(runtime.includes('const IDLE_TTL_MS = 30_000;'), '运行时预览 TTL 不是 30 秒');
  assert(runtime.includes('const MAX_CONCURRENCY = 2;'), '运行时预览并发上限不是 2');
  assert(runtime.includes('compactSourceIdentity(source)'), 'Base64 预览缓存键仍会复制完整大字符串');
  assert(runtime.includes('source.slice(0, 512)') && runtime.includes('source.slice(-512)'), 'Base64 预览缓存键缺少有界头尾指纹');
  assert(runtime.includes('URL.revokeObjectURL'), '运行时预览没有 Object URL 释放逻辑');
  assert(runtime.includes('image/gif') && runtime.includes('image/svg+xml'), 'GIF/SVG 原图回退缺失');

  assert(canvas.includes('acquireCanvasImagePreview'), 'ImageNode 未接入运行时预览池');
  assert(canvas.includes('releaseCanvasImagePreview'), 'ImageNode 未释放运行时预览引用');
  assert(canvas.includes('clearCanvasImagePreviewPool'), '离开 Canvas 未清空运行时预览池');
  assert(canvas.includes('resolveLocalAssetPreviewObjectUrl'), 'ImageNode 未接入本地素材预览');
  assert(canvas.includes('He||originalImageSource.value||Re.value||""'), '本地素材不可读时未回退节点内原图');
  assert(canvas.includes('delete window.__hjmCanvasImagePreviewDebug'), '离开 Canvas 未移除图片预览调试对象');
  assert(!projects.includes('canvasDisplayPreviewUrl'), '运行态预览 URL 不应进入项目数据模块');

  const originalFetch = global.fetch;
  const originalCreateImageBitmap = global.createImageBitmap;
  const originalDocument = global.document;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const revoked = [];
  let objectUrlIndex = 0;
  let activeBuilds = 0;
  let maxActiveBuilds = 0;
  let maxRequestedResizeEdge = 0;

  global.fetch = async () => ({
    ok: true,
    blob: async () => new Blob(['source'], { type: 'image/png' })
  });
  global.createImageBitmap = async (_blob, options = {}) => {
    activeBuilds += 1;
    maxActiveBuilds = Math.max(maxActiveBuilds, activeBuilds);
    maxRequestedResizeEdge = Math.max(
      maxRequestedResizeEdge,
      Number(options.resizeWidth || 0),
      Number(options.resizeHeight || 0)
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    activeBuilds -= 1;
    return {
      width: Number(options.resizeWidth || 2528),
      height: Number(options.resizeHeight || 1696),
      close() {}
    };
  };
  global.document = {
    createElement(tag) {
      assert.strictEqual(tag, 'canvas');
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage() {}, imageSmoothingEnabled: false, imageSmoothingQuality: '' }),
        toBlob: (callback) => callback(new Blob(['preview'], { type: 'image/webp' }))
      };
    }
  };
  URL.createObjectURL = () => `blob:canvas-preview-${++objectUrlIndex}`;
  URL.revokeObjectURL = (url) => revoked.push(url);

  try {
    const source = Buffer.from(runtime).toString('base64');
    const module = await import(`data:text/javascript;base64,${source}`);

    const [first, duplicate] = await Promise.all([
      module.acquireCanvasImagePreview('data:image/png;base64,one', { width: 2528, height: 1696 }),
      module.acquireCanvasImagePreview('data:image/png;base64,one', { width: 2528, height: 1696 })
    ]);
    assert.strictEqual(first.url, duplicate.url, '同一图片没有复用运行时预览');
    assert.strictEqual(module.getCanvasImagePreviewStats().entryCount, 1, '同一图片创建了重复缓存项');
    assert.strictEqual(module.getCanvasImagePreviewStats().referenceCount, 2, '预览引用计数不正确');

    const handles = await Promise.all([
      module.acquireCanvasImagePreview('data:image/png;base64,two', { width: 2528, height: 1696 }),
      module.acquireCanvasImagePreview('data:image/png;base64,three', { width: 2528, height: 1696 }),
      module.acquireCanvasImagePreview('data:image/png;base64,four', { width: 2528, height: 1696 })
    ]);
    assert(maxActiveBuilds <= 2, `运行时预览并发超过限制：${maxActiveBuilds}`);
    assert(maxRequestedResizeEdge > 0 && maxRequestedResizeEdge <= 1024, `大图未按预览边界直接缩放解码：${maxRequestedResizeEdge}`);

    const small = await module.acquireCanvasImagePreview('data:image/png;base64,small', { width: 800, height: 600 });
    assert.strictEqual(small.url, 'data:image/png;base64,small', '小图不应生成运行时预览');
    const gif = await module.acquireCanvasImagePreview('data:image/gif;base64,gif', { width: 2528, height: 1696 });
    assert.strictEqual(gif.url, 'data:image/gif;base64,gif', 'GIF 不应被静态 WebP 替代');

    module.releaseCanvasImagePreview(first);
    module.releaseCanvasImagePreview(duplicate);
    handles.forEach(module.releaseCanvasImagePreview);
    module.clearCanvasImagePreviewPool();
    assert.strictEqual(module.getCanvasImagePreviewStats().entryCount, 0, '清理后预览池仍有缓存项');
    assert(revoked.length >= 4, '清理预览池时没有撤销全部 Object URL');
  } finally {
    global.fetch = originalFetch;
    global.createImageBitmap = originalCreateImageBitmap;
    global.document = originalDocument;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }

  console.log('Canvas image preview runtime assertions passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

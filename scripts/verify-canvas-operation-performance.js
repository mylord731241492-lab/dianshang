const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const html = read('index.html');
const entry = read('assets/index-DglIsp_g.js');
const canvas = read('assets/Canvas-B8bY9_QL.js');
const projects = read('assets/projects-BtxGnToV.js');

assert(html.includes('index-DglIsp_g.js?v=20260717reversecopy1'), '首页入口未命中新画布性能版本');
assert(entry.includes('Canvas-B8bY9_QL.js?v=20260717reversecopy1'), '入口未命中新画布性能版本');
assert(canvas.includes('projects-BtxGnToV.js?v=20260715serverstore1'), '画布未命中新项目存储版本');

assert(!canvas.includes('JSON.parse(JSON.stringify(Ge.value))'), '节点历史仍在序列化整份画布');
assert(!canvas.includes('JSON.parse(JSON.stringify($t.value))'), '连线历史仍在序列化整份画布');
assert(!canvas.includes('Ge.value=JSON.parse(JSON.stringify(e.nodes))'), '撤销恢复仍在序列化整份画布');
assert(canvas.includes('if(!h){Zo(!0),ln();return}'), '普通拖拽结束未走轻量布局保存');
assert(canvas.includes('So(),Zo(!0),ln(),setTimeout'), 'Alt 拖拽结束未走轻量布局保存');
assert(canvas.includes('Sa(e,o,{layoutOnly:t})'), '拖拽自动保存未传入布局模式');
assert(canvas.includes('Sa(e,n,{layoutOnly:!0})'), '视口自动保存未使用布局模式');
assert(!canvas.includes('n&&(Sa(e,n),dc(e,n))'), '视口变化仍会立即写整份工作流');
assert(projects.includes('At=(e=[])=>e.map(mt)'), '项目保存仍存在冗余 JSON 深拷贝');
assert(!projects.includes('At=(e=[])=>JSON.parse(JSON.stringify(e.map(mt)))'), '项目保存旧深拷贝仍存在');
assert(projects.includes('layoutPatchStorageKey="ai-canvas-layout-patches"'), '轻量布局补丁存储未安装');
assert(projects.includes('i.layoutOnly===!0?(saveLayoutPatch(e,a.canvasData),Promise.resolve(!0))'), '布局更新仍会写入完整 IndexedDB 项目');
assert(projects.includes('return applyLayoutPatch(e,(t==null?void 0:t.canvasData)||null)'), '项目恢复未合并布局补丁');
assert(projects.includes('Ea=e=>typeof e==="string"&&(e.startsWith("data:")||e.startsWith("blob:"))'), '内联图像判定未使用常数时间前缀检查');
assert(!projects.includes('String(e||"").trim();return/^data:image'), '内联图像判定仍会复制整个大字符串');
assert(projects.includes('internProjectImagePayloads='), '项目加载未安装图片大字符串引用去重');
assert(projects.includes('ke=e=>e.map(t=>internProjectImagePayloads({'), '项目恢复未在进入画布前执行图片引用去重');

const internStart = projects.indexOf('isInternableImagePayload=');
const internEnd = projects.indexOf(',ke=e=>', internStart);
assert(internStart >= 0 && internEnd > internStart, '无法定位图片引用去重实现');
const internSource = projects.slice(internStart, internEnd);
const internHelpers = Function(`
  "use strict";
  let isInternableImagePayload, internProjectImagePayloads;
  ${internSource};
  return { internProjectImagePayloads };
`)();
const sharedPayload = `data:image/png;base64,${'a'.repeat(10_000)}`;
const parsedInternFixture = JSON.parse(JSON.stringify({
  nodes: [{
    id: 'node_1',
    data: {
      url: sharedPayload,
      imageUrl: sharedPayload,
      originalUrl: sharedPayload,
      thumbUrl: sharedPayload,
      thumbnailUrl: sharedPayload,
      base64: sharedPayload
    }
  }, {
    id: 'node_2',
    data: {
      imageUrl: `data:image/png;base64,${'b'.repeat(10_000)}`
    }
  }]
}));
const internJsonBefore = JSON.stringify(parsedInternFixture);
const internedFixture = internHelpers.internProjectImagePayloads(parsedInternFixture);
const imageData = internedFixture.nodes[0].data;
assert.strictEqual(imageData.url, imageData.imageUrl, '相同图片别名未复用同一字符串引用');
assert.strictEqual(imageData.url, imageData.originalUrl, '原图别名未复用同一字符串引用');
assert.strictEqual(imageData.url, imageData.thumbUrl, '缩略图别名未复用同一字符串引用');
assert.strictEqual(imageData.url, imageData.thumbnailUrl, '缩略图字段未复用同一字符串引用');
assert.strictEqual(imageData.url, imageData.base64, 'Base64 字段未复用同一字符串引用');
assert.notStrictEqual(imageData.url, internedFixture.nodes[1].data.imageUrl, '不同图片被错误合并');
assert.strictEqual(JSON.stringify(internedFixture), internJsonBefore, '图片引用去重改变了项目 JSON 内容');

const layoutStart = projects.indexOf('readLayoutPatches=');
const layoutEnd = projects.indexOf(',At=(e=[])=>e.map(mt)', layoutStart);
assert(layoutStart >= 0 && layoutEnd > layoutStart, '无法定位轻量布局补丁实现');
const layoutSource = projects.slice(layoutStart, layoutEnd);
const memoryStorage = new Map();
const localStorageStub = {
  getItem(key) {
    return memoryStorage.has(key) ? memoryStorage.get(key) : null;
  },
  setItem(key, value) {
    memoryStorage.set(key, String(value));
  }
};
const layoutHelpers = Function('localStorage', 'T', `
  "use strict";
  const layoutPatchStorageKey = "ai-canvas-layout-patches";
  let readLayoutPatches, writeLayoutPatches, normalizeLayoutViewport;
  let saveLayoutPatch, clearLayoutPatch, applyLayoutPatch;
  ${layoutSource};
  return { saveLayoutPatch, clearLayoutPatch, applyLayoutPatch };
`)(localStorageStub, (value) => value);
const largeImageUrl = `data:image/png;base64,${'x'.repeat(5_000_000)}`;
const layoutFixture = {
  nodes: [{ id: 'node_1', position: { x: 88, y: -42 }, data: { imageUrl: largeImageUrl } }],
  viewport: { x: 10, y: 20, zoom: 0.4 }
};
layoutHelpers.saveLayoutPatch('project_1', layoutFixture);
const storedLayout = memoryStorage.get('ai-canvas-layout-patches');
assert(storedLayout.length < 500, '布局补丁意外携带了图像大数据');
assert(!storedLayout.includes('data:image'), '布局补丁泄漏内联图像');
const restoredLayout = layoutHelpers.applyLayoutPatch('project_1', {
  nodes: [{ id: 'node_1', position: { x: 0, y: 0 }, data: layoutFixture.nodes[0].data }],
  viewport: { x: 0, y: 0, zoom: 1 }
});
assert.deepStrictEqual(restoredLayout.nodes[0].position, { x: 88, y: -42 }, '节点位置补丁未恢复');
assert.deepStrictEqual(restoredLayout.viewport, { x: 10, y: 20, zoom: 0.4 }, '视口补丁未恢复');
assert.strictEqual(restoredLayout.nodes[0].data, layoutFixture.nodes[0].data, '布局恢复不应复制图像数据');
layoutHelpers.clearLayoutPatch('project_1');
assert.deepStrictEqual(JSON.parse(memoryStorage.get('ai-canvas-layout-patches')), {}, '删除项目后布局补丁未清理');

const cloneMarker = 'es=e=>{if(e==null)return e;';
const cloneStart = canvas.indexOf(cloneMarker);
const cloneEnd = canvas.indexOf(',zi=', cloneStart);
assert(cloneStart >= 0 && cloneEnd > cloneStart, '无法定位画布结构克隆函数');
const cloneSource = canvas.slice(cloneStart + 3, cloneEnd);
const clone = Function(`"use strict"; let es; es=(${cloneSource}); return es;`)();
const fixture = {
  nodes: [{
    id: 'node_1',
    position: { x: 10, y: 20 },
    data: {
      imageUrl: `data:image/png;base64,${'x'.repeat(10000)}`,
      values: [1, undefined, Number.NaN],
      ignored: undefined
    }
  }],
  createdAt: new Date('2026-07-14T00:00:00.000Z')
};
const cloned = clone(fixture);
const expected = JSON.parse(JSON.stringify(fixture));
assert.deepStrictEqual(cloned, expected, '结构克隆结果与原 JSON 快照不一致');
assert.notStrictEqual(cloned, fixture, '结构克隆未创建新根对象');
assert.notStrictEqual(cloned.nodes, fixture.nodes, '结构克隆未创建新节点数组');
assert.notStrictEqual(cloned.nodes[0].data, fixture.nodes[0].data, '结构克隆未隔离节点数据');

console.log('Canvas operation performance assertions passed.');

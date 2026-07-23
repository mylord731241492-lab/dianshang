'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const entryPath = path.join(root, 'assets', 'index-DglIsp_g.js');
const canvasPath = path.join(root, 'assets', 'Canvas-B8bY9_QL.js');
const indexPath = path.join(root, 'index.html');
const originalNeedle = 'k2=e=>ae(ie.post("/generate/tasks",e))';
const replacement = 'k2=e=>{const t=String(e.clientRequestId||globalThis.crypto?.randomUUID?.()||`canvas-${Date.now()}-${Math.random().toString(16).slice(2)}`);return ae(ie.post("/generate/tasks",{...e,clientRequestId:t},{headers:{"Idempotency-Key":t}}))}';

const entry = fs.readFileSync(entryPath, 'utf8');
let nextEntry = entry;
if (!nextEntry.includes(replacement)) {
  if (!nextEntry.includes(originalNeedle)) {
    throw new Error('未找到当前画布生图提交函数，拒绝写入未知资产');
  }
  nextEntry = nextEntry.replace(originalNeedle, replacement);
}
nextEntry = nextEntry.replace(
  /Canvas-B8bY9_QL\.js\?v=[A-Za-z0-9_-]+/g,
  'Canvas-B8bY9_QL.js?v=20260723stablequeue1'
);
if (!nextEntry.includes('Canvas-B8bY9_QL.js?v=20260723stablequeue1')) {
  throw new Error('未找到活动画布异步入口资源 query，拒绝写入未知入口资产');
}
fs.writeFileSync(entryPath, nextEntry, 'utf8');

const canvasReplacements = [
  [
    'C(A);try{const G=await Ag',
    'b(6,"准备请求","preparing",A);try{const G=await Ag'
  ],
  [
    'taskStatus==="pending"?"排队中":"等待返回结果"',
    'taskStatus==="pending"?"排队中":"上游生成中"'
  ],
  [
    'if(M.status==="failed")throw new Error',
    'if(["failed","cancelled"].includes(M.status))throw new Error'
  ],
  [
    'M.status==="pending"?"排队中":"生成任务处理中"',
    'M.status==="pending"?(M.queuePosition?`排队中（前方 ${Math.max(0,M.queuePosition-1)} 个）`:"排队中"):M.stage==="persisting"?"正在保存结果":M.stage==="connecting"?"正在连接上游":"上游生成中"'
  ]
];
let canvas = fs.readFileSync(canvasPath, 'utf8');
for (const [needle, next] of canvasReplacements) {
  if (canvas.includes(next)) continue;
  if (!canvas.includes(needle)) {
    throw new Error(`未找到当前画布任务状态片段，拒绝写入未知资产: ${needle}`);
  }
  canvas = canvas.replace(needle, next);
}
fs.writeFileSync(canvasPath, canvas, 'utf8');

const index = fs.readFileSync(indexPath, 'utf8');
const nextIndex = index.replace(
  /index-DglIsp_g\.js\?v=[A-Za-z0-9_-]+/,
  'index-DglIsp_g.js?v=20260723stablequeue1'
).replace(
  /Canvas-B8bY9_QL\.js\?v=[A-Za-z0-9_-]+/,
  'Canvas-B8bY9_QL.js?v=20260723stablequeue1'
);
if (nextIndex === index && !index.includes('index-DglIsp_g.js?v=20260723stablequeue1')) {
  throw new Error('未找到活动入口资源 query，拒绝写入未知 index.html');
}
fs.writeFileSync(indexPath, nextIndex, 'utf8');
console.log('Canvas generation idempotency patch applied.');

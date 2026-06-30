const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = {
  html: path.join(root, 'index.html'),
  perfJs: path.join(root, 'assets', 'canvas-performance-mode.js'),
  perfCss: path.join(root, 'assets', 'canvas-performance-mode.css'),
  canvasA: path.join(root, 'assets', 'Canvas-B8bY9_QL.js'),
  canvasB: path.join(root, 'assets', 'Canvas-yGc8b2gf.js'),
  entryA: path.join(root, 'assets', 'index-DglIsp_g.js'),
  entryB: path.join(root, 'assets', 'index-ZrBcanD1.js'),
  frameBudgetPs: path.join(root, 'scripts', 'smoke-canvas-frame-budget-ui.ps1'),
  frameBudgetRunner: path.join(root, 'scripts', 'smoke-canvas-frame-budget-ui-runner.js'),
  preflight: path.join(root, 'scripts', 'preflight-check.ps1')
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assertIncludes(label, text, needle) {
  if (!text.includes(needle)) {
    throw new Error(`${label} missing required performance anchor: ${needle}`);
  }
}

function assertNotIncludes(label, text, needle) {
  if (text.includes(needle)) {
    throw new Error(`${label} still contains stale performance anchor: ${needle}`);
  }
}

const html = read(files.html);
const perfJs = read(files.perfJs);
const perfCss = read(files.perfCss);
const entryA = read(files.entryA);
const entryB = read(files.entryB);
const frameBudgetPs = read(files.frameBudgetPs);
const frameBudgetRunner = read(files.frameBudgetRunner);
const preflight = read(files.preflight);
const canvasBundles = [
  ['Canvas-B8bY9_QL.js', read(files.canvasA)],
  ['Canvas-yGc8b2gf.js', read(files.canvasB)]
];

assertIncludes('index.html', html, 'canvas-performance-mode.js?v=20260629perf5');
assertIncludes('index.html', html, 'canvas-performance-mode.css?v=20260629perf5');
assertIncludes('index.html', html, 'index-DglIsp_g.js?v=20260630dialogagent1');
assertNotIncludes('index.html', html, 'index-DglIsp_g.js?v=20260629perf5');
assertIncludes('entryA', entryA, 'Canvas-B8bY9_QL.js?v=20260630dialogagent1');
assertIncludes('entryB', entryB, 'Canvas-yGc8b2gf.js?v=20260630dialogagent1');
assertNotIncludes('entryA', entryA, 'Canvas-B8bY9_QL.js?v=20260629outpaint1');
assertNotIncludes('entryB', entryB, 'Canvas-yGc8b2gf.js?v=20260629outpaint1');
assertNotIncludes('entryA', entryA, 'Canvas-B8bY9_QL.js?v=20260629outpaint2');
assertNotIncludes('entryB', entryB, 'Canvas-yGc8b2gf.js?v=20260629outpaint2');
assertNotIncludes('entryA', entryA, 'Canvas-B8bY9_QL.js?v=20260629outpaint3');
assertNotIncludes('entryB', entryB, 'Canvas-yGc8b2gf.js?v=20260629outpaint3');
assertNotIncludes('entryA', entryA, 'Canvas-B8bY9_QL.js?v=20260629outpaint4');
assertNotIncludes('entryB', entryB, 'Canvas-yGc8b2gf.js?v=20260629outpaint4');
assertNotIncludes('entryA', entryA, 'Canvas-B8bY9_QL.js?v=20260629outpaint5');
assertNotIncludes('entryB', entryB, 'Canvas-yGc8b2gf.js?v=20260629outpaint5');
assertNotIncludes('entryA', entryA, 'Canvas-B8bY9_QL.js?v=20260629outpaint6');
assertNotIncludes('entryB', entryB, 'Canvas-yGc8b2gf.js?v=20260629outpaint6');
assertNotIncludes('entryA', entryA, 'Canvas-B8bY9_QL.js?v=20260629perf5');
assertNotIncludes('entryB', entryB, 'Canvas-yGc8b2gf.js?v=20260629perf5');

assertIncludes('performance script', perfJs, 'function isActive()');
assertIncludes('performance script', perfJs, 'function noteSaveDeferred(reason)');
assertIncludes('performance script', perfJs, 'getDebugState: getDebugState');
assertIncludes('performance script', perfJs, 'canvas-performance-zooming');
assertIncludes('performance script', perfJs, 'canvas-performance-dragging');
assertIncludes('performance CSS', perfCss, 'html.canvas-performance-active .vue-flow__viewport');
assertIncludes('performance CSS', perfCss, 'will-change: transform');
assertIncludes('performance CSS', perfCss, 'backdrop-filter: none');
assertIncludes('performance CSS', perfCss, 'html.canvas-performance-dragging .canvas-chat-panel');
assertNotIncludes('performance CSS', perfCss, 'html.canvas-performance-active .vue-flow__node');
assertIncludes('performance CSS', perfCss, '.vue-flow__node:has(.image-node-toolbar)');
assertIncludes('performance CSS', perfCss, 'overflow: visible !important');
assertIncludes('performance CSS', perfCss, '.image-node-toolbar');
assertIncludes('frame budget smoke ps1', frameBudgetPs, 'smoke-canvas-frame-budget-ui-runner.js');
assertIncludes('frame budget smoke runner', frameBudgetRunner, 'codex-canvas-frame-budget-probe');
assertIncludes('frame budget smoke runner', frameBudgetRunner, 'longFramesOver100');
assertIncludes('preflight', preflight, 'canvas frame budget UI smoke');

for (const [name, bundle] of canvasBundles) {
  assertIncludes(name, bundle, 'const J4=1400');
  assertIncludes(name, bundle, '},800)},l3=');
  assertIncludes(name, bundle, 'noteSaveDeferred?.("auto");Zo();return');
  assertIncludes(name, bundle, 'noteSaveDeferred?.("viewport");l3();return');
  assertIncludes(name, bundle, 'R=()=>{Dt(()=>{P();const E=()=>{P(),setTimeout(P,80)}');
  assertIncludes(name, bundle, 'typeof requestAnimationFrame=="function"?requestAnimationFrame(E):setTimeout(E,0)');
  assertIncludes(name, bundle, 'maxHeight:"none",width:E<_?`min(100%, calc(56vh * ${E} / ${_}))`:"100%"');
  assertIncludes(name, bundle, 'O=(E,_,x)=>Math.min(Math.max(x,-_),E)');
  assertIncludes(name, bundle, 'S=E=>{const _=Number(E&&E.target?E.target.value:u.value)');
  assertIncludes(name, bundle, 'M={x:c.value.x+c.value.width/2,y:c.value.y+c.value.height/2}');
  assertIncludes(name, bundle, 'type:"range",min:"20",max:"300",step:"1",onInput:S');
  assertIncludes(name, bundle, 'class:"outpaint-stage",style:Qt(b.value),onPointerdown:xt(F,["prevent"]),onPointermove:D');
  assertIncludes(name, bundle, '/image-tools/reverse-prompt');
  assertIncludes(name, bundle, 'operation:"text_edit"');
  assertNotIncludes(name, bundle, 'const J4=900');
  assertNotIncludes(name, bundle, '},250)},l3=');
  assertNotIncludes(name, bundle, 'b=V(()=>({aspectRatio:`${p.value.w} / ${p.value.h}`}))');
  assertNotIncludes(name, bundle, 'S=()=>{const E=$(),_={x:c.value.x+c.value.width/2');
  assertNotIncludes(name, bundle, 'type:"range",min:"35",max:"100",step:"1",onInput:S');
  assertNotIncludes(name, bundle, 'type:"range",min:"20",max:"220",step:"1",onInput:S');
  assertNotIncludes(name, bundle, '_<=E?Math.min(Math.max(0,x),E-_):Math.min(Math.max(E-_,x),0)');
  assertNotIncludes(name, bundle, 'Math.min(Math.max(0,x),Math.max(0,_.width-c.value.width))');
  assertNotIncludes(name, bundle, '},Dt(P)},ne=E=>{a.value=E,Dt(P)}');
}

console.log(JSON.stringify({
  ok: true,
  checked: Object.keys(files),
  version: '20260629perf5+dialogagent1',
  saveDeferral: true
}, null, 2));

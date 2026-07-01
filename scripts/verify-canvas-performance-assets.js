const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = {
  html: path.join(root, 'index.html'),
  perfJs: path.join(root, 'assets', 'canvas-performance-mode.js'),
  perfCss: path.join(root, 'assets', 'canvas-performance-mode.css'),
  imagePolishJs: path.join(root, 'assets', 'canvas-image-node-polish.js'),
  imagePolishCss: path.join(root, 'assets', 'canvas-image-node-polish.css'),
  nodeRadiusCss: path.join(root, 'assets', 'canvas-node-radius-fix.css'),
  canvasA: path.join(root, 'assets', 'Canvas-B8bY9_QL.js'),
  canvasB: path.join(root, 'assets', 'Canvas-yGc8b2gf.js'),
  promptFlowJs: path.join(root, 'assets', 'canvas-chat-prompt-flow.js'),
  promptFlowCss: path.join(root, 'assets', 'canvas-chat-prompt-flow.css'),
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
const imagePolishJs = read(files.imagePolishJs);
const imagePolishCss = read(files.imagePolishCss);
const nodeRadiusCss = read(files.nodeRadiusCss);
const entryA = read(files.entryA);
const entryB = read(files.entryB);
const promptFlowJs = read(files.promptFlowJs);
const promptFlowCss = read(files.promptFlowCss);
const frameBudgetPs = read(files.frameBudgetPs);
const frameBudgetRunner = read(files.frameBudgetRunner);
const preflight = read(files.preflight);
const canvasBundles = [
  ['Canvas-B8bY9_QL.js', read(files.canvasA)],
  ['Canvas-yGc8b2gf.js', read(files.canvasB)]
];

assertIncludes('index.html', html, 'canvas-performance-mode.js?v=20260629perf5');
assertIncludes('index.html', html, 'canvas-performance-mode.css?v=20260629perf5');
assertIncludes('index.html', html, 'canvas-image-node-polish.js?v=20260701image10');
assertIncludes('index.html', html, 'canvas-image-node-polish.css?v=20260701image10');
assertIncludes('index.html', html, 'canvas-node-radius-fix.css?v=20260701title1');
assertIncludes('index.html', html, 'canvas-chat-prompt-flow.js?v=20260701suite17');
assertIncludes('index.html', html, 'canvas-chat-prompt-flow.css?v=20260701suite17');
assertIncludes('index.html', html, 'index-DglIsp_g.js?v=20260630dialogagent12');
assertNotIncludes('index.html', html, 'canvas-ecommerce-suite-agent.js');
assertNotIncludes('index.html', html, 'canvas-ecommerce-suite-agent.css');
assertNotIncludes('index.html', html, 'index-DglIsp_g.js?v=20260629perf5');
assertIncludes('entryA', entryA, 'Canvas-B8bY9_QL.js?v=20260630dialogagent9');
assertIncludes('entryB', entryB, 'Canvas-yGc8b2gf.js?v=20260630dialogagent9');
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
assertIncludes('image node polish script', imagePolishJs, 'window.__hjmCanvasImageNodePolish');
assertIncludes('image node polish script', imagePolishJs, 'function lockNodeTitleRename');
assertIncludes('image node polish script', imagePolishJs, 'data-hjm-node-title-lock');
assertIncludes('image node polish script', imagePolishJs, 'event.stopImmediatePropagation');
assertIncludes('image node polish CSS', imagePolishCss, '.vue-flow__node-image:not(.image-node-has-image) .image-node:not(:has(img)) > .flex.h-8');
assertIncludes('image node polish CSS', imagePolishCss, 'display: none !important');
assertIncludes('image node polish CSS', imagePolishCss, '.vue-flow__node-image .image-node:has(img) > .relative.flex.h-12');
assertIncludes('image node polish CSS', imagePolishCss, 'min-height: 230px !important');
assertIncludes('canvas node radius CSS', nodeRadiusCss, '.vue-flow__node [data-hjm-node-title-lock="true"]');
assertIncludes('canvas node radius CSS', nodeRadiusCss, 'pointer-events: none !important');
assertIncludes('canvas node radius CSS', nodeRadiusCss, 'user-select: none !important');
assertIncludes('frame budget smoke ps1', frameBudgetPs, 'smoke-canvas-frame-budget-ui-runner.js');
assertIncludes('frame budget smoke runner', frameBudgetRunner, 'codex-canvas-frame-budget-probe');
assertIncludes('frame budget smoke runner', frameBudgetRunner, 'longFramesOver100');
assertIncludes('preflight', preflight, 'canvas frame budget UI smoke');
assertIncludes('prompt flow script', promptFlowJs, "FLOW_VERSION = '20260701suite17'");
assertIncludes('prompt flow script', promptFlowJs, 'var SUITE_MAX_REFERENCE_IMAGES = 4');
assertIncludes('prompt flow script', promptFlowJs, "var CANVAS_CHAT_SCOPE_ATTR = 'data-v-b10121f4'");
assertIncludes('prompt flow script', promptFlowJs, 'function syncPromptFlowCardVisibility(panel)');
assertIncludes('prompt flow script', promptFlowJs, "function isSuiteMode(panel)");
assertIncludes('prompt flow script', promptFlowJs, "return !!panel && getActiveMode(panel) === '对话'");
assertIncludes('prompt flow script', promptFlowJs, "return !!panel && (mode === '视频' || mode === '电商套图Agent')");
assertIncludes('prompt flow script', promptFlowJs, "panel.classList.toggle('hjm-prompt-flow-dialog-active', dialogActive)");
assertIncludes('prompt flow script', promptFlowJs, "panel.classList.toggle('hjm-prompt-flow-suite-active', suiteActive)");
assertIncludes('prompt flow script', promptFlowJs, ".hjm-prompt-flow-card, .hjm-prompt-flow-user, .hjm-prompt-flow-agent");
assertIncludes('prompt flow script', promptFlowJs, "var mode = card.getAttribute('data-hjm-prompt-flow-mode') || 'chat'");
assertIncludes('prompt flow script', promptFlowJs, "var visible = (dialogActive && mode === 'chat') || (suiteActive && mode === 'suite')");
assertIncludes('prompt flow script', promptFlowJs, "card.style.display = visible ? '' : 'none'");
assertIncludes('prompt flow script', promptFlowJs, "var emptyState = panel.querySelector('.message-list > .empty-state')");
assertIncludes('prompt flow script', promptFlowJs, 'emptyState.hidden = hideEmpty');
assertIncludes('prompt flow script', promptFlowJs, 'hjm-prompt-flow-card hjm-prompt-flow-user');
assertIncludes('prompt flow script', promptFlowJs, 'hjm-prompt-flow-card hjm-prompt-flow-agent');
assertIncludes('prompt flow script', promptFlowJs, "class=\"message-meta hjm-prompt-flow-head\"");
assertIncludes('prompt flow script', promptFlowJs, "class=\"image-grid hjm-prompt-flow-result-grid\"");
assertIncludes('prompt flow script', promptFlowJs, "hjm-suite-composer");
assertIncludes('prompt flow script', promptFlowJs, "hjm-suite-asset-plus");
assertIncludes('prompt flow script', promptFlowJs, "hjm-suite-reference-list");
assertIncludes('prompt flow script', promptFlowJs, "hjm-suite-upload' + (preview ? ' has-image' : '')");
assertIncludes('prompt flow script', promptFlowJs, "hjm-suite-skill-current");
assertIncludes('prompt flow script', promptFlowJs, "hjm-suite-skill-menu");
assertIncludes('prompt flow script', promptFlowJs, "data-hjm-suite-skill-option");
assertIncludes('prompt flow script', promptFlowJs, "/assets/ecommerce-suite-skills/gloria-avatar.svg");
assertIncludes('prompt flow script', promptFlowJs, "card.dataset.hjmPromptFlowMode = 'suite'");
assertIncludes('prompt flow script', promptFlowJs, "/api/canvas/ecommerce-suite/prompts");
assertIncludes('prompt flow script', promptFlowJs, "/api/canvas/ecommerce-suite/generate");
assertIncludes('prompt flow script', promptFlowJs, "textModelKey: defaults.textModelKey || 'gpt-5.5'");
assertIncludes('prompt flow script', promptFlowJs, "imageModelKey: defaults.imageModelKey || 'gpt-image-2'");
assertIncludes('prompt flow script', promptFlowJs, "sectionMode: data.sectionMode || 'dynamic'");
assertNotIncludes('prompt flow script', promptFlowJs, "sectionKeys: suiteSectionKeys()");
assertIncludes('prompt flow script', promptFlowJs, 'class="hjm-suite-plan-check"');
assertIncludes('prompt flow script', promptFlowJs, 'class="hjm-suite-plan-name"');
assertIncludes('prompt flow script', promptFlowJs, '已同时发出 \' + plans.length + \' 个独立生图任务');
assertIncludes('prompt flow script', promptFlowJs, 'var taskPromises = plans.map(function (plan, index)');
assertIncludes('prompt flow script', promptFlowJs, 'await Promise.all(taskPromises)');
assertIncludes('prompt flow script', promptFlowJs, 'promptPlans: [plan]');
assertIncludes('prompt flow script', promptFlowJs, 'function suiteErrorInfo');
assertIncludes('prompt flow script', promptFlowJs, '上游图生图请求失败');
assertIncludes('prompt flow script', promptFlowJs, 'class="hjm-suite-error-id"');
assertIncludes('prompt flow script', promptFlowJs, 'class="hjm-suite-action-overlay"');
assertIncludes('prompt flow script', promptFlowJs, "suiteResultCard.classList.toggle('is-action-open', !wasOpen)");
assertIncludes('prompt flow script', promptFlowJs, "data-hjm-prompt-flow-action=\"retry-suite-plan\"");
assertIncludes('prompt flow script', promptFlowJs, 'function autoAddSuiteImage');
assertIncludes('prompt flow script', promptFlowJs, 'autoAddSuiteImage(image, run)');
assertNotIncludes('prompt flow script', promptFlowJs, 'promptPlans: plans');
assertNotIncludes('prompt flow script', promptFlowJs, '准备按顺序生成');
assertNotIncludes('prompt flow script', promptFlowJs, 'for (var index = 0; index < plans.length; index += 1)');
assertNotIncludes('prompt flow script', promptFlowJs, '套图模板');
assertNotIncludes('prompt flow script', promptFlowJs, 'hjm-suite-template-head');
assertNotIncludes('prompt flow script', promptFlowJs, 'data-suite-plan-prompt');
assertNotIncludes('prompt flow script', promptFlowJs, 'data-suite-plan-negative');
assertNotIncludes('prompt flow script', promptFlowJs, 'hjm-suite-plan-heading');
assertIncludes('prompt flow script', promptFlowJs, "if (shouldHandle(panel))");
assertIncludes('prompt flow script', promptFlowJs, "if (isSuiteMode(panel))");
assertIncludes('prompt flow script', promptFlowJs, 'class="hjm-prompt-flow-progress" role="progressbar"');
assertIncludes('prompt flow script', promptFlowJs, "progressBar.style.width = nextProgress + '%'");
assertIncludes('prompt flow script', promptFlowJs, "class=\"cost-line hjm-prompt-flow-cost\"");
assertIncludes('prompt flow script', promptFlowJs, 'applyCanvasChatScope(grid, getPanel())');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel:not(.hjm-prompt-flow-dialog-active) [data-hjm-prompt-flow-mode="chat"]');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel:not(.hjm-prompt-flow-suite-active) [data-hjm-prompt-flow-mode="suite"]');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel.hjm-prompt-flow-suite-active .hjm-suite-composer');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel.hjm-prompt-flow-suite-active .hjm-suite-reference-list');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel.hjm-prompt-flow-suite-active .hjm-suite-asset-plus');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel.hjm-prompt-flow-suite-active .hjm-suite-upload.has-image');
assertIncludes('prompt flow CSS', promptFlowCss, 'color-scheme: light');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel.hjm-prompt-flow-suite-active .hjm-suite-skill-current');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel.hjm-prompt-flow-suite-active .hjm-suite-skill-menu');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel.hjm-prompt-flow-suite-active .hjm-suite-skill-option.is-selected');
assertNotIncludes('prompt flow CSS', promptFlowCss, '.hjm-suite-skill-select select');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel .hjm-suite-plan');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel .hjm-suite-plan-check');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel .hjm-suite-plan-name');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel .hjm-suite-agent .hjm-suite-result-card');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel .hjm-suite-agent .hjm-suite-result-card.is-failed .hjm-suite-error-id');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel .hjm-suite-agent .hjm-suite-result-card.is-success:hover figcaption');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel .hjm-suite-agent .hjm-suite-result-card.is-success.is-action-open figcaption');
assertIncludes('prompt flow CSS', promptFlowCss, 'background: rgba(255, 255, 255, 0.82)');
assertIncludes('prompt flow CSS', promptFlowCss, '@keyframes hjm-suite-spin');
assertNotIncludes('prompt flow CSS', promptFlowCss, 'background: rgba(31, 31, 31, 0.72)');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel.hjm-prompt-flow-suite-active .composer .config-row .model-control');
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel .hjm-prompt-flow-progress');
assertIncludes('prompt flow CSS', promptFlowCss, '@keyframes hjm-prompt-flow-progress-sheen');
assertIncludes('prompt flow CSS', promptFlowCss, 'display: none !important');
assertNotIncludes('prompt flow script', promptFlowJs, 'hjm-prompt-flow-settings-line');
assertNotIncludes('prompt flow CSS', promptFlowCss, '.hjm-prompt-flow-result-grid figure');
assertNotIncludes('prompt flow CSS', promptFlowCss, '.hjm-prompt-flow-images figure');

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
  assertIncludes(name, bundle, 'chatModeSessionStore');
  assertIncludes(name, bundle, 'saveCurrentChatModeSession(se||l.value),loadChatModeSession(y)');
  assertIncludes(name, bundle, 'appendChatModeMessage(y.mode');
  assertIncludes(name, bundle, 'chatMessageModeById');
  assertIncludes(name, bundle, 've=>{u.value=ve,saveCurrentChatModeSession(l.value)}');
  assertIncludes(name, bundle, 'y.source==="canvas-chat"?c.value=[]');
  assertNotIncludes(name, bundle, 'const J4=900');
  assertNotIncludes(name, bundle, '},250)},l3=');
  assertNotIncludes(name, bundle, 'Ze(l,y=>{Se(),o("mode-change",y),Qe()})');
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
  version: '20260629perf5+20260701image10+20260701title1+dialogagent12+canvasdialogagent9+suite17',
  saveDeferral: true
}, null, 2));

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
  canvasCss: path.join(root, 'assets', 'Canvas-D1auYH9L.css'),
  canvasA: path.join(root, 'assets', 'Canvas-B8bY9_QL.js'),
  canvasB: path.join(root, 'assets', 'Canvas-yGc8b2gf.js'),
  promptFlowJs: path.join(root, 'assets', 'canvas-chat-prompt-flow.js'),
  promptFlowCss: path.join(root, 'assets', 'canvas-chat-prompt-flow.css'),
  entryA: path.join(root, 'assets', 'index-DglIsp_g.js'),
  entryB: path.join(root, 'assets', 'index-ZrBcanD1.js'),
  server: path.join(root, 'server.js'),
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
const canvasCss = read(files.canvasCss);
const entryA = read(files.entryA);
const entryB = read(files.entryB);
const server = read(files.server);
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
assertIncludes('index.html', html, 'canvas-image-node-polish.js?v=20260703mask1');
assertIncludes('index.html', html, 'canvas-image-node-polish.css?v=20260703mask1');
assertIncludes('index.html', html, 'canvas-node-radius-fix.css?v=20260701title1');
assertIncludes('index.html', html, 'canvas-chat-prompt-flow.js?v=20260701suite20');
assertIncludes('index.html', html, 'canvas-chat-prompt-flow.css?v=20260701suite20');
assertIncludes('index.html', html, 'index-DglIsp_g.js?v=20260703freegen1');
assertNotIncludes('index.html', html, 'canvas-ecommerce-suite-agent.js');
assertNotIncludes('index.html', html, 'canvas-ecommerce-suite-agent.css');
assertNotIncludes('index.html', html, 'index-DglIsp_g.js?v=20260629perf5');
assertNotIncludes('index.html', html, 'canvas-image-node-polish.js?v=20260701image10');
assertNotIncludes('index.html', html, 'canvas-image-node-polish.css?v=20260702fulltext1');
assertNotIncludes('index.html', html, 'index-DglIsp_g.js?v=20260702toolbar1');
assertIncludes('entryA', entryA, 'Canvas-B8bY9_QL.js?v=20260703freegen1');
assertIncludes('entryB', entryB, 'Canvas-yGc8b2gf.js?v=20260703freegen1');
assertNotIncludes('entryA', entryA, 'Canvas-B8bY9_QL.js?v=20260703mask1');
assertNotIncludes('entryB', entryB, 'Canvas-yGc8b2gf.js?v=20260703mask1');
assertNotIncludes('entryA', entryA, 'Canvas-B8bY9_QL.js?v=20260702toolbar1');
assertNotIncludes('entryB', entryB, 'Canvas-yGc8b2gf.js?v=20260702toolbar1');
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

assertIncludes('server.js', server, 'options.body?.maskAlphaBase64 || options.body?.maskBase64');
assertIncludes('server.js', server, 'firstString(req.body.maskAlphaBase64, req.body.maskBase64');
assertIncludes('server.js', server, '只重绘 mask 透明或白色标记区域');
assertIncludes('server.js', server, '未涂抹区域内的文字、品牌标识、瓶身标签');
assertIncludes('server.js', server, '你是一名专业电商设计师');
assertIncludes('server.js', server, '保持产品比例自然，不要拉伸或变形');
assertIncludes('server.js', server, '文字清晰，不要出现光斑和乱码');
assertNotIncludes('server.js', server, '请优先理解用户需求，自由完成画面创作');
assertNotIncludes('server.js', server, '适合电商展示');
assertNotIncludes('server.js', server, '本次有参考图：请把参考图作为生成依据，具体改动以用户需求为准');
assertNotIncludes('server.js', server, 'function ecommercePlatformPromptHint');
assertNotIncludes('server.js', server, '用户提到拼多多/PDD');
assertNotIncludes('server.js', server, '视觉执行要求：成图必须能一眼看出已经执行用户需求');
assertNotIncludes('server.js', server, '如果只是把参考图产品原样放大或轻微调色，视为失败');
assertIncludes('server.js', server, 'const IMAGE_PROVIDER_REQUEST_DELAY_MS');
assertIncludes('server.js', server, 'let providerImageRequestQueue = Promise.resolve()');
assertIncludes('server.js', server, 'async function runQueuedProviderImageBatch');
assertIncludes('server.js', server, 'await runQueuedProviderImageBatch(count, async');
assertIncludes('server.js', server, "queueMode: 'serial-delayed'");
assertNotIncludes('server.js', server, 'await Promise.all(Array.from({ length: count }, async');

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
assertIncludes('image node polish script', imagePolishJs, 'function enhanceImageToolPanels');
assertIncludes('image node polish script', imagePolishJs, "data-hjm-panel-window");
assertIncludes('image node polish script', imagePolishJs, 'function startPanelResize');
assertIncludes('image node polish CSS', imagePolishCss, '.vue-flow__node-image:not(.image-node-has-image) .image-node:not(:has(img)) > .flex.h-8');
assertIncludes('image node polish CSS', imagePolishCss, 'display: none !important');
assertIncludes('image node polish CSS', imagePolishCss, '.vue-flow__node-image .image-node:has(img) > .relative.flex.h-12');
assertIncludes('image node polish CSS', imagePolishCss, 'min-height: 230px !important');
assertIncludes('image node polish CSS', imagePolishCss, 'bottom: calc(100% + 16px) !important');
assertIncludes('image node polish CSS', imagePolishCss, '.image-edit-overlay:has(.convert-panel)');
assertIncludes('image node polish CSS', imagePolishCss, 'left: calc(100% + 16px) !important');
assertIncludes('image node polish CSS', imagePolishCss, 'flex-wrap: nowrap !important');
assertIncludes('image node polish CSS', imagePolishCss, 'transform: translateX(-50%) translateY(0) !important');
assertIncludes('image node polish CSS', imagePolishCss, 'text-overflow: clip !important');
assertIncludes('image node polish CSS', imagePolishCss, '.image-edit-overlay[data-hjm-panel-window="true"]');
assertIncludes('image node polish CSS', imagePolishCss, '.hjm-overlay-resize-handle');
assertIncludes('image node polish CSS', imagePolishCss, 'html.hjm-image-tool-window-resizing');
assertIncludes('canvas node radius CSS', nodeRadiusCss, '.vue-flow__node [data-hjm-node-title-lock="true"]');
assertIncludes('canvas node radius CSS', nodeRadiusCss, 'pointer-events: none !important');
assertIncludes('canvas node radius CSS', nodeRadiusCss, 'user-select: none !important');
assertIncludes('frame budget smoke ps1', frameBudgetPs, 'smoke-canvas-frame-budget-ui-runner.js');
assertIncludes('frame budget smoke runner', frameBudgetRunner, 'codex-canvas-frame-budget-probe');
assertIncludes('frame budget smoke runner', frameBudgetRunner, 'longFramesOver100');
assertIncludes('preflight', preflight, 'canvas frame budget UI smoke');
assertIncludes('prompt flow script', promptFlowJs, "FLOW_VERSION = '20260701suite20'");
assertIncludes('prompt flow script', promptFlowJs, 'var SUITE_MAX_REFERENCE_IMAGES = 4');
assertIncludes('prompt flow script', promptFlowJs, "var CANVAS_CHAT_SCOPE_ATTR = 'data-v-b10121f4'");
assertIncludes('prompt flow script', promptFlowJs, "var CANVAS_CHAT_PLACEHOLDER = '请输出你的提示词'");
assertIncludes('prompt flow script', promptFlowJs, "var SUITE_TAB_LABEL = 'agent电商套图'");
assertIncludes('prompt flow script', promptFlowJs, "var SUITE_MODE_ALIASES = ['视频', '电商套图Agent', SUITE_TAB_LABEL]");
assertIncludes('prompt flow script', promptFlowJs, 'function syncSuiteTabLabel(panel)');
assertIncludes('prompt flow script', promptFlowJs, "tab.setAttribute('data-hjm-suite-tab-label', SUITE_TAB_LABEL)");
assertIncludes('prompt flow script', promptFlowJs, 'function syncComposerPlaceholder(panel)');
assertIncludes('prompt flow script', promptFlowJs, 'field.placeholder = CANVAS_CHAT_PLACEHOLDER');
assertIncludes('prompt flow script', promptFlowJs, "field.setAttribute('data-placeholder', CANVAS_CHAT_PLACEHOLDER)");
assertIncludes('prompt flow script', promptFlowJs, 'function syncPromptFlowCardVisibility(panel)');
assertIncludes('prompt flow script', promptFlowJs, "function isSuiteMode(panel)");
assertIncludes('prompt flow script', promptFlowJs, "return !!panel && getActiveMode(panel) === '对话'");
assertIncludes('prompt flow script', promptFlowJs, "return !!panel && isSuiteModeName(mode)");
assertNotIncludes('prompt flow script', promptFlowJs, "return !!panel && (mode === '视频' || mode === '电商套图Agent')");
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
assertIncludes('prompt flow CSS', promptFlowCss, '.canvas-chat-panel .message-list > .empty-state');
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

assertIncludes('canvas chunk CSS', canvasCss, '.vue-flow__edge-path,.vue-flow__connection-path{stroke:#3b82f6;stroke-width:2;fill:none}');
assertIncludes('canvas chunk CSS', canvasCss, '.vue-flow__edge.selected .vue-flow__edge-path,.vue-flow__edge:focus .vue-flow__edge-path,.vue-flow__edge:focus-visible .vue-flow__edge-path{stroke:#2563eb}');
assertIncludes('canvas chunk CSS', canvasCss, '.vue-flow__connection-path{stroke:#3b82f6!important;stroke-width:2!important;filter:drop-shadow(0 0 5px rgba(59,130,246,.35))}');
assertNotIncludes('canvas chunk CSS', canvasCss, '.vue-flow__edge-path,.vue-flow__connection-path{stroke:#b1b1b7;stroke-width:1;fill:none}');
assertNotIncludes('canvas chunk CSS', canvasCss, '.vue-flow__edge.selected .vue-flow__edge-path,.vue-flow__edge:focus .vue-flow__edge-path,.vue-flow__edge:focus-visible .vue-flow__edge-path{stroke:#555}');

for (const [name, bundle] of canvasBundles) {
  assertIncludes(name, bundle, 'const J4=1400');
  assertIncludes(name, bundle, 'jl={type:"default",animated:!1,style:{stroke:"#3b82f6",strokeWidth:2}}');
  assertIncludes(name, bundle, 'const t=["imageRole","promptOrder","imageOrder","imageReference"].includes(e.type)?e.type:jl.type;return{...jl,...e');
  assertIncludes(name, bundle, 'style:{...jl.style,...e.style||{},stroke:"#3b82f6",strokeWidth:2}');
  assertIncludes(name, bundle, '$t.value=(r.edges||[]).map(Sg)');
  assertIncludes(name, bundle, 'style:{...m.style||{},stroke:"#3b82f6",strokeWidth:2}');
  assertIncludes(name, bundle, 'stroke:"#3b82f6",strokeWidth:((i=t.style)==null?void 0:i.strokeWidth)||2');
  assertIncludes(name, bundle, 'stroke:"#3b82f6",strokeWidth:((p=n.style)==null?void 0:p.strokeWidth)||2');
  assertIncludes(name, bundle, 'stroke:"#3b82f6",strokeWidth:((g=n.style)==null?void 0:g.strokeWidth)||2');
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
  assertIncludes(name, bundle, 'ce.width/me.width');
  assertIncludes(name, bundle, 'x:(ie.clientX-me.left)*Te');
  assertIncludes(name, bundle, 'maskAlphaBase64:be()');
  assertIncludes(name, bundle, 'maskAlphaBase64:String(z.maskAlphaBase64||"").trim()');
  assertIncludes(name, bundle, 'T.data[X+3]=Ye?0:255');
  assertIncludes(name, bundle, 'key:"inpaint",label:"局部修改",shortLabel:"改",panel:"inpaint",operation:"inpaint",phase:"ready"');
  assertIncludes(name, bundle, 'z.connect!==!1&&sn({source:I(e),target:j');
  assertIncludes(name, bundle, 'connect:!1,allowEmptyUrl:!0');
  assertIncludes(name, bundle, 'progress:18,progressLabel:"已提交请求"');
  assertIncludes(name, bundle, 'imageNodeId:j,status:"submitted"');
  assertIncludes(name, bundle, 'c(j,{url:oe,imageUrl:oe,originalUrl:oe');
  assertIncludes(name, bundle, 'disabled:!Ce.value,onClick:fe');
  assertIncludes(name, bundle, "onDblclick:xt(ut=>{var Rt;return(Rt=ut.currentTarget.querySelector('input[type=file]'))==null?void 0:Rt.click()},[\"stop\"])");
  assertIncludes(name, bundle, 'f("input",{type:"file",accept:"image/*",class:"hidden",onChange:y},null,32)');
  assertNotIncludes(name, bundle, 'disabled:I(r)||!Ce.value');
  assertNotIncludes(name, bundle, 'f("input",{type:"file",accept:"image/*",class:"absolute inset-0 opacity-0 cursor-pointer",onChange:y},null,32)');
  assertNotIncludes(name, bundle, 'if(r.value)return;const{prompt:de,refImages:Ie}');
  assertNotIncludes(name, bundle, 'I(r)?(U(),yt(I(Mo),{key:0,size:15,stroke:"#ffffff"}))');
  assertNotIncludes(name, bundle, 'key:"smartErase",label:"AI 智能消除"');
  assertNotIncludes(name, bundle, 'key:"inpaint",label:"局部修改",shortLabel:"改",panel:"inpaint",operation:"inpaint",phase:"next"');
  assertNotIncludes(name, bundle, 'k=await MN(N),H=k.imageUrl||k.url||E,R=Va(r.value);return u({imageUrl:H');
  assertIncludes(name, bundle, '/image-tools/reverse-prompt');
  assertNotIncludes(name, bundle, 'operation:"text_edit"');
  assertNotIncludes(name, bundle, 'key:"video",label:"生成视频",shortLabel:"视",action:"video"');
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
  assertNotIncludes(name, bundle, 'jl={type:"smoothstep",animated:!1,style:{strokeWidth:1.5}}');
  assertNotIncludes(name, bundle, 'stroke:"#cfd6e2"');
  assertNotIncludes(name, bundle, 'type:"smoothstep"');
}

console.log(JSON.stringify({
  ok: true,
  checked: Object.keys(files),
  version: '20260629perf5+20260703mask1+20260703freegen1+20260701title1+suite20',
  saveDeferral: true
}, null, 2));

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const serverPath = path.join(repoRoot, 'server.js');
const source = fs.readFileSync(serverPath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sliceFrom(anchor, nextAnchor) {
  const start = source.indexOf(anchor);
  assert(start >= 0, `Missing anchor: ${anchor}`);
  const end = nextAnchor ? source.indexOf(nextAnchor, start + anchor.length) : -1;
  return source.slice(start, end > start ? end : source.length);
}

function assertIncludes(label, text, needles) {
  for (const needle of needles) {
    assert(text.includes(needle), `${label} missing ${needle}`);
  }
}

function assertExcludes(label, text, needles) {
  for (const needle of needles) {
    assert(!text.includes(needle), `${label} should not include ${needle}`);
  }
}

const generationAdapter = sliceFrom('async function callProviderImageGeneration', 'async function callProviderImageEdit');
assertIncludes('callProviderImageGeneration', generationAdapter, [
  'providerImageSize(',
  'providerImageQuality(',
  'providerImageOutputFormat(',
  'providerImageBackground(',
  'providerImageModeration(',
  'Content-Type',
  'application/json',
  'background',
  'output_format',
  'moderation',
  "response_format: 'url'",
  'n: 1',
  'await runQueuedProviderImageBatch(count, async',
  "queueMode: 'serial-delayed'",
  'queueDelayMs: providerImageRequestDelay(options)'
]);
assertExcludes('callProviderImageGeneration', generationAdapter, [
  'await Promise.all(Array.from({ length: count }, async'
]);

const editAdapter = sliceFrom('async function callProviderImageEdit', 'function reqBodyModel');
assertIncludes('callProviderImageEdit', editAdapter, [
  'providerImageSize(',
  'providerImageQuality(',
  'providerImageOutputFormat(',
  'providerImageInputFidelity(',
  'providerImageBackground(',
  'providerImageModeration(',
  "form.append('size', size)",
  "form.append('quality', quality)",
  "form.append('background', background)",
  "form.append('output_format', outputFormat)",
  "form.append('moderation', moderation)",
  "form.append('response_format', 'url')",
  "form.append('n', '1')",
  "form.append('input_fidelity', inputFidelity)",
  "form.append('image'",
  "form.append('mask'",
  "referenceImageField: 'image'",
  "referenceImageFieldMode:",
  'await runQueuedProviderImageBatch(count, async',
  "queueMode: 'serial-delayed'",
  'queueDelayMs: providerImageRequestDelay(options)'
]);
assertExcludes('callProviderImageEdit', editAdapter, [
  'await Promise.all(Array.from({ length: count }, async',
  "form.append('image[]'"
]);

assertIncludes('Provider image request queue', source, [
  'const IMAGE_PROVIDER_REQUEST_DELAY_MS',
  'let providerImageRequestQueue = Promise.resolve()',
  'function runQueuedProviderImageRequest',
  'async function runQueuedProviderImageBatch',
  'forceQueueDelay: i > 0'
]);

const ecommercePromptBuilder = sliceFrom('function ecommercePromptOutputCanvasText', 'function resolveTextRoute');
assertIncludes('Ecommerce prompt output canvas requirement', ecommercePromptBuilder, [
  'providerImageSize(ratioValue, sizeTier)',
  '输出画布要求',
  '不要沿用参考图原始宽高比例',
  '目标尺寸'
]);

const coverage = [
  {
    label: 'Canvas Chat dialog agent',
    block: sliceFrom("app.post('/api/canvas/dialog-agent-generate'", "app.post('/api/generate/tasks'"),
    needles: ['callProviderImageEdit', 'callProviderImageGeneration']
  },
  {
    label: 'Quick generate tasks',
    block: sliceFrom("app.post('/api/generate/tasks'", "app.get('/api/generate/tasks/:id'"),
    needles: ['buildImageGenerateNodePrompt', 'callProviderImageEdit', 'callProviderImageGeneration']
  },
  {
    label: 'Template generate image',
    block: sliceFrom("app.post('/api/template/generate-image'", "app.post('/api/template/reverse-prompt'"),
    needles: ['callProviderImageEdit', 'callProviderImageGeneration']
  },
  {
    label: 'Image tool inpaint/erase/text edit',
    block: sliceFrom('async function runImageToolEdit', 'async function runImageToolOutpaint'),
    needles: ['callProviderImageEdit']
  },
  {
    label: 'Image tool outpaint',
    block: sliceFrom('async function runImageToolOutpaint', "app.post('/api/image-tools/inpaint'"),
    needles: ['callProviderImageEdit']
  },
  {
    label: 'Admin provider image test',
    block: sliceFrom("app.post('/api/admin/api-providers/:id/test'", "app.get('/api/admin/model-prices'"),
    needles: ['callProviderImageGeneration']
  }
];

for (const item of coverage) {
  assertIncludes(item.label, item.block, item.needles);
}

const quickGenerateBlock = sliceFrom("app.post('/api/generate/tasks'", "app.get('/api/generate/tasks/:id'");
assertExcludes('Quick generate tasks prompt builder', quickGenerateBlock, [
  'buildEcommerceImagePrompt'
]);

const directImageFetches = [...source.matchAll(/fetch\(([^)]*images\/(?:generations|edits)[^)]*)\)/g)];
assert(directImageFetches.length === 0, 'Direct fetch to Packy image endpoints found outside provider adapter');

console.log(`Packy GPT Image 2 adapter coverage passed: ${coverage.length} entry groups`);

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const serverPath = path.join(repoRoot, 'server.js');
const source = fs.readFileSync(serverPath, 'utf8');
const canvasPath = path.join(repoRoot, 'assets', 'Canvas-B8bY9_QL.js');
const canvasSource = fs.readFileSync(canvasPath, 'utf8');
const adminProviderView = fs.readFileSync(path.join(repoRoot, 'frontend', 'src', 'views', 'AdminApiProvidersSource.vue'), 'utf8');
const adminProviderApi = fs.readFileSync(path.join(repoRoot, 'frontend', 'src', 'api', 'adminApiProviders.ts'), 'utf8');

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
  'providerImageTimeoutMs(options.route, status)',
  'providerImageRequestSize(',
  'providerImageQuality(',
  'providerImageOutputFormat(',
  'providerImageBackground(',
  'providerImageModeration(',
  'Content-Type',
  'application/json',
  'background',
  'output_format',
  'moderation',
  'response_format: responseMode.responseFormat',
  'stream: true',
  'partial_images: responseMode.partialImages',
  'n: 1',
  'parseProviderImageResponse(resp)',
  'fetchProviderWithPreTlsRetry',
  'agent: providerImageAgentForUrl(requestUrl)',
  'await runQueuedProviderImageBatch(count, async',
  "queueMode: options.bypassProviderQueue ? 'persistent-task-worker' : 'bounded-fair'",
  'queueDelayMs: providerImageRequestDelay(options)'
]);
assertExcludes('callProviderImageGeneration', generationAdapter, [
  'await Promise.all(Array.from({ length: count }, async'
]);

const editAdapter = sliceFrom('async function callProviderImageEdit', 'function reqBodyModel');
assertIncludes('callProviderImageEdit', editAdapter, [
  'providerImageTimeoutMs(options.route, status)',
  'providerImageRequestSize(',
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
  "form.append('response_format', responseMode.responseFormat)",
  "form.append('stream', 'true')",
  "form.append('partial_images', String(responseMode.partialImages))",
  "form.append('n', '1')",
  "form.append('input_fidelity', inputFidelity)",
  "form.append('image'",
  "form.append('mask'",
  'parseProviderImageResponse(resp)',
  'fetchProviderWithPreTlsRetry',
  'agent: providerImageAgentForUrl(requestUrl)',
  'providerImageRequestErrorMessage(err)',
  "referenceImageField: lingsuanImages ? 'image[]' : 'image'",
  "referenceImageFieldMode:",
  'referenceImageBytes:',
  'referenceImageTotalBytes:',
  'transportMode:',
  'await runQueuedProviderImageBatch(count, async',
  "queueMode: options.bypassProviderQueue ? 'persistent-task-worker' : 'bounded-fair'",
  'queueDelayMs: providerImageRequestDelay(options)'
]);
assertExcludes('callProviderImageEdit', editAdapter, [
  'await Promise.all(Array.from({ length: count }, async'
]);

assertIncludes('Lingsuan official Images adapter', source, [
  "const LINGSUAN_IMAGES_API_FORMAT = 'lingsuan-images'",
  'function isLingsuanImagesRoute',
  'function normalizeApiProviderRoute',
  "return { stream: false, responseFormat: 'b64_json', partialImages: undefined }",
  '? { model, prompt, size, quality, output_format: outputFormat, n: 1 }',
  "form.append(lingsuanImages ? 'image[]' : 'image'",
  "referenceImageField: lingsuanImages ? 'image[]' : 'image'"
]);
assertExcludes('Lingsuan official Images adapter', source, [
  'LINGSUAN_IMAGE_HOSTS',
  "includes('lingsuan.top')"
]);

assertIncludes('Packy image-group adapter', source, [
  "const PACKY_IMAGES_API_FORMAT = 'packy-images'",
  'const PACKY_IMAGE_PROVIDER_TIMEOUT_MS = positiveNumber(process.env.PACKY_IMAGE_PROVIDER_TIMEOUT_MS, 360000)',
  'function isPackyImagesRoute',
  'function providerImageTimeoutMs',
  'function packyImageRequestExamples',
  'const strictImages = lingsuanImages || packyImages',
  "referenceImageField: lingsuanImages ? 'image[]' : 'image'"
]);
assertExcludes('Packy image-group adapter routing', source, [
  'PACKY_IMAGE_HOSTS',
  "includes('packyapi.com')"
]);

assertIncludes('Provider image request queue', source, [
  'const IMAGE_PROVIDER_REQUEST_DELAY_MS',
  'const imageRequestScheduler = new ImageRequestScheduler',
  'function runQueuedProviderImageRequest',
  'async function runQueuedProviderImageBatch',
  'forceQueueDelay: i > 0'
]);

const preTlsRetryGuard = sliceFrom('function isProviderPreTlsDisconnect', 'function providerImageRequestErrorMessage');
assertIncludes('Provider pre-TLS retry guard', preTlsRetryGuard, [
  'client network socket disconnected before secure tls connection was established'
]);
assertExcludes('Provider pre-TLS retry guard', preTlsRetryGuard, [
  'ECONNRESET',
  'socket hang up',
  'ETIMEDOUT',
  'ENETUNREACH'
]);

const providerImageTransport = sliceFrom('function normalizeLingsuanImageProxyUrl', 'function isProviderPreTlsReset');
assertIncludes('Provider image targeted proxy transport', providerImageTransport, [
  'const LINGSUAN_IMAGE_PROXY_URL',
  "new Set(['lingsuan.top'])",
  'new HttpsProxyAgent',
  'function isLingsuanImageProxyTarget',
  'function providerImageAgentForUrl',
  'function providerImageTransportForUrl',
  "'https-proxy'",
  "'https-ipv4-pool'"
]);
assertIncludes('Provider image proxy dependency', source, [
  "const { HttpsProxyAgent } = require('https-proxy-agent');"
]);
assertExcludes('Provider image targeted proxy scope', providerImageTransport, [
  "new Set(['www.packyapi.com'])",
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'createProviderImageIpv4RotatingLookup'
]);

const providerImageErrorStart = source.indexOf('function isProviderPreTlsDisconnect');
const providerImageErrorEnd = source.indexOf('async function fetchProviderWithPreTlsRetry', providerImageErrorStart);
assert(providerImageErrorStart >= 0 && providerImageErrorEnd > providerImageErrorStart, 'Provider image error helper was not found');
eval(source.slice(providerImageErrorStart, providerImageErrorEnd));
const resetError = new Error('request to https://provider.example/v1/images/edits failed, reason:');
resetError.cause = { code: 'ECONNRESET', message: 'socket hang up' };
assert(
  providerImageRequestErrorMessage(resetError) === 'Provider 图生图上传连接被重置（ECONNRESET），请稍后重试或检查线路',
  'Provider image reset error must expose the nested socket cause'
);
const preTlsResetError = Object.assign(
  new Error('Client network socket disconnected before secure TLS connection was established'),
  { code: 'ECONNRESET' }
);
assert(
  providerImageRequestErrorMessage(preTlsResetError) === 'Provider 图生图尚未建立到中转站的安全连接（ECONNRESET），请稍后重试或检查线路',
  'Provider image pre-TLS reset must explain that the relay may not receive the request'
);

assertIncludes('Streaming Base64 provider response adapter', source, [
  'function providerImageResponseMode',
  'imageResponseFormat',
  'imageStream',
  'imagePartialImages',
  'function parseProviderImageSse',
  'function collectProviderImageResults',
  'partial_image_b64',
  'PROVIDER_IMAGE_EMPTY_BILLED_RESPONSE'
]);
assertExcludes('Streaming Base64 provider response adapter', source, [
  'IMAGE_PROVIDER_STREAMING_HOSTS'
]);

assertIncludes('Admin image route request configuration', adminProviderView, [
  "imageResponseFormat: 'url' | 'b64_json'",
  'imageStream: boolean',
  'imagePartialImages: string',
  '当前线路请求预览',
  '保存时只写入这条线路，不影响其他线路',
  'URL 与 Base64 不再由域名自动判断',
  "{ label: 'Lingsuan Images', value: LINGSUAN_IMAGES_API_FORMAT }",
  "{ label: 'Packy Images', value: PACKY_IMAGES_API_FORMAT }",
  'Lingsuan Images 固定非流式',
  'Packy Images 不发送 response_format',
  'image[]=<file>'
]);
assertIncludes('Admin image route API fields', adminProviderApi, [
  "imageResponseFormat?: 'url' | 'b64_json'",
  'imageStream?: boolean',
  'imagePartialImages?: number'
]);

const ecommercePromptBuilder = sliceFrom('function ecommercePromptOutputCanvasText', 'function resolveTextRoute');
assertIncludes('Ecommerce prompt output canvas requirement', ecommercePromptBuilder, [
  'providerImageSize(ratioValue, sizeTier)',
  '输出画布要求',
  '不要沿用参考图原始宽高比例',
  '目标尺寸'
]);

const providerImagePersistence = sliceFrom('async function loadRemoteProviderImagePayload', 'function normalizeTaskImage');
assertIncludes('Provider image aspect warning', providerImagePersistence, [
  'providerImageAspectValidation(decoded, itemRequest)',
  'providerImageAspectWarning(validation)',
  'persistProviderImagePayload(decoded)',
  'actualWidth: actual.width',
  'actualHeight: actual.height',
  'aspectRatioWarning'
]);

const coverage = [
  {
    label: 'Canvas Chat dialog agent',
    block: sliceFrom("app.post('/api/canvas/dialog-agent-generate'", "app.post('/api/generate/tasks'"),
    needles: ['callProviderImageEdit', 'callProviderImageGeneration', 'persistProviderImageResults(imageResult.images, imageResult.request)']
  },
  {
    label: 'Quick generate tasks',
    block: sliceFrom("app.post('/api/generate/tasks'", "app.get('/api/generate/tasks/:id'"),
    needles: ['submitPersistentGenerationTask', 'makePersistentTaskResponse']
  },
  {
    label: 'Template generate image',
    block: sliceFrom('async function executeTemplateImageGeneration', "app.post('/api/template/generate-image'"),
    needles: ['submitPersistentGenerationTask', 'generationTaskService.waitForTerminal']
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

const persistentGenerateBlock = sliceFrom('async function executePersistentGenerationItem', 'const generationTaskService');
assertIncludes('Persistent generation Provider adapter', persistentGenerateBlock, [
  'callProviderImageEdit',
  'callProviderImageGeneration',
  'persistProviderImageResults(providerResult.images, providerRequestMeta)'
]);

assertIncludes('Canvas quick generate ratio contract', canvasSource, [
  'ratio:String(P.size||"1:1").replace(/[xX×]/g,":")'
]);
assertExcludes('Canvas quick generate ratio contract', canvasSource, [
  'size:P.size||"1:1",ratio:P.size||"1:1"'
]);

assertIncludes('Canvas noon reference behavior', canvasSource, [
  'Unsupported mime type:',
  'converting to image/jpeg',
  'a.width=r.width,a.height=r.height',
  'a.toDataURL(t,.9)'
]);
assertExcludes('Canvas noon reference behavior', canvasSource, [
  'HJM_CANVAS_REFERENCE_MAX_SIDE',
  'hjmReferenceUrlToDataUrl',
  'Outbound reference compression failed'
]);

const directImageFetches = [...source.matchAll(/fetch\(([^)]*images\/(?:generations|edits)[^)]*)\)/g)];
assert(directImageFetches.length === 0, 'Direct fetch to Packy image endpoints found outside provider adapter');

console.log(`Packy GPT Image 2 adapter coverage passed: ${coverage.length} entry groups`);

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const serverPath = path.join(repoRoot, 'server.js');
const source = fs.readFileSync(serverPath, 'utf8');
const helperStart = source.indexOf('function providerImageSizeTier');
const helperEnd = source.indexOf('function resolveTextRoute');
const persistStart = source.indexOf('async function persistProviderImageResults');
const persistEnd = source.indexOf('function normalizeTaskImage');

if (
  helperStart < 0 || helperEnd < 0 || helperEnd <= helperStart ||
  persistStart < 0 || persistEnd < 0 || persistEnd <= persistStart
) {
  throw new Error('Cannot locate Packy image size helpers in server.js');
}

eval(source.slice(helperStart, helperEnd));

const ratios = [
  '1:1',
  '1x1',
  '2:3',
  '3:2',
  '3:4',
  '3x4',
  '4:3',
  '4x3',
  '4:5',
  '5:4',
  '9:16',
  '9x16',
  '16:9',
  '16x9',
  '1:2',
  '2:1',
  '9:21',
  '21:9'
];
const tiers = ['1k', '2k', '4k'];
const expected = {
  '1k|1:1': '1024x1024',
  '1k|1x1': '1024x1024',
  '1k|2:3': '688x1024',
  '1k|3:2': '1024x688',
  '1k|3:4': '768x1024',
  '1k|3x4': '768x1024',
  '1k|4:3': '1024x768',
  '1k|4x3': '1024x768',
  '1k|4:5': '816x1024',
  '1k|5:4': '1024x816',
  '1k|9:16': '624x1072',
  '1k|9x16': '624x1072',
  '1k|16:9': '1072x624',
  '1k|16x9': '1072x624',
  '1k|1:2': '576x1152',
  '1k|2:1': '1152x576',
  '1k|9:21': '544x1232',
  '1k|21:9': '1232x544',
  '2k|1:1': '2048x2048',
  '2k|1x1': '2048x2048',
  '2k|2:3': '1360x2048',
  '2k|3:2': '2048x1360',
  '2k|3:4': '1536x2048',
  '2k|3x4': '1536x2048',
  '2k|4:3': '2048x1536',
  '2k|4x3': '2048x1536',
  '2k|4:5': '1632x2048',
  '2k|5:4': '2048x1632',
  '2k|9:16': '1152x2048',
  '2k|9x16': '1152x2048',
  '2k|16:9': '2048x1152',
  '2k|16x9': '2048x1152',
  '2k|1:2': '1024x2048',
  '2k|2:1': '2048x1024',
  '2k|9:21': '880x2048',
  '2k|21:9': '2048x880',
  '4k|1:1': '2880x2880',
  '4k|1x1': '2880x2880',
  '4k|2:3': '2352x3520',
  '4k|3:2': '3520x2352',
  '4k|3:4': '2496x3312',
  '4k|3x4': '2496x3312',
  '4k|4:3': '3312x2496',
  '4k|4x3': '3312x2496',
  '4k|4:5': '2576x3216',
  '4k|5:4': '3216x2576',
  '4k|9:16': '2160x3840',
  '4k|9x16': '2160x3840',
  '4k|16:9': '3840x2160',
  '4k|16x9': '3840x2160',
  '4k|1:2': '1920x3840',
  '4k|2:1': '3840x1920',
  '4k|9:21': '1648x3840',
  '4k|21:9': '3840x1648'
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseSize(size) {
  const match = String(size).match(/^(\d+)x(\d+)$/);
  assert(match, `Invalid size format: ${size}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function assertPackySize(size, ratioLabel, tier) {
  const { width, height } = parseSize(size);
  const pixels = width * height;
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  assert(width % 16 === 0, `${tier} ${ratioLabel}: width is not a multiple of 16 (${size})`);
  assert(height % 16 === 0, `${tier} ${ratioLabel}: height is not a multiple of 16 (${size})`);
  assert(longSide <= 3840, `${tier} ${ratioLabel}: long side exceeds 3840 (${size})`);
  assert(longSide / shortSide <= 3, `${tier} ${ratioLabel}: side ratio exceeds 3:1 (${size})`);
  assert(pixels >= 655360, `${tier} ${ratioLabel}: pixels below Packy minimum (${size})`);
  assert(pixels <= 8294400, `${tier} ${ratioLabel}: pixels above Packy maximum (${size})`);
}

const rows = [];
for (const tier of tiers) {
  for (const ratio of ratios) {
    const key = `${tier}|${ratio}`;
    const actual = providerImageSize(ratio, tier);
    assertPackySize(actual, ratio, tier);
    assert(actual === expected[key], `${key}: expected ${expected[key]}, got ${actual}`);
    const prompt = buildImageGenerateNodePrompt('生成商品场景图', {
      body: { ratio, clarity: tier, referenceImages: ['fixture-reference.png'] },
      hasReferenceImages: true
    });
    assert(prompt === '生成商品场景图', `${key}: Image node prompt must not append hidden canvas constraints`);
    rows.push(`${tier.toUpperCase()} ${ratio} -> ${actual}`);
  }
}

const autoPrompt = buildImageGenerateNodePrompt('生成商品场景图', {
  body: { ratio: 'auto', clarity: '1k', referenceImages: ['fixture-reference.png'] },
  hasReferenceImages: true
});
assert(autoPrompt === '生成商品场景图', 'Auto ratio must not append hidden composition instructions');
assert(buildImageGenerateNodePrompt('', { hasReferenceImages: true }) === '根据参考图生成图片', 'Reference-only image nodes must keep the shortest visible fallback');
assert(buildImageGenerateNodePrompt('', { hasReferenceImages: false }) === '生成图片', 'Empty image nodes must keep the shortest visible fallback');

assert(providerImageQuality('1k') === 'low', '1K clarity must map to Packy low quality');
assert(providerImageQuality('2k') === 'medium', '2K clarity must map to Packy medium quality');
assert(providerImageQuality('4k') === 'high', '4K clarity must map to Packy high quality');
assert(providerImageQuality('standard', '1k') === 'low', 'UI standard + 1K clarity must map to low quality');
assert(providerImageQuality('standard', '2k') === 'medium', 'UI standard + 2K clarity must map to medium quality');
assert(providerImageQuality('standard', '4k') === 'high', 'UI standard + 4K clarity must map to high quality');
assert(providerImageQuality('high') === 'high', 'Explicit high quality must be preserved');
assert(providerImageSize('1024x1024', '1k') === '1024x1024', 'Explicit 1024x1024 must stay an explicit size');
assert(normalizeImageRatio('1x1') === '1:1', 'Legacy 1x1 ratio must normalize to 1:1');
assert(normalizeImageRatio('1X1') === '1:1', 'Uppercase legacy 1X1 ratio must normalize to 1:1');
assert(normalizeImageRatio('1×1') === '1:1', 'Multiplication-sign legacy ratio must normalize to 1:1');
assert(providerImageRequestSize({ ratio: '1:1', size: '1536x1024' }, '1k') === '1024x1024', 'Canonical ratio must take precedence over a conflicting size field');
assert(providerImageRequestSize({ size: '1x1' }, '1k') === '1024x1024', 'Legacy size-as-ratio clients must remain compatible');
assert(providerImageRequestSize({ size: '1024x1024' }, '1k') === '1024x1024', 'Explicit provider pixel size must remain compatible');

const oneByOnePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nH0AAAAASUVORK5CYII=', 'base64');
const decodedSquare = { buffer: oneByOnePng, ext: 'png' };
assert(JSON.stringify(providerImageDimensions(oneByOnePng, 'png')) === JSON.stringify({ width: 1, height: 1 }), 'PNG dimensions must be read from IHDR');
assert(providerImageAspectValidation(decodedSquare, { size: '1024x1024' }).valid, 'A square result must pass a square request');
const mismatchValidation = providerImageAspectValidation(decodedSquare, { size: '1072x624' });
assert(!mismatchValidation.valid, 'A square result must fail a landscape request');
assert(mismatchValidation.code === 'PROVIDER_IMAGE_ASPECT_RATIO_MISMATCH', 'Aspect mismatch must use the stable error code');
const mismatchWarning = providerImageAspectWarning(mismatchValidation);
assert(mismatchWarning?.code === 'PROVIDER_IMAGE_ASPECT_RATIO_MISMATCH', 'Aspect mismatch must become a stable warning');
assert(mismatchWarning?.expectedSize === '1072x624', 'Aspect warning must preserve the requested size');
assert(mismatchWarning?.actualSize === '1x1', 'Aspect warning must preserve the actual size');

const persistedPayloads = [];
function firstString(...values) {
  return values.find(value => typeof value === 'string' && value.trim())?.trim() || '';
}
async function loadRemoteProviderImagePayload() {
  throw new Error('Remote provider image loading is not expected in this fixture');
}
function providerImageBuffer(value = '') {
  const buffer = Buffer.from(String(value || ''), 'base64');
  return buffer.length ? { buffer, ext: 'png' } : null;
}
function persistProviderImagePayload(decoded) {
  persistedPayloads.push(decoded);
  return '/uploads/generated/aspect-mismatch-fixture.png';
}
function imageProxyError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

eval(source.slice(persistStart, persistEnd));

(async () => {
  const persistedMismatch = await persistProviderImageResults([
    { b64_json: oneByOnePng.toString('base64') }
  ], { size: '1072x624' });
  assert(persistedPayloads.length === 1, 'A readable mismatched image must still be persisted');
  assert(persistedMismatch[0]?.url === '/uploads/generated/aspect-mismatch-fixture.png', 'A mismatched image must return its persisted URL');
  assert(persistedMismatch[0]?.aspectRatioWarning?.code === 'PROVIDER_IMAGE_ASPECT_RATIO_MISMATCH', 'Persisted mismatch must carry warning metadata');
  assert(persistedMismatch[0]?.width === 1 && persistedMismatch[0]?.height === 1, 'Persisted mismatch must expose actual dimensions');

  console.log(`Packy GPT Image 2 size mapping passed: ${rows.length} cases`);
  console.log(rows.join('\n'));
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});

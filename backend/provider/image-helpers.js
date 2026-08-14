'use strict';

const PROVIDER_IMAGE_ASPECT_TOLERANCE = 0.03;

function providerImageSizeTier(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (['4k', '3840', '4096'].includes(raw)) return '4k';
  if (['2k', '2048'].includes(raw)) return '2k';
  return '1k';
}

function providerImageLongSide(sizeTier = '') {
  const tier = providerImageSizeTier(sizeTier);
  if (tier === '4k') return 3840;
  if (tier === '2k') return 2048;
  return 1024;
}

function roundToMultiple(value, multiple = 16) {
  return Math.max(multiple, Math.round(Number(value || 0) / multiple) * multiple);
}

function parseImageRatio(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*[:x×]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const ratio = width / height;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return Math.max(1 / 3, Math.min(3, ratio));
}

function normalizeImageRatio(value = '', fallback = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'auto') return 'auto';
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*[:x×]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return fallback;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return fallback;
  return `${width}:${height}`;
}

function parseExplicitImageSize(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  const match = raw.match(/^(\d{2,5})\s*x\s*(\d{2,5})$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return width >= 64 && height >= 64 ? { width, height } : null;
}

function clampImageSize(width, height) {
  const maxSide = 3840;
  const minPixels = 655360;
  const maxPixels = 8294400;
  let w = Math.max(16, Number(width) || 1024);
  let h = Math.max(16, Number(height) || 1024);
  const sideScale = Math.min(1, maxSide / Math.max(w, h));
  w *= sideScale;
  h *= sideScale;
  let pixels = w * h;
  if (pixels > maxPixels) {
    const scale = Math.sqrt(maxPixels / pixels);
    w *= scale;
    h *= scale;
  }
  pixels = w * h;
  if (pixels < minPixels) {
    const scale = Math.sqrt(minPixels / pixels);
    w *= scale;
    h *= scale;
  }
  w = roundToMultiple(w, 16);
  h = roundToMultiple(h, 16);
  while (w * h > maxPixels) {
    if (w >= h) w -= 16;
    else h -= 16;
  }
  while (w * h < minPixels) {
    if (w <= h) w += 16;
    else h += 16;
  }
  w = Math.min(maxSide, Math.max(16, w));
  h = Math.min(maxSide, Math.max(16, h));
  return `${w}x${h}`;
}

function providerImageSize(value = '', sizeTierValue = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'auto') return 'auto';
  const explicitSize = parseExplicitImageSize(raw);
  if (explicitSize) {
    return clampImageSize(explicitSize.width, explicitSize.height);
  }
  const ratio = parseImageRatio(raw) || 1;
  const longSide = providerImageLongSide(sizeTierValue);
  const width = ratio >= 1 ? longSide : longSide * ratio;
  const height = ratio >= 1 ? longSide / ratio : longSide;
  return clampImageSize(width, height);
}

function providerImageDimensions(buffer, ext = '') {
  if (!Buffer.isBuffer(buffer)) return null;
  const type = String(ext || '').trim().toLowerCase();
  if ((type === 'png' || buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) && buffer.length >= 24) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if ((type === 'jpg' || type === 'jpeg' || (buffer[0] === 0xff && buffer[1] === 0xd8)) && buffer.length >= 10) {
    const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 3 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
      const marker = buffer[offset++];
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (marker === 0xda || offset + 2 > buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      if (sofMarkers.has(marker) && segmentLength >= 7) {
        const height = buffer.readUInt16BE(offset + 3);
        const width = buffer.readUInt16BE(offset + 5);
        return width > 0 && height > 0 ? { width, height } : null;
      }
      offset += segmentLength;
    }
    return null;
  }
  if ((type === 'webp' || (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP')) && buffer.length >= 30) {
    const chunkType = buffer.subarray(12, 16).toString('ascii');
    if (chunkType === 'VP8X') {
      return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    }
    if (chunkType === 'VP8L' && buffer[20] === 0x2f) {
      const width = 1 + (buffer[21] | ((buffer[22] & 0x3f) << 8));
      const height = 1 + ((buffer[22] >> 6) | (buffer[23] << 2) | ((buffer[24] & 0x0f) << 10));
      return { width, height };
    }
    if (chunkType === 'VP8 ' && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    return null;
  }
  if ((type === 'gif' || buffer.subarray(0, 6).toString('ascii').startsWith('GIF8')) && buffer.length >= 10) {
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if ((type === 'bmp' || (buffer[0] === 0x42 && buffer[1] === 0x4d)) && buffer.length >= 26) {
    const width = Math.abs(buffer.readInt32LE(18));
    const height = Math.abs(buffer.readInt32LE(22));
    return width > 0 && height > 0 ? { width, height } : null;
  }
  return null;
}

function providerImageAspectValidation(decoded = {}, providerRequest = {}) {
  const expectedSize = String(providerRequest?.size || providerRequest?.resolvedSize || '').trim().toLowerCase();
  if (!expectedSize || expectedSize === 'auto') return { valid: true, skipped: true, expectedSize };
  const expected = parseExplicitImageSize(expectedSize);
  if (!expected) return { valid: true, skipped: true, expectedSize };
  const actual = providerImageDimensions(decoded.buffer, decoded.ext);
  if (!actual) {
    return { valid: false, code: 'PROVIDER_IMAGE_DIMENSIONS_UNKNOWN', expectedSize, expected, actual: null };
  }
  const expectedRatio = expected.width / expected.height;
  const actualRatio = actual.width / actual.height;
  const deviation = Math.abs(actualRatio - expectedRatio) / expectedRatio;
  return {
    valid: deviation <= PROVIDER_IMAGE_ASPECT_TOLERANCE,
    code: deviation <= PROVIDER_IMAGE_ASPECT_TOLERANCE ? '' : 'PROVIDER_IMAGE_ASPECT_RATIO_MISMATCH',
    expectedSize,
    expected,
    actual,
    deviation
  };
}

function providerImageAspectWarning(validation = {}) {
  if (!validation || validation.valid || validation.skipped) return null;
  const actualSize = validation.actual ? `${validation.actual.width}x${validation.actual.height}` : '';
  const message = validation.code === 'PROVIDER_IMAGE_DIMENSIONS_UNKNOWN'
    ? `上游已返回图片，但无法读取真实尺寸（请求 ${validation.expectedSize}）；已保留并显示原图`
    : `上游返回图片比例与请求不一致：要求 ${validation.expectedSize}，实际 ${actualSize}；已保留并显示原图`;
  return {
    code: validation.code,
    message,
    expectedSize: validation.expectedSize,
    actualSize,
    deviation: Number.isFinite(validation.deviation) ? validation.deviation : null
  };
}

function providerImageQuality(value = '', sizeTierValue = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (['low', 'medium', 'high', 'auto'].includes(raw)) return raw;
  const tierRaw = String(sizeTierValue || raw || '').trim().toLowerCase();
  if (['4k', '3840', '4096', 'ultra', 'max'].includes(tierRaw)) return 'high';
  if (['2k', '2048', 'hd'].includes(tierRaw)) return 'medium';
  if (['1k', '1024', 'standard', 'sd'].includes(tierRaw)) return 'low';
  return 'auto';
}

function providerImageOutputFormat(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  return ['png', 'jpeg'].includes(raw) ? raw : 'png';
}

function providerImageInputFidelity(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  return ['high', 'low'].includes(raw) ? raw : 'high';
}

function providerImageBackground(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  return ['auto', 'opaque'].includes(raw) ? raw : 'auto';
}

function providerImageModeration(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  return ['auto', 'low'].includes(raw) ? raw : 'auto';
}

function providerImageMime(buffer, fallback = '') {
  const hinted = String(fallback || '').trim().toLowerCase();
  if (/^image\//.test(hinted)) return hinted;
  if (buffer && buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer && buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer && buffer.length >= 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return 'image/png';
}

function providerImageExt(mime = '') {
  const raw = String(mime || '').toLowerCase();
  if (raw.includes('jpeg') || raw.includes('jpg')) return 'jpg';
  if (raw.includes('webp')) return 'webp';
  return 'png';
}

function providerImageResponseMessage(value, depth = 0) {
  if (depth > 8 || !value) return '';
  if (typeof value === 'string') return value.length <= 1000 ? value : '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = providerImageResponseMessage(item, depth + 1);
      if (message) return message;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  if (typeof value.message === 'string' && value.message.trim()) return value.message.trim();
  if (value.error) {
    const message = providerImageResponseMessage(value.error, depth + 1);
    if (message) return message;
  }
  return '';
}

function providerImagePayload(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.length > 30 * 1024 * 1024) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return { buffer, ext: 'png' };
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { buffer, ext: 'jpg' };
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { buffer, ext: 'webp' };
  if (buffer.subarray(0, 6).toString('ascii').startsWith('GIF8')) return { buffer, ext: 'gif' };
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return { buffer, ext: 'bmp' };
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp' && /avif|avis/.test(buffer.subarray(8, 32).toString('ascii'))) {
    return { buffer, ext: 'avif' };
  }
  return null;
}

module.exports = {
  PROVIDER_IMAGE_ASPECT_TOLERANCE,
  providerImageSizeTier,
  providerImageLongSide,
  providerImageSize,
  providerImageDimensions,
  providerImageAspectValidation,
  providerImageAspectWarning,
  providerImageQuality,
  providerImageOutputFormat,
  providerImageInputFidelity,
  providerImageBackground,
  providerImageModeration,
  providerImageMime,
  providerImageExt,
  providerImageResponseMessage,
  providerImagePayload,
  normalizeImageRatio,
  parseImageRatio,
  parseExplicitImageSize,
  clampImageSize,
  roundToMultiple
};

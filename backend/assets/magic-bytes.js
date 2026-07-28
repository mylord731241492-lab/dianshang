'use strict';

// 资产文件真实类型识别（magic bytes），不依赖 file-type 等外部包。
// 用户 2026-07-27 拍板：图片仅 PNG/JPEG/WebP（≤20MB），视频/音频仅 MP4/WebM/MP3/WAV/M4A（≤50MB），
// 拒绝 SVG 与伪造 MIME；只信文件头，不信扩展名或客户端声明的 Content-Type。

const IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const MEDIA_MAX_BYTES = 50 * 1024 * 1024;

const MIME_ALIASES = {
  'image/png': ['image/png'],
  'image/jpeg': ['image/jpeg', 'image/jpg', 'image/pjpeg'],
  'image/webp': ['image/webp'],
  'video/mp4': ['video/mp4', 'application/mp4'],
  'video/webm': ['video/webm'],
  'audio/mpeg': ['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg'],
  'audio/wav': ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'],
  'audio/mp4': ['audio/mp4', 'audio/x-m4a', 'audio/m4a']
};

const EXTENSION_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/mp4': '.m4a'
};

const KIND_BY_MIME = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/mp4': 'audio'
};

function ascii(buffer, offset, length) {
  if (buffer.length < offset + length) return '';
  return buffer.subarray(offset, offset + length).toString('ascii');
}

// 返回 { mime, kind }；无法识别（含 SVG、EXE、HTML 等）返回 null。
function sniffAssetType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // PNG：89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return { mime: 'image/png', kind: 'image' };

  // JPEG：FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', kind: 'image' };
  }

  // RIFF 容器：WebP（WEBP）或 WAV（WAVE）
  if (ascii(buffer, 0, 4) === 'RIFF') {
    const format = ascii(buffer, 8, 4);
    if (format === 'WEBP') return { mime: 'image/webp', kind: 'image' };
    if (format === 'WAVE') return { mime: 'audio/wav', kind: 'audio' };
    return null;
  }

  // EBML（WebM）：1A 45 DF A3，且头部 DocType 为 webm
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    const head = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1');
    if (head.includes('webm')) return { mime: 'video/webm', kind: 'video' };
    return null;
  }

  // ISO BMFF（MP4/M4A）：偏移 4 处为 ftyp；品牌 M4A/M4B 视为音频
  if (ascii(buffer, 4, 4) === 'ftyp') {
    const brand = ascii(buffer, 8, 4).trim();
    if (/^M4[AB]/i.test(brand)) return { mime: 'audio/mp4', kind: 'audio' };
    return { mime: 'video/mp4', kind: 'video' };
  }

  // MP3：ID3v2 头或 MPEG 帧同步
  if (ascii(buffer, 0, 3) === 'ID3') return { mime: 'audio/mpeg', kind: 'audio' };
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0 && (buffer[1] & 0x06) !== 0x00) {
    return { mime: 'audio/mpeg', kind: 'audio' };
  }

  return null;
}

function declaredMimeMatches(sniffedMime, declaredMime) {
  const declared = String(declaredMime || '').trim().toLowerCase();
  if (!declared) return false;
  const aliases = MIME_ALIASES[sniffedMime] || [sniffedMime];
  return aliases.includes(declared);
}

function maxBytesForKind(kind) {
  return kind === 'image' ? IMAGE_MAX_BYTES : MEDIA_MAX_BYTES;
}

function extensionForMime(mime) {
  return EXTENSION_BY_MIME[mime] || '.bin';
}

module.exports = {
  IMAGE_MAX_BYTES,
  MEDIA_MAX_BYTES,
  sniffAssetType,
  declaredMimeMatches,
  maxBytesForKind,
  extensionForMime
};

'use strict';

function safeHeaderValue(value) {
  const normalized = String(value || '').replace(/[\r\n]+/g, ' ').trim();
  return normalized ? normalized.slice(0, 160) : '';
}

function readHeader(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return safeHeaderValue(headers.get(name));
  const target = String(name || '').toLowerCase();
  const entry = Object.entries(headers).find(([key]) => String(key).toLowerCase() === target);
  return safeHeaderValue(entry?.[1]);
}

function providerResponseDiagnostics(headers) {
  const diagnostics = {
    cfRay: readHeader(headers, 'cf-ray'),
    retryAfter: readHeader(headers, 'retry-after'),
    requestId: readHeader(headers, 'x-request-id')
      || readHeader(headers, 'x-provider-request-id')
      || readHeader(headers, 'request-id'),
    server: readHeader(headers, 'server')
  };
  return Object.fromEntries(Object.entries(diagnostics).filter(([, value]) => value));
}

function containsSkippedMainline(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return false;
  if (typeof value === 'string') return /skipped[_\s-]*mainline/i.test(value);
  if (Array.isArray(value)) return value.some((item) => containsSkippedMainline(item, depth + 1));
  if (typeof value !== 'object') return false;
  if (value.skipped_mainline === true) return true;
  return Object.values(value).some((item) => containsSkippedMainline(item, depth + 1));
}

function retryAfterMs(value, now = Date.now()) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.ceil(seconds * 1000), 10 * 60 * 1000);
  }
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.min(at - now, 10 * 60 * 1000));
}

function safeProviderErrorMessage(value, fallback = 'Provider request failed') {
  const raw = String(value || fallback)
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
    .replace(/((?:api[_\s-]?key|token|authorization)\s*[:=]\s*)(?:Bearer\s+)?[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{8,}\b/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_SECRET]')
    .replace(/\s+/g, ' ')
    .trim();
  return (raw || fallback).slice(0, 500);
}

function classifyImageProviderFailure(options = {}) {
  const status = Number(options.status || 0);
  const diagnostics = providerResponseDiagnostics(options.headers);
  const skippedMainline = containsSkippedMainline(options.data)
    || /skipped[_\s-]*mainline/i.test(String(options.message || ''));
  const headerRetryAfterMs = retryAfterMs(diagnostics.retryAfter, options.now);

  if (skippedMainline) {
    return {
      code: 'LINGSUAN_SKIPPED_MAINLINE',
      message: '灵算线路暂时跳过主处理链，本次任务未取得图片；本地已退款，上游计费状态待核对。',
      transient: true,
      retryAfterMs: Math.max(60 * 1000, headerRetryAfterMs),
      upstreamBillingAmbiguous: true,
      providerBillingStatus: 'unknown',
      billingAuditRequired: true,
      diagnostics
    };
  }

  if (status === 524) {
    return {
      code: 'PROVIDER_ORIGIN_TIMEOUT_524',
      message: '中转站已连接上游，但上游在约 120 秒内未返回结果；本地已退款，上游可能仍已计费。',
      transient: true,
      retryAfterMs: Math.max(120 * 1000, headerRetryAfterMs),
      upstreamBillingAmbiguous: true,
      providerBillingStatus: 'unknown',
      billingAuditRequired: true,
      diagnostics
    };
  }

  const transient = status >= 500 || status === 408 || status === 429;
  const upstreamBillingAmbiguous = status >= 500 || status === 408;
  return {
    code: String(options.fallbackCode || 'PROVIDER_IMAGE_FAILED'),
    message: safeProviderErrorMessage(options.message, `Provider returned ${status || 'unknown'}`),
    transient,
    retryAfterMs: headerRetryAfterMs,
    upstreamBillingAmbiguous,
    providerBillingStatus: upstreamBillingAmbiguous ? 'unknown' : 'not_charged',
    billingAuditRequired: upstreamBillingAmbiguous,
    diagnostics
  };
}

module.exports = {
  classifyImageProviderFailure,
  providerResponseDiagnostics,
  retryAfterMs,
  safeProviderErrorMessage
};

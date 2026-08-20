/**
 * 哈吉米AI 本地克隆 v2.0 — 生产级后端
 */
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const https = require('https');
const net = require('net');
const dns = require('dns');
const Database = require('better-sqlite3');
const multer = require('multer');
const { HttpsProxyAgent } = require('https-proxy-agent');
const sharp = require('sharp');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const { ImageRequestScheduler } = require('./backend/provider/image-request-scheduler');
const {
  classifyImageProviderFailure,
  safeProviderErrorMessage
} = require('./backend/provider/image-provider-diagnostics');
const {
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
  normalizeImageRatio
} = require('./backend/provider/image-helpers');
const { createGenerationTaskRepository } = require('./backend/generation/task-repository');
const { createBalanceService } = require('./backend/billing/balance-service');
const { GenerationTaskService } = require('./backend/generation/generation-task-service');
const { createAssetService, registerAssetRoutes } = require('./backend/assets');
const { createPromptService, registerPromptRoutes } = require('./backend/prompts');
const { createCanvasAgentRepository } = require('./backend/canvas-agent/session-repository');
const { createCanvasAgentRuntime } = require('./backend/canvas-agent/runtime-service');
const { createCanvasAgentPlanner } = require('./backend/canvas-agent/provider-planner');
const { createCanvasAgentSiteTools } = require('./backend/canvas-agent/site-tools');
const { registerCanvasAgentRoutes } = require('./backend/canvas-agent/routes');
const { createAgentSkillRepository } = require('./backend/agent-skills/skill-repository');
const { registerAgentSkillRoutes } = require('./backend/agent-skills/routes');
const { registerWorkflowRoutes } = require('./backend/workflows/routes');
const { registerImageToolRoutes } = require('./backend/image-tools/routes');
const { registerAdminRoutes } = require('./backend/admin/routes');
const { registerEcommerceSuiteRoutes } = require('./backend/ecommerce-suite/routes');
const {
  registerTemplateSettingsRoutes,
  registerCanvasPromptRoutes,
  registerTemplateImageRoutes
} = require('./backend/canvas-routes/routes');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const PORT = process.env.PORT || 3456;
const RAW_JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_SECRET = RAW_JWT_SECRET || (IS_PRODUCTION ? '' : 'hjm-mb-local-dev-secret');
const ADMIN_BOOTSTRAP_USERNAME = String(process.env.ADMIN_BOOTSTRAP_USERNAME || 'admin').trim() || 'admin';
const ADMIN_BOOTSTRAP_PASSWORD = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || '');
const ADMIN_BOOTSTRAP_EMAIL = String(process.env.ADMIN_BOOTSTRAP_EMAIL || `${ADMIN_BOOTSTRAP_USERNAME}@local.internal`).trim();
const normalizeOrigin = (origin = '') => String(origin || '').trim().replace(/\/+$/, '');
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);
const weakSecretPattern = /replace|changeme|change-me|default|secret|local-dev|hjm-mb|admin123|password|填|占位/i;
const isStrongJwtSecret = (value = '') => String(value || '').length >= 32 && !weakSecretPattern.test(String(value || ''));
const isStrongBootstrapPassword = (value = '') =>
  String(value || '').length >= 12 && !/admin123|123456|password|changeme|change-me|replace|default|填|占位/i.test(String(value || ''));
const LEGACY_PASSWORD_SECRETS = [
  'hjm-mb-secret-key-change-in-production',
  'hjm-mb-local-dev-secret',
  ...String(process.env.PASSWORD_LEGACY_SECRETS || '').split(',')
]
  .map((value) => String(value || '').trim())
  .filter((value, index, list) => value && value !== JWT_SECRET && list.indexOf(value) === index);
function failStartup(message) {
  console.error(`[STARTUP_BLOCKED] ${message}`);
  process.exit(1);
}
if (IS_PRODUCTION && !isStrongJwtSecret(JWT_SECRET)) {
  failStartup('生产模式必须配置强 JWT_SECRET，长度至少 32 位，且不能使用默认或占位值。');
}
const AI_API_BASE = process.env.AI_API_BASE || 'https://api.openai.com/v1';
const AI_IMAGE_KEY = process.env.AI_IMAGE_KEY || process.env.AI_API_KEY || 'sk-';
const AI_TEXT_KEY = process.env.AI_TEXT_KEY || process.env.AI_API_KEY || 'sk-';
const AI_IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'gpt-image-2';
const AI_TEXT_MODEL = process.env.AI_TEXT_MODEL || 'gpt-5.6-terra';
const AI_PROVIDER_GATEWAY = process.env.AI_PROVIDER_GATEWAY || 'new-api';
const NEW_API_BASE = process.env.NEW_API_BASE || AI_API_BASE;
const NEW_API_KEY = process.env.NEW_API_KEY || process.env.AI_API_KEY || AI_TEXT_KEY;
const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const PROVIDER_TIMEOUT_MS = positiveNumber(process.env.PROVIDER_TIMEOUT_MS, 120000);
const ECOMMERCE_TEXT_PROVIDER_TIMEOUT_MS = positiveNumber(process.env.ECOMMERCE_TEXT_PROVIDER_TIMEOUT_MS, 240000);
const IMAGE_PROVIDER_TIMEOUT_MS = positiveNumber(process.env.IMAGE_PROVIDER_TIMEOUT_MS || process.env.PROVIDER_IMAGE_TIMEOUT_MS, 180000);
const PACKY_IMAGE_PROVIDER_TIMEOUT_MS = positiveNumber(process.env.PACKY_IMAGE_PROVIDER_TIMEOUT_MS, 360000);
const CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS = positiveNumber(process.env.CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS || process.env.PROVIDER_ANALYSIS_TIMEOUT_MS, PROVIDER_TIMEOUT_MS);
const IMAGE_PROXY_MAX_BYTES = Math.min(positiveNumber(process.env.IMAGE_PROXY_MAX_BYTES, 20 * 1024 * 1024), 30 * 1024 * 1024);
const IMAGE_PROXY_MAX_REDIRECTS = 3;
const ALLOW_PRIVATE_PROVIDER_IMAGE_PERSIST = !IS_PRODUCTION && ['1','true','yes','on']
  .includes(String(process.env.ALLOW_PRIVATE_PROVIDER_IMAGE_PERSIST || '').toLowerCase());
const IMAGE_PROVIDER_REQUEST_DELAY_MS = Math.min(
  positiveNumber(
    process.env.IMAGE_PROVIDER_REQUEST_DELAY_MS ||
      process.env.PROVIDER_IMAGE_REQUEST_DELAY_MS ||
      process.env.IMAGE_PROVIDER_BATCH_DELAY_MS ||
      process.env.PROVIDER_IMAGE_BATCH_DELAY_MS,
    1500
  ),
  15000
);
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(DATA_DIR, 'data.db');
const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(__dirname, 'uploads');
const LOG_DIR = process.env.LOG_DIR ? path.resolve(process.env.LOG_DIR) : path.join(__dirname, 'logs');
const WORKFLOW_DIR = process.env.WORKFLOW_DIR ? path.resolve(process.env.WORKFLOW_DIR) : path.join(DATA_DIR, 'workflows');
const GENERATION_TASK_INPUT_DIR = process.env.GENERATION_TASK_INPUT_DIR
  ? path.resolve(process.env.GENERATION_TASK_INPUT_DIR)
  : path.join(DATA_DIR, 'generation-task-inputs');
const GENERATION_GLOBAL_CONCURRENCY = Math.max(1, Math.min(Number(process.env.GENERATION_GLOBAL_CONCURRENCY || 3) || 3, 20));
const GENERATION_DOMAIN_CONCURRENCY = Math.max(1, Math.min(Number(process.env.GENERATION_DOMAIN_CONCURRENCY || 1) || 1, 10));
const GENERATION_USER_CONCURRENCY = Math.max(1, Math.min(Number(process.env.GENERATION_USER_CONCURRENCY || 1) || 1, 5));
const GENERATION_MAX_QUEUED = Math.max(1, Math.min(Number(process.env.GENERATION_MAX_QUEUED || 30) || 30, 1000));
const GENERATION_MAX_USER_NONTERMINAL = Math.max(1, Math.min(Number(process.env.GENERATION_MAX_USER_NONTERMINAL || 3) || 3, 20));
const GENERATION_MAX_TRANSIENT_RETRIES = Math.max(0, Math.min(Number(process.env.GENERATION_MAX_TRANSIENT_RETRIES || 1) || 1, 3));
const GENERATION_TRANSIENT_RETRY_BACKOFF_MS = Math.max(100, Number(process.env.GENERATION_TRANSIENT_RETRY_BACKOFF_MS || 1000) || 1000);
const CANVAS_AGENT_MAX_TRANSIENT_RETRIES = Math.max(0, Math.min(Number(process.env.CANVAS_AGENT_MAX_TRANSIENT_RETRIES || 1) || 1, 3));
const GENERATION_DOMAIN_START_INTERVAL_RAW = Number(process.env.GENERATION_DOMAIN_START_INTERVAL_MS ?? 5000);
const GENERATION_DOMAIN_START_INTERVAL_MS = Number.isFinite(GENERATION_DOMAIN_START_INTERVAL_RAW)
  ? Math.max(0, Math.min(GENERATION_DOMAIN_START_INTERVAL_RAW, 60 * 1000))
  : 5000;
const GENERATION_CIRCUIT_THRESHOLD = Math.max(1, Math.min(Number(process.env.GENERATION_CIRCUIT_THRESHOLD || 3) || 3, 20));
const GENERATION_CIRCUIT_WINDOW_MS = Math.max(1000, Number(process.env.GENERATION_CIRCUIT_WINDOW_MS || 5 * 60 * 1000) || 5 * 60 * 1000);
const GENERATION_CIRCUIT_OPEN_MS = Math.max(1000, Number(process.env.GENERATION_CIRCUIT_OPEN_MS || 60 * 1000) || 60 * 1000);
const GENERATION_ROLLING_WINDOW_SIZE = Math.max(2, Math.min(Number(process.env.GENERATION_ROLLING_WINDOW_SIZE || 5) || 5, 20));
const GENERATION_ROLLING_FAILURE_THRESHOLD = Math.max(
  1,
  Math.min(Number(process.env.GENERATION_ROLLING_FAILURE_THRESHOLD || 2) || 2, GENERATION_ROLLING_WINDOW_SIZE)
);
const GENERATION_MAX_REFERENCE_COUNT = 4;
const GENERATION_MAX_REFERENCE_BYTES = 5 * 1024 * 1024;
const GENERATION_MAX_REFERENCE_TOTAL_BYTES = 16 * 1024 * 1024;
const GENERATION_INPUT_RETENTION_MS = 24 * 60 * 60 * 1000;
const GENERATION_INPUT_CLEANUP_INTERVAL_MS = Math.max(
  100,
  Number(process.env.GENERATION_INPUT_CLEANUP_INTERVAL_MS || 60 * 60 * 1000) || 60 * 60 * 1000
);
const ENABLE_REAL_AI = ['1','true','yes','on'].includes(String(process.env.ENABLE_REAL_AI || '').toLowerCase());
const ENABLE_REAL_EMAIL = ['1','true','yes','on'].includes(String(process.env.ENABLE_REAL_EMAIL || '').toLowerCase());
const ENABLE_REAL_PAYMENT = ['1','true','yes','on'].includes(String(process.env.ENABLE_REAL_PAYMENT || '').toLowerCase());
const ENABLE_REAL_STORAGE = ['1','true','yes','on'].includes(String(process.env.ENABLE_REAL_STORAGE || '').toLowerCase());
const REQUIRE_REGISTER_EMAIL_CODE = ['1','true','yes','on'].includes(String(process.env.REQUIRE_REGISTER_EMAIL_CODE || '').toLowerCase());
const hasUsableKey = (key = '') => /^sk-[A-Za-z0-9_\-]{12,}/.test(String(key || ''));
const hasConfiguredSecret = (key = '') => {
  const value = String(key || '').trim();
  return value.length >= 12 && !/replace|your-|填|占位|sk-$|^sk-replace/i.test(value);
};
const app = express();
const corsOptions = CORS_ORIGINS.length && !CORS_ORIGINS.includes('*')
  ? {
      credentials: true,
      origin(origin, callback) {
        if (!origin || CORS_ORIGINS.includes(normalizeOrigin(origin))) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS origin not allowed: ${origin}`));
      }
    }
  : { origin: true, credentials: true };
app.use(cors(corsOptions));
const generationJsonParser = express.json({ limit: '24mb' });
const defaultJsonParser = express.json({ limit: '50mb' });
app.use((req, res, next) => {
  if (req.path === '/api/generate/tasks') return generationJsonParser(req, res, next);
  return defaultJsonParser(req, res, next);
});
const sourceFrontendDist = path.join(__dirname, 'frontend', 'dist');
const infiniteCanvasDist = path.join(__dirname, 'integrations', 'infinite-canvas', 'web', 'dist');
const CANVAS_RUNTIME = String(process.env.CANVAS_RUNTIME || 'legacy').trim();
if (!['legacy', 'infinite'].includes(CANVAS_RUNTIME)) {
  failStartup(`无效的 CANVAS_RUNTIME=${CANVAS_RUNTIME}，仅支持 legacy 或 infinite，未设置时默认为 legacy。`);
}
if (CANVAS_RUNTIME === 'infinite' && !fs.existsSync(path.join(infiniteCanvasDist, 'index.html'))) {
  failStartup('CANVAS_RUNTIME=infinite 需要候选画布构建产物 integrations/infinite-canvas/web/dist/index.html，请先执行候选画布构建。');
}
const publicDir = path.join(__dirname, 'public');
const rootAssetsDir = path.join(__dirname, 'assets');
const videosDir = path.join(__dirname, 'videos');
const legacyProductionAssets = new Set([
  'AdminLayout-BHNDJhhH.js',
  'AdminLayout-CNzaDYz7.js',
  'AdminLogin-BugAOGHW.js',
  'AdminLogin-ClALfa_i.js',
  'AdminShell-B4AatFKJ.js',
  'AdminShell-BhMX0KkS.css',
  'AdminShell-CnxotuTf.js',
  'AuthPage-zwidFbtJ.js',
  'AvatarSettingsCard-wPB6ltvP.js',
  'Canvas-yGc8b2gf.js',
  'ChevronDownOutline-pxCW8Byr.js',
  'CloseOutline-B_gCUTio.js',
  'DocumentTextOutline-Bw5lmYm_.js',
  'Dropdown-BFtutDWh.js',
  'EyeOutline-B7n34_Qs.js',
  'FlashOutline-B9GvxoV5.js',
  'GenerateTaskMonitor-BDb7xR42.js',
  'GenerateTaskMonitor-BklfNami.css',
  'GenerateTaskMonitor-t9DGd0f2.js',
  'HomeIndex-BtiJ9toc.js',
  'HomeLayout-DUXizf0u.js',
  'HomeOutline-DNfRtfc_.js',
  'Icon-C7GvbXGM.js',
  'ImageHistoryPanel-Cu4Brucb.js',
  'ImagesOutline-DrpCSjX9.js',
  'ListOutline-C2DulHcI.js',
  'LoginModal-DILd3O2D.js',
  'PersonCircleOutline-DyeGAFLR.js',
  'ReceiptOutline-CUHOzn7j.js',
  'SettingsOutline-Cqpk4Cix.js',
  'ShieldCheckmarkOutline-efCWlAN3.js',
  'TemplateImageWorkbench-C98u8yir.js',
  'TemplateImageWorkbench-CoxnmTwx.css',
  'TemplateWorkflowAdmin-DS386KGP.js',
  'TemplateWorkflowAdmin-DZP2uijA.css',
  'TemplateWorkflowAdmin-db5gV2oK.js',
  'UserCenter-jqG499Zg.js',
  'admin-api-form-labels.js',
  'admin-api-source-route-bridge.js',
  'admin-visual-polish.css',
  'fixedImageModels-BTYfneSt.js',
  'i18n-Cj1lw-hh.js',
  'imageFiles-WPRPFIHV.js',
  'imageHistory-s5iwPTNE.js',
  'index-ZrBcanD1.js',
  'localWorkflowFileSystem-CxAxbYWk.js',
  'projects-eqk9JplQ.js',
  'template-image-prompt-grid-fix.css'
]);

app.use(express.static(publicDir));
app.use('/assets', (req, res, next) => {
  const assetName = path.posix.basename(req.path || '');
  if (!legacyProductionAssets.has(assetName)) {
    return next();
  }
  res.set('Cache-Control', 'no-store');
  return res.status(410).json({
    success: false,
    code: 'LEGACY_ASSET_GONE',
    message: '旧生产前端资源已隔离，请刷新页面加载当前版本。',
    asset: assetName
  });
});
app.use('/assets', express.static(rootAssetsDir));
app.use('/assets', express.static(path.join(sourceFrontendDist, 'assets')));
app.use('/videos', express.static(videosDir));
app.use('/assets', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(404).type('text/plain; charset=utf-8').send('Asset not found');
});
app.use((req, res, next) => {
  res.success = (payload = {}) => res.json({ success: true, ...payload });
  res.fail = (status, code, message, extra = {}) => res.status(status).json({ success: false, code, message, ...extra });
  next();
});

// Uploads
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(WORKFLOW_DIR, { recursive: true });
fs.mkdirSync(GENERATION_TASK_INPUT_DIR, { recursive: true });
const uploadDir = UPLOAD_DIR;
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 20 * 1024 * 1024 } });

// Database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, role TEXT DEFAULT 'user', balance REAL DEFAULT 50,
    avatar_url TEXT DEFAULT '', status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')), last_login_at TEXT
  );
  CREATE TABLE IF NOT EXISTS email_codes (
    email TEXT, code TEXT, type TEXT, expires_at INTEGER, created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS balance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, type TEXT,
    change_amount REAL, before_balance REAL, after_balance REAL,
    remark TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
    name TEXT DEFAULT '未命名项目', data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY, user_id TEXT, model_key TEXT, prompt TEXT,
    result_url TEXT, cost REAL DEFAULT 0, status TEXT DEFAULT 'completed',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS redeem_codes (
    code TEXT PRIMARY KEY, amount REAL NOT NULL,
    max_uses INTEGER DEFAULT 1, used_count INTEGER DEFAULT 0, enabled INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS chat_text_charges (
    request_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    model_key TEXT NOT NULL,
    cost REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'reserved',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_text_charges_user ON chat_text_charges(user_id, created_at);
  CREATE TABLE IF NOT EXISTS chat_text_steps (
    request_id TEXT NOT NULL,
    step_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'reserved',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (request_id, step_hash)
  );
 CREATE INDEX IF NOT EXISTS idx_chat_text_steps_request ON chat_text_steps(request_id, created_at);
`);

// Seed
db.exec(`INSERT OR IGNORE INTO redeem_codes (code, amount, max_uses) VALUES ('WELCOME50',50,1000),('HAJIMI2024',100,500),('VIP100',100,100)`);

// Helpers
const h = (pwd, secret = JWT_SECRET) => crypto.createHash('sha256').update(pwd + secret).digest('hex');
function verifyPasswordHash(passwordHash, password) {
  if (!passwordHash || !password) return { ok: false, needsRehash: false };
  if (passwordHash === h(password)) return { ok: true, needsRehash: false };
  const legacyMatched = LEGACY_PASSWORD_SECRETS.some((secret) => passwordHash === h(password, secret));
  return { ok: legacyMatched, needsRehash: legacyMatched };
}
function rehashPasswordIfNeeded(user, password, verification) {
  if (!user || !verification?.needsRehash) return;
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(h(password), user.id);
}
const uid = (p='') => p + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const rcode = () => String(Math.floor(100000 + Math.random() * 900000));
const imageRequestScheduler = new ImageRequestScheduler({
  globalConcurrency: GENERATION_GLOBAL_CONCURRENCY,
  perDomainConcurrency: GENERATION_DOMAIN_CONCURRENCY,
  userConcurrency: GENERATION_USER_CONCURRENCY,
  maxQueued: GENERATION_MAX_QUEUED,
  domainStartIntervalMs: GENERATION_DOMAIN_START_INTERVAL_MS,
  circuitThreshold: GENERATION_CIRCUIT_THRESHOLD,
  circuitWindowMs: GENERATION_CIRCUIT_WINDOW_MS,
  circuitOpenMs: GENERATION_CIRCUIT_OPEN_MS,
  rollingWindowSize: GENERATION_ROLLING_WINDOW_SIZE,
  rollingFailureThreshold: GENERATION_ROLLING_FAILURE_THRESHOLD,
  rollingMinimumSamples: GENERATION_ROLLING_FAILURE_THRESHOLD
});
const generationTaskRepository = createGenerationTaskRepository({
  db,
  idFactory: uid,
  maxUserNonterminal: GENERATION_MAX_USER_NONTERMINAL,
  maxQueued: GENERATION_MAX_QUEUED
});
// 余额流水与兑换码服务（backend/billing/balance-service.js）：SQL 自本文件平移，路由仍在此。
const balanceService = createBalanceService({ db });

// 账号隔离云端资产库（ADR-0006）：Fake Storage 与将来真实对象存储同一接口；
// ENABLE_REAL_STORAGE=true 且真实驱动未实施时资产写接口返回 503 ASSET_STORAGE_UNAVAILABLE，不回退本地 uploads。
const ASSET_URL_SIGNING_SECRET = String(process.env.ASSET_URL_SIGNING_SECRET || '').trim() || `${JWT_SECRET}:asset-content`;
const ASSET_FAKE_STORAGE_ROOT = process.env.ASSET_FAKE_STORAGE_ROOT
  ? path.resolve(process.env.ASSET_FAKE_STORAGE_ROOT)
  : path.join(DATA_DIR, 'object-storage');
const assetService = createAssetService({
  db,
  idFactory: uid,
  enableRealStorage: ENABLE_REAL_STORAGE,
  fakeStorageRoot: ASSET_FAKE_STORAGE_ROOT,
  signingSecret: ASSET_URL_SIGNING_SECRET,
  uploadDir
});

// 系统提示词 + 我的提示词双层云端提示词库（backend/prompts，Task 7）：
// system_prompts/user_prompts 建表在模块幂等迁移内完成；user_prompts 全部查询强制 user_id 隔离。
const promptService = createPromptService({ db, idFactory: uid });
const canvasAgentRepository = createCanvasAgentRepository({ db, idFactory: uid });

// Auth middleware
function auth(req, res, next) {
  const a = req.headers.authorization;
  if (!a || !a.startsWith('Bearer ')) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: '缺少登录 token' });
  try { req.user = jwt.verify(a.split(' ')[1], JWT_SECRET); next(); }
  catch (e) { res.status(401).json({ success: false, code: 'AUTH_INVALID', message: 'Token 无效或已过期' }); }
}
function optionalAuth(req, res, next) {
  const a = req.headers.authorization;
  if (!a || !a.startsWith('Bearer ')) return next();
  try { req.user = jwt.verify(a.split(' ')[1], JWT_SECRET); }
  catch (e) { req.user = null; }
  next();
}
function admin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, code: 'ADMIN_REQUIRED', message: '需要管理员权限' });
  next();
}

function parseJsonValue(value, fallback = {}) {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeWorkflowJson(value) {
  const parsed = parseJsonValue(value, value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  if (parsed.workflowJson !== undefined) return normalizeWorkflowJson(parsed.workflowJson);
  if (parsed.workflowData !== undefined) return normalizeWorkflowJson(parsed.workflowData);
  if (parsed.canvasData !== undefined) return normalizeWorkflowJson(parsed.canvasData);
  if (parsed.workflow !== undefined) return normalizeWorkflowJson(parsed.workflow);
  if (
    parsed.data !== undefined &&
    !Array.isArray(parsed.nodes) &&
    !Array.isArray(parsed.edges)
  ) {
    return normalizeWorkflowJson(parsed.data);
  }
  return parsed;
}

function workflowDataFromBody(body = {}) {
  const payload = body && typeof body === 'object' ? body : {};
  if (payload.workflowJson !== undefined) return normalizeWorkflowJson(payload.workflowJson);
  if (payload.workflowData !== undefined) return normalizeWorkflowJson(payload.workflowData);
  if (payload.canvasData !== undefined) return normalizeWorkflowJson(payload.canvasData);
  if (payload.workflow !== undefined) return normalizeWorkflowJson(payload.workflow);
  if (payload.data !== undefined) return normalizeWorkflowJson(payload.data);
  if (
    Array.isArray(payload.nodes) ||
    Array.isArray(payload.edges) ||
    payload.viewport !== undefined ||
    payload.storage !== undefined ||
    payload.thumbnail !== undefined
  ) {
    return normalizeWorkflowJson(payload);
  }
  return {};
}

function projectDataFromRow(row) {
  return normalizeWorkflowJson(parseJsonValue(row?.data || '{}', {}));
}

// ===================== DATA =====================
const IMG = [
  {k:"gpt-image-2",n:"GPT Image 2",p:10,q:["1k","2k","4k"]},
];
const TXT = [
  {k:"gpt-5.6-terra",n:"GPT 5.6 Terra",p:5,q:["1k"]},
];
const LEGACY_TEXT_MODEL_KEYS = new Set(['gpt-5.5', 'gpt-5.6']);
const LINGSUAN_IMAGES_API_FORMAT = 'lingsuan-images';
const PACKY_IMAGES_API_FORMAT = 'packy-images';
const RTS = [
  {id:"pub_route_openai_gpt_image_2",rk:"route_openai_gpt_image_2",dn:"PackyAPI GPT Image 2",cat:"image",g:"image",pri:10,def:true,dm:"gpt-image-2",apiFormat:PACKY_IMAGES_API_FORMAT,requestFormat:PACKY_IMAGES_API_FORMAT,endpoint:"/v1/images/generations",imageResponseFormat:"url",imageStream:false,imagePartialImages:0,requestExamples:[
    {label:"文生图",method:"POST",endpoint:"/v1/images/generations",contentType:"application/json",requestFormat:PACKY_IMAGES_API_FORMAT,body:{model:"gpt-image-2",prompt:"string",size:"1024x1024",quality:"high",output_format:"png",n:1}},
    {label:"图生图 / 局部重绘",method:"POST",endpoint:"/v1/images/edits",contentType:"multipart/form-data",requestFormat:PACKY_IMAGES_API_FORMAT,body:{model:"gpt-image-2",image:"<file>",mask:"<file optional>",prompt:"string",size:"1024x1024",quality:"high",output_format:"png",n:1}}
  ]},
  {id:"pub_route_mr5yltmuc7edcb2b",rk:"lignsuan-guanzhuan",name:"lingsuan-专线",displayName:"官转gpt-img2",dn:"官转gpt-img2",cat:"image",g:"image",pri:1,def:false,dm:"gpt-image-2",apiFormat:LINGSUAN_IMAGES_API_FORMAT,requestFormat:LINGSUAN_IMAGES_API_FORMAT,baseUrl:"https://lingsuan.top",endpoint:"/v1/images/generations",requestPath:"/v1/images/generations",imageEndpoint:"/v1/images/generations",imageEditEndpoint:"/v1/images/edits",imageResponseFormat:"b64_json",imageStream:false,imagePartialImages:0,requestExamples:[
    {label:"文生图",method:"POST",endpoint:"/v1/images/generations",contentType:"application/json",requestFormat:LINGSUAN_IMAGES_API_FORMAT,body:{model:"gpt-image-2",prompt:"string",size:"1024x1024",quality:"high",output_format:"png",n:1}},
    {label:"图生图 / 局部重绘",method:"POST",endpoint:"/v1/images/edits",contentType:"multipart/form-data",requestFormat:LINGSUAN_IMAGES_API_FORMAT,body:{model:"gpt-image-2","image[]":"<file>",prompt:"string",size:"1024x1024",quality:"high",output_format:"png",n:1}}
  ]},
  {id:"pub_route_openai_gpt_5_5",rk:"route_openai_gpt_5_5",dn:"GPT 5.6 Terra 官转",cat:"text",g:"text",pri:9,dm:"gpt-5.6-terra",apiFormat:"openai-responses",requestFormat:"openai-responses",endpoint:"/responses",requestExamples:[
    {label:"文本生成",method:"POST",endpoint:"/responses",contentType:"application/json",requestFormat:"openai-responses",body:{model:"gpt-5.6-terra",input:"string"}}
  ]},
];
const TMPL = JSON.parse(fs.readFileSync(path.join(__dirname,'template-data.json'),'utf8'));
const tasks = new Map();

function readState(key, fallback) {
  try {
    const row = db.prepare('SELECT value FROM app_state WHERE key=?').get(key);
    return row ? JSON.parse(row.value) : fallback;
  } catch (error) {
    console.warn('[STATE_READ_FALLBACK]', key, error.message);
    return fallback;
  }
}
function writeState(key, value) {
  db.prepare(`
    INSERT INTO app_state (key,value,updated_at) VALUES (?,?,datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
  `).run(key, JSON.stringify(value));
  return value;
}
function ensureState(key, fallback) {
  const existing = readState(key, null);
  if (existing !== null && existing !== undefined) return existing;
  return writeState(key, fallback);
}

const defaultEcommerceSuiteSkills = [
  {
    id: 'gloria',
    name: 'Gloria',
    avatarUrl: '/assets/ecommerce-suite-skills/gloria-avatar.svg',
    description: '大厂王牌视觉设计师，精通电商详情页设计',
    enabled: true,
    markdown: [
      '# Gloria',
      '定位：大厂王牌视觉设计师，擅长高转化电商详情页和品牌主视觉。',
      '风格：高级、稳定、商业化强，画面层级明确，产品识别优先。',
      '要求：避免花哨堆砌，强调品牌信任、核心利益点和清晰购买理由。'
    ].join('\n')
  },
  {
    id: 'paload',
    name: 'Paload',
    avatarUrl: '/assets/ecommerce-suite-skills/paload-avatar.svg',
    description: '多年资深高级美工，擅长智能研判复杂设计',
    enabled: true,
    markdown: [
      '# Paload',
      '定位：资深高级美工，擅长拆解复杂参考图并转化为可执行电商画面。',
      '风格：结构严谨、信息密度适中、构图稳健。',
      '要求：先识别参考图的构图、光影、文字区和卖点区，再迁移到用户产品。'
    ].join('\n')
  },
  {
    id: 'lumi',
    name: 'Lumi',
    avatarUrl: '/assets/ecommerce-suite-skills/lumi-avatar.svg',
    description: '资深电商设计师，构思严谨审美一流',
    enabled: true,
    markdown: [
      '# Lumi',
      '定位：资深电商设计师，擅长柔和高级、生活方式和精致氛围。',
      '风格：干净、细腻、审美统一，适合女性消费品、家清、个护和种草视觉。',
      '要求：光线柔和，色彩克制，产品材质真实，不牺牲商品识别。'
    ].join('\n')
  },
  {
    id: 'kira',
    name: 'Kira',
    avatarUrl: '/assets/ecommerce-suite-skills/kira-avatar.svg',
    description: '设计行业老油条，思维发散质量稳定',
    enabled: true,
    markdown: [
      '# Kira',
      '定位：经验丰富的电商视觉设计师，擅长快速给出稳定可落地方案。',
      '风格：醒目、直接、有转化感，适合平台主图和活动图。',
      '要求：强调点击动机，控制信息层级，避免过度装饰和无意义视觉噪声。'
    ].join('\n')
  },
  {
    id: 'rayyu',
    name: 'RayYu',
    avatarUrl: '/assets/ecommerce-suite-skills/rayyu-avatar.svg',
    description: '国字号视觉资深导师，创意无限',
    enabled: true,
    markdown: [
      '# RayYu',
      '定位：资深视觉导师，擅长创意概念、品牌叙事和高阶质感表达。',
      '风格：更有设计感和差异化，但保持电商可用。',
      '要求：用创意增强记忆点，不虚构功效、认证、价格和不存在的包装文字。'
    ].join('\n')
  }
];

const defaultEcommerceSuiteAgent = {
  enabled: true,
  defaultSkillId: 'gloria',
  sectionMode: 'dynamic',
  minSections: 3,
  maxSections: 5,
  defaults: {
    brandName: '',
    platform: '拼多多',
    country: '中国',
    language: '中文',
    ratio: '1:1',
    quality: '1k',
    imageCount: 1
  },
  sections: [],
  skills: defaultEcommerceSuiteSkills
};

const defaultAdminSettings = {
  siteName: '爱泊缇 AI 工作台',
  registrationEnabled: true,
  emailCodeEnabled: false,
  canvasStorageEnabled: true,
  templateImageEnabled: true,
  imageHistoryEnabled: true,
  mockMode: true,
  maxUploadSizeMb: 20,
  defaultCredits: 0,
  registrationGiftCredits: 0,
  ecommerceSuiteAgent: defaultEcommerceSuiteAgent
};

function textRouteModelKey(route = {}) {
  return String(
    route.dm ||
    route.defaultModelKey ||
    route.defaultModelRealName ||
    route.defaultTextModel ||
    route.requestBodyExample?.model ||
    AI_TEXT_MODEL
  ).trim();
}

function textModelDisplayName(modelKey = '', route = {}) {
  const explicit = String(route.defaultModelDisplayName || '').trim();
  if (explicit && !/GPT\s*5\.5/i.test(explicit)) return explicit;
  if (modelKey === 'gpt-5.6-terra') return 'GPT 5.6 Terra';
  return modelKey || '文本模型';
}

function resolveTextProviderModel(value = '', route = {}) {
  const requested = String(value || '').trim();
  if (!requested || LEGACY_TEXT_MODEL_KEYS.has(requested)) return textRouteModelKey(route);
  return requested;
}

function cleanSettingKey(value = '', fallback = '') {
  const raw = String(value || '').trim().toLowerCase();
  const normalized = raw.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function sanitizeSkillMarkdown(value = '') {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>[\s\S]*?<\/embed>/gi, '')
    .slice(0, 20000);
}

function normalizeEcommerceSuiteSkill(skill = {}, fallback = {}, index = 0) {
  const keyFallback = fallback.id || `skill-${index + 1}`;
  const id = cleanSettingKey(skill.id || skill.key || fallback.id, keyFallback);
  return {
    ...fallback,
    ...skill,
    id,
    name: String(skill.name || fallback.name || id).trim(),
    avatarUrl: String(skill.avatarUrl || skill.avatar || fallback.avatarUrl || '').trim(),
    description: String(skill.description || fallback.description || '').trim(),
    enabled: skill.enabled !== false,
    markdown: sanitizeSkillMarkdown(skill.markdown || skill.content || fallback.markdown || '')
  };
}

function normalizeEcommerceSuiteAgentConfig(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const storedSkills = Array.isArray(source.skills) ? source.skills : [];
  const skillById = new Map(storedSkills.map(item => [cleanSettingKey(item.id || item.key), item]));
  const defaultSkills = defaultEcommerceSuiteSkills.map((fallback, index) =>
    normalizeEcommerceSuiteSkill(skillById.get(fallback.id) || {}, fallback, index)
  );
  const extraSkills = storedSkills
    .filter(item => item && (item.id || item.key) && !defaultEcommerceSuiteSkills.some(fallback => fallback.id === cleanSettingKey(item.id || item.key)))
    .map((item, index) => normalizeEcommerceSuiteSkill(item, {}, defaultSkills.length + index));

  const defaults = source.defaults && typeof source.defaults === 'object' ? source.defaults : {};
  return {
    ...defaultEcommerceSuiteAgent,
    ...source,
    enabled: source.enabled !== false,
    sectionMode: 'dynamic',
    minSections: Math.max(1, Math.min(Number(source.minSections || defaultEcommerceSuiteAgent.minSections) || 3, 5)),
    maxSections: Math.max(3, Math.min(Number(source.maxSections || defaultEcommerceSuiteAgent.maxSections) || 5, 5)),
    defaultSkillId: cleanSettingKey(source.defaultSkillId || source.defaultDesignerId || defaultEcommerceSuiteAgent.defaultSkillId, defaultEcommerceSuiteAgent.defaultSkillId),
    defaults: {
      ...defaultEcommerceSuiteAgent.defaults,
      ...defaults,
      quality: String(defaults.quality || defaultEcommerceSuiteAgent.defaults.quality).toLowerCase(),
        imageCount: Math.max(1, Math.min(Number(defaults.imageCount || 1) || 1, 4))
      },
    sections: [],
    skills: [...defaultSkills, ...extraSkills]
  };
}

function normalizeAdminSettings(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  return {
    ...defaultAdminSettings,
    ...source,
    ecommerceSuiteAgent: normalizeEcommerceSuiteAgentConfig(source.ecommerceSuiteAgent)
  };
}

const routeState = () => ensureState('admin.apiProviders', RTS);
const saveRouteState = (routes) => writeState('admin.apiProviders', routes);
const userApiPreferenceState = () => ensureState('user.apiPreferences', {});
const saveUserApiPreferenceState = (value) => writeState('user.apiPreferences', value);
const templateWorkflowState = () => ensureState('admin.templateWorkflows', TMPL);
const saveTemplateWorkflowState = (value) => writeState('admin.templateWorkflows', value);
const settingsState = () => normalizeAdminSettings(ensureState('admin.settings', defaultAdminSettings));
const saveSettingsState = (value) => writeState('admin.settings', normalizeAdminSettings(value));
const modelPriceState = () => ensureState('admin.modelPrices', []);
const saveModelPriceState = (value) => writeState('admin.modelPrices', value);

function findRouteByAnyId(id) {
  const routes = routeState();
  return routes.find(r => [r.id, r.routeId, r.lineId, r.rk, r.routeKey, r.lineKey, r.code].includes(id)) || routes[0] || RTS[0];
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function integrationError(status, code, message, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function routeMatchesId(route = {}, id = '') {
  const requested = String(id || '').trim();
  return !!requested && [route.id, route.routeId, route.lineId, route.rk, route.routeKey, route.lineKey, route.code]
    .map(value => String(value || '').trim())
    .includes(requested);
}

function routeDisplayName(route = {}) {
  return String(route.displayName || route.dn || route.name || route.rk || route.routeKey || route.id || '默认线路').trim();
}

function routeIdOf(route = {}) {
  return String(route.id || route.routeId || route.lineId || '').trim();
}

function routeKeyOf(route = {}) {
  return String(route.rk || route.routeKey || route.lineKey || route.code || routeIdOf(route)).trim();
}

function officialRouteDefinition(route = {}) {
  const ids = [route.id, route.routeId, route.lineId, route.rk, route.routeKey, route.lineKey, route.code]
    .map(value => String(value || '').trim())
    .filter(Boolean);
  return RTS.find(item => ids.some(id => [item.id, item.rk].includes(id))) ||
    RTS.find(item => item.dm && item.dm === route.dm) ||
    null;
}

function applyTaskRoute(task, route = null) {
  if (!task || !route) return task;
  const routeId = routeIdOf(route);
  const routeKey = routeKeyOf(route);
  task.routeId = routeId;
  task.lineId = routeId;
  task.routeKey = routeKey;
  task.lineKey = routeKey;
  task.routeDisplayName = routeDisplayName(route);
  return task;
}

function shouldFallbackImageRoute(result = {}) {
  const text = [
    result.message,
    result.errorMessage,
    result.upstream?.error?.message,
    result.upstream?.message,
    result.request?.error?.message
  ].map(value => String(value || '')).join(' ');
  return /没有可用token|no\s+available\s+token|无可用渠道|no\s+available\s+channel/i.test(text);
}

function nextImageFallbackRoute(currentRoute = {}) {
  const currentIds = [currentRoute.id, currentRoute.routeId, currentRoute.lineId, currentRoute.rk, currentRoute.routeKey, currentRoute.lineKey, currentRoute.code]
    .map(value => String(value || '').trim())
    .filter(Boolean);
  return routeState().find(route => {
    if (routeKind(route) !== 'image') return false;
    if (route.enabled === false || route.status === 'disabled') return false;
    return !currentIds.some(id => routeMatchesId(route, id));
  }) || null;
}

function selectedImageRouteIdForUser(userId = '') {
  const preferences = userApiPreferenceState();
  const item = preferences && userId ? preferences[userId] : null;
  return String(item?.imageRouteId || item?.routeId || '').trim();
}

function saveUserImageRoutePreference(userId = '', route = null) {
  if (!userId || !route) return null;
  const preferences = userApiPreferenceState();
  const routeId = String(route.id || route.routeId || route.lineId || '').trim();
  const routeKey = String(route.rk || route.routeKey || route.lineKey || route.code || routeId).trim();
  preferences[userId] = {
    ...(preferences[userId] || {}),
    imageRouteId: routeId,
    imageRouteKey: routeKey,
    updatedAt: new Date().toISOString()
  };
  saveUserApiPreferenceState(preferences);
  return preferences[userId];
}

// ===================== PROVIDER ADAPTER =====================
function providerStatus() {
  const gateway = String(AI_PROVIDER_GATEWAY || 'new-api').toLowerCase();
  const baseUrl = gateway === 'new-api' ? NEW_API_BASE : AI_API_BASE;
  const textKey = gateway === 'new-api' ? NEW_API_KEY : AI_TEXT_KEY;
  const imageKey = gateway === 'new-api' ? (hasConfiguredSecret(NEW_API_KEY) ? NEW_API_KEY : AI_IMAGE_KEY) : AI_IMAGE_KEY;
  const enabled = ENABLE_REAL_AI && hasConfiguredSecret(textKey) && !!baseUrl;
  return {
    gateway,
    enabled,
    mode: enabled ? 'real-provider-ready' : 'mock',
    baseUrl,
    timeoutMs: PROVIDER_TIMEOUT_MS,
    imageTimeoutMs: IMAGE_PROVIDER_TIMEOUT_MS,
    textModel: AI_TEXT_MODEL,
    imageModel: AI_IMAGE_MODEL,
    textKeyConfigured: hasConfiguredSecret(textKey),
    imageKeyConfigured: hasConfiguredSecret(imageKey),
    routesThroughNewApi: gateway === 'new-api',
    cpaExpectedBehindNewApi: gateway === 'new-api'
  };
}

function secretLooksMasked(value = '') {
  return /\*{3,}|sk-local-\*+|env-\*+/i.test(String(value || ''));
}

function hasStoredSecret(value = '') {
  return hasConfiguredSecret(value) && !secretLooksMasked(value);
}

function normalizeSecretInput(value = '', previous = '') {
  const raw = String(value || '').trim();
  if (!raw || secretLooksMasked(raw)) return previous || '';
  return raw;
}

function maskSecret(value = '') {
  return hasStoredSecret(value) ? 'sk-local-********' : '';
}

function providerAuthKey(kind = 'text', route = null) {
  if (route && hasStoredSecret(route.apiKey)) return String(route.apiKey).trim();
  const status = providerStatus();
  if (status.gateway !== 'new-api') return kind === 'image' ? AI_IMAGE_KEY : AI_TEXT_KEY;
  if (hasConfiguredSecret(NEW_API_KEY)) return NEW_API_KEY;
  return kind === 'image' ? AI_IMAGE_KEY : AI_TEXT_KEY;
}

function routeProviderStatus(route = {}, kind = 'text') {
  const status = providerStatus();
  const routeBaseUrl = String(route.baseUrl || route.apiBase || '').trim();
  const baseUrl = routeBaseUrl || status.baseUrl;
  const key = providerAuthKey(kind, route);
  const keyConfigured = hasConfiguredSecret(key);
  const enabled = ENABLE_REAL_AI && keyConfigured && !!baseUrl;
  return {
    ...status,
    baseUrl,
    timeoutMs: positiveNumber(route.timeoutMs, status.timeoutMs),
    imageTimeoutMs: positiveNumber(route.imageTimeoutMs || route.timeoutMs, status.imageTimeoutMs),
    enabled,
    mode: enabled ? 'real-provider-ready' : 'mock',
    textKeyConfigured: kind === 'text' ? keyConfigured : status.textKeyConfigured,
    imageKeyConfigured: kind === 'image' ? keyConfigured : status.imageKeyConfigured,
    routeKeyConfigured: hasStoredSecret(route.apiKey),
    routeBaseUrlConfigured: !!routeBaseUrl
  };
}

function joinProviderUrl(baseUrl = '', endpoint = '') {
  const rawEndpoint = String(endpoint || '').trim();
  if (/^https?:\/\//i.test(rawEndpoint)) return rawEndpoint;
  const base = String(baseUrl || '').trim().replace(/\/$/, '');
  let path = rawEndpoint || '/responses';
  if (!path.startsWith('/')) path = `/${path}`;
  if (base.endsWith('/v1') && path.startsWith('/v1/')) path = path.slice(3);
  return `${base}${path}`;
}

function routeTextEndpoint(route = {}) {
  const candidates = [route.chatEndpoint, route.endpoint, route.requestPath].filter(Boolean);
  return candidates.find(value => /\/responses\b/i.test(String(value))) || '/responses';
}

function routeTextChatEndpoint(route = {}) {
  const candidates = [route.chatEndpoint, route.endpoint, route.requestPath].filter(Boolean);
  return candidates.find(value => /\/chat\/completions\b/i.test(String(value))) || '/chat/completions';
}

function isResponsesTextRoute(route = {}) {
  const descriptor = [route.requestFormat, route.apiFormat, route.chatEndpoint, route.endpoint, route.requestPath]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return descriptor.includes('responses') && !descriptor.includes('chat/completions');
}

function isLingsuanImagesRoute(route = {}) {
  return [route.apiFormat, route.requestFormat]
    .filter(Boolean)
    .some(value => String(value).trim().toLowerCase() === LINGSUAN_IMAGES_API_FORMAT);
}

function isPackyImagesRoute(route = {}) {
  return [route.apiFormat, route.requestFormat]
    .filter(Boolean)
    .some(value => String(value).trim().toLowerCase() === PACKY_IMAGES_API_FORMAT);
}

function providerImageTimeoutMs(route = {}, status = {}) {
  if (isPackyImagesRoute(route)) return PACKY_IMAGE_PROVIDER_TIMEOUT_MS;
  return positiveNumber(status.imageTimeoutMs || status.timeoutMs, IMAGE_PROVIDER_TIMEOUT_MS);
}

function providerImageAcceptHeader(route = {}, responseMode = {}) {
  if (isLingsuanImagesRoute(route)) return 'application/json';
  return responseMode.stream ? 'text/event-stream, application/json' : '*/*';
}

function routeImageGenerationEndpoint(route = {}) {
  if (isLingsuanImagesRoute(route) || isPackyImagesRoute(route)) return '/v1/images/generations';
  const candidates = [route.imageGenerationEndpoint, route.generationEndpoint, route.imageEndpoint, route.endpoint, route.requestPath].filter(Boolean);
  const generation = candidates.find(value => /\/images\/generations\b/i.test(String(value)));
  if (generation) return generation;
  return '/v1/images/generations';
}

function routeImageEditEndpoint(route = {}) {
  if (isLingsuanImagesRoute(route) || isPackyImagesRoute(route)) return '/v1/images/edits';
  const candidates = [route.imageEditEndpoint, route.editEndpoint, route.imageEndpoint, route.endpoint, route.requestPath].filter(Boolean);
  return candidates.find(value => /\/images\/edits\b/i.test(String(value))) || '/v1/images/edits';
}

function providerImageRequestSize(options = {}, sizeTierValue = '') {
  const ratio = normalizeImageRatio(options.ratio || options.aspectRatio, '');
  return providerImageSize(ratio || options.size || '1:1', sizeTierValue);
}

function imageProviderFailureDomain(route = {}) {
  const status = routeProviderStatus(route, 'image');
  let hostname = 'provider-default';
  try {
    hostname = new URL(String(status.baseUrl || '')).hostname.toLowerCase() || hostname;
  } catch {}
  const format = String(route.apiFormat || route.requestFormat || 'openai-images').trim().toLowerCase();
  return `${hostname}|${format}`;
}

const ECOMMERCE_IMAGE_SYSTEM_PROMPT = [
  '你是一名专业电商设计师。',
  '保持产品比例自然，不要拉伸或变形。',
  '文字清晰，不要出现光斑和乱码。'
].join('\n');

function promptReferenceCount(options = {}) {
  const explicit = Number(options.referenceCount || options.referenceImageCount || 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(explicit, 16);
  const body = options.body || options;
  try {
    const count = imageReferenceCandidates(body).length;
    if (count > 0) return Math.min(count, 16);
  } catch {}
  return options.hasReferenceImages ? 1 : 0;
}

function extractPromptImageRoleHints(userPrompt = '') {
  const raw = String(userPrompt || '');
  const matches = raw.match(/图\d+[^，。；;,\n]*/g) || [];
  return Array.from(new Set(matches.map(item => item.trim()).filter(Boolean))).slice(0, 10);
}

function detectEcommercePromptTask(userPrompt = '', options = {}) {
  const text = String(userPrompt || '');
  const referenceCount = promptReferenceCount(options);
  if (/贴标|贴纸|标签|瓶贴|贴上|贴到|包装样机|样机/.test(text)) return '贴标/包装样机生成';
  if (referenceCount > 1 && /排版|构图|风格|配色|桌子|背景|道具|参考图|图\d+/.test(text)) return '多图参考电商主图生成';
  if (/背景|场景|白底|居家|室内|户外|换景/.test(text)) return '背景替换/场景优化';
  if (/局部|涂抹|mask|消除|擦除|去掉|移除|修复/.test(text)) return '局部修改';
  if (/替换|换成|改为|改成|变成/.test(text)) return '元素替换/图片编辑';
  return referenceCount > 0 ? '参考图编辑/电商图片生成' : '电商图片生成';
}

function ecommercePromptReferenceRoleText(userPrompt = '', options = {}) {
  const referenceCount = promptReferenceCount(options);
  if (!referenceCount) return '本次未提供参考图，根据用户需求生成电商图片。';
  const hints = extractPromptImageRoleHints(userPrompt);
  if (hints.length) {
    return [
      `共 ${referenceCount} 张参考图。请严格按用户原文指定理解各图作用：${hints.join('；')}。`,
      '排版参考只提供构图和画面层级，风格参考只提供氛围和质感，配色参考只提供色彩方向，桌子/背景/道具参考只提供对应元素，产品图才作为最终主商品来源。不要让不同参考图的角色互相污染。'
    ].join('');
  }
  return [
    `共 ${referenceCount} 张参考图。默认图1为待编辑原图或主要参考图，其余图片作为辅助参考。`,
    '如果用户在需求中指定了产品、排版、风格、配色、桌子、背景或道具来源，请按用户指定优先执行。'
  ].join('');
}

function aspectLabelFromSize(size = '') {
  const match = String(size || '').match(/^(\d+)x(\d+)$/);
  if (!match) return '目标比例';
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return '目标比例';
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function ecommercePromptOutputCanvasText(options = {}) {
  const body = options.body && typeof options.body === 'object' ? options.body : {};
  const ratioValue = options.size || options.ratio || options.aspectRatio || body.size || body.ratio || body.aspectRatio || '1:1';
  const sizeTier = options.sizeTier || options.resolution || options.clarity || options.quality || body.sizeTier || body.resolution || body.clarity || body.quality;
  const outputSize = providerImageSize(ratioValue, sizeTier);
  const aspectLabel = aspectLabelFromSize(outputSize);
  if (outputSize === 'auto') {
    return '输出画布要求：最终图片必须按用户选择的目标比例生成，不要沿用参考图原始宽高比例；需要时用干净背景、留白或场景扩展适配画布，保持商品自身比例自然。';
  }
  return `输出画布要求：最终图片必须是 ${aspectLabel} 画布，目标尺寸 ${outputSize}。不要沿用参考图原始宽高比例；需要时用干净背景、留白或场景扩展适配画布，保持商品自身比例自然。`;
}

function buildEcommerceImagePrompt(userPrompt = '', options = {}) {
  const prompt = String(userPrompt || '').trim();
  const referenceCount = promptReferenceCount(options);
  if (!referenceCount) {
    return [
      ECOMMERCE_IMAGE_SYSTEM_PROMPT,
      `用户需求：${prompt || '生成一张图片'}`
    ].filter(Boolean).join('\n');
  }
  const taskType = detectEcommercePromptTask(prompt, options);
  return [
    '你是电商图片 Prompt Planner，请把用户的简短图生图需求整理成图像模型容易执行的最终提示词。',
    `任务类型：${taskType}。`,
    `参考图作用：${ecommercePromptReferenceRoleText(prompt, { ...options, referenceCount })}`,
    `生成要求：${prompt || '生成一张适合电商展示的高质量图片。'}`,
    '保持重点：优先保证最终主商品清晰、稳定、可识别；商品基本形状、比例、结构、材质、Logo、标签和关键文字尽量保持准确。用户明确要求修改的内容按用户要求执行。',
    '允许发挥：可以根据电商主图效果自然优化背景、桌面、道具、光影、空间层次、质感和画面高级感，但不要抢走商品主体注意力。',
    '避免问题：不要把排版图、风格图、配色图、背景图里的无关商品或文字混进最终画面；不要新增无关文字、水印、二维码；不要出现乱码、明显变形、错误透视、模糊边缘或主体混乱。',
    ecommercePromptOutputCanvasText(options),
    '输出要求：画面真实自然，主体边缘干净，产品比例自然，适合电商主图或详情页展示。'
  ].filter(Boolean).join('\n');
}

function buildImageGenerateNodePrompt(userPrompt = '', options = {}) {
  const prompt = String(userPrompt || '').trim();
  if (prompt) return prompt;
  return promptReferenceCount(options) > 0 ? '根据参考图生成图片' : '生成图片';
}

function resolveTextRoute(body = {}) {
  const requested = String(body.textRouteId || body.languageRouteId || body.routeId || body.lineId || body.routeKey || body.lineKey || '').trim();
  const routes = routeState();
  const textRoutes = routes.filter(route => routeKind(route) === 'text');
  if (requested) {
    const found = routes.find(route => [route.id, route.routeId, route.lineId, route.rk, route.routeKey, route.lineKey, route.code].includes(requested));
    if (found && routeKind(found) === 'text') return found;
  }
  return textRoutes.find(route => route.def || route.isDefault) || textRoutes[0] || RTS.find(route => route.cat === 'text') || RTS[1];
}

function resolveImageRoute(body = {}, userId = '') {
  const requested = String(
    body.imageRouteId || body.imageLineId || body.imageRouteKey || body.imageLineKey ||
    body.routeId || body.lineId || body.routeKey || body.lineKey ||
    selectedImageRouteIdForUser(userId) ||
    ''
  ).trim();
  const routes = routeState();
  const imageRoutes = routes.filter(route => routeKind(route) === 'image');
  if (requested) {
    const found = routes.find(route => routeMatchesId(route, requested));
    if (found && routeKind(found) === 'image') return found;
  }
  return imageRoutes.find(route => route.def || route.isDefault) || imageRoutes[0] || RTS.find(route => route.cat === 'image') || RTS[0];
}

function canvasPromptImageLabel(index) {
  return `图${index + 1}`;
}

function modelCost(modelKey = '', kind = 'image') {
  const fallback = kind === 'text' ? 5 : 15;
  const key = String(modelKey || '').trim();
  const priced = findPricedModel(key, kind);
  if (priced) {
    const value = Number(priced.pricePoints ?? priced.pointCost ?? priced.price ?? priced.baseCredits);
    if (Number.isFinite(value)) return value;
  }
  const list = kind === 'text' ? TXT : IMG;
  const found = list.find(item => item.k === key || item.n === key) || list[0];
  return found ? found.p : fallback;
}

function parseJsonObjectFromText(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const candidates = [
    raw,
    raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
  ];
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(raw.slice(start, end + 1));
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < raw.length; j += 1) {
      const char = raw[j];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          candidates.push(raw.slice(i, j + 1));
          break;
        }
      }
    }
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return null;
}

function summarizeText(text = '', max = 160) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

async function canvasDialogReferencesForAnalysis(body = {}, req) {
  const references = imageReferenceCandidates(body).slice(0, 8);
  const result = [];
  for (let index = 0; index < references.length; index += 1) {
    const file = await loadReferenceImageFile(references[index], req);
    result.push({
      label: canvasPromptImageLabel(index),
      dataUrl: `data:${file.mime};base64,${file.buffer.toString('base64')}`,
      mime: file.mime,
      fileName: file.fileName
    });
  }
  return result;
}

function buildCanvasDialogAgentInput(requirement = '', references = []) {
  const referenceRules = references.length
    ? [
      '模仿规则：参考图是允许模仿的对象。用户要求复刻时，可以照抄参考图的构图、光影、配色、排版、场景、道具和卖点表达；图生图时必须保留用户产品图上的产品主体外观，只把参考图的风格和结构迁移过来。',
      '用途方向：根据用户需求判断，常见方向包括——主图复刻（照参考图的结构和卖点层级）、副图复刻（逐张对应参考图）、详情页复刻（按参考图的分镜和模块）、白底图（产品主体不变、背景干净）、场景风格（学习参考图的光影氛围）。',
      '分析要求：识别用户指定的图序角色，例如排版、构图、风格、配色、桌子、背景、道具、产品、标签、文案等来源。',
      '生成要求：最终提示词要说明每张参考图只承担用户指定的作用；不要让排版图、风格图、配色图、背景图里的无关商品或文字混进最终画面。',
      '保持规则：最终主商品以用户指定的产品图或待编辑原图为准，商品外观、包装结构、品牌/Logo、标签、关键文字、比例和材质尽量稳定；用户明确要求修改的内容按用户要求执行。',
      '发挥规则：背景、桌面、道具、氛围、光影、空间层次和画面高级感可以合理优化，但不能遮挡商品、改变商品识别或喧宾夺主。'
    ]
    : [
      '模仿规则：如果用户提供参考图并要求模仿，允许复刻参考图的构图、光影、配色、排版和风格；没有参考图时按用户文字需求生成。',
      '分析要求：识别参考图中的产品主体、包装结构、品牌/Logo/产品名、关键文字、颜色、材质、构图、背景和风格。',
      '生成要求：保持产品外观、包装结构、品牌识别、颜色和关键文字一致；只根据用户需求调整标签设计、背景、构图、光影和电商表现。'
    ];
  const text = [
    '你是电商视觉 Agent，请先分析用户上传的参考图和需求，再给图片生成模型输出最终提示词。',
    '必须输出 JSON 对象，不要 Markdown，不要额外解释。',
    'JSON 字段：analysisSummary（给用户看的简短中文分析，80-160字）、finalPrompt（交给 GPT Image 2 的完整中文生图提示词）。',
    ...referenceRules,
    '合规要求：不要虚构价格、认证、功效、活动标签和不存在的文字；不要生成水印、二维码、乱码文字、畸形产品或多余主体。',
    references.length ? `参考图顺序：${references.map(item => item.label).join('、')}` : '参考图顺序：无。',
    `用户需求：${requirement || '生成一张高质量电商产品图片。'}`
  ].join('\n');
  if (!references.length) return text;
  return [{
    role: 'user',
    content: [
      { type: 'input_text', text },
      ...references.map(item => ({
        type: 'input_image',
        image_url: item.dataUrl
      }))
    ]
  }];
}

function mockCanvasDialogAgentPlan(requirement = '', referenceCount = 0) {
  const target = requirement || '生成一张高质量电商产品图片';
  const imageLine = referenceCount > 0
    ? `已分析 ${referenceCount} 张参考图，将按用户指定的图序角色使用参考图，并优先保持最终主商品清晰稳定。`
    : '未提供参考图，将按用户需求构建清晰的电商产品画面。';
  return {
    analysisSummary: `${imageLine} 生成结果会优先保证主体清晰、商业摄影质感和电商转化表现。`,
    finalPrompt: buildEcommerceImagePrompt(target, { hasReferenceImages: referenceCount > 0, referenceCount })
  };
}

function parseCanvasDialogAgentPlan(providerResult = {}, requirement = '', referenceCount = 0) {
  const text = imageToolOutputText(providerResult);
  const parsed = parseJsonObjectFromText(text);
  const finalPrompt = String(parsed?.finalPrompt || parsed?.prompt || parsed?.imagePrompt || text || '').trim();
  const analysisSummary = String(parsed?.analysisSummary || parsed?.summary || parsed?.analysis || summarizeText(finalPrompt, 160)).trim();
  if (!finalPrompt) return null;
  return {
    analysisSummary: analysisSummary || mockCanvasDialogAgentPlan(requirement, referenceCount).analysisSummary,
    finalPrompt
  };
}

function firstString(...values) {
  return values.find(value => typeof value === 'string' && value.trim()) || '';
}

function imageReferenceCandidates(body = {}) {
  const buckets = [body.referenceImages, body.reference_images, body.images, body.imageUrls, body.image_urls]
    .filter(Array.isArray);
  const list = buckets.flat();
  [body.image, body.imageUrl, body.image_url, body.originalUrl, body.original_url, body.referenceImage, body.reference_image]
    .filter(Boolean)
    .forEach(item => list.push(item));
  return list
    .map((item) => {
      if (typeof item === 'string') return { url: item };
      if (!item || typeof item !== 'object') return null;
      return {
        url: firstString(item.url, item.imageUrl, item.image_url, item.originalUrl, item.original_url, item.preview, item.src),
        dataUrl: firstString(item.dataUrl, item.data_url, item.base64, item.b64_json, item.b64Json),
        localPath: firstString(item.localPath, item.local_path),
        fileName: firstString(item.fileName, item.filename, item.name, item.title),
        mimeType: firstString(item.mimeType, item.mime, item.type)
      };
    })
    .filter(item => item && (item.url || item.dataUrl || item.localPath));
}

function localRequestOrigin(req) {
  if (!req || !req.headers || typeof req.get !== 'function') return `http://127.0.0.1:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${protocol}://${req.get('host') || `127.0.0.1:${PORT}`}`;
}

function resolveReferenceUrl(rawUrl = '', req) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (/^data:image\//i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${localRequestOrigin(req)}${value}`;
  return value;
}

async function loadReferenceImageFile(reference = {}, req) {
  const localPath = String(reference.localPath || reference.local_path || '').trim();
  if (localPath) {
    const resolvedPath = path.resolve(localPath);
    const relative = path.relative(GENERATION_TASK_INPUT_DIR, resolvedPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      const error = new Error('参考图任务文件路径越界');
      error.code = 'GENERATION_REFERENCE_PATH_INVALID';
      throw error;
    }
    if (!fs.existsSync(resolvedPath)) {
      const error = new Error('参考图任务文件不存在');
      error.code = 'GENERATION_REFERENCE_FILE_MISSING';
      throw error;
    }
    const buffer = await fs.promises.readFile(resolvedPath);
    const mime = providerImageMime(buffer, reference.mimeType);
    return {
      buffer,
      mime,
      fileName: reference.fileName || `${path.basename(resolvedPath)}.${providerImageExt(mime)}`
    };
  }

  const dataUrl = String(reference.dataUrl || '').trim();
  if (/^data:image\//i.test(dataUrl)) {
    const match = dataUrl.match(/^data:(image\/[^;,]+)[^,]*,(.*)$/i);
    if (!match) throw new Error('参考图 data URL 无效');
    const buffer = Buffer.from(match[2], 'base64');
    const mime = providerImageMime(buffer, match[1]);
    return { buffer, mime, fileName: reference.fileName || `reference.${providerImageExt(mime)}` };
  }

  const rawUrl = String(reference.url || '').trim();
  if (/^data:image\//i.test(rawUrl)) {
    return loadReferenceImageFile({ ...reference, dataUrl: rawUrl, url: '' }, req);
  }
  if (/^\/uploads\/[^/?#]+/i.test(rawUrl)) {
    const fileName = path.basename(rawUrl.split(/[?#]/)[0]);
    const filePath = path.join(uploadDir, fileName);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const mime = providerImageMime(buffer, reference.mimeType);
      return { buffer, mime, fileName: reference.fileName || `${fileName}.${providerImageExt(mime)}` };
    }
  }

  const resolvedUrl = resolveReferenceUrl(rawUrl, req);
  if (!resolvedUrl) throw new Error('参考图地址为空');
  if (!/^https?:\/\//i.test(resolvedUrl)) {
    throw generationInputError(
      400,
      'GENERATION_REFERENCE_BLOB_URL_UNSUPPORTED',
      /^blob:/i.test(resolvedUrl)
        ? '参考图片仍是浏览器临时地址，请等待上传完成后重试'
        : '参考图地址仅支持 data URL、站内路径或 HTTP(S) URL'
    );
  }
  const resp = await fetch(resolvedUrl);
  if (!resp.ok) throw new Error(`参考图读取失败: ${resp.status}`);
  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mime = providerImageMime(buffer, resp.headers.get('content-type') || reference.mimeType);
  return { buffer, mime, fileName: reference.fileName || `reference.${providerImageExt(mime)}` };
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (key === 'clientRequestId' || key === 'idempotencyKey') return result;
    result[key] = stableJsonValue(value[key]);
    return result;
  }, {});
}

function generationRequestHash(body = {}) {
  return crypto.createHash('sha256').update(JSON.stringify(stableJsonValue(body))).digest('hex');
}

function scrubGenerationRequestValue(value, key = '') {
  if (/api.?key|authorization|secret|token|password/i.test(key)) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => scrubGenerationRequestValue(item)).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== 'object') return value;
  return Object.entries(value).reduce((result, [childKey, childValue]) => {
    const scrubbed = scrubGenerationRequestValue(childValue, childKey);
    if (scrubbed !== undefined) result[childKey] = scrubbed;
    return result;
  }, {});
}

function generationInputError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

// 参考图超限自动压缩：目标刚好低于上限（默认 5MB 的 99%），先降质量再缩尺寸，尽量少压。
async function compressImageToLimit(buffer, mime, limitBytes) {
  if (buffer.length <= limitBytes) return { buffer, mime, compressed: false };
  const target = Math.floor(limitBytes * 0.99);
  const source = sharp(buffer, { failOn: 'none' });
  const meta = await source.metadata().catch(() => ({}));
  const hasAlpha = meta.hasAlpha === true;
  const preferJpeg = !hasAlpha; // 无透明通道的 PNG 转 JPEG 体积收益最大
  const attempts = preferJpeg
    ? [98, 95, 92, 88, 82, 74, 64].map((quality) => ({ format: 'jpeg', quality }))
    : [9, 8, 7, 6].map((level) => ({ format: 'png', compressionLevel: level }));
  let width = meta.width || 0;
  for (const attempt of attempts) {
    for (const scale of [1, 0.85, 0.7, 0.55]) {
      const resizeWidth = width && scale < 1 ? Math.max(64, Math.round(width * scale)) : undefined;
      let pipeline = sharp(buffer, { failOn: 'none' });
      if (resizeWidth) pipeline = pipeline.resize({ width: resizeWidth, withoutEnlargement: true });
      const out = attempt.format === 'jpeg'
        ? await pipeline.jpeg({ quality: attempt.quality, mozjpeg: true }).toBuffer().catch(() => null)
        : await pipeline.png({ compressionLevel: attempt.compressionLevel }).toBuffer().catch(() => null);
      if (out && out.length <= target) {
        return { buffer: out, mime: attempt.format === 'jpeg' ? 'image/jpeg' : 'image/png', compressed: true };
      }
    }
  }
  throw generationInputError(413, 'GENERATION_REFERENCE_IMAGE_TOO_LARGE', '参考图过大且自动压缩失败，请手动压缩后重试');
}

function generationTaskInputDirectory(taskId) {
  const target = path.resolve(GENERATION_TASK_INPUT_DIR, String(taskId || ''));
  const relative = path.relative(GENERATION_TASK_INPUT_DIR, target);
  if (!taskId || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw generationInputError(400, 'GENERATION_TASK_PATH_INVALID', '生图任务目录无效');
  }
  return target;
}

async function removeGenerationTaskInputs(taskId) {
  const target = generationTaskInputDirectory(taskId);
  await fs.promises.rm(target, { recursive: true, force: true });
}

async function stageGenerationTaskBody(body = {}, taskId, req) {
  const references = imageReferenceCandidates(body);
  if (references.length > GENERATION_MAX_REFERENCE_COUNT) {
    throw generationInputError(
      413,
      'GENERATION_REFERENCE_COUNT_EXCEEDED',
      `每个任务最多上传 ${GENERATION_MAX_REFERENCE_COUNT} 张参考图`
    );
  }
  const taskDirectory = generationTaskInputDirectory(taskId);
  await fs.promises.mkdir(taskDirectory, { recursive: true });
  const stagedReferences = [];
  let totalBytes = 0;
  try {
    for (let index = 0; index < references.length; index += 1) {
      let file = await loadReferenceImageFile(references[index], req);
      if (file.buffer.length > GENERATION_MAX_REFERENCE_BYTES) {
        const compressed = await compressImageToLimit(file.buffer, file.mime, GENERATION_MAX_REFERENCE_BYTES);
        file = { ...file, buffer: compressed.buffer, mime: compressed.mime };
        console.log(`[REFERENCE_COMPRESS] 第 ${index + 1} 张参考图超限，已自动压缩到 ${(compressed.buffer.length / 1024 / 1024).toFixed(2)}MB`);
      }
      totalBytes += file.buffer.length;
      if (totalBytes > GENERATION_MAX_REFERENCE_TOTAL_BYTES) {
        throw generationInputError(
          413,
          'GENERATION_REFERENCE_TOTAL_TOO_LARGE',
          '参考图合计大小超过 16MB，请减少图片或压缩后重试'
        );
      }
      const mime = providerImageMime(file.buffer, file.mime);
      const fileName = `reference-${index + 1}.${providerImageExt(mime)}`;
      const localPath = path.join(taskDirectory, fileName);
      await fs.promises.writeFile(localPath, file.buffer);
      stagedReferences.push({ localPath, fileName, mimeType: mime });
    }

    const maskSource = body.mask || body.maskUrl || body.mask_url || body.maskAlphaBase64 || body.maskBase64 || '';
    let stagedMask = null;
    if (maskSource) {
      const maskReference = maskSource && typeof maskSource === 'object'
        ? maskSource
        : { url: maskSource, dataUrl: maskSource };
      let maskFile = await loadReferenceImageFile(maskReference, req);
      if (maskFile.buffer.length > GENERATION_MAX_REFERENCE_BYTES) {
        const compressedMask = await compressImageToLimit(maskFile.buffer, maskFile.mime, GENERATION_MAX_REFERENCE_BYTES);
        maskFile = { ...maskFile, buffer: compressedMask.buffer, mime: compressedMask.mime };
      }
      const mime = providerImageMime(maskFile.buffer, maskFile.mime);
      const fileName = `mask.${providerImageExt(mime)}`;
      const localPath = path.join(taskDirectory, fileName);
      await fs.promises.writeFile(localPath, maskFile.buffer);
      stagedMask = { localPath, fileName, mimeType: mime };
    }

    const stagedBody = scrubGenerationRequestValue({ ...body });
    [
      'referenceImages', 'reference_images', 'images', 'imageUrls', 'image_urls',
      'image', 'imageUrl', 'image_url', 'originalUrl', 'original_url', 'referenceImage', 'reference_image',
      'mask', 'maskUrl', 'mask_url', 'maskAlphaBase64', 'maskBase64'
    ].forEach((key) => delete stagedBody[key]);
    if (stagedReferences.length) stagedBody.referenceImages = stagedReferences;
    if (stagedMask) stagedBody.mask = stagedMask;
    return {
      body: stagedBody,
      requestMeta: {
        referenceImageCount: stagedReferences.length,
        referenceImageBytes: stagedReferences.map((reference, index) => ({
          index,
          bytes: fs.statSync(reference.localPath).size,
          mime: reference.mimeType
        })),
        referenceImageTotalBytes: totalBytes,
        hasMask: !!stagedMask
      }
    };
  } catch (error) {
    await fs.promises.rm(taskDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function cleanupExpiredGenerationTaskInputs() {
  const entries = await fs.promises.readdir(GENERATION_TASK_INPUT_DIR, { withFileTypes: true });
  const cutoff = Date.now() - GENERATION_INPUT_RETENTION_MS;
  await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const target = generationTaskInputDirectory(entry.name);
    const stat = await fs.promises.stat(target);
    if (stat.mtimeMs >= cutoff) return;
    const task = generationTaskRepository.getTask(entry.name);
    if (task && ['pending', 'running'].includes(task.status)) return;
    await fs.promises.rm(target, { recursive: true, force: true });
  }));
}

const reserveChatCharge = db.transaction((requestId, user, model, stepHash, allowContinuation) => {
  const existing = db.prepare('SELECT * FROM chat_text_charges WHERE request_id=?').get(requestId);
  if (existing) {
    const step = db.prepare('SELECT * FROM chat_text_steps WHERE request_id=? AND step_hash=?').get(requestId, stepHash);
    if (step) return { duplicate: true, charge: existing, step };
    if (existing.user_id !== user.id || existing.model_key !== model.k) {
      throw integrationError(409, 'CHAT_REQUEST_ID_CONFLICT', '消息标识与原请求不一致，请发送一条新消息');
    }
    if (existing.status === 'refunded' || !allowContinuation) {
      return { duplicate: true, charge: existing };
    }
    const now = Date.now();
    db.prepare('INSERT INTO chat_text_steps (request_id,step_hash,status,created_at,updated_at) VALUES (?,?,?,?,?)')
      .run(requestId, stepHash, 'reserved', now, now);
    if (existing.status === 'completed') {
      db.prepare("UPDATE chat_text_charges SET status='reserved', updated_at=? WHERE request_id=? AND status='completed'")
        .run(now, requestId);
    }
    return { duplicate: false, continuation: true, charge: { ...existing, status: 'reserved' } };
  }
  const cost = Number(model.p || 0);
  const current = db.prepare('SELECT balance FROM users WHERE id=?').get(user.id);
  const before = Number(current?.balance ?? 0);
  if (before < cost) {
    throw integrationError(400, 'INSUFFICIENT_BALANCE', `算力不足，需要 ${cost}，当前 ${before}`, { cost, balance: before });
  }
  const after = before - cost;
  const updated = db.prepare('UPDATE users SET balance=? WHERE id=? AND balance=?').run(after, user.id, before);
  if (updated.changes !== 1) {
    throw integrationError(409, 'BALANCE_CHANGED', '余额状态已变化，请重试');
  }
  const now = Date.now();
  db.prepare('INSERT INTO chat_text_charges (request_id,user_id,model_key,cost,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(requestId, user.id, model.k, cost, 'reserved', now, now);
  db.prepare('INSERT INTO chat_text_steps (request_id,step_hash,status,created_at,updated_at) VALUES (?,?,?,?,?)')
    .run(requestId, stepHash, 'reserved', now, now);
  balanceService.recordBalanceLog(user.id, 'chat', -cost, before, after, `AI 对话: ${model.k}`);
  return { duplicate: false, charge: { request_id: requestId, user_id: user.id, model_key: model.k, cost, status: 'reserved' } };
});

const completeChatStep = db.transaction((requestId, stepHash, awaitingToolResult = false) => {
  const now = Date.now();
  db.prepare("UPDATE chat_text_steps SET status='completed', updated_at=? WHERE request_id=? AND step_hash=? AND status='reserved'")
    .run(now, requestId, stepHash);
  if (!awaitingToolResult) {
    db.prepare("UPDATE chat_text_charges SET status='completed', updated_at=? WHERE request_id=? AND status='reserved'")
      .run(now, requestId);
  }
});

const refundChatCharge = db.transaction((requestId, reason = '上游调用失败', stepHash = '') => {
  const charge = db.prepare("SELECT * FROM chat_text_charges WHERE request_id=? AND status='reserved'").get(requestId);
  if (!charge) return false;
  const user = db.prepare('SELECT balance FROM users WHERE id=?').get(charge.user_id);
  if (!user) return false;
  const before = Number(user.balance || 0);
  const after = before + Number(charge.cost || 0);
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(after, charge.user_id);
  db.prepare("UPDATE chat_text_charges SET status='refunded', updated_at=? WHERE request_id=?")
    .run(Date.now(), requestId);
  if (stepHash) {
    db.prepare("UPDATE chat_text_steps SET status='refunded', updated_at=? WHERE request_id=? AND step_hash=? AND status='reserved'")
      .run(Date.now(), requestId, stepHash);
  } else {
    db.prepare("UPDATE chat_text_steps SET status='refunded', updated_at=? WHERE request_id=? AND status='reserved'")
      .run(Date.now(), requestId);
  }
  balanceService.recordBalanceLog(charge.user_id, 'chat_refund', Number(charge.cost || 0), before, after, `AI 对话退款: ${reason}`);
  return true;
});

const CANVAS_PROMPT_ENHANCE_MAX_REFERENCES = 4;
const CANVAS_PROMPT_ENHANCE_MIN_LENGTH = 160;
const canvasPromptEnhanceInFlight = new Set();

function buildCanvasPromptEnhancementSystemPrompt(referenceCount = 0) {
  const labels = Array.from({ length: referenceCount }, (_, index) => canvasPromptImageLabel(index));
  return [
    '你是专业的图像生成与图像编辑提示词编排器。你的任务是准确理解用户目标和参考图，而不是脱离需求自由创作。',
    '先在内部判断任务类型、每张参考图的角色、允许修改范围、必须保持内容和冲突优先级，但不要输出分析过程。',
    '优先级：用户明确要求 > 用户明确锁定内容 > 主体或产品参考 > 构图版式参考 > 场景背景参考 > 风格参考 > 默认审美优化。',
    '严格区分参考图角色：主体/产品图用于锁定身份和关键结构；版式图只参考位置、留白和层级；风格图只参考色彩、光影、材质和氛围；不得把不同参考图中的品牌、商品、人物或文字混在一起。',
    '只把会改变主体身份、产品结构、人物身份、Logo、标签和指定文字的内容写成硬性锁定；背景、道具、空间层次、镜头、光影和材质表现可以在不违背用户要求时合理优化。',
    '用户指定的文字必须原样保留，不润色、不缩写、不增删；不要虚构价格、功效、认证、促销、品牌、Logo、二维码或不存在的文案。',
    '局部编辑要明确编辑区域，并要求未授权区域保持不变；自然衔接原图透视、光线、色温、景深、阴影和环境反射。',
    '最终提示词必须明确写出：任务目标、每张参考图的用途、主体和关键识别、允许修改内容、构图与镜头、场景与背景、光影与色温、材质与细节、文字规则、成像质量和必要负面约束。',
    '成像质量要使用可执行描述，例如焦点准确、边缘干净、微观材质清楚、曝光受控、自然高光、真实阴影、无压缩糊感；不要只堆砌“8K、超清、大师级”等空泛词。',
    '目标长度约 500–900 个中文字符；信息不足时可以更短，但必须比原提示词更完整且不添加未经授权的核心内容。',
    '只输出一段可直接提交给图片模型的最终中文提示词正文，不要标题、解释、编号、Markdown 或前后寒暄。',
    referenceCount > 0 ? `参考图按顺序为：${labels.join('、')}。必须按用户描述确定各图角色。` : '本次没有参考图，只扩写用户提供的文字需求。'
  ].join('\n');
}

function buildCanvasPromptEnhancementFallback(prompt = '', referenceCount = 0) {
  const requirement = String(prompt || '').trim() || '生成一张高质量电商产品图片';
  return [
    referenceCount > 0
      ? `参考图按顺序为：${Array.from({ length: referenceCount }, (_, index) => canvasPromptImageLabel(index)).join('、')}；严格按照用户描述分配产品、主体、构图、场景和风格角色，不混用参考图中的商品、品牌或文字。`
      : '本次没有参考图，以用户文字需求为唯一创作依据。',
    `任务目标：${requirement}。`,
    '主体保持清晰、比例准确、结构完整，产品或人物的关键识别特征稳定；仅调整用户授权的内容。构图层级明确，焦点落在核心主体，背景与道具服务主体且不喧宾夺主。光线方向统一，曝光受控，高光不过曝，阴影真实落地，材质纹理、边缘和环境反射自然。画面焦点准确、细节清楚、色彩干净、无压缩糊感，避免主体变形、比例错误、边缘光晕、廉价 CG 感、乱码、水印、二维码和多余主体。'
  ].join('\n');
}

function normalizeCanvasEnhancedPrompt(value = '') {
  return String(value || '')
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/^(?:最终)?(?:生图)?提示词\s*[:：]\s*/i, '')
    .trim()
    .slice(0, 12000);
}

async function loadCanvasPromptEnhancementReferences(body = {}, req) {
  const candidates = imageReferenceCandidates(body);
  if (candidates.length > CANVAS_PROMPT_ENHANCE_MAX_REFERENCES) {
    const error = new Error(`AI 扩写一次最多读取 ${CANVAS_PROMPT_ENHANCE_MAX_REFERENCES} 张参考图`);
    error.code = 'CANVAS_PROMPT_REFERENCE_LIMIT';
    throw error;
  }
  const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const result = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const file = await loadReferenceImageFile(candidates[index], req);
    if (!allowedMimes.has(file.mime)) {
      const error = new Error(`参考图 ${index + 1} 仅支持 PNG、JPEG 或 WebP`);
      error.code = 'CANVAS_PROMPT_REFERENCE_TYPE';
      throw error;
    }
    if (!file.buffer.length || file.buffer.length > IMAGE_PROXY_MAX_BYTES) {
      const error = new Error(`参考图 ${index + 1} 为空或超过 ${Math.floor(IMAGE_PROXY_MAX_BYTES / 1024 / 1024)}MB 限制`);
      error.code = 'CANVAS_PROMPT_REFERENCE_SIZE';
      throw error;
    }
    result.push({
      label: canvasPromptImageLabel(index),
      image: {
        type: 'input_image',
        image_url: `data:${file.mime};base64,${file.buffer.toString('base64')}`,
        detail: 'high'
      }
    });
  }
  return result;
}

function buildCanvasPromptEnhancementInput(prompt = '', references = []) {
  const originalPrompt = String(prompt || '').trim();
  return [
    {
      role: 'system',
      content: [{ type: 'input_text', text: buildCanvasPromptEnhancementSystemPrompt(references.length) }]
    },
    {
      role: 'user',
      content: [
        { type: 'input_text', text: `请扩写下面的原始提示词。原始提示词中的明确要求和指定文字必须保留：\n${originalPrompt || '请根据参考图生成一张高质量电商图片。'}` },
        ...references.map(reference => reference.image)
      ]
    }
  ];
}

function responsesInputToChatMessages(input) {
  if (typeof input === 'string') return [{ role: 'user', content: input }];
  if (!Array.isArray(input)) {
    return [{ role: 'user', content: String(input || '') }];
  }
  return input.map((message) => {
    const role = ['system', 'user', 'assistant'].includes(message?.role) ? message.role : 'user';
    const content = Array.isArray(message?.content)
      ? message.content.map((item) => {
        if (typeof item === 'string') return { type: 'text', text: item };
        const type = String(item?.type || '').toLowerCase();
        if (type === 'input_image' || type === 'image_url') {
          const url = item.image_url || item.imageUrl || item.url || item.dataUrl || '';
          return url ? { type: 'image_url', image_url: { url } } : null;
        }
        if (type === 'input_text' || type === 'text') {
          return { type: 'text', text: String(item.text || item.value || '') };
        }
        if (item?.text || item?.value) return { type: 'text', text: String(item.text || item.value) };
        return null;
      }).filter(Boolean)
      : String(message?.content || '');
    return { role, content };
  });
}

function shouldUseChatForTextRoute(route = {}, status = {}) {
  if (isResponsesTextRoute(route)) return false;
  if ([route.chatEndpoint, route.endpoint, route.requestPath].some(value => String(value || '').includes('/chat/completions'))) return true;
  return String(status.gateway || '').toLowerCase() === 'new-api';
}

function responsesToolsToChatTools(tools = []) {
  return (Array.isArray(tools) ? tools : []).flatMap((tool) => {
    if (!tool || tool.type !== 'function' || !tool.name) return [];
    return [{
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.parameters || { type: 'object', properties: {} }
      }
    }];
  });
}

async function callProviderResponses(input, options = {}) {
  const status = options.status || routeProviderStatus(options.route, 'text');
  const timeoutMs = positiveNumber(options.timeoutMs, status.timeoutMs || PROVIDER_TIMEOUT_MS);
  const requestStatus = { ...status, timeoutMs };
  const model = resolveTextProviderModel(options.model, options.route || resolveTextRoute(options));
  if (!status.enabled) {
    return {
      success: true,
      mock: true,
      provider: requestStatus,
      output_text: `本地 mock 回复：${String(input || 'ping').slice(0, 80)}`
    };
  }

  const maxTransientRetries = Math.max(0, Math.min(Number(options.maxTransientRetries || 0) || 0, 3));
  const controller = new AbortController();
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true });
  let retryCount = 0;
  try {
    for (;;) {
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const useChat = shouldUseChatForTextRoute(options.route, requestStatus);
        const requestUrl = joinProviderUrl(requestStatus.baseUrl, useChat ? routeTextChatEndpoint(options.route) : routeTextEndpoint(options.route));
        const requestBody = useChat
          ? { model, messages: responsesInputToChatMessages(input), stream: false }
          : { model, input };
        if (Array.isArray(options.tools) && options.tools.length) {
          requestBody.tools = useChat ? responsesToolsToChatTools(options.tools) : options.tools;
        }
        if (options.toolChoice !== undefined) {
          requestBody.tool_choice = options.toolChoice;
        }
        const resp = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${providerAuthKey('text', options.route)}`
          },
          body: JSON.stringify(requestBody),
          agent: providerImageAgentForUrl(requestUrl),
          signal: controller.signal
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const upstreamStatus = resp.status;
          const transient = upstreamStatus >= 500 || upstreamStatus === 408 || upstreamStatus === 429;
          if (transient && retryCount < maxTransientRetries && !externalSignal?.aborted && !controller.signal.aborted) {
            retryCount += 1;
            const retryAfter = Number(resp.headers.get('retry-after') || 0);
            const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter * 1000, 60000)
              : (retryCount === 1 ? 1000 : 3000);
            await wait(waitMs);
            continue;
          }
          return {
            success: false,
            code: useChat ? 'PROVIDER_CHAT_FAILED' : 'PROVIDER_RESPONSES_FAILED',
            message: data.message || data.error?.message || `Provider returned ${upstreamStatus}`,
            provider: requestStatus,
            upstreamStatus,
            upstream: data,
            transientRetryCount: retryCount,
            billingAuditRequired: transient && retryCount > 0
          };
        }
        return {
          success: true,
          provider: { ...requestStatus, textEndpoint: useChat ? 'chat/completions' : 'responses' },
          ...data,
          transientRetryCount: retryCount
        };
      } catch (error) {
        const externalAborted = !!externalSignal?.aborted;
        const timeoutAbort = error.name === 'AbortError' && !externalAborted;
        const networkError = error.name !== 'AbortError';
        const isTransient = timeoutAbort || networkError;
        if (isTransient && retryCount < maxTransientRetries && !externalAborted && !controller.signal.aborted) {
          retryCount += 1;
          const waitMs = retryCount === 1 ? 1000 : 3000;
          await wait(waitMs);
          continue;
        }
        return {
          success: false,
          code: error.name === 'AbortError' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_REQUEST_FAILED',
          message: error.name === 'AbortError' ? `AI Provider 请求超时（已等待 ${Math.round(timeoutMs / 1000)} 秒）` : `AI Provider 调用失败: ${error.message}`,
          provider: requestStatus,
          transientRetryCount: retryCount,
          billingAuditRequired: retryCount > 0
        };
      } finally {
        clearTimeout(timer);
      }
    }
  } finally {
    externalSignal?.removeEventListener?.('abort', abortFromExternal);
  }
}

const providerImageRequestDelay = (options = {}) => {
  const raw = options.imageRequestDelayMs ??
    options.providerImageRequestDelayMs ??
    options.body?.imageRequestDelayMs ??
    options.body?.providerImageRequestDelayMs;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0) return Math.min(parsed, 15000);
  return IMAGE_PROVIDER_REQUEST_DELAY_MS;
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const PROVIDER_PRE_TLS_RETRY_LIMIT = 2;

function isProviderPreTlsDisconnect(error) {
  const message = [error?.message, error?.cause?.message]
    .filter(Boolean)
    .join(' ');
  return /client network socket disconnected before secure tls connection was established/i.test(message);
}

function providerImageRequestErrorMessage(error) {
  if (error?.name === 'AbortError') return 'Provider 图生图超时';
  const code = String(error?.code || error?.cause?.code || '').trim().toUpperCase();
  const reason = [error?.message, error?.cause?.message]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/https?:\/\/\S+/gi, 'Provider');
  const fingerprint = `${code} ${reason}`;
  if (isProviderPreTlsDisconnect(error)) {
    return `Provider 图生图尚未建立到中转站的安全连接${code ? `（${code}）` : ''}，请稍后重试或检查线路`;
  }
  if (/ECONNRESET|SOCKET HANG UP/i.test(fingerprint)) {
    return `Provider 图生图上传连接被重置${code ? `（${code}）` : ''}，请稍后重试或检查线路`;
  }
  if (/ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED/i.test(fingerprint)) {
    return `Provider 图生图网络连接失败${code ? `（${code}）` : ''}${reason ? `：${reason.slice(0, 160)}` : ''}`;
  }
  if (reason) return `Provider 图生图失败${code ? `（${code}）` : ''}：${reason.slice(0, 200)}`;
  return `Provider 图生图失败${code ? `（${code}）` : ''}`;
}

async function fetchProviderWithPreTlsRetry(createRequest) {
  let retryCount = 0;
  while (true) {
    try {
      return {
        response: await createRequest(),
        preTlsRetryCount: retryCount
      };
    } catch (error) {
      if (!isProviderPreTlsDisconnect(error) || retryCount >= PROVIDER_PRE_TLS_RETRY_LIMIT) {
        error.providerPreTlsRetryCount = retryCount;
        error.providerConnectionPhase = isProviderPreTlsDisconnect(error) ? 'pre_tls' : 'request_unknown';
        throw error;
      }
      retryCount += 1;
      await wait(400 * (2 ** (retryCount - 1)));
    }
  }
}

function notifyProviderImageQueue(options = {}, status, queuePosition, meta = {}) {
  if (typeof options.onQueueStatus !== 'function') return;
  try {
    options.onQueueStatus({
      status,
      queuePosition: status === 'pending' ? queuePosition : 0,
      queueMode: meta.queueMode || 'bounded-fair',
      pendingCount: Number(meta.pendingCount || 0),
      failureDomain: meta.failureDomain || imageProviderFailureDomain(options.route),
      retryAfterMs: Number(meta.retryAfterMs || 0)
    });
  } catch {}
}

function notifyProviderImageStage(options = {}, stage, meta = {}) {
  if (typeof options.onProviderStage !== 'function') return;
  try {
    options.onProviderStage(stage, {
      failureDomain: imageProviderFailureDomain(options.route),
      ...meta
    });
  } catch {}
}

// 请求级瞬时错误自动重试（桥豆式）：仅对 429/408/5xx/超时/断连等瞬时错误补发；
// 200-空响应（已计费）、LINGSUAN_SKIPPED_MAINLINE / 524（等待无收益）与用户取消不重试。
// 重试等待发生在调度器执行单元内部，不占新并发槽；幂等键与任务级账务由上层保持不变。
function isProviderTransientRetryable(result = {}) {
  if (!result || result.success !== false || !result.transient) return false;
  const code = String(result.code || '').toUpperCase();
  if (code === 'LINGSUAN_SKIPPED_MAINLINE' || code === 'PROVIDER_ORIGIN_TIMEOUT_524') return false;
  return true;
}
function providerTransientRetryWaitMs(result = {}, attempt = 1) {
  const retryAfter = Number(result?.retryAfterMs || 0);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, 60 * 1000);
  return GENERATION_TRANSIENT_RETRY_BACKOFF_MS * attempt;
}
async function runProviderImageRequestWithRetry(runRequest, options = {}, signal) {
  const maxRetries = Number.isInteger(options.maxTransientRetries)
    ? Math.max(0, Math.min(options.maxTransientRetries, 3))
    : GENERATION_MAX_TRANSIENT_RETRIES;
  let attempts = 0;
  for (;;) {
    const result = await runRequest(signal);
    if (isProviderTransientRetryable(result) && attempts < maxRetries && !signal?.aborted) {
      attempts += 1;
      const waitMs = providerTransientRetryWaitMs(result, attempts);
      notifyProviderImageStage(options, 'retrying', {
        attempt: attempts,
        maxRetries,
        waitMs,
        code: result.code || '',
        upstreamStatus: result.upstreamStatus || 0
      });
      await wait(waitMs);
      continue;
    }
    if (attempts === 0) return result;
    if (result && result.success === false) {
      return { ...result, request: { ...(result.request || {}), transientRetryCount: attempts, transientRetryExhausted: true } };
    }
    return { ...result, request: { ...(result.request || {}), transientRetryCount: attempts } };
  }
}
function runQueuedProviderImageRequest(runRequest, options = {}) {
  if (options.bypassProviderQueue) {
    notifyProviderImageQueue(options, 'running', 0, {
      queueMode: 'persistent-task-worker',
      failureDomain: imageProviderFailureDomain(options.route)
    });
    return runProviderImageRequestWithRetry(runRequest, options, options.signal);
  }
  const delayMs = providerImageRequestDelay(options);
  const failureDomain = imageProviderFailureDomain(options.route);
  return imageRequestScheduler.schedule(async (signal) => {
    if (options.forceQueueDelay && delayMs > 0) await wait(delayMs);
    return runProviderImageRequestWithRetry(runRequest, options, signal);
  }, {
    taskId: options.taskId || '',
    userId: options.userId || options.req?.user?.userId || options.taskId || 'direct-image-request',
    failureDomain,
    onStatus: (state) => notifyProviderImageQueue(options, state.status, state.queuePosition, state)
  });
}

function linkAbortSignal(controller, signal) {
  if (!signal || typeof signal.addEventListener !== 'function') return () => {};
  const abort = () => controller.abort(signal.reason || '任务已取消');
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
  return () => signal.removeEventListener('abort', abort);
}

async function runQueuedProviderImageBatch(count, runRequest, options = {}) {
  const requestResults = [];
  for (let i = 0; i < count; i += 1) {
    const result = await runQueuedProviderImageRequest(
      (signal) => runRequest(i, signal),
      { ...options, forceQueueDelay: i > 0 }
    );
    requestResults.push(result);
    if (!result.success) break;
  }
  return requestResults;
}

function normalizeProviderImageResponseFormat(value = 'url') {
  return String(value || '').trim().toLowerCase() === 'b64_json' ? 'b64_json' : 'url';
}

function normalizeProviderImageStream(value = false) {
  return value === true || ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function normalizeProviderImagePartialImages(value = 0) {
  return Math.max(0, Math.min(Math.trunc(Number(value) || 0), 3));
}

function lingsuanImageRequestExamples(route = {}) {
  const model = firstString(route.defaultImageModel, route.dm, 'gpt-image-2');
  return [
    {
      label: '文生图',
      method: 'POST',
      endpoint: '/v1/images/generations',
      contentType: 'application/json',
      requestFormat: LINGSUAN_IMAGES_API_FORMAT,
      body: { model, prompt: 'string', size: '1024x1024', quality: 'high', output_format: 'png', n: 1 }
    },
    {
      label: '图生图 / 局部重绘',
      method: 'POST',
      endpoint: '/v1/images/edits',
      contentType: 'multipart/form-data',
      requestFormat: LINGSUAN_IMAGES_API_FORMAT,
      body: { model, 'image[]': '<file>', prompt: 'string', size: '1024x1024', quality: 'high', output_format: 'png', n: 1 }
    }
  ];
}

function packyImageRequestExamples(route = {}) {
  const model = firstString(route.defaultImageModel, route.dm, 'gpt-image-2');
  return [
    {
      label: '文生图',
      method: 'POST',
      endpoint: '/v1/images/generations',
      contentType: 'application/json',
      requestFormat: PACKY_IMAGES_API_FORMAT,
      body: { model, prompt: 'string', size: '1024x1024', quality: 'high', output_format: 'png', n: 1 }
    },
    {
      label: '图生图 / 局部重绘',
      method: 'POST',
      endpoint: '/v1/images/edits',
      contentType: 'multipart/form-data',
      requestFormat: PACKY_IMAGES_API_FORMAT,
      body: { model, image: '<file>', prompt: 'string', size: '1024x1024', quality: 'high', output_format: 'png', n: 1 }
    }
  ];
}

function normalizeApiProviderRoute(route = {}) {
  if (routeKind(route) === 'text') {
    const model = textRouteModelKey(route);
    const sourceExamples = Array.isArray(route.requestExamples) && route.requestExamples.length > 0
      ? route.requestExamples
      : [{
          label: '文本生成',
          method: 'POST',
          endpoint: routeTextEndpoint(route),
          contentType: 'application/json',
          requestFormat: route.requestFormat || route.apiFormat || 'openai-responses',
          body: { input: 'string' }
        }];
    const requestExamples = sourceExamples.map(example => ({
      ...example,
      body: { ...(example.body || {}), model }
    }));
    return {
      ...route,
      dm: model,
      defaultTextModel: model,
      requestExamples,
      requestBodyExample: { ...(route.requestBodyExample || requestExamples[0]?.body || {}), model }
    };
  }
  const lingsuanImages = isLingsuanImagesRoute(route);
  const packyImages = isPackyImagesRoute(route);
  if (!lingsuanImages && !packyImages) return route;
  const format = lingsuanImages ? LINGSUAN_IMAGES_API_FORMAT : PACKY_IMAGES_API_FORMAT;
  const normalized = {
    ...route,
    apiFormat: format,
    requestFormat: format,
    endpoint: '/v1/images/generations',
    requestPath: '/v1/images/generations',
    imageEndpoint: '/v1/images/generations',
    imageEditEndpoint: '/v1/images/edits',
    imageResponseFormat: lingsuanImages ? 'b64_json' : 'url',
    imageStream: false,
    imagePartialImages: 0
  };
  normalized.requestExamples = lingsuanImages
    ? lingsuanImageRequestExamples(normalized)
    : packyImageRequestExamples(normalized);
  normalized.requestBodyExample = normalized.requestExamples[0].body;
  return normalized;
}

function providerImageResponseMode(route = {}) {
  if (isLingsuanImagesRoute(route)) {
    return { stream: false, responseFormat: 'b64_json', partialImages: undefined };
  }
  if (isPackyImagesRoute(route)) {
    return { stream: false, responseFormat: 'url', partialImages: undefined };
  }
  const officialRoute = officialRouteDefinition(route);
  const responseFormat = normalizeProviderImageResponseFormat(
    firstString(route.imageResponseFormat, officialRoute?.imageResponseFormat, 'url')
  );
  const rawStream = route.imageStream !== undefined ? route.imageStream : officialRoute?.imageStream;
  const stream = normalizeProviderImageStream(rawStream);
  const rawPartialImages = route.imagePartialImages !== undefined
    ? route.imagePartialImages
    : officialRoute?.imagePartialImages;
  const partialImages = stream
    ? normalizeProviderImagePartialImages(rawPartialImages)
    : undefined;
  return {
    stream,
    responseFormat,
    partialImages
  };
}

function looksLikeProviderImageBase64(value = '') {
  const raw = String(value || '').trim();
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(raw)) return true;
  return raw.length >= 32 && raw.length <= 40 * 1024 * 1024 && /^[a-z0-9+/=\r\n]+$/i.test(raw);
}

function parseProviderImageSse(text = '') {
  const events = [];
  let eventName = '';
  let dataLines = [];
  const flush = () => {
    if (!dataLines.length) {
      eventName = '';
      return;
    }
    const rawData = dataLines.join('\n').trim();
    dataLines = [];
    if (!rawData || rawData === '[DONE]') {
      eventName = '';
      return;
    }
    try {
      const parsed = JSON.parse(rawData);
      if (eventName && parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !parsed.type) {
        parsed.type = eventName;
      }
      events.push(parsed);
    } catch {
      events.push({ type: eventName || 'message', data: rawData });
    }
    eventName = '';
  };
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    if (!line) {
      flush();
    } else if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  flush();
  return events;
}

function collectProviderImageResults(value, images = [], seen = new Set(), inheritedPartial = false) {
  const addCandidate = (candidateValue, metadata = {}) => {
    const raw = String(candidateValue || '').trim();
    if (!raw) return;
    const isUrl = /^https?:\/\//i.test(raw);
    if (!isUrl && !looksLikeProviderImageBase64(raw)) return;
    const key = `${isUrl ? 'url' : 'b64'}:${raw}`;
    if (seen.has(key)) return;
    seen.add(key);
    images.push({
      ...(isUrl ? { url: raw } : { b64_json: raw }),
      ...(metadata.revised_prompt ? { revised_prompt: metadata.revised_prompt } : {})
    });
  };
  if (typeof value === 'string') {
    if (!inheritedPartial) addCandidate(value);
    return images;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectProviderImageResults(item, images, seen, inheritedPartial));
    return images;
  }
  if (!value || typeof value !== 'object') return images;
  const eventType = firstString(value.type, value.event, value.object);
  const partial = inheritedPartial || /partial/i.test(eventType);
  if (partial) return images;
  const directUrl = firstString(value.url, value.imageUrl, value.image_url);
  const encoded = firstString(value.b64_json, value.b64Json, value.base64, value.dataUrl, value.data_url);
  const result = typeof value.result === 'string' ? value.result : '';
  addCandidate(encoded || directUrl || result, { revised_prompt: firstString(value.revised_prompt, value.revisedPrompt) });
  for (const key of ['data', 'images', 'results', 'output', 'response', 'content']) {
    if (value[key] !== undefined) collectProviderImageResults(value[key], images, seen, false);
  }
  if (value.result && typeof value.result === 'object') {
    collectProviderImageResults(value.result, images, seen, false);
  }
  return images;
}

function safeProviderImageUpstream(value, depth = 0) {
  if (depth > 10) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.map(item => safeProviderImageUpstream(item, depth + 1));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && looksLikeProviderImageBase64(value)) {
      return `[BASE64_IMAGE:${value.length}]`;
    }
    return value;
  }
  const safe = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && (
      ['b64_json', 'b64Json', 'base64', 'dataUrl', 'data_url', 'partial_image_b64'].includes(key) ||
      (key === 'result' && looksLikeProviderImageBase64(item))
    )) {
      safe[key] = `[BASE64_IMAGE:${item.length}]`;
    } else {
      safe[key] = safeProviderImageUpstream(item, depth + 1);
    }
  }
  return safe;
}

async function parseProviderImageResponse(resp) {
  const contentType = resp.headers.get('content-type') || '';
  const text = await resp.text();
  const isEventStream = /text\/event-stream/i.test(contentType) || /^\s*(?:event|data):/m.test(text);
  let payload = {};
  let eventCount = 0;
  if (isEventStream) {
    const events = parseProviderImageSse(text);
    payload = events;
    eventCount = events.length;
  } else if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 4000) };
    }
  }
  const images = collectProviderImageResults(payload);
  const safePayload = safeProviderImageUpstream(payload);
  return {
    contentType,
    isEventStream,
    eventCount,
    images,
    message: providerImageResponseMessage(payload),
    data: isEventStream
      ? { stream: true, eventCount, events: safePayload }
      : safePayload
  };
}

function providerImageEmptyResponse(status, upstream, requestMeta = {}) {
  return {
    success: false,
    code: 'PROVIDER_IMAGE_EMPTY_BILLED_RESPONSE',
    message: '上游返回成功状态，但没有提供最终图片 URL 或 Base64（可能只有 revised_prompt/usage）。本地未保存结果且不会扣除算力；上游可能已经计费，请凭任务记录联系线路处理。',
    provider: status,
    upstream,
    transient: false,
    upstreamBillingAmbiguous: true,
    providerBillingStatus: 'unknown',
    billingAuditRequired: true,
    request: {
      ...requestMeta,
      upstreamBillingAmbiguous: true,
      providerBillingStatus: 'unknown',
      billingAuditRequired: true
    }
  };
}

async function callProviderImageGeneration(prompt, options = {}) {
  const status = options.status || routeProviderStatus(options.route, 'image');
  const timeoutMs = providerImageTimeoutMs(options.route, status);
  const model = options.model || options.modelKey || AI_IMAGE_MODEL;
  const count = Math.max(1, Math.min(Number(options.n || options.count || options.imageCount || 1) || 1, 4));
  const sizeTier = options.sizeTier || options.resolution || options.clarity || options.quality;
  const size = providerImageRequestSize(options, sizeTier);
  const quality = providerImageQuality(options.imageQuality || options.providerQuality || options.qualityMode || options.quality, sizeTier);
  const outputFormat = providerImageOutputFormat(options.output_format || options.outputFormat);
  const background = providerImageBackground(options.background || options.bg);
  const moderation = providerImageModeration(options.moderation || options.moderationMode);
  const responseMode = providerImageResponseMode(options.route);
  const lingsuanImages = isLingsuanImagesRoute(options.route);
  const packyImages = isPackyImagesRoute(options.route);
  const strictImages = lingsuanImages || packyImages;
  const generationRequestMeta = {
    endpoint: routeImageGenerationEndpoint(options.route),
    model,
    size,
    quality,
    output_format: outputFormat,
    ...(strictImages ? {} : {
      background,
      moderation,
      response_format: responseMode.responseFormat,
      stream: responseMode.stream,
      partial_images: responseMode.partialImages
    }),
    n: 1,
    requestedCount: count,
    queueMode: options.bypassProviderQueue ? 'persistent-task-worker' : 'bounded-fair',
    queueDelayMs: providerImageRequestDelay(options),
    timeoutMs
  };
  if (!status.enabled) {
    return {
      success: true,
      mock: true,
      provider: status,
      images: Array.from({ length: count }, (_, i) => ({ url: placeholderUrl(`${prompt} ${i + 1}`) }))
    };
  }

  try {
    const requestResults = await runQueuedProviderImageBatch(count, async (_index, schedulerSignal) => {
      const controller = new AbortController();
      const unlinkAbort = linkAbortSignal(controller, schedulerSignal);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const requestUrl = joinProviderUrl(status.baseUrl, routeImageGenerationEndpoint(options.route));
        const requestPayload = strictImages
          ? { model, prompt, size, quality, output_format: outputFormat, n: 1 }
          : {
              model,
              prompt,
              size,
              quality,
              background,
              output_format: outputFormat,
              moderation,
              response_format: responseMode.responseFormat,
              ...(responseMode.stream ? { stream: true } : {}),
              ...(responseMode.stream ? { partial_images: responseMode.partialImages } : {}),
              n: 1
            };
        const requestBody = JSON.stringify(requestPayload);
        notifyProviderImageStage(options, 'connecting', { endpoint: routeImageGenerationEndpoint(options.route) });
        const { response: resp, preTlsRetryCount } = await fetchProviderWithPreTlsRetry(() => {
          const pendingResponse = fetch(requestUrl, {
            method: 'POST',
            headers: {
              'Accept': providerImageAcceptHeader(options.route, responseMode),
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${providerAuthKey('image', options.route)}`
            },
            body: requestBody,
            agent: providerImageAgentForUrl(requestUrl),
            signal: controller.signal
          });
          notifyProviderImageStage(options, 'upstream_generating', {
            endpoint: routeImageGenerationEndpoint(options.route)
          });
          return pendingResponse;
        });
        const parsed = await parseProviderImageResponse(resp);
        const upstreamItem = {
          status: resp.status,
          contentType: parsed.contentType,
          stream: parsed.isEventStream,
          eventCount: parsed.eventCount,
          data: providerResponseShape(parsed.data),
          transportMode: providerImageTransportForUrl(requestUrl),
          preTlsRetryCount
        };
        const failure = classifyImageProviderFailure({
          status: resp.status,
          data: parsed.data,
          message: parsed.message,
          headers: resp.headers,
          fallbackCode: 'PROVIDER_IMAGE_FAILED'
        });
        const skippedMainline = failure.code === 'LINGSUAN_SKIPPED_MAINLINE' && parsed.images.length === 0;
        if (!resp.ok || skippedMainline) {
          upstreamItem.diagnostics = failure.diagnostics;
          return {
            ...failure,
            success: false,
            provider: status,
            upstreamStatus: resp.status,
            upstream: parsed.data,
            upstreamItem,
            request: {
              ...generationRequestMeta,
              transportMode: providerImageTransportForUrl(requestUrl),
              preTlsRetryCount,
              transient: failure.transient,
              retryAfterMs: failure.retryAfterMs,
              upstreamBillingAmbiguous: failure.upstreamBillingAmbiguous,
              providerBillingStatus: failure.providerBillingStatus,
              billingAuditRequired: failure.billingAuditRequired,
              responseDiagnostics: failure.diagnostics
            }
          };
        }
        return { success: true, images: parsed.images, upstreamItem };
      } catch (err) {
        const cancelled = !!schedulerSignal?.aborted;
        const preTlsFailure = isProviderPreTlsDisconnect(err);
        const upstreamBillingAmbiguous = !cancelled && !preTlsFailure;
        return {
          success: false,
          code: cancelled ? 'TASK_CANCELLED' : (err.name === 'AbortError' ? 'PROVIDER_IMAGE_TIMEOUT' : 'PROVIDER_IMAGE_ERROR'),
          message: cancelled
            ? '任务已取消'
            : (err.name === 'AbortError'
                ? 'Provider 图片生成超时'
                : safeProviderErrorMessage(err.message, 'Provider 图片生成失败')),
          provider: status,
          transient: !cancelled,
          upstreamBillingAmbiguous,
          providerBillingStatus: upstreamBillingAmbiguous ? 'unknown' : 'not_charged',
          billingAuditRequired: upstreamBillingAmbiguous,
          request: {
            ...generationRequestMeta,
            preTlsRetryCount: Number(err?.providerPreTlsRetryCount || 0),
            connectionPhase: err?.providerConnectionPhase || (err.name === 'AbortError' ? 'request_timeout' : 'request_unknown'),
            transient: !cancelled,
            upstreamBillingAmbiguous,
            providerBillingStatus: upstreamBillingAmbiguous ? 'unknown' : 'not_charged',
            billingAuditRequired: upstreamBillingAmbiguous
          }
        };
      } finally {
        clearTimeout(timer);
        unlinkAbort();
      }
    }, options);
    const failed = requestResults.find((item) => !item.success);
    if (failed) return failed;
    const upstream = requestResults.map((item) => item.upstreamItem).filter(Boolean);
    const images = [];
    requestResults.forEach((result) => {
      result.images.forEach((item) => images.push({ ...item, index: images.length }));
    });
    if (!images.length) {
      return providerImageEmptyResponse(status, upstream, generationRequestMeta);
    }
    const request = {
      ...generationRequestMeta,
      providerBillingStatus: 'charged_assumed',
      upstreamBillingAmbiguous: false
    };
    return { success: true, mock: false, provider: status, images, upstream, request };
  } catch (err) {
    return {
      success: false,
      code: err.name === 'AbortError' ? 'PROVIDER_IMAGE_TIMEOUT' : 'PROVIDER_IMAGE_ERROR',
      message: err.name === 'AbortError'
        ? 'Provider 图片生成超时'
        : safeProviderErrorMessage(err.message, 'Provider 图片生成失败'),
      provider: status
    };
  }
}

async function callProviderImageEdit(prompt, options = {}) {
  const status = options.status || routeProviderStatus(options.route, 'image');
  const timeoutMs = providerImageTimeoutMs(options.route, status);
  const model = options.model || options.modelKey || AI_IMAGE_MODEL;
  const count = Math.max(1, Math.min(Number(options.n || options.count || options.imageCount || 1) || 1, 4));
  const sizeTier = options.sizeTier || options.resolution || options.clarity || options.quality;
  const size = providerImageRequestSize(options, sizeTier);
  const quality = providerImageQuality(options.imageQuality || options.providerQuality || options.qualityMode || options.quality, sizeTier);
  const outputFormat = providerImageOutputFormat(options.output_format || options.outputFormat);
  const inputFidelity = providerImageInputFidelity(options.input_fidelity || options.inputFidelity);
  const background = providerImageBackground(options.background || options.bg);
  const moderation = providerImageModeration(options.moderation || options.moderationMode);
  const responseMode = providerImageResponseMode(options.route);
  const lingsuanImages = isLingsuanImagesRoute(options.route);
  const packyImages = isPackyImagesRoute(options.route);
  const strictImages = lingsuanImages || packyImages;
  const references = imageReferenceCandidates(options.body || options);
  if (!references.length) {
    return callProviderImageGeneration(prompt, options);
  }
  if (!status.enabled) {
    return {
      success: true,
      mock: true,
      provider: status,
      editMode: true,
      images: Array.from({ length: count }, (_, i) => ({ url: placeholderUrl(`${prompt} reference ${i + 1}`) }))
    };
  }

  try {
    const maskSource = options.mask || options.maskUrl || options.body?.mask || options.body?.maskUrl || options.body?.maskAlphaBase64 || options.body?.maskBase64 || '';
    const maskFile = maskSource
      ? await loadReferenceImageFile(
          maskSource && typeof maskSource === 'object'
            ? maskSource
            : { url: maskSource, dataUrl: maskSource },
          options.req
        )
      : null;
    const referenceFiles = [];
    const referencesForEdit = maskFile ? references.slice(0, 1) : references.slice(0, GENERATION_MAX_REFERENCE_COUNT);
    for (let i = 0; i < referencesForEdit.length; i += 1) {
      const file = await loadReferenceImageFile(referencesForEdit[i], options.req);
      referenceFiles.push({
        ...file,
        fileName: file.fileName || `reference-${i + 1}.${providerImageExt(file.mime)}`
      });
    }
    const editRequestUrl = joinProviderUrl(status.baseUrl, routeImageEditEndpoint(options.route));
    const editRequestMeta = {
      model,
      size,
      quality,
      output_format: outputFormat,
      ...(strictImages ? {} : {
        response_format: responseMode.responseFormat,
        stream: responseMode.stream,
        partial_images: responseMode.partialImages,
        input_fidelity: inputFidelity,
        background,
        moderation
      }),
      n: 1,
      queueMode: options.bypassProviderQueue ? 'persistent-task-worker' : 'bounded-fair',
      queueDelayMs: providerImageRequestDelay(options),
      timeoutMs,
      endpoint: routeImageEditEndpoint(options.route),
      requestedCount: count,
      referenceImageCount: references.length,
      submittedReferenceImageCount: referenceFiles.length,
      referenceImageField: lingsuanImages ? 'image[]' : 'image',
      referenceImageFieldMode: referenceFiles.length > 1 && !maskFile ? 'repeated' : 'single',
      referenceImageBytes: referenceFiles.map((file) => file.buffer.length),
      referenceImageTotalBytes: referenceFiles.reduce((total, file) => total + file.buffer.length, 0),
      referenceImageMimeTypes: referenceFiles.map((file) => file.mime),
      transportMode: providerImageTransportForUrl(editRequestUrl)
    };
    const requestResults = await runQueuedProviderImageBatch(count, async (_index, schedulerSignal) => {
      const controller = new AbortController();
      const unlinkAbort = linkAbortSignal(controller, schedulerSignal);
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const createForm = () => {
          const form = new FormData();
          form.append('model', model);
          if (strictImages) {
            referenceFiles.forEach((file, index) => {
              form.append(lingsuanImages ? 'image[]' : 'image', new Blob([file.buffer], { type: file.mime }), file.fileName || `reference-${index + 1}.${providerImageExt(file.mime)}`);
            });
            if (maskFile) form.append('mask', new Blob([maskFile.buffer], { type: maskFile.mime }), maskFile.fileName);
            form.append('prompt', prompt);
            form.append('size', size);
            form.append('quality', quality);
            form.append('output_format', outputFormat);
            form.append('n', '1');
            return form;
          }
          form.append('prompt', prompt);
          form.append('size', size);
          form.append('quality', quality);
          form.append('background', background);
          form.append('output_format', outputFormat);
          form.append('moderation', moderation);
          form.append('response_format', responseMode.responseFormat);
          if (responseMode.stream) {
            form.append('stream', 'true');
            form.append('partial_images', String(responseMode.partialImages));
          }
          form.append('n', '1');
          form.append('input_fidelity', inputFidelity);
          referenceFiles.forEach((file, index) => {
            form.append('image', new Blob([file.buffer], { type: file.mime }), file.fileName || `reference-${index + 1}.${providerImageExt(file.mime)}`);
          });
          if (maskFile) form.append('mask', new Blob([maskFile.buffer], { type: maskFile.mime }), maskFile.fileName);
          return form;
        };
        const requestUrl = editRequestUrl;
        notifyProviderImageStage(options, 'connecting', { endpoint: routeImageEditEndpoint(options.route) });
        const { response: resp, preTlsRetryCount } = await fetchProviderWithPreTlsRetry(() => {
          const pendingResponse = fetch(requestUrl, {
            method: 'POST',
            headers: {
              'Accept': providerImageAcceptHeader(options.route, responseMode),
              'Authorization': `Bearer ${providerAuthKey('image', options.route)}`
            },
            body: createForm(),
            agent: providerImageAgentForUrl(requestUrl),
            signal: controller.signal
          });
          notifyProviderImageStage(options, 'upstream_generating', {
            endpoint: routeImageEditEndpoint(options.route)
          });
          return pendingResponse;
        });
        const parsed = await parseProviderImageResponse(resp);
        const upstreamItem = {
          status: resp.status,
          contentType: parsed.contentType,
          stream: parsed.isEventStream,
          eventCount: parsed.eventCount,
          data: providerResponseShape(parsed.data),
          transportMode: providerImageTransportForUrl(requestUrl),
          preTlsRetryCount
        };
        const failure = classifyImageProviderFailure({
          status: resp.status,
          data: parsed.data,
          message: parsed.message,
          headers: resp.headers,
          fallbackCode: 'PROVIDER_IMAGE_EDIT_FAILED'
        });
        const skippedMainline = failure.code === 'LINGSUAN_SKIPPED_MAINLINE' && parsed.images.length === 0;
        if (!resp.ok || skippedMainline) {
          upstreamItem.diagnostics = failure.diagnostics;
          return {
            ...failure,
            success: false,
            provider: status,
            upstreamStatus: resp.status,
            upstream: parsed.data,
            upstreamItem,
            request: {
              ...editRequestMeta,
              preTlsRetryCount,
              transient: failure.transient,
              retryAfterMs: failure.retryAfterMs,
              upstreamBillingAmbiguous: failure.upstreamBillingAmbiguous,
              providerBillingStatus: failure.providerBillingStatus,
              billingAuditRequired: failure.billingAuditRequired,
              responseDiagnostics: failure.diagnostics
            }
          };
        }
        return { success: true, images: parsed.images, upstreamItem };
      } catch (err) {
        const cancelled = !!schedulerSignal?.aborted;
        const preTlsFailure = isProviderPreTlsDisconnect(err);
        const upstreamBillingAmbiguous = !cancelled && !preTlsFailure;
        return {
          success: false,
          code: cancelled ? 'TASK_CANCELLED' : (err.name === 'AbortError' ? 'PROVIDER_IMAGE_EDIT_TIMEOUT' : 'PROVIDER_IMAGE_EDIT_ERROR'),
          message: cancelled
            ? '任务已取消'
            : safeProviderErrorMessage(providerImageRequestErrorMessage(err), 'Provider 图生图失败'),
          provider: status,
          transient: !cancelled,
          upstreamBillingAmbiguous,
          providerBillingStatus: upstreamBillingAmbiguous ? 'unknown' : 'not_charged',
          billingAuditRequired: upstreamBillingAmbiguous,
          request: {
            ...editRequestMeta,
            preTlsRetryCount: Number(err?.providerPreTlsRetryCount || 0),
            connectionPhase: err?.providerConnectionPhase || (err.name === 'AbortError' ? 'request_timeout' : 'request_unknown'),
            transient: !cancelled,
            upstreamBillingAmbiguous,
            providerBillingStatus: upstreamBillingAmbiguous ? 'unknown' : 'not_charged',
            billingAuditRequired: upstreamBillingAmbiguous
          }
        };
      } finally {
        clearTimeout(timer);
        unlinkAbort();
      }
    }, options);
    const failed = requestResults.find((item) => !item.success);
    if (failed) return failed;
    const upstream = requestResults.map((item) => item.upstreamItem).filter(Boolean);
    const images = [];
    requestResults.forEach((result) => {
      result.images.forEach((item) => images.push({ ...item, index: images.length }));
    });
    if (!images.length) {
      return providerImageEmptyResponse(status, upstream, editRequestMeta);
    }
    return {
      success: true,
      mock: false,
      provider: status,
      editMode: true,
      images,
      upstream,
      request: {
        ...editRequestMeta,
        preTlsRetryCount: Math.max(0, ...upstream.map((item) => Number(item.preTlsRetryCount || 0))),
        providerBillingStatus: 'charged_assumed',
        upstreamBillingAmbiguous: false
      }
    };
  } catch (err) {
    return {
      success: false,
      code: err.name === 'AbortError' ? 'PROVIDER_IMAGE_EDIT_TIMEOUT' : 'PROVIDER_IMAGE_EDIT_ERROR',
      message: safeProviderErrorMessage(providerImageRequestErrorMessage(err), 'Provider 图生图失败'),
      provider: status
    };
  }
}

function reqBodyModel(body = {}) {
  return body.model || body.modelKey || body.textModel || body.textModelKey || '';
}

function routeKind(route = {}) {
  const raw = String(route.g || route.group || route.cat || route.category || route.type || 'image').toLowerCase();
  if (raw.includes('text') || raw.includes('chat') || raw.includes('language')) return 'text';
  if (raw.includes('video')) return 'video';
  return 'image';
}
const IMAGE_CLARITY_OPTIONS = ['1k', '2k', '4k'];
const IMAGE_CLARITY_ALIASES = {
  '1k': '1k',
  '1024': '1k',
  '1024x1024': '1k',
  '2k': '2k',
  '2048': '2k',
  '2048x2048': '2k',
  '4k': '4k',
  '3840': '4k',
  '3840x3840': '4k',
  '4096': '4k',
  '4096x4096': '4k'
};
function modelQualityValue(value) {
  if (value && typeof value === 'object') return value.key || value.value || value.label || '';
  return value;
}
function normalizeImageClarities(values = []) {
  const source = Array.isArray(values) ? values : [];
  const selected = new Set(source
    .map(modelQualityValue)
    .map(value => String(value || '').trim().toLowerCase())
    .map(value => IMAGE_CLARITY_ALIASES[value])
    .filter(Boolean));
  return selected.size
    ? IMAGE_CLARITY_OPTIONS.filter(value => selected.has(value))
    : [...IMAGE_CLARITY_OPTIONS];
}
function normalizeModelQualities(values = [], kind = 'image') {
  if (kind === 'image') return normalizeImageClarities(values);
  const source = Array.isArray(values) ? values : [];
  const cleaned = source
    .map(modelQualityValue)
    .map(value => String(value || '').trim())
    .filter(Boolean);
  return cleaned.length ? Array.from(new Set(cleaned)) : ['1k'];
}
function defaultModelClarity(qualities = []) {
  return qualities.includes('1k') ? '1k' : qualities[0] || '1k';
}
function buildImageModelVariants(model = {}, qualities = []) {
  return normalizeImageClarities(qualities).map(clarity => ({
    id: `${model.id}_${clarity}`,
    modelId: model.modelId,
    modelKey: model.modelKey,
    key: model.modelKey,
    realName: model.realName,
    realModelName: model.realModelName || model.realName,
    displayName: model.displayName,
    label: model.label || model.displayName,
    clarity,
    routeId: model.routeId,
    lineId: model.lineId || model.routeId,
    routeKey: model.routeKey,
    lineKey: model.lineKey || model.routeKey
  }));
}
function fmt(m, route = RTS[0]) {
  const kind = routeKind(route);
  const mid = m.k.replace(/[.-]/g,'_');
  const routeId = route && route.id ? route.id : 'pub_route_64f93e01e8f3';
  const routeKey = route && route.rk ? route.rk : 'route_6789';
  const modelId = `pub_model_${mid}`;
  const qualities = normalizeModelQualities(m.q, kind);
  const clarity = defaultModelClarity(qualities);
  const variantBase = { id: modelId, modelId, modelKey: m.k, realName: m.k, realModelName: m.k, displayName: m.n, label: m.n, routeId, lineId: routeId, routeKey, lineKey: routeKey };
  return {
    id:modelId,modelId,key:m.k,name:m.n,modelName:m.n,modelKey:m.k,realName:m.k,realModelName:m.k,
    publicModelId:modelId,defaultModelId:modelId,providerModelId:m.k,
    routeId,lineId:routeId,routeKey,lineKey:routeKey,routeName:route && route.dn ? route.dn : '6789',
    frontendModelKey:m.k,modelFamilyKey:m.k,clarityOverride:'',imageSizeOverride:'',
    displayName:m.n,label:m.n,price:m.p,pointCost:m.p,pricePoints:m.p,baseCredits:m.p,modelType:kind,type:kind,group:kind,category:kind,enabled:true,status:'active',
    qualities,defaultParams:{size:'1x1',quality:'standard',clarity},
    variants:kind === 'image' ? buildImageModelVariants(variantBase, qualities) : [{...variantBase,clarity}]
  };
}

function routeIdentity(route = RTS[0]) {
  const id = String(route.id || route.routeId || route.lineId || route.rk || '').trim();
  const key = String(route.rk || route.routeKey || route.lineKey || route.code || id).trim();
  return { id, key };
}

function baseModelsForRoute(route = RTS[0]) {
  const kind = routeKind(route);
  const sourceModels = kind === 'text'
    ? [{ k: textRouteModelKey(route), n: textModelDisplayName(textRouteModelKey(route), route), p: 5, q: ['1k'] }]
    : IMG;
  return sourceModels.map(m => fmt(m, route));
}

function numericModelValue(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function routeMatchesModelRow(row = {}, route = RTS[0]) {
  const { id, key } = routeIdentity(route);
  const routeValues = [id, key, route.routeId, route.lineId, route.routeKey, route.lineKey, route.code, route.rk]
    .filter(Boolean)
    .map(String);
  const rowValues = [row.routeId, row.lineId, row.routeKey, row.lineKey, row.providerId, row.providerKey]
    .filter(Boolean)
    .map(String);
  const rowIdPrefix = String(row.id || '').split(':')[0];
  if (rowIdPrefix) rowValues.push(rowIdPrefix);
  return rowValues.some(value => routeValues.includes(value));
}

function modelMatchesRow(model = {}, row = {}) {
  const modelValues = [model.modelKey, model.key, model.realName, model.realModelName, model.modelId, model.id]
    .filter(Boolean)
    .map(String);
  const rowValues = [row.modelKey, row.key, row.realName, row.realModelName, row.providerModelId, row.modelId, row.id]
    .filter(Boolean)
    .map(String);
  return rowValues.some(value => modelValues.includes(value) || modelValues.some(modelValue => String(value).endsWith(`:${modelValue}`)));
}

function normalizeRouteModel(row = {}, route = RTS[0], baseModel = null) {
  const kind = routeKind(route);
  const { id: routeId, key: routeKey } = routeIdentity(route);
  const rawModelKey = row.modelKey || row.key || row.frontendModelKey || row.realName || row.realModelName || row.providerModelId || baseModel?.modelKey || baseModel?.key || '';
  const modelKey = String(rawModelKey || '').trim();
  const realName = String(row.realName || row.realModelName || row.providerModelId || row.model || baseModel?.realName || modelKey).trim();
  const displayName = String(row.displayName || row.frontName || row.label || row.name || baseModel?.displayName || realName || modelKey || '可用模型').trim();
  const id = String(row.id || baseModel?.id || (routeId && modelKey ? `${routeId}:${modelKey}` : modelKey)).trim();
  const modelId = String(row.modelId || baseModel?.modelId || id).trim();
  const price = numericModelValue(row.pointCost, row.pricePoints, row.price, row.baseCredits, baseModel?.pointCost, baseModel?.pricePoints, baseModel?.price, baseModel?.baseCredits);
  const enabled = row.enabled !== false && row.status !== 'disabled';
  const qualities = normalizeModelQualities(Array.isArray(row.qualities) ? row.qualities : baseModel?.qualities, kind);
  const clarity = defaultModelClarity(qualities);
  const defaultParams = row.defaultParams || baseModel?.defaultParams || { size: '1x1', quality: 'standard' };
  const normalizedDefaultParams = kind === 'image'
    ? { ...defaultParams, clarity: normalizeImageClarities([defaultParams.clarity])[0] || clarity }
    : { ...defaultParams, clarity: defaultParams.clarity || clarity };
  const variantBase = { id, modelId, modelKey, realName, realModelName: realName, displayName, label: row.label || displayName, routeId, lineId: routeId, routeKey, lineKey: routeKey };
  return {
    ...(baseModel || {}),
    ...row,
    id,
    modelId,
    key: modelKey,
    name: displayName,
    modelName: displayName,
    modelKey,
    realName,
    realModelName: realName,
    providerModelId: row.providerModelId || baseModel?.providerModelId || realName,
    publicModelId: row.publicModelId || baseModel?.publicModelId || modelId,
    defaultModelId: row.defaultModelId || baseModel?.defaultModelId || modelId,
    routeId: row.routeId || baseModel?.routeId || routeId,
    lineId: row.lineId || baseModel?.lineId || routeId,
    routeKey: row.routeKey || baseModel?.routeKey || routeKey,
    lineKey: row.lineKey || baseModel?.lineKey || routeKey,
    routeName: row.routeName || baseModel?.routeName || route.displayName || route.dn || route.name || routeKey,
    frontendModelKey: row.frontendModelKey || baseModel?.frontendModelKey || modelKey,
    modelFamilyKey: row.modelFamilyKey || baseModel?.modelFamilyKey || modelKey,
    displayName,
    label: row.label || displayName,
    price,
    pointCost: price,
    pricePoints: price,
    baseCredits: price,
    modelType: row.modelType || baseModel?.modelType || kind,
    type: row.type || baseModel?.type || kind,
    group: row.group || baseModel?.group || kind,
    category: row.category || baseModel?.category || kind,
    enabled,
    status: enabled ? (row.status || 'active') : 'disabled',
    qualities,
    defaultParams: normalizedDefaultParams,
    variants: kind === 'image'
      ? buildImageModelVariants(variantBase, qualities)
      : Array.isArray(row.variants)
        ? row.variants
        : Array.isArray(baseModel?.variants)
          ? baseModel.variants
          : [{ ...variantBase, key: modelKey, clarity }],
    raw: row.raw || row
  };
}

function modelRowsForRoute(route = RTS[0], options = {}) {
  const baseModels = baseModelsForRoute(route);
  const overrides = modelPriceState().filter(row => routeMatchesModelRow(row, route));
  const usedOverrideIds = new Set();
  const mergedModels = baseModels.flatMap(model => {
    const override = overrides.find(row => modelMatchesRow(model, row));
    if (override && override.id) usedOverrideIds.add(override.id);
    if (override?.deleted) return [];
    return [normalizeRouteModel(override || {}, route, model)];
  });
  const extraModels = overrides
    .filter(row => !row.id || !usedOverrideIds.has(row.id))
    .filter(row => !row.deleted)
    .filter(row => !baseModels.some(model => modelMatchesRow(model, row)))
    .map(row => normalizeRouteModel(row, route));
  const models = [...mergedModels, ...extraModels];
  return options.includeDisabled ? models : models.filter(model => model.enabled !== false && model.status !== 'disabled');
}

function findPricedModel(modelKey = '', kind = 'image', preferredRoute = null) {
  const key = String(modelKey || '').trim();
  if (!key) return null;
  const routes = preferredRoute
    ? [preferredRoute]
    : routeState().filter(route => !kind || routeKind(route) === kind);
  const models = routes.flatMap(route => modelRowsForRoute(route));
  return models.find(model =>
    [model.modelKey, model.realName, model.realModelName, model.providerModelId, model.modelId, model.id, model.displayName]
      .filter(Boolean)
      .some(value => String(value) === key)
  ) || models.find(model => String(model.id || '').endsWith(`:${key}`));
}

function routePayload(route = RTS[0], options = {}) {
  route = normalizeApiProviderRoute(route);
  const kind = routeKind(route);
  const baseModels = baseModelsForRoute(route);
  const models = options.includeModelOverrides === false
    ? baseModels
    : modelRowsForRoute(route, { includeDisabled: !!options.includeDisabledModels });
  const id = route.id || route.routeId || route.lineId || route.rk || uid('route_');
  const key = route.rk || route.routeKey || route.lineKey || route.code || id;
  const name = route.name || route.dn || route.displayName || key;
  const displayName = route.displayName || route.routeDisplayName || route.dn || name;
  const defaultModel = models.find(model =>
    [model.modelKey, model.realName, model.realModelName, model.displayName, model.modelId, model.id].filter(Boolean).includes(route.dm)
  ) || baseModels.find(model => [model.modelKey, model.realName, model.displayName].includes(route.dm)) || models[0] || baseModels[0] || null;
  const officialRoute = officialRouteDefinition(route);
  const officialExamples = Array.isArray(officialRoute && officialRoute.requestExamples)
    ? officialRoute.requestExamples
    : null;
  const imageResponseMode = kind === 'image' ? providerImageResponseMode(route) : null;
  const lingsuanImages = isLingsuanImagesRoute(route);
  const packyImages = isPackyImagesRoute(route);
  const strictImages = lingsuanImages || packyImages;
  const storedExamples = strictImages
    ? (lingsuanImages ? lingsuanImageRequestExamples(route) : packyImageRequestExamples(route))
    : (Array.isArray(route.requestExamples) && route.requestExamples.length
        ? route.requestExamples
        : officialExamples || []);
  const requestExamples = kind === 'image'
    ? storedExamples.map((example) => {
        const multipart = /multipart/i.test(String(example.contentType || '')) || /图生图|编辑|局部/.test(String(example.label || ''));
        const body = strictImages
          ? { ...(example.body || {}) }
          : { ...(example.body || {}), response_format: imageResponseMode.responseFormat };
        if (!strictImages && imageResponseMode.stream) {
          body.stream = true;
          body.partial_images = imageResponseMode.partialImages;
        } else {
          delete body.stream;
          delete body.partial_images;
        }
        return {
          ...example,
          endpoint: multipart
            ? routeImageEditEndpoint(route)
            : routeImageGenerationEndpoint(route),
          body
        };
      })
    : storedExamples;
  return {
    ...route,
    id,
    routeId: id,
    lineId: id,
    key,
    code: key,
    routeCode: key,
    routeKey: key,
    lineKey: key,
    name,
    displayName,
    routeName: name,
    routeDisplayName: displayName,
    label: name,
    group: kind,
    type: kind,
    category: kind,
    modelType: kind,
    enabled: route.enabled !== false,
    disabled: false,
    status: route.status || 'active',
    priority: Number(route.pri || route.priority || 0),
    isDefault: !!route.def,
    defaultModel,
    defaultModelId: defaultModel?.modelId || '',
    defaultModelKey: defaultModel?.modelKey || '',
    defaultModelRealName: defaultModel?.realName || '',
    defaultModelDisplayName: defaultModel?.displayName || '',
    apiKey: maskSecret(route.apiKey),
    hasApiKey: hasStoredSecret(route.apiKey),
    apiFormat: route.apiFormat || officialRoute?.apiFormat || '',
    requestFormat: route.requestFormat || route.apiFormat || officialRoute?.requestFormat || '',
    endpoint: route.endpoint || route.requestPath || officialRoute?.endpoint || '',
    requestPath: route.requestPath || route.endpoint || officialRoute?.endpoint || '',
    imageResponseFormat: imageResponseMode?.responseFormat || '',
    imageStream: imageResponseMode?.stream || false,
    imagePartialImages: imageResponseMode?.partialImages ?? 0,
    requestBodyExample: requestExamples[0]?.body || route.requestBodyExample || null,
    requestExamples,
    models
  };
}
function filteredRoutes(group, options = {}) {
  const g = String(group || '').toLowerCase();
  return routeState()
    .filter(r => !g || routeKind(r) === g || String(r.g || r.cat || '').toLowerCase() === g)
    .map(route => routePayload(route, options));
}
function san(u) {
  return {id:u.id,username:u.username,email:u.email,emailVerified:true,role:u.role,
    status:u.status,balance:u.balance,credits:u.balance,
    avatarUrl:u.avatar_url||'',avatar_url:u.avatar_url||'',
    avatarType:'preset',avatar_type:'preset',createdAt:u.created_at,lastLoginAt:u.last_login_at};
}

// ===================== AUTH ROUTES =====================
app.post('/api/auth/register', (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  const code = String(req.body.code || '').trim();
  if (!username || !email || !password) return res.status(400).json({ message: '请填写用户名、邮箱和密码；当前内网注册无需邮箱验证码。' });
  const settings = settingsState();
  if (settings.registrationEnabled === false) return res.status(403).json({ message: '注册暂未开放' });
  if (db.prepare('SELECT id FROM users WHERE username=?').get(username)) return res.status(400).json({ message: '用户名已存在' });
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(400).json({ message: '邮箱已注册' });
  if (REQUIRE_REGISTER_EMAIL_CODE) {
    const saved = db.prepare('SELECT * FROM email_codes WHERE email=? AND type=? ORDER BY created_at DESC LIMIT 1').get(email,'register');
    if (!saved || saved.code !== code || Date.now() > saved.expires_at) return res.status(400).json({ message: '验证码错误或已过期' });
  }
  db.prepare('DELETE FROM email_codes WHERE email=? AND type=?').run(email,'register');
  const id = uid('user_');
  const giftCredits = Math.max(0, Number(settings.registrationGiftCredits ?? 0) || 0);
  db.prepare('INSERT INTO users (id,username,email,password_hash,role,balance) VALUES (?,?,?,?,?,?)').run(id,username,email,h(password),'user',giftCredits);
  if (giftCredits > 0) {
    balanceService.recordBalanceLog(id,'register_gift',giftCredits,0,giftCredits,`注册赠送 ${giftCredits} 算力`);
  }
  const token = jwt.sign({ userId: id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: san(db.prepare('SELECT * FROM users WHERE id=?').get(id)) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: '请输入账号和密码' });
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  const passwordVerification = user ? verifyPasswordHash(user.password_hash, password) : { ok: false };
  if (!user || !passwordVerification.ok) return res.status(401).json({ message: '账号或密码不正确' });
  if (user.role === 'admin') return res.status(403).json({ message: '管理员请使用后台登录入口' });
  rehashPasswordIfNeeded(user, password, passwordVerification);
  db.prepare("UPDATE users SET last_login_at=datetime('now') WHERE id=?").run(user.id);
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: san(user) });
});

app.post('/api/auth/send-email-code', (req, res) => {
  const { email, type } = req.body;
  if (!email) return res.status(400).json({ message: '邮箱不能为空' });
  const code = rcode();
  db.prepare('INSERT INTO email_codes (email,code,type,expires_at,created_at) VALUES (?,?,?,?,?)').run(email,code,type||'register',Date.now()+300000,Date.now());
  console.log(`[CODE] ${email} -> ${code}`);
  res.json({ ok: true, expiresIn: 300, cooldown: 60, code });
});

app.post('/api/auth/send-reset-code', (_req, res) => {
  res.status(410).json({
    success: false,
    code: 'RESET_CODE_FLOW_DISABLED',
    message: '当前内网不使用重置验证码，请输入用户名直接设置新密码'
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const username = String(req.body.username || '').trim();
  const nextPassword = String(req.body.newPassword || req.body.password || '');
  if (!username || !nextPassword) {
    return res.status(400).json({
      success: false,
      code: 'RESET_FIELDS_REQUIRED',
      message: '请输入用户名和新密码'
    });
  }
  if (nextPassword.length < 6) {
    return res.status(400).json({
      success: false,
      code: 'PASSWORD_TOO_SHORT',
      message: '新密码至少需要 6 位'
    });
  }
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user) {
    return res.status(404).json({
      success: false,
      code: 'ACCOUNT_NOT_FOUND',
      message: '账号不存在，请检查用户名'
    });
  }
  if (user.role === 'admin') {
    return res.status(403).json({
      success: false,
      code: 'ADMIN_SELF_RESET_FORBIDDEN',
      message: '管理员账号不能通过找回密码入口重置'
    });
  }
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(h(nextPassword), user.id);
  res.json({ success: true, message: '密码已重置，请使用新密码登录' });
});

// ===================== PUBLIC ROUTES =====================
app.get('/api/public/routes', (req, res) => res.json({ items: filteredRoutes(req.query.group || 'image') }));
app.get('/api/public/models', (req, res) => {
  const rid = req.query.routeId || req.query.lineId || req.query.routeKey || req.query.lineKey;
  const routes = routeState();
  const rt = routes.find(r=>[r.id,r.rk,r.routeId,r.lineId,r.routeKey,r.lineKey].includes(rid)) || routes[0] || RTS[0];
  const models = modelRowsForRoute(rt);
  res.json({ success: true, items: models, data: models });
});
app.get('/api/model-routes', (req, res) => {
  res.json({ items: filteredRoutes(req.query.group) });
});
registerTemplateSettingsRoutes(app, { templateWorkflowState });
app.get('/api/settings/canvas-storage', (req, res) => res.json({ enabled: true, maxSize: 100, allowedTypes: ['image/png','image/jpeg','image/webp'] }));

// ===================== USER ROUTES =====================
app.get('/api/user/profile', auth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.userId);
  if (!u) return res.status(404).json({ message: '用户不存在' });
  res.json({ user: san(u) });
});
app.get('/api/user/routes', auth, (req, res) => res.json({ success: true, data: filteredRoutes(req.query.group || 'image'), items: filteredRoutes(req.query.group || 'image') }));
app.get('/api/user/models', auth, (req, res) => {
  const rid = req.query.routeId || req.query.lineId || req.query.routeKey || req.query.lineKey || selectedImageRouteIdForUser(req.user.userId) || 'pub_route_openai_gpt_image_2';
  const routes = routeState();
  const rt = routes.find(r=>routeMatchesId(r, rid)) || routes[0] || RTS[0];
  const models = modelRowsForRoute(rt);
  res.json({ success: true, data: models, items: models });
});
app.get('/api/user/api-status', optionalAuth, (req, res) => {
  const rt = req.user ? resolveImageRoute({}, req.user.userId) : (routeState()[0] || RTS[0]);
  const models = modelRowsForRoute(rt);
  const defaultImageModel = models[0]?.displayName || 'GPT Image 2';
  res.json({ success: true, status: 'active', mode: 'auto', mock: !req.user,
    provider: { id:rt.id, routeId:rt.id, lineId:rt.id, routeKey:rt.rk, lineKey:rt.rk, name:rt.dn, displayName:rt.dn,
      defaultImageModel, models, supportsChat:true, supportsImage:true }
  });
});
app.get('/api/user/balance-logs', auth, (req, res) => {
  res.json({ items: balanceService.listUserBalanceLogs(req.user.userId) });
});
app.post('/api/user/redeem', auth, (req, res) => {
  const result = balanceService.redeemCode(req.user.userId, req.body.code);
  res.status(result.status).json(result.body);
});

// ===================== PROJECTS / CANVAS =====================
// 项目预览图：取画布内第一个带图节点的展示地址；asset: 引用签 15 分钟短时同源 URL，不泄露签名之外信息。
async function projectPreviewThumbnail(userId, data) {
  if (data && typeof data.thumbnail === 'string' && data.thumbnail) return data.thumbnail;
  const nodes = Array.isArray(data?.project?.nodes) ? data.project.nodes : (Array.isArray(data?.nodes) ? data.nodes : []);
  for (const node of nodes) {
    const meta = node?.metadata || {};
    const content = String(meta.content || '');
    if (content.startsWith('/uploads/')) return content;
    const storageKey = String(meta.storageKey || '');
    if (!storageKey.startsWith('asset:')) continue;
    try {
      const access = await assetService.createAccessUrl(userId, storageKey.slice(6));
      if (access?.url) return access.url;
    } catch {
      // 资产已删除或不可用时跳过该节点。
    }
  }
  return '';
}

app.get('/api/user/projects', auth, async (req, res) => {
  const ps = db.prepare('SELECT * FROM projects WHERE user_id=? ORDER BY updated_at DESC').all(req.user.userId);
  const items = [];
  for (const p of ps) {
    const data = projectDataFromRow(p);
    items.push({ id: p.id, name: p.name, thumbnail: await projectPreviewThumbnail(req.user.userId, data), legacy: data?.schema !== 'hjm.infinite-canvas.project', updatedAt: p.updated_at, createdAt: p.created_at });
  }
  res.json({ success: true, items, projects: items, list: items, data: items, total: items.length });
});
app.post('/api/user/projects', auth, (req, res) => {
  const { name } = req.body;
  const data = workflowDataFromBody(req.body);
  const id = uid('proj_');
  db.prepare('INSERT INTO projects (id,user_id,name,data) VALUES (?,?,?,?)').run(id, req.user.userId, name||'未命名项目', JSON.stringify(data || {}));
  const project = { id, name: name||'未命名项目', data, createdAt: new Date().toISOString() };
  res.json({ success: true, ...project, project });
});
app.get('/api/user/projects/:id', auth, (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p || p.user_id !== req.user.userId) return res.status(404).json({ message: '项目不存在' });
  const project = { id:p.id, name:p.name, data: projectDataFromRow(p), createdAt:p.created_at, updatedAt:p.updated_at };
  res.json({ success: true, ...project, project });
});
app.put('/api/user/projects/:id', auth, (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p || p.user_id !== req.user.userId) return res.status(404).json({ message: '项目不存在' });
  const data = workflowDataFromBody(req.body);
  db.prepare("UPDATE projects SET name=?, data=?, updated_at=datetime('now') WHERE id=?").run(req.body.name||req.body.title||p.name, JSON.stringify(data || {}), req.params.id);
  res.json({ success: true, id: req.params.id, name: req.body.name||req.body.title||p.name, data });
});
app.delete('/api/user/projects/:id', auth, (req, res) => {
  const r = db.prepare('DELETE FROM projects WHERE id=? AND user_id=?').run(req.params.id, req.user.userId);
  if (r.changes === 0) return res.status(404).json({ message: '项目不存在' });
  res.json({ success: true });
});

// ===================== UPLOAD =====================
app.post('/api/user/avatar/upload', auth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请上传头像文件' });
  const url = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar_url=? WHERE id=?').run(url, req.user.userId);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.userId);
  res.json({ url, user: san(user), success: true });
});
app.put('/api/user/avatar', auth, (req, res) => {
  const avatarUrl = req.body.avatarUrl || req.body.avatar_url || '';
  const avatarType = req.body.avatarType || req.body.avatar_type || 'preset';
  db.prepare('UPDATE users SET avatar_url=? WHERE id=?').run(avatarUrl, req.user.userId);
  const user = san(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.userId));
  res.json({ success: true, user: { ...user, avatarType, avatar_type: avatarType } });
});
app.post('/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请上传文件' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url, imageUrl: url, originalUrl: url, success: true });
});
app.post('/api/upload/image', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请上传图片' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url, imageUrl: url, originalUrl: url, success: true });
});
app.use('/uploads', express.static(uploadDir));

// 账号隔离云端资产库（backend/assets，ADR-0006）
registerAssetRoutes(app, { auth, assetService });

// 双层云端提示词库（backend/prompts，Task 7）
registerPromptRoutes(app, { auth, admin, promptService });

// ===================== AI GENERATION =====================
const fetch = (...args) => import('node-fetch').then(({default:f})=>f(...args));
const providerHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
  maxFreeSockets: 8
});
function normalizeProviderImageIpFamily(value = process.env.PROVIDER_IMAGE_IP_FAMILY) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === '4' || normalized === 'ipv4') return 4;
  if (normalized === '6' || normalized === 'ipv6') return 6;
  if (normalized === 'auto' || normalized === 'happy-eyeballs') return 0;
  return process.platform === 'win32' ? 6 : 4;
}
const PROVIDER_IMAGE_IP_FAMILY = normalizeProviderImageIpFamily();
const providerImageHttpsAgentOptions = {
  keepAlive: true,
  maxSockets: 32,
  maxFreeSockets: 8
};
if (PROVIDER_IMAGE_IP_FAMILY) {
  providerImageHttpsAgentOptions.family = PROVIDER_IMAGE_IP_FAMILY;
} else {
  providerImageHttpsAgentOptions.autoSelectFamily = true;
  providerImageHttpsAgentOptions.autoSelectFamilyAttemptTimeout = 250;
}
const providerImageHttpsAgent = new https.Agent(providerImageHttpsAgentOptions);
function normalizeLingsuanImageProxyUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
    return parsed.toString();
  } catch {
    throw new Error('LINGSUAN_IMAGE_PROXY_URL 必须是有效的 HTTP(S) 代理地址');
  }
}
const LINGSUAN_IMAGE_PROXY_URL = normalizeLingsuanImageProxyUrl(process.env.LINGSUAN_IMAGE_PROXY_URL);
const LINGSUAN_IMAGE_PROXY_HOSTS = new Set(['lingsuan.top', 'www.packyapi.ai', 'packyapi.ai']);
const providerImageProxyAgent = LINGSUAN_IMAGE_PROXY_URL
  ? new HttpsProxyAgent(LINGSUAN_IMAGE_PROXY_URL, { keepAlive: true })
  : null;

function isLingsuanImageProxyTarget(url = '') {
  if (!providerImageProxyAgent) return false;
  try {
    const parsed = new URL(String(url));
    return parsed.protocol === 'https:' && LINGSUAN_IMAGE_PROXY_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

const providerImageAgentPools = new Map();
function providerImageAgentForUrl(url = '') {
  let protocol = '';
  let hostname = '';
  try {
    const parsed = new URL(String(url));
    protocol = parsed.protocol;
    hostname = parsed.hostname.toLowerCase();
  } catch {}
  if (protocol !== 'https:') return undefined;
  if (isLingsuanImageProxyTarget(url)) return providerImageProxyAgent;
  if (!providerImageAgentPools.has(hostname)) {
    const poolOptions = {
      keepAlive: true,
      maxSockets: Math.max(GENERATION_DOMAIN_CONCURRENCY + 1, 2),
      maxFreeSockets: 2
    };
    if (PROVIDER_IMAGE_IP_FAMILY) {
      poolOptions.family = PROVIDER_IMAGE_IP_FAMILY;
    } else {
      poolOptions.autoSelectFamily = true;
      poolOptions.autoSelectFamilyAttemptTimeout = 250;
    }
    providerImageAgentPools.set(hostname, new https.Agent(poolOptions));
  }
  return providerImageAgentPools.get(hostname);
}

// 结果图下载专用：上游 CDN 可能只有 IPv4（如 api.mikoto.vip），强制 family 会 ENOTFOUND/挂起；
// 用 happy-eyeballs 让 Node 自动选择可用地址族。Provider API 调用仍走上面的 family 池。
const providerImageDownloadAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 16,
  maxFreeSockets: 8,
  autoSelectFamily: true,
  autoSelectFamilyAttemptTimeout: 250
});
function providerImageDownloadAgentForUrl(url = '') {
  let protocol = '';
  try { protocol = new URL(String(url)).protocol; } catch {}
  if (protocol !== 'https:') return undefined;
  return isLingsuanImageProxyTarget(url) ? providerImageProxyAgent : providerImageDownloadAgent;
}

function providerImageTransportForUrl(url = '') {
  let protocol = '';
  try { protocol = new URL(String(url)).protocol; } catch {}
  if (protocol !== 'https:') return 'http-direct';
  if (isLingsuanImageProxyTarget(url)) return 'https-proxy';
  if (PROVIDER_IMAGE_IP_FAMILY === 4) return 'https-ipv4-pool';
  if (PROVIDER_IMAGE_IP_FAMILY === 6) return 'https-ipv6-pool';
  return 'https-happy-eyeballs-pool';
}

function isProviderPreTlsReset(error) {
  return error?.code === 'ECONNRESET'
    && /before secure tls connection was established/i.test(String(error?.message || ''));
}

async function fetchProvider(url, options = {}) {
  const requestOptions = { ...options };
  if (String(url).toLowerCase().startsWith('https://') && !requestOptions.agent) {
    requestOptions.agent = providerHttpsAgent;
  }

  const retryDelays = [250, 750];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetch(url, requestOptions);
    } catch (error) {
      if (attempt >= retryDelays.length || requestOptions.signal?.aborted || !isProviderPreTlsReset(error)) {
        throw error;
      }
      const providerHost = (() => {
        try { return new URL(String(url)).host; } catch { return 'provider'; }
      })();
      console.warn(`[PROVIDER_TLS_RETRY] ${providerHost} TLS handshake reset, retry ${attempt + 1}/${retryDelays.length}`);
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
    }
  }
}

app.post('/api/generation/estimate-cost', optionalAuth, (req, res) => {
  const modelKey = req.body.modelKey || req.body.model || req.body.realName || req.body.realModelName || req.body.imageModelKey || IMG[0].k;
  const imageCount = Number(req.body.imageCount || req.body.count || req.body.n || 1) || 1;
  const routeId = req.body.routeId || req.body.lineId || req.body.routeKey || req.body.lineKey || '';
  const route = routeId ? findRouteByAnyId(routeId) : null;
  const kind = route ? routeKind(route) : (req.body.textModel || req.body.textModelKey ? 'text' : 'image');
  const model = findPricedModel(modelKey, kind, route);
  const cost = model
    ? Number(model.pricePoints ?? model.pointCost ?? model.price ?? model.baseCredits)
    : modelCost(modelKey, kind);
  const cnt = imageCount || 1;
  const u = req.user?.userId ? db.prepare('SELECT balance FROM users WHERE id=?').get(req.user.userId) : null;
  const totalCost = cost * cnt;
  res.json({
    success: true,
    estimatedCost: cost,
    totalCost,
    credits: totalCost,
    costPoints: totalCost,
    available: u ? u.balance : 999999,
    mock: !req.user
  });
});

app.get('/api/mock-image/:id.svg', (req, res) => {
  const text = String(req.query.text || 'HJM AI').slice(0, 120);
  const safeText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const hue = parseInt(crypto.createHash('md5').update(req.params.id || text).digest('hex').slice(0, 2), 16);
  const colorA = `hsl(${hue}, 78%, 58%)`;
  const colorB = `hsl(${(hue + 42) % 360}, 72%, 42%)`;
  res.type('image/svg+xml').send(`
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colorA}"/>
      <stop offset="1" stop-color="${colorB}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#111827" flood-opacity="0.24"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="186" cy="186" r="128" fill="#fff" opacity="0.18"/>
  <circle cx="858" cy="824" r="180" fill="#fff" opacity="0.14"/>
  <rect x="154" y="232" width="716" height="560" rx="42" fill="#fff" opacity="0.94" filter="url(#shadow)"/>
  <text x="512" y="434" text-anchor="middle" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="54" font-weight="800" fill="#111827">HJM AI</text>
  <foreignObject x="232" y="492" width="560" height="160">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,'Microsoft YaHei',sans-serif;font-size:34px;font-weight:700;line-height:1.35;color:#374151;text-align:center;word-break:break-word;">${safeText}</div>
  </foreignObject>
</svg>`);
});

function imageProxyError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function imageProxySignature(rawUrl = '') {
  return crypto.createHmac('sha256', JWT_SECRET).update(String(rawUrl || ''), 'utf8').digest('hex');
}

function imageProxyTargetFromDisplayUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw, 'http://image-proxy.local');
    if (parsed.pathname !== '/api/proxy-image') return '';
    const target = String(parsed.searchParams.get('url') || '').trim();
    return /^https?:\/\//i.test(target) ? target : '';
  } catch {
    return '';
  }
}

function signedImageProxyUrl(rawUrl = '') {
  const target = String(rawUrl || '').trim();
  return `/api/proxy-image?url=${encodeURIComponent(target)}&sig=${imageProxySignature(target)}`;
}

const LEGACY_IMAGE_PROXY_TARGETS = new Set(
  db.prepare("SELECT result_url FROM generations WHERE result_url LIKE '%/api/proxy-image?url=%' AND result_url NOT LIKE '%&sig=%'")
    .all()
    .map(row => imageProxyTargetFromDisplayUrl(row.result_url))
    .filter(Boolean)
);

function isKnownLegacyImageProxyTarget(rawUrl = '') {
  const target = String(rawUrl || '').trim();
  if (LEGACY_IMAGE_PROXY_TARGETS.has(target)) return true;
  const rows = db.prepare("SELECT result_url FROM generations WHERE result_url LIKE '%/api/proxy-image?url=%' AND result_url NOT LIKE '%&sig=%'").all();
  for (const row of rows) {
    const knownTarget = imageProxyTargetFromDisplayUrl(row.result_url);
    if (knownTarget) LEGACY_IMAGE_PROXY_TARGETS.add(knownTarget);
  }
  return LEGACY_IMAGE_PROXY_TARGETS.has(target);
}

function normalizedProxyHostname(value = '') {
  return String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function isBlockedProxyIpv4(address = '') {
  const octets = String(address || '').split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a, b, c] = octets;
  return a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224;
}

function isBlockedProxyIp(address = '') {
  const normalized = normalizedProxyHostname(address).split('%')[0];
  const version = net.isIP(normalized);
  if (version === 4) return isBlockedProxyIpv4(normalized);
  if (version !== 6) return true;
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('::ffff:')) return true;
  if (!/^[23][0-9a-f]{3}:/.test(normalized)) return true;
  if (normalized.startsWith('2001:0:') || normalized.startsWith('2001:10:') || normalized.startsWith('2001:db8:')) return true;
  return false;
}

async function validateImageProxyUrl(rawUrl = '') {
  let url;
  try {
    url = new URL(String(rawUrl || ''));
  } catch {
    throw imageProxyError(400, 'IMAGE_PROXY_BAD_URL', '图片地址无效');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw imageProxyError(400, 'IMAGE_PROXY_BAD_URL', '图片地址无效');
  }
  if ((url.protocol === 'http:' && url.port && url.port !== '80') || (url.protocol === 'https:' && url.port && url.port !== '443')) {
    throw imageProxyError(403, 'IMAGE_PROXY_PORT_FORBIDDEN', '图片代理不允许访问该端口');
  }
  const hostname = normalizedProxyHostname(url.hostname);
  if (!hostname || hostname.includes('%') || hostname === 'localhost' || hostname.endsWith('.localhost') || /\.(?:local|internal|lan|home|corp)$/.test(hostname)) {
    throw imageProxyError(403, 'IMAGE_PROXY_PRIVATE_ADDRESS', '图片代理不允许访问内网地址');
  }
  let addresses;
  if (net.isIP(hostname)) {
    addresses = [{ address: hostname }];
  } else {
    try {
      addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw imageProxyError(502, 'IMAGE_PROXY_DNS_FAILED', '图片地址解析失败');
    }
  }
  if (!addresses.length || addresses.some(item => isBlockedProxyIp(item.address))) {
    throw imageProxyError(403, 'IMAGE_PROXY_PRIVATE_ADDRESS', '图片代理不允许访问内网或特殊用途地址');
  }
  return url;
}

async function fetchValidatedProxyImage(rawUrl, signal) {
  let currentUrl = await validateImageProxyUrl(rawUrl);
  for (let redirectCount = 0; redirectCount <= IMAGE_PROXY_MAX_REDIRECTS; redirectCount += 1) {
    const upstream = await fetch(currentUrl, {
      headers: { 'User-Agent': 'hjm-mb-clone/1.0' },
      redirect: 'manual',
      agent: providerImageDownloadAgentForUrl(currentUrl),
      signal
    });
    if (![301, 302, 303, 307, 308].includes(upstream.status)) return upstream;
    const location = upstream.headers.get('location');
    if (!location) {
      throw imageProxyError(502, 'IMAGE_PROXY_REDIRECT_INVALID', '图片代理收到无效重定向');
    }
    if (redirectCount >= IMAGE_PROXY_MAX_REDIRECTS) {
      throw imageProxyError(502, 'IMAGE_PROXY_REDIRECT_LIMIT', '图片代理重定向次数过多');
    }
    await cancelProxyResponseBody(upstream.body);
    currentUrl = await validateImageProxyUrl(new URL(location, currentUrl).toString());
  }
  throw imageProxyError(502, 'IMAGE_PROXY_REDIRECT_LIMIT', '图片代理重定向次数过多');
}

async function cancelProxyResponseBody(body) {
  if (!body) return;
  if (typeof body.cancel === 'function') {
    await body.cancel().catch(() => {});
    return;
  }
  if (typeof body.destroy === 'function') body.destroy();
}

async function readProxyImageBody(upstream) {
  const declaredLength = Number(upstream.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > IMAGE_PROXY_MAX_BYTES) {
    throw imageProxyError(413, 'IMAGE_PROXY_TOO_LARGE', '图片文件超过代理大小限制');
  }
  if (!upstream.body) return Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  const appendChunk = async (value) => {
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > IMAGE_PROXY_MAX_BYTES) {
      await cancelProxyResponseBody(upstream.body);
      throw imageProxyError(413, 'IMAGE_PROXY_TOO_LARGE', '图片文件超过代理大小限制');
    }
    chunks.push(chunk);
  };
  if (typeof upstream.body.getReader === 'function') {
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await appendChunk(value);
    }
  } else {
    for await (const value of upstream.body) {
      await appendChunk(value);
    }
  }
  return Buffer.concat(chunks, total);
}

app.get('/api/proxy-image', async (req, res) => {
  const rawUrl = String(req.query.url || '').trim();
  const signature = String(req.query.sig || '').trim();
  const signedRequest = timingSafeEqualText(signature, imageProxySignature(rawUrl));
  if (!signedRequest && !isKnownLegacyImageProxyTarget(rawUrl)) {
    return res.status(403).json({ success: false, code: 'IMAGE_PROXY_FORBIDDEN', message: '图片代理签名无效或缺失' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetchValidatedProxyImage(rawUrl, controller.signal);
    if (!upstream.ok) {
      return res.status(502).json({ success: false, code: 'IMAGE_PROXY_UPSTREAM_FAILED', message: `图片代理读取失败：${upstream.status}` });
    }
    const contentType = String(upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'].includes(contentType)) {
      return res.status(415).json({ success: false, code: 'IMAGE_PROXY_NOT_IMAGE', message: '上游地址不是图片内容' });
    }
    const body = await readProxyImageBody(upstream);
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(body);
  } catch (err) {
    const status = Number(err.status || 502);
    res.status(status).json({
      success: false,
      code: err.name === 'AbortError' ? 'IMAGE_PROXY_TIMEOUT' : (err.code || 'IMAGE_PROXY_ERROR'),
      message: err.name === 'AbortError' ? '图片代理读取超时' : (err.code ? err.message : '图片代理读取失败')
    });
  } finally {
    clearTimeout(timer);
  }
});

function placeholderUrl(prompt = '') {
  const text = encodeURIComponent(String(prompt || 'HJM AI').slice(0, 80));
  const id = crypto.createHash('md5').update(String(prompt || 'HJM AI')).digest('hex').slice(0, 12);
  return `/api/mock-image/${id}.svg?text=${text}`;
}
function imageDisplayUrl(url = '') {
  const value = String(url || '').trim();
  const target = imageProxyTargetFromDisplayUrl(value) || (/^https?:\/\//i.test(value) ? value : '');
  if (target) return signedImageProxyUrl(target);
  return value;
}
function providerImageBuffer(value = '') {
  let encoded = String(value || '').trim();
  if (!encoded) return null;
  const dataUrl = encoded.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)$/i);
  if (dataUrl) encoded = dataUrl[2];
  if (encoded.length < 32 || encoded.length > 40 * 1024 * 1024 || !/^[a-z0-9+/=\r\n]+$/i.test(encoded)) return null;
  try {
    const buffer = Buffer.from(encoded.replace(/\s+/g, ''), 'base64');
    return providerImagePayload(buffer);
  } catch {}
  return null;
}
function persistProviderImagePayload(decoded) {
  if (!decoded) return '';
  const directory = path.join(uploadDir, 'generated');
  fs.mkdirSync(directory, { recursive: true });
  const digest = crypto.createHash('sha256').update(decoded.buffer).digest('hex').slice(0, 32);
  const fileName = `${digest}.${decoded.ext}`;
  const filePath = path.join(directory, fileName);
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, decoded.buffer);
  return `/uploads/generated/${fileName}`;
}
function persistProviderImage(value = '') {
  return persistProviderImagePayload(providerImageBuffer(value));
}
async function fetchProviderImageForPersistence(rawUrl, signal) {
  if (ALLOW_PRIVATE_PROVIDER_IMAGE_PERSIST) {
    return fetch(rawUrl, {
      headers: { 'User-Agent': 'hjm-mb-clone/1.0' },
      redirect: 'follow',
      agent: providerImageDownloadAgentForUrl(rawUrl),
      signal
    });
  }
  return fetchValidatedProxyImage(rawUrl, signal);
}
// 结果图 CDN（如 api.mikoto.vip）限速约 42KB/s，5MB 结果需要约 120s；30s 必然超时。
const PROVIDER_IMAGE_PERSIST_DOWNLOAD_TIMEOUT_MS = Math.max(30000, Number(process.env.PROVIDER_IMAGE_PERSIST_TIMEOUT_MS) || 180000);
async function loadRemoteProviderImagePayload(rawUrl = '') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_IMAGE_PERSIST_DOWNLOAD_TIMEOUT_MS);
  try {
    const upstream = await fetchProviderImageForPersistence(rawUrl, controller.signal);
    if (!upstream.ok) {
      await cancelProxyResponseBody(upstream.body);
      throw imageProxyError(502, 'PROVIDER_IMAGE_PERSIST_UPSTREAM_FAILED', `生成图片本地保存失败：上游返回 ${upstream.status}`);
    }
    const contentType = String(upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'].includes(contentType)) {
      await cancelProxyResponseBody(upstream.body);
      throw imageProxyError(415, 'PROVIDER_IMAGE_PERSIST_NOT_IMAGE', '生成图片本地保存失败：上游内容不是受支持的图片');
    }
    const body = await readProxyImageBody(upstream);
    const decoded = providerImagePayload(body);
    if (!decoded) {
      throw imageProxyError(415, 'PROVIDER_IMAGE_PERSIST_INVALID_IMAGE', '生成图片本地保存失败：图片签名无效');
    }
    return decoded;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw imageProxyError(504, 'PROVIDER_IMAGE_PERSIST_TIMEOUT', '生成图片本地保存超时，请稍后重试');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
async function persistRemoteProviderImage(rawUrl = '') {
  return persistProviderImagePayload(await loadRemoteProviderImagePayload(rawUrl));
}
async function persistProviderImageResults(items = [], providerRequest = {}) {
  const trustedProviderRequest = providerRequest && typeof providerRequest === 'object' && Object.keys(providerRequest).length
    ? providerRequest
    : null;
  const prepared = await Promise.all((Array.isArray(items) ? items : []).map(async (item) => {
    const raw = item && typeof item === 'object' ? item : { url: item };
    const directUrl = firstString(raw.url, raw.imageUrl, raw.image_url);
    const encodedImage = firstString(
      raw.b64_json,
      raw.b64Json,
      raw.base64,
      raw.dataUrl,
      raw.data_url,
      !/^https?:\/\//i.test(directUrl) && !directUrl.startsWith('/') ? directUrl : ''
    );
    const decoded = /^https?:\/\//i.test(directUrl)
      ? await loadRemoteProviderImagePayload(directUrl)
      : providerImageBuffer(encodedImage);
    if (!decoded) {
      if (encodedImage) {
        throw imageProxyError(415, 'PROVIDER_IMAGE_PERSIST_INVALID_IMAGE', '生成图片本地保存失败：图片签名无效');
      }
      return { raw, decoded: null, validation: null };
    }
    const itemRequest = trustedProviderRequest || (
      raw.providerRequest && typeof raw.providerRequest === 'object'
        ? raw.providerRequest
        : raw.request && typeof raw.request === 'object'
          ? raw.request
          : {}
    );
    const validation = providerImageAspectValidation(decoded, itemRequest);
    const aspectRatioWarning = providerImageAspectWarning(validation);
    return { raw, decoded, validation, aspectRatioWarning };
  }));
  return prepared.map(({ raw, decoded, validation, aspectRatioWarning }) => {
    if (!decoded) return raw;
    const persistedUrl = persistProviderImagePayload(decoded);
    const actual = validation.actual || providerImageDimensions(decoded.buffer, decoded.ext);
    return {
      ...raw,
      url: persistedUrl,
      imageUrl: persistedUrl,
      image_url: persistedUrl,
      ...(actual ? { width: actual.width, height: actual.height, actualWidth: actual.width, actualHeight: actual.height } : {}),
      ...(aspectRatioWarning ? {
        warning: firstString(raw.warning, aspectRatioWarning.message),
        warnings: [...(Array.isArray(raw.warnings) ? raw.warnings : []), aspectRatioWarning],
        aspectRatioWarning
      } : {})
    };
  });
}
// ---- Task 8：生成结果写入账号云端资产库（ADR-0006）----
// mock 占位图为服务端动态 SVG，资产库只接受 PNG/JPEG/WebP（magic bytes），
// 因此 mock 结果物化为确定性 PNG；真实 Provider 结果直接读取 /uploads/generated/ 已校验文件。
const PNG_CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();
function pngCrc32(buffer) {
  let crc = -1;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = PNG_CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}
function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(pngCrc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}
function mockGeneratedImagePngBytes(seed = '') {
  const width = 64;
  const height = 64;
  const hue = parseInt(crypto.createHash('md5').update(String(seed || 'HJM AI')).digest('hex').slice(0, 2), 16);
  const red = (hue * 3 + 40) % 256;
  const green = (hue * 5 + 90) % 256;
  const blue = (hue * 7 + 140) % 256;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    for (let x = 0; x < width; x += 1) {
      raw[row + 1 + x * 3] = (red + x) % 256;
      raw[row + 2 + x * 3] = (green + y) % 256;
      raw[row + 3 + x * 3] = blue;
    }
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}
// 从任务结果图解析可用于资产库的字节：/uploads/ 本地文件直接读；mock 占位图物化 PNG；其他形态返回 null。
function generatedResultImageBytes(image = {}) {
  const url = firstString(image.url, image.imageUrl, image.image_url);
  if (/^\/uploads\/[^/?#]+/i.test(url)) {
    const relative = url.replace(/^\/uploads\//i, '').split(/[?#]/)[0];
    const filePath = path.resolve(uploadDir, relative);
    if (filePath !== uploadDir && !filePath.startsWith(uploadDir + path.sep)) return null;
    try {
      return { buffer: fs.readFileSync(filePath), name: path.basename(filePath) };
    } catch {
      return null;
    }
  }
  const mockMatch = String(url).match(/^\/api\/mock-image\/([a-z0-9]+)\.svg/i);
  if (mockMatch) {
    let text = '';
    try {
      text = new URL(String(url), 'http://127.0.0.1').searchParams.get('text') || '';
    } catch {}
    return { buffer: mockGeneratedImagePngBytes(text || mockMatch[1]), name: `generated-${mockMatch[1]}.png` };
  }
  return null;
}
// 落图成功后：每张结果写入 ObjectStorage + user_assets(source='generated')，assetId 随结果进入 generations.asset_id。
// 任何云存储失败直接抛出，由调用方按“结果保存失败”规则退款并记录上游计费歧义（ADR-0004），不重放 Provider。
// context.source='tool' 用于图片编辑工具结果（Task 9），与生图任务结果区分。
async function attachGeneratedResultAssets(userId, images = [], context = {}) {
  const list = Array.isArray(images) ? images : [];
  const assetSource = context.source === 'tool' ? 'tool' : 'generated';
  const results = [];
  for (const item of list) {
    const raw = item && typeof item === 'object' ? item : { url: item };
    const payload = generatedResultImageBytes(raw);
    if (!payload) {
      results.push(raw);
      continue;
    }
    const asset = await assetService.storeGeneratedAsset({
      userId,
      buffer: payload.buffer,
      name: payload.name || `生成图片 ${context.taskId || ''}`.trim(),
      source: assetSource,
      prompt: context.prompt
    });
    results.push({ ...raw, assetId: asset.id });
  }
  return results;
}

// Task 9：图片工具结果附带云端资产访问字段——assetId 由落库挂钩写入图片对象，
// accessUrl 为 15 分钟短时同源签名路径；签名失败不阻断工具响应（仅省略 accessUrl）。
function withAssetAccessFields(images = []) {
  return (Array.isArray(images) ? images : []).map((image) => {
    if (!image || typeof image !== 'object' || !image.assetId) return image;
    try {
      const access = assetService.signAccessUrl(image.assetId);
      return { ...image, accessUrl: access.url, accessUrlExpiresAt: access.expiresAt };
    } catch {
      return image;
    }
  });
}
function normalizeTaskImage(item, idx, taskId) {
  const raw = item && typeof item === 'object' ? item : { url: item };
  const { b64_json, b64Json, base64, dataUrl, data_url, ...safeRaw } = raw;
  const directUrl = firstString(raw.url, raw.imageUrl, raw.image_url);
  if (/^https?:\/\//i.test(directUrl)) {
    throw imageProxyError(500, 'PROVIDER_IMAGE_NOT_PERSISTED', '生成图片尚未保存到本地，拒绝写入外部地址');
  }
  const directIsUrl = /^https?:\/\//i.test(directUrl) || directUrl.startsWith('/');
  const persistedUrl = persistProviderImage(firstString(
    raw.b64_json,
    raw.b64Json,
    raw.base64,
    raw.dataUrl,
    raw.data_url,
    directIsUrl ? '' : directUrl
  ));
  const url = (directIsUrl ? directUrl : '') || persistedUrl || placeholderUrl(taskId);
  const normalizedUrl = /^data:image\//i.test(url) || /^https?:\/\//i.test(url) || url.startsWith('/') ? url : `data:image/png;base64,${url}`;
  const finalUrl = imageDisplayUrl(normalizedUrl);
  return { ...safeRaw, id: raw.id || `${taskId}_${idx}`, url: finalUrl, imageUrl: finalUrl, preview: finalUrl, originalUrl: normalizedUrl };
}
function makeTaskResponse(task) {
  return {
    id: task.id,
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    prompt: task.prompt,
    modelKey: task.modelKey,
    model: task.modelKey,
    resultImages: task.images,
    images: task.images,
    costPoints: task.cost,
    cost: task.cost,
    totalCost: task.totalCost || task.cost,
    analysisCost: task.analysisCost || 0,
    imageCost: task.imageCost || task.cost,
    analysisSummary: task.analysisSummary || '',
    finalPrompt: task.finalPrompt || task.prompt,
    request: task.request || null,
    providerRequest: task.request || null,
    errorMessage: task.errorMessage || '',
    routeId: task.routeId || '',
    lineId: task.lineId || task.routeId || '',
    routeKey: task.routeKey || '',
    lineKey: task.lineKey || task.routeKey || '',
    routeDisplayName: task.routeDisplayName || task.routeName || '',
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}
function pickTemplatePrompt(body = {}) {
  const selected = Array.isArray(body.selectedPrompts) && body.selectedPrompts.length ? body.selectedPrompts[0] : {};
  const fields = body.fields && typeof body.fields === 'object' ? body.fields : {};
  const fieldText = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join('，');
  return String(
    body.prompt ||
    body.selectedPrompt ||
    selected.prompt ||
    selected.text ||
    body.rawPromptText ||
    fields.userPrompt ||
    fieldText ||
    '电商产品主图，高清摄影，专业布光，画面干净，高级质感'
  ).trim();
}
function pickImageModel(body = {}) {
  return String(
    body.modelKey ||
    body.imageModelKey ||
    body.imageModelRealName ||
    body.imageModel ||
    body.model ||
    'gpt-image-2'
  ).trim();
}
function looksLikeImageModel(model = '') {
  const value = String(model || '').trim().toLowerCase();
  return !!value && !TXT.some(item => item.k.toLowerCase() === value) && (
    IMG.some(item => item.k.toLowerCase() === value) ||
    /image|img|banana|gemini.*flash|gemini.*preview/i.test(value)
  );
}
function resolveImageModelKey(body = {}) {
  const requested = pickImageModel(body);
  if (looksLikeImageModel(requested)) return requested;
  if (looksLikeImageModel(AI_IMAGE_MODEL)) return AI_IMAGE_MODEL;
  return IMG[0].k;
}
function createCompletedTask(req, source = {}) {
  const modelKey = source.modelKey || source.model || resolveImageModelKey(req.body);
  const imageCount = Math.max(1, Math.min(Number(source.imageCount || req.body.imageCount || req.body.n || 1) || 1, 4));
  const prompt = source.prompt || pickTemplatePrompt(req.body);
  const m = [...IMG, ...TXT].find(x => x.k === modelKey) || IMG[0];
  const cost = Number(source.cost || source.totalCost || ((m ? m.p : 15) * imageCount));
  const taskId = uid('task_');
  const sourceImages = Array.isArray(source.results) && source.results.length
    ? source.results
    : Array.from({ length: imageCount }, (_, i) => ({ url: placeholderUrl(`${prompt} ${i + 1}`) }));
  const images = sourceImages.map((img, i) => normalizeTaskImage({
    ...img,
    prompt,
    finalPrompt: source.finalPrompt || prompt,
    analysisSummary: source.analysisSummary || '',
    sourceTaskId: taskId,
    source: source.source || img.source || 'generation-task',
    request: source.request || img.request || null,
    providerRequest: source.request || img.providerRequest || img.request || null,
    meta: {
      ...(img.meta || {}),
      operation: source.operation || 'generation',
      prompt,
      finalPrompt: source.finalPrompt || prompt,
      analysisSummary: source.analysisSummary || '',
      modelKey,
      source: source.source || 'generation-task',
      providerRequest: source.request || img.meta?.providerRequest || null
    }
  }, i, taskId));
  const task = {
    id: taskId,
    userId: req.user.userId,
    status: 'success',
    progress: 100,
    prompt,
    modelKey,
    cost,
    totalCost: Number(source.totalCost || cost),
    analysisCost: Number(source.analysisCost || 0),
    imageCost: Number(source.imageCost || cost),
    analysisSummary: source.analysisSummary || '',
    finalPrompt: source.finalPrompt || prompt,
    request: source.request || null,
    images,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  tasks.set(taskId, task);
  const recordCostDivisor = Math.max(1, images.length || imageCount);
  images.forEach(img => {
    db.prepare('INSERT INTO generations (id,user_id,model_key,prompt,result_url,cost,status) VALUES (?,?,?,?,?,?,?)')
      .run(uid('gen_'), req.user.userId, modelKey, prompt, img.url, cost / recordCostDivisor, 'completed');
  });
  return task;
}

function createPendingTask(req, source = {}) {
  const modelKey = source.modelKey || source.model || resolveImageModelKey(req.body);
  const imageCount = Math.max(1, Math.min(Number(source.imageCount || req.body.imageCount || req.body.n || 1) || 1, 4));
  const prompt = source.prompt || pickTemplatePrompt(req.body);
  const m = [...IMG, ...TXT].find(x => x.k === modelKey) || IMG[0];
  const cost = Number(source.cost || source.totalCost || ((m ? m.p : 15) * imageCount));
  const taskId = uid('task_');
  const now = new Date().toISOString();
  const route = source.route || null;
  const routeId = route ? String(route.id || route.routeId || route.lineId || '').trim() : '';
  const routeKey = route ? String(route.rk || route.routeKey || route.lineKey || route.code || '').trim() : '';
  const task = {
    id: taskId,
    userId: req.user.userId,
    status: 'pending',
    progress: Number(source.progress || 6),
    prompt,
    modelKey,
    cost,
    totalCost: Number(source.totalCost || cost),
    analysisCost: Number(source.analysisCost || 0),
    imageCost: Number(source.imageCost || cost),
    analysisSummary: source.analysisSummary || '',
    finalPrompt: source.finalPrompt || prompt,
    request: source.request || null,
    images: [],
    errorMessage: '',
    routeId,
    lineId: routeId,
    routeKey,
    lineKey: routeKey,
    routeDisplayName: route ? String(route.displayName || route.dn || route.name || routeKey || routeId || '').trim() : '',
    createdAt: now,
    updatedAt: now
  };
  tasks.set(taskId, task);
  return task;
}

function updatePendingTaskQueueState(task, status, meta = {}) {
  if (!task || !['pending', 'running'].includes(task.status)) return task;
  const nextStatus = status === 'running' ? 'running' : 'pending';
  task.status = nextStatus;
  task.progress = nextStatus === 'running' ? Math.max(40, Number(task.progress || 0)) : Math.min(20, Math.max(6, Number(task.progress || 0)));
  task.request = {
    ...(task.request && typeof task.request === 'object' ? task.request : {}),
    queueMode: 'bounded-fair',
    queuePosition: nextStatus === 'pending' ? Math.max(1, Number(meta.queuePosition || 1)) : 0
  };
  task.updatedAt = new Date().toISOString();
  return task;
}

function completePendingTask(task, source = {}) {
  if (!task) return null;
  if (task.status === 'cancelled') return task;
  const modelKey = source.modelKey || source.model || task.modelKey || IMG[0].k;
  const imageCount = Math.max(1, Math.min(Number(source.imageCount || task.imageCount || 1) || 1, 4));
  const prompt = source.prompt || task.prompt || '生成图片';
  const cost = Number(source.cost || source.totalCost || task.cost || 0);
  const sourceImages = Array.isArray(source.results) && source.results.length
    ? source.results
    : Array.from({ length: imageCount }, (_, i) => ({ url: placeholderUrl(`${prompt} ${i + 1}`) }));
  const images = sourceImages.map((img, i) => normalizeTaskImage({
    ...img,
    prompt,
    finalPrompt: source.finalPrompt || task.finalPrompt || prompt,
    analysisSummary: source.analysisSummary || task.analysisSummary || '',
    sourceTaskId: task.id,
    source: source.source || img.source || 'generation-task',
    request: source.request || img.request || null,
    providerRequest: source.request || img.providerRequest || img.request || null,
    meta: {
      ...(img.meta || {}),
      operation: source.operation || 'generation',
      prompt,
      finalPrompt: source.finalPrompt || task.finalPrompt || prompt,
      analysisSummary: source.analysisSummary || task.analysisSummary || '',
      modelKey,
      source: source.source || 'generation-task',
      providerRequest: source.request || img.meta?.providerRequest || null
    }
  }, i, task.id));
  const now = new Date().toISOString();
  Object.assign(task, {
    status: 'success',
    progress: 100,
    prompt,
    modelKey,
    cost,
    totalCost: Number(source.totalCost || cost || task.totalCost || 0),
    analysisCost: Number(source.analysisCost || task.analysisCost || 0),
    imageCost: Number(source.imageCost || cost || task.imageCost || 0),
    analysisSummary: source.analysisSummary || task.analysisSummary || '',
    finalPrompt: source.finalPrompt || task.finalPrompt || prompt,
    request: source.request || task.request || null,
    images,
    errorMessage: '',
    updatedAt: now
  });
  const recordCostDivisor = Math.max(1, images.length || imageCount);
  images.forEach(img => {
    db.prepare('INSERT INTO generations (id,user_id,model_key,prompt,result_url,cost,status) VALUES (?,?,?,?,?,?,?)')
      .run(uid('gen_'), task.userId, modelKey, prompt, img.url, cost / recordCostDivisor, 'completed');
  });
  return task;
}

function failPendingTask(task, source = {}) {
  if (!task) return null;
  if (task.status === 'cancelled') return task;
  task.status = 'failed';
  task.progress = 100;
  task.errorMessage = source.message || source.errorMessage || '图片生成接口调用失败';
  task.request = source.request || task.request || null;
  task.updatedAt = new Date().toISOString();
  return task;
}

function resolveRequestImageRoute(body = {}) {
  const routeId = String(body.routeId || body.lineId || body.routeKey || body.lineKey || '').trim();
  return findRouteByAnyId(routeId);
}

function normalizeProviderContentText(content, depth = 0) {
  if (depth > 8 || content === undefined || content === null) return '';
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map(item => normalizeProviderContentText(item, depth + 1))
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  if (typeof content !== 'object') return '';
  const direct = firstString(
    content.output_text,
    content.outputText,
    content.finalPrompt,
    content.final_prompt,
    content.imagePrompt,
    content.image_prompt,
    content.prompt,
    content.answer,
    content.response_text,
    content.responseText,
    content.result_text,
    content.resultText,
    content.reasoning_content,
    content.reasoningContent,
    content.text,
    content.value,
    content.content
  );
  if (direct) return direct.trim();
  const nested = [
    content.output,
    content.outputs,
    content.choices,
    content.message,
    content.delta,
    content.content,
    content.text,
    content.value,
    content.answer,
    content.data,
    content.result,
    content.response,
    content.finalPrompt,
    content.final_prompt,
    content.imagePrompt,
    content.image_prompt,
    content.prompt,
    content.reasoning,
    content.reasoning_content,
    content.reasoningContent
  ];
  for (const item of nested) {
    const text = normalizeProviderContentText(item, depth + 1);
    if (text) return text;
  }
  return '';
}

function imageToolOutputText(data = {}) {
  const direct = normalizeProviderContentText({
    output_text: data.output_text,
    outputText: data.outputText,
    finalPrompt: data.finalPrompt,
    final_prompt: data.final_prompt,
    imagePrompt: data.imagePrompt,
    image_prompt: data.image_prompt,
    prompt: data.prompt,
    answer: data.answer,
    response_text: data.response_text,
    responseText: data.responseText,
    result_text: data.result_text,
    resultText: data.resultText,
    reasoning_content: data.reasoning_content,
    reasoningContent: data.reasoningContent,
    text: data.text,
    content: data.content
  });
  if (direct) return direct;
  if (Array.isArray(data.output)) {
    const text = normalizeProviderContentText(data.output);
    if (text) return text;
  }
  if (Array.isArray(data.choices)) {
    for (const choice of data.choices) {
      const text = normalizeProviderContentText([
        choice?.message?.content,
        choice?.message,
        choice?.delta?.content,
        choice?.text
      ]);
      if (text) return text;
    }
  }
  return normalizeProviderContentText([data.message, data.data, data.result, data.response]);
}

function providerResponseShape(value, depth = 0) {
  if (depth > 5) return 'max-depth';
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `string(${value.length})`;
  if (typeof value === 'number' || typeof value === 'boolean') return typeof value;
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      sample: value.slice(0, 3).map(item => providerResponseShape(item, depth + 1))
    };
  }
  if (typeof value !== 'object') return typeof value;
  const result = {};
  for (const key of Object.keys(value).slice(0, 30)) {
    if (/key|token|secret|authorization|password/i.test(key)) {
      result[key] = 'redacted';
    } else {
      result[key] = providerResponseShape(value[key], depth + 1);
    }
  }
  return result;
}

app.get('/api/image-tools/settings', auth, (req, res) => {
  res.json({
    success: true,
    tools: {
      outpaint: { enabled: true, mode: 'image-edit' },
      reversePrompt: { enabled: true, mode: 'responses' },
      smartErase: { enabled: true, mode: 'image-edit' },
      inpaint: { enabled: true, mode: 'image-edit' },
      compress: { enabled: true, mode: 'local' },
      resize: { enabled: true, mode: 'local' },
      crop: { enabled: true, mode: 'local' }
    }
  });
});

app.get('/api/image-tools/tasks/:id', auth, (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task || task.userId !== req.user.userId) return res.status(404).json({ message: '任务不存在' });
  res.json(makeTaskResponse(task));
});

registerImageToolRoutes(app, {
  auth,
  uid,
  firstString,
  buildEcommerceImagePrompt,
  normalizeTaskImage,
  resolveImageRoute,
  resolveImageModelKey,
  resolveTextRoute,
  callProviderImageEdit,
  callProviderResponses,
  persistProviderImageResults,
  withAssetAccessFields,
  attachGeneratedResultAssets,
  createCompletedTask,
  makeTaskResponse,
  loadReferenceImageFile,
  imageToolOutputText,
  aiTextModel: AI_TEXT_MODEL
});

registerCanvasPromptRoutes(app, {
  auth,
  canvasPromptImageLabel,
  resolveTextRoute,
  callProviderResponses,
  imageToolOutputText,
  aiTextModel: AI_TEXT_MODEL
});

app.post('/api/canvas/enhance-prompt', auth, async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const originalPrompt = String(body.currentPrompt || body.prompt || body.requirement || body.text || '').trim().slice(0, 12000);
  const referenceCount = imageReferenceCandidates(body).length;
  if (!originalPrompt && referenceCount <= 0) {
    return res.status(400).json({
      success: false,
      code: 'CANVAS_PROMPT_INPUT_REQUIRED',
      message: '请先输入提示词或连接参考图'
    });
  }

  const userKey = String(req.user.userId || '');
  if (canvasPromptEnhanceInFlight.has(userKey)) {
    return res.status(429).json({
      success: false,
      code: 'CANVAS_PROMPT_ENHANCE_IN_FLIGHT',
      message: '当前提示词正在扩写，请等待完成后再试'
    });
  }

  canvasPromptEnhanceInFlight.add(userKey);
  try {
    let references;
    try {
      references = await loadCanvasPromptEnhancementReferences(body, req);
    } catch (error) {
      return res.status(400).json({
        success: false,
        code: error.code || 'CANVAS_PROMPT_REFERENCE_UNREADABLE',
        message: error.message || '参考图读取失败'
      });
    }

    const route = resolveTextRoute(body);
    const model = String(route?.dm || AI_TEXT_MODEL).trim();
    const providerResult = await callProviderResponses(
      buildCanvasPromptEnhancementInput(originalPrompt, references),
      { route, model }
    );
    if (!providerResult.success) {
      return res.status(502).json({
        success: false,
        code: providerResult.code || 'CANVAS_PROMPT_ENHANCE_FAILED',
        message: providerResult.message || 'GPT‑5.6 提示词扩写失败，原提示词未修改',
        provider: providerResult.provider
      });
    }

    const providerPrompt = providerResult.mock ? '' : normalizeCanvasEnhancedPrompt(imageToolOutputText(providerResult));
    if (!providerResult.mock && providerPrompt.length < CANVAS_PROMPT_ENHANCE_MIN_LENGTH) {
      return res.status(502).json({
        success: false,
        code: 'CANVAS_PROMPT_ENHANCE_OUTPUT_TOO_SHORT',
        message: 'GPT‑5.6 返回的提示词过短，原提示词未修改',
        provider: providerResult.provider
      });
    }

    const prompt = providerPrompt || buildCanvasPromptEnhancementFallback(originalPrompt, references.length);
    return res.json({
      success: true,
      mock: !!providerResult.mock,
      free: true,
      costPoints: 0,
      prompt,
      text: prompt,
      originalPrompt,
      imageCount: references.length,
      imageLabels: references.map(reference => reference.label),
      textModel: model,
      textRouteId: route?.id || route?.routeId || '',
      provider: providerResult.provider
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 'CANVAS_PROMPT_ENHANCE_ERROR',
      message: error.message || '提示词扩写失败，原提示词未修改'
    });
  } finally {
    canvasPromptEnhanceInFlight.delete(userKey);
  }
});

registerEcommerceSuiteRoutes(app, {
  auth,
  db,
  balanceService,
  settingsState,
  normalizeEcommerceSuiteAgentConfig,
  defaultEcommerceSuiteAgent,
  defaultEcommerceSuiteSkills,
  cleanSettingKey,
  firstString,
  uid,
  summarizeText,
  sanitizeSkillMarkdown,
  loadReferenceImageFile,
  imageToolOutputText,
  parseJsonObjectFromText,
  resolveTextRoute,
  resolveImageRoute,
  resolveImageModelKey,
  modelCost,
  callProviderResponses,
  callProviderImageEdit,
  callProviderImageGeneration,
  buildEcommerceImagePrompt,
  persistProviderImageResults,
  createCompletedTask,
  aiImageModel: AI_IMAGE_MODEL,
  aiTextModel: AI_TEXT_MODEL,
  canvasDialogAnalysisTimeoutMs: CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS
});

app.post('/api/canvas/dialog-agent-generate', auth, async (req, res) => {
  const body = req.body || {};
  const requirement = String(body.requirement || body.prompt || body.message || body.text || '').trim();
  const rawReferences = imageReferenceCandidates(body);
  if (!requirement && rawReferences.length <= 0) {
    return res.status(400).json({ success: false, code: 'CANVAS_DIALOG_AGENT_INPUT_REQUIRED', message: '请输入生成需求或上传参考图' });
  }

  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.userId);
  if (!u) return res.status(401).json({ success: false, code: 'AUTH_USER_NOT_FOUND', message: '登录状态已失效，请重新登录' });

  const textRoute = resolveTextRoute(body);
  const imageRoute = resolveImageRoute(body, req.user.userId);
  const debugAnalysisOnly = body.debugAnalysisOnly === true && u.role === 'admin';
  const textModel = String(body.textModel || body.textModelKey || textRoute?.dm || AI_TEXT_MODEL).trim();
  const imageModel = resolveImageModelKey({ ...body, model: body.imageModel || body.imageModelKey || body.model || imageRoute?.dm || AI_IMAGE_MODEL });
  const imageCount = Math.max(1, Math.min(Number(body.imageCount || body.count || body.n || 1) || 1, 4));
  const analysisCost = modelCost(textModel, 'text');
  const imageCost = modelCost(imageModel, 'image') * imageCount;
  const totalCost = analysisCost + imageCost;
  if (u.balance < totalCost) {
    return res.status(400).json({ success: false, code: 'INSUFFICIENT_BALANCE', message: `算力不足，需要 ${totalCost}，当前 ${u.balance}`, totalCost, analysisCost, imageCost });
  }

  let analysisReferences = [];
  try {
    analysisReferences = await canvasDialogReferencesForAnalysis(body, req);
  } catch (error) {
    return res.status(400).json({ success: false, code: 'CANVAS_DIALOG_REFERENCE_UNREADABLE', message: error.message || '参考图读取失败' });
  }

  const analysisInput = buildCanvasDialogAgentInput(requirement, analysisReferences);
  const textResult = await callProviderResponses(analysisInput, {
    route: textRoute,
    model: textModel,
    timeoutMs: CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS
  });
  if (!textResult.success) {
    const analysisTimedOut = textResult.code === 'PROVIDER_TIMEOUT';
    return res.status(502).json({
      success: false,
      code: analysisTimedOut ? 'CANVAS_DIALOG_ANALYSIS_TIMEOUT' : (textResult.code || 'CANVAS_DIALOG_ANALYSIS_FAILED'),
      message: analysisTimedOut
        ? `GPT 5.6 Terra 分析超时（已等待 ${Math.round(CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS / 1000)} 秒），请稍后重试或减少参考图/提示词长度`
        : (textResult.message || 'GPT 5.6 Terra 分析失败，请稍后重试'),
      stage: 'analysis',
      provider: textResult.provider,
      analysisCost,
      imageCost,
      totalCost
    });
  }

  const agentPlan = textResult.mock
    ? mockCanvasDialogAgentPlan(requirement, analysisReferences.length)
    : parseCanvasDialogAgentPlan(textResult, requirement, analysisReferences.length);
  if (debugAnalysisOnly) {
    const extractedText = imageToolOutputText(textResult);
    return res.json({
      success: !!agentPlan,
      debugAnalysisOnly: true,
      stage: 'analysis',
      parseOk: !!agentPlan,
      textModel,
      textRouteId: textRoute?.id || textRoute?.routeId || '',
      referenceCount: analysisReferences.length,
      extractedTextLength: extractedText.length,
      extractedTextPreview: summarizeText(extractedText, 1200),
      analysisSummary: agentPlan?.analysisSummary || '',
      finalPrompt: agentPlan?.finalPrompt || '',
      responseShape: providerResponseShape(textResult),
      provider: textResult.provider,
      analysisCost,
      imageCost,
      totalCost,
      charged: false
    });
  }
  if (!agentPlan || !agentPlan.finalPrompt) {
    return res.status(502).json({
      success: false,
      code: 'CANVAS_DIALOG_ANALYSIS_BAD_RESPONSE',
      message: 'GPT 5.6 Terra 未返回可用的生图提示词，请稍后重试',
      provider: textResult.provider,
      stage: 'analysis',
      extractedTextLength: imageToolOutputText(textResult).length,
      responseShape: providerResponseShape(textResult),
      analysisCost,
      imageCost,
      totalCost
    });
  }

  const hasReferenceImages = rawReferences.length > 0;
  const providerOptions = {
    ...body,
    body,
    req,
    route: imageRoute,
    model: imageModel,
    modelKey: imageModel,
    n: imageCount,
    imageCount
  };
  const rawProviderPrompt = rawReferences.length > 1
    ? `输入参考图按顺序为：${rawReferences.map((_, index) => `图${index + 1}`).join('、')}。\n${agentPlan.finalPrompt}`
    : agentPlan.finalPrompt;
  const providerPrompt = hasReferenceImages
    ? buildEcommerceImagePrompt(rawProviderPrompt, { body, hasReferenceImages, referenceCount: rawReferences.length })
    : rawProviderPrompt;
  const imageResult = hasReferenceImages
    ? await callProviderImageEdit(providerPrompt, providerOptions)
    : await callProviderImageGeneration(providerPrompt, providerOptions);
  if (!imageResult.success) {
    return res.status(502).json({
      success: false,
      code: imageResult.code || 'CANVAS_DIALOG_IMAGE_FAILED',
      message: imageResult.message || 'GPT Image 2 生图失败，请稍后重试',
      provider: imageResult.provider,
      analysisSummary: agentPlan.analysisSummary,
      finalPrompt: providerPrompt,
      analysisCost,
      imageCost,
      totalCost
    });
  }

  const persistedResults = await persistProviderImageResults(imageResult.images, imageResult.request);
  const task = createCompletedTask(req, {
    prompt: providerPrompt,
    finalPrompt: providerPrompt,
    analysisSummary: agentPlan.analysisSummary,
    modelKey: imageModel,
    imageCount,
    results: persistedResults,
    cost: totalCost,
    totalCost,
    analysisCost,
    imageCost,
    request: imageResult.request,
    operation: 'canvas-dialog-agent',
    source: 'canvas-chat-dialog-agent'
  });
  const nb = u.balance - totalCost;
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(nb, u.id);
  balanceService.recordBalanceLog(u.id, 'generation', -totalCost, u.balance, nb, `对话 Agent 生图: ${textModel} + ${imageModel} x${imageCount}`);

  res.json({
    success: true,
    mock: !!textResult.mock || !!imageResult.mock,
    editMode: !!imageResult.editMode,
    provider: imageResult.provider,
    analysisProvider: textResult.provider,
    textModel,
    imageModel,
    imageRouteId: imageRoute?.id || imageRoute?.routeId || '',
    textRouteId: textRoute?.id || textRoute?.routeId || '',
    remainingBalance: nb,
    ...makeTaskResponse(task)
  });
});

function persistentTaskProgress(task) {
  if (!task) return 0;
  if (['success', 'failed', 'cancelled'].includes(task.status)) return 100;
  const progressByStage = {
    queued: 10,
    provider_degraded: 12,
    preparing: 20,
    connecting: 35,
    awaiting_provider: 55,
    persisting: 85,
    done: 100
  };
  return progressByStage[task.stage] || (task.status === 'running' ? 45 : 10);
}

function makePersistentTaskResponse(task) {
  const queuePosition = task.status === 'pending'
    ? (task.queuePosition || generationTaskRepository.queuePosition(task.id))
    : 0;
  const retryAfterMs = Math.max(0, Number(task.retryAfterMs || task.request?.retryAfterMs || 0));
  const now = Date.now();
  const elapsedMs = Math.max(0, (task.finishedAtMs || now) - task.createdAtMs);
  const warnings = Array.isArray(task.request?.warnings) ? task.request.warnings : [];
  // 已落云端资产库的结果附带 assetId 与 15 分钟短时展示 URL（签名失败不阻断任务响应）。
  const imagesWithAssets = (Array.isArray(task.images) ? task.images : []).map((image) => {
    if (!image || typeof image !== 'object' || !image.assetId) return image;
    try {
      const access = assetService.signAccessUrl(image.assetId);
      return { ...image, accessUrl: access.url, accessUrlExpiresAt: access.expiresAt };
    } catch {
      return image;
    }
  });
  const firstAssetImage = imagesWithAssets.find((image) => image && typeof image === 'object' && image.assetId) || null;
  return {
    id: task.id,
    taskId: task.id,
    status: task.status,
    stage: task.stage,
    progress: persistentTaskProgress(task),
    prompt: task.prompt,
    modelKey: task.modelKey,
    model: task.modelKey,
    resultImages: imagesWithAssets,
    images: imagesWithAssets,
    assetId: firstAssetImage ? firstAssetImage.assetId : undefined,
    accessUrl: firstAssetImage && firstAssetImage.accessUrl ? firstAssetImage.accessUrl : undefined,
    costPoints: task.settledCost || task.reservedCost,
    cost: task.settledCost || task.reservedCost,
    totalCost: task.settledCost || task.reservedCost,
    reservedCost: task.reservedCost,
    settledCost: task.settledCost,
    billingStatus: task.billingStatus,
    partial: !!task.request?.partial,
    warnings,
    request: {
      ...(task.request || {}),
      queueMode: 'persistent-bounded-fair',
      queuePosition,
      failureDomain: task.failureDomain,
      retryAfterMs
    },
    providerRequest: task.request || null,
    errorCode: task.errorCode || '',
    errorMessage: task.errorMessage || '',
    routeId: task.routeId || '',
    lineId: task.routeId || '',
    routeKey: task.routeKey || '',
    lineKey: task.routeKey || '',
    routeDisplayName: task.routeDisplayName || '',
    queuePosition,
    retryAfterMs,
    canCancel: ['pending', 'running'].includes(task.status),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    elapsedMs
  };
}

function routeForPersistentTask(task) {
  const routes = routeState();
  return routes.find((route) => routeMatchesId(route, task.routeId) || routeMatchesId(route, task.routeKey))
    || resolveImageRoute(task.requestPayload?.body || {}, task.userId);
}

async function executePersistentGenerationItem(task, item, signal) {
  const body = task.requestPayload?.body || {};
  const providerPrompt = task.requestPayload?.providerPrompt || task.prompt;
  const route = routeForPersistentTask(task);
  const hasReferenceImages = imageReferenceCandidates(body).length > 0;
  const providerOptions = {
    ...body,
    body,
    route,
    model: task.modelKey,
    n: 1,
    taskId: task.id,
    userId: task.userId,
    signal,
    onProviderStage: (stage, meta) => generationTaskRepository.markTaskStage(task.id, stage, meta),
    bypassProviderQueue: true
  };
  const providerResult = hasReferenceImages
    ? await callProviderImageEdit(providerPrompt, providerOptions)
    : await callProviderImageGeneration(providerPrompt, providerOptions);
  if (!providerResult.success) return providerResult;
  const providerRequestMeta = {
    ...(providerResult.request || {}),
    mock: !!providerResult.mock
  };
  let persistedResults;
  try {
    persistedResults = await persistProviderImageResults(providerResult.images, providerRequestMeta);
    persistedResults = await attachGeneratedResultAssets(task.userId, persistedResults, { taskId: task.id, prompt: task.prompt });
  } catch (error) {
    if (!error.code) {
      error.code = 'GENERATION_ASSET_PERSIST_FAILED';
      error.status = 500;
      error.message = error.message || '生成图片写入云端资产库失败';
    }
    error.requestMeta = {
      ...providerRequestMeta,
      providerBillingStatus: providerRequestMeta.providerBillingStatus || 'charged_assumed',
      upstreamBillingAmbiguous: true,
      billingAuditRequired: true,
      localPersistenceFailed: true
    };
    throw error;
  }
  const normalizedImages = persistedResults.map((image, index) => normalizeTaskImage({
    ...image,
    prompt: providerPrompt,
    finalPrompt: providerPrompt,
    sourceTaskId: task.id,
    source: 'persistent-generation-task',
    request: providerRequestMeta,
    providerRequest: providerRequestMeta,
    meta: {
      operation: 'generation-task',
      prompt: providerPrompt,
      finalPrompt: providerPrompt,
      modelKey: task.modelKey,
      source: 'persistent-generation-task',
      providerRequest: providerRequestMeta
    }
  }, index, `${task.id}_${item.itemIndex}`));
  return {
    ...providerResult,
    success: true,
    images: normalizedImages,
    request: providerRequestMeta,
    generationIdFactory: () => uid('gen_')
  };
}

const generationTaskService = new GenerationTaskService({
  repository: generationTaskRepository,
  scheduler: imageRequestScheduler,
  executeItem: executePersistentGenerationItem
});
const recoveredGenerationTasks = generationTaskService.start();
if (recoveredGenerationTasks.length) {
  console.warn(`[GENERATION_RECOVERY] ${recoveredGenerationTasks.length} 个中断任务已安全失败并退款`);
}

async function callCanvasAgentProvider(input, options = {}) {
  const route = options.route || resolveTextRoute({});
  const status = routeProviderStatus(route, 'text');
  const modelKey = String(options.model || route?.dm || AI_TEXT_MODEL).trim();
  if (!status.enabled) {
    return callProviderResponses(input, { ...options, route, model: modelKey, status });
  }

  const user = db.prepare("SELECT * FROM users WHERE id=? AND status='active'").get(options.agentUserId);
  if (!user) throw integrationError(401, 'AUTH_USER_NOT_FOUND', '登录状态已失效，请重新登录');
  const turnId = String(options.agentTurnId || uid('agent_turn_')).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  const requestId = `canvas_agent_${turnId}`.slice(0, 120);
  const stepHash = crypto.createHash('sha256').update(JSON.stringify({ modelKey, input })).digest('hex');
  const pricedModel = { k: modelKey, p: modelCost(modelKey, 'text') };
  reserveChatCharge(requestId, user, pricedModel, stepHash, true);
  const result = await callProviderResponses(input, {
    ...options,
    route,
    model: modelKey,
    status,
    maxTransientRetries: CANVAS_AGENT_MAX_TRANSIENT_RETRIES
  });
  if (result.success) {
    completeChatStep(requestId, stepHash, false);
  } else {
    refundChatCharge(requestId, result.message || 'Canvas Agent 上游调用失败', stepHash);
  }
  return result;
}

// Agent 附件图直接随规划消息提供（多模态）：assetId → 短时 URL → 读字节 → dataUrl。
// 单张超过 3MB 不附带（可用分析工具按需查看），保持规划请求体积可控。
async function loadAgentAttachmentImage(attachment = {}, userId = '') {
  const assetId = String(attachment.assetId || '').trim();
  if (!assetId || !userId) return null;
  const access = await assetService.createAccessUrl(userId, assetId).catch(() => null);
  if (!access?.url) return null;
  const reference = await loadReferenceImageFile({ url: access.url });
  if (!reference.buffer.length) return null;
  // 超过 3MB 的附件先压缩再附带（2048px WebP 为主，仍超则降到 1024px），不再跳过。
  if (reference.buffer.length > 3 * 1024 * 1024) {
    const compressed = await compressAgentAttachmentImage(reference.buffer);
    if (!compressed) return null;
    return `data:image/webp;base64,${compressed.toString('base64')}`;
  }
  return `data:${reference.mime};base64,${reference.buffer.toString('base64')}`;
}

async function compressAgentAttachmentImage(buffer) {
  const attempts = [
    { width: 2048, quality: 82 },
    { width: 1024, quality: 70 }
  ];
  for (const attempt of attempts) {
    try {
      const out = await sharp(buffer).resize({ width: attempt.width, withoutEnlargement: true }).webp({ quality: attempt.quality }).toBuffer();
      if (out.length <= 3 * 1024 * 1024) return out;
    } catch {
      return null;
    }
  }
  return null;
}

const canvasAgentPlanner = createCanvasAgentPlanner({
  callProvider: callCanvasAgentProvider,
  loadAttachmentImage: loadAgentAttachmentImage,
  providerOptions: (input) => {
    const route = resolveTextRoute({});
    return {
      route,
      model: String(route?.dm || AI_TEXT_MODEL).trim(),
      timeoutMs: CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS,
      agentUserId: input.userId,
      agentSessionId: input.sessionId,
      agentTurnId: input.turnId
    };
  }
});

// Agent 附件内容分析（按需）：资产签短时同源 URL → 读取图片字节 → 文本路线视觉识别 → 文字描述。
// 与 /api/image-tools/reverse-prompt 共用 callProviderResponses 与 loadReferenceImageFile，不产生画布写操作。
const agentDescribeCache = new Map();
const AGENT_DESCRIBE_CACHE_TTL_MS = 30 * 60 * 1000;
async function describeAgentAssetImage(userId, input = {}) {
  const rawAssetId = String(input.attachmentId || input.assetId || '').trim();
  const assetId = rawAssetId.startsWith('attachment_') ? rawAssetId.slice('attachment_'.length) : rawAssetId;
  if (!assetId) throw integrationError(400, 'CANVAS_AGENT_DESCRIBE_INPUT_REQUIRED', '缺少要分析的附件 attachmentId');
  const cacheKey = `${userId}:${assetId}`;
  const cached = agentDescribeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < AGENT_DESCRIBE_CACHE_TTL_MS) return { ...cached.result, cached: true };
  const asset = assetService.getAsset(userId, assetId);
  const access = await assetService.createAccessUrl(userId, asset.id);
  const reference = await loadReferenceImageFile({ url: access.url });
  const route = resolveTextRoute({});
  const model = String(route?.dm || AI_TEXT_MODEL).trim();
  const instruction = [
    '请分析这张图片，输出简洁中文描述：主体是什么、外观与包装要点、构图、光线、色调、画面中的文字，以及适合电商作图的观察。',
    '不要输出提示词，不要输出列表标题，直接描述画面'
  ].join('\n');
   const providerResult = await callProviderResponses([{
    role: 'user',
    content: [
      { type: 'input_text', text: instruction },
      { type: 'input_image', image_url: `data:${reference.mime};base64,${reference.buffer.toString('base64')}` }
    ]
  }], { route, model });
  if (!providerResult.success) {
    throw integrationError(502, providerResult.code || 'CANVAS_AGENT_DESCRIBE_FAILED', providerResult.message || '附件图片分析失败');
  }
  const result = {
    attachmentId: asset.id,
    name: asset.name,
    description: imageToolOutputText(providerResult) || '（模型未返回有效描述）',
    provider: providerResult.provider?.mode || 'real'
  };
  agentDescribeCache.set(cacheKey, { at: Date.now(), result });
  if (agentDescribeCache.size > 200) agentDescribeCache.delete(agentDescribeCache.keys().next().value);
  return result;
}

const canvasAgentSiteTools = createCanvasAgentSiteTools({
  db,
  generationTaskService,
  promptService,
  assetService,
  describeAssetImage: describeAgentAssetImage,
  listRoutes: (_userId, group) => filteredRoutes(group).map(route => ({
    id: route.id,
    displayName: route.displayName,
    enabled: route.enabled,
    isDefault: route.isDefault,
    defaultModelKey: route.defaultModelKey,
    group: route.group
  })),
  listModels: (_userId, routeId) => {
    const route = filteredRoutes('image').find(item => routeMatchesId(item, routeId));
    return (route?.models || []).map(model => ({
      modelKey: model.modelKey,
      displayName: model.displayName,
      enabled: model.enabled,
      points: model.pointCost,
      qualities: model.qualities || []
    }));
  },
  submitGeneration: async (input) => {
    const request = {
      user: { userId: input.userId },
      body: input.body,
      get: (name) => String(name || '').toLowerCase() === 'idempotency-key' ? input.idempotencyKey : ''
    };
    return submitPersistentGenerationTask(
      request,
      { ...input.body, clientRequestId: input.idempotencyKey },
      {
        idempotencyKey: input.idempotencyKey,
        source: 'canvas-agent',
        requestMeta: {
          projectId: input.projectId,
          agentSessionId: input.sessionId,
          agentToolCallId: input.callId
        }
      }
    );
  }
});

const agentSkillRepository = createAgentSkillRepository({ db, idFactory: uid });

const canvasAgentRuntime = createCanvasAgentRuntime({
  repository: canvasAgentRepository,
  planner: canvasAgentPlanner,
  siteTools: canvasAgentSiteTools,
  idFactory: uid,
  resolveSkills: (skillIds, resolveOptions) => agentSkillRepository.resolveEnabledSkills(skillIds, resolveOptions)
});
const recoveredCanvasAgentState = canvasAgentRuntime.start();
if (recoveredCanvasAgentState.sessions || recoveredCanvasAgentState.toolCalls) {
  console.warn(
    `[CANVAS_AGENT_RECOVERY] ${recoveredCanvasAgentState.sessions} 个会话、${recoveredCanvasAgentState.toolCalls} 个工具调用已进入 interrupted 安全终态`
  );
}

registerCanvasAgentRoutes(app, {
  auth,
  runtime: canvasAgentRuntime,
  assertProjectAccess(userId, projectId) {
    const project = db.prepare('SELECT id FROM projects WHERE id=? AND user_id=?').get(projectId, userId);
    if (!project) throw integrationError(404, 'CANVAS_AGENT_PROJECT_NOT_FOUND', '项目不存在');
  }
});

registerAgentSkillRoutes(app, { auth, admin, agentSkillRepository });

cleanupExpiredGenerationTaskInputs().catch((error) => {
  console.warn(`[GENERATION_INPUT_CLEANUP] ${error.message}`);
});
const generationInputCleanupTimer = setInterval(() => {
  cleanupExpiredGenerationTaskInputs().catch((error) => {
    console.warn(`[GENERATION_INPUT_CLEANUP] ${error.message}`);
  });
}, GENERATION_INPUT_CLEANUP_INTERVAL_MS);
if (typeof generationInputCleanupTimer.unref === 'function') generationInputCleanupTimer.unref();

async function submitPersistentGenerationTask(req, body = req.body || {}, options = {}) {
  const prompt = body.prompt || body.selectedPrompt || '';
  const references = imageReferenceCandidates(body);
  if (!prompt && !references.length) {
    throw generationInputError(400, 'IMAGE_PROMPT_REQUIRED', '请输入提示词或上传参考图');
  }
  const rawIdempotencyKey = String(
    options.idempotencyKey || req.get?.('Idempotency-Key') || body.clientRequestId || body.idempotencyKey || ''
  ).trim();
  if (rawIdempotencyKey.length > 128) {
    throw generationInputError(400, 'IDEMPOTENCY_KEY_INVALID', '幂等键长度不能超过 128 个字符');
  }
  const idempotencyKey = rawIdempotencyKey || uid('idem_');
  const requestHash = generationRequestHash(body);
  const existing = generationTaskRepository.findByIdempotency(req.user.userId, idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw generationInputError(409, 'IDEMPOTENCY_KEY_REUSED', '同一个幂等键不能用于不同的生图请求');
    }
    return {
      task: existing,
      replayed: true,
      remainingBalance: Number(db.prepare('SELECT balance FROM users WHERE id=?').get(req.user.userId)?.balance || 0)
    };
  }

  const taskId = uid('task_');
  const staged = await stageGenerationTaskBody(body, taskId, req);
  try {
    const modelKey = resolveImageModelKey(body);
    const model = [...IMG, ...TXT].find((item) => item.k === modelKey) || IMG[0];
    const imageCount = Math.max(1, Math.min(Number(body.imageCount || body.n || 1) || 1, 4));
    const unitCost = Number(model?.p || 15);
    const route = resolveImageRoute(body, req.user.userId);
    const hasReferenceImages = staged.requestMeta.referenceImageCount > 0;
    const providerPrompt = options.providerPrompt
      || buildImageGenerateNodePrompt(prompt, { body, hasReferenceImages });
    const result = generationTaskService.submit({
      id: taskId,
      userId: req.user.userId,
      idempotencyKey,
      requestHash,
      routeId: String(route.id || route.routeId || route.lineId || ''),
      routeKey: String(route.rk || route.routeKey || route.lineKey || route.code || ''),
      routeDisplayName: routeDisplayName(route),
      failureDomain: imageProviderFailureDomain(route),
      modelKey,
      prompt: providerPrompt,
      imageCount,
      unitCost,
      reservedCost: unitCost * imageCount,
      requestPayload: {
        body: staged.body,
        providerPrompt,
        source: options.source || 'generation-task'
      },
      requestMeta: {
        ...staged.requestMeta,
        size: providerImageRequestSize(body, body.sizeTier || body.resolution || body.clarity || body.quality),
        quality: body.quality || body.imageQuality || '',
        pending: true,
        ...(options.requestMeta || {})
      }
    });
    if (result.replayed) await removeGenerationTaskInputs(taskId);
    return result;
  } catch (error) {
    await removeGenerationTaskInputs(taskId);
    throw error;
  }
}

app.post('/api/generate/tasks', auth, async (req, res) => {
  try {
    const result = await submitPersistentGenerationTask(req);
    const task = generationTaskService.getTask(result.task.id) || result.task;
    res.status(202).json({
      success: true,
      accepted: true,
      pending: ['pending', 'running'].includes(task.status),
      replayed: result.replayed,
      remainingBalance: result.remainingBalance,
      ...makePersistentTaskResponse(task)
    });
  } catch (error) {
    if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
    res.status(error.status || 500).json({
      success: false,
      code: error.code || 'GENERATION_TASK_SUBMIT_FAILED',
      message: error.message || '生图任务提交失败'
    });
  }
});
app.get('/api/generate/tasks/:id', auth, (req, res) => {
  const task = generationTaskService.getTask(req.params.id);
  if (!task || task.userId !== req.user.userId) {
    return res.status(404).json({ success: false, code: 'TASK_NOT_FOUND', message: '任务不存在' });
  }
  res.json(makePersistentTaskResponse(task));
});
app.post('/api/generate/tasks/:id/cancel', auth, (req, res) => {
  try {
    const task = generationTaskService.getTask(req.params.id);
    if (!task || task.userId !== req.user.userId) {
      return res.status(404).json({ success: false, code: 'TASK_NOT_FOUND', message: '任务不存在' });
    }
    const cancelled = generationTaskService.cancel(req.params.id, {
      reason: String(req.body?.reason || '用户取消').slice(0, 200)
    });
    res.json({ success: true, ...makePersistentTaskResponse(cancelled) });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      code: error.code || 'TASK_CANCEL_FAILED',
      message: error.message || '取消任务失败'
    });
  }
});
app.post('/api/generate/tasks/:id/retry', auth, async (req, res) => {
  try {
    const original = generationTaskService.getTask(req.params.id);
    if (!original || original.userId !== req.user.userId) {
      return res.status(404).json({ success: false, code: 'TASK_NOT_FOUND', message: '任务不存在' });
    }
    if (!['failed', 'cancelled'].includes(original.status)) {
      throw generationInputError(409, 'GENERATION_TASK_NOT_RETRYABLE', '只有失败或已取消的任务可以人工重试');
    }
    const hasBillingRisk = original.request?.upstreamBillingAmbiguous === true
      || original.request?.providerBillingStatus === 'unknown'
      || original.request?.billingAuditRequired === true;
    if (hasBillingRisk && req.body?.confirmUpstreamBillingRisk !== true) {
      throw generationInputError(
        409,
        'GENERATION_RETRY_BILLING_CONFIRMATION_REQUIRED',
        '上一单的上游计费状态未知；请确认可能重复计费的风险后再人工重试'
      );
    }
    const retryBody = JSON.parse(JSON.stringify(original.requestPayload?.body || {}));
    delete retryBody.clientRequestId;
    delete retryBody.idempotencyKey;
    const localInputs = [
      ...imageReferenceCandidates(retryBody),
      ...(retryBody.mask && typeof retryBody.mask === 'object' ? [retryBody.mask] : [])
    ].filter((input) => input.localPath);
    const retryInputDirectory = generationTaskInputDirectory(original.id);
    let inputDirectoryExpired = false;
    if (localInputs.length > 0) {
      try {
        inputDirectoryExpired = Date.now() - fs.statSync(retryInputDirectory).mtimeMs >= GENERATION_INPUT_RETENTION_MS;
      } catch {
        inputDirectoryExpired = true;
      }
    }
    if (
      inputDirectoryExpired
      || localInputs.some((input) => !fs.existsSync(path.resolve(input.localPath)))
    ) {
      throw generationInputError(
        410,
        'GENERATION_RETRY_INPUT_EXPIRED',
        '原任务参考图已超过保留期或已被清理，请重新上传后再试'
      );
    }
    const retryIdempotencyKey = uid('retry_');
    const result = await submitPersistentGenerationTask(req, retryBody, {
      idempotencyKey: retryIdempotencyKey,
      providerPrompt: original.requestPayload?.providerPrompt || original.prompt,
      source: 'manual-retry',
      requestMeta: {
        retryOfTaskId: original.id,
        retryConfirmedBillingRisk: hasBillingRisk,
        retryCreatedAt: new Date().toISOString()
      }
    });
    const task = generationTaskService.getTask(result.task.id) || result.task;
    res.status(202).json({
      success: true,
      accepted: true,
      pending: ['pending', 'running'].includes(task.status),
      replayed: false,
      retryOfTaskId: original.id,
      remainingBalance: result.remainingBalance,
      ...makePersistentTaskResponse(task)
    });
  } catch (error) {
    if (error?.code === 'GENERATION_REFERENCE_FILE_MISSING' || error?.code === 'ENOENT') {
      error.status = 410;
      error.code = 'GENERATION_RETRY_INPUT_EXPIRED';
      error.message = '原任务参考图已超过保留期或已被清理，请重新上传后再试';
    }
    if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
    res.status(error.status || 500).json({
      success: false,
      code: error.code || 'GENERATION_TASK_RETRY_FAILED',
      message: error.message || '人工重试任务失败'
    });
  }
});

async function executeTemplateImageGeneration(userId, body = {}, requestContext = {}) {
  const prompt = pickTemplatePrompt(body);
  const modelKey = resolveImageModelKey(body);
  const imageCount = Number(body.imageCount || body.count || body.n || 1);
  const negativePrompt = body.negativePrompt || '';
  if (!prompt) throw integrationError(400, 'IMAGE_PROMPT_REQUIRED', '请输入提示词');
  if (!modelKey) throw integrationError(400, 'IMAGE_MODEL_REQUIRED', '请选择可用的图片模型');
  const count = Math.max(1, Math.min(imageCount || 1, 4));
  const fullPrompt = `${prompt}${negativePrompt ? '，避免：' + negativePrompt : ''}`;
  const hasReferenceImages = imageReferenceCandidates(body).length > 0;
  const providerPrompt = buildEcommerceImagePrompt(fullPrompt, { body, hasReferenceImages });
  const taskRequest = {
    ...requestContext,
    body: { ...body, prompt: fullPrompt, modelKey, imageCount: count },
    user: { ...(requestContext.user || {}), userId },
    get: typeof requestContext.get === 'function'
      ? requestContext.get.bind(requestContext)
      : ((header) => {
          if (String(header || '').toLowerCase() !== 'idempotency-key') return '';
          return String(requestContext.headers?.['idempotency-key'] || '');
        })
  };
  const submitted = await submitPersistentGenerationTask(taskRequest, taskRequest.body, {
    providerPrompt,
    source: 'template-image'
  });
  const task = await generationTaskService.waitForTerminal(submitted.task.id, 280000);
  const remainingBalance = Number(db.prepare('SELECT balance FROM users WHERE id=?').get(userId)?.balance || 0);
  if (!task || ['pending', 'running'].includes(task.status)) {
    return {
      success: true,
      accepted: true,
      pending: true,
      asyncPending: true,
      taskId: submitted.task.id,
      id: submitted.task.id,
      status: task?.status || 'pending',
      progress: persistentTaskProgress(task || submitted.task),
      totalCost: submitted.task.reservedCost,
      mock: !!task?.request?.mock,
      remainingBalance,
      prompt: providerPrompt,
      modelKey
    };
  }
  if (task.status !== 'success') {
    throw integrationError(
      task.status === 'cancelled' ? 409 : 502,
      task.errorCode || 'PROVIDER_IMAGE_FAILED',
      task.errorMessage || '图片生成接口调用失败',
      { taskId: task.id }
    );
  }
  return {
    success: true,
    results: task.images,
    resultImages: task.images,
    images: task.images,
    taskId: task.id,
    id: task.id,
    status: 'success',
    progress: 100,
    totalCost: task.settledCost,
    mock: !!task.request?.mock,
    remainingBalance,
    prompt: providerPrompt,
    modelKey
  };
}

registerTemplateImageRoutes(app, {
  auth,
  executeTemplateImageGeneration,
  pickTemplatePrompt,
  uid
});

app.get('/api/user/generations', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM generations WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.userId);
  const items = rows.map(row => {
    const resultUrl = imageDisplayUrl(row.result_url || row.resultUrl || '');
    return {
      ...row,
      id: row.id,
      url: resultUrl,
      imageUrl: resultUrl,
      resultUrl,
      result_url: resultUrl,
      prompt: row.prompt || '',
      label: row.prompt ? String(row.prompt).slice(0, 30) : '生成图片',
      model: row.model_key || row.model || '',
      modelKey: row.model_key || row.modelKey || '',
      cost: row.cost || 0,
      status: row.status || 'completed',
      createdAt: row.created_at,
      created_at: row.created_at,
      size: '1024x1024',
      quality: 'standard'
    };
  });
  res.json({ items, data: items, success: true });
});

app.delete('/api/user/generations/:id', auth, (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ success: false, message: '缺少生成记录 ID', code: 'GENERATION_ID_REQUIRED' });
  const result = db.prepare('DELETE FROM generations WHERE id=? AND user_id=?').run(id, req.user.userId);
  res.json({
    success: true,
    deleted: result.changes > 0,
    deletedCount: result.changes,
    id
  });
});

app.delete('/api/user/generations', auth, (req, res) => {
  const resultUrl = String(req.body?.resultUrl || req.body?.url || req.query?.resultUrl || req.query?.url || '').trim();
  const prompt = String(req.body?.prompt || req.query?.prompt || '').trim();
  if (!resultUrl && !prompt) {
    return res.status(400).json({ success: false, message: '缺少生成记录链接或提示词', code: 'GENERATION_MATCH_REQUIRED' });
  }

  let result;
  if (resultUrl) {
    result = db.prepare('DELETE FROM generations WHERE user_id=? AND result_url=?').run(req.user.userId, resultUrl);
    const requestedTarget = imageProxyTargetFromDisplayUrl(resultUrl);
    if (result.changes === 0 && requestedTarget) {
      const legacyMatch = db.prepare('SELECT id,result_url FROM generations WHERE user_id=? ORDER BY created_at DESC')
        .all(req.user.userId)
        .find(row => imageProxyTargetFromDisplayUrl(row.result_url) === requestedTarget);
      if (legacyMatch) {
        result = db.prepare('DELETE FROM generations WHERE id=? AND user_id=?').run(legacyMatch.id, req.user.userId);
      }
    }
  }
  if ((!result || result.changes === 0) && prompt) {
    result = db.prepare('DELETE FROM generations WHERE id IN (SELECT id FROM generations WHERE user_id=? AND prompt=? ORDER BY created_at DESC LIMIT 1)').run(req.user.userId, prompt);
  }

  const deletedCount = result ? result.changes : 0;
  res.json({
    success: true,
    deleted: deletedCount > 0,
    deletedCount,
    resultUrl,
    prompt
  });
});

// 每用户画布 UI 偏好（工具栏自定义等）：账号绑定，换浏览器/设备同步。
const userUiPreferencesKey = (userId) => `user.uiPreferences.${String(userId || '').replace(/[^\w-]/g, '')}`;
app.get('/api/user/ui-preferences', auth, (req, res) => {
  res.json({ success: true, data: ensureState(userUiPreferencesKey(req.user.userId), {}) });
});
app.put('/api/user/ui-preferences', auth, (req, res) => {
  const data = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  // 防御：偏好体积小，截断到 32KB 防止滥用 app_state
  const text = JSON.stringify(data).slice(0, 32768);
  writeState(userUiPreferencesKey(req.user.userId), JSON.parse(text));
  res.json({ success: true });
});

app.post('/api/user/preferences/api-provider', auth, (req, res) => {
  res.json({ success: true, mode: req.body.mode || 'auto' });
});
app.post('/api/user/preferences/api-route', auth, (req, res) => {
  const route = resolveImageRoute(req.body, req.user.userId);
  const saved = saveUserImageRoutePreference(req.user.userId, route);
  res.json({
    success: true,
    routeId: route.id || route.routeId || '',
    lineId: route.lineId || route.id || '',
    routeKey: route.rk || route.routeKey || '',
    lineKey: route.lineKey || route.rk || route.routeKey || '',
    preference: saved
  });
});

// ===================== WORKFLOWS =====================
registerWorkflowRoutes(app, {
  auth,
  uid,
  db,
  workflowDir: WORKFLOW_DIR,
  workflowDataFromBody,
  normalizeWorkflowJson
});

// ===================== ADMIN =====================
registerAdminRoutes(app, {
  auth,
  admin,
  db,
  uid,
  h,
  san,
  jwt,
  jwtSecret: JWT_SECRET,
  verifyPasswordHash,
  rehashPasswordIfNeeded,
  isProduction: IS_PRODUCTION,
  enableRealPayment: ENABLE_REAL_PAYMENT,
  providerTimeoutMs: PROVIDER_TIMEOUT_MS,
  imageProviderTimeoutMs: IMAGE_PROVIDER_TIMEOUT_MS,
  aiImageModel: AI_IMAGE_MODEL,
  aiTextModel: AI_TEXT_MODEL,
  imageClarityOptions: IMAGE_CLARITY_OPTIONS,
  baseRoutes: RTS,
  balanceService,
  generationTaskService,
  generationTaskRepository,
  imageRequestScheduler,
  tasks,
  providerStatus,
  filteredRoutes,
  hasConfiguredSecret,
  providerAuthKey,
  normalizeSecretInput,
  positiveNumber,
  normalizeProviderImageResponseFormat,
  normalizeProviderImageStream,
  normalizeProviderImagePartialImages,
  normalizeApiProviderRoute,
  routeState,
  saveRouteState,
  routePayload,
  providerImageResponseMode,
  findRouteByAnyId,
  routeKind,
  routeProviderStatus,
  callProviderImageGeneration,
  callProviderResponses,
  baseModelsForRoute,
  modelPriceState,
  saveModelPriceState,
  normalizeRouteModel,
  routeMatchesModelRow,
  fmt,
  makePersistentTaskResponse,
  makeTaskResponse,
  removeGenerationTaskInputs,
  placeholderUrl,
  templateWorkflowState,
  saveTemplateWorkflowState,
  settingsState,
  saveSettingsState
});

app.get('/api/health', (req, res) => {
  const tableCounts = {};
  let database = 'ok';
  try {
    ['users', 'projects', 'generations', 'balance_logs', 'redeem_codes', 'app_state'].forEach((table) => {
      tableCounts[table] = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
    });
  } catch (error) {
    database = 'error';
  }

  const provider = providerStatus();
  res.json({
    success: true,
    status: database === 'ok' ? 'ok' : 'degraded',
    service: 'hjm-mb-clone',
    mode: provider.mode,
    canvasRuntime: CANVAS_RUNTIME,
    database,
    paths: {
      database: DB_PATH,
      uploads: uploadDir,
      logs: LOG_DIR,
      workflows: WORKFLOW_DIR
    },
    providers: {
      ai: provider,
      email: { enabled: ENABLE_REAL_EMAIL },
      payment: { enabled: ENABLE_REAL_PAYMENT },
      storage: { enabled: ENABLE_REAL_STORAGE }
    },
    tables: tableCounts,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// ===================== API GUARDS =====================
// Express 4 不接管 async handler 的 rejection，Node 20 默认 unhandledRejection=throw 会让整个进程崩溃。
// 生产（10 人共用）必须保住进程：记日志但不退出，出错请求由超时/客户端重试兜底。
process.on('unhandledRejection', (error) => {
  console.error('[UNHANDLED_REJECTION]', error);
});
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT_EXCEPTION]', error);
});
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    code: 'API_NOT_FOUND',
    message: `接口不存在: ${req.method} ${req.originalUrl}`
  });
});

app.use((err, req, res, next) => {
  console.error('[SERVER_ERROR]', err);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  const code = err.code || 'SERVER_ERROR';
  const message = err.message || '服务器内部错误';
  res.status(status).json({ success: false, code, message });
});

// ===================== SPA FALLBACK =====================
const sourceFrontendRoutePattern = /^\/(?:|admin(?:\/.*)?|gallery\/?|login\/?|register\/?|template-image\/?|templates\/?|user(?:\/.*)?)$/;
app.get(sourceFrontendRoutePattern, (req, res) => {
  const sourceIndex = path.join(sourceFrontendDist, 'index.html');
  res.sendFile(fs.existsSync(sourceIndex) ? sourceIndex : path.join(__dirname, 'index.html'));
});
if (CANVAS_RUNTIME === 'infinite') {
  app.use('/canvas-app', express.static(infiniteCanvasDist, { index: false }));
  app.get(['/canvas', '/canvas/:projectId'], (req, res) => {
    res.sendFile(path.join(infiniteCanvasDist, 'index.html'));
  });
}
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ===================== START =====================
function ensureBootstrapAdmin() {
  const adminCount = Number(db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").get().count || 0);
  const bootstrapUser = db.prepare('SELECT id,password_hash FROM users WHERE username=?').get(ADMIN_BOOTSTRAP_USERNAME);
  const hasStrongBootstrapPassword = isStrongBootstrapPassword(ADMIN_BOOTSTRAP_PASSWORD);

  if (adminCount <= 0) {
    if (IS_PRODUCTION && !hasStrongBootstrapPassword) {
      failStartup('生产模式当前没有管理员账号，必须配置 ADMIN_BOOTSTRAP_USERNAME 和强 ADMIN_BOOTSTRAP_PASSWORD 后才能启动。');
    }
    const password = hasStrongBootstrapPassword ? ADMIN_BOOTSTRAP_PASSWORD : 'admin123';
    if (bootstrapUser) {
      db.prepare("UPDATE users SET password_hash=?, role='admin', status='active', balance=MAX(balance, 999999) WHERE id=?")
        .run(h(password), bootstrapUser.id);
    } else {
      const aid = uid('user_');
      db.prepare('INSERT INTO users (id,username,email,password_hash,role,balance,status) VALUES (?,?,?,?,?,?,?)')
        .run(aid, ADMIN_BOOTSTRAP_USERNAME, ADMIN_BOOTSTRAP_EMAIL, h(password), 'admin', 999999, 'active');
    }
    console.log(`[SETUP] bootstrap admin ready: ${ADMIN_BOOTSTRAP_USERNAME}`);
    return;
  }

  if (hasStrongBootstrapPassword && bootstrapUser && verifyPasswordHash(bootstrapUser.password_hash, 'admin123').ok) {
    db.prepare("UPDATE users SET password_hash=?, role='admin', status='active', balance=MAX(balance, 999999) WHERE id=?")
      .run(h(ADMIN_BOOTSTRAP_PASSWORD), bootstrapUser.id);
    console.log(`[SETUP] rotated default bootstrap admin password: ${ADMIN_BOOTSTRAP_USERNAME}`);
    return;
  }

  console.log(`[SETUP] admin account present: ${adminCount}`);
}

ensureBootstrapAdmin();

app.listen(PORT, () => {
  console.log(`\n哈吉米AI Clone running at http://localhost:${PORT}`);
  console.log(`Admin bootstrap user: ${ADMIN_BOOTSTRAP_USERNAME}\n`);
});

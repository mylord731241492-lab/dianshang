/**
 * 哈吉米AI 本地克隆 v2.0 — 生产级后端
 */
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const Database = require('better-sqlite3');
const multer = require('multer');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const { ImageRequestScheduler } = require('./backend/provider/image-request-scheduler');
const { createGenerationTaskRepository } = require('./backend/generation/task-repository');
const { GenerationTaskService } = require('./backend/generation/generation-task-service');

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
const GENERATION_MAX_QUEUED = Math.max(1, Math.min(Number(process.env.GENERATION_MAX_QUEUED || 30) || 30, 1000));
const GENERATION_MAX_USER_NONTERMINAL = Math.max(1, Math.min(Number(process.env.GENERATION_MAX_USER_NONTERMINAL || 3) || 3, 20));
const GENERATION_CIRCUIT_THRESHOLD = Math.max(1, Math.min(Number(process.env.GENERATION_CIRCUIT_THRESHOLD || 3) || 3, 20));
const GENERATION_CIRCUIT_WINDOW_MS = Math.max(1000, Number(process.env.GENERATION_CIRCUIT_WINDOW_MS || 5 * 60 * 1000) || 5 * 60 * 1000);
const GENERATION_CIRCUIT_OPEN_MS = Math.max(1000, Number(process.env.GENERATION_CIRCUIT_OPEN_MS || 60 * 1000) || 60 * 1000);
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
const ENABLE_LIBRECHAT = ['1','true','yes','on'].includes(String(process.env.ENABLE_LIBRECHAT || '').toLowerCase());
const LIBRECHAT_BRIDGE_SECRET = String(process.env.LIBRECHAT_BRIDGE_SECRET || '').trim();
const LIBRECHAT_SSO_TTL_SECONDS = Math.max(30, Math.min(Number(process.env.LIBRECHAT_SSO_TTL_SECONDS || 60) || 60, 300));
const LIBRECHAT_INTERNAL_URL = String(process.env.LIBRECHAT_INTERNAL_URL || 'http://librechat:3080').trim().replace(/\/$/, '');
const hasUsableKey = (key = '') => /^sk-[A-Za-z0-9_\-]{12,}/.test(String(key || ''));
const hasConfiguredSecret = (key = '') => {
  const value = String(key || '').trim();
  return value.length >= 12 && !/replace|your-|填|占位|sk-$|^sk-replace/i.test(value);
};
if (IS_PRODUCTION && ENABLE_LIBRECHAT && !hasConfiguredSecret(LIBRECHAT_BRIDGE_SECRET)) {
  failStartup('启用 LibreChat 时必须配置长度至少 12 位且非占位值的 LIBRECHAT_BRIDGE_SECRET。');
}

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
  CREATE TABLE IF NOT EXISTS chat_sso_tickets (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_sso_tickets_expiry ON chat_sso_tickets(expires_at);
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
  CREATE TABLE IF NOT EXISTS chat_image_quotes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    request_json TEXT NOT NULL,
    confirmation_hash TEXT NOT NULL,
    origin_message_id TEXT NOT NULL,
    cost REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    used_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_chat_image_quotes_user ON chat_image_quotes(user_id, expires_at);
  CREATE TABLE IF NOT EXISTS chat_image_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL DEFAULT '',
    plan_json TEXT NOT NULL,
    confirmation_hash TEXT NOT NULL,
    origin_message_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    confirmed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_chat_image_plans_conversation ON chat_image_plans(user_id, conversation_id, created_at);
  CREATE TABLE IF NOT EXISTS chat_managed_conversations (
    user_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, conversation_id)
  );
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
  maxQueued: GENERATION_MAX_QUEUED,
  circuitThreshold: GENERATION_CIRCUIT_THRESHOLD,
  circuitWindowMs: GENERATION_CIRCUIT_WINDOW_MS,
  circuitOpenMs: GENERATION_CIRCUIT_OPEN_MS
});
const generationTaskRepository = createGenerationTaskRepository({
  db,
  idFactory: uid,
  maxUserNonterminal: GENERATION_MAX_USER_NONTERMINAL,
  maxQueued: GENERATION_MAX_QUEUED
});

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

function workflowNameFromBody(body = {}, data = {}) {
  return body.name || body.title || data.name || data.title || '本地工作流';
}

function projectDataFromRow(row) {
  return normalizeWorkflowJson(parseJsonValue(row?.data || '{}', {}));
}

function safeWorkflowPathPart(value = '') {
  const cleaned = String(value || '')
    .replace(/[^a-zA-Z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return cleaned || 'workflow';
}

function workflowFilePayload(id, name, data = {}) {
  return {
    ...normalizeWorkflowJson(data),
    projectId: id,
    title: name,
    savedAt: new Date().toISOString()
  };
}

function saveWorkflowJsonFile(userId, id, name, data = {}) {
  const userDir = path.join(WORKFLOW_DIR, safeWorkflowPathPart(userId || 'anonymous'));
  fs.mkdirSync(userDir, { recursive: true });
  const fileName = `${safeWorkflowPathPart(id)}.workflow.json`;
  const filePath = path.join(userDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(workflowFilePayload(id, name, data), null, 2), 'utf8');
  return {
    fileName,
    path: filePath,
    relativePath: path.relative(WORKFLOW_DIR, filePath).replace(/\\/g, '/')
  };
}

function saveWorkflowProject(userId, id, name, data = {}) {
  const existing = db.prepare('SELECT id FROM projects WHERE id=? AND user_id=?').get(id, userId);
  if (existing) {
    db.prepare("UPDATE projects SET name=?, data=?, updated_at=datetime('now') WHERE id=? AND user_id=?")
      .run(name, JSON.stringify(data || {}), id, userId);
  } else {
    db.prepare('INSERT INTO projects (id,user_id,name,data) VALUES (?,?,?,?)')
      .run(id, userId, name, JSON.stringify(data || {}));
  }
  return saveWorkflowJsonFile(userId, id, name, data);
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

const defaultManagedChatAgents = [
  {
    id: 'ecommerce-main-image',
    name: '电商主图设计师',
    description: '提炼卖点、规划构图，并通过网站生图工具完成商品主图。',
    instructions: '你是面向普通用户的电商主图设计师。你必须先真正读取用户上传的全部图片和文字要求，再自由生成完整的设计方案与生图提示词，不得套用通用商品模板。每张图片承担什么作用完全以用户提示词为准，不得固定“图1是产品、图2是排版”；必须明确说明你实际采用的参考关系。方案工具中的文案字段只是把你识别或拟定的上图文字拆成可编辑表格，不能代替完整方案。用户修改并确认表格后，你必须结合原始方案和最终文案重新生成一份完整生图提示词，再创建报价；只有用户下一条消息确认报价后才能生图。生成完成后主动询问是否修改，并继续复用当前会话的参考图、方案和上一版结果。',
    model: 'gpt-5.6-terra',
    enabled: true,
    skillsEnabled: true,
    imageToolsEnabled: true
  },
  {
    id: 'product-detail-planner',
    name: '商品详情页策划',
    description: '规划详情页结构、卖点顺序、文案和配图需求。',
    instructions: '你是商品详情页策划师。根据商品资料输出可执行的详情页结构，包含用户痛点、核心卖点、信任证明、规格信息和行动引导；信息不足时先提问，不编造商品数据。',
    model: 'gpt-5.6-terra',
    enabled: true,
    skillsEnabled: true,
    imageToolsEnabled: true
  },
  {
    id: 'xiaohongshu-copywriter',
    name: '小红书种草助手',
    description: '生成贴近目标人群的小红书标题、正文与配图思路。',
    instructions: '你是小红书电商内容助手。围绕真实商品卖点和使用场景创作标题、正文、话题和配图建议，语言自然具体，避免虚假承诺和夸大功效。',
    model: 'gpt-5.6-terra',
    enabled: true,
    skillsEnabled: true,
    imageToolsEnabled: true
  },
  {
    id: 'promotion-poster-designer',
    name: '促销海报设计师',
    description: '设计活动海报的信息层级、视觉方向与生成提示词。',
    instructions: '你是促销海报设计师。先核对活动主题、优惠规则、商品、渠道和尺寸，再输出信息层级、视觉方向和可直接生图的提示词。需要生成图片时，先报价并等待用户确认。',
    model: 'gpt-5.6-terra',
    enabled: true,
    skillsEnabled: true,
    imageToolsEnabled: true
  }
];

const defaultAdminChatSettings = {
  accessEnabled: true,
  textChatEnabled: true,
  imageToolsEnabled: true,
  allowedModels: TXT.map(item => item.k),
  maintenanceMessage: 'AI 对话服务正在维护，请稍后再试。',
  managedAgents: defaultManagedChatAgents
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

function configuredChatModels() {
  let routes = [];
  try {
    routes = routeState().filter(route =>
      routeKind(route) === 'text' && route.enabled !== false && route.status !== 'disabled'
    );
  } catch (_) {
    routes = [];
  }
  const seen = new Set();
  const models = routes.reduce((items, route) => {
    const key = textRouteModelKey(route);
    if (!key || seen.has(key)) return items;
    seen.add(key);
    items.push({ k: key, n: textModelDisplayName(key, route), p: 5, q: ['1k'] });
    return items;
  }, []);
  return models.length > 0 ? models : TXT;
}

function normalizeRequestedChatModelKey(value = '', models = configuredChatModels()) {
  const requested = String(value || '').trim();
  const known = new Set(models.map(item => item.k));
  if (known.has(requested)) return requested;
  if (!requested || LEGACY_TEXT_MODEL_KEYS.has(requested)) return models[0]?.k || TXT[0]?.k || AI_TEXT_MODEL;
  return '';
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

function normalizeEcommerceSuiteSection(section = {}, fallback = {}, index = 0) {
  const key = cleanSettingKey(section.key || fallback.key, fallback.key || `section-${index + 1}`);
  return {
    ...fallback,
    ...section,
    key,
    name: String(section.name || fallback.name || key).trim(),
    description: String(section.description || fallback.description || '').trim(),
    promptGuide: String(section.promptGuide || section.prompt || fallback.promptGuide || '').trim(),
    enabled: section.enabled !== false,
    sort: Number(section.sort ?? fallback.sort ?? index + 1) || index + 1
  };
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

function normalizeManagedChatAgent(agent = {}, index = 0) {
  const source = agent && typeof agent === 'object' ? agent : {};
  const fallback = defaultManagedChatAgents[index] || {};
  const models = configuredChatModels();
  const model = normalizeRequestedChatModelKey(source.model || fallback.model, models);
  return {
    id: cleanSettingKey(source.id || fallback.id, `managed-agent-${index + 1}`),
    name: String(source.name || fallback.name || `智能体 ${index + 1}`).trim().slice(0, 48),
    description: String(source.description || fallback.description || '').trim().slice(0, 180),
    instructions: String(source.instructions || fallback.instructions || '').trim().slice(0, 6000),
    model: model || models[0]?.k || TXT[0]?.k || AI_TEXT_MODEL,
    enabled: source.enabled !== false,
    skillsEnabled: source.skillsEnabled !== false,
    imageToolsEnabled: source.imageToolsEnabled !== false
  };
}

function normalizeManagedChatAgents(value) {
  const source = Array.isArray(value) ? value : defaultManagedChatAgents;
  const seen = new Set();
  return source.slice(0, 12).reduce((items, agent, index) => {
    const normalized = normalizeManagedChatAgent(agent, index);
    if (!normalized.name || !normalized.instructions || seen.has(normalized.id)) return items;
    seen.add(normalized.id);
    items.push(normalized);
    return items;
  }, []);
}

function normalizeAdminChatSettings(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const models = configuredChatModels();
  const allowedModels = Array.isArray(source.allowedModels)
    ? source.allowedModels.map(value => normalizeRequestedChatModelKey(value, models)).filter(Boolean)
    : models.map(item => item.k);
  return {
    ...defaultAdminChatSettings,
    accessEnabled: source.accessEnabled !== false,
    textChatEnabled: source.textChatEnabled !== false,
    imageToolsEnabled: source.imageToolsEnabled !== false,
    allowedModels: allowedModels.length > 0 ? Array.from(new Set(allowedModels)) : models.map(item => item.k),
    maintenanceMessage: String(source.maintenanceMessage || defaultAdminChatSettings.maintenanceMessage).trim().slice(0, 240),
    managedAgents: normalizeManagedChatAgents(source.managedAgents)
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
const chatSettingsState = () => normalizeAdminChatSettings(ensureState('admin.chatSettings', defaultAdminChatSettings));
const saveChatSettingsState = (value) => writeState('admin.chatSettings', normalizeAdminChatSettings(value));
const modelPriceState = () => ensureState('admin.modelPrices', []);
const saveModelPriceState = (value) => writeState('admin.modelPrices', value);

function allowedChatModels(settings = chatSettingsState()) {
  const allowed = new Set(settings.allowedModels || []);
  return configuredChatModels().filter(item => allowed.has(item.k));
}

const ECOMMERCE_MAIN_IMAGE_AGENT_ID = 'ecommerce-main-image';
const CHAT_TEXT_MODEL_ROUTE_SYNC_MIGRATION_KEY = 'migration.chatTextModelRouteSync.v2';
const ECOMMERCE_MAIN_IMAGE_WORKFLOW_MIGRATION_KEY = 'migration.ecommerceMainImageWorkflow.v2';

function migrateChatTextModelsToConfiguredRoute() {
  if (readState(CHAT_TEXT_MODEL_ROUTE_SYNC_MIGRATION_KEY, null)) return;
  const configuredModel = configuredChatModels()[0]?.k || TXT[0]?.k || AI_TEXT_MODEL;
  const current = ensureState('admin.chatSettings', defaultAdminChatSettings);
  const managedAgents = (Array.isArray(current?.managedAgents) ? current.managedAgents : defaultManagedChatAgents)
    .map(agent => {
      const currentModel = String(agent?.model || '').trim();
      if (agent?.id === ECOMMERCE_MAIN_IMAGE_AGENT_ID || LEGACY_TEXT_MODEL_KEYS.has(currentModel)) {
        return { ...agent, model: configuredModel };
      }
      return agent;
    });
  saveChatSettingsState({
    ...current,
    allowedModels: Array.from(new Set([...(current?.allowedModels || []), configuredModel])),
    managedAgents
  });
  writeState(CHAT_TEXT_MODEL_ROUTE_SYNC_MIGRATION_KEY, {
    model: configuredModel,
    migratedAt: new Date().toISOString()
  });
}

migrateChatTextModelsToConfiguredRoute();

function migrateEcommerceMainImageWorkflowV2() {
  if (readState(ECOMMERCE_MAIN_IMAGE_WORKFLOW_MIGRATION_KEY, null)) return;
  const current = ensureState('admin.chatSettings', defaultAdminChatSettings);
  const workflowDefaults = defaultManagedChatAgents.find(agent => agent.id === ECOMMERCE_MAIN_IMAGE_AGENT_ID);
  const managedAgents = (Array.isArray(current?.managedAgents) ? current.managedAgents : defaultManagedChatAgents)
    .map(agent => agent?.id === ECOMMERCE_MAIN_IMAGE_AGENT_ID
      ? {
          ...agent,
          description: workflowDefaults.description,
          instructions: workflowDefaults.instructions,
          model: configuredChatModels()[0]?.k || TXT[0]?.k || AI_TEXT_MODEL,
          skillsEnabled: true,
          imageToolsEnabled: true
        }
      : agent);
  saveChatSettingsState({ ...current, managedAgents });
  writeState(ECOMMERCE_MAIN_IMAGE_WORKFLOW_MIGRATION_KEY, {
    agentId: ECOMMERCE_MAIN_IMAGE_AGENT_ID,
    migratedAt: new Date().toISOString()
  });
}

migrateEcommerceMainImageWorkflowV2();

function findRouteByAnyId(id) {
  const routes = routeState();
  return routes.find(r => [r.id, r.routeId, r.lineId, r.rk, r.routeKey, r.lineKey, r.code].includes(id)) || routes[0] || RTS[0];
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function integrationOpenAiErrorPayload(code, message, extra = {}) {
  return {
    success: false,
    ...extra,
    code,
    message,
    error: {
      message,
      type: code === 'INSUFFICIENT_BALANCE' ? 'insufficient_quota' : 'invalid_request_error',
      param: null,
      code
    }
  };
}

function sendIntegrationErrorResponse(res, status, code, message, extra = {}) {
  return res.status(status).json(integrationOpenAiErrorPayload(code, message, extra));
}

function integrationServiceAuth(req, res, next) {
  if (!ENABLE_LIBRECHAT) {
    return sendIntegrationErrorResponse(res, 404, 'LIBRECHAT_DISABLED', 'AI 对话服务暂未启用');
  }
  const chatSettings = chatSettingsState();
  if (!chatSettings.accessEnabled) {
    return sendIntegrationErrorResponse(res, 503, 'LIBRECHAT_MAINTENANCE', chatSettings.maintenanceMessage);
  }
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!timingSafeEqualText(token, LIBRECHAT_BRIDGE_SECRET)) {
    return sendIntegrationErrorResponse(res, 401, 'INTEGRATION_AUTH_INVALID', '内部服务认证失败');
  }
  next();
}

function integrationReferenceImages(req) {
  const raw = String(req.headers['x-chat-reference-images'] || '').trim();
  if (!raw || raw.length > 8192) return [];
  try {
    let serialized = raw;
    if (raw.startsWith('b64url:')) {
      const encoded = raw.slice('b64url:'.length);
      if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return [];
      serialized = Buffer.from(encoded, 'base64url').toString('utf8');
    }
    if (Buffer.byteLength(serialized, 'utf8') > 8192) return [];
    const values = JSON.parse(serialized);
    if (!Array.isArray(values)) return [];
    return values
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function integrationUser(req, res, next) {
  const rawExternalId = String(req.headers['x-chat-user-id'] || '').trim();
  const email = String(req.headers['x-chat-user-email'] || '').trim().toLowerCase();
  const userId = rawExternalId.startsWith('hjm:') ? rawExternalId.slice(4) : rawExternalId;
  if (!userId || !email) {
    return sendIntegrationErrorResponse(res, 401, 'INTEGRATION_USER_REQUIRED', '缺少聊天用户身份');
  }
  const user = db.prepare("SELECT * FROM users WHERE id=? AND lower(email)=? AND status='active'").get(userId, email);
  if (!user) {
    return sendIntegrationErrorResponse(res, 401, 'INTEGRATION_USER_NOT_FOUND', '聊天用户身份不匹配、不存在或已停用');
  }
  req.integrationUser = user;
  req.integrationMessageId = String(req.headers['x-chat-message-id'] || req.body?.messageId || '').trim();
  req.integrationConversationId = String(req.headers['x-chat-conversation-id'] || req.body?.conversationId || '').trim().slice(0, 160);
  req.integrationReferenceImages = integrationReferenceImages(req);
  const suppliedAgentId = cleanSettingKey(req.headers['x-chat-agent-id'] || req.body?.hjmManagedAgentId || '', '').slice(0, 80);
  const knownAgentIds = new Set(chatSettingsState().managedAgents.map(agent => agent.id));
  const validSuppliedAgentId = knownAgentIds.has(suppliedAgentId) ? suppliedAgentId : '';
  if (req.integrationConversationId && validSuppliedAgentId) {
    const now = Date.now();
    db.prepare(`
      INSERT INTO chat_managed_conversations (user_id,conversation_id,agent_id,created_at,updated_at)
      VALUES (?,?,?,?,?)
      ON CONFLICT(user_id,conversation_id) DO UPDATE SET agent_id=excluded.agent_id,updated_at=excluded.updated_at
    `).run(user.id, req.integrationConversationId, validSuppliedAgentId, now, now);
  }
  const persistedAgent = !validSuppliedAgentId && req.integrationConversationId
    ? db.prepare('SELECT agent_id FROM chat_managed_conversations WHERE user_id=? AND conversation_id=?').get(user.id, req.integrationConversationId)?.agent_id
    : '';
  req.integrationAgentId = validSuppliedAgentId || (knownAgentIds.has(persistedAgent) ? persistedAgent : '');
  next();
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

function providerImageRequestSize(options = {}, sizeTierValue = '') {
  const ratio = normalizeImageRatio(options.ratio || options.aspectRatio, '');
  return providerImageSize(ratio || options.size || '1:1', sizeTierValue);
}

const PROVIDER_IMAGE_ASPECT_TOLERANCE = 0.03;

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

function imageProviderFailureDomain(route = {}) {
  const status = routeProviderStatus(route, 'image');
  let hostname = 'provider-default';
  try {
    hostname = new URL(String(status.baseUrl || '')).hostname.toLowerCase() || hostname;
  } catch {}
  const format = String(route.apiFormat || route.requestFormat || 'openai-images').trim().toLowerCase();
  return `${hostname}|${format}`;
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

function buildCanvasPromptFallback(requirement = '', imageCount = 0) {
  const imageLine = imageCount > 0
    ? `参考图顺序：${Array.from({ length: imageCount }, (_, index) => canvasPromptImageLabel(index)).join('、')}。请严格按用户对图序的描述理解主体、风格、构图、文案和替换关系。`
    : '本次未提供参考图，请根据用户需求独立生成电商视觉。';
  return [
    imageLine,
    `用户需求：${requirement || '生成一张高质量电商产品图片。'}`,
    '生成要求：商品主体清晰，保留参考图中的产品外观、包装结构、品牌标识、颜色、材质和关键文字；只根据用户要求调整场景、背景、构图、光影、道具、营销氛围和画面风格。画面真实自然，商业摄影质感，适合电商主图或详情页使用。不要虚构价格、认证、功效和不存在的文字，不要产生乱码、水印、二维码或畸形产品。'
  ].join('\n');
}

function buildCanvasPromptInput(body = {}) {
  const requirement = String(body.requirement || body.prompt || body.message || body.text || '').trim();
  const requestedCount = Number(body.imageCount || body.referenceImageCount || (Array.isArray(body.referenceImages) ? body.referenceImages.length : 0) || 0);
  const imageCount = Math.max(0, Math.min(Number.isFinite(requestedCount) ? requestedCount : 0, 12));
  const imageLabels = Array.from({ length: imageCount }, (_, index) => canvasPromptImageLabel(index));
  return {
    requirement,
    imageCount,
    imageLabels,
    input: [
      '你是电商视觉提示词工程师。用户会先按顺序上传参考图，然后写出生成需求。',
      '请把用户需求整理成一段可直接提交给图片生成模型的中文提示词。',
      '必须保留用户提到的图序关系，例如“图1的产品、图2的主图/框架/风格/文案”。不要擅自调换图片顺序。',
      '提示词要明确：主体、参考图使用方式、背景/场景、构图、光影、材质、文字/包装保持规则、电商转化重点、负面约束。',
      '只输出最终提示词正文，不要输出标题、解释、编号列表或 Markdown。',
      imageCount > 0 ? `参考图顺序：${imageLabels.join('、')}` : '参考图顺序：无',
      `用户需求：${requirement || '生成一张高质量电商产品图片'}`
    ].join('\n')
  };
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
      '分析要求：识别用户指定的图序角色，例如排版、构图、风格、配色、桌子、背景、道具、产品、标签、文案等来源。',
      '生成要求：最终提示词要说明每张参考图只承担用户指定的作用；不要让排版图、风格图、配色图、背景图里的无关商品或文字混进最终画面。',
      '保持规则：最终主商品以用户指定的产品图或待编辑原图为准，商品外观、包装结构、品牌/Logo、标签、关键文字、比例和材质尽量稳定；用户明确要求修改的内容按用户要求执行。',
      '发挥规则：背景、桌面、道具、氛围、光影、空间层次和画面高级感可以合理优化，但不能遮挡商品、改变商品识别或喧宾夺主。'
    ]
    : [
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

function ecommerceSuiteAgentConfig() {
  return normalizeEcommerceSuiteAgentConfig(settingsState().ecommerceSuiteAgent);
}

function ecommerceSuitePublicConfig() {
  const config = ecommerceSuiteAgentConfig();
  return {
    ...config,
    sections: [],
    sectionMode: 'dynamic',
    skills: config.skills
      .filter(skill => skill.enabled !== false)
      .map(({ markdown, ...skill }) => skill)
  };
}

function ecommerceSuiteSkillForId(config = {}, skillId = '') {
  const skills = Array.isArray(config.skills) ? config.skills : [];
  const requested = cleanSettingKey(skillId);
  return skills.find(skill => skill.enabled !== false && skill.id === requested)
    || skills.find(skill => skill.enabled !== false && skill.id === config.defaultSkillId)
    || skills.find(skill => skill.enabled !== false)
    || defaultEcommerceSuiteSkills[0];
}

function ecommerceSuiteSelectedSections(config = {}, sectionKeys = []) {
  if (!Array.isArray(sectionKeys) || !sectionKeys.length) return [];
  return sectionKeys
    .map((item, index) => {
      if (item && typeof item === 'object') {
        return normalizeEcommerceSuiteSection(item, {}, index);
      }
      const label = String(item || '').trim();
      return {
        key: cleanSettingKey(label, `section-${index + 1}`),
        name: label || `板块 ${index + 1}`,
        description: '',
        promptGuide: '',
        enabled: true,
        sort: index + 1
      };
    })
    .filter(section => section && section.enabled !== false)
    .slice(0, 5);
}

function normalizeSuiteImageReference(item = {}, role = 'reference', index = 0) {
  const raw = item && typeof item === 'object' ? item : { url: item };
  const url = firstString(raw.url, raw.imageUrl, raw.image_url, raw.originalUrl, raw.original_url, raw.preview, raw.src);
  const dataUrl = firstString(raw.dataUrl, raw.data_url, raw.base64, raw.b64_json, raw.b64Json);
  if (!url && !dataUrl) return null;
  return {
    role,
    index: index + 1,
    label: role === 'product' ? `产品图${index + 1}` : `参考图${index + 1}`,
    url,
    dataUrl,
    fileName: firstString(raw.fileName, raw.filename, raw.name, raw.title) || `${role}-${index + 1}.png`,
    mimeType: firstString(raw.mimeType, raw.mime, raw.type)
  };
}

function ecommerceSuiteImageBuckets(body = {}) {
  const productSource = Array.isArray(body.productImages) ? body.productImages
    : Array.isArray(body.product_images) ? body.product_images
      : [];
  const referenceSource = Array.isArray(body.referenceImages) ? body.referenceImages
    : Array.isArray(body.reference_images) ? body.reference_images
      : Array.isArray(body.images) ? body.images
        : [];
  const productImages = productSource
    .map((item, index) => normalizeSuiteImageReference(item, 'product', index))
    .filter(Boolean)
    .slice(0, 8);
  const referenceImages = referenceSource
    .map((item, index) => normalizeSuiteImageReference(item, 'reference', index))
    .filter(Boolean)
    .slice(0, 8);
  return {
    productImages,
    referenceImages,
    all: [...productImages, ...referenceImages].slice(0, 12)
  };
}

async function ecommerceSuiteReferencesForAnalysis(body = {}, req) {
  const buckets = ecommerceSuiteImageBuckets(body);
  const result = [];
  for (let index = 0; index < buckets.all.length; index += 1) {
    const source = buckets.all[index];
    const file = await loadReferenceImageFile(source, req);
    result.push({
      ...source,
      dataUrl: `data:${file.mime};base64,${file.buffer.toString('base64')}`,
      mime: file.mime,
      fileName: file.fileName || source.fileName
    });
  }
  return result;
}

function ecommerceSuiteContextFromBody(body = {}, config = ecommerceSuiteAgentConfig()) {
  const skill = ecommerceSuiteSkillForId(config, body.skillId || body.designerId);
  const sections = ecommerceSuiteSelectedSections(config, body.sectionKeys || body.sections);
  const defaults = config.defaults || defaultEcommerceSuiteAgent.defaults;
  return {
    requirement: String(body.requirement || body.prompt || body.message || body.text || '').trim(),
    brandName: String(body.brandName || body.brand || defaults.brandName || '').trim(),
    platform: String(body.platform || defaults.platform || '拼多多').trim(),
    country: String(body.country || defaults.country || '中国').trim(),
    language: String(body.language || defaults.language || '中文').trim(),
    ratio: String(body.ratio || body.aspectRatio || defaults.ratio || '1:1').trim(),
    quality: String(body.quality || body.clarity || defaults.quality || '1k').trim().toLowerCase(),
    imageCount: Math.max(1, Math.min(Number(body.imageCount || body.count || body.n || defaults.imageCount || 1) || 1, 4)),
    skill,
    sections
  };
}

function buildEcommerceSuitePromptInput(context = {}, references = []) {
  const productLabels = references.filter(item => item.role === 'product').map(item => item.label);
  const referenceLabels = references.filter(item => item.role !== 'product').map(item => item.label);
  const sectionText = context.sections.length
    ? context.sections.map((section, index) =>
      `${index + 1}. ${section.key} / ${section.name}：${section.promptGuide || section.description || ''}`
    ).join('\n')
    : '';
  const sectionRule = sectionText
    ? `用户显式指定了板块，请只为这些板块生成提示词：\n${sectionText}`
    : [
      '请根据设计师 skill、产品图、参考图和用户输入，自主规划本次电商套图的板块集合。',
      '板块数量建议 3-5 个；不要机械套用固定的首屏/卖点/效果/科技/场景五件套。',
      '每个板块必须服务当前商品和当前投放目的，可以是主转化视觉、信任背书、成分/结构、场景利益、包装质感、促销氛围等，但名称必须按本次需求自拟。',
      'sectionKey 使用稳定英文 kebab-case；sectionName 使用中文短名称。'
    ].join('\n');
  const skillMarkdown = sanitizeSkillMarkdown(context.skill?.markdown || '').slice(0, 8000);
  const text = [
    '你是电商套图 Agent，需要为用户生成一组可直接交给图片模型的电商套图板块提示词。',
    '必须输出 JSON 对象，不要 Markdown，不要额外解释。',
    'JSON 字段：promptPlans。未显式指定板块时，由你根据商品需求决定数组长度。',
    'promptPlans 每项字段：sectionKey、sectionName、title、prompt、negativePrompt、analysisSummary。',
    '产品图规则：产品图用于锁定真实主体、包装结构、颜色、材质、品牌识别、可辨识文字和 SKU 信息。',
    '参考图规则：参考图只用于迁移构图、光影、背景氛围、卖点表达和版式节奏，不要把参考图里的其他品牌或产品替换进来。',
    '合规规则：不要虚构价格、认证、功效、活动标签、二维码、水印或参考图里没有且用户没要求的文字；不要生成乱码文字和畸形产品。',
    `设计师 skill：${context.skill?.name || 'Gloria'}。`,
    skillMarkdown ? `设计师 Markdown：\n${skillMarkdown}` : '设计师 Markdown：无。',
    `品牌名：${context.brandName || '未填写'}`,
    `平台：${context.platform || '拼多多'}；国家：${context.country || '中国'}；语言：${context.language || '中文'}；比例：${context.ratio || '1:1'}；清晰度：${context.quality || '1k'}`,
    productLabels.length ? `产品图顺序：${productLabels.join('、')}` : '产品图顺序：无。',
    referenceLabels.length ? `参考图顺序：${referenceLabels.join('、')}` : '参考图顺序：无。',
    `用户产品信息和需求：${context.requirement || '生成一组高质量电商套图。'}`,
    `板块生成规则：\n${sectionRule}`
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

function mockEcommerceSuitePromptPlans(context = {}, referenceCount = 0) {
  const sections = ecommerceSuiteDynamicFallbackSections(context);
  return sections.map((section, index) => {
    const base = [
      `板块：${section.name}。`,
      context.brandName ? `品牌：${context.brandName}。` : '',
      `平台：${context.platform}，国家：${context.country}，语言：${context.language}，比例：${context.ratio}，清晰度：${context.quality.toUpperCase()}。`,
      referenceCount > 0 ? `参考输入包含 ${referenceCount} 张图片，请严格保留产品图中的主体、包装、颜色、材质、Logo、产品名和关键文字。` : '未提供参考图片时，根据用户描述生成清晰可信的商品视觉。',
      section.promptGuide || section.description || '',
      `用户需求：${context.requirement || '生成高质量电商套图。'}`,
      `设计师风格：${context.skill?.name || 'Gloria'}，${context.skill?.description || ''}。`,
      '画面要求：商品主体清晰，电商转化导向，商业摄影级光影，真实材质，版式干净高级。',
      '负面约束：不要乱码、水印、二维码、畸形产品、多余主体、虚构价格、虚构认证或夸大功效。'
    ].filter(Boolean).join('\n');
    return {
      id: `${section.key}_${index + 1}`,
      sectionKey: section.key,
      sectionName: section.name,
      title: section.name,
      prompt: base,
      negativePrompt: '乱码文字，水印，二维码，畸形产品，多余主体，虚构价格，虚构认证，夸大功效，低清晰度，脏污背景',
      analysisSummary: `已按 ${section.name} 生成提示词，将优先保持产品识别并迁移参考图的构图和电商表现。`,
      selected: index === 0
    };
  });
}

function ecommerceSuiteDynamicFallbackSections(context = {}) {
  if (Array.isArray(context.sections) && context.sections.length) return context.sections.slice(0, 5);
  const requirement = String(context.requirement || '');
  const sections = [
    {
      key: 'conversion-visual',
      name: '转化主视觉',
      promptGuide: '用最能打动目标买家的画面建立第一眼购买理由。'
    },
    {
      key: 'product-trust',
      name: '产品信任图',
      promptGuide: '突出真实产品识别、包装质感、材质细节和可信信息。'
    },
    {
      key: 'benefit-logic',
      name: '利益点拆解',
      promptGuide: '围绕用户需求拆出清晰可感知的核心利益，不虚构功效。'
    },
    {
      key: 'usage-moment',
      name: '使用瞬间图',
      promptGuide: '让买家理解产品在真实生活或消费场景中的价值。'
    }
  ];
  if (/成分|结构|科技|工艺|材质|原理|解析/.test(requirement)) {
    sections.splice(2, 0, {
      key: 'material-breakdown',
      name: '结构解析图',
      promptGuide: '克制呈现结构、成分、工艺或材质逻辑，避免伪科学表达。'
    });
  }
  if (/包装|礼盒|送礼|套装|规格/.test(requirement)) {
    sections.splice(3, 0, {
      key: 'package-value',
      name: '包装价值图',
      promptGuide: '突出包装、规格、组合感和送礼/陈列价值。'
    });
  }
  return sections.slice(0, 5).map((section, index) => ({
    ...section,
    description: section.promptGuide,
    enabled: true,
    sort: index + 1
  }));
}

function normalizeEcommerceSuitePromptPlan(raw = {}, section = {}, fallback = {}) {
  const prompt = String(raw.prompt || raw.text || raw.finalPrompt || fallback.prompt || '').trim();
  const negativePrompt = String(raw.negativePrompt || raw.negative_prompt || fallback.negativePrompt || '').trim();
  const title = String(raw.title || raw.label || raw.sectionName || raw.section_name || section.name || fallback.title || fallback.sectionName || '').trim();
  const sectionName = String(raw.sectionName || raw.section_name || section.name || fallback.sectionName || title).trim();
  const sectionKey = cleanSettingKey(
    raw.sectionKey || raw.section_key || section.key || fallback.sectionKey || sectionName || title,
    fallback.sectionKey || section.key || cleanSettingKey(title, 'section')
  );
  return {
    id: String(raw.id || fallback.id || section.key || uid('suite_plan_')),
    sectionKey,
    sectionName,
    title: title || sectionName,
    prompt,
    negativePrompt,
    analysisSummary: String(raw.analysisSummary || raw.analysis_summary || raw.summary || fallback.analysisSummary || summarizeText(prompt, 160)).trim(),
    selected: raw.selected !== false
  };
}

function parseEcommerceSuitePromptPlans(providerResult = {}, context = {}, referenceCount = 0) {
  const text = imageToolOutputText(providerResult);
  const parsed = parseJsonObjectFromText(text);
  const rawPlans = Array.isArray(parsed?.promptPlans) ? parsed.promptPlans
    : Array.isArray(parsed?.plans) ? parsed.plans
      : Array.isArray(parsed?.sections) ? parsed.sections
        : [];
  const fallbackPlans = mockEcommerceSuitePromptPlans(context, referenceCount);
  if (rawPlans.length) {
    return rawPlans.slice(0, 5).map((raw, index) => {
      const fallback = fallbackPlans[index] || {
        id: `section-${index + 1}`,
        sectionKey: `section-${index + 1}`,
        sectionName: `板块 ${index + 1}`,
        title: `板块 ${index + 1}`,
        prompt: '',
        negativePrompt: '',
        analysisSummary: ''
      };
      const section = { key: fallback.sectionKey, name: fallback.sectionName };
      const normalized = normalizeEcommerceSuitePromptPlan(raw, section, fallback);
      return normalized.prompt ? normalized : fallback;
    }).filter(plan => plan.prompt);
  }
  return fallbackPlans.map((fallback, index) => {
    const section = {
      key: fallback.sectionKey || fallback.key || `section-${index + 1}`,
      name: fallback.sectionName || fallback.name || fallback.title || `板块 ${index + 1}`
    };
    const raw = rawPlans.find(item => cleanSettingKey(item?.sectionKey || item?.section_key) === section.key)
      || rawPlans.find(item => String(item?.sectionName || item?.section_name || item?.title || '').trim() === section.name)
      || rawPlans[index]
      || {};
    const normalized = normalizeEcommerceSuitePromptPlan(raw, section, fallback);
    return normalized.prompt ? normalized : fallback;
  });
}

function ecommerceSuiteGenerationPrompt(plan = {}, context = {}) {
  return [
    `套图板块：${plan.sectionName || plan.title || plan.sectionKey}`,
    plan.prompt,
    plan.negativePrompt ? `避免：${plan.negativePrompt}` : '',
    `输出要求：生成一张适合 ${context.platform || '电商平台'} 使用的${plan.sectionName || '电商套图'}，比例 ${context.ratio || '1:1'}，语言 ${context.language || '中文'}。`
  ].filter(Boolean).join('\n');
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
      const file = await loadReferenceImageFile(references[index], req);
      if (file.buffer.length > GENERATION_MAX_REFERENCE_BYTES) {
        throw generationInputError(
          413,
          'GENERATION_REFERENCE_IMAGE_TOO_LARGE',
          `第 ${index + 1} 张参考图超过 5MB，请压缩后重试`
        );
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
      const maskFile = await loadReferenceImageFile(maskReference, req);
      if (maskFile.buffer.length > GENERATION_MAX_REFERENCE_BYTES) {
        throw generationInputError(413, 'GENERATION_MASK_TOO_LARGE', '蒙版图片超过 5MB，请压缩后重试');
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

function mockChatCompletion(messages = [], model = AI_TEXT_MODEL) {
  const last = Array.isArray(messages) ? [...messages].reverse().find(m => m && m.content)?.content : '';
  return {
    success: true,
    id: uid('chatcmpl_'),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    mock: true,
    provider: providerStatus(),
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: `本地 mock 回复：已收到 ${String(last || '').slice(0, 80) || '你的请求'}。如需真实调用，请配置 New-API 并设置 ENABLE_REAL_AI=true。`
      },
      finish_reason: 'stop'
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  };
}

async function callProviderChat(messages, options = {}) {
  const status = providerStatus();
  const route = resolveTextRoute(options);
  const model = resolveTextProviderModel(options.model || reqBodyModel(options), route);
  if (!status.enabled) {
    return mockChatCompletion(messages, model);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), status.timeoutMs);
  try {
    const resp = await fetch(`${status.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerAuthKey('text')}`
      },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal
    });
    const contentType = resp.headers.get('content-type') || '';
    const data = contentType.toLowerCase().includes('application/json')
      ? await resp.json().catch(() => ({}))
      : {};
    if (!resp.ok) {
      return {
        success: false,
        code: 'PROVIDER_CHAT_FAILED',
        message: data.message || data.error?.message || `Provider returned ${resp.status}`,
        provider: status,
        upstreamStatus: resp.status,
        upstream: data
      };
    }
    if (!Array.isArray(data.choices)) {
      return {
        success: false,
        code: 'PROVIDER_CHAT_BAD_RESPONSE',
        message: contentType.toLowerCase().includes('text/html')
          ? 'Provider 返回了网页 HTML，请检查 Base URL 是否需要加 /v1'
          : 'Provider 没有返回 OpenAI-compatible choices',
        provider: status,
        upstreamStatus: resp.status
      };
    }
    return { success: true, provider: status, ...data };
  } catch (error) {
    return {
      success: false,
      code: error.name === 'AbortError' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_REQUEST_FAILED',
      message: error.name === 'AbortError' ? 'AI Provider 请求超时' : `AI Provider 调用失败: ${error.message}`,
      provider: status
    };
  } finally {
    clearTimeout(timer);
  }
}

function resolveChatModel(model = '') {
  const available = allowedChatModels();
  const requested = normalizeRequestedChatModelKey(model || AI_TEXT_MODEL, available);
  return available.find(item => item.k === requested) || available[0] || TXT[0];
}

function chatRequestPayload(body = {}, model) {
  const allowedKeys = [
    'messages',
    'stream',
    'tools',
    'tool_choice',
    'parallel_tool_calls',
    'temperature',
    'top_p',
    'max_tokens',
    'max_completion_tokens',
    'response_format',
    'reasoning_effort',
    'seed',
    'stop',
    'presence_penalty',
    'frequency_penalty'
  ];
  const payload = { model };
  allowedKeys.forEach(key => {
    if (body[key] !== undefined) payload[key] = body[key];
  });
  payload.stream = body.stream === true;
  return payload;
}

function chatStepHash(body = {}, model = '') {
  return crypto.createHash('sha256').update(JSON.stringify({ model, messages: body.messages || [] })).digest('hex');
}

function isChatToolContinuation(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === 'assistant' && Array.isArray(lastMessage.content)) {
    const embeddedToolCalls = lastMessage.content
      .filter(item => item?.type === 'tool_call' && item.tool_call)
      .map(item => item.tool_call);
    if (
      embeddedToolCalls.length > 0 &&
      embeddedToolCalls.every(call => String(call?.name || '').trim() && call?.output != null)
    ) return true;
  }
  let firstTrailingTool = messages.length;
  while (firstTrailingTool > 0 && messages[firstTrailingTool - 1]?.role === 'tool') {
    firstTrailingTool -= 1;
  }
  if (firstTrailingTool === messages.length || firstTrailingTool === 0) return false;
  const assistant = messages[firstTrailingTool - 1];
  const toolCalls = Array.isArray(assistant?.tool_calls) ? assistant.tool_calls : [];
  if (assistant?.role !== 'assistant' || toolCalls.length === 0) return false;
  const expectedCallIds = new Set(toolCalls.map(call => String(call?.id || '')).filter(Boolean));
  return messages.slice(firstTrailingTool).every(message => {
    const callId = String(message?.tool_call_id || '');
    return callId && expectedCallIds.has(callId);
  });
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
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)')
    .run(user.id, 'chat', -cost, before, after, `AI 对话: ${model.k}`);
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
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)')
    .run(charge.user_id, 'chat_refund', Number(charge.cost || 0), before, after, `AI 对话退款: ${reason}`);
  return true;
});

function sendMockChatStream(res, messages, model) {
  const completion = mockChatCompletion(messages, model);
  const text = String(completion.choices?.[0]?.message?.content || '本地 mock 回复');
  const id = completion.id || uid('chatcmpl_');
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: completion.created, model, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })}\n\n`);
  res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: completion.created, model, choices: [{ index: 0, delta: { content: text }, finish_reason: null }] })}\n\n`);
  res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: completion.created, model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
  res.end('data: [DONE]\n\n');
}

function chatContentText(content) {
  const items = Array.isArray(content) ? content : [content];
  return items.map(item => {
    if (typeof item === 'string') return item;
    return String(item?.text || item?.value || '');
  }).filter(Boolean).join('\n').trim();
}

function chatContentImageCount(content) {
  const items = Array.isArray(content) ? content : [content];
  return items.filter(item => {
    const type = String(item?.type || '').toLowerCase();
    return type === 'image_url' || type === 'input_image';
  }).length;
}

function chatImageToolName(tools = [], suffix = '') {
  return (Array.isArray(tools) ? tools : [])
    .map(tool => tool?.type === 'function' ? String(tool.function?.name || '') : '')
    .find(name => name && (
      name.endsWith(suffix) ||
      name.startsWith(`${suffix}_mcp_`)
    )) || '';
}

function chatImageToolNameMatches(name = '', baseName = '') {
  const normalized = String(name || '');
  return normalized === baseName || normalized.endsWith(baseName) || normalized.startsWith(`${baseName}_mcp_`);
}

function chatMessagesUseImageTools(messages = [], toolNames = []) {
  const names = new Set(toolNames.filter(Boolean));
  return messages.some(message => (Array.isArray(message?.tool_calls) ? message.tool_calls : [])
    .some(call => names.has(String(call?.function?.name || ''))));
}

function chatContentToResponsesContent(content, options = {}) {
  const items = Array.isArray(content) ? content : [{ type: 'text', text: String(content || '') }];
  return items.map(item => {
    if (typeof item === 'string') return { type: 'input_text', text: item };
    const type = String(item?.type || '').toLowerCase();
    if (type === 'image_url' || type === 'input_image') {
      if (options.replaceImages) {
        return { type: 'input_text', text: '[当前消息包含图片附件，网站生图工具会自动读取该附件]' };
      }
      const imageUrl = typeof item.image_url === 'string' ? item.image_url : item.image_url?.url || item.imageUrl || item.url || '';
      return imageUrl ? { type: 'input_image', image_url: imageUrl, detail: item.detail || item.image_url?.detail || 'auto' } : null;
    }
    return { type: 'input_text', text: String(item?.text || item?.value || '') };
  }).filter(item => item && (item.type !== 'input_text' || item.text));
}

function chatMessagesToResponsesInput(messages = [], options = {}) {
  return messages.map(message => {
    const role = ['system', 'developer', 'user', 'assistant'].includes(message?.role) ? message.role : 'user';
    const content = message?.role === 'tool'
      ? [{ type: 'input_text', text: `Tool result ${message.tool_call_id || ''}: ${String(message.content || '')}` }]
      : chatContentToResponsesContent(message?.content, options);
    return { role, content: content.length > 0 ? content : [{ type: 'input_text', text: '' }] };
  });
}

function chatMessageReferenceImages(messages = []) {
  const latestUserMessage = [...messages].reverse().find(message => message?.role === 'user') || {};
  const content = Array.isArray(latestUserMessage.content) ? latestUserMessage.content : [];
  return content.map(item => {
    const type = String(item?.type || '').toLowerCase();
    if (type !== 'image_url' && type !== 'input_image') return '';
    return typeof item.image_url === 'string' ? item.image_url : item.image_url?.url || item.imageUrl || item.url || '';
  }).map(value => String(value || '').trim()).filter(Boolean);
}

function chatPlanReferenceImages(plan = {}) {
  return (Array.isArray(plan?.referenceImages) ? plan.referenceImages : [])
    .map(item => typeof item === 'string' ? item : item?.url)
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

async function chatPlanningInputImages(req, body = {}, savedPlan = null) {
  const currentReferences = Array.isArray(req.integrationReferenceImages) ? req.integrationReferenceImages : [];
  const messageReferences = chatMessageReferenceImages(body.messages);
  const savedReferences = chatPlanReferenceImages(savedPlan);
  const sources = currentReferences.length > 0
    ? currentReferences
    : messageReferences.length > 0
      ? messageReferences
      : savedReferences;
  if (sources.length > 4) {
    throw integrationError(400, 'CHAT_REFERENCE_IMAGE_LIMIT', '电商主图设计师一次最多读取 4 张参考图片，请删除多余图片后重试');
  }
  const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const result = [];
  for (let index = 0; index < sources.length; index += 1) {
    const normalizedUrl = normalizeChatReferenceImage(sources[index]) || sources[index];
    const file = await loadReferenceImageFile({ url: normalizedUrl }, req);
    if (!allowedMimes.has(file.mime)) {
      throw integrationError(400, 'CHAT_REFERENCE_IMAGE_TYPE', `参考图片 ${index + 1} 不是受支持的 PNG、JPEG 或 WebP 图片`);
    }
    if (!file.buffer.length || file.buffer.length > IMAGE_PROXY_MAX_BYTES) {
      throw integrationError(400, 'CHAT_REFERENCE_IMAGE_SIZE', `参考图片 ${index + 1} 为空或超过 ${Math.floor(IMAGE_PROXY_MAX_BYTES / 1024 / 1024)}MB 限制`);
    }
    result.push({
      type: 'input_image',
      image_url: `data:${file.mime};base64,${file.buffer.toString('base64')}`,
      detail: 'high'
    });
  }
  return result;
}

function chatToolsToResponsesTools(tools = []) {
  if (!Array.isArray(tools)) return undefined;
  const converted = tools.map(tool => {
    if (tool?.type !== 'function' || !tool.function?.name) return null;
    return {
      type: 'function',
      name: tool.function.name,
      description: tool.function.description || '',
      parameters: tool.function.parameters || { type: 'object', properties: {} },
      ...(tool.function.strict !== undefined ? { strict: !!tool.function.strict } : {})
    };
  }).filter(Boolean);
  return converted.length > 0 ? converted : undefined;
}

function chatToolChoiceToResponsesToolChoice(toolChoice) {
  if (toolChoice === undefined || toolChoice === null) return undefined;
  if (typeof toolChoice === 'string') return toolChoice;
  if (toolChoice?.type === 'function' && toolChoice.function?.name) {
    return { type: 'function', name: toolChoice.function.name };
  }
  return undefined;
}

function isStructuredEcommerceImageBrief(text = '') {
  const value = String(text || '').trim();
  if (!value) return false;
  const hasPlatform = /(?:平台|渠道)\s*[:：]?\s*(?:淘宝|天猫|京东|拼多多|抖音|小红书|亚马逊|1688|速卖通|shopee|tiktok)/i.test(value);
  const hasCanvasSpec = /(?:\d{2,5}\s*[x×*]\s*\d{2,5}|(?:尺寸|画布|比例)\s*[:：]?\s*(?:\d{2,5}\s*[x×*]\s*\d{2,5}|\d{1,3}\s*[:：]\s*\d{1,3}))/i.test(value);
  const hasCommerceGoal = /(?:目标人群|目标用户|受众|主打|卖点|商品|产品|包装|规格|容量)/i.test(value);
  return hasPlatform && hasCanvasSpec && hasCommerceGoal;
}

function responsesRequestFromChat(body = {}, model, options = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const tools = chatToolsToResponsesTools(body.tools);
  const isEcommerceAgent = options.agentId === ECOMMERCE_MAIN_IMAGE_AGENT_ID;
  const preparePlanTool = isEcommerceAgent ? chatImageToolName(body.tools, 'prepare_ecommerce_image_plan') : '';
  const confirmPlanTool = isEcommerceAgent ? chatImageToolName(body.tools, 'confirm_ecommerce_image_plan') : '';
  const prepareImageTool = chatImageToolName(body.tools, 'prepare_image_generation');
  const executeImageTool = chatImageToolName(body.tools, 'execute_image_generation');
  const latestUserMessage = [...messages].reverse().find(message => message?.role === 'user') || {};
  const latestUserText = chatContentText(latestUserMessage.content);
  const latestUserImageCount = chatContentImageCount(latestUserMessage.content);
  const asksForNewImage = /(?:生图|图生图|文生图|生成[^\n]{0,20}(?:图片|图像|海报|主图)|制作[^\n]{0,20}(?:图片|图像|海报|主图)|创建[^\n]{0,20}(?:图片|图像|海报|主图)|做(?:一|1)?张|绘制[^\n]{0,20}(?:图片|图像|海报)|设计[^\n]{0,20}(?:图片|图像|海报|主图))/i.test(latestUserText)
    || isStructuredEcommerceImageBrief(latestUserText);
  const asksToEditAttachedImage = latestUserImageCount > 0
    && /(?:修改|编辑|重绘|扩图|延展|拉长|拉宽|左右拉|上下拉|放大画布|更换背景|去除背景|抠图|局部)/i.test(latestUserText);
  const asksForEcommercePlan = !!preparePlanTool && asksForNewImage
    && (latestUserImageCount >= 2 || /(?:电商)?主图|参考图.*(?:风格|排版)|(?:风格|排版).*参考图/i.test(latestUserText));
  const asksForImageRevision = /^(?:修改图片|修改这张|保持当前方案[，, ]*再出一版|再出一版)/i.test(latestUserText);
  const confirmsImagePlan = /确认方案\s+[A-F0-9]{6,32}/i.test(latestUserText);
  const confirmsImageQuote = /确认生图\s+[A-F0-9]{6,32}/i.test(latestUserText);
  const imageToolWorkflow = chatMessagesUseImageTools(messages, [preparePlanTool, confirmPlanTool, prepareImageTool, executeImageTool]);
  const shouldUseWebsiteImageTools = !!prepareImageTool
    && (asksForNewImage || asksToEditAttachedImage || asksForImageRevision || confirmsImagePlan || confirmsImageQuote || imageToolWorkflow);
  const input = chatMessagesToResponsesInput(messages, { replaceImages: shouldUseWebsiteImageTools });
  if (prepareImageTool) {
    input.unshift({
      role: 'developer',
      content: [{
        type: 'input_text',
        text: preparePlanTool && confirmPlanTool
          ? `电商主图必须先真实分析用户本轮的文字要求和全部参考图片，再使用 ${preparePlanTool} 提交你自由创作的完整设计提示词，并把识别/拟定的上图文案拆入字段。不得套用通用商品文案，不得固定图片顺序角色；每张图参考什么必须服从用户提示词并写进方案。用户确认或修改文案后，必须重新思考并使用 ${confirmPlanTool} 提交一份完整 finalPrompt，再生成报价；不得由服务器模板拼接方案。普通非电商图片才可使用 ${prepareImageTool} 直接报价。报价后仍需等待用户下一条消息确认，再使用 ${executeImageTool || 'execute_image_generation'}。禁止直接生成、返回或转述图片 Base64。`
          : `网站图片生成必须使用 ${prepareImageTool} 先报价，并等待用户下一条消息确认后再使用 ${executeImageTool || 'execute_image_generation'}。当前消息附件会由工具自动读取。禁止直接生成、返回或转述图片 Base64。`
      }]
    });
  }
  const request = {
    model,
    input
  };
  let toolChoice = chatToolChoiceToResponsesToolChoice(body.tool_choice);
  if (confirmsImageQuote && executeImageTool) {
    toolChoice = { type: 'function', name: executeImageTool };
  } else if (confirmsImagePlan && confirmPlanTool) {
    toolChoice = { type: 'function', name: confirmPlanTool };
  } else if ((asksForEcommercePlan || (asksForImageRevision && imageToolWorkflow)) && preparePlanTool) {
    toolChoice = { type: 'function', name: preparePlanTool };
  } else if ((asksForNewImage || asksToEditAttachedImage) && prepareImageTool) {
    toolChoice = { type: 'function', name: prepareImageTool };
  }
  if (confirmsImagePlan && options.savedPlan && confirmPlanTool) {
    const savedPlan = options.savedPlan;
    input.unshift({
      role: 'developer',
      content: [{
        type: 'input_text',
        text: [
          '下面是当前会话中已保存的 GPT 主图方案。用户本轮消息包含最终表格值和可选修改说明。',
          '请基于原方案重新创作一份完整、可直接交给图像模型的 finalPrompt；不要机械拼字段，也不要改变用户指定的参考图作用。',
          `用户原始要求：${normalizeChatImagePlanText(savedPlan.originalRequest || '', 4000)}`,
          `原始设计方案：${normalizeChatImagePlanText(savedPlan.designPrompt || '', 12000)}`,
          `参考关系：${normalizeChatReferenceRoles(savedPlan.referenceRoles).map(role => `图${role.imageIndex}：${role.roleDescription}`).join('；')}`,
          `原表格文案：${normalizeChatCopyItems(savedPlan.copyItems, savedPlan.copy).map(item => `${item.label}：${item.text || '（空）'}（${item.source}）`).join('；')}`,
          `必须调用 ${confirmPlanTool}，并提供 confirmationCode、designPrompt、copyItems、adjustment 和重新生成的 finalPrompt。`
        ].join('\n')
      }]
    });
  }
  if (toolChoice?.type === 'function' && (
    chatImageToolNameMatches(toolChoice.name, 'prepare_ecommerce_image_plan') ||
    chatImageToolNameMatches(toolChoice.name, 'confirm_ecommerce_image_plan')
  )) {
    const planningImages = Array.isArray(options.planningImages) ? options.planningImages : [];
    const latestUserInput = [...input].reverse().find(item => item?.role === 'user');
    if (latestUserInput && planningImages.length > 0) {
      latestUserInput.content = [
        ...(Array.isArray(latestUserInput.content) ? latestUserInput.content.filter(item => item?.type !== 'input_image') : []),
        ...planningImages
      ];
    }
  }
  const maxOutputTokens = Number(body.max_completion_tokens || body.max_tokens || 0);
  if (tools) request.tools = tools;
  if (toolChoice !== undefined) request.tool_choice = toolChoice;
  if (Number.isFinite(maxOutputTokens) && maxOutputTokens > 0) request.max_output_tokens = Math.min(maxOutputTokens, 32768);
  return request;
}

function responsesFunctionCalls(data = {}) {
  if (!Array.isArray(data.output)) return [];
  return data.output.filter(item => item?.type === 'function_call' && item?.name).map(item => ({
    id: item.call_id || item.id || uid('call_'),
    type: 'function',
    function: {
      name: item.name,
      arguments: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments || {})
    }
  }));
}

function responsesChatOutputText(data = {}) {
  const direct = typeof data.output_text === 'string' ? data.output_text.trim() : '';
  if (direct) return direct;
  if (!Array.isArray(data.output)) return '';
  return data.output
    .filter(item => item?.type === 'message' && Array.isArray(item.content))
    .flatMap(item => item.content)
    .filter(item => ['output_text', 'text'].includes(String(item?.type || '').toLowerCase()))
    .map(item => typeof item?.text === 'string' ? item.text.trim() : '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function responsesHasNativeImageOutput(data = {}) {
  return Array.isArray(data.output) && data.output.some(item => item?.type === 'image_generation_call' && item?.result);
}

function responsesToChatCompletion(data = {}, model) {
  const content = responsesChatOutputText(data);
  const toolCalls = responsesFunctionCalls(data);
  const finishReason = toolCalls.length > 0 ? 'tool_calls' : 'stop';
  return {
    id: data.id || uid('chatcmpl_'),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: data.model || model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: content || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
      },
      finish_reason: finishReason
    }],
    usage: {
      prompt_tokens: Number(data.usage?.input_tokens || data.usage?.prompt_tokens || 0),
      completion_tokens: Number(data.usage?.output_tokens || data.usage?.completion_tokens || 0),
      total_tokens: Number(data.usage?.total_tokens || (Number(data.usage?.input_tokens || 0) + Number(data.usage?.output_tokens || 0)) || 0)
    }
  };
}

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

function localWebsiteImageWorkflowCompletion(body = {}, model = '') {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const preparePlanTool = chatImageToolName(body.tools, 'prepare_ecommerce_image_plan');
  const confirmPlanTool = chatImageToolName(body.tools, 'confirm_ecommerce_image_plan');
  const prepareImageTool = chatImageToolName(body.tools, 'prepare_image_generation');
  const executeImageTool = chatImageToolName(body.tools, 'execute_image_generation');
  const imageToolKind = (name = '') => {
    const normalized = String(name || '');
    if (
      normalized === preparePlanTool ||
      normalized === 'prepare_ecommerce_image_plan' ||
      normalized.startsWith('prepare_ecommerce_image_plan_mcp_')
    ) return 'prepare-plan';
    if (
      normalized === confirmPlanTool ||
      normalized === 'confirm_ecommerce_image_plan' ||
      normalized.startsWith('confirm_ecommerce_image_plan_mcp_')
    ) return 'confirm-plan';
    if (
      normalized === prepareImageTool ||
      normalized === 'prepare_image_generation' ||
      normalized.startsWith('prepare_image_generation_mcp_')
    ) return 'prepare';
    if (
      normalized === executeImageTool ||
      normalized === 'execute_image_generation' ||
      normalized.startsWith('execute_image_generation_mcp_')
    ) return 'execute';
    return '';
  };
  const completionFromToolOutput = (outputText = '', toolKind = '') => {
    const normalizedOutput = String(outputText || '').trim();
    const confirmationCode = normalizedOutput.match(/确认生图\s+([A-F0-9]{6,32})/i)?.[1]?.toUpperCase() || '';
    const planCode = normalizedOutput.match(/确认方案\s+([A-F0-9]{6,32})/i)?.[1]?.toUpperCase() || '';
    const finalText = toolKind === 'execute'
      ? (normalizedOutput.includes('图片生成完成') ? '图片生成完成，结果见上方。需要修改时请在结果卡下方填写修改要求。' : normalizedOutput)
      : toolKind === 'prepare-plan' && planCode
        ? '主图方案已整理，请检查文案表单并点击“确认方案”。'
      : confirmationCode
        ? `生图报价已生成，请回复：**确认生图 ${confirmationCode}**`
        : normalizedOutput;
    if (!finalText) return null;
    return responsesToChatCompletion({
      id: uid('chatcmpl_image_tool_'),
      model,
      output_text: finalText
    }, model);
  };

  const lastMessage = messages[messages.length - 1];
  const embeddedToolCalls = lastMessage?.role === 'assistant' && Array.isArray(lastMessage.content)
    ? lastMessage.content
      .filter(item => item?.type === 'tool_call' && item.tool_call)
      .map(item => item.tool_call)
    : [];
  if (embeddedToolCalls.length > 0 && embeddedToolCalls.every(call => imageToolKind(call?.name))) {
    const outputText = embeddedToolCalls
      .map(call => typeof call?.output === 'string' ? call.output : chatContentText(call?.output))
      .filter(Boolean)
      .join('\n\n');
    const completion = completionFromToolOutput(
      outputText,
      embeddedToolCalls.map(call => imageToolKind(call?.name)).find(kind => kind === 'execute')
        || embeddedToolCalls.map(call => imageToolKind(call?.name)).find(kind => kind === 'confirm-plan')
        || embeddedToolCalls.map(call => imageToolKind(call?.name)).find(kind => kind === 'prepare-plan')
        || embeddedToolCalls.map(call => imageToolKind(call?.name)).find(Boolean)
        || ''
    );
    if (completion) return completion;
  }

  let firstTrailingTool = messages.length;
  while (firstTrailingTool > 0 && messages[firstTrailingTool - 1]?.role === 'tool') {
    firstTrailingTool -= 1;
  }
  if (firstTrailingTool > 0 && firstTrailingTool < messages.length) {
    const assistant = messages[firstTrailingTool - 1];
    const toolCalls = Array.isArray(assistant?.tool_calls) ? assistant.tool_calls : [];
    const toolNamesByCallId = new Map(toolCalls.map(call => [
      String(call?.id || ''),
      String(call?.function?.name || '')
    ]));
    const trailingTools = messages.slice(firstTrailingTool);
    const onlyWebsiteImageTools = assistant?.role === 'assistant'
      && trailingTools.length > 0
      && trailingTools.every(message => imageToolKind(toolNamesByCallId.get(String(message?.tool_call_id || ''))));
    if (onlyWebsiteImageTools) {
      const outputText = trailingTools.map(message => chatContentText(message.content)).filter(Boolean).join('\n\n');
      const usedKinds = trailingTools.map(message => imageToolKind(toolNamesByCallId.get(String(message?.tool_call_id || ''))));
      const usedKind = usedKinds.find(kind => kind === 'execute')
        || usedKinds.find(kind => kind === 'confirm-plan')
        || usedKinds.find(kind => kind === 'prepare-plan')
        || usedKinds.find(Boolean)
        || '';
      const completion = completionFromToolOutput(outputText, usedKind);
      if (completion) return completion;
    }
  }

  const latestUserMessage = [...messages].reverse().find(message => message?.role === 'user') || {};
  const latestUserText = chatContentText(latestUserMessage.content);
  const confirmationCode = latestUserText.match(/确认生图\s+([A-F0-9]{6,32})/i)?.[1]?.toUpperCase() || '';
  if (confirmationCode && executeImageTool) {
    return responsesToChatCompletion({
      id: uid('chatcmpl_image_confirm_'),
      model,
      output: [{
        id: uid('fc_image_confirm_'),
        type: 'function_call',
        status: 'completed',
        call_id: uid('call_'),
        name: executeImageTool,
        arguments: JSON.stringify({ confirmationCode })
      }]
    }, model);
  }
  return null;
}

function sendConvertedChatStream(res, completion) {
  const choice = completion.choices[0];
  const message = choice.message || {};
  const base = { id: completion.id, object: 'chat.completion.chunk', created: completion.created, model: completion.model };
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })}\n\n`);
  if (message.content) {
    res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { content: message.content }, finish_reason: null }] })}\n\n`);
  }
  if (message.tool_calls?.length) {
    res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { tool_calls: message.tool_calls.map((call, index) => ({ index, ...call })) }, finish_reason: null }] })}\n\n`);
  }
  res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: choice.finish_reason || 'stop' }] })}\n\n`);
  res.end('data: [DONE]\n\n');
}

const CHAT_REFUNDED_EMPTY_OUTPUT_MESSAGE = '上游模型未返回有效内容，本次请求已自动退款。请换一个更具体的问题后重新发送。';
const CHAT_REFUNDED_NATIVE_IMAGE_MESSAGE = '上游文本模型绕过网站报价直接返回了图片数据，本次文本请求已自动退款且图片数据未写入聊天。请重新发送一条生图消息，系统会先展示报价，确认后再执行生图。';
const CHAT_REFUNDED_PROVIDER_MESSAGE = '上游 AI 服务暂时不可用，本次请求已自动退款。请发送一条新消息后重试。';
const CHAT_REFUNDED_INVALID_ECOMMERCE_PLAN_MESSAGE = 'GPT‑5.6 未返回完整的电商主图方案，本次请求已自动退款。请重新发送需求后重试。';

function sendChatRefundedMessage(req, res, model, message = CHAT_REFUNDED_PROVIDER_MESSAGE) {
  const completion = responsesToChatCompletion({
    id: uid('chatcmpl_refund_'),
    model,
    output_text: message
  }, model);
  if (req.body?.stream === true) return sendConvertedChatStream(res, completion);
  return res.json(completion);
}

function validateEcommerceWorkflowResponse(data = {}, expectedToolName = '', referenceImageCount = 0) {
  if (!expectedToolName) return { ok: true };
  const call = responsesFunctionCalls(data).find(item => item?.function?.name === expectedToolName);
  if (!call) return { ok: false, reason: 'GPT‑5.6 未按要求返回方案工具结果' };
  let args;
  try {
    args = JSON.parse(call.function.arguments || '{}');
  } catch {
    return { ok: false, reason: 'GPT‑5.6 返回的方案参数不是有效 JSON' };
  }
  if (chatImageToolNameMatches(expectedToolName, 'prepare_ecommerce_image_plan')) {
    const roles = normalizeChatReferenceRoles(args.referenceRoles);
    if (normalizeChatImagePlanText(args.designPrompt, 12000).length < 40) {
      return { ok: false, reason: 'GPT‑5.6 返回的完整设计方案过短' };
    }
    if (referenceImageCount > 0 && roles.length === 0) {
      return { ok: false, reason: 'GPT‑5.6 没有说明参考图片的实际用途' };
    }
    if (roles.some(role => role.imageIndex > referenceImageCount && referenceImageCount > 0)) {
      return { ok: false, reason: 'GPT‑5.6 返回了不存在的参考图片序号' };
    }
  }
  if (chatImageToolNameMatches(expectedToolName, 'confirm_ecommerce_image_plan')) {
    if (normalizeChatImagePlanText(args.finalPrompt, 12000).length < 40) {
      return { ok: false, reason: 'GPT‑5.6 没有返回完整的最终生图提示词' };
    }
  }
  return { ok: true, args };
}

async function ecommerceWorkflowRequestOptions(req, body = {}) {
  const agentId = req.integrationAgentId || '';
  if (agentId !== ECOMMERCE_MAIN_IMAGE_AGENT_ID) return { agentId };
  const context = {
    user: req.integrationUser,
    conversationId: req.integrationConversationId,
    messageId: req.integrationMessageId
  };
  const savedRecord = latestChatImagePlan(context);
  const savedPlan = savedRecord?.plan ? normalizeChatImagePlanV2(savedRecord.plan) : null;
  const latestUserMessage = [...(Array.isArray(body.messages) ? body.messages : [])].reverse().find(message => message?.role === 'user') || {};
  const latestUserText = chatContentText(latestUserMessage.content);
  const shouldLoadImages = chatContentImageCount(latestUserMessage.content) > 0
    || (req.integrationReferenceImages || []).length > 0
    || /确认方案\s+[A-F0-9]{6,32}|^(?:修改图片|修改这张|保持当前方案[，, ]*再出一版|再出一版)/i.test(latestUserText);
  const planningImages = shouldLoadImages ? await chatPlanningInputImages(req, body, savedPlan) : [];
  return { agentId, savedPlan, planningImages };
}

async function proxyLibreChatResponsesRoute(req, res, { route, status, model, requestId, stepHash }) {
  const controller = new AbortController();
  const timeoutMs = req.integrationAgentId === ECOMMERCE_MAIN_IMAGE_AGENT_ID
    ? Math.max(status.timeoutMs, ECOMMERCE_TEXT_PROVIDER_TIMEOUT_MS)
    : status.timeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const workflowOptions = await ecommerceWorkflowRequestOptions(req, req.body);
    const providerRequest = responsesRequestFromChat(req.body, model.k, workflowOptions);
    const upstream = await fetchProvider(joinProviderUrl(status.baseUrl, routeTextEndpoint(route)), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerAuthKey('text', route)}`
      },
      body: JSON.stringify(providerRequest),
      signal: controller.signal
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const reason = data.error?.message || data.message || `HTTP ${upstream.status}`;
      refundChatCharge(requestId, reason, stepHash);
      console.warn('[CHAT_PROVIDER_REQUEST_REFUNDED]', JSON.stringify({ requestId, model: model.k, status: upstream.status }));
      return sendChatRefundedMessage(req, res, model.k);
    }
    const expectedToolName = providerRequest.tool_choice?.type === 'function'
      && (
        chatImageToolNameMatches(providerRequest.tool_choice.name, 'prepare_ecommerce_image_plan') ||
        chatImageToolNameMatches(providerRequest.tool_choice.name, 'confirm_ecommerce_image_plan')
      )
      ? providerRequest.tool_choice.name
      : '';
    const ecommerceValidation = validateEcommerceWorkflowResponse(data, expectedToolName, workflowOptions.planningImages?.length || 0);
    if (!ecommerceValidation.ok) {
      refundChatCharge(requestId, ecommerceValidation.reason, stepHash);
      console.warn('[CHAT_ECOMMERCE_PLAN_REFUNDED]', JSON.stringify({ requestId, model: model.k, reason: ecommerceValidation.reason }));
      return sendChatRefundedMessage(req, res, model.k, CHAT_REFUNDED_INVALID_ECOMMERCE_PLAN_MESSAGE);
    }
    const completion = responsesToChatCompletion(data, model.k);
    const message = completion.choices[0]?.message;
    if (!message?.content && !message?.tool_calls?.length) {
      const nativeImageOutput = responsesHasNativeImageOutput(data);
      console.warn('[CHAT_PROVIDER_BAD_RESPONSE]', JSON.stringify({
        requestId,
        model: model.k,
        status: String(data.status || ''),
        incompleteReason: String(data.incomplete_details?.reason || ''),
        nativeImageOutput,
        shape: providerResponseShape(data)
      }));
      refundChatCharge(requestId, nativeImageOutput ? 'Provider Responses 绕过生图报价返回图片数据' : 'Provider Responses 返回格式错误', stepHash);
      completion.choices[0].message.content = nativeImageOutput ? CHAT_REFUNDED_NATIVE_IMAGE_MESSAGE : CHAT_REFUNDED_EMPTY_OUTPUT_MESSAGE;
      completion.choices[0].finish_reason = 'stop';
      if (req.body?.stream === true) return sendConvertedChatStream(res, completion);
      return res.json(completion);
    }
    completeChatStep(requestId, stepHash, message.tool_calls?.length > 0);
    if (req.body?.stream === true) return sendConvertedChatStream(res, completion);
    return res.json(completion);
  } catch (error) {
    refundChatCharge(requestId, error.message || '上游调用失败', stepHash);
    console.warn('[CHAT_PROVIDER_REQUEST_REFUNDED]', JSON.stringify({
      requestId,
      model: model.k,
      status: error.name === 'AbortError' ? 'timeout' : 'network-error',
      code: String(error.code || '')
    }));
    if (res.headersSent) return res.end();
    if (Number(error.status || 0) >= 400 && Number(error.status || 0) < 500 && /^CHAT_REFERENCE_IMAGE_/.test(String(error.code || ''))) {
      return sendChatRefundedMessage(req, res, model.k, `${error.message}。本次未调用 GPT‑5.6，已退回 5 算力。`);
    }
    return sendChatRefundedMessage(req, res, model.k);
  } finally {
    clearTimeout(timer);
  }
}

async function proxyLibreChatCompletion(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (!Array.isArray(body.messages)) {
    throw integrationError(400, 'CHAT_MESSAGES_REQUIRED', '缺少 messages');
  }
  const latestUserText = chatContentText([...(body.messages || [])].reverse().find(message => message?.role === 'user')?.content || '');
  if (!req.integrationAgentId && /确认方案\s+[A-F0-9]{6,32}/i.test(latestUserText)) {
    const completion = responsesToChatCompletion({
      id: uid('chatcmpl_agent_required_'),
      model: body.model || AI_TEXT_MODEL,
      output_text: '当前旧会话缺少“电商主图设计师”身份，请新建会话并重新选择该智能体后再生成方案。'
    }, body.model || AI_TEXT_MODEL);
    if (body.stream === true) return sendConvertedChatStream(res, completion);
    return res.json(completion);
  }
  const managedAgent = req.integrationAgentId
    ? chatSettingsState().managedAgents.find(agent => agent.id === req.integrationAgentId && agent.enabled)
    : null;
  const model = resolveChatModel(managedAgent?.model || body.model);
  const route = resolveTextRoute({ model: model.k, textModel: model.k });
  const status = routeProviderStatus(route, 'text');
  if (!status.enabled) {
    if (body.stream === true) return sendMockChatStream(res, body.messages, model.k);
    const completion = mockChatCompletion(body.messages, model.k);
    delete completion.success;
    delete completion.provider;
    return res.json(completion);
  }

  const requestId = req.integrationMessageId || uid('chatreq_');
  const stepHash = chatStepHash(body, model.k);
  const reservation = reserveChatCharge(requestId, req.integrationUser, model, stepHash, isChatToolContinuation(body));
  if (reservation.duplicate) {
    const chargeStatus = String(reservation.charge?.status || 'reserved');
    if (chargeStatus === 'refunded') {
      return sendChatRefundedMessage(req, res, model.k);
    }
    if (chargeStatus === 'completed') {
      throw integrationError(409, 'CHAT_REQUEST_COMPLETED', '该消息已经完成，请勿重复提交');
    }
    throw integrationError(409, 'CHAT_REQUEST_IN_PROGRESS', '该消息正在处理，请勿重复提交');
  }

  const localImageCompletion = localWebsiteImageWorkflowCompletion(body, model.k);
  if (localImageCompletion) {
    const awaitingToolResult = localImageCompletion.choices.some(choice => choice?.finish_reason === 'tool_calls' || choice?.message?.tool_calls?.length > 0);
    completeChatStep(requestId, stepHash, awaitingToolResult);
    if (body.stream === true) return sendConvertedChatStream(res, localImageCompletion);
    return res.json(localImageCompletion);
  }

  if (isResponsesTextRoute(route)) {
    return proxyLibreChatResponsesRoute(req, res, { route, status, model, requestId, stepHash });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), status.timeoutMs);
  let emitted = false;
  let sawToolCalls = false;
  let detectionTail = '';
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  req.on('aborted', onClose);
  res.on('close', onClose);
  try {
    const upstream = await fetchProvider(joinProviderUrl(status.baseUrl, routeTextChatEndpoint(route)), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerAuthKey('text', route)}`
      },
      body: JSON.stringify(chatRequestPayload(body, model.k)),
      signal: controller.signal
    });
    if (!upstream.ok) {
      const upstreamBody = await upstream.json().catch(() => ({}));
      const reason = upstreamBody.error?.message || upstreamBody.message || `HTTP ${upstream.status}`;
      refundChatCharge(requestId, reason, stepHash);
      console.warn('[CHAT_PROVIDER_REQUEST_REFUNDED]', JSON.stringify({ requestId, model: model.k, status: upstream.status }));
      return sendChatRefundedMessage(req, res, model.k);
    }

    if (body.stream === true) {
      res.status(200);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        emitted = emitted || value.length > 0;
        const detectionText = detectionTail + Buffer.from(value).toString('utf8');
        sawToolCalls = sawToolCalls || /["']tool_calls["']/.test(detectionText);
        detectionTail = detectionText.slice(-256);
        if (!res.write(Buffer.from(value))) {
          await new Promise(resolve => res.once('drain', resolve));
        }
      }
      completeChatStep(requestId, stepHash, sawToolCalls);
      return res.end();
    }

    const data = await upstream.json().catch(() => ({}));
    if (!Array.isArray(data.choices)) {
      refundChatCharge(requestId, 'Provider 返回格式错误', stepHash);
      return sendChatRefundedMessage(req, res, model.k, CHAT_REFUNDED_EMPTY_OUTPUT_MESSAGE);
    }
    const awaitingToolResult = data.choices.some(choice => choice?.finish_reason === 'tool_calls' || choice?.message?.tool_calls?.length > 0);
    completeChatStep(requestId, stepHash, awaitingToolResult);
    return res.json(data);
  } catch (error) {
    if (!emitted) refundChatCharge(requestId, error.message || '上游调用失败', stepHash);
    else completeChatStep(requestId, stepHash, false);
    if (res.headersSent) return res.end();
    console.warn('[CHAT_PROVIDER_REQUEST_REFUNDED]', JSON.stringify({
      requestId,
      model: model.k,
      status: error.name === 'AbortError' ? 'timeout' : 'network-error'
    }));
    return sendChatRefundedMessage(req, res, model.k);
  } finally {
    clearTimeout(timer);
    req.off('aborted', onClose);
    res.off('close', onClose);
  }
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const useChat = shouldUseChatForTextRoute(options.route, requestStatus);
    const requestUrl = joinProviderUrl(requestStatus.baseUrl, useChat ? routeTextChatEndpoint(options.route) : routeTextEndpoint(options.route));
    const requestBody = useChat
      ? { model, messages: responsesInputToChatMessages(input), stream: false }
      : { model, input };
    const resp = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerAuthKey('text', options.route)}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        success: false,
        code: useChat ? 'PROVIDER_CHAT_FAILED' : 'PROVIDER_RESPONSES_FAILED',
        message: data.message || data.error?.message || `Provider returned ${resp.status}`,
        provider: requestStatus,
        upstreamStatus: resp.status,
        upstream: data
      };
    }
    return { success: true, provider: { ...requestStatus, textEndpoint: useChat ? 'chat/completions' : 'responses' }, ...data };
  } catch (error) {
    return {
      success: false,
      code: error.name === 'AbortError' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_REQUEST_FAILED',
      message: error.name === 'AbortError' ? `AI Provider 请求超时（已等待 ${Math.round(timeoutMs / 1000)} 秒）` : `AI Provider 调用失败: ${error.message}`,
      provider: requestStatus
    };
  } finally {
    clearTimeout(timer);
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

function runQueuedProviderImageRequest(runRequest, options = {}) {
  if (options.bypassProviderQueue) {
    notifyProviderImageQueue(options, 'running', 0, {
      queueMode: 'persistent-task-worker',
      failureDomain: imageProviderFailureDomain(options.route)
    });
    return runRequest(options.signal);
  }
  const delayMs = providerImageRequestDelay(options);
  const failureDomain = imageProviderFailureDomain(options.route);
  return imageRequestScheduler.schedule(async (signal) => {
    if (options.forceQueueDelay && delayMs > 0) await wait(delayMs);
    return runRequest(signal);
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

function providerImageEmptyResponse(status, upstream) {
  return {
    success: false,
    code: 'PROVIDER_IMAGE_EMPTY_BILLED_RESPONSE',
    message: '上游返回成功状态，但没有提供最终图片 URL 或 Base64（可能只有 revised_prompt/usage）。本地未保存结果且不会扣除算力；上游可能已经计费，请凭任务记录联系线路处理。',
    provider: status,
    upstream
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
        if (!resp.ok) {
          return {
            success: false,
            code: 'PROVIDER_IMAGE_FAILED',
            message: parsed.message || `Provider returned ${resp.status}`,
            provider: status,
            upstreamStatus: resp.status,
            upstream: parsed.data,
            upstreamItem
          };
        }
        return { success: true, images: parsed.images, upstreamItem };
      } catch (err) {
        const cancelled = !!schedulerSignal?.aborted;
        return {
          success: false,
          code: cancelled ? 'TASK_CANCELLED' : (err.name === 'AbortError' ? 'PROVIDER_IMAGE_TIMEOUT' : 'PROVIDER_IMAGE_ERROR'),
          message: cancelled ? '任务已取消' : (err.name === 'AbortError' ? 'Provider 图片生成超时' : (err.message || 'Provider 图片生成失败')),
          provider: status
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
      return providerImageEmptyResponse(status, upstream);
    }
    const request = {
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
    return { success: true, mock: false, provider: status, images, upstream, request };
  } catch (err) {
    return {
      success: false,
      code: err.name === 'AbortError' ? 'PROVIDER_IMAGE_TIMEOUT' : 'PROVIDER_IMAGE_ERROR',
      message: err.name === 'AbortError' ? 'Provider 图片生成超时' : (err.message || 'Provider 图片生成失败'),
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
        if (!resp.ok) {
          return {
            success: false,
            code: 'PROVIDER_IMAGE_EDIT_FAILED',
            message: parsed.message || `Provider returned ${resp.status}`,
            provider: status,
            upstreamStatus: resp.status,
            upstream: parsed.data,
            upstreamItem,
            request: { ...editRequestMeta, preTlsRetryCount }
          };
        }
        return { success: true, images: parsed.images, upstreamItem };
      } catch (err) {
        const cancelled = !!schedulerSignal?.aborted;
        return {
          success: false,
          code: cancelled ? 'TASK_CANCELLED' : (err.name === 'AbortError' ? 'PROVIDER_IMAGE_EDIT_TIMEOUT' : 'PROVIDER_IMAGE_EDIT_ERROR'),
          message: cancelled ? '任务已取消' : providerImageRequestErrorMessage(err),
          provider: status,
          request: {
            ...editRequestMeta,
            preTlsRetryCount: Number(err?.providerPreTlsRetryCount || 0)
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
      return providerImageEmptyResponse(status, upstream);
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
        preTlsRetryCount: Math.max(0, ...upstream.map((item) => Number(item.preTlsRetryCount || 0)))
      }
    };
  } catch (err) {
    return {
      success: false,
      code: err.name === 'AbortError' ? 'PROVIDER_IMAGE_EDIT_TIMEOUT' : 'PROVIDER_IMAGE_EDIT_ERROR',
      message: providerImageRequestErrorMessage(err),
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
    db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)').run(id,'register_gift',giftCredits,0,giftCredits,`注册赠送 ${giftCredits} 算力`);
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

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: '请输入管理员账号和密码' });
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  const passwordVerification = user ? verifyPasswordHash(user.password_hash, password) : { ok: false };
  if (!user || !passwordVerification.ok) return res.status(401).json({ message: '账号或密码不正确' });
  if (user.role !== 'admin') return res.status(403).json({ message: '当前账号不是管理员' });
  rehashPasswordIfNeeded(user, password, passwordVerification);
  db.prepare("UPDATE users SET last_login_at=datetime('now') WHERE id=?").run(user.id);
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: san(user) });
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
app.get('/api/template/settings', (req, res) => res.json(templateWorkflowState()));
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
  res.json({ items: db.prepare('SELECT * FROM balance_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.userId) });
});
app.post('/api/user/redeem', auth, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: '请输入兑换码' });
  const rc = db.prepare('SELECT * FROM redeem_codes WHERE code=? AND enabled=1 AND used_count<max_uses').get(code.toUpperCase());
  if (!rc) return res.status(404).json({ message: '兑换码不存在' });
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.userId);
  const nb = u.balance + rc.amount;
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(nb, u.id);
  db.prepare('UPDATE redeem_codes SET used_count=used_count+1 WHERE code=?').run(code.toUpperCase());
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)').run(u.id,'redeem',rc.amount,u.balance,nb,'兑换码: '+code.toUpperCase());
  res.json({ success: true, balance: nb, amount: rc.amount });
});

// ===================== PROJECTS / CANVAS =====================
app.get('/api/user/projects', auth, (req, res) => {
  const ps = db.prepare('SELECT * FROM projects WHERE user_id=? ORDER BY updated_at DESC').all(req.user.userId);
  const items = ps.map(p=>{
    const data = projectDataFromRow(p);
    return {id:p.id,name:p.name,thumbnail:data.thumbnail||'',updatedAt:p.updated_at,createdAt:p.created_at};
  });
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

// ===================== AI GENERATION =====================
const fetch = (...args) => import('node-fetch').then(({default:f})=>f(...args));
const providerHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
  maxFreeSockets: 8
});
const providerImageHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
  maxFreeSockets: 8,
  family: 4
});
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
const LINGSUAN_IMAGE_PROXY_HOSTS = new Set(['lingsuan.top']);
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

function providerImageAgentForUrl(url = '') {
  let protocol = '';
  try { protocol = new URL(String(url)).protocol; } catch {}
  if (protocol !== 'https:') return undefined;
  return isLingsuanImageProxyTarget(url) ? providerImageProxyAgent : providerImageHttpsAgent;
}

function providerImageTransportForUrl(url = '') {
  let protocol = '';
  try { protocol = new URL(String(url)).protocol; } catch {}
  if (protocol !== 'https:') return 'http-direct';
  return isLingsuanImageProxyTarget(url) ? 'https-proxy' : 'https-ipv4-pool';
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
      signal
    });
  }
  return fetchValidatedProxyImage(rawUrl, signal);
}
async function loadRemoteProviderImagePayload(rawUrl = '') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
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

function normalizeImageToolUrl(item = {}) {
  const raw = item && typeof item === 'object' ? item : { url: item };
  return firstString(raw.url, raw.imageUrl, raw.image_url, raw.uploadedUrl, raw.previewUrl, raw.preview, raw.src);
}

function imageToolReferences(body = {}) {
  const baseImage = normalizeImageToolUrl(body.imageUrl || body.image || body.url || body.originalUrl || body.original_url);
  const refs = [];
  if (baseImage) refs.push({ url: baseImage, fileName: 'image.png' });
  if (Array.isArray(body.referenceImages)) {
    body.referenceImages
      .map(normalizeImageToolUrl)
      .filter(Boolean)
      .forEach(url => refs.push({ url }));
  }
  return refs;
}

function buildImageToolPrompt(body = {}, type = 'inpaint') {
  const userPrompt = String(body.prompt || '').trim();
  const baseByType = {
    erase: '请根据原图上下文，只重绘 mask 透明或白色标记区域，移除涂抹区域内的对象并自然补全背景。未涂抹区域必须保持不变，包括未涂抹区域内的文字、品牌标识、瓶身标签和商品结构。',
    outpaint: '请基于原图自然扩展画面，保持主体、透视、材质、光线、商品包装和整体电商视觉风格一致。原图主体不得变形，新增区域需要自然补全背景。'
  };
  const base = baseByType[type] || '请根据用户提示和参考图，只重绘 mask 透明或白色标记区域。未涂抹区域必须保持不变，尤其不要改动未涂抹区域内的文字、品牌标识、瓶身标签、产品包装、主体结构和整体构图。';
  const fallbackByType = {
    erase: '自然消除涂抹区域',
    outpaint: '自然扩展画布背景'
  };
  return buildEcommerceImagePrompt(
    `${base}\n用户提示：${userPrompt || fallbackByType[type] || '按涂抹区域进行局部修改'}`,
    { hasReferenceImages: true, referenceCount: imageToolReferences(body).length || 1 }
  );
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

function imageToolSize(body = {}) {
  const width = Number(body.imageNaturalWidth || body.width || body.canvasWidth || 0);
  const height = Number(body.imageNaturalHeight || body.height || body.canvasHeight || 0);
  if (width > 0 && height > 0) {
    const ratio = width / height;
    if (ratio > 1.15) return '16:9';
    if (ratio < 0.87) return '9:16';
  }
  return body.size || body.ratio || '1:1';
}

function makeImageToolResponse(providerResult = {}, body = {}, type = 'inpaint') {
  const taskId = uid(`${type}_`);
  const image = normalizeTaskImage((providerResult.images || [])[0] || {}, 0, taskId);
  const width = Number(body.imageNaturalWidth || body.width || 0);
  const height = Number(body.imageNaturalHeight || body.height || 0);
  return {
    success: true,
    id: taskId,
    taskId,
    status: 'success',
    progress: 100,
    mock: !!providerResult.mock,
    editMode: !!providerResult.editMode,
    provider: providerResult.provider,
    imageUrl: image.imageUrl,
    url: image.url,
    originalUrl: image.originalUrl,
    thumbUrl: image.preview,
    thumbnailUrl: image.preview,
    width,
    height,
    resultImages: [image],
    images: [image],
    operation: type,
    request: providerResult.request
  };
}

async function runImageToolEdit(req, res, type = 'inpaint') {
  try {
    const references = imageToolReferences(req.body);
    const mask = firstString(req.body.maskAlphaBase64, req.body.maskBase64, req.body.mask, req.body.maskUrl);
    if (!references.length) return res.status(400).json({ success: false, code: 'IMAGE_TOOL_IMAGE_REQUIRED', message: '缺少待处理图片' });
    if (!mask) return res.status(400).json({ success: false, code: 'IMAGE_TOOL_MASK_REQUIRED', message: '请先涂抹需要处理的区域' });

    const route = resolveRequestImageRoute(req.body);
    const model = resolveImageModelKey(req.body);
    const operationType = type;
    const prompt = buildImageToolPrompt(req.body, operationType);
    const providerResult = await callProviderImageEdit(prompt, {
      ...req.body,
      body: {
        ...req.body,
        referenceImages: references,
        mask
      },
      req,
      route,
      model,
      size: imageToolSize(req.body),
      quality: req.body.quality || req.body.clarity || 'auto',
      n: 1,
      mask
    });
    if (!providerResult.success) {
      return res.status(502).json({
        success: false,
        code: providerResult.code || 'IMAGE_TOOL_PROVIDER_FAILED',
        message: providerResult.message || '图片编辑接口调用失败',
        provider: providerResult.provider
      });
    }
    const persistedImages = await persistProviderImageResults(providerResult.images, providerResult.request);
    res.json(makeImageToolResponse({ ...providerResult, images: persistedImages }, req.body, operationType));
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 'IMAGE_TOOL_EDIT_ERROR',
      message: error.message || '图片编辑任务失败'
    });
  }
}

async function runImageToolOutpaint(req, res) {
  try {
    const references = imageToolReferences(req.body);
    if (!references.length) return res.status(400).json({ success: false, code: 'IMAGE_TOOL_IMAGE_REQUIRED', message: '缺少待扩展图片' });

    const route = resolveRequestImageRoute(req.body);
    const model = resolveImageModelKey(req.body);
    const prompt = buildImageToolPrompt(req.body, 'outpaint');
    const providerResult = await callProviderImageEdit(prompt, {
      ...req.body,
      body: {
        ...req.body,
        referenceImages: references
      },
      req,
      route,
      model,
      size: imageToolSize(req.body),
      quality: req.body.quality || req.body.clarity || 'auto',
      n: 1
    });
    if (!providerResult.success) {
      return res.status(502).json({
        success: false,
        code: providerResult.code || 'IMAGE_TOOL_OUTPAINT_FAILED',
        message: providerResult.message || '扩图接口调用失败',
        provider: providerResult.provider
      });
    }

    const persistedImages = await persistProviderImageResults(providerResult.images, providerResult.request);
    const task = createCompletedTask(req, {
      prompt,
      modelKey: model,
      imageCount: 1,
      results: persistedImages,
      request: providerResult.request
    });
    res.json({
      success: true,
      mock: !!providerResult.mock,
      editMode: !!providerResult.editMode,
      provider: providerResult.provider,
      operation: 'outpaint',
      ...makeTaskResponse(task)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 'IMAGE_TOOL_OUTPAINT_ERROR',
      message: error.message || '扩图任务失败'
    });
  }
}

async function runImageToolReversePrompt(req, res) {
  try {
    const imageUrl = normalizeImageToolUrl(req.body.imageUrl || req.body.image || req.body.url || req.body.originalUrl);
    if (!imageUrl) return res.status(400).json({ success: false, code: 'IMAGE_TOOL_IMAGE_REQUIRED', message: '缺少待分析图片' });

    let reference;
    try {
      reference = await loadReferenceImageFile({ url: imageUrl }, req);
    } catch (error) {
      return res.status(400).json({
        success: false,
        code: 'IMAGE_TOOL_IMAGE_UNREADABLE',
        message: error.message || '待分析图片读取失败'
      });
    }

    const route = resolveTextRoute(req.body);
    const model = String(req.body.textModel || req.body.textModelKey || route?.dm || AI_TEXT_MODEL).trim();
    const instruction = [
      '请根据下面这张电商图片，反推出适合文生图或图生图使用的中文提示词。',
      '输出一段完整提示词，包含主体、构图、光线、材质、背景、文字/包装要点、画面风格和电商转化重点。',
      '不要输出解释，不要输出列表标题。'
    ].join('\n');
    const input = [{
      role: 'user',
      content: [
        { type: 'input_text', text: instruction },
        { type: 'input_image', image_url: `data:${reference.mime};base64,${reference.buffer.toString('base64')}` }
      ]
    }];
    const providerResult = await callProviderResponses(input, { route, model });
    if (!providerResult.success) {
      return res.status(502).json({
        success: false,
        code: providerResult.code || 'IMAGE_TOOL_REVERSE_PROMPT_FAILED',
        message: providerResult.message || '反推提示词接口调用失败',
        provider: providerResult.provider
      });
    }
    const text = imageToolOutputText(providerResult) || '高质量电商产品主图，主体清晰，构图居中，商业摄影级光影，背景干净，材质真实，细节丰富。';
    res.json({
      success: true,
      mock: !!providerResult.mock,
      provider: providerResult.provider,
      prompt: text,
      text,
      rawPrompt: text,
      rawText: text
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 'IMAGE_TOOL_REVERSE_PROMPT_ERROR',
      message: error.message || '反推提示词失败'
    });
  }
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

app.post('/api/image-tools/outpaint', auth, async (req, res) => {
  await runImageToolOutpaint(req, res);
});

app.post('/api/image-tools/reverse-prompt', auth, async (req, res) => {
  await runImageToolReversePrompt(req, res);
});

app.post('/api/image-tools/inpaint', auth, async (req, res) => {
  await runImageToolEdit(req, res, 'inpaint');
});

app.post('/api/image-tools/erase', auth, async (req, res) => {
  await runImageToolEdit(req, res, 'erase');
});

app.post('/api/canvas/generate-prompt', auth, async (req, res) => {
  const draft = buildCanvasPromptInput(req.body || {});
  if (!draft.requirement && draft.imageCount <= 0) {
    return res.status(400).json({ success: false, code: 'CANVAS_PROMPT_INPUT_REQUIRED', message: '请输入提示词需求或上传参考图' });
  }

  const route = resolveTextRoute(req.body || {});
  const model = String(req.body.textModel || req.body.model || route?.dm || AI_TEXT_MODEL).trim();
  const fallbackPrompt = buildCanvasPromptFallback(draft.requirement, draft.imageCount);
  const providerResult = await callProviderResponses(draft.input, { route, model });
  const providerPrompt = providerResult.success && !providerResult.mock ? imageToolOutputText(providerResult) : '';
  const prompt = providerPrompt || fallbackPrompt;

  res.json({
    success: true,
    mock: !!providerResult.mock,
    fallback: !providerPrompt,
    prompt,
    draftPrompt: prompt,
    requirement: draft.requirement,
    imageCount: draft.imageCount,
    imageLabels: draft.imageLabels,
    textModel: model,
    textRouteId: route?.id || route?.routeId || '',
    provider: providerResult.provider,
    providerError: providerResult.success ? '' : (providerResult.message || providerResult.code || '文本模型暂不可用，已生成基础提示词草稿')
  });
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

app.get('/api/canvas/ecommerce-suite/config', (req, res) => {
  const config = ecommerceSuitePublicConfig();
  const defaults = config.defaults || defaultEcommerceSuiteAgent.defaults;
  const imageModel = resolveImageModelKey({ imageModelKey: defaults.imageModelKey || AI_IMAGE_MODEL });
  const textModel = String(defaults.textModelKey || AI_TEXT_MODEL).trim();
  res.json({
    success: true,
    enabled: config.enabled !== false,
    sectionMode: config.sectionMode || 'dynamic',
    sections: config.sections,
    skills: config.skills,
    defaultSkillId: config.defaultSkillId,
    defaults,
    textModel,
    imageModel,
    analysisCost: modelCost(textModel, 'text'),
    estimatedImageCostPerSection: modelCost(imageModel, 'image') * Math.max(1, Math.min(Number(defaults.imageCount || 1) || 1, 4))
  });
});

app.post('/api/canvas/ecommerce-suite/prompts', auth, async (req, res) => {
  const body = req.body || {};
  const config = ecommerceSuiteAgentConfig();
  if (config.enabled === false) {
    return res.status(403).json({ success: false, code: 'ECOMMERCE_SUITE_DISABLED', message: '电商套图 Agent 暂未启用' });
  }

  const context = ecommerceSuiteContextFromBody(body, config);
  const buckets = ecommerceSuiteImageBuckets(body);
  if (!buckets.productImages.length) {
    return res.status(400).json({ success: false, code: 'ECOMMERCE_SUITE_PRODUCT_IMAGE_REQUIRED', message: '请先上传产品图' });
  }
  if (!context.requirement && buckets.all.length <= 0) {
    return res.status(400).json({ success: false, code: 'ECOMMERCE_SUITE_INPUT_REQUIRED', message: '请输入产品信息或上传产品图/参考图' });
  }

  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.userId);
  if (!u) return res.status(401).json({ success: false, code: 'AUTH_USER_NOT_FOUND', message: '登录状态已失效，请重新登录' });

  const textRoute = resolveTextRoute(body);
  const imageRoute = resolveImageRoute(body, req.user.userId);
  const textModel = String(body.textModel || body.textModelKey || textRoute?.dm || AI_TEXT_MODEL).trim();
  const imageModel = resolveImageModelKey({ ...body, model: body.imageModel || body.imageModelKey || body.model || imageRoute?.dm || AI_IMAGE_MODEL });
  const analysisCost = modelCost(textModel, 'text');
  const estimatedImageCostPerSection = modelCost(imageModel, 'image') * context.imageCount;
  if (u.balance < analysisCost) {
    return res.status(400).json({ success: false, code: 'INSUFFICIENT_BALANCE', message: `算力不足，需要 ${analysisCost}，当前 ${u.balance}`, analysisCost });
  }

  let references = [];
  try {
    references = await ecommerceSuiteReferencesForAnalysis(body, req);
  } catch (error) {
    return res.status(400).json({ success: false, code: 'ECOMMERCE_SUITE_REFERENCE_UNREADABLE', message: error.message || '图片读取失败' });
  }

  const input = buildEcommerceSuitePromptInput(context, references);
  const textResult = await callProviderResponses(input, {
    route: textRoute,
    model: textModel,
    timeoutMs: CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS
  });
  if (!textResult.success) {
    return res.status(502).json({
      success: false,
      code: textResult.code || 'ECOMMERCE_SUITE_PROMPT_FAILED',
      message: textResult.message || '套图提示词生成失败，请稍后重试',
      stage: 'prompt',
      provider: textResult.provider,
      analysisCost,
      estimatedImageCostPerSection
    });
  }

  const promptPlans = parseEcommerceSuitePromptPlans(textResult, context, references.length);
  if (!promptPlans.length) {
    return res.status(502).json({
      success: false,
      code: 'ECOMMERCE_SUITE_PROMPT_EMPTY',
      message: '套图板块生成失败，请补充产品信息后重试',
      stage: 'prompt',
      provider: textResult.provider,
      analysisCost,
      estimatedImageCostPerSection
    });
  }
  const nb = u.balance - analysisCost;
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(nb, u.id);
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)')
    .run(u.id, 'generation', -analysisCost, u.balance, nb, `电商套图提示词: ${textModel} x${promptPlans.length}`);

  res.json({
    success: true,
    mock: !!textResult.mock,
    provider: textResult.provider,
    promptPlans,
    sectionMode: 'dynamic',
    sections: promptPlans.map(plan => ({
      key: plan.sectionKey,
      name: plan.sectionName || plan.title
    })),
    skill: { id: context.skill.id, name: context.skill.name, avatarUrl: context.skill.avatarUrl, description: context.skill.description },
    analysisCost,
    estimatedImageCostPerSection,
    textModel,
    imageModel,
    textRouteId: textRoute?.id || textRoute?.routeId || '',
    imageRouteId: imageRoute?.id || imageRoute?.routeId || '',
    remainingBalance: nb
  });
});

app.post('/api/canvas/ecommerce-suite/generate', auth, async (req, res) => {
  const body = req.body || {};
  const config = ecommerceSuiteAgentConfig();
  if (config.enabled === false) {
    return res.status(403).json({ success: false, code: 'ECOMMERCE_SUITE_DISABLED', message: '电商套图 Agent 暂未启用' });
  }

  const context = ecommerceSuiteContextFromBody(body, config);
  const plans = (Array.isArray(body.promptPlans) ? body.promptPlans
    : Array.isArray(body.plans) ? body.plans
      : Array.isArray(body.selectedPlans) ? body.selectedPlans
        : [])
    .map((plan, index) => normalizeEcommerceSuitePromptPlan(plan, context.sections[index] || {}, {}))
    .filter(plan => plan.prompt)
    .slice(0, 5);
  if (!plans.length) {
    return res.status(400).json({ success: false, code: 'ECOMMERCE_SUITE_PROMPT_PLAN_REQUIRED', message: '请选择至少一个已生成的板块提示词' });
  }

  const buckets = ecommerceSuiteImageBuckets(body);
  if (!buckets.productImages.length) {
    return res.status(400).json({ success: false, code: 'ECOMMERCE_SUITE_PRODUCT_IMAGE_REQUIRED', message: '请先上传产品图' });
  }
  const hasReferenceImages = buckets.all.length > 0;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.userId);
  if (!u) return res.status(401).json({ success: false, code: 'AUTH_USER_NOT_FOUND', message: '登录状态已失效，请重新登录' });

  const imageRoute = resolveImageRoute(body, req.user.userId);
  const imageModel = resolveImageModelKey({ ...body, model: body.imageModel || body.imageModelKey || body.model || imageRoute?.dm || AI_IMAGE_MODEL });
  const imageCost = modelCost(imageModel, 'image') * context.imageCount * plans.length;
  if (u.balance < imageCost) {
    return res.status(400).json({ success: false, code: 'INSUFFICIENT_BALANCE', message: `算力不足，需要 ${imageCost}，当前 ${u.balance}`, imageCost });
  }

  const results = [];
  const providers = [];
  const providerRequests = [];
  const usedPlanPrompts = [];
  for (const plan of plans) {
    const basePrompt = ecommerceSuiteGenerationPrompt(plan, context);
    const prompt = buildEcommerceImagePrompt(basePrompt, {
      body: {
        ...body,
        referenceImages: buckets.all
      },
      hasReferenceImages,
      referenceCount: buckets.all.length
    });
    usedPlanPrompts.push({ plan, prompt });
    const providerOptions = {
      ...body,
      body: {
        ...body,
        referenceImages: buckets.all
      },
      req,
      route: imageRoute,
      model: imageModel,
      modelKey: imageModel,
      n: context.imageCount,
      imageCount: context.imageCount,
      ratio: context.ratio,
      size: context.ratio,
      quality: context.quality,
      clarity: context.quality
    };
    const imageResult = hasReferenceImages
      ? await callProviderImageEdit(prompt, providerOptions)
      : await callProviderImageGeneration(prompt, providerOptions);
    providers.push(imageResult.provider);
    if (imageResult.request) providerRequests.push(imageResult.request);
    if (!imageResult.success) {
      return res.status(502).json({
        success: false,
        code: imageResult.code || 'ECOMMERCE_SUITE_IMAGE_FAILED',
        message: imageResult.message || `${plan.sectionName || '套图板块'} 生图失败，请稍后重试`,
        provider: imageResult.provider,
        sectionKey: plan.sectionKey,
        sectionName: plan.sectionName,
        imageCost
      });
    }
    imageResult.images.forEach((image, index) => {
      results.push({
        ...image,
        providerRequest: imageResult.request,
        sectionKey: plan.sectionKey,
        sectionName: plan.sectionName,
        title: plan.title || plan.sectionName,
        prompt,
        negativePrompt: plan.negativePrompt || '',
        meta: {
          ...(image.meta || {}),
          sectionKey: plan.sectionKey,
          sectionName: plan.sectionName,
          operation: 'canvas-ecommerce-suite-agent'
        },
        id: image.id || `${plan.sectionKey}_${index + 1}`
      });
    });
  }

  const persistedResults = await persistProviderImageResults(results);
  const task = createCompletedTask(req, {
    prompt: plans.map(plan => `${plan.sectionName}: ${plan.prompt}`).join('\n\n'),
    finalPrompt: usedPlanPrompts.map(item => item.prompt).join('\n\n---\n\n'),
    analysisSummary: `已生成 ${plans.length} 个电商套图板块。`,
    modelKey: imageModel,
    imageCount: Math.max(1, results.length),
    results: persistedResults,
    cost: imageCost,
    totalCost: imageCost,
    imageCost,
    request: providerRequests.length === 1 ? providerRequests[0] : providerRequests,
    operation: 'canvas-ecommerce-suite-agent',
    source: 'canvas-ecommerce-suite-agent'
  });
  const nb = u.balance - imageCost;
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(nb, u.id);
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)')
    .run(u.id, 'generation', -imageCost, u.balance, nb, `电商套图生图: ${imageModel} x${results.length}`);

  res.json({
    success: true,
    mock: providers.some(provider => provider && provider.mode === 'mock'),
    provider: providers[providers.length - 1] || null,
    imageModel,
    imageRouteId: imageRoute?.id || imageRoute?.routeId || '',
    images: task.images.map((image, index) => ({
      ...image,
      sectionKey: results[index]?.sectionKey || '',
      sectionName: results[index]?.sectionName || '',
      prompt: results[index]?.prompt || image.prompt || ''
    })),
    resultImages: task.images,
    totalCost: imageCost,
    imageCost,
    request: providerRequests.length === 1 ? providerRequests[0] : providerRequests,
    providerRequest: providerRequests.length === 1 ? providerRequests[0] : providerRequests,
    remainingBalance: nb,
    taskId: task.id,
    id: task.id,
    status: 'success',
    progress: 100
  });
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
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)')
    .run(u.id, 'generation', -totalCost, u.balance, nb, `对话 Agent 生图: ${textModel} + ${imageModel} x${imageCount}`);

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
  const now = Date.now();
  const elapsedMs = Math.max(0, (task.finishedAtMs || now) - task.createdAtMs);
  const warnings = Array.isArray(task.request?.warnings) ? task.request.warnings : [];
  return {
    id: task.id,
    taskId: task.id,
    status: task.status,
    stage: task.stage,
    progress: persistentTaskProgress(task),
    prompt: task.prompt,
    modelKey: task.modelKey,
    model: task.modelKey,
    resultImages: task.images || [],
    images: task.images || [],
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
      retryAfterMs: task.retryAfterMs || 0
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
    retryAfterMs: task.retryAfterMs || 0,
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
  const persistedResults = await persistProviderImageResults(providerResult.images, providerRequestMeta);
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
    req.get?.('Idempotency-Key') || body.clientRequestId || body.idempotencyKey || ''
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
        pending: true
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

app.post('/api/template/generate-image', auth, async (req, res, next) => {
  try {
    const result = await executeTemplateImageGeneration(req.user.userId, req.body, req);
    res.status(result.asyncPending ? 202 : 200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, code: error.code || 'IMAGE_GENERATION_FAILED', message: error.message, provider: error.provider });
    }
    next(error);
  }
});

app.post('/api/template/reverse-prompt', auth, async (req, res) => {
  const base = pickTemplatePrompt(req.body);
  const ratio = req.body.ratio || req.body.aspectRatio || '1:1';
  const platform = req.body.platform ? `，适配${req.body.platform}平台` : '';
  const prompt = `${base}，主体清晰，商业摄影级光影，背景干净，有真实材质细节${platform}`;
  const suggestions = [
    { id: 'mock_reverse_a', title: '高转化主图', label: '高转化主图', prompt, text: prompt, negativePrompt: '模糊，变形，水印，低清晰度，多余文字', ratio, selected: true, styleTags: ['电商', '主图', '高清'] },
    { id: 'mock_reverse_b', title: '场景氛围图', label: '场景氛围图', prompt: `${base}，加入自然使用场景，柔和光线，画面高级，适合详情页展示`, text: `${base}，加入自然使用场景，柔和光线，画面高级，适合详情页展示`, negativePrompt: '杂乱背景，人物畸形，品牌错字，水印', ratio, selected: false, styleTags: ['场景', '氛围'] },
    { id: 'mock_reverse_c', title: '极简白底图', label: '极简白底图', prompt: `${base}，纯白背景，产品居中，边缘锐利，干净阴影，专业棚拍`, text: `${base}，纯白背景，产品居中，边缘锐利，干净阴影，专业棚拍`, negativePrompt: '脏污背景，过曝，模糊，压缩噪点', ratio, selected: false, styleTags: ['白底', '棚拍'] }
  ].map((item, index) => ({
    ...item,
    id: item.id || `mock_reverse_${index + 1}`,
    title: item.title || item.label || `提示词 ${index + 1}`,
    label: item.label || item.title || `提示词 ${index + 1}`,
    prompt: item.prompt || item.text || '',
    text: item.text || item.prompt || '',
    negativePrompt: item.negativePrompt || '',
    negative_prompt: item.negativePrompt || '',
    ratio: item.ratio || ratio,
    styleTags: item.styleTags || [],
    style_tags: item.styleTags || [],
    referenceImageIndex: index,
    reference_image_index: index,
    selected: index === 0
  }));
  res.json({
    success: true,
    mock: true,
    prompt,
    text: prompt,
    rawPrompt: prompt,
    rawText: prompt,
    templateTaskId: uid('reverse_'),
    suggestions,
    prompts: suggestions,
    items: suggestions,
    list: suggestions,
    data: suggestions
  });
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

app.get('/api/chat/status', (_req, res) => {
  const settings = chatSettingsState();
  const accessReady = ENABLE_LIBRECHAT && settings.accessEnabled;
  res.json({
    success: true,
    enabled: ENABLE_LIBRECHAT,
    accessEnabled: settings.accessEnabled,
    accessReady,
    chatPath: '/chat/',
    message: accessReady
      ? 'AI 对话服务可用'
      : (ENABLE_LIBRECHAT ? settings.maintenanceMessage : 'AI 对话服务暂未部署')
  });
});

app.get('/api/chat/home-catalog', auth, (req, res) => {
  const settings = chatSettingsState();
  if (!ENABLE_LIBRECHAT || !settings.accessEnabled) {
    return res.status(503).json({
      success: false,
      code: 'LIBRECHAT_MAINTENANCE',
      message: settings.maintenanceMessage
    });
  }
  const allowed = new Set(settings.allowedModels);
  const agents = settings.managedAgents
    .filter(agent => agent.enabled && allowed.has(agent.model))
    .map(agent => ({
      ...agent,
      imageToolsEnabled: settings.imageToolsEnabled && agent.imageToolsEnabled
    }));
  res.json({
    success: true,
    agents,
    skills: { enabled: true, privateCreate: true, publicSharing: false }
  });
});

app.post('/api/chat/completions', auth, async (req, res) => {
  const { messages } = req.body;
  if (!messages) return res.status(400).json({ message: '缺少 messages' });
  const result = await callProviderChat(messages, req.body);
  if (!result.success) return res.status(502).json(result);
  res.json(result);
});

// ===================== LIBRECHAT INTEGRATION =====================
const hashIntegrationToken = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

app.post('/api/integrations/librechat/sso-ticket', auth, (req, res) => {
  if (!ENABLE_LIBRECHAT) {
    return res.status(404).json({ success: false, code: 'LIBRECHAT_DISABLED', message: 'AI 对话服务暂未启用' });
  }
  const chatSettings = chatSettingsState();
  if (!chatSettings.accessEnabled) {
    return res.status(503).json({ success: false, code: 'LIBRECHAT_MAINTENANCE', message: chatSettings.maintenanceMessage });
  }
  const user = db.prepare("SELECT id,username,email,role,status FROM users WHERE id=? AND status='active'").get(req.user.userId);
  if (!user) {
    return res.status(401).json({ success: false, code: 'AUTH_USER_NOT_FOUND', message: '登录状态已失效，请重新登录' });
  }
  const now = Date.now();
  const ticket = crypto.randomBytes(32).toString('base64url');
  const expiresAt = now + LIBRECHAT_SSO_TTL_SECONDS * 1000;
  db.prepare('DELETE FROM chat_sso_tickets WHERE expires_at<? OR used_at IS NOT NULL').run(now - 60 * 1000);
  db.prepare('INSERT INTO chat_sso_tickets (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)')
    .run(hashIntegrationToken(ticket), user.id, expiresAt, now);
  res.json({ success: true, ticket, expiresAt, chatPath: '/chat/' });
});

const consumeSsoTicket = db.transaction((ticketHash, now) => {
  const row = db.prepare('SELECT * FROM chat_sso_tickets WHERE token_hash=? AND used_at IS NULL AND expires_at>=?').get(ticketHash, now);
  if (!row) return null;
  const consumed = db.prepare('UPDATE chat_sso_tickets SET used_at=? WHERE token_hash=? AND used_at IS NULL').run(now, ticketHash);
  if (consumed.changes !== 1) return null;
  return db.prepare("SELECT id,username,email,role,status FROM users WHERE id=? AND status='active'").get(row.user_id) || null;
});

app.post('/api/integrations/librechat/sso-exchange', integrationServiceAuth, (req, res) => {
  const ticket = String(req.body?.ticket || '').trim();
  if (!ticket) {
    return res.status(400).json({ success: false, code: 'SSO_TICKET_REQUIRED', message: '缺少登录票据' });
  }
  const user = consumeSsoTicket(hashIntegrationToken(ticket), Date.now());
  if (!user) {
    return res.status(401).json({ success: false, code: 'SSO_TICKET_INVALID', message: '登录票据无效、已过期或已使用' });
  }
  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.username,
      email: user.email,
      role: user.role === 'admin' ? 'ADMIN' : 'USER'
    }
  });
});

app.get('/api/integrations/librechat/v1/models', integrationServiceAuth, integrationUser, (req, res) => {
  const chatSettings = chatSettingsState();
  if (!chatSettings.textChatEnabled) {
    return res.status(403).json({ success: false, code: 'LIBRECHAT_TEXT_DISABLED', message: 'Chat 文本对话已由管理员关闭' });
  }
  res.json({
    object: 'list',
    data: allowedChatModels(chatSettings).map(item => ({
      id: item.k,
      object: 'model',
      created: 0,
      owned_by: 'hajimi-ai',
      name: item.n,
      price: item.p
    }))
  });
});

app.post('/api/integrations/librechat/v1/chat/completions', integrationServiceAuth, integrationUser, async (req, res, next) => {
  if (!chatSettingsState().textChatEnabled) {
    return res.status(403).json({ success: false, code: 'LIBRECHAT_TEXT_DISABLED', message: 'Chat 文本对话已由管理员关闭' });
  }
  try {
    await proxyLibreChatCompletion(req, res);
  } catch (error) {
    next(error);
  }
});

function imageQuoteCost(modelKey, imageCount) {
  const model = IMG.find(item => item.k === modelKey) || IMG[0];
  const count = Math.max(1, Math.min(Number(imageCount || 1) || 1, 4));
  return { model, count, total: Number(model?.p || 15) * count };
}

function normalizeChatReferenceImage(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^data:image\//i.test(raw)) return raw;
  if (raw.startsWith('/images/')) return `${LIBRECHAT_INTERNAL_URL}${raw}`;
  if (raw.startsWith('/chat/images/')) return `${LIBRECHAT_INTERNAL_URL}${raw.slice('/chat'.length)}`;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.pathname.startsWith('/chat/images/')) {
        return `${LIBRECHAT_INTERNAL_URL}${url.pathname.slice('/chat'.length)}${url.search}`;
      }
      if (url.pathname.startsWith('/images/')) {
        return `${LIBRECHAT_INTERNAL_URL}${url.pathname}${url.search}`;
      }
    } catch {}
    return raw;
  }
  return '';
}

const CHAT_IMAGE_PLAN_TTL_MS = 30 * 60 * 1000;
const CHAT_IMAGE_PLAN_MARKER = 'HJM_IMAGE_PLAN_FORM';

function normalizeChatImagePlanText(value = '', maxLength = 1000) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeChatImagePlanList(value = [], maxItems = 6) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[|｜、,，\n]/);
  return Array.from(new Set(source.map(item => normalizeChatImagePlanText(item, 120)).filter(Boolean))).slice(0, maxItems);
}

function normalizeChatImagePlanCopy(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    mainTitle: normalizeChatImagePlanText(source.mainTitle, 120),
    subtitle: normalizeChatImagePlanText(source.subtitle, 160),
    sellingPoints: normalizeChatImagePlanList(source.sellingPoints),
    badges: normalizeChatImagePlanList(source.badges),
    footer: normalizeChatImagePlanText(source.footer, 200),
    specification: normalizeChatImagePlanText(source.specification, 120),
    otherText: normalizeChatImagePlanText(source.otherText, 300)
  };
}

function chatImagePlanCopyFields(copy = {}) {
  const normalized = normalizeChatImagePlanCopy(copy);
  return [
    { key: 'mainTitle', label: '主标题', value: normalized.mainTitle },
    { key: 'subtitle', label: '副标题', value: normalized.subtitle },
    { key: 'sellingPoints', label: '核心卖点', value: normalized.sellingPoints.join('｜') },
    { key: 'badges', label: '圆形卖点章', value: normalized.badges.join('｜') },
    { key: 'footer', label: '底部横幅', value: normalized.footer },
    { key: 'specification', label: '规格/容量', value: normalized.specification },
    { key: 'otherText', label: '其他上图文字', value: normalized.otherText }
  ];
}

function normalizeChatReferenceRoles(value = []) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  return source.reduce((items, role) => {
    const rawIndex = Number(role?.imageIndex || role?.index || 0);
    const imageIndex = Number.isInteger(rawIndex) && rawIndex >= 1 && rawIndex <= 4 ? rawIndex : 0;
    const roleDescription = normalizeChatImagePlanText(role?.roleDescription || role?.description || role?.role, 1000);
    if (!imageIndex || !roleDescription || seen.has(imageIndex)) return items;
    seen.add(imageIndex);
    items.push({ imageIndex, roleDescription });
    return items;
  }, []).sort((left, right) => left.imageIndex - right.imageIndex);
}

function normalizeChatCopyItems(value, legacyCopy = {}) {
  const source = Array.isArray(value)
    ? value
    : chatImagePlanCopyFields(legacyCopy).filter(field => field.value).map(field => ({
        id: `legacy-${field.key}`,
        label: field.label,
        text: field.value,
        source: 'GPT 拟定'
      }));
  const seen = new Set();
  return source.reduce((items, item, index) => {
    const fallbackId = `copy-${index + 1}`;
    let id = cleanSettingKey(item?.id || fallbackId, fallbackId).slice(0, 80);
    while (seen.has(id)) id = `${fallbackId}-${items.length + 1}`;
    const label = normalizeChatImagePlanText(item?.label || '上图文案', 80);
    const text = normalizeChatImagePlanText(item?.text ?? item?.value, 500);
    const rawSource = normalizeChatImagePlanText(item?.source, 120);
    const sourceLabel = /^识别自图片\s*[1-4]$/i.test(rawSource) ? rawSource.replace(/图片\s*/i, '图片 ') : 'GPT 拟定';
    if (!label && !text) return items;
    seen.add(id);
    items.push({ id, label: label || '上图文案', text, source: sourceLabel });
    return items;
  }, []).slice(0, 20);
}

function normalizeChatImagePlanV2(plan = {}) {
  const source = plan && typeof plan === 'object' ? plan : {};
  const legacyDesignParts = [source.visualDirection, source.composition, source.background].map(value => normalizeChatImagePlanText(value, 2000)).filter(Boolean);
  const legacyRoles = [
    source.productSummary ? { imageIndex: 1, roleDescription: source.productSummary } : null,
    source.referenceSummary ? { imageIndex: 2, roleDescription: source.referenceSummary } : null
  ].filter(Boolean);
  return {
    ...source,
    version: 2,
    originalRequest: normalizeChatImagePlanText(source.originalRequest, 4000),
    designPrompt: normalizeChatImagePlanText(source.designPrompt || legacyDesignParts.join('\n'), 12000),
    referenceRoles: normalizeChatReferenceRoles(source.referenceRoles?.length ? source.referenceRoles : legacyRoles),
    copyItems: normalizeChatCopyItems(source.copyItems, source.copy),
    adjustment: normalizeChatImagePlanText(source.adjustment || source.copyRevision || source.revisionNotes, 2400),
    revisionNotes: normalizeChatImagePlanText(source.revisionNotes, 2400),
    modelKey: normalizeChatImagePlanText(source.modelKey || IMG[0].k, 160),
    imageRouteId: normalizeChatImagePlanText(source.imageRouteId, 160),
    imageCount: Math.max(1, Math.min(Number(source.imageCount || 1) || 1, 4)),
    negativePrompt: normalizeChatImagePlanText(source.negativePrompt, 4000),
    ratio: normalizeChatImagePlanText(source.ratio || '1:1', 30),
    referenceImages: chatPlanReferenceImages(source).slice(0, 4).map(url => ({ url })),
    previousResultImages: Array.isArray(source.previousResultImages) ? source.previousResultImages.slice(0, 4) : []
  };
}

function chatImagePlanFormMarker(result = {}) {
  const plan = normalizeChatImagePlanV2(result.plan);
  const payload = {
    version: 2,
    confirmationCode: result.confirmationCode,
    designPrompt: plan.designPrompt,
    referenceRoles: plan.referenceRoles,
    copyItems: plan.copyItems,
    adjustment: plan.adjustment
  };
  return `[${CHAT_IMAGE_PLAN_MARKER}:${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}]`;
}

function chatImagePlanUserText(result = {}) {
  const plan = normalizeChatImagePlanV2(result.plan);
  const roleLines = plan.referenceRoles.map(role => `- 图${role.imageIndex}：${role.roleDescription}`);
  const copyLines = plan.copyItems.map(item => `- ${item.label}：${item.text || '（留空）'}（${item.source}）`);
  return [
    '### 电商主图设计方案',
    '',
    plan.designPrompt,
    '',
    '### 图片参考关系',
    '',
    ...(roleLines.length > 0 ? roleLines : ['- 由用户提示词决定；没有预设图1/图2角色']),
    ...(plan.revisionNotes ? [`- 本轮修改：${plan.revisionNotes}`] : []),
    '',
    '### 上图文案',
    '',
    ...copyLines,
    '',
    '请检查下方完整方案和动态文案表。可以直接修改方案、文案名称和内容，也可以添加或删除文案；来源标记只用于识别。确认方案前不会调用生图。',
    '',
    `请点击“确认方案”，或回复：**确认方案 ${result.confirmationCode}**`,
    '',
    chatImagePlanFormMarker(result)
  ].join('\n');
}

function appendConfirmedChatImageConstraints(finalPrompt = '', plan = {}) {
  const normalized = normalizeChatImagePlanV2(plan);
  const roles = normalized.referenceRoles.map(role => `图${role.imageIndex}：${role.roleDescription}`).join('；');
  const exactCopy = normalized.copyItems.filter(item => item.text).map(item => `${item.label}必须逐字显示为“${item.text}”`).join('；');
  return [
    normalizeChatImagePlanText(finalPrompt, 12000),
    roles ? `确定性参考约束：参考图片按上传顺序编号，并严格按以下关系使用：${roles}。` : '',
    exactCopy ? `确定性文字约束：${exactCopy}；不得新增其他上图文字。` : '确定性文字约束：不得擅自新增上图文字。',
    normalized.adjustment ? `用户补充约束：${normalized.adjustment}` : '',
    '输出检查：中文无乱码、无错别字、无水印、无二维码，不得把参考图中的无关商品或文字混入最终画面。'
  ].filter(Boolean).join('\n');
}

function readChatImagePlan(row) {
  if (!row) return null;
  try {
    return { ...row, plan: normalizeChatImagePlanV2(JSON.parse(row.plan_json)) };
  } catch {
    return null;
  }
}

function latestChatImagePlan(context = {}) {
  const conversationId = String(context.conversationId || '').trim();
  const row = conversationId
    ? db.prepare("SELECT * FROM chat_image_plans WHERE user_id=? AND conversation_id=? AND status IN ('draft','confirmed','generated') ORDER BY created_at DESC LIMIT 1")
      .get(context.user.id, conversationId)
    : db.prepare("SELECT * FROM chat_image_plans WHERE user_id=? AND status IN ('draft','confirmed','generated') ORDER BY created_at DESC LIMIT 1")
      .get(context.user.id);
  return readChatImagePlan(row);
}

function createChatImageQuote(context, input = {}, options = {}) {
  if (!context.messageId) throw new Error('缺少当前消息 ID，无法创建安全生图报价');
  const imageRoute = resolveImageRoute({ imageRouteId: input.imageRouteId }, context.user.id);
  if (!imageRoute || routeKind(imageRoute) !== 'image' || imageRoute.enabled === false || imageRoute.status === 'disabled') {
    throw new Error('所选生图线路当前不可用，请重新选择');
  }
  const pricing = imageQuoteCost(input.modelKey, input.imageCount);
  if (Number(context.user.balance || 0) < pricing.total) {
    throw new Error(`算力不足，需要 ${pricing.total}，当前 ${context.user.balance}`);
  }
  const quoteId = uid('imgquote_');
  const confirmationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  const now = Date.now();
  const referenceSource = (options.referenceImages || []).length > 0
    ? options.referenceImages
    : (context.referenceImages || []).length > 0
      ? context.referenceImages
      : input.referenceImages || [];
  const referenceImages = referenceSource
    .map(item => normalizeChatReferenceImage(typeof item === 'string' ? item : item?.url))
    .filter(Boolean)
    .slice(0, 4);
  const requestBody = {
    prompt: normalizeChatImagePlanText(input.prompt, 8000),
    modelKey: pricing.model.k,
    imageRouteId: routeIdOf(imageRoute),
    imageRouteKey: routeKeyOf(imageRoute),
    imageRouteName: routeDisplayName(imageRoute),
    imageCount: pricing.count,
    negativePrompt: normalizeChatImagePlanText(input.negativePrompt, 4000),
    ratio: normalizeChatImagePlanText(input.ratio, 30) || '1:1',
    referenceImages: referenceImages.map(url => ({ url })),
    ...(options.planId ? { planId: options.planId } : {})
  };
  db.prepare('INSERT INTO chat_image_quotes (id,user_id,request_json,confirmation_hash,origin_message_id,cost,status,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(quoteId, context.user.id, JSON.stringify(requestBody), hashIntegrationToken(confirmationCode), context.messageId, pricing.total, 'pending', now + 5 * 60 * 1000, now);
  return {
    quoteId,
    confirmationCode,
    modelKey: pricing.model.k,
    modelName: pricing.model.n,
    imageRouteId: routeIdOf(imageRoute),
    imageRouteName: routeDisplayName(imageRoute),
    imageCount: pricing.count,
    mode: referenceImages.length > 0 ? 'image-to-image' : 'text-to-image',
    referenceImageCount: referenceImages.length,
    totalCost: pricing.total,
    currentBalance: Number(context.user.balance || 0),
    expiresAt: new Date(now + 5 * 60 * 1000).toISOString(),
    requestBody
  };
}

function chatImageQuoteUserText(result) {
  const modeLabel = result.referenceImageCount > 0 ? '参考图生成' : '文字生成';
  return [
    '### 生图报价已准备',
    '',
    `- 生成方式：${modeLabel}`,
    `- 使用模型：${result.modelName}`,
    `- 生图线路：${result.imageRouteName}`,
    `- 生成数量：${result.imageCount} 张`,
    `- 参考图片：${result.referenceImageCount} 张`,
    `- 预计消耗：${result.totalCost} 算力`,
    `- 当前余额：${result.currentBalance} 算力`,
    '',
    `请在下一条消息回复：**确认生图 ${result.confirmationCode}**`,
    '',
    '报价 5 分钟内有效，确认前不会执行生图。'
  ].join('\n');
}

function chatImageResultUserText(result) {
  const imageLines = (result.images || [])
    .map((image, index) => String(image?.url || '').trim() ? `![生成图片 ${index + 1}](${String(image.url).trim()})` : '')
    .filter(Boolean);
  return [
    '### 图片生成完成',
    '',
    ...(result.imageRouteName ? [`- 生图线路：${result.imageRouteName}`] : []),
    `- 生成数量：${imageLines.length} 张`,
    `- 消耗算力：${result.totalCost}`,
    `- 剩余余额：${result.remainingBalance} 算力`,
    ...(imageLines.length > 0 ? ['', ...imageLines] : []),
    '',
    '是否需要修改这张图片？可在下方填写修改要求后重新生成方案，也可以保持当前方案再出一版。原产品图和参考图会继续保留。'
  ].join('\n');
}

function createWebsiteMcpServer(context) {
  const server = new McpServer({ name: 'hajimi-website-tools', version: '1.0.0' });
  server.registerTool(
    'prepare_ecommerce_image_plan',
    {
      title: '准备电商主图方案',
      description: '仅供 ecommerce-main-image 智能体使用。根据用户文字和实际看到的参考图片生成完整、非模板化的设计方案、图片角色和动态上图文案表。此工具不会报价或生图。',
      inputSchema: {
        originalRequest: z.string().min(1).max(4000),
        designPrompt: z.string().min(40).max(12000),
        referenceRoles: z.array(z.object({
          imageIndex: z.number().int().min(1).max(4),
          roleDescription: z.string().min(1).max(1000)
        })).max(4),
        copyItems: z.array(z.object({
          id: z.string().max(80).optional(),
          label: z.string().min(1).max(80),
          text: z.string().max(500),
          source: z.string().max(120)
        })).max(20),
        revisionNotes: z.string().max(2400).optional(),
        modelKey: z.string().optional(),
        imageRouteId: z.string().max(160).optional(),
        imageCount: z.number().int().min(1).max(4).optional(),
        negativePrompt: z.string().max(4000).optional(),
        ratio: z.string().max(30).optional(),
        referenceImages: z.array(z.string().min(1).max(4096)).max(4).optional()
      }
    },
    async (input) => {
      if (context.agentId !== ECOMMERCE_MAIN_IMAGE_AGENT_ID) throw new Error('该方案工具只允许“电商主图设计师”使用，请重新选择智能体');
      if (!context.messageId) throw new Error('缺少当前消息 ID，无法保存主图方案');
      const previous = latestChatImagePlan(context);
      const base = normalizeChatImagePlanV2(previous?.plan || {});
      const currentReferences = (context.referenceImages || []).map(normalizeChatReferenceImage).filter(Boolean);
      const inputReferences = (input.referenceImages || []).map(normalizeChatReferenceImage).filter(Boolean);
      const previousReferences = chatPlanReferenceImages(base).map(normalizeChatReferenceImage).filter(Boolean);
      if (currentReferences.length > 4 || inputReferences.length > 4) {
        throw new Error('电商主图设计师一次最多使用 4 张参考图片，请删除多余图片后重试');
      }
      const referenceImages = (currentReferences.length > 0 ? currentReferences : inputReferences.length > 0 ? inputReferences : previousReferences).slice(0, 4);
      if (referenceImages.length === 0) throw new Error('请至少上传一张商品或参考图片，并在提示词中说明它的用途');
      const referenceRoles = normalizeChatReferenceRoles(input.referenceRoles?.length ? input.referenceRoles : base.referenceRoles);
      if (referenceRoles.length === 0 || referenceRoles.some(role => role.imageIndex > referenceImages.length)) {
        throw new Error('方案中的图片角色与实际上传图片不匹配，请让 GPT‑5.6 重新分析图片');
      }
      const plan = normalizeChatImagePlanV2({
        ...base,
        originalRequest: input.originalRequest || base.originalRequest,
        designPrompt: input.designPrompt,
        referenceRoles,
        copyItems: input.copyItems,
        adjustment: '',
        revisionNotes: input.revisionNotes || '',
        modelKey: input.modelKey || base.modelKey || IMG[0].k,
        imageRouteId: input.imageRouteId || base.imageRouteId || '',
        imageCount: input.imageCount || base.imageCount || 1,
        negativePrompt: input.negativePrompt || base.negativePrompt || '',
        ratio: input.ratio || base.ratio || '1:1',
        referenceImages: referenceImages.map(url => ({ url })),
        previousResultImages: base.previousResultImages || []
      });
      const planId = uid('imgplan_');
      const confirmationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      const now = Date.now();
      if (previous?.id && previous.status === 'draft') {
        db.prepare("UPDATE chat_image_plans SET status='superseded',updated_at=? WHERE id=? AND user_id=?")
          .run(now, previous.id, context.user.id);
      }
      db.prepare('INSERT INTO chat_image_plans (id,user_id,conversation_id,plan_json,confirmation_hash,origin_message_id,status,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(planId, context.user.id, context.conversationId || '', JSON.stringify(plan), hashIntegrationToken(confirmationCode), context.messageId, 'draft', now + CHAT_IMAGE_PLAN_TTL_MS, now, now);
      const result = {
        planId,
        confirmationCode,
        status: 'draft',
        referenceImageCount: referenceImages.length,
        plan,
        expiresAt: new Date(now + CHAT_IMAGE_PLAN_TTL_MS).toISOString(),
        instruction: `请让用户检查方案表单。用户确认前不得调用 prepare_image_generation 或 execute_image_generation。`
      };
      return { content: [{ type: 'text', text: chatImagePlanUserText(result) }], structuredContent: result };
    }
  );

  server.registerTool(
    'confirm_ecommerce_image_plan',
    {
      title: '确认电商主图方案',
      description: '仅供 ecommerce-main-image 智能体使用。根据用户编辑后的完整方案与动态文案重新创作 finalPrompt，然后创建报价；此步骤不会调用图片 Provider。',
      inputSchema: {
        confirmationCode: z.string().min(6).max(32),
        designPrompt: z.string().min(40).max(12000),
        copyItems: z.array(z.object({
          id: z.string().max(80).optional(),
          label: z.string().min(1).max(80),
          text: z.string().max(500),
          source: z.string().max(120).optional()
        })).max(20),
        adjustment: z.string().max(2400).optional(),
        finalPrompt: z.string().min(40).max(12000)
      }
    },
    async ({ confirmationCode, designPrompt, copyItems = [], adjustment = '', finalPrompt }) => {
      if (context.agentId !== ECOMMERCE_MAIN_IMAGE_AGENT_ID) throw new Error('该确认工具只允许“电商主图设计师”使用，请重新选择智能体');
      if (!context.messageId) throw new Error('缺少当前消息 ID，无法确认主图方案');
      const normalizedCode = String(confirmationCode).toUpperCase();
      const confirmationHash = hashIntegrationToken(normalizedCode);
      const conversationId = String(context.conversationId || '').trim();
      const row = conversationId
        ? db.prepare("SELECT * FROM chat_image_plans WHERE user_id=? AND conversation_id=? AND confirmation_hash=? AND status='draft' ORDER BY created_at DESC LIMIT 1")
          .get(context.user.id, conversationId, confirmationHash)
        : db.prepare("SELECT * FROM chat_image_plans WHERE user_id=? AND confirmation_hash=? AND status='draft' ORDER BY created_at DESC LIMIT 1")
          .get(context.user.id, confirmationHash);
      const record = readChatImagePlan(row);
      if (!record) throw new Error('主图方案不存在、已确认或已被新方案替代');
      if (record.expires_at < Date.now()) throw new Error('主图方案已过期，请重新生成方案');
      if (record.origin_message_id === context.messageId) throw new Error('必须等待用户确认方案后再生成提示词');
      if (!timingSafeEqualText(record.confirmation_hash, confirmationHash)) throw new Error('方案确认码不正确');
      const savedPlan = normalizeChatImagePlanV2(record.plan);
      const savedSources = new Map(savedPlan.copyItems.map(item => [item.id, item.source]));
      const plan = normalizeChatImagePlanV2({
        ...savedPlan,
        designPrompt,
        copyItems: copyItems.map(item => ({ ...item, source: savedSources.get(cleanSettingKey(item.id || '', '')) || 'GPT 拟定' })),
        adjustment
      });
      const constrainedFinalPrompt = appendConfirmedChatImageConstraints(finalPrompt, plan);
      const quote = createChatImageQuote(context, {
        prompt: constrainedFinalPrompt,
        modelKey: plan.modelKey,
        imageRouteId: plan.imageRouteId,
        imageCount: plan.imageCount,
        negativePrompt: plan.negativePrompt,
        ratio: plan.ratio
      }, {
        planId: record.id,
        referenceImages: plan.referenceImages
      });
      plan.finalPrompt = constrainedFinalPrompt;
      plan.quoteId = quote.quoteId;
      const now = Date.now();
      const updated = db.prepare("UPDATE chat_image_plans SET plan_json=?,status='confirmed',confirmed_at=?,updated_at=? WHERE id=? AND user_id=? AND status='draft'")
        .run(JSON.stringify(plan), now, now, record.id, context.user.id);
      if (updated.changes !== 1) {
        db.prepare('DELETE FROM chat_image_quotes WHERE id=? AND user_id=?').run(quote.quoteId, context.user.id);
        throw new Error('主图方案正在处理或已经确认');
      }
      const previewLines = plan.copyItems.filter(item => item.text).map(item => `- ${item.label}：${item.text}（${item.source}）`);
      const contentText = [
        '### 方案已确认，最终提示词已生成',
        '',
        ...previewLines,
        ...(plan.adjustment ? ['', `- 补充修改：${plan.adjustment}`] : []),
        '',
        chatImageQuoteUserText(quote)
      ].join('\n');
      return {
        content: [{ type: 'text', text: contentText }],
        structuredContent: { ...quote, planId: record.id, finalPrompt: constrainedFinalPrompt, designPrompt: plan.designPrompt, copyItems: plan.copyItems }
      };
    }
  );

  server.registerTool(
    'prepare_image_generation',
    {
      title: '准备网站生图',
      description: '检查网站图片模型、张数、当前消息附件和余额并创建一次性报价。当前消息附图会自动作为图生图参考，无需把图片内容写进参数。必须先调用此工具并等待用户在下一条消息明确确认。',
      inputSchema: {
        prompt: z.string().min(1).max(8000),
        modelKey: z.string().default(IMG[0].k),
        imageRouteId: z.string().max(160).optional(),
        imageCount: z.number().int().min(1).max(4).default(1),
        negativePrompt: z.string().max(4000).optional(),
        ratio: z.string().max(30).optional(),
        referenceImages: z.array(z.string().min(1).max(4096)).max(4).optional()
      }
    },
    async (input) => {
      const result = createChatImageQuote(context, input);
      result.instruction = `工具结果已经提供面向普通用户的中文报价。请简洁确认，并要求用户在下一条消息明确回复“确认生图 ${result.confirmationCode}”。不要展示 quoteId、modelKey、MCP 名称、工具参数或原始 JSON，也不要在当前轮次执行生图。`;
      return { content: [{ type: 'text', text: chatImageQuoteUserText(result) }], structuredContent: result };
    }
  );

  server.registerTool(
    'execute_image_generation',
    {
      title: '执行网站生图',
      description: '执行已经报价且由用户在后续消息中明确确认的网站生图请求。报价只能使用一次。',
      inputSchema: {
        quoteId: z.string().min(1).optional(),
        confirmationCode: z.string().min(6).max(32)
      }
    },
    async ({ quoteId = '', confirmationCode }) => {
      if (!context.messageId) throw new Error('缺少当前消息 ID，无法确认生图');
      const normalizedCode = String(confirmationCode).toUpperCase();
      const confirmationHash = hashIntegrationToken(normalizedCode);
      const quote = quoteId
        ? db.prepare('SELECT * FROM chat_image_quotes WHERE id=? AND user_id=?').get(quoteId, context.user.id)
        : db.prepare("SELECT * FROM chat_image_quotes WHERE user_id=? AND confirmation_hash=? AND status='pending' ORDER BY created_at DESC LIMIT 1")
          .get(context.user.id, confirmationHash);
      if (!quote || quote.status !== 'pending') throw new Error('生图报价不存在或已经使用');
      if (quote.expires_at < Date.now()) throw new Error('生图报价已过期，请重新报价');
      if (quote.origin_message_id === context.messageId) throw new Error('必须等待用户在下一条消息中明确确认后才能生图');
      if (!timingSafeEqualText(quote.confirmation_hash, confirmationHash)) {
        throw new Error('生图确认码不正确');
      }
      const claimed = db.prepare("UPDATE chat_image_quotes SET status='processing', used_at=? WHERE id=? AND user_id=? AND status='pending'")
        .run(Date.now(), quote.id, context.user.id);
      if (claimed.changes !== 1) throw new Error('生图报价正在处理或已经使用');
      try {
        const quoteRequest = JSON.parse(quote.request_json);
        const result = await executeTemplateImageGeneration(context.user.id, quoteRequest, context.request);
        db.prepare("UPDATE chat_image_quotes SET status='completed', used_at=? WHERE id=?").run(Date.now(), quote.id);
        const output = {
          quoteId: quote.id,
          taskId: result.taskId,
          images: result.images,
          totalCost: result.totalCost,
          remainingBalance: result.remainingBalance,
          prompt: result.prompt,
          modelKey: result.modelKey,
          imageRouteId: quoteRequest.imageRouteId || '',
          imageRouteName: quoteRequest.imageRouteName || routeDisplayName(resolveImageRoute(quoteRequest, context.user.id)),
          editMode: !!result.editMode,
          referenceImageCount: quoteRequest.referenceImages?.length || 0
        };
        if (quoteRequest.planId) {
          const planRow = db.prepare('SELECT plan_json FROM chat_image_plans WHERE id=? AND user_id=?').get(quoteRequest.planId, context.user.id);
          if (planRow?.plan_json) {
            try {
              const plan = JSON.parse(planRow.plan_json);
              plan.lastGeneratedImages = result.images || [];
              plan.lastGeneratedAt = new Date().toISOString();
              db.prepare("UPDATE chat_image_plans SET plan_json=?,status='generated',updated_at=? WHERE id=? AND user_id=?")
                .run(JSON.stringify(plan), Date.now(), quoteRequest.planId, context.user.id);
            } catch {}
          }
        }
        return { content: [{ type: 'text', text: chatImageResultUserText(output) }], structuredContent: output };
      } catch (error) {
        db.prepare("UPDATE chat_image_quotes SET status='failed', used_at=? WHERE id=?").run(Date.now(), quote.id);
        throw error;
      }
    }
  );
  return server;
}

app.all('/api/integrations/librechat/mcp', integrationServiceAuth, integrationUser, async (req, res) => {
  if (!chatSettingsState().imageToolsEnabled) {
    return res.status(403).json({ jsonrpc: '2.0', error: { code: -32003, message: 'Chat 生图工具已由管理员关闭' }, id: req.body?.id ?? null });
  }
  const server = createWebsiteMcpServer({
    user: req.integrationUser,
    messageId: req.integrationMessageId,
    conversationId: req.integrationConversationId,
    agentId: req.integrationAgentId,
    referenceImages: req.integrationReferenceImages,
    request: req
  });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[LIBRECHAT_MCP_ERROR]', error);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: error.message || 'MCP 请求失败' }, id: null });
    }
  }
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
app.post('/api/workflows/:id/save-json', auth, (req, res) => {
  const id = String(req.params.id || req.body.id || uid('workflow_'));
  const data = workflowDataFromBody(req.body);
  const name = workflowNameFromBody(req.body, data);
  const localFile = saveWorkflowProject(req.user.userId, id, name, data);
  res.json({ success: true, id, workflowId: id, savedAt: new Date().toISOString(), localFile });
});

app.post('/api/workflows/:id/save-local-json', auth, (req, res) => {
  const id = String(req.params.id || req.body.id || uid('workflow_'));
  const data = workflowDataFromBody(req.body);
  const name = workflowNameFromBody(req.body, data);
  const localFile = saveWorkflowProject(req.user.userId, id, name, data);
  res.json({ success: true, id, workflowId: id, savedAt: new Date().toISOString(), localFile });
});

app.get('/api/workflows/:id/local-json', auth, (req, res) => {
  const filePath = path.join(
    WORKFLOW_DIR,
    safeWorkflowPathPart(req.user.userId),
    `${safeWorkflowPathPart(req.params.id)}.workflow.json`
  );
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: '本地工作流 JSON 不存在' });
  res.sendFile(filePath);
});

// ===================== ADMIN =====================
function pageList(items, req) {
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(Number(req.query.pageSize || req.query.limit || 20) || 20, 100));
  const total = items.length;
  const start = (page - 1) * pageSize;
  const list = items.slice(start, start + pageSize);
  return { items: list, list, data: list, total, page, pageSize };
}
function adminUserRow(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    balance: u.balance,
    credits: u.balance,
    status: u.status,
    avatarUrl: u.avatar_url || '',
    createdAt: u.created_at,
    created_at: u.created_at,
    lastLoginAt: u.last_login_at
  };
}
function balanceLogRow(row) {
  return {
    ...row,
    changeAmount: row.change_amount,
    beforeBalance: row.before_balance,
    afterBalance: row.after_balance,
    createdAt: row.created_at
  };
}
function generationRows(limit = 100) {
  return db.prepare('SELECT * FROM generations ORDER BY created_at DESC LIMIT ?').all(limit).map(row => {
    const status = row.status === 'completed' ? 'success' : (row.status || 'success');
    const finished = ['success', 'failed', 'error', 'cancelled'].includes(status);
    const cost = Number(row.cost || 0);
    return {
      id: row.id,
      taskId: row.id,
      sourceTaskId: row.task_id || '',
      userId: row.user_id,
      username: db.prepare('SELECT username FROM users WHERE id=?').get(row.user_id)?.username || 'local',
      model: row.model_key,
      modelKey: row.model_key,
      modelDisplayName: row.model_key,
      resolvedModel: row.model_key,
      prompt: row.prompt,
      promptPreview: String(row.prompt || '').slice(0, 120),
      promptLength: String(row.prompt || '').length,
      resultUrl: row.result_url,
      imageUrl: row.result_url,
      status,
      progress: finished ? 100 : 0,
      cost,
      costPoints: cost,
      chargeStatus: cost > 0 ? '已记录扣费' : '无扣费记录',
      imageCount: row.result_url ? 1 : 0,
      createdAt: row.created_at,
      updatedAt: row.created_at,
      finishedAt: finished ? row.created_at : undefined
    };
  });
}
function modelPriceRows() {
  const overrides = modelPriceState();
  const overrideMap = new Map(overrides.map(row => [row.id, row]));
  const baseRows = filteredRoutes('', { includeModelOverrides: false, includeDisabledModels: true }).flatMap(route => route.models.flatMap(model => {
    const id = `${route.id}:${model.modelKey}`;
    const override = overrideMap.get(id) || {};
    if (override.deleted) return [];
    return [normalizeRouteModel({
      ...override,
      id,
      routeId: route.id,
      routeKey: route.routeKey,
      routeName: route.displayName
    }, route, model)];
  }));
  const baseIds = new Set(baseRows.map(row => row.id));
  const routes = filteredRoutes('', { includeModelOverrides: false, includeDisabledModels: true });
  const extraRows = overrides
    .filter(row => !baseIds.has(row.id))
    .filter(row => !row.deleted)
    .map(row => {
      const route = routes.find(item => routeMatchesModelRow(row, item)) || routes[0] || routePayload(RTS[0], { includeModelOverrides: false, includeDisabledModels: true });
      return normalizeRouteModel(row, route);
    });
  return [
    ...baseRows,
    ...extraRows
  ];
}

app.get('/api/admin/users', auth, admin, (req, res) => {
  const q = String(req.query.keyword || req.query.q || '').trim().toLowerCase();
  let users = db.prepare("SELECT * FROM users WHERE status NOT IN ('deleted','purged') ORDER BY created_at DESC").all().map(adminUserRow);
  if (q) users = users.filter(u => [u.username, u.email, u.role, u.status].some(v => String(v || '').toLowerCase().includes(q)));
  const payload = pageList(users, req);
  res.json({ ...payload, users: payload.items, success: true });
});
app.get('/api/admin/dashboard', auth, admin, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const todayNewUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE date(created_at,'localtime')=date('now','localtime')").get().c;
  const totalGenerations = db.prepare('SELECT COUNT(*) as c FROM generations').get().c;
  const todayGenerations = db.prepare("SELECT COUNT(*) as c FROM generations WHERE date(created_at,'localtime')=date('now','localtime')").get().c;
  const apiFailures = db.prepare("SELECT COUNT(*) as c FROM generations WHERE status IN ('failed','error')").get().c;
  const totalCredits = db.prepare('SELECT COALESCE(SUM(balance),0) as s FROM users').get().s;
  const totalCost = db.prepare('SELECT COALESCE(SUM(cost),0) as s FROM generations').get().s;
  const modelUsageList = db.prepare(`
    SELECT model_key as modelKey, COUNT(*) as usageCount, COALESCE(SUM(cost),0) as totalCredits
    FROM generations GROUP BY model_key ORDER BY totalCredits DESC
  `).all().map(row => {
    const usageCount = Number(row.usageCount || 0);
    const totalCreditsForModel = Number(row.totalCredits || 0);
    const percent = totalCost > 0 ? Math.round(totalCreditsForModel / totalCost * 100) : 0;
    return {
      ...row,
      usageCount,
      totalCredits: totalCreditsForModel,
      model: row.modelKey,
      modelName: row.modelKey || 'mock',
      totalCount: usageCount,
      points: totalCreditsForModel,
      percent
    };
  });
  const rankingList = db.prepare(`
    SELECT u.id as userId, u.username, u.email, COUNT(g.id) as usageCount, COALESCE(SUM(g.cost),0) as totalCredits,
      MAX(g.created_at) as lastUsedAt
    FROM users u LEFT JOIN generations g ON g.user_id=u.id
    GROUP BY u.id ORDER BY totalCredits DESC LIMIT 10
  `).all().map((row, index) => ({
    ...row,
    rank: index + 1,
    consumedPoints: row.totalCredits,
    points: row.totalCredits,
    count: row.usageCount,
    lastUseAt: row.lastUsedAt
  }));
  const stats = {
    totalUsers,
    todayNewUsers,
    todayOrderAmount: 0,
    totalGenerations,
    todayGenerations,
    totalCredits,
    totalConsumedPoints: totalCost,
    totalCost,
    apiFailures,
    activeUsers: db.prepare("SELECT COUNT(*) as c FROM users WHERE status='active'").get().c,
    routeCount: routeState().length,
    modelCount: modelPriceRows().length
  };
  const dashboardStats = {
    ...stats,
    userTotal: totalUsers,
    usersTotal: totalUsers,
    totalUserCount: totalUsers,
    todayUserCount: todayNewUsers,
    generationTotal: totalGenerations,
    consumedPoints: totalCost,
    consumedCredits: totalCost
  };
  res.json({
    success: true,
    summary: dashboardStats,
    stats: dashboardStats,
    cards: dashboardStats,
    dataQuality: {
      ordersAvailable: false,
      routeUsageAvailable: false,
      message: '支付订单与历史生成线路尚未写入可统计的数据表，相关区域不展示推算值。'
    },
    recentTasks: generationRows(8),
    routes: filteredRoutes(),
    modelPrices: modelPriceRows().slice(0, 12),
    modelUsage: {
      totalCredits: totalCost,
      totalCount: totalGenerations,
      list: modelUsageList
    },
    routeUsage: {
      available: false,
      reason: 'generation_route_not_recorded',
      totalCredits: totalCost,
      totalCount: totalGenerations,
      list: []
    },
    ranking: {
      range: req.query.range || 'today',
      list: rankingList
    }
  });
});
app.get('/api/admin/dashboard/user-credit-ranking', auth, admin, (req, res) => {
  const rows = db.prepare(`
    SELECT u.*, COUNT(g.id) as usageCount, COALESCE(SUM(g.cost),0) as consumedPoints, MAX(g.created_at) as lastUsedAt
    FROM users u LEFT JOIN generations g ON g.user_id=u.id
    GROUP BY u.id ORDER BY consumedPoints DESC, balance DESC LIMIT 20
  `).all().map((row, index) => ({
    ...adminUserRow(row),
    rank: index + 1,
    consumedPoints: row.consumedPoints || 0,
    totalCredits: row.consumedPoints || 0,
    usageCount: row.usageCount || 0,
    count: row.usageCount || 0,
    lastUseAt: row.lastUsedAt || row.last_login_at || row.created_at
  }));
  res.json({ success: true, items: rows, data: rows, users: rows, list: rows, ranking: { list: rows } });
});
app.patch('/api/admin/users/:id/status', auth, admin, (req, res) => {
  const status = req.body.status || 'active';
  if (!['active', 'disabled', 'banned'].includes(status)) {
    return res.status(400).json({ success: false, code: 'INVALID_USER_STATUS', message: '用户状态无效' });
  }
  if (String(req.user.userId) === String(req.params.id) && status !== 'active') {
    return res.status(409).json({ success: false, code: 'ADMIN_SELF_LOCK_BLOCKED', message: '不能停用或封禁当前管理员账号' });
  }
  const r = db.prepare('UPDATE users SET status=? WHERE id=?').run(status, req.params.id);
  if (!r.changes) return res.status(404).json({ message: '用户不存在' });
  res.json({ success: true, user: adminUserRow(db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id)) });
});
app.post('/api/admin/users/:id/balance', auth, admin, (req, res) => {
  const amount = Number(req.body.amount ?? req.body.changeAmount ?? 0);
  if (!Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ success: false, code: 'INVALID_BALANCE_AMOUNT', message: '余额调整值必须是非零数字' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  const next = user.balance + amount;
  if (next < 0) {
    return res.status(409).json({ success: false, code: 'INSUFFICIENT_BALANCE', message: '调整后余额不能小于 0' });
  }
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(next, user.id);
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)')
    .run(user.id, 'admin_adjust', amount, user.balance, next, req.body.remark || '管理员调整余额');
  res.json({ success: true, user: adminUserRow(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
});
app.post('/api/admin/users/:id/security-check', auth, admin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  const duplicateUsername = db.prepare('SELECT COUNT(*) AS count FROM users WHERE lower(username)=lower(?) AND id<>?').get(user.username, user.id).count;
  const duplicateEmail = user.email
    ? db.prepare('SELECT COUNT(*) AS count FROM users WHERE lower(email)=lower(?) AND id<>?').get(user.email, user.id).count
    : 0;
  const latestBalanceLog = db.prepare('SELECT after_balance FROM balance_logs WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 1').get(user.id);
  const checks = [];
  const issues = [];
  if (['active', 'disabled', 'banned'].includes(user.status)) checks.push(`账号状态：${user.status}`);
  else issues.push(`账号状态异常：${user.status || 'unknown'}`);
  if (Number.isFinite(Number(user.balance)) && Number(user.balance) >= 0) checks.push(`余额有效：${Number(user.balance)}`);
  else issues.push('余额不是有效的非负数');
  if (!duplicateUsername && !duplicateEmail) checks.push('用户名和邮箱未发现重复');
  else issues.push(`身份字段重复：用户名 ${duplicateUsername}，邮箱 ${duplicateEmail}`);
  if (!latestBalanceLog || Math.abs(Number(latestBalanceLog.after_balance) - Number(user.balance)) < 0.001) checks.push('最新余额日志与当前余额一致');
  else issues.push('最新余额日志与当前余额不一致');
  const riskLevel = issues.some(item => item.includes('余额不是') || item.includes('身份字段重复'))
    ? 'high'
    : (issues.length ? 'medium' : 'low');
  res.json({ success: true, riskLevel, checks: [...issues, ...checks], issues });
});
app.post('/api/admin/users/:id/reset-password', auth, admin, (req, res) => {
  const password = req.body.password || req.body.newPassword || '';
  if (IS_PRODUCTION && !password) {
    return res.status(400).json({
      success: false,
      code: 'PASSWORD_REQUIRED',
      message: '生产模式重置密码必须显式提供新密码'
    });
  }
  if (password && String(password).length < 6) {
    return res.status(400).json({ success: false, code: 'PASSWORD_TOO_SHORT', message: '新密码至少需要 6 位' });
  }
  const nextPassword = password || 'admin123';
  const r = db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(h(nextPassword), req.params.id);
  if (!r.changes) return res.status(404).json({ message: '用户不存在' });
  res.json({ success: true, message: '密码已重置' });
});
app.delete('/api/admin/users/:id', auth, admin, (req, res) => {
  if (String(req.user.userId) === String(req.params.id)) {
    return res.status(409).json({ success: false, code: 'ADMIN_SELF_DELETE_BLOCKED', message: '不能删除当前管理员账号' });
  }
  const r = db.prepare("UPDATE users SET status='deleted' WHERE id=?").run(req.params.id);
  if (!r.changes) return res.status(404).json({ message: '用户不存在' });
  res.json({ success: true });
});
app.get('/api/admin/recycle-bin/users', auth, admin, (req, res) => {
  const rows = db.prepare("SELECT * FROM users WHERE status='deleted' ORDER BY created_at DESC").all().map(adminUserRow);
  res.json({ ...pageList(rows, req), users: rows, success: true });
});
app.post('/api/admin/recycle-bin/users/:id/restore', auth, admin, (req, res) => {
  const r = db.prepare("UPDATE users SET status='active' WHERE id=? AND status='deleted'").run(req.params.id);
  if (!r.changes) return res.status(404).json({ success: false, message: '回收站中不存在该用户' });
  res.json({ success: true });
});
app.delete('/api/admin/recycle-bin/users/:id/permanent', auth, admin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  if (user.status !== 'deleted') {
    return res.status(409).json({ success: false, code: 'USER_NOT_IN_RECYCLE_BIN', message: '只能永久清理回收站中的用户' });
  }
  db.prepare("UPDATE users SET username=?, email=?, status='purged', avatar_url='' WHERE id=?")
    .run(`deleted_${Date.now()}`, `deleted_${Date.now()}@local`, req.params.id);
  res.json({ success: true });
});
app.get('/api/admin/orders', auth, admin, (req, res) => {
  const payload = pageList([], req);
  res.json({
    ...payload,
    orders: payload.items,
    success: true,
    available: false,
    code: ENABLE_REAL_PAYMENT ? 'ORDER_STORAGE_UNAVAILABLE' : 'PAYMENT_DISABLED',
    message: ENABLE_REAL_PAYMENT ? '真实订单数据表尚未接入' : '支付功能未启用，当前没有真实订单数据'
  });
});
app.patch('/api/admin/orders/:id/status', auth, admin, (req, res) => {
  const code = ENABLE_REAL_PAYMENT ? 'ORDER_STORAGE_UNAVAILABLE' : 'PAYMENT_DISABLED';
  const message = ENABLE_REAL_PAYMENT ? '真实订单数据表尚未接入，不能修改订单状态' : '支付功能未启用，不能修改订单状态';
  res.status(409).json({ success: false, code, message });
});
app.get('/api/admin/usage-logs', auth, admin, (req, res) => {
  const rows = db.prepare('SELECT * FROM balance_logs ORDER BY created_at DESC LIMIT 200').all().map(balanceLogRow);
  res.json({ ...pageList(rows, req), logs: rows, success: true });
});
app.get('/api/admin/redeem-codes', auth, admin, (req, res) => {
  const rows = db.prepare('SELECT * FROM redeem_codes ORDER BY code ASC').all().map(r => ({
    ...r,
    enabled: !!r.enabled,
    amount: r.amount,
    points: r.amount,
    maxUses: r.max_uses,
    totalCount: r.max_uses,
    perUserLimit: 1,
    usedCount: r.used_count,
    remainingCount: Math.max(0, Number(r.max_uses || 0) - Number(r.used_count || 0)),
    status: r.enabled ? 'active' : 'disabled',
    expiresAt: ''
  }));
  res.json({ ...pageList(rows, req), codes: rows, success: true });
});
app.post('/api/admin/redeem-codes', auth, admin, (req, res) => {
  const code = String(req.body.code || `CODE${Math.random().toString(36).slice(2, 8)}`).toUpperCase();
  const amount = Number(req.body.amount ?? req.body.points ?? 50);
  const maxUses = Number(req.body.maxUses ?? req.body.max_uses ?? req.body.totalCount ?? 1);
  const enabled = req.body.enabled !== false && req.body.status !== 'disabled';
  db.prepare('INSERT OR REPLACE INTO redeem_codes (code,amount,max_uses,used_count,enabled) VALUES (?,?,?,?,?)')
    .run(code, amount, maxUses, 0, enabled ? 1 : 0);
  res.json({
    success: true,
    code,
    amount,
    points: amount,
    maxUses,
    totalCount: maxUses,
    perUserLimit: Number(req.body.perUserLimit ?? 1),
    usedCount: 0,
    remainingCount: maxUses,
    status: enabled ? 'active' : 'disabled',
    expiresAt: req.body.expiresAt || ''
  });
});
app.delete('/api/admin/redeem-codes/:code', auth, admin, (req, res) => {
  db.prepare('DELETE FROM redeem_codes WHERE code=?').run(req.params.code);
  res.json({ success: true });
});
app.get('/api/admin/api-providers', auth, admin, (req, res) => {
  const provider = providerStatus();
  const rows = filteredRoutes().map(r => ({
    ...r,
    baseUrl: r.baseUrl || provider.baseUrl,
    apiKey: r.apiKey || (hasConfiguredSecret(providerAuthKey(r.type === 'image' ? 'image' : 'text')) ? 'env-********' : ''),
    modelCount: r.models.length,
    supportsChat: r.type === 'text',
    supportsImage: r.type === 'image'
  }));
  res.json({ success: true, items: rows, list: rows, data: rows, providers: rows, routes: rows, total: rows.length, page: 1, pageSize: rows.length || 20 });
});
app.post('/api/admin/api-providers', auth, admin, (req, res) => {
  const id = uid('pub_route_');
  const rawRoute = {
    id,
    rk: req.body.routeKey || req.body.code || id,
    name: req.body.name || req.body.displayName || '本地线路',
    displayName: req.body.displayName || req.body.name || '本地线路',
    dn: req.body.displayName || req.body.name || '本地线路',
    apiFormat: req.body.apiFormat || 'openai',
    cat: req.body.category || req.body.type || req.body.group || 'image',
    g: req.body.category || req.body.type || req.body.group || 'image',
    pri: Number(req.body.priority || 1),
    def: req.body.isDefault === true || req.body.def === true,
    dm: req.body.defaultModelKey || req.body.defaultModelRealName || req.body.defaultModelDisplayName || req.body.dm || '',
    enabled: req.body.enabled !== false,
    status: req.body.status || 'active',
    baseUrl: req.body.baseUrl || req.body.apiBase || '',
    apiKey: normalizeSecretInput(req.body.apiKey),
    timeoutMs: positiveNumber(req.body.timeoutMs, PROVIDER_TIMEOUT_MS),
    imageTimeoutMs: positiveNumber(req.body.imageTimeoutMs || req.body.timeoutMs, IMAGE_PROVIDER_TIMEOUT_MS),
    requestFormat: req.body.requestFormat || req.body.apiFormat || '',
    endpoint: req.body.endpoint || req.body.requestPath || '',
    requestPath: req.body.requestPath || req.body.endpoint || '',
    requestBodyExample: req.body.requestBodyExample || null,
    requestExamples: Array.isArray(req.body.requestExamples) ? req.body.requestExamples : [],
    chatEndpoint: req.body.chatEndpoint || '',
    imageEndpoint: req.body.imageEndpoint || '',
    imageEditEndpoint: req.body.imageEditEndpoint || '',
    imageResponseFormat: normalizeProviderImageResponseFormat(req.body.imageResponseFormat),
    imageStream: normalizeProviderImageStream(req.body.imageStream),
    imagePartialImages: normalizeProviderImagePartialImages(req.body.imagePartialImages),
    videoEndpoint: req.body.videoEndpoint || '',
    defaultTextModel: req.body.defaultTextModel || '',
    defaultImageModel: req.body.defaultImageModel || '',
    defaultVideoModel: req.body.defaultVideoModel || '',
    multiplier: Number(req.body.multiplier || req.body.rate || 1),
    remark: req.body.remark || req.body.note || ''
  };
  const normalizedRoute = normalizeApiProviderRoute(rawRoute);
  const routes = [...routeState(), normalizedRoute];
  saveRouteState(routes);
  const route = routePayload(normalizedRoute);
  res.json({ success: true, item: route, provider: route, route });
});
app.put('/api/admin/api-providers', auth, admin, (req, res) => {
  const inputRoutes = Array.isArray(req.body)
    ? req.body
    : (Array.isArray(req.body.routes) ? req.body.routes : req.body.providers);
  if (!Array.isArray(inputRoutes)) {
    return res.status(400).json({ success: false, code: 'INVALID_ROUTES', message: '请提供 routes 数组' });
  }
  const previousRoutes = routeState();
  const nextRoutes = inputRoutes.map((route, index) => {
    const kind = route.category || route.type || route.group || route.cat || route.g || 'image';
    const id = route.id || route.routeId || route.lineId || uid('pub_route_');
    const routeKey = route.routeKey || route.lineKey || route.routeCode || route.code || route.key || route.rk || id;
    const name = route.displayName || route.name || route.routeDisplayName || route.routeName || route.dn || routeKey;
    const previous = previousRoutes.find(item => [item.id, item.rk, item.routeKey, item.lineKey, item.code].includes(id) || [item.id, item.rk, item.routeKey, item.lineKey, item.code].includes(routeKey)) || {};
    const imageResponseMode = providerImageResponseMode({ ...previous, ...route, id, rk: routeKey });
    return normalizeApiProviderRoute({
      id,
      rk: routeKey,
      name,
      displayName: route.displayName || name,
      dn: route.displayName || name,
      apiFormat: route.apiFormat || route.requestFormat || 'openai',
      requestFormat: route.requestFormat || route.apiFormat || '',
      endpoint: route.endpoint || route.requestPath || '',
      requestPath: route.requestPath || route.endpoint || '',
      requestBodyExample: route.requestBodyExample || null,
      requestExamples: Array.isArray(route.requestExamples) ? route.requestExamples : [],
      cat: kind,
      g: kind,
      pri: Number(route.priority ?? route.pri ?? (inputRoutes.length - index)),
      def: route.isDefault === true || route.def === true,
      dm: route.defaultModelKey || route.defaultModelRealName || route.defaultModelDisplayName || route.dm || '',
      enabled: route.enabled !== false,
      status: route.status || 'active',
      baseUrl: route.baseUrl || route.apiBase || '',
      apiKey: normalizeSecretInput(route.apiKey, previous.apiKey || ''),
      timeoutMs: positiveNumber(route.timeoutMs, previous.timeoutMs || PROVIDER_TIMEOUT_MS),
      imageTimeoutMs: positiveNumber(
        route.imageTimeoutMs || route.timeoutMs,
        previous.imageTimeoutMs || IMAGE_PROVIDER_TIMEOUT_MS
      ),
      chatEndpoint: route.chatEndpoint || '',
      imageEndpoint: route.imageEndpoint || '',
      imageEditEndpoint: route.imageEditEndpoint || '',
      imageResponseFormat: imageResponseMode.responseFormat,
      imageStream: imageResponseMode.stream,
      imagePartialImages: imageResponseMode.partialImages ?? 0,
      videoEndpoint: route.videoEndpoint || '',
      defaultTextModel: route.defaultTextModel || '',
      defaultImageModel: route.defaultImageModel || '',
      defaultVideoModel: route.defaultVideoModel || '',
      multiplier: Number(route.multiplier || route.rate || 1),
      remark: route.remark || route.note || ''
    });
  });
  saveRouteState(nextRoutes);
  const rows = nextRoutes.map(routePayload);
  res.json({ success: true, items: rows, list: rows, data: rows, providers: rows, routes: rows, total: rows.length, page: 1, pageSize: rows.length || 20 });
});
app.put('/api/admin/api-providers/:id', auth, admin, (req, res) => {
  const routes = routeState();
  let updated = null;
  const nextRoutes = routes.map(route => {
    if (![route.id, route.rk, route.routeKey, route.lineKey].includes(req.params.id)) return route;
    const imageResponseMode = providerImageResponseMode({ ...route, ...req.body });
    updated = normalizeApiProviderRoute({
      ...route,
      ...req.body,
      id: route.id,
      rk: req.body.routeKey || req.body.code || route.rk,
      name: req.body.name || route.name || route.dn,
      displayName: req.body.displayName || route.displayName || route.dn || route.name,
      dn: req.body.displayName || req.body.name || route.dn,
      apiFormat: req.body.apiFormat || route.apiFormat || 'openai',
      requestFormat: req.body.requestFormat || route.requestFormat || req.body.apiFormat || route.apiFormat || '',
      endpoint: req.body.endpoint || req.body.requestPath || route.endpoint || route.requestPath || '',
      requestPath: req.body.requestPath || req.body.endpoint || route.requestPath || route.endpoint || '',
      requestBodyExample: req.body.requestBodyExample || route.requestBodyExample || null,
      requestExamples: Array.isArray(req.body.requestExamples) ? req.body.requestExamples : (route.requestExamples || []),
      cat: req.body.category || req.body.type || req.body.group || route.cat,
      g: req.body.category || req.body.type || req.body.group || route.g,
      baseUrl: req.body.baseUrl ?? req.body.apiBase ?? route.baseUrl,
      apiKey: normalizeSecretInput(req.body.apiKey, route.apiKey || ''),
      timeoutMs: positiveNumber(req.body.timeoutMs, route.timeoutMs || PROVIDER_TIMEOUT_MS),
      imageTimeoutMs: positiveNumber(
        req.body.imageTimeoutMs || req.body.timeoutMs,
        route.imageTimeoutMs || IMAGE_PROVIDER_TIMEOUT_MS
      ),
      chatEndpoint: req.body.chatEndpoint ?? route.chatEndpoint ?? '',
      imageEndpoint: req.body.imageEndpoint ?? route.imageEndpoint ?? '',
      imageEditEndpoint: req.body.imageEditEndpoint ?? route.imageEditEndpoint ?? '',
      imageResponseFormat: imageResponseMode.responseFormat,
      imageStream: imageResponseMode.stream,
      imagePartialImages: imageResponseMode.partialImages ?? 0,
      videoEndpoint: req.body.videoEndpoint ?? route.videoEndpoint ?? '',
      defaultTextModel: req.body.defaultTextModel ?? route.defaultTextModel ?? '',
      defaultImageModel: req.body.defaultImageModel ?? route.defaultImageModel ?? '',
      defaultVideoModel: req.body.defaultVideoModel ?? route.defaultVideoModel ?? '',
      multiplier: Number(req.body.multiplier ?? req.body.rate ?? route.multiplier ?? route.rate ?? 1),
      remark: req.body.remark ?? req.body.note ?? route.remark ?? route.note ?? '',
      pri: Number(req.body.priority ?? route.pri ?? 0),
      def: req.body.isDefault ?? req.body.def ?? route.def,
      dm: req.body.defaultModelKey || req.body.defaultModelRealName || req.body.defaultModelDisplayName || route.dm,
      enabled: req.body.enabled !== false
    });
    return updated;
  });
  if (!updated) return res.status(404).json({ success: false, code: 'ROUTE_NOT_FOUND', message: 'API 线路不存在' });
  saveRouteState(nextRoutes);
  const item = routePayload(updated);
  res.json({ success: true, id: req.params.id, item, provider: item, route: item });
});
app.delete('/api/admin/api-providers/:id', auth, admin, (req, res) => {
  const before = routeState();
  const nextRoutes = before.filter(route => ![route.id, route.rk, route.routeKey, route.lineKey].includes(req.params.id));
  saveRouteState(nextRoutes);
  res.json({ success: true, id: req.params.id, deleted: before.length !== nextRoutes.length });
});
app.post('/api/admin/api-providers/:id/test', auth, admin, async (req, res) => {
  const startedAt = Date.now();
  const route = findRouteByAnyId(req.params.id);
  const kind = routeKind(route);
  const status = routeProviderStatus(route, kind);
  if (!status.enabled) {
    return res.json({
      success: true,
      mock: true,
      latencyMs: Date.now() - startedAt,
      message: '当前为本地 mock 模式；配置 New-API 并启用 ENABLE_REAL_AI 后可测试真实网关',
      provider: status
    });
  }

  const model = route.dm || route.defaultModelKey || route.defaultModelRealName || (kind === 'image' ? AI_IMAGE_MODEL : AI_TEXT_MODEL);
  const result = kind === 'image'
    ? await callProviderImageGeneration('API 线路连通性测试，简洁白底产品图标，不包含文字', {
      model,
      n: 1,
      imageCount: 1,
      size: '1024x1024',
      quality: 'auto',
      output_format: 'png',
      route
    })
    : await callProviderResponses('ping', { model, route });
  res.status(result.success ? 200 : 502).json({
    success: result.success,
    mock: !!result.mock,
    latencyMs: Date.now() - startedAt,
    message: result.success
      ? (kind === 'image' ? '图片线路连接正常，Images API 已返回图片' : '文本线路连接正常，Responses API 已返回结果')
      : result.message,
    provider: status,
    route: { id: req.params.id, type: kind, model },
    request: result.request,
    imageCount: Array.isArray(result.images) ? result.images.length : undefined,
    code: result.code || undefined
  });
});
app.post('/api/admin/api-providers/:id/fetch-models', auth, admin, (req, res) => {
  const route = findRouteByAnyId(req.params.id);
  res.json({ success: true, items: baseModelsForRoute(route) });
});
app.post('/api/admin/api-providers/:id/set-default', auth, admin, (req, res) => {
  const routes = routeState();
  const nextRoutes = routes.map(route => ({ ...route, def: [route.id, route.rk, route.routeKey, route.lineKey].includes(req.params.id) }));
  saveRouteState(nextRoutes);
  res.json({ success: true, defaultRouteId: req.params.id });
});
app.get('/api/admin/model-prices', auth, admin, (req, res) => {
  const rows = modelPriceRows();
  const routes = filteredRoutes().map(route => ({
    ...route,
    models: rows.filter(row => row.routeId === route.id)
  }));
  const payload = pageList(routes, req);
  res.json({
    success: true,
    ...payload,
    routes,
    providers: routes,
    list: routes,
    data: routes,
    items: routes,
    models: rows,
    prices: rows,
    rows,
    totalModels: rows.length
  });
});
app.post('/api/admin/routes/:id/models', auth, admin, (req, res) => {
  const route = routeState().find(r => [r.id, r.routeId, r.lineId, r.rk, r.routeKey, r.lineKey, r.code].includes(req.params.id));
  if (!route) return res.status(404).json({ success: false, code: 'ROUTE_NOT_FOUND', message: '线路不存在' });
  const modelKey = String(req.body.modelKey || req.body.realName || '').trim();
  const price = Number(req.body.pricePoints ?? req.body.price ?? 10);
  if (!modelKey) return res.status(400).json({ success: false, code: 'MODEL_KEY_REQUIRED', message: '模型标识不能为空' });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ success: false, code: 'INVALID_MODEL_PRICE', message: '模型价格必须是大于或等于 0 的数字' });
  const defaultQualities = routeKind(route) === 'image' ? IMAGE_CLARITY_OPTIONS : ['1k'];
  const model = fmt({ k: modelKey, n: req.body.displayName || req.body.name || modelKey, p: price, q: req.body.qualities || defaultQualities }, route);
  const rows = modelPriceState();
  const nextRows = rows.filter(row => row.id !== `${route.id}:${model.modelKey}`);
  nextRows.push({
    id: `${route.id}:${model.modelKey}`,
    routeId: route.id,
    routeKey: route.routeKey || route.rk,
    modelKey: model.modelKey,
    displayName: model.displayName,
    realName: model.realName,
    modelType: model.modelType,
    price: model.pricePoints,
    pricePoints: model.pricePoints,
    baseCredits: model.baseCredits,
    enabled: true,
    qualities: model.qualities || []
  });
  saveModelPriceState(nextRows);
  res.json({ success: true, model, item: model });
});
app.patch('/api/admin/route-models/:id', auth, admin, (req, res) => {
  const rows = modelPriceRows();
  const existing = rows.find(row => row.id === req.params.id);
  if (!existing) return res.status(404).json({ success: false, code: 'MODEL_NOT_FOUND', message: '模型不存在' });
  const price = Number(req.body.pricePoints ?? req.body.price ?? existing.pricePoints ?? 0);
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ success: false, code: 'INVALID_MODEL_PRICE', message: '模型价格必须是大于或等于 0 的数字' });
  const item = { ...existing, ...req.body, price, pricePoints: price, deleted: false, id: req.params.id };
  const nextRows = modelPriceState().filter(row => row.id !== req.params.id);
  nextRows.push(item);
  saveModelPriceState(nextRows);
  res.json({ success: true, id: req.params.id, item });
});
app.patch('/api/admin/route-models/:id/enabled', auth, admin, (req, res) => {
  const rows = modelPriceRows();
  const existing = rows.find(row => row.id === req.params.id);
  if (!existing) return res.status(404).json({ success: false, code: 'MODEL_NOT_FOUND', message: '模型不存在' });
  const item = { ...existing, enabled: req.body.enabled !== false };
  const nextRows = modelPriceState().filter(row => row.id !== req.params.id);
  nextRows.push(item);
  saveModelPriceState(nextRows);
  res.json({ success: true, id: req.params.id, enabled: item.enabled });
});
app.delete('/api/admin/route-models/:id', auth, admin, (req, res) => {
  const existing = modelPriceRows().find(row => row.id === req.params.id);
  if (!existing) return res.status(404).json({ success: false, code: 'MODEL_NOT_FOUND', message: '模型不存在' });
  const nextRows = modelPriceState().filter(row => row.id !== req.params.id);
  nextRows.push({ ...existing, id: req.params.id, enabled: false, status: 'deleted', deleted: true });
  saveModelPriceState(nextRows);
  res.json({ success: true, id: req.params.id });
});
app.get('/api/admin/generate-tasks', auth, admin, (req, res) => {
  const persistentTasks = generationTaskService.listTasks(200).map(task => ({
    ...makePersistentTaskResponse(task),
    username: db.prepare('SELECT username FROM users WHERE id=?').get(task.userId)?.username || 'local',
    userId: task.userId,
    model: task.modelKey,
    modelDisplayName: task.modelKey,
    resolvedModel: task.modelKey,
    promptPreview: String(task.prompt || '').slice(0, 120),
    promptLength: String(task.prompt || '').length,
    imageCount: task.imageCount,
    size: task.request?.size || '',
    resolvedSize: task.request?.size || '',
    quality: task.request?.quality || '',
    chargeStatus: task.billingStatus === 'reserved'
      ? '已预占'
      : (task.billingStatus === 'refunded'
          ? '已退款'
          : (task.billingStatus === 'partially_settled' ? '部分结算' : '已结算'))
  }));
  const memoryTasks = Array.from(tasks.values()).map(task => ({
    ...makeTaskResponse(task),
    status: task.status === 'completed' ? 'success' : task.status,
    username: db.prepare('SELECT username FROM users WHERE id=?').get(task.userId)?.username || 'local',
    userId: task.userId,
    lineKey: task.lineKey || task.routeKey || '',
    routeDisplayName: task.routeDisplayName || task.routeName || task.lineKey || task.routeKey || '',
    model: task.modelKey,
    modelDisplayName: task.modelKey,
    resolvedModel: task.modelKey,
    promptPreview: String(task.prompt || '').slice(0, 120),
    promptLength: String(task.prompt || '').length,
    imageCount: Array.isArray(task.images) ? task.images.length : 0,
    size: task.request?.size || '',
    resolvedSize: task.request?.size || '',
    quality: task.request?.quality || '',
    chargeStatus: task.status === 'success' || task.status === 'completed'
      ? (Number(task.cost || 0) > 0 ? '已记录扣费' : '无扣费记录')
      : (task.status === 'failed' ? '未完成' : '待结算'),
    finishedAt: task.updatedAt
  }));
  const rows = [
    ...persistentTasks,
    ...memoryTasks.filter((task) => !generationTaskRepository.getTask(task.id)),
    ...generationRows(100).filter((row) => !row.sourceTaskId)
  ];
  const filtered = String(req.query.status || '') === 'active'
    ? rows
    : rows.filter(row => !req.query.status || row.status === req.query.status);
  const schedulerSummary = imageRequestScheduler.snapshot();
  const summary = {
    total: filtered.length,
    pending: filtered.filter(t => t.status === 'pending').length,
    running: filtered.filter(t => t.status === 'running').length,
    success: filtered.filter(t => t.status === 'success').length,
    failed: filtered.filter(t => t.status === 'failed').length,
    cancelled: filtered.filter(t => t.status === 'cancelled').length,
    queueMode: 'persistent-bounded-fair',
    queue: schedulerSummary,
    processMemory: Object.fromEntries(
      Object.entries(process.memoryUsage()).map(([key, value]) => [key, Number(value || 0)])
    ),
    dataScope: 'SQLite 持久任务、兼容期运行时任务与旧生成历史；Provider 失败域和账务状态均来自真实任务记录'
  };
  const payload = pageList(filtered, req);
  res.json({ success: true, ...payload, tasks: payload.items, summary });
});
app.post('/api/admin/generate-tasks/:id/cancel', auth, admin, (req, res) => {
  const persistentTask = generationTaskService.getTask(req.params.id);
  if (persistentTask) {
    try {
      const cancelled = generationTaskService.cancel(req.params.id, {
        reason: String(req.body.reason || '管理员取消').slice(0, 200)
      });
      return res.json({ success: true, ...makePersistentTaskResponse(cancelled) });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        code: error.code || 'TASK_CANCEL_FAILED',
        message: error.message || '取消任务失败'
      });
    }
  }
  const task = tasks.get(req.params.id);
  if (!task) return res.status(404).json({ success: false, code: 'ACTIVE_TASK_NOT_FOUND', message: '未找到可取消的运行时任务' });
  if (!['pending', 'running'].includes(task.status)) {
    return res.status(409).json({ success: false, code: 'TASK_NOT_CANCELLABLE', message: '只有等待中或运行中的任务可以取消' });
  }
  task.status = 'cancelled';
  task.errorMessage = req.body.reason || '管理员取消';
  task.updatedAt = new Date().toISOString();
  res.json({ success: true, id: req.params.id, status: 'cancelled' });
});
app.delete('/api/admin/generate-tasks/:id', auth, admin, (req, res) => {
  if (generationTaskService.getTask(req.params.id)) {
    try {
      generationTaskRepository.deleteTask(req.params.id);
      removeGenerationTaskInputs(req.params.id).catch(() => {});
      return res.json({ success: true, id: req.params.id, source: 'persistent-task' });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        code: error.code || 'TASK_DELETE_FAILED',
        message: error.message || '删除任务失败'
      });
    }
  }
  if (tasks.delete(req.params.id)) {
    return res.json({ success: true, id: req.params.id, source: 'runtime' });
  }
  const result = db.prepare('DELETE FROM generations WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ success: false, code: 'TASK_NOT_FOUND', message: '任务记录不存在' });
  res.json({ success: true, id: req.params.id, source: 'history' });
});
app.get('/api/admin/generate-tasks/:id/reference-images/:imageId/thumb', auth, admin, (req, res) => {
  res.redirect(302, placeholderUrl(`reference ${req.params.imageId}`));
});
app.get('/api/admin/template-workflows', auth, admin, (req, res) => {
  const workflow = templateWorkflowState();
  res.json({ success: true, ...workflow, items: workflow.templates || [], data: workflow.templates || [] });
});
app.put('/api/admin/template-workflows', auth, admin, (req, res) => {
  const current = templateWorkflowState();
  const next = {
    ...current,
    ...req.body,
    templates: Array.isArray(req.body.templates) ? req.body.templates : (current.templates || []),
    platforms: Array.isArray(req.body.platforms) ? req.body.platforms : current.platforms,
    qualities: Array.isArray(req.body.qualities) ? req.body.qualities : current.qualities,
    ratios: Array.isArray(req.body.ratios) ? req.body.ratios : current.ratios,
    model_configs: req.body.model_configs || current.model_configs
  };
  saveTemplateWorkflowState(next);
  res.json({ success: true, ...next, items: next.templates || [], data: next.templates || [] });
});

function adminChatSettingsPayload() {
  const settings = chatSettingsState();
  const provider = providerStatus();
  const now = Date.now();
  const usage = {
    activeSsoTickets: Number(db.prepare('SELECT COUNT(*) AS count FROM chat_sso_tickets WHERE used_at IS NULL AND expires_at>=?').get(now)?.count || 0),
    textCharges: Number(db.prepare('SELECT COUNT(*) AS count FROM chat_text_charges').get()?.count || 0),
    imageQuotes: Number(db.prepare('SELECT COUNT(*) AS count FROM chat_image_quotes').get()?.count || 0)
  };
  return {
    settings,
    deployment: {
      enabled: ENABLE_LIBRECHAT,
      accessReady: ENABLE_LIBRECHAT && settings.accessEnabled,
      bridgeSecretConfigured: hasConfiguredSecret(LIBRECHAT_BRIDGE_SECRET),
      realAiEnabled: provider.enabled,
      providerMode: provider.mode,
      providerKeyConfigured: provider.textKeyConfigured,
      providerBaseConfigured: !!provider.baseUrl && !/example\.com/i.test(provider.baseUrl),
      providerModel: AI_TEXT_MODEL,
      ssoTtlSeconds: LIBRECHAT_SSO_TTL_SECONDS,
      chatPath: '/chat/',
      apiPath: '/chat-api/',
      skills: {
        enabled: true,
        privateCreate: true,
        publicSharing: false
      },
      mcp: {
        websiteTools: settings.imageToolsEnabled,
        externalInstall: false
      }
    },
    models: TXT.map(item => ({ id: item.k, name: item.n, price: item.p })),
    usage
  };
}

async function probeLibreChatHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${LIBRECHAT_INTERNAL_URL}/health`, { signal: controller.signal });
    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      message: response.ok ? 'LibreChat 内部健康检查通过' : `LibreChat 返回 HTTP ${response.status}`
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      message: error.name === 'AbortError' ? 'LibreChat 健康检查超时' : `LibreChat 无法连接: ${error.message}`
    };
  } finally {
    clearTimeout(timer);
  }
}

function providerTestContent(data = {}) {
  const normalized = imageToolOutputText(data);
  if (normalized) return normalized;
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map(item => typeof item === 'string' ? item : item?.text || '').join('').trim();
  }
  return '';
}

async function runRealChatProviderTest({ model, prompt }) {
  const route = resolveTextRoute({ model, textModel: model });
  const status = routeProviderStatus(route, 'text');
  if (!status.enabled) {
    throw integrationError(409, 'CHAT_PROVIDER_NOT_READY', '真实 AI 中转尚未启用，需配置服务器端地址、密钥并设置 ENABLE_REAL_AI=true');
  }
  const allowedModel = allowedChatModels().find(item => item.k === model);
  if (!allowedModel) {
    throw integrationError(400, 'CHAT_PROVIDER_MODEL_NOT_ALLOWED', '测试模型不在 Chat 允许模型列表中');
  }

  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(Number(status.timeoutMs || 30000), 5000), 45000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const routeProtocol = String(route.requestFormat || route.apiFormat || route.endpoint || '').toLowerCase();
    const useResponses = routeProtocol.includes('responses') && !routeProtocol.includes('chat/completions');
    const requestUrl = joinProviderUrl(status.baseUrl, useResponses ? routeTextEndpoint(route) : routeTextChatEndpoint(route));
    const requestBody = useResponses
      ? {
          model: allowedModel.k,
          input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
          max_output_tokens: 16
        }
      : {
          model: allowedModel.k,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0,
          max_tokens: 16
        };
    const response = await fetchProvider(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerAuthKey('text', route)}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      const providerMessage = String(data.error?.message || data.message || `Provider returned HTTP ${response.status}`).slice(0, 500);
      throw integrationError(502, 'CHAT_PROVIDER_TEST_FAILED', providerMessage, { upstreamStatus: response.status, latencyMs });
    }
    const content = providerTestContent(data);
    if (!content) {
      throw integrationError(502, 'CHAT_PROVIDER_TEST_BAD_RESPONSE', '中转站响应成功，但没有返回可读取的文本内容', { upstreamStatus: response.status, latencyMs });
    }
    return {
      model: String(data.model || allowedModel.k),
      content: content.slice(0, 1000),
      latencyMs,
      finishReason: data.choices?.[0]?.finish_reason || '',
      usage: {
        promptTokens: Number(data.usage?.prompt_tokens || data.usage?.input_tokens || 0),
        completionTokens: Number(data.usage?.completion_tokens || data.usage?.output_tokens || 0),
        totalTokens: Number(data.usage?.total_tokens || (Number(data.usage?.input_tokens || 0) + Number(data.usage?.output_tokens || 0)) || 0)
      },
      providerMode: status.mode,
      protocol: useResponses ? 'responses' : 'chat/completions',
      testedAt: new Date().toISOString()
    };
  } catch (error) {
    if (error.status) throw error;
    throw integrationError(
      502,
      error.name === 'AbortError' ? 'CHAT_PROVIDER_TEST_TIMEOUT' : 'CHAT_PROVIDER_TEST_REQUEST_FAILED',
      error.name === 'AbortError' ? `真实中转测试超过 ${timeoutMs}ms` : `真实中转测试请求失败: ${error.message}`
    );
  } finally {
    clearTimeout(timer);
  }
}

app.get('/api/admin/settings', auth, admin, (req, res) => {
  const settings = settingsState();
  res.json({ success: true, settings, data: settings, ...settings });
});
app.patch('/api/admin/settings', auth, admin, (req, res) => {
  const settings = saveSettingsState({ ...settingsState(), ...(req.body || {}) });
  res.json({ success: true, settings, data: settings, ...settings });
});
app.get('/api/admin/chat/settings', auth, admin, (req, res) => {
  res.json({ success: true, ...adminChatSettingsPayload() });
});
app.patch('/api/admin/chat/settings', auth, admin, (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const current = chatSettingsState();
  const next = saveChatSettingsState({
    accessEnabled: body.accessEnabled ?? current.accessEnabled,
    textChatEnabled: body.textChatEnabled ?? current.textChatEnabled,
    imageToolsEnabled: body.imageToolsEnabled ?? current.imageToolsEnabled,
    allowedModels: body.allowedModels ?? current.allowedModels,
    maintenanceMessage: body.maintenanceMessage ?? current.maintenanceMessage,
    managedAgents: body.managedAgents ?? current.managedAgents
  });
  res.json({ success: true, ...adminChatSettingsPayload(), settings: next });
});
app.post('/api/admin/chat/test', auth, admin, async (req, res) => {
  const payload = adminChatSettingsPayload();
  const libreChatHealth = await probeLibreChatHealth();
  const checks = [
    { key: 'deployment', label: 'Chat 部署开关', ok: payload.deployment.enabled, message: payload.deployment.enabled ? 'ENABLE_LIBRECHAT 已启用' : 'ENABLE_LIBRECHAT 未启用' },
    { key: 'bridge-secret', label: '内部服务密钥', ok: payload.deployment.bridgeSecretConfigured, message: payload.deployment.bridgeSecretConfigured ? '内部服务密钥已配置' : '内部服务密钥未配置' },
    { key: 'runtime-access', label: '运行时访问', ok: payload.settings.accessEnabled, message: payload.settings.accessEnabled ? 'Chat 访问已开放' : payload.settings.maintenanceMessage },
    { key: 'models', label: '文本模型', ok: allowedChatModels(payload.settings).length > 0, message: `已开放 ${allowedChatModels(payload.settings).length} 个文本模型` },
    { key: 'librechat-health', label: 'LibreChat 服务', ...libreChatHealth }
  ];
  res.json({
    success: true,
    healthy: checks.every(item => item.ok),
    checkedAt: new Date().toISOString(),
    checks,
    ...payload
  });
});
app.post('/api/admin/chat/test-provider', auth, admin, async (req, res, next) => {
  try {
    if (req.body?.confirmRealCall !== true) {
      return res.status(400).json({ success: false, code: 'REAL_PROVIDER_CONFIRMATION_REQUIRED', message: '必须明确确认本次真实中转测试可能消耗 Provider 额度' });
    }
    const prompt = String(req.body?.prompt || '请只回复 OK').trim().slice(0, 500);
    if (!prompt) {
      return res.status(400).json({ success: false, code: 'CHAT_PROVIDER_TEST_PROMPT_REQUIRED', message: '请输入测试提示词' });
    }
    const model = String(req.body?.model || allowedChatModels()[0]?.k || '').trim();
    const result = await runRealChatProviderTest({ model, prompt });
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});
app.all('/api/admin/*', auth, admin, (req, res) => {
  res.status(404).json({
    success: false,
    code: 'ADMIN_API_NOT_IMPLEMENTED',
    message: `后台接口未实现: ${req.method} ${req.originalUrl}`,
    path: req.path
  });
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
  if (/^\/api\/integrations\/librechat\/v1(?:\/|$)/.test(req.path)) {
    const extra = {};
    if (Number.isFinite(err.cost)) extra.cost = err.cost;
    if (Number.isFinite(err.balance)) extra.balance = err.balance;
    return res.status(status).json(integrationOpenAiErrorPayload(code, message, extra));
  }
  res.status(status).json({ success: false, code, message });
});

// ===================== SPA FALLBACK =====================
const sourceFrontendRoutePattern = /^\/(?:admin(?:\/.*)?|gallery\/?)$/;
const chatFallbackRoutePattern = /^\/chat(?:\/.*)?$/;

app.get(/^\/(?:chat|CHAT)\/?$/, (req, res, next) => {
  if (req.path === '/chat/') return next();
  return res.redirect(308, '/chat/');
});

app.get(chatFallbackRoutePattern, (req, res) => {
  res.status(503);
  res.set('Cache-Control', 'no-store');
  res.set('Retry-After', '30');
  res.type('html').send(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI 对话正在启动</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f3f5f7; color: #17212b; }
    main { width: min(460px, 100%); padding: 32px; border: 1px solid #dce2e7; border-radius: 8px; background: #fff; box-shadow: 0 12px 36px rgba(17, 24, 39, .08); }
    h1 { margin: 0 0 12px; font-size: 24px; letter-spacing: 0; }
    p { margin: 0 0 24px; color: #52606d; line-height: 1.7; }
    a { display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; border-radius: 6px; background: #176b4d; color: #fff; font-weight: 600; text-decoration: none; }
    a:focus-visible { outline: 3px solid rgba(23, 107, 77, .25); outline-offset: 3px; }
  </style>
</head>
<body>
  <main>
    <h1>AI 对话正在启动</h1>
    <p>聊天服务尚未接入当前端口。现有网站、模板和画布功能不受影响。</p>
    <a href="/">返回首页</a>
  </main>
</body>
</html>`);
});

app.get(sourceFrontendRoutePattern, (req, res) => {
  const sourceIndex = path.join(sourceFrontendDist, 'index.html');
  res.sendFile(fs.existsSync(sourceIndex) ? sourceIndex : path.join(__dirname, 'index.html'));
});
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

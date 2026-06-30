/**
 * 哈吉米AI 本地克隆 v2.0 — 生产级后端
 */
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const multer = require('multer');

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

const PORT = process.env.PORT || 3456;
const JWT_SECRET = process.env.JWT_SECRET || 'hjm-mb-local-dev-secret';
const AI_API_BASE = process.env.AI_API_BASE || 'https://api.openai.com/v1';
const AI_IMAGE_KEY = process.env.AI_IMAGE_KEY || process.env.AI_API_KEY || 'sk-';
const AI_TEXT_KEY = process.env.AI_TEXT_KEY || process.env.AI_API_KEY || 'sk-';
const AI_IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'gpt-image-2';
const AI_TEXT_MODEL = process.env.AI_TEXT_MODEL || 'gpt-5.5';
const AI_PROVIDER_GATEWAY = process.env.AI_PROVIDER_GATEWAY || 'new-api';
const NEW_API_BASE = process.env.NEW_API_BASE || AI_API_BASE;
const NEW_API_KEY = process.env.NEW_API_KEY || process.env.AI_API_KEY || AI_TEXT_KEY;
const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const PROVIDER_TIMEOUT_MS = positiveNumber(process.env.PROVIDER_TIMEOUT_MS, 120000);
const IMAGE_PROVIDER_TIMEOUT_MS = positiveNumber(process.env.IMAGE_PROVIDER_TIMEOUT_MS || process.env.PROVIDER_IMAGE_TIMEOUT_MS, 180000);
const CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS = positiveNumber(process.env.CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS || process.env.PROVIDER_ANALYSIS_TIMEOUT_MS, PROVIDER_TIMEOUT_MS);
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(DATA_DIR, 'data.db');
const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(__dirname, 'uploads');
const LOG_DIR = process.env.LOG_DIR ? path.resolve(process.env.LOG_DIR) : path.join(__dirname, 'logs');
const ENABLE_REAL_AI = ['1','true','yes','on'].includes(String(process.env.ENABLE_REAL_AI || '').toLowerCase());
const ENABLE_REAL_EMAIL = ['1','true','yes','on'].includes(String(process.env.ENABLE_REAL_EMAIL || '').toLowerCase());
const ENABLE_REAL_PAYMENT = ['1','true','yes','on'].includes(String(process.env.ENABLE_REAL_PAYMENT || '').toLowerCase());
const ENABLE_REAL_STORAGE = ['1','true','yes','on'].includes(String(process.env.ENABLE_REAL_STORAGE || '').toLowerCase());
const hasUsableKey = (key = '') => /^sk-[A-Za-z0-9_\-]{12,}/.test(String(key || ''));
const hasConfiguredSecret = (key = '') => {
  const value = String(key || '').trim();
  return value.length >= 12 && !/replace|your-|填|占位|sk-$|^sk-replace/i.test(value);
};

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
const sourceFrontendDist = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));
app.use('/assets', express.static(path.join(sourceFrontendDist, 'assets')));
app.use((req, res, next) => {
  res.success = (payload = {}) => res.json({ success: true, ...payload });
  res.fail = (status, code, message, extra = {}) => res.status(status).json({ success: false, code, message, ...extra });
  next();
});

// Uploads
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });
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
`);

// Seed
db.exec(`INSERT OR IGNORE INTO redeem_codes (code, amount, max_uses) VALUES ('WELCOME50',50,1000),('HAJIMI2024',100,500),('VIP100',100,100)`);

// Helpers
const h = (pwd) => crypto.createHash('sha256').update(pwd + JWT_SECRET).digest('hex');
const uid = (p='') => p + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const rcode = () => String(Math.floor(100000 + Math.random() * 900000));

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

// ===================== DATA =====================
const IMG = [
  {k:"gpt-image-2",n:"GPT Image 2",p:10,q:["low","medium","high","auto"]},
];
const TXT = [
  {k:"gpt-5.5",n:"GPT 5.5",p:5,q:["1k"]},
];
const RTS = [
  {id:"pub_route_openai_gpt_image_2",rk:"route_openai_gpt_image_2",dn:"GPT Image 2",cat:"image",g:"image",pri:10,def:true,dm:"gpt-image-2",apiFormat:"openai-images",requestFormat:"packy-openai-images-generations",endpoint:"/images/generations",requestExamples:[
    {label:"文生图",method:"POST",endpoint:"/images/generations",contentType:"application/json",requestFormat:"packy-openai-images-generations",body:{model:"gpt-image-2",prompt:"string",size:"1024x1024",quality:"auto",output_format:"png",response_format:"url",n:1}},
    {label:"图生图 / 局部重绘",method:"POST",endpoint:"/images/edits",contentType:"multipart/form-data",requestFormat:"packy-openai-images-edits",body:{model:"gpt-image-2",image:"<file>",mask:"<file optional>",prompt:"string",size:"1024x1024",quality:"auto",output_format:"png",response_format:"url",n:1}}
  ]},
  {id:"pub_route_openai_gpt_5_5",rk:"route_openai_gpt_5_5",dn:"GPT 5.5",cat:"text",g:"text",pri:9,dm:"gpt-5.5",apiFormat:"openai-responses",requestFormat:"openai-responses",endpoint:"/responses",requestExamples:[
    {label:"文本生成",method:"POST",endpoint:"/responses",contentType:"application/json",requestFormat:"openai-responses",body:{model:"gpt-5.5",input:"string"}}
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

const defaultAdminSettings = {
  siteName: '哈吉米 AI',
  registrationEnabled: true,
  emailCodeEnabled: true,
  canvasStorageEnabled: true,
  templateImageEnabled: true,
  imageHistoryEnabled: true,
  mockMode: true,
  maxUploadSizeMb: 20,
  defaultCredits: 50
};
const routeState = () => ensureState('admin.apiProviders', RTS);
const saveRouteState = (routes) => writeState('admin.apiProviders', routes);
const templateWorkflowState = () => ensureState('admin.templateWorkflows', TMPL);
const saveTemplateWorkflowState = (value) => writeState('admin.templateWorkflows', value);
const settingsState = () => ensureState('admin.settings', defaultAdminSettings);
const saveSettingsState = (value) => writeState('admin.settings', value);
const modelPriceState = () => ensureState('admin.modelPrices', []);
const saveModelPriceState = (value) => writeState('admin.modelPrices', value);

function findRouteByAnyId(id) {
  const routes = routeState();
  return routes.find(r => [r.id, r.routeId, r.lineId, r.rk, r.routeKey, r.lineKey, r.code].includes(id)) || routes[0] || RTS[0];
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

function routeImageGenerationEndpoint(route = {}) {
  const candidates = [route.imageGenerationEndpoint, route.generationEndpoint, route.imageEndpoint, route.endpoint, route.requestPath].filter(Boolean);
  const generation = candidates.find(value => /\/images\/generations\b/i.test(String(value)));
  if (generation) return generation;
  return '/v1/images/generations';
}

function routeImageEditEndpoint(route = {}) {
  const candidates = [route.imageEditEndpoint, route.editEndpoint, route.imageEndpoint, route.endpoint, route.requestPath].filter(Boolean);
  return candidates.find(value => /\/images\/edits\b/i.test(String(value))) || '/v1/images/edits';
}

function providerImageSize(value = '') {
  const raw = String(value || '').trim();
  if (/^\d+x\d+$/i.test(raw)) return raw.toLowerCase();
  const ratio = raw.replace(':', 'x');
  if (['9x16', '3x4', '4x5'].includes(ratio)) return '1024x1536';
  if (['16x9', '4x3'].includes(ratio)) return '1536x1024';
  return '1024x1024';
}

function providerImageQuality(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (['low', 'medium', 'high', 'auto'].includes(raw)) return raw;
  if (['1k', 'standard', 'sd'].includes(raw)) return 'low';
  if (['2k', 'hd'].includes(raw)) return 'medium';
  if (['4k', 'ultra', 'max'].includes(raw)) return 'high';
  return 'auto';
}

function providerImageOutputFormat(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  return ['png', 'jpeg'].includes(raw) ? raw : 'png';
}

const ECOMMERCE_IMAGE_SYSTEM_PROMPT = [
  '你是一名服务国内电商平台的资深电商美工设计师，熟悉淘宝、天猫、京东、拼多多、小红书等平台的商品主图审美、点击转化和合规边界。',
  '你的任务是把用户的简短需求转化为可直接用于图片生成模型的完整电商视觉指令。',
  '画面要求：商品主体清晰居中，构图稳定，商业摄影级光影，质感真实，背景干净高级，有适合国内电商的主图氛围和转化感。',
  '参考图要求：如果提供参考图，必须优先保持产品外形、包装结构、颜色、材质、文字、logo 和品牌识别一致；只能优化构图、背景、光影、道具和整体视觉表现。',
  '合规要求：不要虚构品牌、认证、价格、功效、活动标签和不存在的文字；不要改错包装文字；不要生成水印、二维码、乱码文字、畸形产品或多余主体。',
  '输出要求：只生成最终图片，不要在图片里添加说明性大段文字；如需文字，只能使用用户明确要求或参考图中已有的可识别元素。'
].join('\n');

function buildEcommerceImagePrompt(userPrompt = '', options = {}) {
  const prompt = String(userPrompt || '').trim();
  const referenceRule = options.hasReferenceImages
    ? '本次有参考图：请把参考图中的产品作为核心主体，保持产品包装与识别信息一致，在此基础上生成更适合电商展示的主图。'
    : '本次没有参考图：请根据用户需求生成一张完整、清晰、适合国内电商平台展示的商品主图。';
  return [
    ECOMMERCE_IMAGE_SYSTEM_PROMPT,
    referenceRule,
    `用户需求：${prompt || '生成一张电商商品主图'}`,
    '最终目标：输出一张可直接用于商品主图测试的高质量电商图片。'
  ].join('\n');
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

function resolveImageRoute(body = {}) {
  const requested = String(body.imageRouteId || body.imageLineId || body.imageRouteKey || body.imageLineKey || body.routeId || body.lineId || body.routeKey || body.lineKey || '').trim();
  const routes = routeState();
  const imageRoutes = routes.filter(route => routeKind(route) === 'image');
  if (requested) {
    const found = routes.find(route => [route.id, route.routeId, route.lineId, route.rk, route.routeKey, route.lineKey, route.code].includes(requested));
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
  const list = kind === 'text' ? TXT : IMG;
  const fallback = kind === 'text' ? 5 : 15;
  const key = String(modelKey || '').trim();
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
  const text = [
    '你是电商视觉 Agent，请先分析用户上传的参考图和需求，再给图片生成模型输出最终提示词。',
    '必须输出 JSON 对象，不要 Markdown，不要额外解释。',
    'JSON 字段：analysisSummary（给用户看的简短中文分析，80-160字）、finalPrompt（交给 GPT Image 2 的完整中文生图提示词）。',
    '分析要求：识别参考图中的产品主体、包装结构、品牌/Logo/产品名、关键文字、颜色、材质、构图、背景和风格。',
    '生成要求：保持产品外观、包装结构、品牌识别、颜色和关键文字一致；只根据用户需求调整标签设计、背景、构图、光影和电商表现。',
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
    ? `已分析 ${referenceCount} 张参考图，将保留产品外观、包装结构、品牌识别、颜色和关键文字，并按用户需求调整画面风格。`
    : '未提供参考图，将按用户需求构建清晰的电商产品画面。';
  return {
    analysisSummary: `${imageLine} 生成结果会优先保证主体清晰、商业摄影质感和电商转化表现。`,
    finalPrompt: [
      referenceCount > 0 ? `参考图共 ${referenceCount} 张，请严格保持参考图中的产品主体、包装结构、品牌 Logo、产品名、颜色和材质。` : '根据用户需求生成电商产品主图。',
      `用户需求：${target}`,
      '画面要求：商品主体清晰，构图稳定，商业摄影级光影，背景干净高级，真实自然，适合国内电商主图或详情页使用。',
      '负面约束：不要乱码、水印、二维码、畸形产品、多余主体、虚构价格、虚构认证或不存在的促销信息。'
    ].join('\n')
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
        fileName: firstString(item.fileName, item.filename, item.name, item.title),
        mimeType: firstString(item.mimeType, item.mime, item.type)
      };
    })
    .filter(item => item && (item.url || item.dataUrl));
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
  const model = options.model || reqBodyModel(options) || AI_TEXT_MODEL;
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

async function callProviderResponses(input, options = {}) {
  const status = options.status || routeProviderStatus(options.route, 'text');
  const timeoutMs = positiveNumber(options.timeoutMs, status.timeoutMs || PROVIDER_TIMEOUT_MS);
  const requestStatus = { ...status, timeoutMs };
  const model = options.model || AI_TEXT_MODEL;
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
    const requestUrl = joinProviderUrl(requestStatus.baseUrl, routeTextEndpoint(options.route));
    const resp = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerAuthKey('text', options.route)}`
      },
      body: JSON.stringify({ model, input }),
      signal: controller.signal
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        success: false,
        code: 'PROVIDER_RESPONSES_FAILED',
        message: data.message || data.error?.message || `Provider returned ${resp.status}`,
        provider: requestStatus,
        upstreamStatus: resp.status,
        upstream: data
      };
    }
    return { success: true, provider: requestStatus, ...data };
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

async function callProviderImageGeneration(prompt, options = {}) {
  const status = options.status || routeProviderStatus(options.route, 'image');
  const model = options.model || options.modelKey || AI_IMAGE_MODEL;
  const count = Math.max(1, Math.min(Number(options.n || options.count || options.imageCount || 1) || 1, 4));
  const size = providerImageSize(options.size || options.ratio || options.aspectRatio);
  const quality = providerImageQuality(options.quality);
  const outputFormat = providerImageOutputFormat(options.output_format || options.outputFormat);
  if (!status.enabled) {
    return {
      success: true,
      mock: true,
      provider: status,
      images: Array.from({ length: count }, (_, i) => ({ url: placeholderUrl(`${prompt} ${i + 1}`) }))
    };
  }

  try {
    const images = [];
    const upstream = [];
    for (let i = 0; i < count; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), status.imageTimeoutMs || status.timeoutMs);
      try {
        const requestUrl = joinProviderUrl(status.baseUrl, routeImageGenerationEndpoint(options.route));
        const resp = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${providerAuthKey('image', options.route)}`
          },
          body: JSON.stringify({
            model,
            prompt,
            size,
            quality,
            output_format: outputFormat,
            response_format: 'url',
            n: 1
          }),
          signal: controller.signal
        });
        const contentType = resp.headers.get('content-type') || '';
        const data = await resp.json().catch(() => ({}));
        upstream.push({ status: resp.status, contentType, data });
        if (!resp.ok) {
          return {
            success: false,
            code: 'PROVIDER_IMAGE_FAILED',
            message: data.message || data.error?.message || `Provider returned ${resp.status}`,
            provider: status,
            upstreamStatus: resp.status,
            upstream: data
          };
        }
        const rawImages = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.images)
            ? data.images
            : Array.isArray(data.results)
              ? data.results
              : [];
        rawImages
          .map((item) => {
            const raw = item && typeof item === 'object' ? item : { url: item };
            return raw.url || raw.imageUrl || raw.image_url || raw.b64_json || raw.b64Json
              ? { ...raw, index: images.length }
              : null;
          })
          .filter(Boolean)
          .forEach((item) => images.push(item));
      } finally {
        clearTimeout(timer);
      }
    }
    if (!images.length) {
      return {
        success: false,
        code: 'PROVIDER_IMAGE_EMPTY',
        message: upstream.some(item => item.contentType && !String(item.contentType).toLowerCase().includes('json'))
          ? 'Provider 返回的不是 JSON，请检查 Base URL 和图片接口路径是否包含 /v1'
          : 'Provider 没有返回有效图片',
        provider: status,
        upstream
      };
    }
    return { success: true, mock: false, provider: status, images, upstream, request: { model, size, quality, output_format: outputFormat, response_format: 'url', n: 1, requestedCount: count } };
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
  const model = options.model || options.modelKey || AI_IMAGE_MODEL;
  const count = Math.max(1, Math.min(Number(options.n || options.count || options.imageCount || 1) || 1, 4));
  const size = providerImageSize(options.size || options.ratio || options.aspectRatio);
  const quality = providerImageQuality(options.quality);
  const outputFormat = providerImageOutputFormat(options.output_format || options.outputFormat);
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
    const imageFile = await loadReferenceImageFile(references[0], options.req);
    const maskSource = options.mask || options.maskUrl || options.body?.mask || options.body?.maskUrl || options.body?.maskBase64 || '';
    const maskFile = maskSource
      ? await loadReferenceImageFile({ url: maskSource, dataUrl: maskSource }, options.req)
      : null;
    const images = [];
    const upstream = [];
    for (let i = 0; i < count; i += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), status.imageTimeoutMs || status.timeoutMs);
      try {
        const form = new FormData();
        form.append('model', model);
        form.append('prompt', prompt);
        form.append('size', size);
        form.append('quality', quality);
        form.append('output_format', outputFormat);
        form.append('response_format', 'url');
        form.append('n', '1');
        form.append('image', new Blob([imageFile.buffer], { type: imageFile.mime }), imageFile.fileName);
        if (maskFile) form.append('mask', new Blob([maskFile.buffer], { type: maskFile.mime }), maskFile.fileName);
        const requestUrl = joinProviderUrl(status.baseUrl, routeImageEditEndpoint(options.route));
        const resp = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${providerAuthKey('image', options.route)}`
          },
          body: form,
          signal: controller.signal
        });
        const contentType = resp.headers.get('content-type') || '';
        const data = await resp.json().catch(() => ({}));
        upstream.push({ status: resp.status, contentType, data });
        if (!resp.ok) {
          return {
            success: false,
            code: 'PROVIDER_IMAGE_EDIT_FAILED',
            message: data.message || data.error?.message || `Provider returned ${resp.status}`,
            provider: status,
            upstreamStatus: resp.status,
            upstream: data
          };
        }
        const rawImages = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.images)
            ? data.images
            : Array.isArray(data.results)
              ? data.results
              : [];
        rawImages
          .map((item) => {
            const raw = item && typeof item === 'object' ? item : { url: item };
            return raw.url || raw.imageUrl || raw.image_url || raw.b64_json || raw.b64Json
              ? { ...raw, index: images.length }
              : null;
          })
          .filter(Boolean)
          .forEach((item) => images.push(item));
      } finally {
        clearTimeout(timer);
      }
    }
    if (!images.length) {
      return {
        success: false,
        code: 'PROVIDER_IMAGE_EDIT_EMPTY',
        message: upstream.some(item => item.contentType && !String(item.contentType).toLowerCase().includes('json'))
          ? 'Provider 返回的不是 JSON，请检查 Base URL 和图生图接口路径是否包含 /v1'
          : 'Provider 没有返回有效图片',
        provider: status,
        upstream
      };
    }
    return { success: true, mock: false, provider: status, editMode: true, images, upstream, request: { model, size, quality, output_format: outputFormat, response_format: 'url', n: 1, requestedCount: count, referenceImageCount: references.length } };
  } catch (err) {
    return {
      success: false,
      code: err.name === 'AbortError' ? 'PROVIDER_IMAGE_EDIT_TIMEOUT' : 'PROVIDER_IMAGE_EDIT_ERROR',
      message: err.name === 'AbortError' ? 'Provider 图生图超时' : (err.message || 'Provider 图生图失败'),
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
function fmt(m, route = RTS[0]) {
  const kind = routeKind(route);
  const mid = m.k.replace(/[.-]/g,'_');
  const routeId = route && route.id ? route.id : 'pub_route_64f93e01e8f3';
  const routeKey = route && route.rk ? route.rk : 'route_6789';
  return {
    id:`pub_model_${mid}`,modelId:`pub_model_${mid}`,key:m.k,name:m.n,modelName:m.n,modelKey:m.k,realName:m.k,realModelName:m.k,
    publicModelId:`pub_model_${mid}`,defaultModelId:`pub_model_${mid}`,providerModelId:m.k,
    routeId,lineId:routeId,routeKey,lineKey:routeKey,routeName:route && route.dn ? route.dn : '6789',
    frontendModelKey:m.k,modelFamilyKey:m.k,clarityOverride:'',imageSizeOverride:'',
    displayName:m.n,label:m.n,price:m.p,pointCost:m.p,pricePoints:m.p,baseCredits:m.p,modelType:kind,type:kind,group:kind,category:kind,enabled:true,status:'active',
    qualities:m.q||['1k'],defaultParams:{size:'1x1',quality:'standard',clarity:'1k'},
    variants:[{id:`pub_model_${mid}`,modelId:`pub_model_${mid}`,modelKey:m.k,key:m.k,realName:m.k,realModelName:m.k,displayName:m.n,label:m.n,clarity:'1k',routeId,lineId:routeId,routeKey,lineKey:routeKey}]
  };
}
function routePayload(route = RTS[0]) {
  const kind = routeKind(route);
  const sourceModels = kind === 'text' ? TXT : IMG;
  const defaultRaw = sourceModels.find(m => m.k === route.dm || m.n === route.dm) || sourceModels[0];
  const models = sourceModels.map(m => fmt(m, route));
  const defaultModel = fmt(defaultRaw, route);
  const id = route.id || route.routeId || route.lineId || route.rk || uid('route_');
  const key = route.rk || route.routeKey || route.lineKey || route.code || id;
  const name = route.name || route.dn || route.displayName || key;
  const displayName = route.displayName || route.routeDisplayName || route.dn || name;
  const officialRoute = RTS.find(item =>
    [item.id, item.rk].includes(id) ||
    [item.id, item.rk].includes(key) ||
    (item.dm && item.dm === route.dm)
  );
  const officialExamples = Array.isArray(officialRoute && officialRoute.requestExamples)
    ? officialRoute.requestExamples
    : null;
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
    defaultModelId: defaultModel.modelId,
    defaultModelKey: defaultModel.modelKey,
    defaultModelRealName: defaultModel.realName,
    defaultModelDisplayName: defaultModel.displayName,
    apiKey: maskSecret(route.apiKey),
    hasApiKey: hasStoredSecret(route.apiKey),
    apiFormat: route.apiFormat || officialRoute?.apiFormat || '',
    requestFormat: route.requestFormat || route.apiFormat || officialRoute?.requestFormat || '',
    endpoint: route.endpoint || route.requestPath || officialRoute?.endpoint || '',
    requestPath: route.requestPath || route.endpoint || officialRoute?.endpoint || '',
    requestBodyExample: route.requestBodyExample || (officialExamples ? officialExamples[0].body : null),
    requestExamples: officialExamples || (Array.isArray(route.requestExamples) ? route.requestExamples : []),
    models
  };
}
function filteredRoutes(group) {
  const g = String(group || '').toLowerCase();
  return routeState()
    .filter(r => !g || routeKind(r) === g || String(r.g || r.cat || '').toLowerCase() === g)
    .map(routePayload);
}
function san(u) {
  return {id:u.id,username:u.username,email:u.email,emailVerified:true,role:u.role,
    status:u.status,balance:u.balance,credits:u.balance,
    avatarUrl:u.avatar_url||'',avatar_url:u.avatar_url||'',
    avatarType:'preset',avatar_type:'preset',createdAt:u.created_at,lastLoginAt:u.last_login_at};
}

// ===================== AUTH ROUTES =====================
app.post('/api/auth/register', (req, res) => {
  const { username, email, password, code } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: '缺少必填字段' });
  if (db.prepare('SELECT id FROM users WHERE username=?').get(username)) return res.status(400).json({ message: '用户名已存在' });
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(400).json({ message: '邮箱已注册' });
  const saved = db.prepare('SELECT * FROM email_codes WHERE email=? AND type=? ORDER BY created_at DESC LIMIT 1').get(email,'register');
  if (!saved || saved.code !== code || Date.now() > saved.expires_at) return res.status(400).json({ message: '验证码错误或已过期' });
  db.prepare('DELETE FROM email_codes WHERE email=? AND type=?').run(email,'register');
  const id = uid('user_');
  db.prepare('INSERT INTO users (id,username,email,password_hash,role,balance) VALUES (?,?,?,?,?,?)').run(id,username,email,h(password),'user',50);
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)').run(id,'register_gift',50,0,50,'注册赠送 50 算力');
  const token = jwt.sign({ userId: id, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: san(db.prepare('SELECT * FROM users WHERE id=?').get(id)) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: '请输入账号和密码' });
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user || user.password_hash !== h(password)) return res.status(401).json({ message: '账号或密码不正确' });
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

app.post('/api/auth/send-reset-code', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: '邮箱不能为空' });
  const code = rcode();
  db.prepare('INSERT INTO email_codes (email,code,type,expires_at,created_at) VALUES (?,?,?,?,?)').run(email,code,'reset',Date.now()+300000,Date.now());
  console.log(`[RESET] ${email} -> ${code}`);
  res.json({ message: '如果该邮箱已注册，验证码将发送到邮箱', cooldown: 60, expiresIn: 300 });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, password, newPassword } = req.body;
  const nextPassword = password || newPassword;
  if (!email || !code || !nextPassword) return res.status(400).json({ message: '缺少邮箱、验证码或新密码' });
  const saved = db.prepare('SELECT * FROM email_codes WHERE email=? AND type=? ORDER BY created_at DESC LIMIT 1').get(email,'reset');
  if (!saved || saved.code !== code || Date.now() > saved.expires_at) return res.status(400).json({ message: '验证码错误或已过期' });
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user) return res.status(404).json({ message: '该邮箱未注册' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(h(nextPassword), user.id);
  db.prepare('DELETE FROM email_codes WHERE email=? AND type=?').run(email,'reset');
  res.json({ success: true, message: '密码已重置' });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: '请输入管理员账号和密码' });
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user || user.password_hash !== h(password)) return res.status(401).json({ message: '账号或密码不正确' });
  if (user.role !== 'admin') return res.status(403).json({ message: '当前账号不是管理员' });
  db.prepare("UPDATE users SET last_login_at=datetime('now') WHERE id=?").run(user.id);
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: san(user) });
});

// ===================== PUBLIC ROUTES =====================
app.get('/api/public/routes', (req, res) => res.json({ items: filteredRoutes(req.query.group || 'image') }));
app.get('/api/public/models', (req, res) => {
  const rid = req.query.routeId || req.query.lineId || req.query.routeKey || req.query.lineKey;
  const routes = routeState();
  const rt = routes.find(r=>[r.id,r.rk].includes(rid)) || routes[0] || RTS[0];
  res.json({ items: (rt&&rt.cat==='text'?TXT:IMG).map(m=>fmt(m, rt)) });
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
  const rid = req.query.routeId || req.query.lineId || req.query.routeKey || req.query.lineKey || 'pub_route_64f93e01e8f3';
  const routes = routeState();
  const rt = routes.find(r=>[r.id,r.rk].includes(rid)) || routes[0] || RTS[0];
  res.json({ success: true, data: (rt&&rt.cat==='text'?TXT:IMG).map(m=>fmt(m, rt)) });
});
app.get('/api/user/api-status', optionalAuth, (req, res) => {
  const rt = routeState()[0] || RTS[0];
  res.json({ success: true, status: 'active', mode: 'auto', mock: !req.user,
    provider: { id:rt.id, routeId:rt.id, lineId:rt.id, routeKey:rt.rk, lineKey:rt.rk, name:rt.dn, displayName:rt.dn,
      defaultImageModel:'GPT Image 2', models: IMG.map(m=>fmt(m, rt)), supportsChat:true, supportsImage:true }
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
  const items = ps.map(p=>({id:p.id,name:p.name,thumbnail:p.data?JSON.parse(p.data).thumbnail||'':'',updatedAt:p.updated_at,createdAt:p.created_at}));
  res.json({ success: true, items, projects: items, list: items, data: items, total: items.length });
});
app.post('/api/user/projects', auth, (req, res) => {
  const { name } = req.body;
  const id = uid('proj_');
  db.prepare('INSERT INTO projects (id,user_id,name,data) VALUES (?,?,?,?)').run(id, req.user.userId, name||'未命名项目', '{}');
  const project = { id, name: name||'未命名项目', data: {}, createdAt: new Date().toISOString() };
  res.json({ success: true, ...project, project });
});
app.get('/api/user/projects/:id', auth, (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p || p.user_id !== req.user.userId) return res.status(404).json({ message: '项目不存在' });
  const project = { id:p.id, name:p.name, data: JSON.parse(p.data||'{}'), createdAt:p.created_at, updatedAt:p.updated_at };
  res.json({ success: true, ...project, project });
});
app.put('/api/user/projects/:id', auth, (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if (!p || p.user_id !== req.user.userId) return res.status(404).json({ message: '项目不存在' });
  db.prepare("UPDATE projects SET name=?, data=?, updated_at=datetime('now') WHERE id=?").run(req.body.name||p.name, JSON.stringify(req.body.data||{}), req.params.id);
  res.json({ success: true, id: req.params.id, name: req.body.name||p.name, data: req.body.data||{} });
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

app.post('/api/generation/estimate-cost', optionalAuth, (req, res) => {
  const modelKey = req.body.modelKey || req.body.model || req.body.realName || req.body.realModelName || req.body.imageModelKey || IMG[0].k;
  const imageCount = Number(req.body.imageCount || req.body.count || req.body.n || 1) || 1;
  const all = [...IMG, ...TXT];
  const m = all.find(x=>x.k===modelKey) || all.find(x=>modelKey.startsWith(x.k)) || IMG[0];
  const cost = m ? m.p : 15;
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

app.get('/api/proxy-image', async (req, res) => {
  const rawUrl = String(req.query.url || '').trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    return res.status(400).json({ success: false, code: 'IMAGE_PROXY_BAD_URL', message: '图片地址无效' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetch(rawUrl, {
      headers: { 'User-Agent': 'hjm-mb-clone/1.0' },
      signal: controller.signal
    });
    if (!upstream.ok) {
      return res.status(502).json({ success: false, code: 'IMAGE_PROXY_UPSTREAM_FAILED', message: `图片代理读取失败：${upstream.status}` });
    }
    const contentType = upstream.headers.get('content-type') || 'image/png';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return res.status(415).json({ success: false, code: 'IMAGE_PROXY_NOT_IMAGE', message: '上游地址不是图片内容' });
    }
    const arrayBuffer = await upstream.arrayBuffer();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(502).json({
      success: false,
      code: err.name === 'AbortError' ? 'IMAGE_PROXY_TIMEOUT' : 'IMAGE_PROXY_ERROR',
      message: err.name === 'AbortError' ? '图片代理读取超时' : (err.message || '图片代理读取失败')
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
  if (/^https?:\/\//i.test(value)) return `/api/proxy-image?url=${encodeURIComponent(value)}`;
  return value;
}
function normalizeTaskImage(item, idx, taskId) {
  const raw = item && typeof item === 'object' ? item : { url: item };
  const url = raw.url || raw.imageUrl || raw.image_url || raw.b64_json || raw.b64Json || placeholderUrl(taskId);
  const normalizedUrl = /^data:image\//i.test(url) || /^https?:\/\//i.test(url) || url.startsWith('/') ? url : `data:image/png;base64,${url}`;
  const finalUrl = imageDisplayUrl(normalizedUrl);
  return { ...raw, id: raw.id || `${taskId}_${idx}`, url: finalUrl, imageUrl: finalUrl, preview: finalUrl, originalUrl: normalizedUrl };
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
    errorMessage: task.errorMessage || '',
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
    meta: {
      ...(img.meta || {}),
      operation: source.operation || 'generation',
      prompt,
      finalPrompt: source.finalPrompt || prompt,
      analysisSummary: source.analysisSummary || '',
      modelKey,
      source: source.source || 'generation-task'
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
    images,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  tasks.set(taskId, task);
  images.forEach(img => {
    db.prepare('INSERT INTO generations (id,user_id,model_key,prompt,result_url,cost,status) VALUES (?,?,?,?,?,?,?)')
      .run(uid('gen_'), req.user.userId, modelKey, prompt, img.url, cost / imageCount, 'completed');
  });
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
    erase: '请根据原图上下文，只重绘 mask 白色区域，移除涂抹区域内的对象并自然补全背景。未涂抹区域必须保持不变。',
    text_edit: '请只重绘 mask 白色区域内的文字或排版，按用户提示替换文字内容、字体、颜色和版式。未涂抹区域必须保持不变。',
    outpaint: '请基于原图自然扩展画面，保持主体、透视、材质、光线、商品包装和整体电商视觉风格一致。原图主体不得变形，新增区域需要自然补全背景。'
  };
  const base = baseByType[type] || '请根据用户提示和参考图，只重绘 mask 白色区域。未涂抹区域必须保持不变，产品包装、主体结构、文字和品牌识别尽量保持一致。';
  const fallbackByType = {
    erase: '自然消除涂抹区域',
    text_edit: '按涂抹区域修改文字',
    outpaint: '自然扩展画布背景'
  };
  return `${base}\n用户提示：${userPrompt || fallbackByType[type] || '按涂抹区域进行局部修改'}`;
}

function imageToolOutputText(data = {}) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  if (typeof data.outputText === 'string' && data.outputText.trim()) return data.outputText.trim();
  if (typeof data.text === 'string' && data.text.trim()) return data.text.trim();
  if (typeof data.content === 'string' && data.content.trim()) return data.content.trim();
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (typeof item === 'string' && item.trim()) return item.trim();
      if (typeof item?.content === 'string' && item.content.trim()) return item.content.trim();
      if (Array.isArray(item?.content)) {
        const text = item.content.map(part => part?.text || part?.content || '').join('').trim();
        if (text) return text;
      }
    }
  }
  const choiceText = data.choices?.[0]?.message?.content || data.choices?.[0]?.text;
  if (typeof choiceText === 'string' && choiceText.trim()) return choiceText.trim();
  return '';
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
    const mask = firstString(req.body.maskBase64, req.body.mask, req.body.maskUrl);
    if (!references.length) return res.status(400).json({ success: false, code: 'IMAGE_TOOL_IMAGE_REQUIRED', message: '缺少待处理图片' });
    if (!mask) return res.status(400).json({ success: false, code: 'IMAGE_TOOL_MASK_REQUIRED', message: '请先涂抹需要处理的区域' });

    const route = resolveRequestImageRoute(req.body);
    const model = resolveImageModelKey(req.body);
    const requestedType = String(req.body.type || req.body.operation || type).trim();
    const operationType = requestedType === 'text_edit' && type === 'inpaint' ? 'text_edit' : type;
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
    res.json(makeImageToolResponse(providerResult, req.body, operationType));
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

    const task = createCompletedTask(req, {
      prompt,
      modelKey: model,
      imageCount: 1,
      results: providerResult.images
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

    const route = resolveRequestImageRoute(req.body);
    const model = String(req.body.textModel || req.body.model || AI_TEXT_MODEL || 'gpt-5.5').trim();
    const input = [
      '请根据下面这张电商图片，反推出适合文生图或图生图使用的中文提示词。',
      '输出一段完整提示词，包含主体、构图、光线、材质、背景、文字/包装要点、画面风格和电商转化重点。',
      '不要输出解释，不要输出列表标题。',
      `图片地址：${imageUrl}`
    ].join('\n');
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
      textEdit: { enabled: true, mode: 'image-edit' },
      compress: { enabled: true, mode: 'local' },
      resize: { enabled: true, mode: 'local' },
      crop: { enabled: true, mode: 'local' },
      upscale: { enabled: false, mode: 'planned' },
      removeBg: { enabled: false, mode: 'planned' }
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
  const model = String(req.body.textModel || req.body.model || route?.dm || AI_TEXT_MODEL || 'gpt-5.5').trim();
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
  const imageRoute = resolveImageRoute(body);
  const textModel = String(body.textModel || body.textModelKey || textRoute?.dm || AI_TEXT_MODEL || 'gpt-5.5').trim();
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
        ? `GPT 5.5 分析超时（已等待 ${Math.round(CANVAS_DIALOG_ANALYSIS_TIMEOUT_MS / 1000)} 秒），请稍后重试或减少参考图/提示词长度`
        : (textResult.message || 'GPT 5.5 分析失败，请稍后重试'),
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
  if (!agentPlan || !agentPlan.finalPrompt) {
    return res.status(502).json({
      success: false,
      code: 'CANVAS_DIALOG_ANALYSIS_BAD_RESPONSE',
      message: 'GPT 5.5 未返回可用的生图提示词，请稍后重试',
      provider: textResult.provider,
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
  const imageResult = hasReferenceImages
    ? await callProviderImageEdit(agentPlan.finalPrompt, providerOptions)
    : await callProviderImageGeneration(agentPlan.finalPrompt, providerOptions);
  if (!imageResult.success) {
    return res.status(502).json({
      success: false,
      code: imageResult.code || 'CANVAS_DIALOG_IMAGE_FAILED',
      message: imageResult.message || 'GPT Image 2 生图失败，请稍后重试',
      provider: imageResult.provider,
      analysisSummary: agentPlan.analysisSummary,
      finalPrompt: agentPlan.finalPrompt,
      analysisCost,
      imageCost,
      totalCost
    });
  }

  const task = createCompletedTask(req, {
    prompt: agentPlan.finalPrompt,
    finalPrompt: agentPlan.finalPrompt,
    analysisSummary: agentPlan.analysisSummary,
    modelKey: imageModel,
    imageCount,
    results: imageResult.images,
    cost: totalCost,
    totalCost,
    analysisCost,
    imageCost,
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

app.post('/api/generate/tasks', auth, async (req, res) => {
  const prompt = req.body.prompt || req.body.selectedPrompt || '';
  const modelKey = resolveImageModelKey(req.body);
  if (!prompt && !Array.isArray(req.body.referenceImages) && !Array.isArray(req.body.images)) {
    return res.status(400).json({ message: '请输入提示词或上传参考图' });
  }
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.userId);
  if (!u) return res.status(401).json({ success: false, code: 'AUTH_USER_NOT_FOUND', message: '登录状态已失效，请重新登录' });
  const m = [...IMG, ...TXT].find(x => x.k === modelKey) || IMG[0];
  const imageCount = Math.max(1, Math.min(Number(req.body.imageCount || req.body.n || 1) || 1, 4));
  const total = (m ? m.p : 15) * imageCount;
  if (u.balance < total) return res.status(400).json({ message: `算力不足，需要 ${total}，当前 ${u.balance}` });
  const hasReferenceImages = imageReferenceCandidates(req.body).length > 0;
  const providerPrompt = buildEcommerceImagePrompt(prompt, { hasReferenceImages });
  const providerOptions = { ...req.body, body: req.body, req, model: modelKey, n: imageCount };
  const providerResult = hasReferenceImages
    ? await callProviderImageEdit(providerPrompt, providerOptions)
    : await callProviderImageGeneration(providerPrompt, providerOptions);
  if (!providerResult.success) {
    return res.status(502).json({
      success: false,
      code: providerResult.code || 'PROVIDER_IMAGE_FAILED',
      message: providerResult.message || '图片生成接口调用失败',
      provider: providerResult.provider
    });
  }
  const task = createCompletedTask(req, { prompt: providerPrompt, modelKey, imageCount, results: providerResult.images });
  const nb = u.balance - total;
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(nb, u.id);
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)')
    .run(u.id,'generation',-total,u.balance,nb,`生成任务: ${modelKey} x${imageCount}`);
  res.json({ success: true, mock: !!providerResult.mock, editMode: !!providerResult.editMode, provider: providerResult.provider, ...makeTaskResponse(task) });
});
app.get('/api/generate/tasks/:id', auth, (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task || task.userId !== req.user.userId) return res.status(404).json({ message: '任务不存在' });
  res.json(makeTaskResponse(task));
});

app.post('/api/template/generate-image', auth, async (req, res) => {
  const prompt = pickTemplatePrompt(req.body);
  const modelKey = resolveImageModelKey(req.body);
  const imageCount = Number(req.body.imageCount || req.body.count || req.body.n || 1);
  const negativePrompt = req.body.negativePrompt || '';
  if (!prompt) return res.status(400).json({ message: '请输入提示词' });
  if (!modelKey) return res.status(400).json({ message: '请选择可用的图片模型' });

  const all = [...IMG, ...TXT];
  const m = all.find(x=>x.k===modelKey) || IMG[0];
  const cp = m ? m.p : 15;
  const cnt = Math.max(1, Math.min(imageCount || 1, 4));
  const total = cp * cnt;

  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.userId);
  if (!u) return res.status(401).json({ success: false, code: 'AUTH_USER_NOT_FOUND', message: '登录状态已失效，请重新登录' });
  if (u.balance < total) return res.status(400).json({ message: `算力不足，需要 ${total}，当前 ${u.balance}` });

  const fullPrompt = `${prompt}${negativePrompt ? '，避免：' + negativePrompt : ''}`;
  const hasReferenceImages = imageReferenceCandidates(req.body).length > 0;
  const providerPrompt = buildEcommerceImagePrompt(fullPrompt, { hasReferenceImages });
  const providerOptions = { ...req.body, body: req.body, req, model: modelKey, n: cnt };
  const providerResult = hasReferenceImages
    ? await callProviderImageEdit(providerPrompt, providerOptions)
    : await callProviderImageGeneration(providerPrompt, providerOptions);
  if (!providerResult.success) {
    return res.status(502).json({
      success: false,
      code: providerResult.code || 'PROVIDER_IMAGE_FAILED',
      message: providerResult.message || '图片生成接口调用失败',
      provider: providerResult.provider
    });
  }

  const results = providerResult.images;
  const task = createCompletedTask(req, { prompt: providerPrompt, modelKey, imageCount: cnt, results });
  const nb = u.balance - total;
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(nb, u.id);
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)').run(u.id,'generation',-total,u.balance,nb,`AI生图: ${modelKey} x${cnt}`);
  res.json({
    success: true,
    mock: !!providerResult.mock,
    editMode: !!providerResult.editMode,
    provider: providerResult.provider,
    results: task.images,
    resultImages: task.images,
    images: task.images,
    taskId: task.id,
    id: task.id,
    status: 'success',
    progress: 100,
    totalCost: total,
    remainingBalance: nb,
    prompt: providerPrompt,
    modelKey
  });
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
  const items = rows.map(row => ({
    ...row,
    id: row.id,
    url: row.result_url || row.resultUrl || '',
    imageUrl: row.result_url || row.resultUrl || '',
    resultUrl: row.result_url || row.resultUrl || '',
    result_url: row.result_url || '',
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
  }));
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

app.post('/api/chat/completions', auth, async (req, res) => {
  const { messages } = req.body;
  if (!messages) return res.status(400).json({ message: '缺少 messages' });
  const result = await callProviderChat(messages, req.body);
  if (!result.success) return res.status(502).json(result);
  res.json(result);
});

app.post('/api/user/preferences/api-provider', auth, (req, res) => {
  res.json({ success: true, mode: req.body.mode || 'auto' });
});
app.post('/api/user/preferences/api-route', auth, (req, res) => {
  res.json({ success: true, routeId: req.body.routeId || req.body.lineId || req.body.routeKey || '' });
});

// ===================== WORKFLOWS =====================
app.post('/api/workflows/:id/save-json', auth, (req, res) => {
  const id = String(req.params.id || req.body.id || uid('workflow_'));
  const name = req.body.name || req.body.title || '本地工作流';
  const data = req.body.data || req.body.workflow || req.body;
  const existing = db.prepare('SELECT id FROM projects WHERE id=? AND user_id=?').get(id, req.user.userId);
  if (existing) {
    db.prepare("UPDATE projects SET name=?, data=?, updated_at=datetime('now') WHERE id=? AND user_id=?")
      .run(name, JSON.stringify(data || {}), id, req.user.userId);
  } else {
    db.prepare('INSERT INTO projects (id,user_id,name,data) VALUES (?,?,?,?)')
      .run(id, req.user.userId, name, JSON.stringify(data || {}));
  }
  res.json({ success: true, id, workflowId: id, savedAt: new Date().toISOString() });
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
  return db.prepare('SELECT * FROM generations ORDER BY created_at DESC LIMIT ?').all(limit).map(row => ({
    id: row.id,
    taskId: row.id,
    userId: row.user_id,
    username: db.prepare('SELECT username FROM users WHERE id=?').get(row.user_id)?.username || 'local',
    lineKey: 'route_6789',
    routeId: 'pub_route_64f93e01e8f3',
    routeName: '6789',
    routeDisplayName: '6789',
    model: row.model_key,
    modelKey: row.model_key,
    modelDisplayName: row.model_key,
    resolvedModel: row.model_key,
    prompt: row.prompt,
    promptPreview: String(row.prompt || '').slice(0, 120),
    promptLength: String(row.prompt || '').length,
    resultUrl: row.result_url,
    imageUrl: row.result_url,
    status: row.status === 'completed' ? 'success' : (row.status || 'success'),
    progress: row.status === 'failed' ? 100 : 100,
    cost: row.cost || 0,
    costPoints: row.cost || 0,
    chargeStatus: '已扣费',
    imageCount: 1,
    size: '1024x1024',
    resolvedSize: '1024x1024',
    quality: 'standard',
    referenceImages: [],
    referenceImageCount: 0,
    referenceImageTotalSizeText: '0 KB',
    createdAt: row.created_at,
    updatedAt: row.created_at,
    finishedAt: row.created_at,
    errorMessage: ''
  }));
}
function mockOrders() {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 20').all();
  return users.map((u, i) => ({
    id: `order_${i + 1}`,
    orderNo: `HJM${String(i + 1).padStart(6, '0')}`,
    userId: u.id,
    username: u.username,
    email: u.email,
    amount: [19.9, 49, 99, 199][i % 4],
    credits: [200, 600, 1500, 4000][i % 4],
    payMethod: ['wechat', 'alipay', 'stripe'][i % 3],
    status: ['paid', 'pending', 'closed'][i % 3],
    createdAt: u.created_at,
    paidAt: i % 3 === 0 ? u.created_at : ''
  }));
}
function modelPriceRows() {
  const overrides = modelPriceState();
  const overrideMap = new Map(overrides.map(row => [row.id, row]));
  const baseRows = filteredRoutes().flatMap(route => route.models.map(model => {
    const id = `${route.id}:${model.modelKey}`;
    const override = overrideMap.get(id) || {};
    return {
      ...override,
      id,
      routeId: route.id,
      routeKey: route.routeKey,
      routeName: route.displayName,
      modelId: model.modelId,
      modelKey: model.modelKey,
      realName: model.realName,
      displayName: model.displayName,
      modelType: model.modelType,
      price: Number(override.price ?? override.pricePoints ?? model.pricePoints),
      pricePoints: Number(override.pricePoints ?? override.price ?? model.pricePoints),
      baseCredits: Number(override.baseCredits ?? model.baseCredits),
      enabled: override.enabled !== false,
      status: override.status || 'active',
      qualities: override.qualities || model.qualities || []
    };
  }));
  const baseIds = new Set(baseRows.map(row => row.id));
  return [
    ...baseRows,
    ...overrides.filter(row => !baseIds.has(row.id))
  ];
}

app.get('/api/admin/users', auth, admin, (req, res) => {
  const q = String(req.query.keyword || req.query.q || '').trim().toLowerCase();
  let users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(adminUserRow);
  if (q) users = users.filter(u => [u.username, u.email, u.role, u.status].some(v => String(v || '').toLowerCase().includes(q)));
  const payload = pageList(users, req);
  res.json({ ...payload, users: payload.items, success: true });
});
app.get('/api/admin/dashboard', auth, admin, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const totalGenerations = db.prepare('SELECT COUNT(*) as c FROM generations').get().c;
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
    todayNewUsers: totalUsers,
    todayOrderAmount: mockOrders().reduce((sum, o) => sum + (o.status === 'paid' ? Number(o.amount || 0) : 0), 0),
    totalGenerations,
    todayGenerations: totalGenerations,
    totalCredits,
    totalConsumedPoints: totalCost,
    totalCost,
    apiFailures: 0,
    activeUsers: db.prepare("SELECT COUNT(*) as c FROM users WHERE status='active'").get().c,
    routeCount: routeState().length,
    modelCount: IMG.length + TXT.length
  };
  const dashboardStats = {
    ...stats,
    userTotal: totalUsers,
    usersTotal: totalUsers,
    totalUserCount: totalUsers,
    todayUserCount: totalUsers,
    generationTotal: totalGenerations,
    consumedPoints: totalCost,
    consumedCredits: totalCost
  };
  res.json({
    success: true,
    summary: dashboardStats,
    stats: dashboardStats,
    cards: dashboardStats,
    recentTasks: generationRows(8),
    routes: filteredRoutes(),
    modelPrices: modelPriceRows().slice(0, 12),
    modelUsage: {
      totalCredits: totalCost,
      totalCount: totalGenerations,
      list: modelUsageList
    },
    routeUsage: {
      totalCredits: totalCost,
      totalCount: totalGenerations,
      list: filteredRoutes().map(route => ({
        routeId: route.id,
        routeKey: route.routeKey,
        routeName: route.displayName,
        totalCredits: Math.round(totalCost / Math.max(1, routeState().length) * 100) / 100,
        totalCount: Math.ceil(totalGenerations / Math.max(1, routeState().length)),
        successCount: Math.ceil(totalGenerations / Math.max(1, routeState().length)),
        failCount: 0
      }))
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
  const r = db.prepare('UPDATE users SET status=? WHERE id=?').run(status, req.params.id);
  if (!r.changes) return res.status(404).json({ message: '用户不存在' });
  res.json({ success: true, user: adminUserRow(db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id)) });
});
app.post('/api/admin/users/:id/balance', auth, admin, (req, res) => {
  const amount = Number(req.body.amount ?? req.body.changeAmount ?? 0);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  const next = user.balance + amount;
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(next, user.id);
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)')
    .run(user.id, 'admin_adjust', amount, user.balance, next, req.body.remark || '管理员调整余额');
  res.json({ success: true, user: adminUserRow(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
});
app.post('/api/admin/users/:id/security-check', auth, admin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  res.json({ success: true, riskLevel: 'low', checks: ['账号状态正常', '余额记录正常', '未发现异常登录'] });
});
app.post('/api/admin/users/:id/reset-password', auth, admin, (req, res) => {
  const password = req.body.password || 'admin123';
  const r = db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(h(password), req.params.id);
  if (!r.changes) return res.status(404).json({ message: '用户不存在' });
  res.json({ success: true, password });
});
app.delete('/api/admin/users/:id', auth, admin, (req, res) => {
  const r = db.prepare("UPDATE users SET status='deleted' WHERE id=?").run(req.params.id);
  if (!r.changes) return res.status(404).json({ message: '用户不存在' });
  res.json({ success: true });
});
app.get('/api/admin/recycle-bin/users', auth, admin, (req, res) => {
  const rows = db.prepare("SELECT * FROM users WHERE status='deleted' ORDER BY created_at DESC").all().map(adminUserRow);
  res.json({ ...pageList(rows, req), users: rows, success: true });
});
app.post('/api/admin/recycle-bin/users/:id/restore', auth, admin, (req, res) => {
  const r = db.prepare("UPDATE users SET status='active' WHERE id=?").run(req.params.id);
  res.json({ success: r.changes > 0 });
});
app.delete('/api/admin/recycle-bin/users/:id/permanent', auth, admin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  db.prepare("UPDATE users SET username=?, email=?, status='purged', avatar_url='' WHERE id=?")
    .run(`deleted_${Date.now()}`, `deleted_${Date.now()}@local`, req.params.id);
  res.json({ success: true });
});
app.get('/api/admin/orders', auth, admin, (req, res) => {
  const rows = mockOrders();
  res.json({ ...pageList(rows, req), orders: rows, success: true });
});
app.patch('/api/admin/orders/:id/status', auth, admin, (req, res) => {
  res.json({ success: true, id: req.params.id, status: req.body.status || 'paid' });
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
    requestFormat: req.body.requestFormat || req.body.apiFormat || '',
    endpoint: req.body.endpoint || req.body.requestPath || '',
    requestPath: req.body.requestPath || req.body.endpoint || '',
    requestBodyExample: req.body.requestBodyExample || null,
    requestExamples: Array.isArray(req.body.requestExamples) ? req.body.requestExamples : [],
    chatEndpoint: req.body.chatEndpoint || '',
    imageEndpoint: req.body.imageEndpoint || '',
    imageEditEndpoint: req.body.imageEditEndpoint || '',
    videoEndpoint: req.body.videoEndpoint || '',
    defaultTextModel: req.body.defaultTextModel || '',
    defaultImageModel: req.body.defaultImageModel || '',
    defaultVideoModel: req.body.defaultVideoModel || '',
    multiplier: Number(req.body.multiplier || req.body.rate || 1),
    remark: req.body.remark || req.body.note || ''
  };
  const routes = [...routeState(), rawRoute];
  saveRouteState(routes);
  const route = routePayload(rawRoute);
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
    return {
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
      chatEndpoint: route.chatEndpoint || '',
      imageEndpoint: route.imageEndpoint || '',
      imageEditEndpoint: route.imageEditEndpoint || '',
      videoEndpoint: route.videoEndpoint || '',
      defaultTextModel: route.defaultTextModel || '',
      defaultImageModel: route.defaultImageModel || '',
      defaultVideoModel: route.defaultVideoModel || '',
      multiplier: Number(route.multiplier || route.rate || 1),
      remark: route.remark || route.note || ''
    };
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
    updated = {
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
      chatEndpoint: req.body.chatEndpoint ?? route.chatEndpoint ?? '',
      imageEndpoint: req.body.imageEndpoint ?? route.imageEndpoint ?? '',
      imageEditEndpoint: req.body.imageEditEndpoint ?? route.imageEditEndpoint ?? '',
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
    };
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
      ? (kind === 'image' ? '图片线路连接正常，Packy Images API 已返回图片' : '文本线路连接正常，Responses API 已返回结果')
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
  res.json({ success: true, items: (route.cat === 'text' ? TXT : IMG).map(m => fmt(m, route)) });
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
  const route = findRouteByAnyId(req.params.id);
  const model = fmt({ k: req.body.modelKey || req.body.realName || 'custom-model', n: req.body.displayName || req.body.name || req.body.modelKey || 'Custom Model', p: Number(req.body.pricePoints || req.body.price || 10), q: req.body.qualities || ['1k'] }, route);
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
  const existing = rows.find(row => row.id === req.params.id) || { id: req.params.id };
  const item = { ...existing, ...req.body, id: req.params.id };
  const nextRows = modelPriceState().filter(row => row.id !== req.params.id);
  nextRows.push(item);
  saveModelPriceState(nextRows);
  res.json({ success: true, id: req.params.id, item });
});
app.patch('/api/admin/route-models/:id/enabled', auth, admin, (req, res) => {
  const rows = modelPriceRows();
  const existing = rows.find(row => row.id === req.params.id) || { id: req.params.id };
  const item = { ...existing, enabled: req.body.enabled !== false };
  const nextRows = modelPriceState().filter(row => row.id !== req.params.id);
  nextRows.push(item);
  saveModelPriceState(nextRows);
  res.json({ success: true, id: req.params.id, enabled: item.enabled });
});
app.delete('/api/admin/route-models/:id', auth, admin, (req, res) => {
  const nextRows = modelPriceState().filter(row => row.id !== req.params.id);
  saveModelPriceState(nextRows);
  res.json({ success: true, id: req.params.id });
});
app.get('/api/admin/generate-tasks', auth, admin, (req, res) => {
  const memoryTasks = Array.from(tasks.values()).map(task => ({
    ...makeTaskResponse(task),
    status: task.status === 'completed' ? 'success' : task.status,
    username: db.prepare('SELECT username FROM users WHERE id=?').get(task.userId)?.username || 'local',
    userId: task.userId,
    lineKey: 'route_6789',
    routeDisplayName: '6789',
    model: task.modelKey,
    modelDisplayName: task.modelKey,
    resolvedModel: task.modelKey,
    promptPreview: String(task.prompt || '').slice(0, 120),
    promptLength: String(task.prompt || '').length,
    imageCount: Array.isArray(task.images) ? task.images.length : 1,
    size: '1024x1024',
    resolvedSize: '1024x1024',
    quality: 'standard',
    chargeStatus: '已扣费',
    referenceImages: [],
    referenceImageCount: 0,
    referenceImageTotalSizeText: '0 KB',
    finishedAt: task.updatedAt
  }));
  const rows = [...memoryTasks, ...generationRows(100)];
  const filtered = String(req.query.status || '') === 'active'
    ? rows
    : rows.filter(row => !req.query.status || row.status === req.query.status);
  const summary = {
    total: filtered.length,
    pending: filtered.filter(t => t.status === 'pending').length,
    running: filtered.filter(t => t.status === 'running').length,
    success: filtered.filter(t => t.status === 'success').length,
    failed: filtered.filter(t => t.status === 'failed').length,
    queueMode: 'local-mock'
  };
  const payload = pageList(filtered, req);
  res.json({ success: true, ...payload, tasks: payload.items, summary });
});
app.post('/api/admin/generate-tasks/:id/cancel', auth, admin, (req, res) => {
  const task = tasks.get(req.params.id);
  if (task) {
    task.status = 'cancelled';
    task.errorMessage = req.body.reason || '管理员取消';
    task.updatedAt = new Date().toISOString();
  }
  res.json({ success: true, id: req.params.id, status: 'cancelled' });
});
app.delete('/api/admin/generate-tasks/:id', auth, admin, (req, res) => {
  tasks.delete(req.params.id);
  res.json({ success: true, id: req.params.id });
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
app.get('/api/admin/settings', auth, admin, (req, res) => {
  const settings = settingsState();
  res.json({ success: true, settings, data: settings, ...settings });
});
app.patch('/api/admin/settings', auth, admin, (req, res) => {
  const settings = saveSettingsState({ ...settingsState(), ...(req.body || {}) });
  res.json({ success: true, settings, data: settings, ...settings });
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
      logs: LOG_DIR
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
  res.status(err.status || 500).json({
    success: false,
    code: err.code || 'SERVER_ERROR',
    message: err.message || '服务器内部错误'
  });
});

// ===================== SPA FALLBACK =====================
const sourceAdminRoutes = [
  '/admin/login',
  '/admin/dashboard',
  '/admin/users',
  '/admin/recycle-bin',
  '/admin/generate-tasks',
  '/admin/logs',
  '/admin/orders',
  '/admin/redeem-codes',
  '/admin/model-prices',
  '/admin/api-providers',
  '/admin/template-workflows',
  '/admin/settings'
];

app.get(sourceAdminRoutes, (req, res) => {
  const sourceIndex = path.join(sourceFrontendDist, 'index.html');
  res.sendFile(fs.existsSync(sourceIndex) ? sourceIndex : path.join(__dirname, 'index.html'));
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ===================== START =====================
const existingAdmin = db.prepare('SELECT id FROM users WHERE username=?').get('admin');
if (!existingAdmin) {
  const aid = uid('user_');
  db.prepare('INSERT INTO users (id,username,email,password_hash,role,balance) VALUES (?,?,?,?,?,?)').run(aid,'admin','admin@local',h('admin123'),'admin',999999);
  console.log('[SETUP] admin / admin123');
} else {
  db.prepare('UPDATE users SET password_hash=?, role=?, status=?, balance=MAX(balance, 999999) WHERE username=?')
    .run(h('admin123'), 'admin', 'active', 'admin');
}

app.listen(PORT, () => {
  console.log(`\n哈吉米AI Clone running at http://localhost:${PORT}`);
  console.log(`Admin: admin / admin123\n`);
});

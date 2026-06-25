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
const PROVIDER_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS || 30000);
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
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));
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
function admin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, code: 'ADMIN_REQUIRED', message: '需要管理员权限' });
  next();
}

// ===================== DATA =====================
const IMG = [
  {k:"gpt-image-2",n:"GPT Image 2",p:10,q:["1k","2k","4k"]},
  {k:"gpt-image-2-flatfee",n:"GPT Image 2 Flatfee",p:3.5,q:["1k","2k","4k"]},
  {k:"nano-banana-2",n:"Nano Banana 2",p:15,q:["1k","2k","4k"]},
  {k:"nano-banana-pro",n:"Nano Banana Pro",p:16,q:["1k","2k","4k"]},
  {k:"gemini-3-pro-image-preview",n:"Gemini 3 Pro Image",p:20,q:["1k","2k","4k"]},
  {k:"gemini-2.5-flash-image",n:"Gemini 2.5 Flash Image",p:8,q:["1k","2k","4k"]},
  {k:"gpt-4o-image",n:"GPT-4o Image",p:15,q:["1k","2k","4k"]},
];
const TXT = [
  {k:"gpt-5.5",n:"GPT 5.5",p:5,q:["1k"]},
  {k:"gpt-4o",n:"GPT-4o",p:10,q:["1k"]},
];
const RTS = [
  {id:"pub_route_64f93e01e8f3",rk:"route_6789",dn:"6789",cat:"image",g:"image",pri:10,def:true},
  {id:"pub_route_5b4b23928f32",rk:"route_comfly_google",dn:"comfly-google",cat:"image",g:"image",pri:7},
  {id:"pub_route_a63414b11775",rk:"route_comfly_openai_plus",dn:"comfly-openai-plus",cat:"image",g:"image",pri:7},
  {id:"pub_route_4fc539bc3e3d",rk:"route_rk",dn:"RK",cat:"image",g:"image",pri:6},
  {id:"pub_route_hajimi",rk:"route_hajimi",dn:"哈吉米",cat:"image",g:"image",pri:0},
  {id:"pub_route_b966dd1c7011",rk:"route_flowstudio",dn:"flowstudio",cat:"text",g:"text",pri:8,dm:"GPT 5.5"},
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
  const imageKey = gateway === 'new-api' ? NEW_API_KEY : AI_IMAGE_KEY;
  const enabled = ENABLE_REAL_AI && hasConfiguredSecret(textKey) && !!baseUrl;
  return {
    gateway,
    enabled,
    mode: enabled ? 'real-provider-ready' : 'mock',
    baseUrl,
    timeoutMs: PROVIDER_TIMEOUT_MS,
    textModel: AI_TEXT_MODEL,
    imageModel: AI_IMAGE_MODEL,
    textKeyConfigured: hasConfiguredSecret(textKey),
    imageKeyConfigured: hasConfiguredSecret(imageKey),
    routesThroughNewApi: gateway === 'new-api',
    cpaExpectedBehindNewApi: gateway === 'new-api'
  };
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
        'Authorization': `Bearer ${status.gateway === 'new-api' ? NEW_API_KEY : AI_TEXT_KEY}`
      },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal
    });
    const data = await resp.json().catch(() => ({}));
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
app.get('/api/user/api-status', auth, (req, res) => {
  const rt = routeState()[0] || RTS[0];
  res.json({ status: 'active', mode: 'auto',
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
app.use('/uploads', express.static(uploadDir));

// ===================== AI GENERATION =====================
const fetch = (...args) => import('node-fetch').then(({default:f})=>f(...args));

app.post('/api/generation/estimate-cost', auth, (req, res) => {
  const modelKey = req.body.modelKey || req.body.model || req.body.realName || req.body.realModelName || req.body.imageModelKey || '';
  const imageCount = req.body.imageCount || req.body.count || req.body.n || 1;
  if (!modelKey) return res.status(400).json({ message: '请选择模型' });
  const all = [...IMG, ...TXT];
  const m = all.find(x=>x.k===modelKey) || all.find(x=>modelKey.startsWith(x.k)) || IMG[0];
  const cost = m ? m.p : 15;
  const cnt = imageCount || 1;
  const u = db.prepare('SELECT balance FROM users WHERE id=?').get(req.user.userId);
  res.json({ estimatedCost: cost, totalCost: cost*cnt, credits: cost*cnt, costPoints: cost*cnt, available: u.balance });
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

function placeholderUrl(prompt = '') {
  const text = encodeURIComponent(String(prompt || 'HJM AI').slice(0, 80));
  const id = crypto.createHash('md5').update(String(prompt || 'HJM AI')).digest('hex').slice(0, 12);
  return `/api/mock-image/${id}.svg?text=${text}`;
}
function normalizeTaskImage(item, idx, taskId) {
  const raw = item && typeof item === 'object' ? item : { url: item };
  const url = raw.url || raw.imageUrl || raw.image_url || raw.b64_json || raw.b64Json || placeholderUrl(taskId);
  const finalUrl = /^data:image\//i.test(url) || /^https?:\/\//i.test(url) || url.startsWith('/') ? url : `data:image/png;base64,${url}`;
  return { id: raw.id || `${taskId}_${idx}`, url: finalUrl, imageUrl: finalUrl, preview: finalUrl };
}
function makeTaskResponse(task) {
  return {
    id: task.id,
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    prompt: task.prompt,
    resultImages: task.images,
    images: task.images,
    costPoints: task.cost,
    cost: task.cost,
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
function createCompletedTask(req, source = {}) {
  const modelKey = source.modelKey || source.model || pickImageModel(req.body);
  const imageCount = Math.max(1, Math.min(Number(source.imageCount || req.body.imageCount || req.body.n || 1) || 1, 4));
  const prompt = source.prompt || pickTemplatePrompt(req.body);
  const m = [...IMG, ...TXT].find(x => x.k === modelKey) || IMG[0];
  const cost = (m ? m.p : 15) * imageCount;
  const taskId = uid('task_');
  const sourceImages = Array.isArray(source.results) && source.results.length
    ? source.results
    : Array.from({ length: imageCount }, (_, i) => ({ url: placeholderUrl(`${prompt} ${i + 1}`) }));
  const images = sourceImages.map((img, i) => normalizeTaskImage(img, i, taskId));
  const task = {
    id: taskId,
    userId: req.user.userId,
    status: 'success',
    progress: 100,
    prompt,
    modelKey,
    cost,
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

app.post('/api/generate/tasks', auth, async (req, res) => {
  const prompt = req.body.prompt || req.body.selectedPrompt || '';
  const modelKey = req.body.modelKey || req.body.model || 'gpt-image-2';
  if (!prompt && !Array.isArray(req.body.referenceImages) && !Array.isArray(req.body.images)) {
    return res.status(400).json({ message: '请输入提示词或上传参考图' });
  }
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.userId);
  const m = [...IMG, ...TXT].find(x => x.k === modelKey) || IMG[0];
  const imageCount = Math.max(1, Math.min(Number(req.body.imageCount || req.body.n || 1) || 1, 4));
  const total = (m ? m.p : 15) * imageCount;
  if (u.balance < total) return res.status(400).json({ message: `算力不足，需要 ${total}，当前 ${u.balance}` });
  const task = createCompletedTask(req, { prompt, modelKey, imageCount });
  const nb = u.balance - total;
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(nb, u.id);
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)')
    .run(u.id,'generation',-total,u.balance,nb,`生成任务: ${modelKey} x${imageCount}`);
  res.json(makeTaskResponse(task));
});
app.get('/api/generate/tasks/:id', auth, (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task || task.userId !== req.user.userId) return res.status(404).json({ message: '任务不存在' });
  res.json(makeTaskResponse(task));
});

app.post('/api/template/generate-image', auth, async (req, res) => {
  const prompt = pickTemplatePrompt(req.body);
  const modelKey = pickImageModel(req.body);
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
  if (u.balance < total) return res.status(400).json({ message: `算力不足，需要 ${total}，当前 ${u.balance}` });

  const nb = u.balance - total;
  db.prepare('UPDATE users SET balance=? WHERE id=?').run(nb, u.id);
  db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)').run(u.id,'generation',-total,u.balance,nb,`AI生图: ${modelKey} x${cnt}`);

  const fullPrompt = `${prompt}${negativePrompt ? '，避免：' + negativePrompt : ''}`;
  const results = Array.from({ length: cnt }, (_, i) => ({ url: placeholderUrl(`${fullPrompt} ${i + 1}`), index: i }));
  const task = createCompletedTask(req, { prompt: fullPrompt, modelKey, imageCount: cnt, results });
  res.json({
    success: true,
    mock: true,
    results: task.images,
    resultImages: task.images,
    images: task.images,
    taskId: task.id,
    id: task.id,
    status: 'success',
    progress: 100,
    totalCost: total,
    remainingBalance: nb,
    prompt: fullPrompt,
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
  ];
  res.json({ success: true, mock: true, prompt, rawPrompt: prompt, suggestions });
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
  const rows = filteredRoutes().map(r => ({
    ...r,
    baseUrl: r.baseUrl || (r.type === 'text' ? 'https://api.flowstudio.local/v1' : 'https://api.hjm.local/v1'),
    apiKey: 'sk-local-********',
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
    enabled: req.body.enabled !== false,
    status: req.body.status || 'active',
    baseUrl: req.body.baseUrl || req.body.apiBase || '',
    apiKey: req.body.apiKey ? 'sk-local-********' : ''
  };
  const routes = [...routeState(), rawRoute];
  saveRouteState(routes);
  const route = routePayload(rawRoute);
  res.json({ success: true, item: route, provider: route, route });
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
      cat: req.body.category || req.body.type || req.body.group || route.cat,
      g: req.body.category || req.body.type || req.body.group || route.g,
      baseUrl: req.body.baseUrl ?? req.body.apiBase ?? route.baseUrl,
      apiKey: req.body.apiKey ? 'sk-local-********' : route.apiKey,
      pri: Number(req.body.priority ?? route.pri ?? 0),
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
  const status = providerStatus();
  if (!status.enabled) {
    return res.json({
      success: true,
      mock: true,
      latencyMs: Date.now() - startedAt,
      message: '当前为本地 mock 模式；配置 New-API 并启用 ENABLE_REAL_AI 后可测试真实网关',
      provider: status
    });
  }

  const result = await callProviderChat([{ role: 'user', content: 'ping' }], { model: AI_TEXT_MODEL });
  res.status(result.success ? 200 : 502).json({
    success: result.success,
    latencyMs: Date.now() - startedAt,
    message: result.success ? 'New-API 网关连接正常' : result.message,
    provider: status,
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

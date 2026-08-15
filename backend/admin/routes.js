'use strict';

function registerAdminRoutes(app, options = {}) {
  const auth = options.auth;
  const admin = options.admin;
  const db = options.db;
  const uid = options.uid;
  const h = options.h;
  const san = options.san;
  const jwt = options.jwt;
  const jwtSecret = options.jwtSecret;
  const verifyPasswordHash = options.verifyPasswordHash;
  const rehashPasswordIfNeeded = options.rehashPasswordIfNeeded;
  const isProduction = options.isProduction;
  const enableRealPayment = options.enableRealPayment;
  const providerTimeoutMs = options.providerTimeoutMs;
  const imageProviderTimeoutMs = options.imageProviderTimeoutMs;
  const aiImageModel = options.aiImageModel;
  const aiTextModel = options.aiTextModel;
  const imageClarityOptions = options.imageClarityOptions;
  const baseRoutes = options.baseRoutes;
  const balanceService = options.balanceService;
  const generationTaskService = options.generationTaskService;
  const generationTaskRepository = options.generationTaskRepository;
  const imageRequestScheduler = options.imageRequestScheduler;
  const tasks = options.tasks;
  const providerStatus = options.providerStatus;
  const filteredRoutes = options.filteredRoutes;
  const hasConfiguredSecret = options.hasConfiguredSecret;
  const providerAuthKey = options.providerAuthKey;
  const normalizeSecretInput = options.normalizeSecretInput;
  const positiveNumber = options.positiveNumber;
  const normalizeProviderImageResponseFormat = options.normalizeProviderImageResponseFormat;
  const normalizeProviderImageStream = options.normalizeProviderImageStream;
  const normalizeProviderImagePartialImages = options.normalizeProviderImagePartialImages;
  const normalizeApiProviderRoute = options.normalizeApiProviderRoute;
  const routeState = options.routeState;
  const saveRouteState = options.saveRouteState;
  const routePayload = options.routePayload;
  const providerImageResponseMode = options.providerImageResponseMode;
  const findRouteByAnyId = options.findRouteByAnyId;
  const routeKind = options.routeKind;
  const routeProviderStatus = options.routeProviderStatus;
  const callProviderImageGeneration = options.callProviderImageGeneration;
  const callProviderResponses = options.callProviderResponses;
  const baseModelsForRoute = options.baseModelsForRoute;
  const modelPriceState = options.modelPriceState;
  const saveModelPriceState = options.saveModelPriceState;
  const normalizeRouteModel = options.normalizeRouteModel;
  const routeMatchesModelRow = options.routeMatchesModelRow;
  const fmt = options.fmt;
  const makePersistentTaskResponse = options.makePersistentTaskResponse;
  const makeTaskResponse = options.makeTaskResponse;
  const removeGenerationTaskInputs = options.removeGenerationTaskInputs;
  const placeholderUrl = options.placeholderUrl;
  const templateWorkflowState = options.templateWorkflowState;
  const saveTemplateWorkflowState = options.saveTemplateWorkflowState;
  const settingsState = options.settingsState;
  const saveSettingsState = options.saveSettingsState;
  if (typeof auth !== 'function') throw new TypeError('Admin 路由缺少 auth 中间件');
  if (typeof admin !== 'function') throw new TypeError('Admin 路由缺少 admin 中间件');
  if (!db) throw new TypeError('Admin 路由缺少 db');
  if (typeof uid !== 'function') throw new TypeError('Admin 路由缺少 uid');
  if (typeof h !== 'function') throw new TypeError('Admin 路由缺少 h');
  if (typeof san !== 'function') throw new TypeError('Admin 路由缺少 san');
  if (!jwt || typeof jwt.sign !== 'function') throw new TypeError('Admin 路由缺少 jwt');
  if (typeof jwtSecret !== 'string') throw new TypeError('Admin 路由缺少 jwtSecret');
  if (typeof verifyPasswordHash !== 'function') throw new TypeError('Admin 路由缺少 verifyPasswordHash');
  if (typeof rehashPasswordIfNeeded !== 'function') throw new TypeError('Admin 路由缺少 rehashPasswordIfNeeded');
  if (typeof isProduction !== 'boolean') throw new TypeError('Admin 路由缺少 isProduction');
  if (typeof enableRealPayment !== 'boolean') throw new TypeError('Admin 路由缺少 enableRealPayment');
  if (typeof providerTimeoutMs !== 'number') throw new TypeError('Admin 路由缺少 providerTimeoutMs');
  if (typeof imageProviderTimeoutMs !== 'number') throw new TypeError('Admin 路由缺少 imageProviderTimeoutMs');
  if (!aiImageModel) throw new TypeError('Admin 路由缺少 aiImageModel');
  if (!aiTextModel) throw new TypeError('Admin 路由缺少 aiTextModel');
  if (!Array.isArray(imageClarityOptions)) throw new TypeError('Admin 路由缺少 imageClarityOptions');
  if (!Array.isArray(baseRoutes)) throw new TypeError('Admin 路由缺少 baseRoutes');
  if (!balanceService) throw new TypeError('Admin 路由缺少 balanceService');
  if (!generationTaskService) throw new TypeError('Admin 路由缺少 generationTaskService');
  if (!generationTaskRepository) throw new TypeError('Admin 路由缺少 generationTaskRepository');
  if (!imageRequestScheduler) throw new TypeError('Admin 路由缺少 imageRequestScheduler');
  if (!tasks) throw new TypeError('Admin 路由缺少 tasks');
  if (typeof providerStatus !== 'function') throw new TypeError('Admin 路由缺少 providerStatus');
  if (typeof filteredRoutes !== 'function') throw new TypeError('Admin 路由缺少 filteredRoutes');
  if (typeof hasConfiguredSecret !== 'function') throw new TypeError('Admin 路由缺少 hasConfiguredSecret');
  if (typeof providerAuthKey !== 'function') throw new TypeError('Admin 路由缺少 providerAuthKey');
  if (typeof normalizeSecretInput !== 'function') throw new TypeError('Admin 路由缺少 normalizeSecretInput');
  if (typeof positiveNumber !== 'function') throw new TypeError('Admin 路由缺少 positiveNumber');
  if (typeof normalizeProviderImageResponseFormat !== 'function') throw new TypeError('Admin 路由缺少 normalizeProviderImageResponseFormat');
  if (typeof normalizeProviderImageStream !== 'function') throw new TypeError('Admin 路由缺少 normalizeProviderImageStream');
  if (typeof normalizeProviderImagePartialImages !== 'function') throw new TypeError('Admin 路由缺少 normalizeProviderImagePartialImages');
  if (typeof normalizeApiProviderRoute !== 'function') throw new TypeError('Admin 路由缺少 normalizeApiProviderRoute');
  if (typeof routeState !== 'function') throw new TypeError('Admin 路由缺少 routeState');
  if (typeof saveRouteState !== 'function') throw new TypeError('Admin 路由缺少 saveRouteState');
  if (typeof routePayload !== 'function') throw new TypeError('Admin 路由缺少 routePayload');
  if (typeof providerImageResponseMode !== 'function') throw new TypeError('Admin 路由缺少 providerImageResponseMode');
  if (typeof findRouteByAnyId !== 'function') throw new TypeError('Admin 路由缺少 findRouteByAnyId');
  if (typeof routeKind !== 'function') throw new TypeError('Admin 路由缺少 routeKind');
  if (typeof routeProviderStatus !== 'function') throw new TypeError('Admin 路由缺少 routeProviderStatus');
  if (typeof callProviderImageGeneration !== 'function') throw new TypeError('Admin 路由缺少 callProviderImageGeneration');
  if (typeof callProviderResponses !== 'function') throw new TypeError('Admin 路由缺少 callProviderResponses');
  if (typeof baseModelsForRoute !== 'function') throw new TypeError('Admin 路由缺少 baseModelsForRoute');
  if (typeof modelPriceState !== 'function') throw new TypeError('Admin 路由缺少 modelPriceState');
  if (typeof saveModelPriceState !== 'function') throw new TypeError('Admin 路由缺少 saveModelPriceState');
  if (typeof normalizeRouteModel !== 'function') throw new TypeError('Admin 路由缺少 normalizeRouteModel');
  if (typeof routeMatchesModelRow !== 'function') throw new TypeError('Admin 路由缺少 routeMatchesModelRow');
  if (typeof fmt !== 'function') throw new TypeError('Admin 路由缺少 fmt');
  if (typeof makePersistentTaskResponse !== 'function') throw new TypeError('Admin 路由缺少 makePersistentTaskResponse');
  if (typeof makeTaskResponse !== 'function') throw new TypeError('Admin 路由缺少 makeTaskResponse');
  if (typeof removeGenerationTaskInputs !== 'function') throw new TypeError('Admin 路由缺少 removeGenerationTaskInputs');
  if (typeof placeholderUrl !== 'function') throw new TypeError('Admin 路由缺少 placeholderUrl');
  if (typeof templateWorkflowState !== 'function') throw new TypeError('Admin 路由缺少 templateWorkflowState');
  if (typeof saveTemplateWorkflowState !== 'function') throw new TypeError('Admin 路由缺少 saveTemplateWorkflowState');
  if (typeof settingsState !== 'function') throw new TypeError('Admin 路由缺少 settingsState');
  if (typeof saveSettingsState !== 'function') throw new TypeError('Admin 路由缺少 saveSettingsState');

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
        const route = routes.find(item => routeMatchesModelRow(row, item)) || routes[0] || routePayload(baseRoutes[0], { includeModelOverrides: false, includeDisabledModels: true });
        return normalizeRouteModel(row, route);
      });
    return [
      ...baseRows,
      ...extraRows
    ];
  }
  
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: '请输入管理员账号和密码' });
    const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
    const passwordVerification = user ? verifyPasswordHash(user.password_hash, password) : { ok: false };
    if (!user || !passwordVerification.ok) return res.status(401).json({ message: '账号或密码不正确' });
    if (user.role !== 'admin') return res.status(403).json({ message: '当前账号不是管理员' });
    rehashPasswordIfNeeded(user, password, passwordVerification);
    db.prepare("UPDATE users SET last_login_at=datetime('now') WHERE id=?").run(user.id);
    const token = jwt.sign({ userId: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
    res.json({ token, user: san(user) });
  });
  
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
    balanceService.recordBalanceLog(user.id, 'admin_adjust', amount, user.balance, next, req.body.remark || '管理员调整余额');
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
    if (isProduction && !password) {
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
      code: enableRealPayment ? 'ORDER_STORAGE_UNAVAILABLE' : 'PAYMENT_DISABLED',
      message: enableRealPayment ? '真实订单数据表尚未接入' : '支付功能未启用，当前没有真实订单数据'
    });
  });
  app.patch('/api/admin/orders/:id/status', auth, admin, (req, res) => {
    const code = enableRealPayment ? 'ORDER_STORAGE_UNAVAILABLE' : 'PAYMENT_DISABLED';
    const message = enableRealPayment ? '真实订单数据表尚未接入，不能修改订单状态' : '支付功能未启用，不能修改订单状态';
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
      timeoutMs: positiveNumber(req.body.timeoutMs, providerTimeoutMs),
      imageTimeoutMs: positiveNumber(req.body.imageTimeoutMs || req.body.timeoutMs, imageProviderTimeoutMs),
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
        timeoutMs: positiveNumber(route.timeoutMs, previous.timeoutMs || providerTimeoutMs),
        imageTimeoutMs: positiveNumber(
          route.imageTimeoutMs || route.timeoutMs,
          previous.imageTimeoutMs || imageProviderTimeoutMs
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
        timeoutMs: positiveNumber(req.body.timeoutMs, route.timeoutMs || providerTimeoutMs),
        imageTimeoutMs: positiveNumber(
          req.body.imageTimeoutMs || req.body.timeoutMs,
          route.imageTimeoutMs || imageProviderTimeoutMs
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
  
    const model = route.dm || route.defaultModelKey || route.defaultModelRealName || (kind === 'image' ? aiImageModel : aiTextModel);
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
    const defaultQualities = routeKind(route) === 'image' ? imageClarityOptions : ['1k'];
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
}

module.exports = { registerAdminRoutes };

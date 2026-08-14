'use strict';

// 余额流水与兑换码服务（渐进模块化第二批，自 server.js 平移，行为零变化）。
// db 由 server.js 注入，与 backend/billing/generation-billing.js 同一模式；
// 路由层（Express handler）仍留在 server.js，仅改为调用本服务。

function createBalanceService(options = {}) {
  const db = options.db;
  if (!db) throw new TypeError('缺少 SQLite 数据库连接');

  // 写一条余额流水（6 列基础版，不含 task_id；生图任务预占/退款流水见 generation-billing.js）。
  function recordBalanceLog(userId, type, changeAmount, beforeBalance, afterBalance, remark) {
    db.prepare('INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark) VALUES (?,?,?,?,?,?)')
      .run(userId, type, changeAmount, beforeBalance, afterBalance, remark);
  }

  // 用户侧余额流水查询（/api/user/balance-logs，固定 LIMIT 50）。
  function listUserBalanceLogs(userId) {
    return db.prepare('SELECT * FROM balance_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(userId);
  }

  // 兑换码兑换：返回 { status, body }，由路由层原样回写响应。
  function redeemCode(userId, code) {
    if (!code) return { status: 400, body: { message: '请输入兑换码' } };
    const rc = db.prepare('SELECT * FROM redeem_codes WHERE code=? AND enabled=1 AND used_count<max_uses').get(code.toUpperCase());
    if (!rc) return { status: 404, body: { message: '兑换码不存在' } };
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
    const nb = u.balance + rc.amount;
    db.prepare('UPDATE users SET balance=? WHERE id=?').run(nb, u.id);
    db.prepare('UPDATE redeem_codes SET used_count=used_count+1 WHERE code=?').run(code.toUpperCase());
    recordBalanceLog(u.id, 'redeem', rc.amount, u.balance, nb, '兑换码: ' + code.toUpperCase());
    return { status: 200, body: { success: true, balance: nb, amount: rc.amount } };
  }

  return {
    recordBalanceLog,
    listUserBalanceLogs,
    redeemCode
  };
}

module.exports = {
  createBalanceService
};

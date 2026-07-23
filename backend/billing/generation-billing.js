'use strict';

function billingError(status, code, message, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  Object.assign(error, details);
  return error;
}

function createGenerationBillingService(options = {}) {
  const db = options.db;
  if (!db) throw new TypeError('缺少 SQLite 数据库连接');

  function reserve(input) {
    const user = db.prepare('SELECT id,balance FROM users WHERE id=?').get(input.userId);
    if (!user) throw billingError(401, 'AUTH_USER_NOT_FOUND', '登录状态已失效，请重新登录');
    const reservedCost = Math.max(0, Number(input.reservedCost || 0));
    const beforeBalance = Number(user.balance || 0);
    const afterBalance = beforeBalance - reservedCost;
    if (afterBalance < 0) {
      throw billingError(400, 'INSUFFICIENT_BALANCE', `算力不足，需要 ${reservedCost}，当前 ${beforeBalance}`, {
        totalCost: reservedCost,
        balance: beforeBalance
      });
    }
    if (reservedCost > 0) {
      const updated = db.prepare('UPDATE users SET balance=? WHERE id=? AND balance=?')
        .run(afterBalance, input.userId, beforeBalance);
      if (updated.changes !== 1) {
        throw billingError(409, 'BALANCE_CHANGED', '余额状态已变化，请重新提交');
      }
      db.prepare(`
        INSERT INTO balance_logs (user_id,type,change_amount,before_balance,after_balance,remark,task_id)
        VALUES (?,?,?,?,?,?,?)
      `).run(
        input.userId,
        'generation_reserve',
        -reservedCost,
        beforeBalance,
        afterBalance,
        input.remark || '生图任务预占',
        input.taskId
      );
    }
    return { reservedCost, beforeBalance, afterBalance };
  }

  function refundUnused(taskRow, settledCost, reason) {
    const reservedCost = Number(taskRow.reserved_cost || 0);
    const refund = Math.max(0, reservedCost - settledCost);
    if (refund <= 0 || taskRow.billing_status !== 'reserved') {
      return {
        refund: 0,
        billingStatus: settledCost > 0 ? 'settled' : taskRow.billing_status
      };
    }
    const user = db.prepare('SELECT balance FROM users WHERE id=?').get(taskRow.user_id);
    const beforeBalance = Number(user?.balance || 0);
    const afterBalance = beforeBalance + refund;
    db.prepare('UPDATE users SET balance=? WHERE id=?').run(afterBalance, taskRow.user_id);
    db.prepare(`
      INSERT OR IGNORE INTO balance_logs (
        user_id,type,change_amount,before_balance,after_balance,remark,task_id
      ) VALUES (?,?,?,?,?,?,?)
    `).run(
      taskRow.user_id,
      'generation_refund',
      refund,
      beforeBalance,
      afterBalance,
      `生图任务退款: ${reason || '未完成部分'}`,
      taskRow.id
    );
    return {
      refund,
      billingStatus: settledCost > 0 ? 'partially_settled' : 'refunded'
    };
  }

  return {
    reserve,
    refundUnused
  };
}

module.exports = {
  billingError,
  createGenerationBillingService
};

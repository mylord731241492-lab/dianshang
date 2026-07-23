const { logger } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { findUser, createUser, updateUser } = require('~/models');
const { setAuthTokens } = require('~/server/services/AuthService');

function publicUser(user) {
  const { password: _password, totpSecret: _totpSecret, backupCodes: _backupCodes, __v, ...safe } = user;
  safe.id = safe._id.toString();
  return safe;
}

function normalizeSsoEmail(claims = {}) {
  const supplied = String(claims.email || '').trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplied)) return supplied;
  if (claims.role !== 'ADMIN') return '';
  const localPart = String(claims.username || claims.name || 'admin')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'admin';
  return `${localPart}@internal.local`;
}

async function exchangeMainSiteTicket(ticket) {
  const baseUrl = String(process.env.HJM_MAIN_APP_INTERNAL_URL || 'http://app:3456').replace(/\/$/, '');
  const secret = String(process.env.LIBRECHAT_BRIDGE_SECRET || '');
  const response = await fetch(`${baseUrl}/api/integrations/librechat/sso-exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ ticket }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.user) {
    const error = new Error(data?.message || '主站登录票据验证失败');
    error.status = response.status || 401;
    throw error;
  }
  return data.user;
}

async function hjmSsoController(req, res) {
  try {
    const ticket = String(req.body?.ticket || '').trim();
    if (!ticket) return res.status(400).json({ message: '缺少主站登录票据' });

    const claims = await exchangeMainSiteTicket(ticket);
    const externalId = `hjm:${claims.id}`;
    const email = normalizeSsoEmail(claims);
    if (!email) return res.status(400).json({ message: '主站账号缺少邮箱，无法创建聊天账号' });

    let user = await findUser({ openidId: externalId });
    if (!user) user = await findUser({ idOnTheSource: externalId });
    if (!user) {
      const byEmail = await findUser({ email });
      if (byEmail && (byEmail.provider !== 'hjm-sso' || byEmail.idOnTheSource !== externalId)) {
        return res.status(409).json({ message: '该邮箱已绑定其他聊天账号，请联系管理员处理' });
      }
      user = byEmail;
    }

    const role = claims.role === 'ADMIN' ? SystemRoles.ADMIN : SystemRoles.USER;
    const userData = {
      provider: 'hjm-sso',
      email,
      username: String(claims.username || email.split('@')[0]).trim().toLowerCase(),
      name: String(claims.name || claims.username || email).trim(),
      role,
      emailVerified: true,
      openidId: externalId,
      idOnTheSource: externalId,
      termsAccepted: true,
    };

    if (user) {
      user = await updateUser(user._id.toString(), userData);
    } else {
      user = await createUser(userData, undefined, true, true);
    }

    const token = await setAuthTokens(user._id, res);
    return res.status(200).json({ token, user: publicUser(user) });
  } catch (error) {
    logger.error('[hjmSsoController]', error);
    return res.status(error.status || 500).json({ message: error.message || '主站免登录失败' });
  }
}

module.exports = { hjmSsoController };

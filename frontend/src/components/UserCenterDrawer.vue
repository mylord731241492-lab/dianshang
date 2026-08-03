<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { Check, ChevronDown, Coins, LogOut, RefreshCcw, Upload, X } from 'lucide-vue-next';
import { http, getApiErrorMessage } from '../api/http';

// 首页用户中心抽屉：旧版卡片式的层级化重排（与画布内用户中心同一形态）。
// 层级：① 资料主卡（橙渐变锚点）→ ② 头像设置 → ③ 算力资产卡（余额/明细/兑换码合一）→ ④ API 线路（可选线）→ ⑤ 界面语言 → 退出登录。
// 数据全部来自 /api/user/*。

const PRESET_AVATARS = ['avatar-2d', 'avatar-ai', 'avatar-art', 'avatar-human', 'avatar-pro'].map((name) => `/avatars/${name}.svg`);
const LANGUAGE_STORAGE_KEY = 'hjm-ui-language';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  balance: number;
  avatarUrl?: string;
  avatar_url?: string;
}

interface BalanceLog {
  id: number;
  type: string;
  change_amount: number;
  after_balance: number;
  remark: string;
  created_at: string;
}

interface ApiStatusProvider {
  routeId?: string;
  routeKey?: string;
  displayName?: string;
  name?: string;
  defaultImageModel?: string;
  models?: Array<{ displayName?: string; modelKey?: string; realName?: string }>;
}

interface RouteItem {
  id: string;
  routeKey: string;
  displayName: string;
  enabled: boolean;
  isDefault: boolean;
  defaultModelDisplayName: string;
  modelCount: number;
}

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const profile = ref<UserProfile | null>(null);
const logs = ref<BalanceLog[]>([]);
const apiStatus = ref<ApiStatusProvider | null>(null);
const routes = ref<RouteItem[]>([]);
const routeError = ref('');
const routeSaving = ref('');
const loading = ref(false);
const avatarSaving = ref(false);
const redeemCode = ref('');
const redeeming = ref(false);
const errorMessage = ref('');
const noticeMessage = ref('');
const logsOpen = ref(false);
const language = ref(window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || '中文');

function avatarUrl() {
  return profile.value?.avatarUrl || profile.value?.avatar_url || '';
}

function modelNames(): string[] {
  const models = apiStatus.value?.models || [];
  return models.map((model) => String(model.displayName || model.modelKey || model.realName || '').trim()).filter(Boolean);
}

function isActiveRoute(route: RouteItem): boolean {
  return route.id === apiStatus.value?.routeId || (route.routeKey !== '' && route.routeKey === apiStatus.value?.routeKey);
}

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [profileRes, logsRes, statusRes] = await Promise.all([
      http.get('/api/user/profile'),
      http.get('/api/user/balance-logs'),
      http.get('/api/user/api-status')
    ]);
    profile.value = profileRes.data?.user || profileRes.data || null;
    logs.value = (logsRes.data?.items || []).slice(0, 10);
    apiStatus.value = statusRes.data?.provider || null;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '用户信息加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadRoutes() {
  routeError.value = '';
  try {
    const response = await http.get('/api/user/routes?group=image');
    const items = response.data?.items || response.data?.data || [];
    routes.value = items
      .map((row: Record<string, unknown>) => ({
        id: String(row.id || row.routeId || row.lineId || ''),
        routeKey: String(row.routeKey || row.lineKey || row.key || ''),
        displayName: String(row.displayName || row.routeDisplayName || row.name || '未命名线路'),
        enabled: row.enabled !== false,
        isDefault: row.isDefault === true,
        defaultModelDisplayName: String(row.defaultModelDisplayName || ''),
        modelCount: Array.isArray(row.models) ? row.models.length : 0
      }))
      .filter((item: RouteItem) => item.id);
  } catch (error) {
    routes.value = [];
    routeError.value = getApiErrorMessage(error, '线路加载失败');
  }
}

async function selectRoute(route: RouteItem) {
  if (routeSaving.value || !route.enabled || isActiveRoute(route)) return;
  routeSaving.value = route.id;
  try {
    await http.post('/api/user/preferences/api-route', { routeId: route.id, lineId: route.id });
    const statusRes = await http.get('/api/user/api-status');
    apiStatus.value = statusRes.data?.provider || null;
    noticeMessage.value = '线路模式已保存';
    window.setTimeout(() => (noticeMessage.value = ''), 2400);
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '线路保存失败');
  } finally {
    routeSaving.value = '';
  }
}

async function chooseAvatar(url: string, avatarType: 'preset' | 'custom') {
  if (avatarSaving.value) return;
  avatarSaving.value = true;
  try {
    await http.put('/api/user/avatar', { avatarUrl: url, avatarType });
    await load();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '头像保存失败');
  } finally {
    avatarSaving.value = false;
  }
}

function randomAvatar() {
  const pool = PRESET_AVATARS.filter((url) => url !== avatarUrl());
  const next = pool[Math.floor(Math.random() * pool.length)] || PRESET_AVATARS[0];
  void chooseAvatar(next, 'preset');
}

async function uploadAvatar(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || avatarSaving.value) return;
  avatarSaving.value = true;
  try {
    const form = new FormData();
    form.append('file', file, file.name || 'avatar.png');
    const token = window.localStorage.getItem('auth_token');
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form
    });
    const payload = await response.json();
    if (!response.ok || !payload.url) throw new Error(payload.message || '头像上传失败');
    await chooseAvatar(payload.url, 'custom');
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '头像上传失败');
    avatarSaving.value = false;
  } finally {
    input.value = '';
  }
}

async function submitRedeem() {
  const code = redeemCode.value.trim();
  if (!code || redeeming.value) return;
  redeeming.value = true;
  try {
    await http.post('/api/user/redeem', { code });
    redeemCode.value = '';
    noticeMessage.value = '兑换成功';
    window.setTimeout(() => (noticeMessage.value = ''), 2400);
    await load();
    errorMessage.value = '';
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '兑换失败');
  } finally {
    redeeming.value = false;
  }
}

function upgradeHint() {
  noticeMessage.value = '充值套餐待接入支付平台，可先使用兑换码增加算力';
  window.setTimeout(() => (noticeMessage.value = ''), 2400);
}

function changeLanguage(next: string) {
  language.value = next;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
}

function doLogout() {
  window.localStorage.removeItem('auth_token');
  window.localStorage.removeItem('auth_user');
  window.location.assign('/login');
}

watch(
  () => props.open,
  (next) => {
    if (next) {
      void load();
      void loadRoutes();
    }
  }
);

onMounted(() => {
  if (props.open) {
    void load();
    void loadRoutes();
  }
});
</script>

<template>
  <Teleport to="body">
    <transition name="uc-fade">
      <div v-if="open" class="uc-mask" @click="emit('close')"></div>
    </transition>
    <transition name="uc-slide">
      <aside v-if="open" class="uc-drawer" role="dialog" aria-label="用户中心">
        <header class="uc-header">
          <span class="uc-title">用户中心</span>
          <button type="button" class="uc-close" aria-label="关闭" @click="emit('close')">
            <X :size="16" />
          </button>
        </header>

        <div v-if="loading && !profile" class="uc-loading">加载中…</div>
        <div v-else class="uc-body">
          <p v-if="errorMessage" class="uc-error">{{ errorMessage }}</p>
          <p v-if="noticeMessage" class="uc-notice">{{ noticeMessage }}</p>

          <!-- ① 资料主卡：橙渐变视觉锚点 -->
          <div class="uc-hero">
            <span class="uc-avatar">
              <img v-if="avatarUrl()" :src="avatarUrl()" alt="头像" />
              <template v-else>{{ (profile?.username || 'U').slice(0, 1).toUpperCase() }}</template>
            </span>
            <div class="uc-hero-meta">
              <strong>{{ profile?.username || '…' }}</strong>
              <span>{{ profile?.email || '' }}</span>
            </div>
            <button type="button" class="uc-upgrade" @click="upgradeHint">升级</button>
          </div>

          <!-- ② 头像设置 -->
          <section class="uc-card">
            <div class="uc-card-head">
              <span class="uc-card-title">
                <strong>头像设置</strong>
                <small>自定义或选择预设头像</small>
              </span>
              <span class="uc-avatar-actions">
                <button type="button" class="uc-icon-btn" title="随机头像" :disabled="avatarSaving" @click="randomAvatar">
                  <RefreshCcw :size="15" />
                </button>
                <label class="uc-upload-btn">
                  <Upload :size="13" />
                  {{ avatarSaving ? '上传中…' : '上传' }}
                  <input hidden type="file" accept="image/*" @change="uploadAvatar" />
                </label>
              </span>
            </div>
            <div class="uc-select-wrap">
              <select
                class="uc-select"
                :value="PRESET_AVATARS.includes(avatarUrl()) ? avatarUrl() : ''"
                :disabled="avatarSaving"
                @change="(event) => { const v = (event.target as HTMLSelectElement).value; if (v) void chooseAvatar(v, 'preset'); }"
              >
                <option value="" disabled>预设头像</option>
                <option v-for="(url, index) in PRESET_AVATARS" :key="url" :value="url">预设头像 {{ index + 1 }}</option>
              </select>
              <ChevronDown :size="15" class="uc-select-chevron" />
            </div>
            <div class="uc-avatar-grid">
              <button
                v-for="url in PRESET_AVATARS"
                :key="url"
                type="button"
                class="uc-avatar-option"
                :class="{ active: avatarUrl() === url }"
                :disabled="avatarSaving"
                @click="chooseAvatar(url, 'preset')"
              >
                <img :src="url" alt="" />
                <span v-if="avatarUrl() === url" class="uc-avatar-check"><Check :size="13" /></span>
              </button>
            </div>
          </section>

          <!-- ③ 算力资产卡：余额 / 明细 / 兑换码 合一 -->
          <section class="uc-card">
            <div class="uc-balance-row">
              <span class="uc-card-title">
                <strong>算力余额</strong>
                <small>可用于提交生成任务</small>
              </span>
              <span class="uc-balance-value">
                <Coins :size="18" class="uc-coin" />
                {{ profile?.balance ?? '…' }}
              </span>
            </div>

            <div class="uc-divider"></div>

            <div class="uc-logs-head">
              <span class="uc-card-title">
                <strong>算力明细</strong>
                <small>最近 10 条余额变动</small>
              </span>
              <button type="button" class="uc-expand" @click="logsOpen = !logsOpen">
                {{ logsOpen ? '收起' : '展开' }}
                <ChevronDown :size="13" :class="{ 'uc-expand-open': logsOpen }" />
              </button>
            </div>
            <div v-if="logsOpen" class="uc-logs">
              <div v-if="logs.length" class="uc-log-list">
                <div v-for="log in logs" :key="log.id" class="uc-log-row">
                  <span class="uc-log-remark">{{ log.remark || log.type }}</span>
                  <span class="uc-log-amount" :class="{ positive: log.change_amount >= 0 }">{{ log.change_amount >= 0 ? `+${log.change_amount}` : log.change_amount }}</span>
                  <span class="uc-log-after">余 {{ log.after_balance }}</span>
                </div>
              </div>
              <p v-else class="uc-empty">暂无明细</p>
            </div>

            <div class="uc-divider"></div>

            <span class="uc-card-title">
              <strong>兑换码</strong>
              <small>输入兑换码增加余额</small>
            </span>
            <div class="uc-redeem">
              <input v-model="redeemCode" type="text" placeholder="请输入兑换码" @keyup.enter="submitRedeem" />
              <button type="button" :disabled="redeeming || !redeemCode.trim()" @click="submitRedeem">{{ redeeming ? '兑换中…' : '立即兑换' }}</button>
            </div>
          </section>

          <!-- ④ API 线路（可选线） -->
          <section class="uc-card">
            <div class="uc-card-head">
              <span class="uc-card-title">
                <strong>API 线路</strong>
                <small>普通用户只能选择模式</small>
              </span>
              <span class="uc-route-tag" :class="{ ok: routes.length && !routeError }">{{ routes.length && !routeError ? '可用' : '未启用' }}</span>
            </div>
            <div class="uc-route-body">
              <div class="uc-route-current">
                <span>当前线路</span>
                <strong>{{ apiStatus?.displayName || apiStatus?.name || '-' }}</strong>
              </div>
              <div v-if="routeError" class="uc-route-error">{{ routeError }}</div>
              <div v-if="routes.length" class="uc-route-list">
                <button
                  v-for="route in routes"
                  :key="route.id"
                  type="button"
                  class="uc-route-row"
                  :class="{ active: isActiveRoute(route) }"
                  :disabled="!route.enabled || !!routeSaving"
                  @click="selectRoute(route)"
                >
                  <span class="uc-radio" :class="{ active: isActiveRoute(route) }"><span v-if="isActiveRoute(route)" class="uc-radio-dot"></span></span>
                  <span class="uc-route-meta">
                    <strong>
                      {{ route.displayName }}
                      <em v-if="route.isDefault">默认线路</em>
                    </strong>
                    <small>
                      {{ route.defaultModelDisplayName ? `默认模型 ${route.defaultModelDisplayName} · ` : '' }}{{ route.modelCount }} 个模型{{ route.enabled ? '' : ' · 未启用' }}
                    </small>
                  </span>
                  <span v-if="routeSaving === route.id" class="uc-route-saving">…</span>
                  <Check v-else-if="isActiveRoute(route)" :size="15" class="uc-route-check" />
                </button>
              </div>
              <p v-else-if="!routeError" class="uc-empty">暂无可用线路</p>
              <div class="uc-models">
                <strong>模型</strong>
                <div v-if="modelNames().length" class="uc-model-chips">
                  <span v-for="name in modelNames()" :key="name">{{ name }}</span>
                </div>
                <p v-else class="uc-empty">当前线路暂无可用模型，请在后台为该线路启用模型</p>
              </div>
              <p class="uc-security">安全说明：API Key 和 Base URL 由管理员在后台统一维护，普通用户端不会展示或保存真实密钥。</p>
            </div>
          </section>

          <!-- ⑤ 界面语言：slim 卡 -->
          <section class="uc-card uc-language-card">
            <strong>界面语言</strong>
            <span class="uc-language">
              <button type="button" :class="{ active: language === '中文' }" @click="changeLanguage('中文')">中文</button>
              <button type="button" :class="{ active: language === 'EN' }" @click="changeLanguage('EN')">EN</button>
            </span>
          </section>

          <button type="button" class="uc-logout" @click="doLogout">
            <LogOut :size="14" />
            退出登录
          </button>
        </div>
      </aside>
    </transition>
  </Teleport>
</template>

<style scoped>
.uc-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(0, 0, 0, 0.35);
}

.uc-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 95;
  display: flex;
  flex-direction: column;
  width: min(400px, 92vw);
  background: #f4f4f5;
  box-shadow: -16px 0 48px rgba(0, 0, 0, 0.18);
}

.uc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 8px;
}

.uc-title {
  font-size: 17px;
  font-weight: 800;
  color: #18181b;
}

.uc-close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: #fff;
  color: #71717a;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.uc-loading {
  padding: 48px 0;
  text-align: center;
  color: #a1a1aa;
  font-size: 13px;
}

.uc-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.uc-error {
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 12px;
  font-weight: 700;
}

.uc-notice {
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: #ecfdf5;
  color: #047857;
  font-size: 12px;
  font-weight: 700;
}

/* ① 资料主卡 */
.uc-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  border-radius: 18px;
  padding: 18px 20px;
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
  border: 1px solid #fed7aa;
  box-shadow: 0 4px 14px rgba(249, 115, 22, 0.10);
}

.uc-avatar {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  flex-shrink: 0;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
  color: #f97316;
  font-size: 22px;
  font-weight: 900;
  text-transform: uppercase;
  box-shadow: 0 2px 6px rgba(249, 115, 22, 0.16);
}

.uc-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.uc-hero-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.uc-hero-meta strong {
  font-size: 17px;
  font-weight: 800;
  color: #18181b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.uc-hero-meta span {
  font-size: 12px;
  color: #71717a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.uc-upgrade {
  flex-shrink: 0;
  border: none;
  border-radius: 999px;
  background: #f97316;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  padding: 8px 18px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.35);
}

/* 通用白卡 */
.uc-card {
  background: #fff;
  border-radius: 18px;
  padding: 18px 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.uc-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.uc-card-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.uc-card-title strong {
  font-size: 14px;
  font-weight: 800;
  color: #18181b;
}

.uc-card-title small {
  font-size: 12px;
  color: #a1a1aa;
}

.uc-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 16px -20px;
}

/* 头像设置 */
.uc-avatar-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.uc-icon-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
  color: #71717a;
  cursor: pointer;
}

.uc-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border-radius: 999px;
  background: #18181b;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.uc-select-wrap {
  position: relative;
  margin-top: 14px;
}

.uc-select {
  width: 100%;
  appearance: none;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  background: #fafafa;
  padding: 10px 34px 10px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #18181b;
  outline: none;
}

.uc-select-chevron {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #a1a1aa;
  pointer-events: none;
}

.uc-avatar-grid {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.uc-avatar-option {
  position: relative;
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid transparent;
  background: none;
  cursor: pointer;
}

.uc-avatar-option.active {
  border-color: #f97316;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.18);
}

.uc-avatar-option img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.uc-avatar-check {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
}

/* 算力资产卡 */
.uc-balance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.uc-balance-value {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
  color: #18181b;
}

.uc-coin {
  color: #f97316;
}

.uc-logs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.uc-expand {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: #f97316;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  flex-shrink: 0;
}

.uc-expand svg {
  transition: transform 0.18s;
}

.uc-expand svg.uc-expand-open {
  transform: rotate(180deg);
}

.uc-logs {
  margin-top: 10px;
  border-radius: 12px;
  background: #fafafa;
  padding: 10px 12px;
}

.uc-log-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.uc-log-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.uc-log-remark {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #18181b;
}

.uc-log-amount {
  flex-shrink: 0;
  font-weight: 800;
  color: #dc2626;
}

.uc-log-amount.positive {
  color: #16a34a;
}

.uc-log-after {
  width: 64px;
  flex-shrink: 0;
  text-align: right;
  color: #a1a1aa;
}

.uc-redeem {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}

.uc-redeem input {
  flex: 1;
  height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  background: #fafafa;
  color: #18181b;
  font-size: 13px;
  outline: none;
}

.uc-redeem input:focus {
  border-color: #fdba74;
  background: #fff;
}

.uc-redeem button {
  flex-shrink: 0;
  border: none;
  border-radius: 12px;
  background: #f97316;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  padding: 0 18px;
  cursor: pointer;
}

.uc-redeem button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* API 线路 */
.uc-route-tag {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 800;
  background: #f4f4f5;
  color: #a1a1aa;
}

.uc-route-tag.ok {
  background: #ecfdf5;
  color: #16a34a;
}

.uc-route-body {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.uc-route-current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-radius: 12px;
  background: #fff4e8;
  border: 1px solid #fed7aa;
  padding: 10px 14px;
}

.uc-route-current span {
  font-size: 12px;
  font-weight: 700;
  color: #ea580c;
}

.uc-route-current strong {
  font-size: 13px;
  font-weight: 900;
  color: #ea580c;
}

.uc-route-error {
  border-radius: 12px;
  background: #fef2f2;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 700;
  color: #dc2626;
}

.uc-route-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.uc-route-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: #fafafa;
  padding: 10px 12px;
  cursor: pointer;
}

.uc-route-row.active {
  border-color: #fed7aa;
  background: #fff4e8;
}

.uc-route-row:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.uc-radio {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #d4d4d8;
  display: grid;
  place-items: center;
  background: #fff;
}

.uc-radio.active {
  border-color: #f97316;
}

.uc-radio-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f97316;
}

.uc-route-meta {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.uc-route-meta strong {
  font-size: 13px;
  font-weight: 800;
  color: #18181b;
}

.uc-route-meta strong em {
  margin-left: 6px;
  font-size: 11px;
  font-style: normal;
  color: #f97316;
}

.uc-route-meta small {
  font-size: 11px;
  color: #a1a1aa;
}

.uc-route-check {
  color: #f97316;
  flex-shrink: 0;
}

.uc-route-saving {
  color: #a1a1aa;
  flex-shrink: 0;
}

.uc-models {
  border-radius: 12px;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.06);
  padding: 10px 12px;
}

.uc-models > strong {
  font-size: 12px;
  font-weight: 800;
  color: #71717a;
}

.uc-model-chips {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.uc-model-chips span {
  border-radius: 999px;
  background: #f4f4f5;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  color: #71717a;
}

.uc-security {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: #a1a1aa;
}

/* 界面语言 slim 卡 */
.uc-language-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
}

.uc-language-card > strong {
  font-size: 14px;
  font-weight: 800;
  color: #18181b;
}

.uc-language {
  display: flex;
  gap: 4px;
  border-radius: 12px;
  background: #f4f4f5;
  padding: 3px;
}

.uc-language button {
  border: none;
  border-radius: 9px;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  background: transparent;
  color: #71717a;
}

.uc-language button.active {
  background: #f97316;
  color: #fff;
}

.uc-logout {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  margin-top: 2px;
  padding: 6px 4px 12px;
  border: none;
  background: none;
  color: #dc2626;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.uc-empty {
  margin: 6px 0 0;
  font-size: 12px;
  color: #a1a1aa;
}

.uc-fade-enter-active,
.uc-fade-leave-active {
  transition: opacity 0.2s;
}

.uc-fade-enter-from,
.uc-fade-leave-to {
  opacity: 0;
}

.uc-slide-enter-active,
.uc-slide-leave-active {
  transition: transform 0.24s ease;
}

.uc-slide-enter-from,
.uc-slide-leave-to {
  transform: translateX(100%);
}
</style>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { NButton, NInput, useMessage } from 'naive-ui';
import { ArrowLeft, Gift, RefreshCcw } from 'lucide-vue-next';
import { getBalanceLogs, getUserProfile, redeemCode, type BalanceLog } from '../api/user';
import type { AuthUser } from '../api/auth';
import { getApiErrorMessage } from '../api/http';
import { legacyUrl } from '../config/legacy';

const message = useMessage();
const user = ref<AuthUser | null>(null);
const logs = ref<BalanceLog[]>([]);
const code = ref('');
const loading = ref(true);
const redeeming = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

function friendlyError(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback, { unauthorized: '请先登录后兑换。' });
}

function formatDate(raw?: string) {
  if (!raw) return '未知时间';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('zh-CN', { hour12: false });
}

async function loadRedeemPage() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [profile, balanceLogs] = await Promise.all([getUserProfile(), getBalanceLogs()]);
    user.value = profile;
    logs.value = balanceLogs;
  } catch (error) {
    errorMessage.value = friendlyError(error, '兑换页加载失败');
  } finally {
    loading.value = false;
  }
}

async function submitRedeem() {
  const value = code.value.trim();
  if (!value) {
    message.warning('请输入兑换码');
    return;
  }
  redeeming.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const result = await redeemCode(value);
    successMessage.value = `兑换成功，获得 ${result.amount} 算力，当前余额 ${result.balance}`;
    message.success(successMessage.value);
    code.value = '';
    await loadRedeemPage();
  } catch (error) {
    errorMessage.value = friendlyError(error, '兑换失败');
    message.error(errorMessage.value);
  } finally {
    redeeming.value = false;
  }
}

onMounted(loadRedeemPage);
</script>

<template>
  <main class="redeem-source-shell">
    <header class="user-topbar">
      <RouterLink to="/user/center" class="template-back"><ArrowLeft :size="16" />用户中心</RouterLink>
      <div>
        <p class="eyebrow">Redeem</p>
        <h1>兑换码</h1>
      </div>
      <a class="legacy-link" :href="legacyUrl('/user/redeem')">旧版页面</a>
    </header>

    <section class="redeem-layout">
      <section class="redeem-card">
        <div class="redeem-icon"><Gift :size="28" /></div>
        <h2>兑换算力</h2>
        <p>输入后台发放的兑换码，成功后算力会立即写入账户余额。</p>
        <div class="redeem-balance">
          <span>当前算力</span>
          <strong>{{ user?.balance ?? user?.credits ?? 0 }}</strong>
        </div>
        <div class="redeem-form">
          <n-input v-model:value="code" placeholder="请输入兑换码" @keyup.enter="submitRedeem" />
          <n-button type="primary" :loading="redeeming" @click="submitRedeem">立即兑换</n-button>
        </div>
        <div v-if="errorMessage" class="auth-error">{{ errorMessage }}</div>
        <div v-if="successMessage" class="redeem-success">{{ successMessage }}</div>
      </section>

      <section class="records-panel">
        <div class="panel-title">
          <strong>最近流水</strong>
          <small>{{ logs.length }} 条</small>
        </div>
        <n-button class="redeem-refresh" secondary :loading="loading" @click="loadRedeemPage">
          <template #icon><RefreshCcw :size="16" /></template>
          刷新
        </n-button>
        <div v-if="logs.length" class="balance-log-list">
          <article v-for="log in logs.slice(0, 8)" :key="`${log.id || log.created_at || log.createdAt}-${log.remark}`">
            <div>
              <strong>{{ log.remark || log.type || '余额变动' }}</strong>
              <small>{{ formatDate(log.created_at || log.createdAt) }}</small>
            </div>
            <span :class="{ positive: Number(log.change_amount ?? log.changeAmount ?? 0) > 0 }">
              {{ Number(log.change_amount ?? log.changeAmount ?? 0) > 0 ? '+' : '' }}{{ Number(log.change_amount ?? log.changeAmount ?? 0) }}
            </span>
          </article>
        </div>
        <div v-else class="user-empty-state">暂无余额流水。</div>
      </section>
    </section>
  </main>
</template>

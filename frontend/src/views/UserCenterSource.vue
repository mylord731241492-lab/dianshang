<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton } from 'naive-ui';
import { ArrowLeft, Coins, GalleryHorizontal, LogOut, RefreshCcw, ShieldCheck, UserCircle } from 'lucide-vue-next';
import { clearAuthSession, readAuthUser, type AuthUser } from '../api/auth';
import { getApiErrorMessage } from '../api/http';
import { getBalanceLogs, getUserApiStatus, getUserProfile, type ApiStatus, type BalanceLog } from '../api/user';
import { legacyUrl } from '../config/legacy';

const router = useRouter();
const loading = ref(true);
const user = ref<AuthUser | null>(readAuthUser());
const logs = ref<BalanceLog[]>([]);
const apiStatus = ref<ApiStatus | null>(null);
const errorMessage = ref('');

const initials = computed(() => (user.value?.username || 'U').slice(0, 1).toUpperCase());
const balance = computed(() => Number(user.value?.balance ?? user.value?.credits ?? 0));
const recentLogs = computed(() => logs.value.slice(0, 8));

const statCards = computed(() => [
  { label: '当前算力', value: String(balance.value), icon: Coins },
  { label: '账号角色', value: user.value?.role || 'user', icon: ShieldCheck },
  { label: '流水记录', value: String(logs.value.length), icon: GalleryHorizontal }
]);

function friendlyError(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback, { unauthorized: '请先登录后查看用户中心。' });
}

function formatDate(raw?: string) {
  if (!raw) return '未知时间';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function logAmount(log: BalanceLog) {
  const amount = Number(log.change_amount ?? log.changeAmount ?? 0);
  return amount > 0 ? `+${amount}` : String(amount);
}

async function loadUserCenter() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [profile, balanceLogs, status] = await Promise.all([
      getUserProfile(),
      getBalanceLogs(),
      getUserApiStatus()
    ]);
    user.value = profile;
    window.localStorage.setItem('auth_user', JSON.stringify(profile));
    logs.value = balanceLogs;
    apiStatus.value = status;
  } catch (error) {
    errorMessage.value = friendlyError(error, '用户中心加载失败');
  } finally {
    loading.value = false;
  }
}

async function logout() {
  clearAuthSession();
  await router.replace('/login');
}

onMounted(loadUserCenter);
</script>

<template>
  <main class="user-source-shell">
    <header class="user-topbar">
      <RouterLink to="/" class="template-back"><ArrowLeft :size="16" />返回首页</RouterLink>
      <div>
        <p class="eyebrow">User Center</p>
        <h1>用户中心</h1>
      </div>
      <a class="legacy-link" :href="legacyUrl('/user/center')">旧版页面</a>
    </header>

    <section class="user-layout">
      <aside class="user-profile-card">
        <div class="user-avatar">
          <img v-if="user?.avatarUrl" :src="user.avatarUrl" alt="" />
          <span v-else>{{ initials }}</span>
        </div>
        <h2>{{ user?.username || '未登录用户' }}</h2>
        <p>{{ user?.email || '暂无邮箱' }}</p>
        <div class="user-role">{{ user?.role || 'user' }}</div>
        <div class="user-actions">
          <n-button type="primary" block @click="router.push('/template-image')">模板生图</n-button>
          <n-button secondary block @click="router.push('/gallery')">图库历史</n-button>
          <n-button tertiary block type="error" @click="logout">
            <template #icon><LogOut :size="15" /></template>
            退出登录
          </n-button>
        </div>
      </aside>

      <section class="user-main-panel">
        <div class="user-panel-head">
          <div>
            <p class="eyebrow">Account Overview</p>
            <h2>账户概览</h2>
          </div>
          <n-button secondary :loading="loading" @click="loadUserCenter">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
        </div>

        <div v-if="errorMessage" class="template-error">{{ errorMessage }}</div>

        <div class="user-stats">
          <article v-for="stat in statCards" :key="stat.label">
            <component :is="stat.icon" :size="20" />
            <span>{{ stat.label }}</span>
            <strong>{{ stat.value }}</strong>
          </article>
        </div>

        <section class="api-status-card">
          <div>
            <UserCircle :size="20" />
            <strong>{{ apiStatus?.provider?.displayName || apiStatus?.provider?.name || '默认 API 线路' }}</strong>
          </div>
          <p>
            {{ apiStatus?.provider?.defaultImageModel || '默认图片模型' }}
            · {{ apiStatus?.mock ? 'Mock 回落' : '真实/自动模式' }}
            · {{ apiStatus?.status || 'unknown' }}
          </p>
        </section>

        <section class="balance-log-panel">
          <div class="panel-title">
            <strong>余额流水</strong>
            <small>{{ logs.length }} 条</small>
          </div>
          <div v-if="recentLogs.length" class="balance-log-list">
            <article v-for="log in recentLogs" :key="`${log.id || log.created_at || log.createdAt}-${log.remark}`">
              <div>
                <strong>{{ log.remark || log.type || '余额变动' }}</strong>
                <small>{{ formatDate(log.created_at || log.createdAt) }}</small>
              </div>
              <span :class="{ positive: Number(log.change_amount ?? log.changeAmount ?? 0) > 0 }">
                {{ logAmount(log) }}
              </span>
            </article>
          </div>
          <div v-else class="user-empty-state">
            暂无余额流水。
          </div>
        </section>
      </section>
    </section>
  </main>
</template>

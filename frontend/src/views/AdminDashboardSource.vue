<script setup lang="ts">
import AdminStatGrid from '../components/admin/AdminStatGrid.vue';
import AdminPanel from '../components/admin/AdminPanel.vue';
import AdminEmptyState from '../components/admin/AdminEmptyState.vue';
import AdminFeedback from '../components/admin/AdminFeedback.vue';
import AdminPageHeader from '../components/admin/AdminPageHeader.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton } from 'naive-ui';
import { Activity, BarChart3, Coins, Image, RefreshCcw, Route, Trophy, Users } from 'lucide-vue-next';
import { getAdminCreditRanking, getAdminDashboard, type AdminDashboardResponse, type AdminRankingUser } from '../api/adminDashboard';
import { clearAdminAuthSession } from '../api/adminAuth';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
const dashboard = ref<AdminDashboardResponse | null>(null);
const ranking = ref<AdminRankingUser[]>([]);

const summary = computed(() => dashboard.value?.summary || dashboard.value?.stats || {});
const modelUsage = computed(() => dashboard.value?.modelUsage?.list || []);
const routeUsage = computed(() => dashboard.value?.routeUsage?.list || []);
const recentTasks = computed(() => dashboard.value?.recentTasks || []);

const statCards = computed(() => [
  { label: '用户总数', value: pickNumber(summary.value.totalUsers, summary.value.userTotal), icon: Users },
  { label: '生成任务', value: pickNumber(summary.value.totalGenerations, summary.value.generationTotal), icon: Image },
  { label: '消耗算力', value: pickNumber(summary.value.totalConsumedPoints, summary.value.totalCost), icon: Coins },
  { label: '活跃用户', value: pickNumber(summary.value.activeUsers), icon: Activity },
  { label: '线路数量', value: pickNumber(summary.value.routeCount), icon: Route },
  { label: '模型数量', value: pickNumber(summary.value.modelCount), icon: BarChart3 }
]);

function pickNumber(...values: Array<number | undefined>) {
  const value = values.find((item) => Number.isFinite(Number(item)));
  return Number(value || 0);
}

function formatNumber(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatDate(raw?: string) {
  if (!raw) return '未知时间';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, '后台控制台加载失败', {
    unauthorized: '请先使用管理员账号登录。',
    forbidden: '当前账号不是管理员。'
  });
}

async function loadDashboard() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [dashboardData, rankingData] = await Promise.all([getAdminDashboard(), getAdminCreditRanking()]);
    dashboard.value = dashboardData;
    ranking.value = rankingData.length ? rankingData : dashboardData.ranking?.list || [];
  } catch (error) {
    errorMessage.value = friendlyError(error);
  } finally {
    loading.value = false;
  }
}

async function logout() {
  clearAdminAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadDashboard);
</script>

<template>
  <AdminPageShell>
    <AdminPageHeader eyebrow="Admin Dashboard" title="控制台 Dashboard" description="系统概览、模型使用、线路统计和用户排行">
      <template #actions>
          <n-button secondary :loading="loading" @click="loadDashboard">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
      </template>
    </AdminPageHeader>

    <AdminFeedback :error-message="errorMessage" />

      <AdminStatGrid :stats="statCards" label="后台统计" />

      <section class="admin-dashboard-grid">
        <AdminPanel eyebrow="Model Usage" title="模型使用">
          <div class="admin-usage-list">
            <div v-for="item in modelUsage.slice(0, 6)" :key="item.modelKey || item.modelName || item.model">
              <span>{{ item.modelName || item.modelKey || item.model || 'unknown' }}</span>
              <strong>{{ formatNumber(item.totalCredits || item.points) }}</strong>
              <em :style="{ width: `${Math.min(100, item.percent || 0)}%` }"></em>
            </div>
            <AdminEmptyState v-if="!modelUsage.length" message="暂无模型使用记录" />
          </div>
        </AdminPanel>

        <AdminPanel eyebrow="Route Usage" title="线路概览">
          <div class="admin-route-list">
            <div v-for="route in routeUsage.slice(0, 6)" :key="route.routeId || route.routeKey">
              <span>{{ route.routeName || route.routeKey || '默认线路' }}</span>
              <small>{{ formatNumber(route.totalCount) }} 次 · 失败 {{ formatNumber(route.failCount) }}</small>
              <strong>{{ formatNumber(route.totalCredits) }}</strong>
            </div>
            <AdminEmptyState v-if="!routeUsage.length" message="暂无线路统计" />
          </div>
        </AdminPanel>
      </section>

      <section class="admin-dashboard-grid wide">
        <AdminPanel eyebrow="Credit Ranking" title="用户消耗排行">
          <template #actions>
            <Trophy :size="20" />
          </template>
          <div class="admin-table-list ranking">
            <div v-for="user in ranking.slice(0, 8)" :key="`${user.rank}-${user.username}`">
              <strong>#{{ user.rank || '-' }}</strong>
              <span>{{ user.username || 'unknown' }}</span>
              <small>{{ user.email || '暂无邮箱' }}</small>
              <em>{{ formatNumber(user.consumedPoints || user.totalCredits) }}</em>
            </div>
            <AdminEmptyState v-if="!ranking.length" message="暂无用户排行" />
          </div>
        </AdminPanel>

        <AdminPanel eyebrow="Recent Tasks" title="最近生成任务">
          <div class="admin-table-list tasks">
            <div v-for="task in recentTasks.slice(0, 8)" :key="task.id">
              <strong>{{ task.status || 'unknown' }}</strong>
              <span>{{ task.prompt || '暂无提示词' }}</span>
              <small>{{ task.model || task.modelKey || 'unknown' }} · {{ formatDate(task.createdAt || task.created_at) }}</small>
              <em>{{ formatNumber(task.cost) }}</em>
            </div>
            <AdminEmptyState v-if="!recentTasks.length" message="暂无生成任务" />
          </div>
        </AdminPanel>
      </section>
  </AdminPageShell>
</template>

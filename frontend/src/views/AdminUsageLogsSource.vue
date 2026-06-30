<script setup lang="ts">
import AdminSourceSidebar from '../components/AdminSourceSidebar.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NPagination, NSelect, NTag } from 'naive-ui';
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, Coins, RefreshCcw, Search } from 'lucide-vue-next';
import { clearAuthSession } from '../api/auth';
import { getAdminUsageLogs, type AdminUsageLog } from '../api/adminUsageLogs';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
const logs = ref<AdminUsageLog[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref('');
const typeFilter = ref('all');

const typeOptions = [
  { label: '全部类型', value: 'all' },
  { label: '注册赠送', value: 'register_gift' },
  { label: '生成消耗', value: 'generation' },
  { label: '兑换码', value: 'redeem' },
  { label: '管理员调整', value: 'admin_adjust' }
];

const visibleLogs = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return logs.value.filter((log) => {
    const typeMatched = typeFilter.value === 'all' || log.type === typeFilter.value;
    if (!typeMatched) return false;
    if (!q) return true;
    return [
      log.id,
      log.userId,
      log.user_id,
      log.username,
      log.type,
      log.remark,
      log.changeAmount,
      log.change_amount
    ].some((value) => String(value || '').toLowerCase().includes(q));
  });
});

const statCards = computed(() => {
  const income = logs.value
    .filter((log) => amountOf(log) > 0)
    .reduce((sum, log) => sum + amountOf(log), 0);
  const outcome = logs.value
    .filter((log) => amountOf(log) < 0)
    .reduce((sum, log) => sum + Math.abs(amountOf(log)), 0);
  const generationCount = logs.value.filter((log) => log.type === 'generation').length;
  const redeemCount = logs.value.filter((log) => log.type === 'redeem').length;
  return [
    { label: '日志总数', value: total.value, icon: Coins },
    { label: '当前页收入', value: income, icon: ArrowUpCircle },
    { label: '当前页消耗', value: outcome, icon: ArrowDownCircle },
    { label: '生成记录', value: generationCount, icon: ArrowDownCircle },
    { label: '兑换记录', value: redeemCount, icon: ArrowUpCircle }
  ];
});

function amountOf(log: AdminUsageLog) {
  return Number(log.changeAmount ?? log.change_amount ?? 0);
}

function beforeOf(log: AdminUsageLog) {
  return Number(log.beforeBalance ?? log.before_balance ?? 0);
}

function afterOf(log: AdminUsageLog) {
  return Number(log.afterBalance ?? log.after_balance ?? 0);
}

function formatNumber(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatAmount(value?: number) {
  const number = Number(value || 0);
  const sign = number > 0 ? '+' : '';
  return `${sign}${number.toLocaleString('zh-CN')}`;
}

function formatDate(raw?: string) {
  if (!raw) return '未知时间';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function typeLabel(type?: string) {
  const labels: Record<string, string> = {
    register_gift: '注册赠送',
    generation: '生成消耗',
    redeem: '兑换码',
    admin_adjust: '管理员调整'
  };
  return labels[type || ''] || type || '未知类型';
}

function typeTag(type?: string) {
  if (type === 'generation') return 'warning';
  if (type === 'redeem' || type === 'register_gift') return 'success';
  if (type === 'admin_adjust') return 'info';
  return 'default';
}

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, '消费日志加载失败', {
    unauthorized: '请先使用管理员账号登录。',
    forbidden: '当前账号不是管理员。'
  });
}

async function loadLogs() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await getAdminUsageLogs({
      page: page.value,
      pageSize: pageSize.value
    });
    logs.value = data.logs;
    total.value = data.total;
    page.value = data.page;
    pageSize.value = data.pageSize;
  } catch (error) {
    errorMessage.value = friendlyError(error);
  } finally {
    loading.value = false;
  }
}

async function applyFilters() {
  page.value = 1;
  await loadLogs();
}

async function logout() {
  clearAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadLogs);
</script>

<template>
  <main class="admin-source-shell">
    <AdminSourceSidebar />

    <section class="admin-source-main">
      <header class="admin-source-topbar">
        <div>
          <RouterLink to="/" class="template-back"><ArrowLeft :size="16" />迁移索引</RouterLink>
          <p class="eyebrow">Usage Logs</p>
          <h1>消费日志</h1>
          <span>只读迁移版：查看算力收入、消耗、兑换和调整流水，不执行余额修改。</span>
        </div>
        <div class="admin-source-actions">
          <n-button secondary :loading="loading" @click="loadLogs">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
        </div>
      </header>

      <div v-if="errorMessage" class="template-error">{{ errorMessage }}</div>

      <section class="admin-stat-grid users" aria-label="消费日志统计">
        <article v-for="stat in statCards" :key="stat.label">
          <component :is="stat.icon" :size="20" />
          <span>{{ stat.label }}</span>
          <strong>{{ formatNumber(stat.value) }}</strong>
        </article>
      </section>

      <section class="admin-source-panel admin-logs-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Read Only Ledger</p>
            <h2>流水列表</h2>
          </div>
          <n-tag type="info" :bordered="false">只读</n-tag>
        </div>

        <div class="admin-logs-toolbar">
          <n-input v-model:value="keyword" clearable placeholder="搜索备注 / 用户 ID / 类型" @keyup.enter="applyFilters">
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-select v-model:value="typeFilter" :options="typeOptions" />
          <n-button type="primary" :loading="loading" @click="applyFilters">查询</n-button>
        </div>

        <div class="admin-logs-list" aria-label="消费日志列表">
          <article v-for="log in visibleLogs" :key="log.id">
            <div class="admin-log-icon" :class="{ negative: amountOf(log) < 0 }">
              <ArrowDownCircle v-if="amountOf(log) < 0" :size="20" />
              <ArrowUpCircle v-else :size="20" />
            </div>
            <div class="admin-log-main">
              <strong>{{ log.remark || '暂无备注' }}</strong>
              <span>{{ log.userId || log.user_id || 'unknown-user' }}</span>
              <small>ID: {{ log.id }}</small>
            </div>
            <div class="admin-log-type">
              <n-tag :type="typeTag(log.type)" size="small">{{ typeLabel(log.type) }}</n-tag>
              <span>{{ formatDate(log.createdAt || log.created_at) }}</span>
            </div>
            <div class="admin-log-amount" :class="{ negative: amountOf(log) < 0 }">
              <span>变动</span>
              <strong>{{ formatAmount(amountOf(log)) }}</strong>
            </div>
            <div class="admin-log-balance">
              <span>变动前</span>
              <strong>{{ formatNumber(beforeOf(log)) }}</strong>
              <span>变动后</span>
              <strong>{{ formatNumber(afterOf(log)) }}</strong>
            </div>
          </article>
          <p v-if="!visibleLogs.length && !loading" class="admin-empty">暂无匹配流水</p>
        </div>

        <div class="admin-users-pagination">
          <span>共 {{ formatNumber(total) }} 条流水</span>
          <n-pagination
            v-model:page="page"
            :page-size="pageSize"
            :item-count="total"
            :page-slot="5"
            @update:page="loadLogs"
          />
        </div>
      </section>
    </section>
  </main>
</template>

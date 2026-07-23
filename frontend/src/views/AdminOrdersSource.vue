<script setup lang="ts">
import AdminToolbar from '../components/admin/AdminToolbar.vue';
import AdminEmptyState from '../components/admin/AdminEmptyState.vue';
import AdminFeedback from '../components/admin/AdminFeedback.vue';
import AdminPageHeader from '../components/admin/AdminPageHeader.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NAlert, NButton, NInput, NPagination, NSelect, NTag } from 'naive-ui';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  PackageCheck,
  ReceiptText,
  RefreshCcw,
  Search,
  XCircle
} from 'lucide-vue-next';
import { clearAdminAuthSession } from '../api/adminAuth';
import { getAdminOrders, type AdminOrder } from '../api/adminOrders';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
const orders = ref<AdminOrder[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref('');
const statusFilter = ref('all');
const ordersAvailable = ref(false);
const availabilityMessage = ref('');

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '已支付', value: 'paid' },
  { label: '待支付', value: 'pending' },
  { label: '已关闭', value: 'closed' }
];

const visibleOrders = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return orders.value.filter((order) => {
    const statusMatched = statusFilter.value === 'all' || order.status === statusFilter.value;
    if (!statusMatched) return false;
    if (!q) return true;
    return [
      order.id,
      order.orderNo,
      order.userId,
      order.username,
      order.email,
      order.payMethod,
      order.status
    ].some((value) => String(value || '').toLowerCase().includes(q));
  });
});

const statCards = computed(() => {
  const paid = orders.value.filter((order) => order.status === 'paid').length;
  const pending = orders.value.filter((order) => order.status === 'pending').length;
  const closed = orders.value.filter((order) => order.status === 'closed').length;
  const amount = orders.value.reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const credits = orders.value.reduce((sum, order) => sum + Number(order.credits || 0), 0);
  return [
    { label: '订单总数', value: total.value, icon: ReceiptText, formatter: formatNumber },
    { label: '当前页金额', value: amount, icon: CreditCard, formatter: formatMoney },
    { label: '已支付', value: paid, icon: CheckCircle2, formatter: formatNumber },
    { label: '待支付', value: pending, icon: Clock3, formatter: formatNumber },
    { label: '已关闭', value: closed, icon: XCircle, formatter: formatNumber },
    { label: '当前页算力', value: credits, icon: PackageCheck, formatter: formatNumber }
  ];
});

function formatNumber(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatMoney(value?: number) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(raw?: string) {
  if (!raw) return '未支付';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function statusType(status?: string) {
  if (status === 'paid') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'closed') return 'error';
  return 'default';
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    paid: '已支付',
    pending: '待支付',
    closed: '已关闭'
  };
  return labels[status || ''] || status || '未知';
}

function payMethodLabel(method?: string) {
  const labels: Record<string, string> = {
    wechat: '微信',
    alipay: '支付宝',
    stripe: 'Stripe'
  };
  return labels[method || ''] || method || '未记录';
}

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, '订单列表加载失败', {
    unauthorized: '请先使用管理员账号登录。',
    forbidden: '当前账号不是管理员。'
  });
}

async function loadOrders() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await getAdminOrders({
      page: page.value,
      pageSize: pageSize.value
    });
    orders.value = data.orders;
    ordersAvailable.value = data.available;
    availabilityMessage.value = data.message || '';
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
  await loadOrders();
}

async function logout() {
  clearAdminAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadOrders);
</script>

<template>
  <AdminPageShell>
    <AdminPageHeader eyebrow="Orders" title="订单管理" description="仅展示真实支付订单；支付未接入时不生成演示订单。">
      <template #actions>
          <n-button secondary :loading="loading" @click="loadOrders">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
      </template>
    </AdminPageHeader>

    <AdminFeedback :error-message="errorMessage" />

      <n-alert v-if="!ordersAvailable && availabilityMessage" type="warning" :bordered="false">
        {{ availabilityMessage }}
      </n-alert>

      <section class="admin-stat-grid" aria-label="订单统计">
        <article v-for="stat in statCards" :key="stat.label">
          <component :is="stat.icon" :size="20" />
          <span>{{ stat.label }}</span>
          <strong>{{ stat.formatter(stat.value) }}</strong>
        </article>
      </section>

      <section class="admin-source-panel admin-orders-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Read Only Orders</p>
            <h2>订单列表</h2>
          </div>
          <n-tag type="info" :bordered="false">只读</n-tag>
        </div>

        <AdminToolbar class="admin-orders-toolbar">
          <n-input
            v-model:value="keyword"
            clearable
            placeholder="搜索订单号 / 用户 / 邮箱"
            @keyup.enter="applyFilters"
          >
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-select v-model:value="statusFilter" :options="statusOptions" @update:value="applyFilters" />
          <n-button type="primary" :loading="loading" @click="applyFilters">查询</n-button>
        </AdminToolbar>

        <div class="admin-orders-list" aria-label="订单列表">
          <article v-for="order in visibleOrders" :key="order.id">
            <div class="admin-order-icon" :class="order.status || 'unknown'">
              <ReceiptText :size="20" />
            </div>
            <div class="admin-order-main">
              <strong>{{ order.orderNo || order.id }}</strong>
              <span>{{ order.username || 'unknown' }} · {{ order.email || 'no-email' }}</span>
              <small>ID: {{ order.id }} · 用户: {{ order.userId || 'unknown-user' }}</small>
            </div>
            <div class="admin-order-status">
              <n-tag :type="statusType(order.status)" size="small">{{ statusLabel(order.status) }}</n-tag>
              <span>{{ payMethodLabel(order.payMethod) }}</span>
            </div>
            <div class="admin-order-money">
              <span>金额</span>
              <strong>{{ formatMoney(order.amount) }}</strong>
              <span>算力 {{ formatNumber(order.credits) }}</span>
            </div>
            <div class="admin-order-time">
              <span>创建</span>
              <strong>{{ formatDate(order.createdAt) }}</strong>
              <span>支付</span>
              <strong>{{ formatDate(order.paidAt) }}</strong>
            </div>
          </article>
          <AdminEmptyState v-if="!visibleOrders.length && !loading" :message="ordersAvailable ? '暂无匹配订单' : '支付未启用，暂无真实订单'" />
        </div>

        <div class="admin-users-pagination">
          <span>共 {{ formatNumber(total) }} 个订单</span>
          <n-pagination
            v-model:page="page"
            :page-size="pageSize"
            :item-count="total"
            :page-slot="5"
            @update:page="loadOrders"
          />
        </div>
      </section>
  </AdminPageShell>
</template>

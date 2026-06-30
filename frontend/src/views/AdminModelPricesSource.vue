<script setup lang="ts">
import AdminSourceSidebar from '../components/AdminSourceSidebar.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NPagination, NSelect, NTag } from 'naive-ui';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Coins,
  Image,
  PackageCheck,
  RefreshCcw,
  Search,
} from 'lucide-vue-next';
import { clearAuthSession } from '../api/auth';
import { getAdminModelPrices, type AdminModelPriceModel, type AdminModelPriceRoute } from '../api/adminModelPrices';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
const routes = ref<AdminModelPriceRoute[]>([]);
const models = ref<AdminModelPriceModel[]>([]);
const total = ref(0);
const totalModels = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref('');
const typeFilter = ref('all');

const typeOptions = [
  { label: '全部类型', value: 'all' },
  { label: '图片模型', value: 'image' },
  { label: '文本模型', value: 'text' },
  { label: '启用中', value: 'active' },
  { label: '已禁用', value: 'disabled' }
];

const visibleModels = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return models.value.filter((model) => {
    const type = modelTypeOf(model);
    const enabled = enabledOf(model);
    const typeMatched =
      typeFilter.value === 'all' ||
      typeFilter.value === type ||
      (typeFilter.value === 'active' && enabled) ||
      (typeFilter.value === 'disabled' && !enabled);
    if (!typeMatched) return false;
    if (!q) return true;
    return [
      model.id,
      model.modelKey,
      model.realName,
      model.displayName,
      model.routeKey,
      model.routeName,
      type,
      priceOf(model)
    ].some((value) => String(value || '').toLowerCase().includes(q));
  });
});

const statCards = computed(() => {
  const enabled = models.value.filter(enabledOf).length;
  const imageCount = models.value.filter((model) => modelTypeOf(model) === 'image').length;
  const textCount = models.value.filter((model) => modelTypeOf(model) === 'text').length;
  const pagePrice = visibleModels.value.reduce((sum, model) => sum + priceOf(model), 0);
  return [
    { label: '线路数量', value: total.value || routes.value.length, icon: Activity },
    { label: '模型总数', value: totalModels.value || models.value.length, icon: PackageCheck },
    { label: '启用模型', value: enabled, icon: CheckCircle2 },
    { label: '图片模型', value: imageCount, icon: Image },
    { label: '文本模型', value: textCount, icon: Activity },
    { label: '当前筛选总价', value: pagePrice, icon: Coins }
  ];
});

function priceOf(model: AdminModelPriceModel) {
  return Number(model.pricePoints ?? model.pointCost ?? model.price ?? model.baseCredits ?? 0);
}

function modelTypeOf(model: AdminModelPriceModel) {
  return model.modelType || model.type || model.group || model.category || 'unknown';
}

function enabledOf(model: AdminModelPriceModel) {
  return model.enabled !== false && model.status !== 'disabled';
}

function formatNumber(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatPrice(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function typeLabel(type?: string) {
  const labels: Record<string, string> = {
    image: '图片',
    text: '文本'
  };
  return labels[type || ''] || type || '未知';
}

function typeTag(type?: string) {
  if (type === 'image') return 'success';
  if (type === 'text') return 'info';
  return 'default';
}

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, '模型价格加载失败', {
    unauthorized: '请先使用管理员账号登录。',
    forbidden: '当前账号不是管理员。'
  });
}

async function loadPrices() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await getAdminModelPrices({
      page: page.value,
      pageSize: pageSize.value
    });
    routes.value = data.routes;
    models.value = data.models;
    total.value = data.total;
    totalModels.value = data.totalModels;
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
  await loadPrices();
}

async function logout() {
  clearAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadPrices);
</script>

<template>
  <main class="admin-source-shell">
    <AdminSourceSidebar />

    <section class="admin-source-main">
      <header class="admin-source-topbar">
        <div>
          <RouterLink to="/" class="template-back"><ArrowLeft :size="16" />迁移索引</RouterLink>
          <p class="eyebrow">Model Prices</p>
          <h1>模型价格</h1>
          <span>只读迁移版：查看线路模型、价格点数、清晰度和启用状态，不保存、不新增、不删除。</span>
        </div>
        <div class="admin-source-actions">
          <n-button secondary :loading="loading" @click="loadPrices">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
        </div>
      </header>

      <div v-if="errorMessage" class="template-error">{{ errorMessage }}</div>

      <section class="admin-stat-grid" aria-label="模型价格统计">
        <article v-for="stat in statCards" :key="stat.label">
          <component :is="stat.icon" :size="20" />
          <span>{{ stat.label }}</span>
          <strong>{{ formatPrice(stat.value) }}</strong>
        </article>
      </section>

      <section class="admin-source-panel admin-model-prices-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Read Only Pricing</p>
            <h2>模型价格列表</h2>
          </div>
          <n-tag type="info" :bordered="false">只读</n-tag>
        </div>

        <div class="admin-model-prices-toolbar">
          <n-input v-model:value="keyword" clearable placeholder="搜索模型 / 线路 / 类型" @keyup.enter="applyFilters">
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-select v-model:value="typeFilter" :options="typeOptions" @update:value="applyFilters" />
          <n-button type="primary" :loading="loading" @click="applyFilters">查询</n-button>
        </div>

        <div class="admin-model-prices-list" aria-label="模型价格列表">
          <article v-for="model in visibleModels" :key="model.id">
            <div class="admin-model-price-icon" :class="{ disabled: !enabledOf(model) }">
              <Coins :size="20" />
            </div>
            <div class="admin-model-price-main">
              <strong>{{ model.displayName || model.modelKey || model.realName }}</strong>
              <span>{{ model.modelKey || model.realName || 'unknown-model' }}</span>
              <small>{{ model.routeName || model.routeKey || '默认线路' }}</small>
            </div>
            <div class="admin-model-price-type">
              <n-tag :type="typeTag(modelTypeOf(model))" size="small">{{ typeLabel(modelTypeOf(model)) }}</n-tag>
              <span>{{ enabledOf(model) ? '启用中' : '已禁用' }}</span>
            </div>
            <div class="admin-model-price-points">
              <span>价格点数</span>
              <strong>{{ formatPrice(priceOf(model)) }}</strong>
              <span>base {{ formatPrice(model.baseCredits) }}</span>
            </div>
            <div class="admin-model-price-meta">
              <span>清晰度</span>
              <strong>{{ (model.qualities || []).join(' / ') || '-' }}</strong>
              <span>ID: {{ model.id }}</span>
            </div>
          </article>
          <p v-if="!visibleModels.length && !loading" class="admin-empty">暂无匹配模型价格</p>
        </div>

        <div class="admin-users-pagination">
          <span>共 {{ formatNumber(totalModels || models.length) }} 个模型，{{ formatNumber(total || routes.length) }} 条线路</span>
          <n-pagination
            v-model:page="page"
            :page-size="pageSize"
            :item-count="total"
            :page-slot="5"
            @update:page="loadPrices"
          />
        </div>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import AdminToolbar from '../components/admin/AdminToolbar.vue';
import AdminEmptyState from '../components/admin/AdminEmptyState.vue';
import AdminFeedback from '../components/admin/AdminFeedback.vue';
import AdminPageHeader from '../components/admin/AdminPageHeader.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NInputNumber, NPagination, NSelect, NTag } from 'naive-ui';
import {
  Activity,
  CheckCircle2,
  Coins,
  Edit3,
  Image,
  PackageCheck,
  Plus,
  Power,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  XCircle
} from 'lucide-vue-next';
import { clearAdminAuthSession } from '../api/adminAuth';
import {
  createAdminRouteModel,
  deleteAdminRouteModel,
  getAdminModelPrices,
  setAdminRouteModelEnabled,
  updateAdminRouteModel,
  type AdminModelPriceModel,
  type AdminModelPricePayload,
  type AdminModelPriceRoute
} from '../api/adminModelPrices';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
const successMessage = ref('');
const saving = ref(false);
const actionLoadingId = ref('');
const routes = ref<AdminModelPriceRoute[]>([]);
const models = ref<AdminModelPriceModel[]>([]);
const total = ref(0);
const totalModels = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref('');
const typeFilter = ref('all');
const formOpen = ref(false);
const editingId = ref('');
const form = ref({
  routeId: '',
  modelKey: '',
  displayName: '',
  pricePoints: null as number | null,
  baseCredits: null as number | null,
  qualities: ''
});

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

const routeOptions = computed(() => routes.value.map((route) => ({
  label: route.routeDisplayName || route.displayName || route.routeName || route.name || route.routeKey || route.id,
  value: route.routeId || route.id
})));

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

function modelIdOf(model: AdminModelPriceModel) {
  return model.id || `${model.routeId}:${model.modelKey}`;
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

function resetForm() {
  editingId.value = '';
  form.value = {
    routeId: routeOptions.value[0]?.value || '',
    modelKey: '',
    displayName: '',
    pricePoints: null,
    baseCredits: null,
    qualities: ''
  };
}

function startCreate() {
  if (!routeOptions.value.length) {
    errorMessage.value = '请先在 API 线路管理中创建可用线路。';
    return;
  }
  resetForm();
  formOpen.value = true;
}

function startEdit(model: AdminModelPriceModel) {
  editingId.value = modelIdOf(model);
  form.value = {
    routeId: model.routeId || routeOptions.value[0]?.value || '',
    modelKey: model.modelKey || model.realName || '',
    displayName: model.displayName || model.modelKey || model.realName || '',
    pricePoints: priceOf(model),
    baseCredits: Number(model.baseCredits ?? priceOf(model)),
    qualities: (model.qualities || []).join(', ')
  };
  formOpen.value = true;
}

function cancelForm() {
  formOpen.value = false;
  resetForm();
}

function buildPayload(): AdminModelPricePayload {
  return {
    modelKey: form.value.modelKey.trim(),
    realName: form.value.modelKey.trim(),
    displayName: form.value.displayName.trim(),
    price: Number(form.value.pricePoints),
    pricePoints: Number(form.value.pricePoints),
    baseCredits: Number(form.value.baseCredits ?? form.value.pricePoints),
    qualities: form.value.qualities.split(/[,，/]/).map((item) => item.trim()).filter(Boolean)
  };
}

async function saveModel() {
  if (!form.value.routeId) {
    errorMessage.value = '请选择模型所属线路。';
    return;
  }
  if (!form.value.modelKey.trim() || !form.value.displayName.trim()) {
    errorMessage.value = '请填写模型标识和展示名称。';
    return;
  }
  const price = Number(form.value.pricePoints);
  if (!Number.isFinite(price) || price < 0) {
    errorMessage.value = '模型价格必须是大于或等于 0 的数字。';
    return;
  }
  saving.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = buildPayload();
    if (editingId.value) {
      await updateAdminRouteModel(editingId.value, payload);
    } else {
      await createAdminRouteModel(form.value.routeId, payload);
    }
    const message = editingId.value ? '模型价格已更新。' : '模型已新增。';
    cancelForm();
    await loadPrices();
    successMessage.value = message;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '模型价格保存失败');
  } finally {
    saving.value = false;
  }
}

async function toggleModel(model: AdminModelPriceModel) {
  const id = modelIdOf(model);
  const enabled = !enabledOf(model);
  actionLoadingId.value = `toggle:${id}`;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await setAdminRouteModelEnabled(id, enabled);
    await loadPrices();
    successMessage.value = enabled ? '模型已启用。' : '模型已禁用，前台线路将不再返回该模型。';
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '模型状态更新失败');
  } finally {
    actionLoadingId.value = '';
  }
}

async function removeModel(model: AdminModelPriceModel) {
  const id = modelIdOf(model);
  if (!window.confirm(`确认删除模型「${model.displayName || model.modelKey || id}」吗？删除后前台线路将不再返回该模型。`)) return;
  actionLoadingId.value = `delete:${id}`;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await deleteAdminRouteModel(id);
    await loadPrices();
    successMessage.value = '模型已删除。';
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '模型删除失败');
  } finally {
    actionLoadingId.value = '';
  }
}

async function applyFilters() {
  page.value = 1;
  await loadPrices();
}

async function logout() {
  clearAdminAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadPrices);
</script>

<template>
  <AdminPageShell>
    <AdminPageHeader eyebrow="Model Prices" title="模型价格" description="维护线路模型、价格点数、清晰度和启用状态；变更会直接影响前台可用模型。">
      <template #actions>
          <n-button type="primary" data-testid="open-model-price-form" @click="startCreate">
            <template #icon><Plus :size="16" /></template>
            新增模型
          </n-button>
          <n-button secondary :loading="loading" @click="loadPrices">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
      </template>
    </AdminPageHeader>

    <AdminFeedback :error-message="errorMessage" :success-message="successMessage" />

      <section v-if="formOpen" class="admin-source-panel admin-inline-action-panel admin-model-price-form-panel" data-testid="model-price-form">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Model Configuration</p>
            <h2>{{ editingId ? '编辑模型价格' : '新增线路模型' }}</h2>
          </div>
          <n-button secondary @click="cancelForm">
            <template #icon><XCircle :size="16" /></template>取消
          </n-button>
        </div>
        <form class="form-grid admin-model-price-form" @submit.prevent="saveModel">
          <label>
            所属线路 *
            <n-select v-model:value="form.routeId" :options="routeOptions" :disabled="Boolean(editingId)" />
          </label>
          <label>
            模型标识 *
            <n-input v-model:value="form.modelKey" :disabled="Boolean(editingId)" placeholder="例如 gpt-image-2" />
          </label>
          <label>
            展示名称 *
            <n-input v-model:value="form.displayName" placeholder="后台和前台显示名称" />
          </label>
          <label>
            价格点数 *
            <n-input-number v-model:value="form.pricePoints" :min="0" :show-button="false" placeholder="0 或正数" />
          </label>
          <label>
            基础点数
            <n-input-number v-model:value="form.baseCredits" :min="0" :show-button="false" placeholder="默认等于价格点数" />
          </label>
          <label>
            清晰度
            <n-input v-model:value="form.qualities" placeholder="例如 1k, 2k, 4k" />
          </label>
          <div class="source-actions admin-inline-action-submit">
            <n-button secondary @click="cancelForm">取消</n-button>
            <n-button type="primary" attr-type="submit" :loading="saving">
              <template #icon><Save :size="16" /></template>保存模型
            </n-button>
          </div>
        </form>
      </section>

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
            <p class="eyebrow">Writable Pricing</p>
            <h2>模型价格列表</h2>
          </div>
          <n-tag type="success" :bordered="false">实时配置</n-tag>
        </div>

        <AdminToolbar class="admin-model-prices-toolbar">
          <n-input v-model:value="keyword" clearable placeholder="搜索模型 / 线路 / 类型" @keyup.enter="applyFilters">
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-select v-model:value="typeFilter" :options="typeOptions" @update:value="applyFilters" />
          <n-button type="primary" :loading="loading" @click="applyFilters">查询</n-button>
        </AdminToolbar>

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
            <div class="admin-card-actions admin-model-price-actions">
              <n-button size="small" secondary @click="startEdit(model)">
                <template #icon><Edit3 :size="14" /></template>编辑
              </n-button>
              <n-button size="small" secondary :loading="actionLoadingId === `toggle:${modelIdOf(model)}`" @click="toggleModel(model)">
                <template #icon><Power :size="14" /></template>{{ enabledOf(model) ? '禁用' : '启用' }}
              </n-button>
              <n-button size="small" tertiary type="error" :loading="actionLoadingId === `delete:${modelIdOf(model)}`" @click="removeModel(model)">
                <template #icon><Trash2 :size="14" /></template>删除
              </n-button>
            </div>
          </article>
          <AdminEmptyState v-if="!visibleModels.length && !loading" message="暂无匹配模型价格" />
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
  </AdminPageShell>
</template>

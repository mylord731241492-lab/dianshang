<script setup lang="ts">
import AdminSourceSidebar from '../components/AdminSourceSidebar.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NPagination, NSelect, NTag } from 'naive-ui';
import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Image,
  KeyRound,
  ListTree,
  MessageSquare,
  PackageCheck,
  Plus,
  RefreshCcw,
  Route,
  Save,
  Search,
  Server,
  Star,
  TestTube2,
  Trash2,
  XCircle
} from 'lucide-vue-next';
import { clearAdminAuthSession } from '../api/adminAuth';
import {
  OFFICIAL_DUAL_API_PROVIDERS,
  createAdminApiProvider,
  deleteAdminApiProvider,
  fetchAdminApiProviderModels,
  getAdminApiProviders,
  replaceAdminApiProviders,
  setDefaultAdminApiProvider,
  testAdminApiProvider,
  updateAdminApiProvider,
  type AdminApiProvider,
  type AdminApiProviderPayload
} from '../api/adminApiProviders';
import { getApiErrorMessage } from '../api/http';
import { getProviderRequestExamples } from '../config/providerCapabilities';

interface ProviderForm {
  id: string;
  name: string;
  displayName: string;
  routeKey: string;
  category: string;
  apiFormat: string;
  baseUrl: string;
  apiKey: string;
  chatEndpoint: string;
  imageEndpoint: string;
  imageEditEndpoint: string;
  videoEndpoint: string;
  defaultTextModel: string;
  defaultImageModel: string;
  defaultVideoModel: string;
  priority: string;
  multiplier: string;
  enabled: boolean;
  isDefault: boolean;
  remark: string;
}

const router = useRouter();
const loading = ref(true);
const saving = ref(false);
const actionLoadingId = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const providers = ref<AdminApiProvider[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref('');
const typeFilter = ref('all');
const formOpen = ref(false);
const editingId = ref('');

const emptyForm = (): ProviderForm => ({
  id: '',
  name: '',
  displayName: '',
  routeKey: '',
  category: 'image',
  apiFormat: '',
  baseUrl: '',
  apiKey: '',
  chatEndpoint: '',
  imageEndpoint: '',
  imageEditEndpoint: '',
  videoEndpoint: '',
  defaultTextModel: '',
  defaultImageModel: '',
  defaultVideoModel: '',
  priority: '',
  multiplier: '',
  enabled: true,
  isDefault: false,
  remark: ''
});

const form = ref<ProviderForm>(emptyForm());

const typeOptions = [
  { label: '全部线路', value: 'all' },
  { label: '图片线路', value: 'image' },
  { label: '文本线路', value: 'text' },
  { label: '视频线路', value: 'video' },
  { label: '启用中', value: 'active' },
  { label: '已禁用', value: 'disabled' },
  { label: '默认线路', value: 'default' }
];

const categoryOptions = [
  { label: '图片渠道', value: 'image' },
  { label: '文字渠道', value: 'text' },
  { label: '视频渠道', value: 'video' }
];

const formatOptions = [
  { label: 'OpenAI 兼容', value: 'openai' },
  { label: 'OpenAI Images', value: 'openai-images' },
  { label: 'OpenAI Responses', value: 'openai-responses' },
  { label: 'New-API 兼容', value: 'new-api' }
];

const visibleProviders = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return providers.value.filter((provider) => {
    const type = providerTypeOf(provider);
    const enabled = enabledOf(provider);
    const isDefault = defaultOf(provider);
    const typeMatched =
      typeFilter.value === 'all' ||
      typeFilter.value === type ||
      (typeFilter.value === 'active' && enabled) ||
      (typeFilter.value === 'disabled' && !enabled) ||
      (typeFilter.value === 'default' && isDefault);
    if (!typeMatched) return false;
    if (!q) return true;
    return [
      provider.id,
      provider.routeId,
      provider.routeKey,
      provider.lineKey,
      provider.name,
      provider.displayName,
      provider.routeName,
      provider.baseUrl,
      provider.defaultModelKey,
      provider.defaultModelDisplayName,
      type,
      provider.status
    ].some((value) => String(value || '').toLowerCase().includes(q));
  });
});

const statCards = computed(() => {
  const enabled = providers.value.filter(enabledOf).length;
  const imageRoutes = providers.value.filter((provider) => providerTypeOf(provider) === 'image').length;
  const textRoutes = providers.value.filter((provider) => providerTypeOf(provider) === 'text').length;
  const defaults = providers.value.filter(defaultOf).length;
  const models = providers.value.reduce((sum, provider) => sum + modelCountOf(provider), 0);
  return [
    { label: '线路总数', value: total.value || providers.value.length, icon: Route },
    { label: '启用线路', value: enabled, icon: CheckCircle2 },
    { label: '图片线路', value: imageRoutes, icon: Image },
    { label: '文本线路', value: textRoutes, icon: MessageSquare },
    { label: '默认线路', value: defaults, icon: KeyRound },
    { label: '模型总数', value: models, icon: PackageCheck }
  ];
});

const officialRoutes = OFFICIAL_DUAL_API_PROVIDERS;

const defaultReferenceItems = [
  {
    label: 'Base URL',
    value: 'https://www.packyapi.com/v1',
    note: 'Packy / New-API 中转站根地址；保存时请按实际渠道域名替换。'
  },
  {
    label: '文生图接口',
    value: '/images/generations',
    note: '{"model":"gpt-image-2","prompt":"string","size":"1024x1024","quality":"auto","output_format":"png","response_format":"url","n":1}；n 固定 1，多张由后端循环。'
  },
  {
    label: '图生图接口',
    value: '/images/edits',
    note: 'multipart/form-data：model=gpt-image-2，image=<file>，mask=<file optional>，prompt=string，size=1024x1024，quality=auto，output_format=png，response_format=url，n=1。'
  },
  {
    label: '文本接口',
    value: '/responses',
    note: '{"model":"gpt-5.5","input":"string"}'
  }
];

const dualRouteReady = computed(() => {
  const currentKeys = new Set(providers.value.map((provider) => routeKeyOf(provider)));
  const currentModels = new Set(providers.value.map((provider) => provider.defaultModelKey || provider.defaultModelRealName || ''));
  return (
    providers.value.length === officialRoutes.length &&
    currentKeys.has('route_openai_gpt_image_2') &&
    currentKeys.has('route_openai_gpt_5_5') &&
    currentModels.has('gpt-image-2') &&
    currentModels.has('gpt-5.5')
  );
});

function providerTypeOf(provider: AdminApiProvider) {
  return provider.type || provider.category || provider.group || provider.modelType || 'unknown';
}

function enabledOf(provider: AdminApiProvider) {
  return provider.enabled !== false && provider.disabled !== true && provider.status !== 'disabled';
}

function defaultOf(provider: AdminApiProvider) {
  return provider.isDefault === true || provider.def === true;
}

function modelCountOf(provider: AdminApiProvider) {
  return Number(provider.modelCount ?? provider.models?.length ?? 0);
}

function providerNameOf(provider: AdminApiProvider) {
  return provider.displayName || provider.routeDisplayName || provider.routeName || provider.name || provider.dn || provider.routeKey || provider.id;
}

function providerIdOf(provider: AdminApiProvider) {
  return provider.id || provider.routeId || provider.lineId || routeKeyOf(provider);
}

function routeKeyOf(provider: AdminApiProvider) {
  return provider.routeKey || provider.lineKey || provider.routeCode || provider.code || provider.key || provider.rk || provider.id;
}

function formatNumber(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function typeLabel(type?: string) {
  const labels: Record<string, string> = {
    image: '图片',
    text: '文本',
    video: '视频'
  };
  return labels[type || ''] || type || '未知';
}

function typeTag(type?: string) {
  if (type === 'image') return 'success';
  if (type === 'text') return 'info';
  if (type === 'video') return 'warning';
  return 'default';
}

function endpointOf(provider: AdminApiProvider) {
  return provider.endpoint || provider.requestPath || (providerTypeOf(provider) === 'text' ? '/responses' : '/images/generations');
}

function requestExamplesOf(provider: AdminApiProvider) {
  const registeredExamples = getProviderRequestExamples(provider.defaultModelKey || provider.defaultModelRealName);
  if (registeredExamples.length && hasCorruptedExamples(provider)) return registeredExamples;
  if (provider.requestExamples?.length) return provider.requestExamples;
  if (registeredExamples.length) return registeredExamples;
  return [
    {
      label: providerTypeOf(provider) === 'text' ? '文本生成' : '文生图',
      endpoint: endpointOf(provider),
      requestFormat: requestFormatLabel(provider),
      contentType: providerTypeOf(provider) === 'text' ? 'application/json' : 'application/json',
      body: provider.requestBodyExample || fallbackRequestExample(provider)
    }
  ];
}

function hasCorruptedExamples(provider: AdminApiProvider) {
  return (provider.requestExamples || []).some((example) => {
    const label = String(example.label || '');
    const contentType = String(example.contentType || '');
    return label.includes('???') || contentType.includes('?') || label.includes('�') || contentType.includes('�');
  });
}

function requestFormatLabel(provider: AdminApiProvider) {
  return provider.requestFormat || provider.apiFormat || (providerTypeOf(provider) === 'text' ? 'openai-responses' : 'packy-openai-images-generations');
}

function fallbackRequestExample(provider: AdminApiProvider) {
  if (providerTypeOf(provider) === 'text') {
    return { model: 'gpt-5.5', input: 'string' };
  }
  return { model: 'gpt-image-2', prompt: 'string', size: '1024x1024', quality: 'auto', n: 1 };
}

function requestExampleText(example: Record<string, unknown>) {
  return JSON.stringify(example);
}

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, 'API 线路加载失败', {
    unauthorized: '请先使用管理员账号登录。',
    forbidden: '当前账号不是管理员。'
  });
}

function startCreate() {
  form.value = emptyForm();
  editingId.value = '';
  formOpen.value = true;
  successMessage.value = '';
  errorMessage.value = '';
}

function startEdit(provider: AdminApiProvider) {
  const type = providerTypeOf(provider);
  const providerEndpoint = provider.endpoint || provider.requestPath || '';
  form.value = {
    id: providerIdOf(provider),
    name: provider.name || provider.routeName || providerNameOf(provider),
    displayName: provider.displayName || provider.routeDisplayName || providerNameOf(provider),
    routeKey: routeKeyOf(provider),
    category: type === 'unknown' ? 'image' : type,
    apiFormat: provider.apiFormat || provider.requestFormat || '',
    baseUrl: provider.baseUrl || '',
    apiKey: '',
    chatEndpoint: provider.chatEndpoint || (type === 'text' ? providerEndpoint : ''),
    imageEndpoint: provider.imageEndpoint || (type === 'image' && providerEndpoint.includes('/generations') ? providerEndpoint : '/v1/images/generations'),
    imageEditEndpoint: provider.imageEditEndpoint || (type === 'image' && providerEndpoint.includes('/edits') ? providerEndpoint : '/v1/images/edits'),
    videoEndpoint: provider.videoEndpoint || (type === 'video' ? providerEndpoint : ''),
    defaultTextModel: provider.defaultTextModel || (type === 'text' ? provider.defaultModelKey || '' : ''),
    defaultImageModel: provider.defaultImageModel || (type === 'image' ? provider.defaultModelKey || '' : ''),
    defaultVideoModel: provider.defaultVideoModel || (type === 'video' ? provider.defaultModelKey || '' : ''),
    priority: provider.priority !== undefined || provider.pri !== undefined ? String(provider.priority ?? provider.pri) : '',
    multiplier: provider.multiplier !== undefined || provider.rate !== undefined ? String(provider.multiplier ?? provider.rate) : '',
    enabled: enabledOf(provider),
    isDefault: defaultOf(provider),
    remark: provider.remark || provider.note || ''
  };
  editingId.value = providerIdOf(provider);
  formOpen.value = true;
  successMessage.value = '';
  errorMessage.value = '';
}

function cancelForm() {
  form.value = emptyForm();
  editingId.value = '';
  formOpen.value = false;
}

function selectedDefaultModel() {
  if (form.value.category === 'text') return form.value.defaultTextModel.trim();
  if (form.value.category === 'video') return form.value.defaultVideoModel.trim();
  return form.value.defaultImageModel.trim();
}

function selectedEndpoint() {
  if (form.value.category === 'text') return form.value.chatEndpoint.trim();
  if (form.value.category === 'video') return form.value.videoEndpoint.trim();
  return form.value.imageEndpoint.trim() || form.value.imageEditEndpoint.trim();
}

async function copyReference(item: { label: string; value: string; note: string }) {
  const text = `${item.label}: ${item.value}\n${item.note}`;
  try {
    await navigator.clipboard.writeText(text);
    successMessage.value = `已复制 ${item.label} 默认格式；不会写入线路记录。`;
  } catch {
    errorMessage.value = '复制失败，请手动选中文本复制。';
  }
}

function buildPayload(): AdminApiProviderPayload {
  const payload: AdminApiProviderPayload = {
    name: form.value.name.trim() || form.value.displayName.trim(),
    displayName: form.value.displayName.trim() || form.value.name.trim(),
    routeKey: form.value.routeKey.trim(),
    code: form.value.routeKey.trim(),
    category: form.value.category,
    type: form.value.category,
    group: form.value.category,
    apiFormat: form.value.apiFormat,
    requestFormat: form.value.apiFormat,
    baseUrl: form.value.baseUrl.trim(),
    endpoint: selectedEndpoint(),
    requestPath: selectedEndpoint(),
    chatEndpoint: form.value.chatEndpoint.trim(),
    imageEndpoint: form.value.imageEndpoint.trim(),
    imageEditEndpoint: form.value.imageEditEndpoint.trim(),
    videoEndpoint: form.value.videoEndpoint.trim(),
    defaultModelKey: selectedDefaultModel(),
    defaultModelRealName: selectedDefaultModel(),
    defaultTextModel: form.value.defaultTextModel.trim(),
    defaultImageModel: form.value.defaultImageModel.trim(),
    defaultVideoModel: form.value.defaultVideoModel.trim(),
    priority: Number(form.value.priority || 0),
    pri: Number(form.value.priority || 0),
    multiplier: Number(form.value.multiplier || 1),
    enabled: form.value.enabled,
    status: form.value.enabled ? 'active' : 'disabled',
    isDefault: form.value.isDefault,
    def: form.value.isDefault,
    remark: form.value.remark.trim(),
    note: form.value.remark.trim()
  };
  if (form.value.apiKey.trim()) {
    payload.apiKey = form.value.apiKey.trim();
  }
  return payload;
}

function validateForm() {
  if (!form.value.routeKey.trim()) return '请填写线路标识 code。';
  if (!form.value.displayName.trim() && !form.value.name.trim()) return '请填写前端展示名称。';
  if (!form.value.baseUrl.trim()) return '请填写 Base URL。';
  if (!selectedEndpoint()) return '请填写当前渠道的接口路径。';
  if (!selectedDefaultModel()) return '请填写当前渠道的默认模型。';
  return '';
}

async function loadProviders() {
  loading.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const data = await getAdminApiProviders({
      page: page.value,
      pageSize: pageSize.value
    });
    providers.value = data.providers;
    total.value = data.total;
    page.value = data.page;
    pageSize.value = data.pageSize;
  } catch (error) {
    errorMessage.value = friendlyError(error);
  } finally {
    loading.value = false;
  }
}

async function saveProvider() {
  const validation = validateForm();
  if (validation) {
    errorMessage.value = validation;
    return;
  }
  saving.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = buildPayload();
    const item = editingId.value
      ? await updateAdminApiProvider(editingId.value, payload)
      : await createAdminApiProvider(payload);
    const message = editingId.value ? 'API 线路已保存。' : 'API 线路已新增。';
    if (payload.isDefault) {
      await setDefaultAdminApiProvider(providerIdOf(item));
    }
    cancelForm();
    await loadProviders();
    successMessage.value = message;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'API 线路保存失败');
  } finally {
    saving.value = false;
  }
}

async function removeProvider(provider: AdminApiProvider) {
  const confirmed = window.confirm(`确认删除 API 线路「${providerNameOf(provider)}」吗？删除后需要重新配置才能恢复。`);
  if (!confirmed) return;
  const id = providerIdOf(provider);
  actionLoadingId.value = `delete:${id}`;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await deleteAdminApiProvider(id);
    await loadProviders();
    successMessage.value = 'API 线路已删除。';
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'API 线路删除失败');
  } finally {
    actionLoadingId.value = '';
  }
}

async function makeDefault(provider: AdminApiProvider) {
  const id = providerIdOf(provider);
  actionLoadingId.value = `default:${id}`;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await setDefaultAdminApiProvider(id);
    const message = `已设为默认线路：${providerNameOf(provider)}。`;
    await loadProviders();
    successMessage.value = message;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '默认线路设置失败');
  } finally {
    actionLoadingId.value = '';
  }
}

async function fetchModels(provider: AdminApiProvider) {
  const id = providerIdOf(provider);
  actionLoadingId.value = `models:${id}`;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const models = await fetchAdminApiProviderModels(id);
    successMessage.value = `已读取 ${models.length} 个模型。当前兼容后端返回本地模型清单，后续接管 Provider Adapter 后再接真实渠道。`;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '模型读取失败');
  } finally {
    actionLoadingId.value = '';
  }
}

async function testProvider(provider: AdminApiProvider) {
  const confirmed = window.confirm('测试连接可能触发真实 Provider 请求。确认继续吗？');
  if (!confirmed) return;
  const id = providerIdOf(provider);
  actionLoadingId.value = `test:${id}`;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const result = await testAdminApiProvider(id);
    successMessage.value = result.message || `测试完成，耗时 ${result.latencyMs ?? 0}ms。`;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'API 线路测试失败');
  } finally {
    actionLoadingId.value = '';
  }
}

async function applyOfficialDualRoutes() {
  const confirmed = window.confirm(
    '将删除当前所有旧 API 线路，只保留 GPT Image 2 和 GPT 5.5 两条官方格式线路。此操作会写入本地后端配置，继续吗？'
  );
  if (!confirmed) return;
  saving.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const data = await replaceAdminApiProviders();
    providers.value = data.providers;
    total.value = data.total;
    page.value = data.page;
    pageSize.value = data.pageSize;
    successMessage.value = '已替换为官方双线路：GPT Image 2 使用 /images/generations 与 /images/edits，GPT 5.5 使用 /responses。';
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '官方双线路写入失败');
  } finally {
    saving.value = false;
  }
}

async function applyFilters() {
  page.value = 1;
  await loadProviders();
}

async function logout() {
  clearAdminAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadProviders);
</script>

<template>
  <main class="admin-source-shell">
    <AdminSourceSidebar />

    <section class="admin-source-main">
      <header class="admin-source-topbar">
        <div>
          <RouterLink to="/" class="template-back"><ArrowLeft :size="16" />返回前台</RouterLink>
          <p class="eyebrow">API Providers</p>
          <h1>API 线路管理</h1>
          <span>统一配置第三方 API 线路、Key、接口格式和默认模型；字段按旧 HJM 后台恢复。</span>
        </div>
        <div class="admin-source-actions">
          <n-button type="primary" data-testid="open-api-provider-form" @click="startCreate">
            <template #icon><Plus :size="16" /></template>
            新增线路
          </n-button>
          <n-button
            secondary
            :loading="saving"
            data-testid="apply-official-dual-routes"
            @click="applyOfficialDualRoutes"
          >
            应用官方双线路
          </n-button>
          <n-button secondary :loading="loading" @click="loadProviders">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
        </div>
      </header>

      <div v-if="errorMessage" class="template-error">{{ errorMessage }}</div>
      <div v-if="successMessage" class="template-success">{{ successMessage }}</div>

      <section class="admin-stat-grid" aria-label="API 线路统计">
        <article v-for="stat in statCards" :key="stat.label">
          <component :is="stat.icon" :size="20" />
          <span>{{ stat.label }}</span>
          <strong>{{ formatNumber(stat.value) }}</strong>
        </article>
      </section>

      <section v-if="formOpen" class="admin-source-panel admin-api-provider-form-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">旧后台字段</p>
            <h2>{{ editingId ? '编辑 API 线路' : '新增 API 线路' }}</h2>
          </div>
          <n-button secondary @click="cancelForm">
            <template #icon><XCircle :size="16" /></template>
            取消
          </n-button>
        </div>

        <div class="admin-api-default-reference" aria-label="默认格式参考">
          <div>
            <strong>默认格式参考</strong>
            <span>仅用于复制，不会自动保存到线路记录。</span>
          </div>
          <button
            v-for="item in defaultReferenceItems"
            :key="item.label"
            type="button"
            @click="copyReference(item)"
          >
            <span>{{ item.label }}</span>
            <code>{{ item.value }}</code>
            <small>{{ item.note }}</small>
          </button>
        </div>

        <form class="form-grid admin-api-provider-form" @submit.prevent="saveProvider">
          <label>
            后端真实名称 *
            <n-input v-model:value="form.name" placeholder="例如 new-api-main" />
            <small>内部识别名，便于维护和排查。</small>
          </label>
          <label>
            前端展示名称 *
            <n-input v-model:value="form.displayName" placeholder="给用户和后台看的名称" />
          </label>
          <label>
            线路标识 code *
            <n-input v-model:value="form.routeKey" placeholder="route_openai_gpt_image_2" />
          </label>
          <label>
            渠道类型
            <n-select v-model:value="form.category" :options="categoryOptions" />
          </label>
          <label>
            接口格式
            <n-select v-model:value="form.apiFormat" clearable placeholder="例如 openai-images / openai-responses" :options="formatOptions" />
          </label>
          <label class="admin-api-field-wide">
            Base URL *
            <n-input v-model:value="form.baseUrl" placeholder="https://www.packyapi.com/v1" />
            <small>默认格式只作参考复制；保存时只提交你实际输入的 Base URL。</small>
          </label>
          <label class="admin-api-field-wide">
            API Key
            <n-input v-model:value="form.apiKey" type="password" show-password-on="click" placeholder="编辑时留空表示不修改" />
            <small>后端只回显掩码；不要把真实 key 写进 Git。</small>
          </label>
          <label>
            聊天接口
            <n-input v-model:value="form.chatEndpoint" placeholder="/responses" />
            <small>GPT 5.5 默认参考：/responses。</small>
          </label>
          <label>
            文生图接口
            <n-input v-model:value="form.imageEndpoint" placeholder="/v1/images/generations" />
            <small>GPT Image 2 文生图默认参考：/v1/images/generations。</small>
          </label>
          <label>
            图生图接口
            <n-input v-model:value="form.imageEditEndpoint" placeholder="/v1/images/edits" />
            <small>GPT Image 2 图生图 / 局部重绘默认参考：/v1/images/edits。</small>
          </label>
          <label>
            视频接口
            <n-input v-model:value="form.videoEndpoint" placeholder="/videos/generations" />
          </label>
          <label>
            默认聊天模型
            <n-input v-model:value="form.defaultTextModel" placeholder="gpt-5.5" />
            <small>仅在你输入后才保存。</small>
          </label>
          <label>
            默认生图模型
            <n-input v-model:value="form.defaultImageModel" placeholder="gpt-image-2" />
            <small>仅在你输入后才保存。</small>
          </label>
          <label>
            默认视频模型
            <n-input v-model:value="form.defaultVideoModel" placeholder="可留空" />
          </label>
          <label>
            优先级
            <n-input v-model:value="form.priority" placeholder="数字越大越靠前" />
          </label>
          <label>
            线路倍率
            <n-input v-model:value="form.multiplier" placeholder="1" />
          </label>
          <label class="admin-api-switch-row">
            状态
            <span>
              <input v-model="form.enabled" type="checkbox" />
              {{ form.enabled ? '启用' : '禁用' }}
            </span>
          </label>
          <label class="admin-api-switch-row">
            默认线路
            <span>
              <input v-model="form.isDefault" type="checkbox" />
              {{ form.isDefault ? '设为默认' : '普通线路' }}
            </span>
          </label>
          <label class="admin-api-field-wide">
            备注
            <n-input v-model:value="form.remark" type="textarea" placeholder="记录用途、来源或负责人" />
          </label>
          <div class="source-actions admin-api-form-actions">
            <n-button secondary type="default" @click="cancelForm">取消</n-button>
            <n-button type="primary" attr-type="submit" :loading="saving">
              <template #icon><Save :size="16" /></template>
              保存线路
            </n-button>
          </div>
        </form>
      </section>

      <section class="admin-source-panel admin-api-providers-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Writable Pilot</p>
            <h2>线路列表</h2>
          </div>
          <n-tag :type="dualRouteReady ? 'success' : 'warning'" :bordered="false">
            {{ dualRouteReady ? '双线路已就绪' : '可按需维护线路' }}
          </n-tag>
        </div>

        <div class="admin-api-official-panel" aria-label="官方双线路目标">
          <article v-for="route in officialRoutes" :key="route.id">
            <strong>{{ route.displayName }}</strong>
            <span>{{ route.defaultModelKey }}</span>
            <div class="admin-api-request-examples">
              <div v-for="example in requestExamplesOf(route)" :key="`${route.id}-${example.endpoint}-${example.label}`">
                <em>{{ example.label }}</em>
                <code>{{ example.endpoint }}</code>
                <small>{{ example.requestFormat || route.requestFormat }} · {{ example.contentType || 'application/json' }}</small>
                <pre>{{ requestExampleText(example.body) }}</pre>
              </div>
            </div>
          </article>
        </div>

        <div class="admin-api-providers-toolbar">
          <n-input v-model:value="keyword" clearable placeholder="搜索线路 / 模型 / Base URL" @keyup.enter="applyFilters">
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-select v-model:value="typeFilter" :options="typeOptions" @update:value="applyFilters" />
          <n-button type="primary" :loading="loading" @click="applyFilters">查询</n-button>
        </div>

        <div class="admin-api-providers-list" aria-label="API 线路列表">
          <article v-for="provider in visibleProviders" :key="providerIdOf(provider)">
            <div class="admin-api-provider-icon" :class="{ disabled: !enabledOf(provider) }">
              <Server :size="20" />
            </div>
            <div class="admin-api-provider-main">
              <strong>{{ providerNameOf(provider) }}</strong>
              <span>{{ routeKeyOf(provider) }}</span>
              <small>{{ provider.baseUrl || '未配置 Base URL' }}</small>
            </div>
            <div class="admin-api-provider-type">
              <n-tag :type="typeTag(providerTypeOf(provider))" size="small">{{ typeLabel(providerTypeOf(provider)) }}</n-tag>
              <span>{{ enabledOf(provider) ? '启用中' : '已禁用' }}</span>
            </div>
            <div class="admin-api-provider-model">
              <span>默认模型</span>
              <strong>{{ provider.defaultModelDisplayName || provider.defaultModelKey || '-' }}</strong>
              <span>{{ modelCountOf(provider) }} 个模型</span>
            </div>
            <div class="admin-api-provider-request">
              <span>{{ requestFormatLabel(provider) }}</span>
              <strong>{{ endpointOf(provider) }}</strong>
              <small>{{ requestExamplesOf(provider).map((example) => `${example.label}: ${example.endpoint}`).join(' / ') }}</small>
            </div>
            <div class="admin-api-provider-meta">
              <span>{{ defaultOf(provider) ? '默认线路' : '普通线路' }}</span>
              <strong>{{ provider.apiKey || '未配置密钥' }}</strong>
              <span>优先级 {{ provider.priority ?? provider.pri ?? 0 }}</span>
            </div>
            <div class="admin-api-provider-actions">
              <n-button size="small" secondary @click="startEdit(provider)">
                <template #icon><Edit3 :size="14" /></template>
                编辑
              </n-button>
              <n-button
                size="small"
                secondary
                :loading="actionLoadingId === `default:${providerIdOf(provider)}`"
                @click="makeDefault(provider)"
              >
                <template #icon><Star :size="14" /></template>
                默认
              </n-button>
              <n-button
                size="small"
                secondary
                :loading="actionLoadingId === `models:${providerIdOf(provider)}`"
                @click="fetchModels(provider)"
              >
                <template #icon><ListTree :size="14" /></template>
                模型
              </n-button>
              <n-button
                size="small"
                secondary
                :loading="actionLoadingId === `test:${providerIdOf(provider)}`"
                @click="testProvider(provider)"
              >
                <template #icon><TestTube2 :size="14" /></template>
                测试
              </n-button>
              <n-button
                size="small"
                tertiary
                type="error"
                :loading="actionLoadingId === `delete:${providerIdOf(provider)}`"
                @click="removeProvider(provider)"
              >
                <template #icon><Trash2 :size="14" /></template>
                删除
              </n-button>
            </div>
          </article>
          <p v-if="!visibleProviders.length && !loading" class="admin-empty">暂无匹配 API 线路</p>
        </div>

        <div class="admin-users-pagination">
          <span>共 {{ formatNumber(total || providers.length) }} 条线路，当前显示 {{ formatNumber(visibleProviders.length) }} 条</span>
          <n-pagination
            v-model:page="page"
            :page-size="pageSize"
            :item-count="total"
            :page-slot="5"
            @update:page="loadProviders"
          />
        </div>
      </section>
    </section>
  </main>
</template>

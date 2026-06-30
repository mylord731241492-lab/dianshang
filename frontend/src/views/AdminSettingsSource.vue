<script setup lang="ts">
import AdminSourceSidebar from '../components/AdminSourceSidebar.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NAlert, NButton, NInput, NInputNumber, NSelect, NSwitch, NTag, useMessage } from 'naive-ui';
import { ArrowLeft, CheckCircle2, Coins, Image, RefreshCcw, Save, Search, Settings, ShieldCheck, ToggleLeft } from 'lucide-vue-next';
import { clearAuthSession } from '../api/auth';
import { getAdminApiProviders, type AdminApiProvider } from '../api/adminApiProviders';
import { getAdminSettings, updateAdminSettings, type AdminImageToolSetting, type AdminSettings } from '../api/adminSettings';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const message = useMessage();
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref('');
const settings = ref<AdminSettings>({});
const draft = ref<Partial<AdminSettings>>({});
const providers = ref<AdminApiProvider[]>([]);
const keyword = ref('');

const editableKeys = [
  'siteName',
  'registrationEnabled',
  'emailCodeEnabled',
  'canvasStorageEnabled',
  'canvasCloudStorageEnabled',
  'templateImageEnabled',
  'imageHistoryEnabled',
  'mockMode',
  'defaultCredits',
  'maxUploadSizeMb'
] as const;

const defaultImageTools = ['outpaint', 'reversePrompt', 'smartErase', 'inpaint'];

const editableSwitches = [
  { key: 'registrationEnabled', label: '开放注册' },
  { key: 'emailCodeEnabled', label: '邮箱验证码' },
  { key: 'canvasStorageEnabled', label: '画布存储' },
  { key: 'canvasCloudStorageEnabled', label: '画布云存储' },
  { key: 'templateImageEnabled', label: '模板生图' },
  { key: 'imageHistoryEnabled', label: '图库历史' },
  { key: 'mockMode', label: 'Mock 模式' }
] as const;

const settingRows = computed(() => [
  { key: 'siteName', label: '站点名称', value: settings.value.siteName, group: '基础' },
  { key: 'registrationEnabled', label: '开放注册', value: settings.value.registrationEnabled, group: '账号' },
  { key: 'emailCodeEnabled', label: '邮箱验证码', value: settings.value.emailCodeEnabled, group: '账号' },
  { key: 'defaultCredits', label: '默认算力', value: settings.value.defaultCredits, group: '账号' },
  { key: 'registrationGiftCredits', label: '注册赠送', value: settings.value.registrationGiftCredits, group: '账号' },
  { key: 'canvasStorageEnabled', label: '画布存储', value: settings.value.canvasStorageEnabled, group: '画布' },
  { key: 'canvasCloudStorageEnabled', label: '画布云存储', value: settings.value.canvasCloudStorageEnabled, group: '画布' },
  { key: 'templateImageEnabled', label: '模板生图', value: settings.value.templateImageEnabled, group: '功能' },
  { key: 'imageHistoryEnabled', label: '图库历史', value: settings.value.imageHistoryEnabled, group: '功能' },
  { key: 'mockMode', label: 'Mock 模式', value: settings.value.mockMode, group: '运行' },
  { key: 'maxUploadSizeMb', label: '上传上限 MB', value: settings.value.maxUploadSizeMb, group: '文件' },
  { key: 'smokeCheckedAt', label: 'Smoke 检查时间', value: settings.value.smokeCheckedAt, group: '维护' },
  { key: 'adminUiSaveEchoAt', label: '后台保存回显', value: settings.value.adminUiSaveEchoAt, group: '维护' }
]);

const imageToolRows = computed(() =>
  Object.entries(settings.value.imageToolFeatures || {}).map(([key, value]) => ({
    key,
    label: imageToolLabel(key),
    enabled: value.enabled,
    routeId: value.routeId,
    modelId: value.modelId,
    promptTemplate: value.promptTemplate
  }))
);

const draftImageTools = computed(() => {
  const source = draft.value.imageToolFeatures || {};
  const keys = Array.from(new Set([...defaultImageTools, ...Object.keys(source)]));
  return keys.map((key) => ({
    key,
    label: imageToolLabel(key),
    value: source[key] || {}
  }));
});

const imageRouteOptions = computed(() =>
  providers.value
    .filter((provider) => enabledOf(provider) && providerTypeOf(provider) === 'image')
    .map((provider) => ({
      label: providerNameOf(provider),
      value: routeKeyOf(provider)
    }))
    .filter((option) => option.value)
);

const allImageModelOptions = computed(() => {
  const options = providers.value.flatMap((provider) =>
    (provider.models || []).map((model) => ({
      label: String(model.displayName || model.realName || model.modelKey || model.modelId || model.id || ''),
      value: String(model.modelKey || model.realName || model.modelId || model.id || '')
    }))
  ).filter((option) => option.value);
  if (!options.some((option) => option.value === 'gpt-image-2')) {
    options.unshift({ label: 'GPT Image 2', value: 'gpt-image-2' });
  }
  return uniqueOptions(options);
});

const visibleRows = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return settingRows.value;
  return settingRows.value.filter((row) =>
    [row.key, row.label, row.group, formatValue(row.value)].some((value) => String(value || '').toLowerCase().includes(q))
  );
});

const visibleDraftImageTools = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return draftImageTools.value;
  return draftImageTools.value.filter((tool) =>
    [tool.key, tool.label, tool.value.routeId, tool.value.modelId, tool.value.promptTemplate]
      .some((value) => String(value || '').toLowerCase().includes(q))
  );
});

const statCards = computed(() => {
  const booleans = settingRows.value.filter((row) => typeof row.value === 'boolean');
  const enabled = booleans.filter((row) => row.value === true).length;
  const draftToolRows = draftImageTools.value;
  const imageTools = draftToolRows.length || imageToolRows.value.length;
  const imageToolsEnabled = draftToolRows.length
    ? draftToolRows.filter((row) => row.value.enabled !== false).length
    : imageToolRows.value.filter((row) => row.enabled !== false).length;
  return [
    { label: '设置项', value: settingRows.value.length + imageTools, icon: Settings },
    { label: '启用开关', value: enabled, icon: CheckCircle2 },
    { label: '图片工具', value: imageTools, icon: Image },
    { label: '工具启用', value: imageToolsEnabled, icon: ToggleLeft },
    { label: '默认算力', value: Number(settings.value.defaultCredits || 0), icon: Coins },
    { label: '上传上限', value: Number(settings.value.maxUploadSizeMb || 0), icon: ShieldCheck }
  ];
});

const draftChanged = computed(() =>
  editableKeys.some((key) => draft.value[key] !== settings.value[key]) || imageToolDraftChanged()
);

const saveDisabled = computed(() => saving.value || loading.value || !draftChanged.value);

function imageToolLabel(key: string) {
  const labels: Record<string, string> = {
    outpaint: '扩图',
    reversePrompt: '反推提示词',
    smartErase: '智能消除',
    inpaint: '局部重绘'
  };
  return labels[key] || key;
}

function providerTypeOf(provider: AdminApiProvider) {
  return provider.type || provider.category || provider.group || provider.modelType || 'unknown';
}

function enabledOf(provider: AdminApiProvider) {
  return provider.enabled !== false && provider.disabled !== true && provider.status !== 'disabled';
}

function providerNameOf(provider: AdminApiProvider) {
  return provider.displayName || provider.routeDisplayName || provider.routeName || provider.name || provider.dn || provider.routeKey || provider.id;
}

function routeKeyOf(provider: AdminApiProvider) {
  return provider.routeKey || provider.lineKey || provider.routeCode || provider.code || provider.key || provider.rk || provider.routeId || provider.id;
}

function uniqueOptions(options: Array<{ label: string; value: string }>) {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function modelOptionsFor(tool: AdminImageToolSetting) {
  const routeId = tool.routeId;
  const route = providers.value.find((provider) => routeKeyOf(provider) === routeId || provider.id === routeId || provider.routeId === routeId);
  const routeModels = (route?.models || []).map((model) => ({
    label: String(model.displayName || model.realName || model.modelKey || model.modelId || model.id || ''),
    value: String(model.modelKey || model.realName || model.modelId || model.id || '')
  })).filter((option) => option.value);
  return routeModels.length ? uniqueOptions(routeModels) : allImageModelOptions.value;
}

function imageToolDraftChanged() {
  return JSON.stringify(draft.value.imageToolFeatures || {}) !== JSON.stringify(settings.value.imageToolFeatures || {});
}

function formatNumber(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatValue(value: unknown) {
  if (typeof value === 'boolean') return value ? '启用' : '关闭';
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function toggleDraftBoolean(key: typeof editableSwitches[number]['key']) {
  const record = draft.value as Record<string, unknown>;
  record[key] = !Boolean(record[key]);
}

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, '系统设置加载失败', {
    unauthorized: '请先使用管理员账号登录。',
    forbidden: '当前账号不是管理员。'
  });
}

function syncDraft() {
  const imageToolFeatures = { ...(settings.value.imageToolFeatures || {}) };
  for (const key of defaultImageTools) {
    imageToolFeatures[key] = {
      enabled: imageToolFeatures[key]?.enabled !== false,
      routeId: imageToolFeatures[key]?.routeId || imageRouteOptions.value[0]?.value || '',
      modelId: imageToolFeatures[key]?.modelId || allImageModelOptions.value[0]?.value || 'gpt-image-2',
      promptTemplate: imageToolFeatures[key]?.promptTemplate || ''
    };
  }
  settings.value = {
    ...settings.value,
    imageToolFeatures
  };
  draft.value = {
    siteName: String(settings.value.siteName || ''),
    registrationEnabled: settings.value.registrationEnabled !== false,
    emailCodeEnabled: settings.value.emailCodeEnabled !== false,
    canvasStorageEnabled: settings.value.canvasStorageEnabled !== false,
    canvasCloudStorageEnabled: settings.value.canvasCloudStorageEnabled !== false,
    templateImageEnabled: settings.value.templateImageEnabled !== false,
    imageHistoryEnabled: settings.value.imageHistoryEnabled !== false,
    mockMode: settings.value.mockMode !== false,
    defaultCredits: Number(settings.value.defaultCredits || 0),
    maxUploadSizeMb: Number(settings.value.maxUploadSizeMb || 0),
    imageToolFeatures
  };
}

async function loadSettings() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [data, providerData] = await Promise.all([
      getAdminSettings(),
      getAdminApiProviders({ page: 1, pageSize: 100 })
    ]);
    settings.value = data.settings;
    providers.value = providerData.providers;
    syncDraft();
  } catch (error) {
    errorMessage.value = friendlyError(error);
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  if (saveDisabled.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    const payload: Partial<AdminSettings> = {};
    for (const key of editableKeys) {
      payload[key] = draft.value[key] as never;
    }
    payload.imageToolFeatures = draft.value.imageToolFeatures;
    const data = await updateAdminSettings(payload);
    settings.value = data.settings;
    syncDraft();
    message.success('系统设置已保存并回显');
  } catch (error) {
    errorMessage.value = friendlyError(error);
  } finally {
    saving.value = false;
  }
}

async function logout() {
  clearAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadSettings);
</script>

<template>
  <main class="admin-source-shell">
    <AdminSourceSidebar />

    <section class="admin-source-main">
      <header class="admin-source-topbar">
        <div>
          <RouterLink to="/" class="template-back"><ArrowLeft :size="16" />迁移索引</RouterLink>
          <p class="eyebrow">System Settings</p>
          <h1>系统设置</h1>
          <span>保存试点版：开放基础设置和图片工具线路、模型、提示词模板配置。</span>
        </div>
        <div class="admin-source-actions">
          <n-button type="primary" :loading="saving" :disabled="saveDisabled" @click="saveSettings">
            <template #icon><Save :size="16" /></template>
            保存设置
          </n-button>
          <n-button secondary :loading="loading" @click="loadSettings">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
        </div>
      </header>

      <div v-if="errorMessage" class="template-error">{{ errorMessage }}</div>

      <n-alert class="admin-settings-save-alert" type="info" :bordered="false">
        当前开放站点基础设置、账号/画布/功能开关和图片工具配置。保存会写入旧后端 `app_state`，
        图片工具可选择启用状态、图片线路、模型和提示词模板。
      </n-alert>

      <section class="admin-stat-grid" aria-label="系统设置统计">
        <article v-for="stat in statCards" :key="stat.label">
          <component :is="stat.icon" :size="20" />
          <span>{{ stat.label }}</span>
          <strong>{{ formatNumber(stat.value) }}</strong>
        </article>
      </section>

      <section class="admin-source-panel admin-settings-edit-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Writable Pilot</p>
            <h2>保存试点</h2>
          </div>
          <n-tag :type="draftChanged ? 'warning' : 'success'" :bordered="false">
            {{ draftChanged ? '有未保存修改' : '已同步' }}
          </n-tag>
        </div>

        <div class="admin-settings-edit-grid">
          <label>
            <span>站点名称</span>
            <n-input v-model:value="draft.siteName" placeholder="请输入站点名称" />
          </label>
          <label>
            <span>默认算力</span>
            <n-input-number v-model:value="draft.defaultCredits" :min="0" :step="10" />
          </label>
          <label>
            <span>上传上限 MB</span>
            <n-input-number v-model:value="draft.maxUploadSizeMb" :min="1" :max="200" />
          </label>
        </div>

        <div class="admin-settings-switch-grid">
          <label v-for="item in editableSwitches" :key="item.key">
            <span>{{ item.label }}</span>
            <div class="admin-settings-toggle-control">
              <button
                class="admin-settings-switch-button"
                :class="{ active: draft[item.key] }"
                type="button"
                @click="toggleDraftBoolean(item.key)"
              >
                <span></span>
              </button>
              <n-button
                size="small"
                :type="draft[item.key] ? 'primary' : 'default'"
                :secondary="!draft[item.key]"
                @click="toggleDraftBoolean(item.key)"
              >
                {{ draft[item.key] ? '开启' : '关闭' }}
              </n-button>
            </div>
          </label>
        </div>

        <div class="admin-settings-edit-actions">
          <n-button :disabled="loading || saving" @click="syncDraft">重置草稿</n-button>
          <n-button type="primary" :loading="saving" :disabled="saveDisabled" @click="saveSettings">
            保存设置
          </n-button>
        </div>
      </section>

      <section class="admin-source-panel admin-settings-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Read Only Settings</p>
            <h2>设置列表</h2>
          </div>
          <n-tag type="info" :bordered="false">只读</n-tag>
        </div>

        <div class="admin-settings-toolbar">
          <n-input v-model:value="keyword" clearable placeholder="搜索设置 / 分组 / 值">
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-button type="primary" :loading="loading" @click="loadSettings">查询</n-button>
        </div>

        <div class="admin-settings-list" aria-label="系统设置列表">
          <article v-for="row in visibleRows" :key="row.key">
            <div>
              <strong>{{ row.label }}</strong>
              <span>{{ row.key }}</span>
            </div>
            <n-tag size="small" :type="row.value === true ? 'success' : row.value === false ? 'warning' : 'info'">
              {{ row.group }}
            </n-tag>
            <span>{{ formatValue(row.value) }}</span>
          </article>
        </div>

        <div class="admin-panel-head admin-settings-tools-head">
          <div>
            <p class="eyebrow">Image Tools</p>
            <h2>图片工具配置</h2>
          </div>
          <n-tag type="success" :bordered="false">可配置</n-tag>
        </div>

        <div class="admin-settings-tools-list" aria-label="图片工具配置">
          <article v-for="tool in visibleDraftImageTools" :key="tool.key">
            <div class="admin-settings-tool-title">
              <strong>{{ tool.label }}</strong>
              <span>{{ tool.key }}</span>
            </div>
            <label>
              <span>启用</span>
              <n-switch v-model:value="tool.value.enabled" />
            </label>
            <label>
              <span>图片线路</span>
              <n-select
                v-model:value="tool.value.routeId"
                clearable
                filterable
                :options="imageRouteOptions"
                placeholder="选择图片线路"
              />
            </label>
            <label>
              <span>模型</span>
              <n-select
                v-model:value="tool.value.modelId"
                clearable
                filterable
                :options="modelOptionsFor(tool.value)"
                placeholder="选择图片模型"
              />
            </label>
            <label class="admin-settings-tool-prompt">
              <span>提示词模板</span>
              <n-input
                v-model:value="tool.value.promptTemplate"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                placeholder="输入该工具调用模型时使用的提示词模板"
              />
            </label>
          </article>
          <p v-if="!visibleRows.length && !visibleDraftImageTools.length && !loading" class="admin-empty">暂无匹配系统设置</p>
        </div>
      </section>
    </section>
  </main>
</template>

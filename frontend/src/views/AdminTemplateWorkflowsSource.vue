<script setup lang="ts">
import AdminSourceSidebar from '../components/AdminSourceSidebar.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NSelect, NTag, useMessage } from 'naive-ui';
import {
  ArrowLeft,
  CheckCircle2,
  Image,
  Layers3,
  PackageCheck,
  RefreshCcw,
  Search,
  Settings2,
  Tags,
  Upload
} from 'lucide-vue-next';
import { clearAuthSession } from '../api/auth';
import {
  getAdminTemplateWorkflows,
  uploadAdminTemplateSkill,
  type AdminTemplateWorkflow
} from '../api/adminTemplateWorkflows';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const message = useMessage();
const loading = ref(true);
const errorMessage = ref('');
const templates = ref<AdminTemplateWorkflow[]>([]);
const platforms = ref<string[]>([]);
const qualities = ref<string[]>([]);
const ratios = ref<string[]>([]);
const modelConfigs = ref<Record<string, unknown>>({});
const keyword = ref('');
const categoryFilter = ref('all');
const uploadingSkillKey = ref('');

const categoryOptions = computed(() => {
  const categories = Array.from(new Set(templates.value.map((template) => template.categoryName || template.categoryId || '未分类')));
  return [
    { label: '全部分类', value: 'all' },
    ...categories.map((category) => ({ label: category, value: category }))
  ];
});

const visibleTemplates = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return templates.value.filter((template) => {
    const category = template.categoryName || template.categoryId || '未分类';
    const categoryMatched = categoryFilter.value === 'all' || categoryFilter.value === category;
    if (!categoryMatched) return false;
    if (!q) return true;
    return [
      template.key,
      template.id,
      template.name,
      template.templateName,
      template.desc,
      category,
      template.tags?.join(' '),
      template.platformTags?.join(' ')
    ].some((value) => String(value || '').toLowerCase().includes(q));
  });
});

const statCards = computed(() => {
  const enabled = templates.value.filter((template) => template.enabled !== false).length;
  const categories = new Set(templates.value.map((template) => template.categoryName || template.categoryId || '未分类')).size;
  const slots = templates.value.reduce((sum, template) => sum + (template.imageSlots?.length || 0), 0);
  const fields = templates.value.reduce((sum, template) => sum + (template.fields?.length || 0), 0);
  return [
    { label: '模板总数', value: templates.value.length, icon: Layers3 },
    { label: '启用模板', value: enabled, icon: CheckCircle2 },
    { label: '分类数量', value: categories, icon: Tags },
    { label: '素材槽', value: slots, icon: Image },
    { label: '字段数量', value: fields, icon: Settings2 },
    { label: '比例选项', value: ratios.value.length, icon: PackageCheck }
  ];
});

const modelConfigKeys = computed(() => Object.keys(modelConfigs.value || {}));

function formatNumber(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, '模板工作流加载失败', {
    unauthorized: '请先使用管理员账号登录。',
    forbidden: '当前账号不是管理员。'
  });
}

function templateNameOf(template: AdminTemplateWorkflow) {
  return template.name || template.templateName || template.key;
}

function slotSummary(template: AdminTemplateWorkflow) {
  const slots = template.imageSlots || [];
  if (!slots.length) return '无素材槽';
  return slots.map((slot) => `${slot.label || slot.key}${slot.required ? '*' : ''}`).join(' / ');
}

function fieldSummary(template: AdminTemplateWorkflow) {
  const fields = template.fields || [];
  if (!fields.length) return '无表单字段';
  return fields.map((field) => `${field.label || field.key}${field.required ? '*' : ''}`).join(' / ');
}

function skillPromptSummary(template: AdminTemplateWorkflow) {
  const prompts = template.presetPrompts || template.skillPrompts || [];
  if (prompts.length) {
    return prompts.map((prompt) => prompt.title || prompt.label || prompt.id || '提示词').join(' / ');
  }
  return template.promptBlocks?.templateSkillName || template.promptBlocks?.taskGoal || '未同步';
}

function skillFileLabel(template: AdminTemplateWorkflow) {
  return template.skillFile?.path || `${template.key}.skill.json`;
}

async function uploadSkillFile(template: AdminTemplateWorkflow, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !template.key) return;
  uploadingSkillKey.value = template.key;
  errorMessage.value = '';
  try {
    const data = await uploadAdminTemplateSkill(template.key, file);
    if (data.template) {
      templates.value = templates.value.map((item) => item.key === template.key ? data.template as AdminTemplateWorkflow : item);
    } else {
      await loadWorkflows();
    }
    message.success(`${templateNameOf(template)} Skills 已替换`);
  } catch (error) {
    errorMessage.value = friendlyError(error);
    message.error(errorMessage.value);
  } finally {
    uploadingSkillKey.value = '';
    input.value = '';
  }
}

async function loadWorkflows() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await getAdminTemplateWorkflows();
    templates.value = data.templates;
    platforms.value = data.platforms;
    qualities.value = data.qualities;
    ratios.value = data.ratios;
    modelConfigs.value = data.model_configs || {};
  } catch (error) {
    errorMessage.value = friendlyError(error);
  } finally {
    loading.value = false;
  }
}

async function applyFilters() {
  await loadWorkflows();
}

async function logout() {
  clearAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadWorkflows);
</script>

<template>
  <main class="admin-source-shell">
    <AdminSourceSidebar />

    <section class="admin-source-main">
      <header class="admin-source-topbar">
        <div>
          <RouterLink to="/" class="template-back"><ArrowLeft :size="16" />返回前台</RouterLink>
          <p class="eyebrow">Template Workflows</p>
          <h1>模板工作流</h1>
          <span>查看模板、素材槽、字段、平台、比例和 Skills 文件；支持上传 JSON 替换单个模板 Skills。</span>
        </div>
        <div class="admin-source-actions">
          <n-button secondary :loading="loading" @click="loadWorkflows">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
        </div>
      </header>

      <div v-if="errorMessage" class="template-error">{{ errorMessage }}</div>

      <section class="admin-stat-grid" aria-label="模板工作流统计">
        <article v-for="stat in statCards" :key="stat.label">
          <component :is="stat.icon" :size="20" />
          <span>{{ stat.label }}</span>
          <strong>{{ formatNumber(stat.value) }}</strong>
        </article>
      </section>

      <section class="admin-source-panel admin-template-workflows-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Template Skills</p>
            <h2>模板列表</h2>
          </div>
          <n-tag type="success" :bordered="false">可替换 Skills</n-tag>
        </div>

        <div class="admin-template-workflows-toolbar">
          <n-input v-model:value="keyword" clearable placeholder="搜索模板 / 分类 / 标签" @keyup.enter="applyFilters">
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-select v-model:value="categoryFilter" :options="categoryOptions" @update:value="applyFilters" />
          <n-button type="primary" :loading="loading" @click="applyFilters">查询</n-button>
        </div>

        <div class="admin-template-config-strip" aria-label="模板配置摘要">
          <span>平台 {{ platforms.join(' / ') || '-' }}</span>
          <span>清晰度 {{ qualities.join(' / ') || '-' }}</span>
          <span>比例 {{ ratios.join(' / ') || '-' }}</span>
          <span>模型配置 {{ modelConfigKeys.join(' / ') || '-' }}</span>
        </div>

        <div class="admin-template-workflows-list" aria-label="模板工作流列表">
          <article v-for="template in visibleTemplates" :key="template.key">
            <div class="admin-template-workflow-icon" :class="{ disabled: template.enabled === false }">
              <Layers3 :size="20" />
            </div>
            <div class="admin-template-workflow-main">
              <strong>{{ templateNameOf(template) }}</strong>
              <span>{{ template.key }} · v{{ template.version || 1 }}</span>
              <small>{{ template.desc || '暂无描述' }}</small>
            </div>
            <div class="admin-template-workflow-category">
              <n-tag size="small" type="success">{{ template.categoryName || template.categoryId || '未分类' }}</n-tag>
              <span>{{ template.enabled === false ? '已禁用' : '启用中' }}</span>
            </div>
            <div class="admin-template-workflow-slots">
              <span>素材槽</span>
              <strong>{{ template.imageSlots?.length || 0 }}</strong>
              <span>{{ slotSummary(template) }}</span>
            </div>
            <div class="admin-template-workflow-fields">
              <span>字段 / 输出</span>
              <strong>{{ template.fields?.length || 0 }} / {{ template.outputSchema?.maxItems || 0 }}</strong>
              <span>{{ fieldSummary(template) }}</span>
            </div>
            <div class="admin-template-workflow-fields">
              <span>Skills 提示词</span>
              <strong>{{ template.presetPrompts?.length || template.skillPrompts?.length || 0 }} 条</strong>
              <span>{{ skillPromptSummary(template) }}</span>
            </div>
            <div class="admin-template-workflow-skill-file">
              <span>Skills 文件</span>
              <strong>{{ template.skillFile?.fileName || `${template.key}.skill.json` }}</strong>
              <span>{{ skillFileLabel(template) }}</span>
            </div>
            <div class="admin-template-workflow-actions">
              <label class="admin-template-skill-upload" :class="{ disabled: uploadingSkillKey === template.key }">
                <Upload :size="14" />
                <span>{{ uploadingSkillKey === template.key ? '上传中' : '上传替换' }}</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  :disabled="uploadingSkillKey === template.key"
                  @change="(event) => uploadSkillFile(template, event)"
                />
              </label>
            </div>
          </article>
          <p v-if="!visibleTemplates.length && !loading" class="admin-empty">暂无匹配模板工作流</p>
        </div>

        <div class="admin-users-pagination">
          <span>共 {{ formatNumber(templates.length) }} 个模板，当前显示 {{ formatNumber(visibleTemplates.length) }} 个</span>
        </div>
      </section>
    </section>
  </main>
</template>

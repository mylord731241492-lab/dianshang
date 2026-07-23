<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, type Component } from 'vue';
import { NButton, NConfigProvider, NInput, NSelect, useMessage } from 'naive-ui';
import {
  ArrowLeft,
  BookImage,
  Check,
  ExternalLink,
  Focus,
  Image,
  Images,
  LayoutTemplate,
  Loader2,
  Megaphone,
  Mountain,
  Package,
  PanelsTopLeft,
  ScanSearch,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Wand2
} from 'lucide-vue-next';
import {
  generateTemplateImage,
  getModelRoutes,
  getTemplateSettings,
  reverseTemplatePrompt,
  uploadTemplateFile,
  type GeneratedImage,
  type ModelRouteItem,
  type PromptSuggestion,
  type TemplateConfig
} from '../api/templateImage';
import { getApiErrorMessage } from '../api/http';
import { legacyUrl } from '../config/legacy';

interface LocalFile {
  id: string;
  name: string;
  preview: string;
  url?: string;
  uploading?: boolean;
  error?: string;
}

const message = useMessage();
const loading = ref(true);
const reverseLoading = ref(false);
const generateLoading = ref(false);
const templates = ref<TemplateConfig[]>([]);
const imageRoutes = ref<ModelRouteItem[]>([]);
const textRoutes = ref<ModelRouteItem[]>([]);
const activeTemplateKey = ref('');
const fieldValues = reactive<Record<string, string>>({});
const slotFiles = reactive<Record<string, LocalFile[]>>({});
const promptSuggestions = ref<PromptSuggestion[]>([]);
const selectedPromptIds = ref<string[]>([]);
const generatedImages = ref<GeneratedImage[]>([]);
const errorMessage = ref('');

const templateIcons: Record<string, Component> = {
  'main-image': ScanSearch,
  baiditu: Focus,
  'sub-image-replica': Images,
  'detail-page': PanelsTopLeft,
  scene: Mountain,
  model: UserRound,
  packaging: Package,
  poster: Megaphone,
  xiaohongshu: BookImage,
  custom: SlidersHorizontal
};

const form = reactive({
  platform: '京东',
  ratio: '1:1',
  quality: '2K',
  imageCount: 1,
  imageModelKey: 'gpt-image-2',
  imageRouteId: ''
});

const activeTemplate = computed(() => templates.value.find((item) => item.key === activeTemplateKey.value) || templates.value[0]);

const templateCategories = computed(() => {
  const groups = new Map<string, TemplateConfig[]>();
  templates.value.forEach((template) => {
    const key = template.categoryName || '通用模板';
    groups.set(key, [...(groups.get(key) || []), template]);
  });
  return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
});

const selectedPrompts = computed(() => promptSuggestions.value.filter((item) => selectedPromptIds.value.includes(item.id)));

const primaryPrompt = computed(() => selectedPrompts.value[0] || promptSuggestions.value[0]);

function templateIcon(templateKey: string) {
  return templateIcons[templateKey] || LayoutTemplate;
}

const imageRouteOptions = computed(() => {
  return imageRoutes.value.map((route) => ({
    label: route.displayName || route.routeDisplayName || route.name || route.routeId || route.id || '默认线路',
    value: route.routeId || route.lineId || route.id || route.routeKey || route.lineKey || ''
  })).filter((item) => item.value);
});

const modelOptions = computed(() => {
  const models = imageRoutes.value.flatMap((route) => route.models || []);
  const normalized = models.map((model) => {
    const value = String(model.modelKey || model.realName || model.realModelName || model.key || model.id || model.name || '');
    const label = String(model.displayName || model.realName || model.realModelName || model.name || value);
    return { label, value };
  }).filter((item) => item.value);
  if (!normalized.some((item) => item.value === 'gpt-image-2')) {
    normalized.unshift({ label: 'GPT Image 2', value: 'gpt-image-2' });
  }
  return normalized;
});

const ratioOptions = computed(() => {
  const fromTemplate = activeTemplate.value?.ratioOptions?.map((item) => ({ label: item.label, value: item.value })) || [];
  return fromTemplate.length ? fromTemplate : ['auto', '1:1', '4:5', '3:4', '16:9'].map((value) => ({ label: value, value }));
});

const qualityOptions = ['1K', '2K', '4K'].map((value) => ({ label: value, value }));

watch(activeTemplate, (template) => {
  if (!template) return;
  promptSuggestions.value = [];
  selectedPromptIds.value = [];
  generatedImages.value = [];
  form.platform = template.generateDefaults?.platform || form.platform || '京东';
  form.ratio = template.generateDefaults?.ratio || template.ratioOptions?.[0]?.value || '1:1';
  form.quality = template.generateDefaults?.quality || '2K';
  form.imageCount = template.generateDefaults?.imageCount || 1;
  (template.fields || []).forEach((field) => {
    fieldValues[field.key] = fieldValues[field.key] || '';
  });
  (template.imageSlots || []).forEach((slot) => {
    slotFiles[slot.key] = slotFiles[slot.key] || [];
  });
});

function friendlyError(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback, { unauthorized: '请先登录旧站账号，再使用反推或生成。' });
}

async function loadPage() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [settings, imageRouteList, textRouteList] = await Promise.all([
      getTemplateSettings(),
      getModelRoutes('image'),
      getModelRoutes('text')
    ]);
    templates.value = (settings.templates || []).filter((template) => template.enabled !== false);
    activeTemplateKey.value = templates.value[0]?.key || '';
    imageRoutes.value = imageRouteList;
    textRoutes.value = textRouteList;
    form.imageRouteId = imageRouteOptions.value[0]?.value || '';
  } catch (error) {
    errorMessage.value = friendlyError(error, '模板配置加载失败');
  } finally {
    loading.value = false;
  }
}

async function addFiles(slotKey: string, files: FileList | null) {
  if (!files?.length) return;
  const current = slotFiles[slotKey] || [];
  const items: LocalFile[] = Array.from(files).map((file) => ({
    id: `${Date.now()}_${file.name}_${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    preview: URL.createObjectURL(file),
    uploading: true
  }));
  slotFiles[slotKey] = [...current, ...items];
  await Promise.all(items.map(async (item, index) => {
    try {
      item.url = await uploadTemplateFile(Array.from(files)[index]);
    } catch (error) {
      item.error = friendlyError(error, '上传失败');
    } finally {
      item.uploading = false;
    }
  }));
}

function removeFile(slotKey: string, id: string) {
  const item = slotFiles[slotKey]?.find((file) => file.id === id);
  if (item?.preview) URL.revokeObjectURL(item.preview);
  slotFiles[slotKey] = (slotFiles[slotKey] || []).filter((file) => file.id !== id);
}

function buildPayload() {
  const template = activeTemplate.value;
  const imageSlots = Object.fromEntries(
    Object.entries(slotFiles).map(([key, files]) => [
      key,
      files.map((file) => ({ url: file.url || file.preview, name: file.name }))
    ])
  );
  return {
    templateType: template?.templateType || template?.key,
    templateKey: template?.key,
    imageSlots,
    fields: { ...fieldValues },
    platform: form.platform,
    ratio: form.ratio,
    quality: form.quality,
    imageCount: form.imageCount,
    imageRouteId: form.imageRouteId,
    imageModelKey: form.imageModelKey,
    imageModel: form.imageModelKey,
    prompt: primaryPrompt.value?.prompt || fieldValues.userPrompt || activeTemplate.value?.desc || ''
  };
}

function promptSummary(prompt: PromptSuggestion) {
  return String(prompt.summary || prompt.description || prompt.prompt || prompt.text || '点击选择后用于本次生成。')
    .replace(/\s+/g, ' ')
    .trim();
}

function togglePrompt(promptId: string) {
  selectedPromptIds.value = selectedPromptIds.value.includes(promptId)
    ? selectedPromptIds.value.filter((id) => id !== promptId)
    : [...selectedPromptIds.value, promptId].slice(0, 4);
}

async function reversePrompt() {
  reverseLoading.value = true;
  errorMessage.value = '';
  try {
    const data = await reverseTemplatePrompt(buildPayload());
    const list = data.prompts || data.suggestions || data.items || [];
    promptSuggestions.value = list.map((item, index) => ({
      ...item,
      id: item.id || `prompt_${index}`,
      label: item.label || item.title || `方案 ${index + 1}`,
      prompt: item.prompt || item.text || ''
    }));
    const defaultSelectedIds = promptSuggestions.value.filter((item) => item.selected !== false).map((item) => item.id);
    selectedPromptIds.value = (defaultSelectedIds.length ? defaultSelectedIds : promptSuggestions.value.map((item) => item.id)).slice(0, 4);
    message.success('提示词已生成');
  } catch (error) {
    errorMessage.value = friendlyError(error, '生成提示词失败');
    message.error(errorMessage.value);
  } finally {
    reverseLoading.value = false;
  }
}

function promptsForGeneration() {
  return selectedPrompts.value.slice(0, 4);
}

async function generateImage() {
  const selectedPrompts = promptsForGeneration();
  if (!selectedPrompts.length) {
    message.warning('请先点击“生成提示词”，选择至少一组提示词后再生成图片');
    return;
  }
  generateLoading.value = true;
  errorMessage.value = '';
  try {
    const data = await generateTemplateImage({
      ...buildPayload(),
      selectedPrompts
    });
    generatedImages.value = data.resultImages || data.images || data.results || [];
    message.success('生成任务已完成');
  } catch (error) {
    errorMessage.value = friendlyError(error, '生成图片失败');
    message.error(errorMessage.value);
  } finally {
    generateLoading.value = false;
  }
}

onMounted(loadPage);
</script>

<template>
  <n-config-provider :theme="null">
    <main class="template-source-shell">
      <header class="template-topbar">
        <RouterLink to="/" class="template-back" aria-label="返回首页" title="返回首页"><ArrowLeft :size="17" /><span>返回</span></RouterLink>
        <div class="template-page-title">
          <span class="template-title-icon"><LayoutTemplate :size="19" /></span>
          <div>
            <p class="eyebrow">电商视觉生产</p>
            <h1>模板生图</h1>
          </div>
        </div>
        <a class="legacy-link" :href="legacyUrl('/template-image')" aria-label="打开旧版模板页" title="打开旧版模板页"><ExternalLink :size="16" /><span>旧版</span></a>
      </header>

      <section v-if="loading" class="template-loading">
        <Loader2 :size="22" />
        <span>正在加载模板配置</span>
      </section>

      <section v-else class="template-workbench">
        <aside class="template-library">
          <div class="panel-title">
            <strong>模板库</strong>
            <small>{{ templates.length }} 个</small>
          </div>
          <div class="template-library-list">
            <div v-for="category in templateCategories" :key="category.name" class="template-category">
              <h2>{{ category.name }}</h2>
              <div class="template-category-items">
                <button
                  v-for="template in category.items"
                  :key="template.key"
                  type="button"
                  :class="{ active: activeTemplateKey === template.key }"
                  :aria-pressed="activeTemplateKey === template.key"
                  @click="activeTemplateKey = template.key"
                >
                  <span class="template-option-icon"><component :is="templateIcon(template.key)" :size="17" /></span>
                  <span class="template-option-copy">
                    <strong>{{ template.name || template.templateName }}</strong>
                    <small>{{ template.desc || '模板配置' }}</small>
                  </span>
                  <Check v-if="activeTemplateKey === template.key" class="template-option-check" :size="15" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <section class="template-editor">
          <div class="template-hero-panel">
            <div>
              <p class="eyebrow">{{ activeTemplate?.categoryName || '模板' }}</p>
              <h2>{{ activeTemplate?.name }}</h2>
              <p>{{ activeTemplate?.desc || '选择素材、补充需求，先生成提示词，再生成图片。' }}</p>
            </div>
            <div class="template-tags">
              <span v-for="tag in activeTemplate?.tags || []" :key="tag">{{ tag }}</span>
            </div>
          </div>

          <div v-if="errorMessage" class="template-error">{{ errorMessage }}</div>

          <section class="source-section">
            <div class="section-heading">
              <div><span>01</span><h3>商品素材</h3></div>
              <small>支持 JPG、PNG、WebP</small>
            </div>
            <div class="slot-grid">
              <article v-for="slot in activeTemplate?.imageSlots || []" :key="slot.key" class="slot-card">
                <div class="slot-head">
                  <strong>{{ slot.label }}</strong>
                  <small :class="{ required: slot.required }">{{ slot.required ? '必填' : '可选' }}</small>
                </div>
                <p>{{ slot.description || '上传用于模板生成的图片素材。' }}</p>
                <label class="upload-zone">
                  <Images :size="18" />
                  <span>选择图片</span>
                  <input type="file" :accept="slot.accept || 'image/*'" :multiple="slot.multiple !== false" @change="(event) => addFiles(slot.key, (event.target as HTMLInputElement).files)" />
                </label>
                <div class="file-grid">
                  <button v-for="file in slotFiles[slot.key] || []" :key="file.id" type="button" @click="removeFile(slot.key, file.id)">
                    <img :src="file.preview" alt="" />
                    <small>{{ file.uploading ? '上传中' : file.error || file.name }}</small>
                  </button>
                </div>
              </article>
            </div>
          </section>

          <section class="source-section generation-settings">
            <div class="section-heading">
              <div><span>02</span><h3>生成设置</h3></div>
              <small>按当前模板自动预设</small>
            </div>
            <div class="form-grid">
              <label v-for="field in activeTemplate?.fields || []" :key="field.key">
                {{ field.label }}
                <n-input
                  v-if="field.type !== 'select'"
                  v-model:value="fieldValues[field.key]"
                  type="textarea"
                  :autosize="{ minRows: 4, maxRows: 8 }"
                  :placeholder="field.placeholder || '输入补充要求'"
                />
                <n-select
                  v-else
                  v-model:value="fieldValues[field.key]"
                  :options="(field.options || []).map((value) => ({ label: value, value }))"
                />
              </label>
              <label>目标平台<n-input v-model:value="form.platform" /></label>
              <label>图片比例<n-select v-model:value="form.ratio" :options="ratioOptions" /></label>
              <label>清晰度<n-select v-model:value="form.quality" :options="qualityOptions" /></label>
              <label>张数<n-select v-model:value="form.imageCount" :options="[1, 2, 3, 4].map((value) => ({ label: `${value} 张`, value }))" /></label>
              <label>图片线路<n-select v-model:value="form.imageRouteId" :options="imageRouteOptions" /></label>
              <label>图片模型<n-select v-model:value="form.imageModelKey" :options="modelOptions" /></label>
            </div>
          </section>

          <section class="source-actions">
            <span class="action-hint">已选择 {{ selectedPrompts.length }} 个提示词方案</span>
            <n-button size="large" secondary :loading="reverseLoading" @click="reversePrompt">
              <template #icon><Wand2 :size="16" /></template>
              生成提示词
            </n-button>
            <n-button size="large" type="primary" :loading="generateLoading" :disabled="!selectedPrompts.length" @click="generateImage">
              <template #icon><Sparkles :size="16" /></template>
              生成图片
            </n-button>
          </section>
        </section>

        <aside class="template-results">
          <section class="results-section">
            <div class="panel-title">
              <strong>提示词方案</strong>
              <small>{{ promptSuggestions.length }} 条</small>
            </div>
            <div class="prompt-list">
              <button
                v-for="prompt in promptSuggestions"
                :key="prompt.id"
                type="button"
                :class="{ active: selectedPromptIds.includes(prompt.id) }"
                @click="togglePrompt(prompt.id)"
              >
                <strong>{{ prompt.label || prompt.title }}</strong>
                <span>{{ promptSummary(prompt) }}</span>
              </button>
              <div v-if="!promptSuggestions.length" class="result-empty">
                <Wand2 :size="20" />
                <strong>暂无提示词</strong>
                <span>生成后可在这里选择方案</span>
              </div>
            </div>
          </section>

          <section class="results-section result-section-images">
            <div class="panel-title">
              <strong>生成结果</strong>
              <small>{{ generatedImages.length }} 张</small>
            </div>
            <div class="result-grid">
              <a v-for="image in generatedImages" :key="image.id || image.url || image.imageUrl" :href="image.url || image.imageUrl || image.preview" target="_blank">
                <img :src="image.url || image.imageUrl || image.preview" alt="" />
              </a>
              <div v-if="!generatedImages.length" class="result-empty">
                <Image :size="20" />
                <strong>暂无图片</strong>
                <span>生成结果会保留在这里</span>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </main>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { NButton, NInput, NSelect, useMessage } from 'naive-ui';
import { ArrowLeft, Images, Loader2, Sparkles, Wand2 } from 'lucide-vue-next';
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
const selectedPromptId = ref('');
const generatedImages = ref<GeneratedImage[]>([]);
const errorMessage = ref('');

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

const selectedPrompt = computed(() => {
  return promptSuggestions.value.find((item) => item.id === selectedPromptId.value) || promptSuggestions.value[0];
});

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
  selectedPromptId.value = '';
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
    prompt: selectedPrompt.value?.prompt || fieldValues.userPrompt || activeTemplate.value?.desc || ''
  };
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
    selectedPromptId.value = promptSuggestions.value[0]?.id || '';
    message.success('反推提示词已生成');
  } catch (error) {
    errorMessage.value = friendlyError(error, '反推提示词失败');
    message.error(errorMessage.value);
  } finally {
    reverseLoading.value = false;
  }
}

async function generateImage() {
  generateLoading.value = true;
  errorMessage.value = '';
  try {
    const data = await generateTemplateImage({
      ...buildPayload(),
      selectedPrompts: selectedPrompt.value ? [selectedPrompt.value] : []
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
  <main class="template-source-shell">
    <header class="template-topbar">
      <RouterLink to="/" class="template-back"><ArrowLeft :size="16" />迁移索引</RouterLink>
      <div>
        <p class="eyebrow">Template Image</p>
        <h1>模板生图工作台</h1>
      </div>
      <a class="legacy-link" :href="legacyUrl('/template-image')">旧版页面</a>
    </header>

    <section v-if="loading" class="template-loading">
      <Loader2 :size="22" />
      <span>正在加载模板配置</span>
    </section>

    <section v-else class="template-workbench">
      <aside class="template-library">
        <div class="panel-title">
          <strong>模板库</strong>
          <small>{{ templates.length }} 个模板</small>
        </div>
        <div v-for="category in templateCategories" :key="category.name" class="template-category">
          <h2>{{ category.name }}</h2>
          <button
            v-for="template in category.items"
            :key="template.key"
            type="button"
            :class="{ active: activeTemplateKey === template.key }"
            @click="activeTemplateKey = template.key"
          >
            <span>{{ template.name || template.templateName }}</span>
            <small>{{ template.desc || '模板配置' }}</small>
          </button>
        </div>
      </aside>

      <section class="template-editor">
        <div class="template-hero-panel">
          <div>
            <p class="eyebrow">{{ activeTemplate?.categoryName || '模板' }}</p>
            <h2>{{ activeTemplate?.name }}</h2>
            <p>{{ activeTemplate?.desc || '选择素材、补充需求，然后反推或生成图片。' }}</p>
          </div>
          <div class="template-tags">
            <span v-for="tag in activeTemplate?.tags || []" :key="tag">{{ tag }}</span>
          </div>
        </div>

        <div v-if="errorMessage" class="template-error">{{ errorMessage }}</div>

        <section class="source-section">
          <h3>素材槽</h3>
          <div class="slot-grid">
            <article v-for="slot in activeTemplate?.imageSlots || []" :key="slot.key" class="slot-card">
              <div class="slot-head">
                <strong>{{ slot.label }}</strong>
                <small>{{ slot.required ? '必填' : '可选' }}</small>
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

        <section class="source-section form-grid">
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
          <label>
            目标平台
            <n-input v-model:value="form.platform" />
          </label>
          <label>
            图片比例
            <n-select v-model:value="form.ratio" :options="ratioOptions" />
          </label>
          <label>
            清晰度
            <n-select v-model:value="form.quality" :options="qualityOptions" />
          </label>
          <label>
            张数
            <n-select v-model:value="form.imageCount" :options="[1, 2, 3, 4].map((value) => ({ label: `${value} 张`, value }))" />
          </label>
          <label>
            图片线路
            <n-select v-model:value="form.imageRouteId" :options="imageRouteOptions" />
          </label>
          <label>
            图片模型
            <n-select v-model:value="form.imageModelKey" :options="modelOptions" />
          </label>
        </section>

        <section class="source-actions">
          <n-button size="large" secondary :loading="reverseLoading" @click="reversePrompt">
            <template #icon><Wand2 :size="16" /></template>
            反推提示词
          </n-button>
          <n-button size="large" type="primary" :loading="generateLoading" @click="generateImage">
            <template #icon><Sparkles :size="16" /></template>
            生成图片
          </n-button>
        </section>
      </section>

      <aside class="template-results">
        <div class="panel-title">
          <strong>提示词方案</strong>
          <small>{{ promptSuggestions.length }} 条</small>
        </div>
        <div class="prompt-list">
          <button
            v-for="prompt in promptSuggestions"
            :key="prompt.id"
            type="button"
            :class="{ active: selectedPromptId === prompt.id }"
            @click="selectedPromptId = prompt.id"
          >
            <strong>{{ prompt.label || prompt.title }}</strong>
            <span>{{ prompt.prompt }}</span>
          </button>
          <p v-if="!promptSuggestions.length">点击反推提示词后，这里会显示可选方案。</p>
        </div>

        <div class="panel-title result-title">
          <strong>生成结果</strong>
          <small>{{ generatedImages.length }} 张</small>
        </div>
        <div class="result-grid">
          <a v-for="image in generatedImages" :key="image.id || image.url || image.imageUrl" :href="image.url || image.imageUrl || image.preview" target="_blank">
            <img :src="image.url || image.imageUrl || image.preview" alt="" />
          </a>
          <p v-if="!generatedImages.length">生成完成后会在这里展示图片。</p>
        </div>
      </aside>
    </section>
  </main>
</template>

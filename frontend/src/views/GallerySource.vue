<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NButton, NInput, NSelect, useMessage } from 'naive-ui';
import { ArrowLeft, Copy, ExternalLink, ImageOff, RefreshCcw, Trash2 } from 'lucide-vue-next';
import { deleteGeneration, getGenerationHistory, type GenerationItem } from '../api/gallery';
import { getApiErrorMessage } from '../api/http';

const message = useMessage();
const loading = ref(true);
const deletingId = ref('');
const items = ref<GenerationItem[]>([]);
const search = ref('');
const modelFilter = ref('all');
const errorMessage = ref('');
const failedImageKeys = ref<Set<string>>(new Set());

const modelOptions = computed(() => {
  const models = Array.from(new Set(items.value.map((item) => item.model || item.modelKey || '').filter(Boolean)));
  return [
    { label: '全部模型', value: 'all' },
    ...models.map((model) => ({ label: model, value: model }))
  ];
});

const filteredItems = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return items.value.filter((item) => {
    const model = item.model || item.modelKey || '';
    const text = `${item.prompt || ''} ${item.label || ''} ${model}`.toLowerCase();
    const matchesKeyword = !keyword || text.includes(keyword);
    const matchesModel = modelFilter.value === 'all' || model === modelFilter.value;
    return matchesKeyword && matchesModel;
  });
});

const stats = computed(() => {
  const totalCost = items.value.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  const models = new Set(items.value.map((item) => item.model || item.modelKey).filter(Boolean));
  return [
    { label: '图片', value: String(items.value.length) },
    { label: '模型', value: String(models.size) },
    { label: '消耗', value: String(totalCost) }
  ];
});

function imageUrl(item: GenerationItem) {
  return item.url || item.imageUrl || item.resultUrl || item.result_url || '';
}

function imageKey(item: GenerationItem) {
  return String(item.id || imageUrl(item));
}

function imageAvailable(item: GenerationItem) {
  return Boolean(imageUrl(item)) && !failedImageKeys.value.has(imageKey(item));
}

function markImageFailed(item: GenerationItem) {
  failedImageKeys.value = new Set([...failedImageKeys.value, imageKey(item)]);
}

function displayDate(item: GenerationItem) {
  const raw = item.createdAt || item.created_at;
  if (!raw) return '未知时间';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function friendlyError(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback, { unauthorized: '请先登录旧站账号，再查看图库历史。' });
}

async function loadGallery() {
  loading.value = true;
  errorMessage.value = '';
  failedImageKeys.value = new Set();
  try {
    items.value = await getGenerationHistory();
  } catch (error) {
    items.value = [];
    errorMessage.value = friendlyError(error, '图库加载失败');
  } finally {
    loading.value = false;
  }
}

async function removeItem(item: GenerationItem) {
  if (!item.id) return;
  deletingId.value = item.id;
  errorMessage.value = '';
  try {
    await deleteGeneration(item.id);
    items.value = items.value.filter((entry) => entry.id !== item.id);
    message.success('已删除图库记录');
  } catch (error) {
    errorMessage.value = friendlyError(error, '删除失败');
    message.error(errorMessage.value);
  } finally {
    deletingId.value = '';
  }
}

async function copyUrl(item: GenerationItem) {
  const url = imageUrl(item);
  if (!url) {
    message.warning('当前记录没有图片链接');
    return;
  }
  await navigator.clipboard.writeText(url);
  message.success('图片链接已复制');
}

onMounted(loadGallery);
</script>

<template>
  <main class="gallery-source-shell">
    <header class="gallery-topbar">
      <RouterLink to="/" class="template-back"><ArrowLeft :size="16" />返回首页</RouterLink>
      <div>
        <p class="eyebrow">Gallery</p>
        <h1>图库历史</h1>
      </div>
      <span aria-hidden="true"></span>
    </header>

    <section class="gallery-toolbar">
      <div class="gallery-stats">
        <article v-for="stat in stats" :key="stat.label">
          <span>{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
        </article>
      </div>
      <div class="gallery-filters">
        <n-input v-model:value="search" clearable placeholder="搜索提示词 / 模型" />
        <n-select v-model:value="modelFilter" :options="modelOptions" />
        <n-button secondary :loading="loading" @click="loadGallery">
          <template #icon><RefreshCcw :size="16" /></template>
          刷新
        </n-button>
      </div>
    </section>

    <section v-if="errorMessage" class="template-error gallery-error">
      {{ errorMessage }}
    </section>

    <section v-if="loading" class="template-loading gallery-loading">
      <RefreshCcw :size="22" />
      <span>正在加载图库历史</span>
    </section>

    <section v-else-if="filteredItems.length" class="gallery-grid">
      <article v-for="item in filteredItems" :key="item.id" class="gallery-card">
        <a class="gallery-image" :href="imageAvailable(item) ? imageUrl(item) : undefined" :target="imageAvailable(item) ? '_blank' : undefined">
          <img v-if="imageAvailable(item)" :src="imageUrl(item)" alt="" @error="markImageFailed(item)" />
          <span v-else class="gallery-image-placeholder">
            <ImageOff :size="26" />
            <small>{{ imageUrl(item) ? '历史图片源已失效' : '暂无图片' }}</small>
          </span>
        </a>
        <div class="gallery-card-body">
          <div>
            <strong>{{ item.label || '生成图片' }}</strong>
            <p>{{ item.prompt || '暂无提示词' }}</p>
          </div>
          <dl>
            <div>
              <dt>模型</dt>
              <dd>{{ item.model || item.modelKey || '未知' }}</dd>
            </div>
            <div>
              <dt>消耗</dt>
              <dd>{{ item.cost || 0 }}</dd>
            </div>
            <div>
              <dt>时间</dt>
              <dd>{{ displayDate(item) }}</dd>
            </div>
          </dl>
          <div class="gallery-card-actions">
            <n-button size="small" secondary @click="copyUrl(item)">
              <template #icon><Copy :size="14" /></template>
              复制
            </n-button>
            <n-button v-if="imageAvailable(item)" size="small" secondary tag="a" :href="imageUrl(item)" target="_blank">
              <template #icon><ExternalLink :size="14" /></template>
              打开
            </n-button>
            <n-button v-else size="small" secondary disabled>图片不可用</n-button>
            <n-button size="small" tertiary type="error" :loading="deletingId === item.id" @click="removeItem(item)">
              <template #icon><Trash2 :size="14" /></template>
              删除
            </n-button>
          </div>
        </div>
      </article>
    </section>

    <section v-else class="gallery-empty">
      <ImageOff :size="32" />
      <strong>{{ errorMessage ? '图库暂不可用' : '暂无生成图片' }}</strong>
      <p>{{ errorMessage || '完成模板生图后，结果会同步到这里。' }}</p>
      <RouterLink to="/template-image">去模板生图</RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NButton, NInput, NSelect } from 'naive-ui';
import { ArrowLeft, ExternalLink, ImageOff, RefreshCcw } from 'lucide-vue-next';
import { getGenerationHistory, type GenerationItem } from '../api/gallery';
import { getApiErrorMessage } from '../api/http';
import { getBalanceLogs, type BalanceLog } from '../api/user';
import { legacyUrl } from '../config/legacy';

const loading = ref(true);
const generations = ref<GenerationItem[]>([]);
const logs = ref<BalanceLog[]>([]);
const search = ref('');
const typeFilter = ref('all');
const errorMessage = ref('');

const filteredGenerations = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return generations.value.filter((item) => {
    const text = `${item.prompt || ''} ${item.model || item.modelKey || ''}`.toLowerCase();
    return !keyword || text.includes(keyword);
  });
});

const filteredLogs = computed(() => {
  return logs.value.filter((log) => typeFilter.value === 'all' || log.type === typeFilter.value);
});

const typeOptions = computed(() => {
  const types = Array.from(new Set(logs.value.map((log) => log.type || '').filter(Boolean)));
  return [{ label: '全部流水', value: 'all' }, ...types.map((type) => ({ label: type, value: type }))];
});

function imageUrl(item: GenerationItem) {
  return item.url || item.imageUrl || item.resultUrl || item.result_url || '';
}

function formatDate(raw?: string) {
  if (!raw) return '未知时间';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function logAmount(log: BalanceLog) {
  const amount = Number(log.change_amount ?? log.changeAmount ?? 0);
  return amount > 0 ? `+${amount}` : String(amount);
}

function friendlyError(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback, { unauthorized: '请先登录后查看生成记录。' });
}

async function loadRecords() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [generationList, balanceList] = await Promise.all([getGenerationHistory(), getBalanceLogs()]);
    generations.value = generationList;
    logs.value = balanceList;
  } catch (error) {
    errorMessage.value = friendlyError(error, '生成记录加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadRecords);
</script>

<template>
  <main class="records-source-shell">
    <header class="user-topbar">
      <RouterLink to="/user/center" class="template-back"><ArrowLeft :size="16" />用户中心</RouterLink>
      <div>
        <p class="eyebrow">Records</p>
        <h1>生成记录</h1>
      </div>
      <a class="legacy-link" :href="legacyUrl('/user/records')">旧版页面</a>
    </header>

    <section class="records-toolbar">
      <n-input v-model:value="search" clearable placeholder="搜索提示词 / 模型" />
      <n-select v-model:value="typeFilter" :options="typeOptions" />
      <n-button secondary :loading="loading" @click="loadRecords">
        <template #icon><RefreshCcw :size="16" /></template>
        刷新
      </n-button>
    </section>

    <section v-if="errorMessage" class="template-error records-error">{{ errorMessage }}</section>

    <section class="records-layout">
      <div class="records-panel">
        <div class="panel-title">
          <strong>图片生成</strong>
          <small>{{ filteredGenerations.length }} 条</small>
        </div>
        <div v-if="filteredGenerations.length" class="records-image-list">
          <article v-for="item in filteredGenerations" :key="item.id">
            <a :href="imageUrl(item)" target="_blank">
              <img v-if="imageUrl(item)" :src="imageUrl(item)" alt="" />
              <span v-else><ImageOff :size="20" /></span>
            </a>
            <div>
              <strong>{{ item.label || item.prompt || '生成图片' }}</strong>
              <p>{{ item.prompt || '暂无提示词' }}</p>
              <small>{{ item.model || item.modelKey || '未知模型' }} · {{ formatDate(item.createdAt || item.created_at) }}</small>
            </div>
            <a class="record-open" :href="imageUrl(item)" target="_blank"><ExternalLink :size="15" /></a>
          </article>
        </div>
        <div v-else class="user-empty-state">暂无生成图片记录。</div>
      </div>

      <div class="records-panel">
        <div class="panel-title">
          <strong>余额流水</strong>
          <small>{{ filteredLogs.length }} 条</small>
        </div>
        <div v-if="filteredLogs.length" class="balance-log-list">
          <article v-for="log in filteredLogs" :key="`${log.id || log.created_at || log.createdAt}-${log.remark}`">
            <div>
              <strong>{{ log.remark || log.type || '余额变动' }}</strong>
              <small>{{ formatDate(log.created_at || log.createdAt) }}</small>
            </div>
            <span :class="{ positive: Number(log.change_amount ?? log.changeAmount ?? 0) > 0 }">
              {{ logAmount(log) }}
            </span>
          </article>
        </div>
        <div v-else class="user-empty-state">暂无余额流水。</div>
      </div>
    </section>
  </main>
</template>

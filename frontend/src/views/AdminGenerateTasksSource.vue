<script setup lang="ts">
import AdminSourceSidebar from '../components/AdminSourceSidebar.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NPagination, NProgress, NSelect, NTag } from 'naive-ui';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Coins,
  Image,
  RefreshCcw,
  Search,
  Timer,
  XCircle
} from 'lucide-vue-next';
import { clearAdminAuthSession } from '../api/adminAuth';
import { getAdminGenerateTasks, type AdminGenerateTask } from '../api/adminGenerateTasks';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
const tasks = ref<AdminGenerateTask[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref('');
const statusFilter = ref('all');
const summary = ref<Record<string, number | string>>({});

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '成功', value: 'success' },
  { label: '运行中', value: 'running' },
  { label: '等待中', value: 'pending' },
  { label: '失败', value: 'failed' }
];

const visibleTasks = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return tasks.value;
  return tasks.value.filter((task) => {
    return [
      task.id,
      task.taskId,
      task.username,
      task.model,
      task.modelKey,
      task.routeDisplayName,
      task.prompt,
      task.promptPreview,
      task.status
    ].some((value) => String(value || '').toLowerCase().includes(q));
  });
});

const statCards = computed(() => [
  { label: '任务总数', value: Number(summary.value.total ?? total.value), icon: Image },
  { label: '成功任务', value: Number(summary.value.success ?? 0), icon: CheckCircle2 },
  { label: '运行中', value: Number(summary.value.running ?? 0), icon: Activity },
  { label: '等待中', value: Number(summary.value.pending ?? 0), icon: Timer },
  { label: '失败任务', value: Number(summary.value.failed ?? 0), icon: XCircle },
  { label: '当前页消耗', value: tasks.value.reduce((sum, task) => sum + Number(task.cost ?? task.costPoints ?? 0), 0), icon: Coins }
]);

function formatNumber(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatDate(raw?: string) {
  if (!raw) return '未知时间';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function statusType(status?: string) {
  if (status === 'success' || status === 'completed') return 'success';
  if (status === 'running') return 'info';
  if (status === 'pending') return 'warning';
  if (status === 'failed' || status === 'error') return 'error';
  return 'default';
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    success: '成功',
    completed: '成功',
    running: '运行中',
    pending: '等待中',
    failed: '失败',
    error: '失败',
    cancelled: '已取消'
  };
  return labels[status || ''] || status || '未知';
}

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, '任务监控加载失败', {
    unauthorized: '请先使用管理员账号登录。',
    forbidden: '当前账号不是管理员。'
  });
}

async function loadTasks() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await getAdminGenerateTasks({
      page: page.value,
      pageSize: pageSize.value,
      status: statusFilter.value
    });
    tasks.value = data.tasks;
    total.value = data.total;
    page.value = data.page;
    pageSize.value = data.pageSize;
    summary.value = data.summary as Record<string, number | string>;
  } catch (error) {
    errorMessage.value = friendlyError(error);
  } finally {
    loading.value = false;
  }
}

async function applyFilters() {
  page.value = 1;
  await loadTasks();
}

async function logout() {
  clearAdminAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadTasks);
</script>

<template>
  <main class="admin-source-shell">
    <AdminSourceSidebar />

    <section class="admin-source-main">
      <header class="admin-source-topbar">
        <div>
          <RouterLink to="/" class="template-back"><ArrowLeft :size="16" />返回前台</RouterLink>
          <p class="eyebrow">Generation Tasks</p>
          <h1>任务监控</h1>
          <span>只读迁移版：查看生成任务、模型线路、进度、消耗和错误，不执行取消或删除。</span>
        </div>
        <div class="admin-source-actions">
          <n-button secondary :loading="loading" @click="loadTasks">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
        </div>
      </header>

      <div v-if="errorMessage" class="template-error">{{ errorMessage }}</div>

      <section class="admin-stat-grid" aria-label="任务统计">
        <article v-for="stat in statCards" :key="stat.label">
          <component :is="stat.icon" :size="20" />
          <span>{{ stat.label }}</span>
          <strong>{{ formatNumber(stat.value) }}</strong>
        </article>
      </section>

      <section class="admin-source-panel admin-tasks-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Read Only Monitor</p>
            <h2>生成任务列表</h2>
          </div>
          <n-tag type="info" :bordered="false">{{ summary.queueMode || 'local' }}</n-tag>
        </div>

        <div class="admin-tasks-toolbar">
          <n-input
            v-model:value="keyword"
            clearable
            placeholder="搜索提示词 / 用户 / 模型 / 线路"
            @keyup.enter="applyFilters"
          >
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-select v-model:value="statusFilter" :options="statusOptions" @update:value="applyFilters" />
          <n-button type="primary" :loading="loading" @click="applyFilters">查询</n-button>
        </div>

        <div class="admin-tasks-list" aria-label="任务列表">
          <article v-for="task in visibleTasks" :key="task.id">
            <div class="admin-task-thumb">
              <img v-if="task.imageUrl || task.resultUrl" :src="task.imageUrl || task.resultUrl" alt="" />
              <Image v-else :size="20" />
            </div>
            <div class="admin-task-main">
              <strong>{{ task.promptPreview || task.prompt || '暂无提示词' }}</strong>
              <span>{{ task.username || 'unknown' }} · {{ task.modelDisplayName || task.modelKey || task.model || 'unknown' }}</span>
              <small>ID: {{ task.taskId || task.id }}</small>
            </div>
            <div class="admin-task-meta">
              <n-tag :type="statusType(task.status)" size="small">{{ statusLabel(task.status) }}</n-tag>
              <strong>{{ task.routeDisplayName || task.routeName || task.lineKey || '默认线路' }}</strong>
              <span>{{ task.chargeStatus || '未计费' }} · {{ formatNumber(task.cost ?? task.costPoints) }}</span>
            </div>
            <div class="admin-task-progress">
              <span>{{ formatNumber(task.progress) }}%</span>
              <n-progress type="line" :percentage="Number(task.progress || 0)" :height="8" :show-indicator="false" />
              <small>{{ task.resolvedSize || task.size || '-' }} · {{ task.imageCount || 1 }} 张</small>
            </div>
            <div class="admin-task-time">
              <span>创建</span>
              <strong>{{ formatDate(task.createdAt) }}</strong>
              <span>完成</span>
              <strong>{{ formatDate(task.finishedAt || task.updatedAt) }}</strong>
            </div>
            <p v-if="task.errorMessage" class="admin-task-error">{{ task.errorMessage }}</p>
          </article>
          <p v-if="!visibleTasks.length && !loading" class="admin-empty">暂无匹配任务</p>
        </div>

        <div class="admin-users-pagination">
          <span>共 {{ formatNumber(total) }} 个任务</span>
          <n-pagination
            v-model:page="page"
            :page-size="pageSize"
            :item-count="total"
            :page-slot="5"
            @update:page="loadTasks"
          />
        </div>
      </section>
    </section>
  </main>
</template>

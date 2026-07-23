<script setup lang="ts">
import AdminToolbar from '../components/admin/AdminToolbar.vue';
import AdminStatGrid from '../components/admin/AdminStatGrid.vue';
import AdminEmptyState from '../components/admin/AdminEmptyState.vue';
import AdminFeedback from '../components/admin/AdminFeedback.vue';
import AdminPageHeader from '../components/admin/AdminPageHeader.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NAlert, NButton, NInput, NPagination, NProgress, NSelect, NTag } from 'naive-ui';
import {
  Activity,
  CheckCircle2,
  Coins,
  Image,
  RefreshCcw,
  Search,
  Timer,
  Trash2,
  XCircle
} from 'lucide-vue-next';
import { clearAdminAuthSession } from '../api/adminAuth';
import {
  cancelAdminGenerateTask,
  deleteAdminGenerateTask,
  getAdminGenerateTasks,
  type AdminGenerateTask
} from '../api/adminGenerateTasks';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
const successMessage = ref('');
const actionLoadingId = ref('');
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
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' }
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

const queueModeLabel = computed(() => {
  if (summary.value.queueMode === 'runtime-memory+history') return '运行时 + 历史';
  return String(summary.value.queueMode || '本地记录');
});

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

function isCancellable(task: AdminGenerateTask) {
  return ['pending', 'running'].includes(task.status || '');
}

function isDeletable(task: AdminGenerateTask) {
  return ['success', 'completed', 'failed', 'error', 'cancelled'].includes(task.status || '');
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

async function cancelTask(task: AdminGenerateTask) {
  const id = task.taskId || task.id;
  if (!window.confirm(`确认取消任务「${id}」吗？取消会停止本地结果入库；已发往上游的请求仍可能产生费用。`)) return;
  actionLoadingId.value = `cancel:${id}`;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await cancelAdminGenerateTask(id);
    await loadTasks();
    successMessage.value = '任务已标记为取消。';
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '取消任务失败');
  } finally {
    actionLoadingId.value = '';
  }
}

async function removeTask(task: AdminGenerateTask) {
  const id = task.taskId || task.id;
  if (!window.confirm(`确认删除任务记录「${id}」吗？此操作不会退还已扣算力。`)) return;
  actionLoadingId.value = `delete:${id}`;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await deleteAdminGenerateTask(id);
    await loadTasks();
    successMessage.value = '任务记录已删除。';
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '删除任务记录失败');
  } finally {
    actionLoadingId.value = '';
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
  <AdminPageShell>
    <AdminPageHeader eyebrow="Generation Tasks" title="任务监控" description="查看生成任务、模型线路、进度、消耗和错误；运行中任务可取消，已结束记录可删除。">
      <template #actions>
          <n-button secondary :loading="loading" @click="loadTasks">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
      </template>
    </AdminPageHeader>

    <AdminFeedback :error-message="errorMessage" :success-message="successMessage" />

      <n-alert v-if="summary.dataScope" type="info" :bordered="false">{{ summary.dataScope }}</n-alert>

      <AdminStatGrid :stats="statCards" label="任务统计" />

      <section class="admin-source-panel admin-tasks-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Task Operations</p>
            <h2>生成任务列表</h2>
          </div>
          <n-tag type="info" :bordered="false">{{ queueModeLabel }}</n-tag>
        </div>

        <AdminToolbar class="admin-tasks-toolbar">
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
        </AdminToolbar>

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
              <strong>{{ task.routeDisplayName || task.routeName || task.lineKey || '线路未记录' }}</strong>
              <span>{{ task.chargeStatus || '未计费' }} · {{ formatNumber(task.cost ?? task.costPoints) }}</span>
            </div>
            <div class="admin-task-progress">
              <span>{{ formatNumber(task.progress) }}%</span>
              <n-progress type="line" :percentage="Number(task.progress || 0)" :height="8" :show-indicator="false" />
              <small>{{ task.resolvedSize || task.size || '规格未记录' }} · {{ task.imageCount || 0 }} 张</small>
            </div>
            <div class="admin-task-time">
              <span>创建</span>
              <strong>{{ formatDate(task.createdAt) }}</strong>
              <span>完成</span>
              <strong>{{ formatDate(task.finishedAt || task.updatedAt) }}</strong>
            </div>
            <div class="admin-card-actions admin-task-actions">
              <n-button v-if="isCancellable(task)" size="small" secondary type="warning" :loading="actionLoadingId === `cancel:${task.taskId || task.id}`" @click="cancelTask(task)">取消任务</n-button>
              <n-button v-if="isDeletable(task)" size="small" tertiary type="error" :loading="actionLoadingId === `delete:${task.taskId || task.id}`" @click="removeTask(task)">
                <template #icon><Trash2 :size="14" /></template>删除记录
              </n-button>
              <span v-if="!isCancellable(task) && !isDeletable(task)" class="admin-action-muted">暂无操作</span>
            </div>
            <p v-if="task.errorMessage" class="admin-task-error">{{ task.errorMessage }}</p>
          </article>
          <AdminEmptyState v-if="!visibleTasks.length && !loading" message="暂无匹配任务" />
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
  </AdminPageShell>
</template>

<script setup lang="ts">
import AdminToolbar from '../components/admin/AdminToolbar.vue';
import AdminEmptyState from '../components/admin/AdminEmptyState.vue';
import AdminFeedback from '../components/admin/AdminFeedback.vue';
import AdminPageHeader from '../components/admin/AdminPageHeader.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NDynamicTags, NInput, NInputNumber, NSelect, NTag, useMessage } from 'naive-ui';
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  UploadCloud
} from 'lucide-vue-next';
import { clearAdminAuthSession } from '../api/adminAuth';
import {
  createAdminSystemPrompt,
  deleteAdminSystemPrompt,
  getAdminSystemPrompts,
  updateAdminSystemPrompt,
  type AdminSystemPrompt,
  type AdminSystemPromptStatus
} from '../api/adminSystemPrompts';
import { getApiErrorMessage } from '../api/http';

const PAGE_SIZE = 10;

const router = useRouter();
const message = useMessage();
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref('');
const items = ref<AdminSystemPrompt[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<(string | null)[]>([null]);
const keyword = ref('');
const categoryFilter = ref('');
const statusFilter = ref<'' | AdminSystemPromptStatus>('');
const editingId = ref<string | null>(null);
const formOpen = ref(false);
const previewId = ref<string | null>(null);
const form = ref({
  title: '',
  content: '',
  category: '',
  tags: [] as string[],
  status: 'draft' as AdminSystemPromptStatus,
  sortOrder: 0
});

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已停用', value: 'disabled' }
];

const formStatusOptions = statusOptions.filter((option) => option.value !== '');

function statusLabel(status: AdminSystemPromptStatus) {
  const labels: Record<AdminSystemPromptStatus, string> = {
    draft: '草稿',
    published: '已发布',
    disabled: '已停用'
  };
  return labels[status] || status;
}

function statusTagType(status: AdminSystemPromptStatus) {
  if (status === 'published') return 'success';
  if (status === 'disabled') return 'error';
  return 'warning';
}

function formatDate(raw?: string) {
  if (!raw) return '-';
  const date = new Date(String(raw).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function friendlyError(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback, {
    unauthorized: '请先使用管理员账号登录。',
    forbidden: '当前账号不是管理员。'
  });
}

function currentCursor() {
  return cursorStack.value[cursorStack.value.length - 1] || null;
}

async function loadPrompts() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await getAdminSystemPrompts({
      q: keyword.value,
      category: categoryFilter.value,
      status: statusFilter.value,
      cursor: currentCursor() || undefined,
      limit: PAGE_SIZE
    });
    items.value = data.items;
    nextCursor.value = data.nextCursor;
  } catch (error) {
    errorMessage.value = friendlyError(error, '系统提示词列表加载失败');
  } finally {
    loading.value = false;
  }
}

async function applyFilters() {
  cursorStack.value = [null];
  await loadPrompts();
}

async function goNextPage() {
  if (!nextCursor.value) return;
  cursorStack.value = [...cursorStack.value, nextCursor.value];
  await loadPrompts();
}

async function goPrevPage() {
  if (cursorStack.value.length <= 1) return;
  cursorStack.value = cursorStack.value.slice(0, -1);
  await loadPrompts();
}

function openCreateForm() {
  editingId.value = null;
  form.value = { title: '', content: '', category: '', tags: [], status: 'draft', sortOrder: 0 };
  formOpen.value = true;
}

function openEditForm(item: AdminSystemPrompt) {
  editingId.value = item.id;
  form.value = {
    title: item.title,
    content: item.content,
    category: item.category,
    tags: [...(item.tags || [])],
    status: item.status,
    sortOrder: item.sortOrder
  };
  formOpen.value = true;
}

function closeForm() {
  formOpen.value = false;
  editingId.value = null;
}

async function saveForm() {
  if (!form.value.title.trim()) {
    message.warning('请填写标题');
    return;
  }
  if (!form.value.content.trim()) {
    message.warning('请填写内容');
    return;
  }
  saving.value = true;
  errorMessage.value = '';
  try {
    const payload = {
      title: form.value.title,
      content: form.value.content,
      category: form.value.category,
      tags: form.value.tags,
      status: form.value.status,
      sortOrder: Number(form.value.sortOrder) || 0
    };
    if (editingId.value) {
      await updateAdminSystemPrompt(editingId.value, payload);
      message.success('系统提示词已更新');
    } else {
      await createAdminSystemPrompt(payload);
      message.success('系统提示词已创建');
    }
    closeForm();
    await loadPrompts();
  } catch (error) {
    errorMessage.value = friendlyError(error, '系统提示词保存失败');
    message.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
}

async function changeStatus(item: AdminSystemPrompt, status: AdminSystemPromptStatus) {
  saving.value = true;
  errorMessage.value = '';
  try {
    await updateAdminSystemPrompt(item.id, { status });
    message.success(status === 'published' ? `已发布「${item.title}」` : `已停用「${item.title}」`);
    await loadPrompts();
  } catch (error) {
    errorMessage.value = friendlyError(error, '状态更新失败');
    message.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
}

async function removePrompt(item: AdminSystemPrompt) {
  if (!window.confirm(`确认删除系统提示词「${item.title}」？删除为软删除。`)) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    await deleteAdminSystemPrompt(item.id);
    message.success(`已删除「${item.title}」`);
    if (items.value.length === 1 && cursorStack.value.length > 1) {
      cursorStack.value = cursorStack.value.slice(0, -1);
    }
    await loadPrompts();
  } catch (error) {
    errorMessage.value = friendlyError(error, '系统提示词删除失败');
    message.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
}

function togglePreview(item: AdminSystemPrompt) {
  previewId.value = previewId.value === item.id ? null : item.id;
}

async function logout() {
  clearAdminAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadPrompts);
</script>

<template>
  <AdminPageShell>
    <AdminPageHeader eyebrow="System Prompts" title="系统提示词" description="维护全站共享的系统提示词，发布后普通用户只读可见，可复制为私有副本。">
      <template #actions>
          <n-button secondary :loading="loading" @click="loadPrompts">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
      </template>
    </AdminPageHeader>

    <AdminFeedback :error-message="errorMessage" />

      <section v-if="formOpen" class="admin-source-panel admin-system-prompts-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">{{ editingId ? 'Edit Prompt' : 'Create Prompt' }}</p>
            <h2>{{ editingId ? '编辑系统提示词' : '新建系统提示词' }}</h2>
          </div>
          <n-tag type="info" :bordered="false">{{ editingId ? '编辑中' : '新建' }}</n-tag>
        </div>

        <form class="admin-system-prompts-form" @submit.prevent="saveForm">
          <label>
            <span>标题</span>
            <n-input v-model:value="form.title" clearable placeholder="例如 白底商品主图" />
          </label>
          <label>
            <span>分类</span>
            <n-input v-model:value="form.category" clearable placeholder="例如 电商主图" />
          </label>
          <label>
            <span>状态</span>
            <n-select v-model:value="form.status" :options="formStatusOptions" />
          </label>
          <label>
            <span>排序（越小越靠前）</span>
            <n-input-number v-model:value="form.sortOrder" :step="1" />
          </label>
          <label class="admin-system-prompts-form-wide">
            <span>标签</span>
            <n-dynamic-tags v-model:value="form.tags" />
          </label>
          <label class="admin-system-prompts-form-wide">
            <span>内容（按纯文本保存与展示）</span>
            <n-input v-model:value="form.content" type="textarea" :rows="6" placeholder="提示词正文" />
          </label>
          <div class="admin-system-prompts-form-actions">
            <n-button :disabled="saving" @click="closeForm">取消</n-button>
            <n-button type="primary" attr-type="submit" :loading="saving">
              {{ editingId ? '保存修改' : '创建提示词' }}
            </n-button>
          </div>
        </form>
      </section>

      <section class="admin-source-panel admin-system-prompts-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">System Prompt List</p>
            <h2>系统提示词列表</h2>
          </div>
          <n-button type="primary" @click="openCreateForm">
            <template #icon><Plus :size="16" /></template>
            新建提示词
          </n-button>
        </div>

        <AdminToolbar class="admin-system-prompts-toolbar">
          <n-input v-model:value="keyword" clearable placeholder="搜索标题 / 内容 / 分类" @keyup.enter="applyFilters">
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-input v-model:value="categoryFilter" clearable placeholder="分类精确筛选" @keyup.enter="applyFilters" />
          <n-select v-model:value="statusFilter" :options="statusOptions" @update:value="applyFilters" />
          <n-button type="primary" :loading="loading" @click="applyFilters">查询</n-button>
        </AdminToolbar>

        <div class="admin-system-prompts-list" aria-label="系统提示词列表">
          <article v-for="item in items" :key="item.id">
            <div class="admin-system-prompts-item-head">
              <strong>{{ item.title }}</strong>
              <n-tag :type="statusTagType(item.status)" size="small">{{ statusLabel(item.status) }}</n-tag>
              <n-tag size="small" :bordered="false">v{{ item.version }}</n-tag>
              <n-tag size="small" type="info" :bordered="false">排序 {{ item.sortOrder }}</n-tag>
            </div>
            <div class="admin-system-prompts-item-meta">
              <span>分类：{{ item.category || '未分类' }}</span>
              <span>标签：{{ (item.tags || []).join('、') || '无' }}</span>
              <span>更新：{{ formatDate(item.updatedAt) }}</span>
            </div>
            <pre v-if="previewId === item.id" class="admin-system-prompts-preview">{{ item.content }}</pre>
            <div class="admin-system-prompts-item-actions">
              <n-button size="small" tertiary @click="togglePreview(item)">
                <template #icon><Eye :size="14" /></template>
                {{ previewId === item.id ? '收起预览' : '内容预览' }}
              </n-button>
              <n-button size="small" tertiary @click="openEditForm(item)">
                <template #icon><Pencil :size="14" /></template>
                编辑
              </n-button>
              <n-button v-if="item.status !== 'published'" size="small" tertiary type="success" :disabled="saving" @click="changeStatus(item, 'published')">
                <template #icon><UploadCloud :size="14" /></template>
                发布
              </n-button>
              <n-button v-if="item.status === 'published'" size="small" tertiary type="warning" :disabled="saving" @click="changeStatus(item, 'disabled')">
                <template #icon><Ban :size="14" /></template>
                停用
              </n-button>
              <n-button size="small" tertiary type="error" :disabled="saving" @click="removePrompt(item)">
                <template #icon><Trash2 :size="14" /></template>
                删除
              </n-button>
            </div>
          </article>
          <AdminEmptyState v-if="!items.length && !loading" message="暂无匹配系统提示词" />
        </div>

        <div class="admin-users-pagination">
          <span>本页 {{ items.length }} 条</span>
          <div class="admin-system-prompts-pagination">
            <n-button size="small" secondary :disabled="cursorStack.length <= 1 || loading" @click="goPrevPage">
              <template #icon><ChevronLeft :size="14" /></template>
              上一页
            </n-button>
            <n-button size="small" secondary :disabled="!nextCursor || loading" @click="goNextPage">
              下一页
              <template #icon><ChevronRight :size="14" /></template>
            </n-button>
          </div>
        </div>
      </section>

      <section class="admin-source-panel admin-system-prompts-panel admin-system-prompts-hint">
        <CheckCircle2 :size="16" />
        <p>普通用户只读「已发布」提示词；内容每次修改版本号自动 +1；删除为软删除，不影响已保存到项目中的文本快照。</p>
      </section>
  </AdminPageShell>
</template>

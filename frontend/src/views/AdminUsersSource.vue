<script setup lang="ts">
import AdminToolbar from '../components/admin/AdminToolbar.vue';
import AdminStatGrid from '../components/admin/AdminStatGrid.vue';
import AdminEmptyState from '../components/admin/AdminEmptyState.vue';
import AdminFeedback from '../components/admin/AdminFeedback.vue';
import AdminPageHeader from '../components/admin/AdminPageHeader.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NPagination, NSelect, NTag } from 'naive-ui';
import {
  Coins,
  Mail,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCheck,
  Users
} from 'lucide-vue-next';
import { clearAdminAuthSession } from '../api/adminAuth';
import { getAdminUsers, type AdminUser } from '../api/adminUsers';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
const users = ref<AdminUser[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref('');
const roleFilter = ref('all');
const statusFilter = ref('all');

const roleOptions = [
  { label: '全部角色', value: 'all' },
  { label: '管理员', value: 'admin' },
  { label: '普通用户', value: 'user' }
];

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
  { label: '封禁', value: 'banned' }
];

const visibleUsers = computed(() => {
  return users.value.filter((user) => {
    const roleMatched = roleFilter.value === 'all' || user.role === roleFilter.value;
    const statusMatched = statusFilter.value === 'all' || user.status === statusFilter.value;
    return roleMatched && statusMatched;
  });
});

const statCards = computed(() => {
  const activeCount = users.value.filter((user) => user.status === 'active').length;
  const adminCount = users.value.filter((user) => user.role === 'admin').length;
  const balanceTotal = users.value.reduce((sum, user) => sum + Number(user.balance ?? user.credits ?? 0), 0);
  return [
    { label: '用户总数', value: total.value, icon: Users },
    { label: '当前页用户', value: users.value.length, icon: UserCheck },
    { label: '启用账户', value: activeCount, icon: ShieldCheck },
    { label: '管理员', value: adminCount, icon: ShieldCheck },
    { label: '当前页余额', value: balanceTotal, icon: Coins }
  ];
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
  if (status === 'active') return 'success';
  if (status === 'disabled') return 'warning';
  if (status === 'banned') return 'error';
  return 'default';
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    active: '启用',
    disabled: '停用',
    banned: '封禁'
  };
  return labels[status || ''] || status || '未知';
}

function roleLabel(role?: string) {
  if (role === 'admin') return '管理员';
  if (role === 'user') return '普通用户';
  return role || '未知角色';
}

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, '用户列表加载失败', {
    unauthorized: '请先使用管理员账号登录。',
    forbidden: '当前账号不是管理员。'
  });
}

async function loadUsers() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await getAdminUsers({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value.trim() || undefined
    });
    users.value = data.users;
    total.value = data.total;
    page.value = data.page;
    pageSize.value = data.pageSize;
  } catch (error) {
    errorMessage.value = friendlyError(error);
  } finally {
    loading.value = false;
  }
}

async function applySearch() {
  page.value = 1;
  await loadUsers();
}

async function logout() {
  clearAdminAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadUsers);
</script>

<template>
  <AdminPageShell>
    <AdminPageHeader eyebrow="Admin Users" title="用户管理" description="只读迁移版：查询账户、角色、状态和余额，不执行删除、改余额或重置密码。">
      <template #actions>
          <n-button secondary :loading="loading" @click="loadUsers">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
      </template>
    </AdminPageHeader>

    <AdminFeedback :error-message="errorMessage" />

      <AdminStatGrid :stats="statCards" label="用户统计" />

      <section class="admin-source-panel admin-users-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Read Only List</p>
            <h2>用户列表</h2>
          </div>
          <n-tag type="info" :bordered="false">只读</n-tag>
        </div>

        <AdminToolbar class="admin-users-toolbar">
          <n-input
            v-model:value="keyword"
            clearable
            placeholder="搜索用户名 / 邮箱 / 角色 / 状态"
            @keyup.enter="applySearch"
          >
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-select v-model:value="roleFilter" :options="roleOptions" />
          <n-select v-model:value="statusFilter" :options="statusOptions" />
          <n-button type="primary" :loading="loading" @click="applySearch">查询</n-button>
        </AdminToolbar>

        <div class="admin-users-list" aria-label="用户列表">
          <article v-for="user in visibleUsers" :key="user.id">
            <div class="admin-user-avatar">
              {{ (user.username || user.email || '?').slice(0, 1).toUpperCase() }}
            </div>
            <div class="admin-user-main">
              <strong>{{ user.username || '未命名用户' }}</strong>
              <span><Mail :size="14" />{{ user.email || '暂无邮箱' }}</span>
              <small>ID: {{ user.id }}</small>
            </div>
            <div class="admin-user-tags">
              <n-tag :type="user.role === 'admin' ? 'success' : 'default'" size="small">{{ roleLabel(user.role) }}</n-tag>
              <n-tag :type="statusType(user.status)" size="small">{{ statusLabel(user.status) }}</n-tag>
            </div>
            <div class="admin-user-money">
              <span>余额</span>
              <strong>{{ formatNumber(user.balance ?? user.credits) }}</strong>
            </div>
            <div class="admin-user-time">
              <span>创建</span>
              <strong>{{ formatDate(user.createdAt || user.created_at) }}</strong>
              <span>最近登录</span>
              <strong>{{ formatDate(user.lastLoginAt || user.last_login_at) }}</strong>
            </div>
          </article>
          <AdminEmptyState v-if="!visibleUsers.length && !loading" message="暂无匹配用户" />
        </div>

        <div class="admin-users-pagination">
          <span>共 {{ formatNumber(total) }} 个用户</span>
          <n-pagination
            v-model:page="page"
            :page-size="pageSize"
            :item-count="total"
            :page-slot="5"
            @update:page="loadUsers"
          />
        </div>
      </section>
  </AdminPageShell>
</template>

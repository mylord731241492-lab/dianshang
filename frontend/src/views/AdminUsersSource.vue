<script setup lang="ts">
import AdminToolbar from '../components/admin/AdminToolbar.vue';
import AdminStatGrid from '../components/admin/AdminStatGrid.vue';
import AdminEmptyState from '../components/admin/AdminEmptyState.vue';
import AdminFeedback from '../components/admin/AdminFeedback.vue';
import AdminPageHeader from '../components/admin/AdminPageHeader.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NInputNumber, NPagination, NSelect, NTag } from 'naive-ui';
import {
  Coins,
  KeyRound,
  Mail,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  WalletCards
} from 'lucide-vue-next';
import { clearAdminAuthSession, readAdminAuthUser } from '../api/adminAuth';
import {
  adjustAdminUserBalance,
  checkAdminUserSecurity,
  deleteAdminUser,
  getAdminUsers,
  resetAdminUserPassword,
  updateAdminUserStatus,
  type AdminUser
} from '../api/adminUsers';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
const successMessage = ref('');
const users = ref<AdminUser[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref('');
const roleFilter = ref('all');
const statusFilter = ref('all');
const actionLoadingId = ref('');
const actionMode = ref<'status' | 'balance' | 'password' | ''>('');
const actionTarget = ref<AdminUser | null>(null);
const statusDraft = ref('active');
const balanceDraft = ref<number | null>(null);
const balanceRemark = ref('管理员调整余额');
const passwordDraft = ref('');
const passwordConfirm = ref('');
const currentAdminId = readAdminAuthUser()?.id || '';

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

const editableStatusOptions = statusOptions.filter((item) => item.value !== 'all');

const actionTitle = computed(() => {
  if (actionMode.value === 'status') return '修改账户状态';
  if (actionMode.value === 'balance') return '调整用户余额';
  if (actionMode.value === 'password') return '重置用户密码';
  return '';
});

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

function closeActionForm() {
  actionMode.value = '';
  actionTarget.value = null;
  balanceDraft.value = null;
  passwordDraft.value = '';
  passwordConfirm.value = '';
}

function openStatusForm(user: AdminUser) {
  actionTarget.value = user;
  actionMode.value = 'status';
  statusDraft.value = user.status || 'active';
}

function openBalanceForm(user: AdminUser) {
  actionTarget.value = user;
  actionMode.value = 'balance';
  balanceDraft.value = null;
  balanceRemark.value = '管理员调整余额';
}

function openPasswordForm(user: AdminUser) {
  actionTarget.value = user;
  actionMode.value = 'password';
  passwordDraft.value = '';
  passwordConfirm.value = '';
}

async function saveUserAction() {
  const user = actionTarget.value;
  if (!user) return;
  errorMessage.value = '';
  successMessage.value = '';
  const loadingKey = `${actionMode.value}:${user.id}`;
  actionLoadingId.value = loadingKey;
  try {
    if (actionMode.value === 'status') {
      if (user.id === currentAdminId && statusDraft.value !== 'active') {
        errorMessage.value = '不能停用或封禁当前管理员账号。';
        return;
      }
      if (statusDraft.value !== 'active' && !window.confirm(`确认将「${user.username || user.id}」设为${statusLabel(statusDraft.value)}吗？`)) return;
      await updateAdminUserStatus(user.id, statusDraft.value);
      successMessage.value = '用户状态已更新。';
    } else if (actionMode.value === 'balance') {
      const amount = Number(balanceDraft.value);
      if (!Number.isFinite(amount) || amount === 0) {
        errorMessage.value = '请输入非零余额调整值；正数增加，负数扣减。';
        return;
      }
      const nextBalance = Number(user.balance ?? user.credits ?? 0) + amount;
      if (nextBalance < 0) {
        errorMessage.value = '调整后余额不能小于 0。';
        return;
      }
      if (!window.confirm(`确认将「${user.username || user.id}」的余额调整 ${amount > 0 ? '+' : ''}${amount} 吗？`)) return;
      await adjustAdminUserBalance(user.id, amount, balanceRemark.value.trim() || '管理员调整余额');
      successMessage.value = '用户余额已更新，并已写入余额日志。';
    } else if (actionMode.value === 'password') {
      if (passwordDraft.value.length < 6) {
        errorMessage.value = '新密码至少需要 6 位。';
        return;
      }
      if (passwordDraft.value !== passwordConfirm.value) {
        errorMessage.value = '两次输入的新密码不一致。';
        return;
      }
      if (!window.confirm(`确认重置「${user.username || user.id}」的登录密码吗？`)) return;
      await resetAdminUserPassword(user.id, passwordDraft.value);
      successMessage.value = '用户密码已重置。';
    }
    closeActionForm();
    await loadUsers();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '用户操作失败');
  } finally {
    actionLoadingId.value = '';
  }
}

async function runSecurityCheck(user: AdminUser) {
  actionLoadingId.value = `security:${user.id}`;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const result = await checkAdminUserSecurity(user.id);
    successMessage.value = `安全检查：${result.riskLevel || '正常'}；${(result.checks || []).join('，') || '未发现异常'}。`;
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '安全检查失败');
  } finally {
    actionLoadingId.value = '';
  }
}

async function removeUser(user: AdminUser) {
  if (user.id === currentAdminId) {
    errorMessage.value = '不能删除当前管理员账号。';
    return;
  }
  if (!window.confirm(`确认将用户「${user.username || user.id}」移入回收站吗？`)) return;
  actionLoadingId.value = `delete:${user.id}`;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await deleteAdminUser(user.id);
    await loadUsers();
    successMessage.value = '用户已移入回收站。';
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '删除用户失败');
  } finally {
    actionLoadingId.value = '';
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
    <AdminPageHeader eyebrow="Admin Users" title="用户管理" description="查询并维护账户状态、余额、密码和回收站状态；当前管理员账号受自删、自停用保护。">
      <template #actions>
          <n-button secondary :loading="loading" @click="loadUsers">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
      </template>
    </AdminPageHeader>

    <AdminFeedback :error-message="errorMessage" :success-message="successMessage" />

      <section v-if="actionTarget" class="admin-source-panel admin-inline-action-panel" data-testid="admin-user-action-form">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">User Action</p>
            <h2>{{ actionTitle }} · {{ actionTarget.username || actionTarget.id }}</h2>
          </div>
          <n-button secondary @click="closeActionForm">取消</n-button>
        </div>
        <form class="form-grid admin-inline-action-form" @submit.prevent="saveUserAction">
          <label v-if="actionMode === 'status'">
            账户状态
            <n-select v-model:value="statusDraft" :options="editableStatusOptions" />
          </label>
          <label v-if="actionMode === 'balance'">
            调整值
            <n-input-number v-model:value="balanceDraft" :show-button="false" placeholder="正数增加，负数扣减" />
          </label>
          <label v-if="actionMode === 'balance'">
            调整原因
            <n-input v-model:value="balanceRemark" maxlength="80" show-count />
          </label>
          <label v-if="actionMode === 'password'">
            新密码
            <n-input v-model:value="passwordDraft" type="password" show-password-on="click" placeholder="至少 6 位" />
          </label>
          <label v-if="actionMode === 'password'">
            确认新密码
            <n-input v-model:value="passwordConfirm" type="password" show-password-on="click" />
          </label>
          <div class="source-actions admin-inline-action-submit">
            <n-button secondary @click="closeActionForm">取消</n-button>
            <n-button type="primary" attr-type="submit" :loading="actionLoadingId.startsWith(`${actionMode}:`)">确认保存</n-button>
          </div>
        </form>
      </section>

      <AdminStatGrid :stats="statCards" label="用户统计" />

      <section class="admin-source-panel admin-users-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Account Operations</p>
            <h2>用户列表</h2>
          </div>
          <n-tag type="success" :bordered="false">可维护</n-tag>
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
            <div class="admin-card-actions admin-user-actions">
              <n-button size="tiny" secondary :disabled="user.id === currentAdminId" @click="openStatusForm(user)">状态</n-button>
              <n-button size="tiny" secondary @click="openBalanceForm(user)">
                <template #icon><WalletCards :size="13" /></template>余额
              </n-button>
              <n-button size="tiny" secondary @click="openPasswordForm(user)">
                <template #icon><KeyRound :size="13" /></template>密码
              </n-button>
              <n-button size="tiny" secondary :loading="actionLoadingId === `security:${user.id}`" @click="runSecurityCheck(user)">检查</n-button>
              <n-button size="tiny" tertiary type="error" :disabled="user.id === currentAdminId" :loading="actionLoadingId === `delete:${user.id}`" @click="removeUser(user)">
                <template #icon><Trash2 :size="13" /></template>删除
              </n-button>
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

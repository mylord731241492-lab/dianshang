<script setup lang="ts">
import AdminToolbar from '../components/admin/AdminToolbar.vue';
import AdminStatGrid from '../components/admin/AdminStatGrid.vue';
import AdminEmptyState from '../components/admin/AdminEmptyState.vue';
import AdminFeedback from '../components/admin/AdminFeedback.vue';
import AdminPageHeader from '../components/admin/AdminPageHeader.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NPagination, NTag } from 'naive-ui';
import { Coins, RefreshCcw, RotateCcw, Search, ShieldCheck, Trash2, UserCheck, Users } from 'lucide-vue-next';
import { clearAdminAuthSession } from '../api/adminAuth';
import { getAdminRecycleBin, purgeAdminRecycleUser, restoreAdminRecycleUser } from '../api/adminRecycleBin';
import { getApiErrorMessage } from '../api/http';
import type { AdminUser } from '../api/adminUsers';

const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
const successMessage = ref('');
const actionLoadingId = ref('');
const users = ref<AdminUser[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');

const visibleUsers = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter((user) =>
    [user.id, user.username, user.email, user.role, user.status]
      .some((value) => String(value || '').toLowerCase().includes(q))
  );
});

const statCards = computed(() => {
  const admins = users.value.filter((user) => user.role === 'admin').length;
  const balance = users.value.reduce((sum, user) => sum + Number(user.balance ?? user.credits ?? 0), 0);
  return [
    { label: '回收站总数', value: total.value, icon: Trash2 },
    { label: '当前页用户', value: users.value.length, icon: Users },
    { label: '匹配用户', value: visibleUsers.value.length, icon: UserCheck },
    { label: '管理员', value: admins, icon: ShieldCheck },
    { label: '当前页余额', value: balance, icon: Coins }
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

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, '回收站加载失败', {
    unauthorized: '请先使用管理员账号登录。',
    forbidden: '当前账号不是管理员。'
  });
}

async function loadUsers() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await getAdminRecycleBin({ page: page.value, pageSize: pageSize.value });
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

async function restoreUser(user: AdminUser) {
  if (!window.confirm(`确认恢复用户「${user.username || user.id}」吗？恢复后账号将重新启用。`)) return;
  actionLoadingId.value = `restore:${user.id}`;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await restoreAdminRecycleUser(user.id);
    await loadUsers();
    successMessage.value = '用户已恢复并重新启用。';
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '恢复用户失败');
  } finally {
    actionLoadingId.value = '';
  }
}

async function purgeUser(user: AdminUser) {
  const confirmed = window.confirm(
    `确认永久清理用户「${user.username || user.id}」吗？用户名、邮箱和头像将被匿名化，此操作不能恢复。`
  );
  if (!confirmed) return;
  actionLoadingId.value = `purge:${user.id}`;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await purgeAdminRecycleUser(user.id);
    await loadUsers();
    successMessage.value = '用户数据已永久匿名化。';
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '永久清理用户失败');
  } finally {
    actionLoadingId.value = '';
  }
}

async function logout() {
  clearAdminAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadUsers);
</script>

<template>
  <AdminPageShell>
    <AdminPageHeader eyebrow="Recycle Bin" title="回收站" description="查看已删除用户，可恢复账号或永久匿名化用户身份信息。">
      <template #actions>
          <n-button secondary :loading="loading" @click="loadUsers">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
      </template>
    </AdminPageHeader>

    <AdminFeedback :error-message="errorMessage" :success-message="successMessage" />

      <AdminStatGrid :stats="statCards" label="回收站统计" />

      <section class="admin-source-panel admin-recycle-bin-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Deleted User Operations</p>
            <h2>已删除用户</h2>
          </div>
          <n-tag type="warning" :bordered="false">谨慎操作</n-tag>
        </div>

        <AdminToolbar class="admin-recycle-bin-toolbar">
          <n-input v-model:value="keyword" clearable placeholder="搜索用户名 / 邮箱 / ID / 角色">
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-button type="primary" :loading="loading" @click="loadUsers">查询</n-button>
        </AdminToolbar>

        <div class="admin-recycle-bin-list" aria-label="回收站用户列表">
          <article v-for="user in visibleUsers" :key="user.id">
            <div class="admin-recycle-user-icon"><Trash2 :size="20" /></div>
            <div class="admin-recycle-user-main">
              <strong>{{ user.username }}</strong>
              <span>{{ user.email || '暂无邮箱' }}</span>
              <small>ID: {{ user.id }}</small>
            </div>
            <div class="admin-recycle-user-role">
              <n-tag size="small" type="warning">{{ user.role || 'user' }}</n-tag>
              <span>{{ user.status || 'deleted' }}</span>
            </div>
            <div class="admin-recycle-user-balance">
              <span>余额</span>
              <strong>{{ formatNumber(user.balance ?? user.credits) }}</strong>
            </div>
            <div class="admin-recycle-user-time">
              <span>创建</span>
              <strong>{{ formatDate(user.createdAt || user.created_at) }}</strong>
              <span>可恢复或永久匿名化</span>
            </div>
            <div class="admin-card-actions admin-recycle-user-actions">
              <n-button size="small" secondary :loading="actionLoadingId === `restore:${user.id}`" @click="restoreUser(user)">
                <template #icon><RotateCcw :size="14" /></template>恢复
              </n-button>
              <n-button size="small" tertiary type="error" :loading="actionLoadingId === `purge:${user.id}`" @click="purgeUser(user)">
                <template #icon><Trash2 :size="14" /></template>永久清理
              </n-button>
            </div>
          </article>
          <AdminEmptyState v-if="!visibleUsers.length && !loading" message="回收站暂无已删除用户" />
        </div>

        <div class="admin-users-pagination">
          <span>共 {{ formatNumber(total) }} 个已删除用户，当前显示 {{ formatNumber(visibleUsers.length) }} 个</span>
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

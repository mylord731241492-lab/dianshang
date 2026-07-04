<script setup lang="ts">
import AdminSourceSidebar from '../components/AdminSourceSidebar.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NPagination, NTag } from 'naive-ui';
import { ArrowLeft, Coins, RefreshCcw, Search, ShieldCheck, Trash2, UserCheck, Users, XCircle } from 'lucide-vue-next';
import { clearAdminAuthSession } from '../api/adminAuth';
import { getAdminRecycleBin } from '../api/adminRecycleBin';
import { getApiErrorMessage } from '../api/http';
import type { AdminUser } from '../api/adminUsers';

const router = useRouter();
const loading = ref(true);
const errorMessage = ref('');
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
    { label: '当前页余额', value: balance, icon: Coins },
    { label: '写入动作', value: 0, icon: XCircle }
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

async function logout() {
  clearAdminAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadUsers);
</script>

<template>
  <main class="admin-source-shell">
    <AdminSourceSidebar />

    <section class="admin-source-main">
      <header class="admin-source-topbar">
        <div>
          <RouterLink to="/" class="template-back"><ArrowLeft :size="16" />返回前台</RouterLink>
          <p class="eyebrow">Recycle Bin</p>
          <h1>回收站</h1>
          <span>只读迁移版：查看已删除用户，不恢复、不永久删除、不匿名化数据。</span>
        </div>
        <div class="admin-source-actions">
          <n-button secondary :loading="loading" @click="loadUsers">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
        </div>
      </header>

      <div v-if="errorMessage" class="template-error">{{ errorMessage }}</div>

      <section class="admin-stat-grid" aria-label="回收站统计">
        <article v-for="stat in statCards" :key="stat.label">
          <component :is="stat.icon" :size="20" />
          <span>{{ stat.label }}</span>
          <strong>{{ formatNumber(stat.value) }}</strong>
        </article>
      </section>

      <section class="admin-source-panel admin-recycle-bin-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Read Only Deleted Users</p>
            <h2>已删除用户</h2>
          </div>
          <n-tag type="info" :bordered="false">只读</n-tag>
        </div>

        <div class="admin-recycle-bin-toolbar">
          <n-input v-model:value="keyword" clearable placeholder="搜索用户名 / 邮箱 / ID / 角色">
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-button type="primary" :loading="loading" @click="loadUsers">查询</n-button>
        </div>

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
              <span>只读，不执行恢复或永久删除</span>
            </div>
          </article>
          <p v-if="!visibleUsers.length && !loading" class="admin-empty">回收站暂无已删除用户</p>
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
    </section>
  </main>
</template>

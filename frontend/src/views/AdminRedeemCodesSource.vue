<script setup lang="ts">
import AdminToolbar from '../components/admin/AdminToolbar.vue';
import AdminStatGrid from '../components/admin/AdminStatGrid.vue';
import AdminEmptyState from '../components/admin/AdminEmptyState.vue';
import AdminFeedback from '../components/admin/AdminFeedback.vue';
import AdminPageHeader from '../components/admin/AdminPageHeader.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NInputNumber, NPagination, NSelect, NSwitch, NTag, useMessage } from 'naive-ui';
import {
  CheckCircle2,
  Coins,
  KeyRound,
  PackageCheck,
  RefreshCcw,
  Search,
  Ticket,
  XCircle
} from 'lucide-vue-next';
import { clearAdminAuthSession } from '../api/adminAuth';
import {
  createAdminRedeemCode,
  deleteAdminRedeemCode,
  getAdminRedeemCodes,
  type AdminRedeemCode
} from '../api/adminRedeemCodes';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const message = useMessage();
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref('');
const codes = ref<AdminRedeemCode[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref('');
const statusFilter = ref('all');
const createForm = ref({
  code: '',
  amount: 50,
  maxUses: 1,
  enabled: true
});

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '启用中', value: 'active' },
  { label: '已禁用', value: 'disabled' },
  { label: '已用尽', value: 'exhausted' }
];

const visibleCodes = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return codes.value.filter((code) => {
    const statusMatched = statusFilter.value === 'all' || normalizedStatus(code) === statusFilter.value;
    if (!statusMatched) return false;
    if (!q) return true;
    return [
      code.code,
      code.status,
      pointsOf(code),
      maxUsesOf(code),
      usedCountOf(code),
      remainingCountOf(code)
    ].some((value) => String(value || '').toLowerCase().includes(q));
  });
});

const statCards = computed(() => {
  const active = codes.value.filter((code) => normalizedStatus(code) === 'active').length;
  const disabled = codes.value.filter((code) => normalizedStatus(code) === 'disabled').length;
  const exhausted = codes.value.filter((code) => normalizedStatus(code) === 'exhausted').length;
  const points = codes.value.reduce((sum, code) => sum + pointsOf(code), 0);
  const remaining = codes.value.reduce((sum, code) => sum + remainingCountOf(code), 0);
  return [
    { label: '兑换码总数', value: total.value, icon: Ticket },
    { label: '当前页算力', value: points, icon: Coins },
    { label: '启用中', value: active, icon: CheckCircle2 },
    { label: '已禁用', value: disabled, icon: XCircle },
    { label: '已用尽', value: exhausted, icon: XCircle },
    { label: '剩余次数', value: remaining, icon: PackageCheck }
  ];
});

function pointsOf(code: AdminRedeemCode) {
  return Number(code.points ?? code.amount ?? 0);
}

function maxUsesOf(code: AdminRedeemCode) {
  return Number(code.maxUses ?? code.totalCount ?? code.max_uses ?? 0);
}

function usedCountOf(code: AdminRedeemCode) {
  return Number(code.usedCount ?? code.used_count ?? 0);
}

function remainingCountOf(code: AdminRedeemCode) {
  const explicit = code.remainingCount;
  if (explicit !== undefined) return Number(explicit || 0);
  return Math.max(0, maxUsesOf(code) - usedCountOf(code));
}

function usagePercent(code: AdminRedeemCode) {
  const maxUses = maxUsesOf(code);
  if (!maxUses) return 0;
  return Math.min(100, Math.round((usedCountOf(code) / maxUses) * 100));
}

function normalizedStatus(code: AdminRedeemCode) {
  if (remainingCountOf(code) <= 0) return 'exhausted';
  if (code.enabled === false || code.status === 'disabled') return 'disabled';
  return 'active';
}

function statusType(code: AdminRedeemCode) {
  const status = normalizedStatus(code);
  if (status === 'active') return 'success';
  if (status === 'disabled') return 'error';
  if (status === 'exhausted') return 'warning';
  return 'default';
}

function statusLabel(code: AdminRedeemCode) {
  const labels: Record<string, string> = {
    active: '启用中',
    disabled: '已禁用',
    exhausted: '已用尽'
  };
  return labels[normalizedStatus(code)] || '未知';
}

function formatNumber(value?: number) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatDate(raw?: string) {
  if (!raw) return '长期有效';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, '兑换码列表加载失败', {
    unauthorized: '请先使用管理员账号登录。',
    forbidden: '当前账号不是管理员。'
  });
}

function randomCode() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  createForm.value.code = `DS${suffix}`;
}

function resetCreateForm() {
  createForm.value = {
    code: '',
    amount: 50,
    maxUses: 1,
    enabled: true
  };
}

async function loadCodes() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await getAdminRedeemCodes({
      page: page.value,
      pageSize: pageSize.value
    });
    codes.value = data.codes;
    total.value = data.total;
    page.value = data.page;
    pageSize.value = data.pageSize;
  } catch (error) {
    errorMessage.value = friendlyError(error);
  } finally {
    loading.value = false;
  }
}

async function createCode() {
  const code = createForm.value.code.trim().toUpperCase();
  const amount = Number(createForm.value.amount || 0);
  const maxUses = Number(createForm.value.maxUses || 0);
  if (!code) {
    message.warning('请填写兑换码');
    return;
  }
  if (amount <= 0) {
    message.warning('算力额度必须大于 0');
    return;
  }
  if (maxUses <= 0) {
    message.warning('可兑换次数必须大于 0');
    return;
  }
  saving.value = true;
  errorMessage.value = '';
  try {
    await createAdminRedeemCode({
      code,
      amount,
      points: amount,
      maxUses,
      enabled: createForm.value.enabled
    });
    message.success(`兑换码 ${code} 已添加`);
    resetCreateForm();
    page.value = 1;
    await loadCodes();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '兑换码添加失败', {
      unauthorized: '请先使用管理员账号登录。',
      forbidden: '当前账号不是管理员。'
    });
    message.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
}

async function removeCode(code: AdminRedeemCode) {
  const value = String(code.code || '').trim();
  if (!value) return;
  if (!window.confirm(`确认删除兑换码 ${value}？`)) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    await deleteAdminRedeemCode(value);
    message.success(`兑换码 ${value} 已删除`);
    await loadCodes();
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, '兑换码删除失败', {
      unauthorized: '请先使用管理员账号登录。',
      forbidden: '当前账号不是管理员。'
    });
    message.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
}

async function applyFilters() {
  page.value = 1;
  await loadCodes();
}

async function logout() {
  clearAdminAuthSession();
  await router.replace('/admin/login');
}

onMounted(loadCodes);
</script>

<template>
  <AdminPageShell>
    <AdminPageHeader eyebrow="Redeem Codes" title="兑换码管理" description="创建、查看和删除兑换码，用户可在个人中心兑换算力。">
      <template #actions>
          <n-button secondary :loading="loading" @click="loadCodes">
            <template #icon><RefreshCcw :size="16" /></template>
            刷新
          </n-button>
          <n-button tertiary type="error" @click="logout">退出</n-button>
      </template>
    </AdminPageHeader>

    <AdminFeedback :error-message="errorMessage" />

      <AdminStatGrid :stats="statCards" label="兑换码统计" />

      <section class="admin-source-panel admin-redeem-codes-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Create Code</p>
            <h2>新增兑换码</h2>
          </div>
          <n-tag type="success" :bordered="false">可创建</n-tag>
        </div>

        <form class="admin-redeem-code-create" @submit.prevent="createCode">
          <label>
            <span>兑换码</span>
            <n-input v-model:value="createForm.code" clearable placeholder="例如 DS20260704">
              <template #suffix>
                <button class="admin-inline-link" type="button" @click="randomCode">随机</button>
              </template>
            </n-input>
          </label>
          <label>
            <span>算力额度</span>
            <n-input-number v-model:value="createForm.amount" :min="1" :step="10" />
          </label>
          <label>
            <span>可兑换次数</span>
            <n-input-number v-model:value="createForm.maxUses" :min="1" :step="1" />
          </label>
          <label class="admin-redeem-code-enabled">
            <span>启用</span>
            <n-switch v-model:value="createForm.enabled" />
          </label>
          <div class="admin-redeem-code-create-actions">
            <n-button :disabled="saving" @click="resetCreateForm">重置</n-button>
            <n-button type="primary" attr-type="submit" :loading="saving">
              添加兑换码
            </n-button>
          </div>
        </form>
      </section>

      <section class="admin-source-panel admin-redeem-codes-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Redeem Code List</p>
            <h2>兑换码列表</h2>
          </div>
          <n-tag type="info" :bordered="false">共 {{ formatNumber(total) }} 个</n-tag>
        </div>

        <AdminToolbar class="admin-redeem-codes-toolbar">
          <n-input v-model:value="keyword" clearable placeholder="搜索兑换码 / 状态 / 算力" @keyup.enter="applyFilters">
            <template #prefix><Search :size="15" /></template>
          </n-input>
          <n-select v-model:value="statusFilter" :options="statusOptions" @update:value="applyFilters" />
          <n-button type="primary" :loading="loading" @click="applyFilters">查询</n-button>
        </AdminToolbar>

        <div class="admin-redeem-codes-list" aria-label="兑换码列表">
          <article v-for="code in visibleCodes" :key="code.code">
            <div class="admin-redeem-code-icon" :class="normalizedStatus(code)">
              <KeyRound :size="20" />
            </div>
            <div class="admin-redeem-code-main">
              <strong>{{ code.code }}</strong>
              <span>{{ pointsOf(code) }} 算力 · 单用户 {{ formatNumber(code.perUserLimit || 1) }} 次</span>
              <small>有效期: {{ formatDate(code.expiresAt) }}</small>
            </div>
            <div class="admin-redeem-code-status">
              <n-tag :type="statusType(code)" size="small">{{ statusLabel(code) }}</n-tag>
              <span>使用率 {{ usagePercent(code) }}%</span>
            </div>
            <div class="admin-redeem-code-counts">
              <span>已用 / 总次数</span>
              <strong>{{ formatNumber(usedCountOf(code)) }} / {{ formatNumber(maxUsesOf(code)) }}</strong>
              <span>剩余 {{ formatNumber(remainingCountOf(code)) }}</span>
            </div>
            <div class="admin-redeem-code-note">
              <span>接口字段</span>
              <strong>{{ code.status || (code.enabled ? 'active' : 'disabled') }}</strong>
              <n-button size="small" tertiary type="error" :disabled="saving" @click="removeCode(code)">
                删除
              </n-button>
            </div>
          </article>
          <AdminEmptyState v-if="!visibleCodes.length && !loading" message="暂无匹配兑换码" />
        </div>

        <div class="admin-users-pagination">
          <span>共 {{ formatNumber(total) }} 个兑换码</span>
          <n-pagination
            v-model:page="page"
            :page-size="pageSize"
            :item-count="total"
            :page-slot="5"
            @update:page="loadCodes"
          />
        </div>
      </section>
  </AdminPageShell>
</template>

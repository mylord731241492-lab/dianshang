<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NInput, useMessage } from 'naive-ui';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-vue-next';
import { adminLogin, migrateLegacyAdminSession, saveAdminAuthSession } from '../api/adminAuth';
import { getApiErrorMessage } from '../api/http';

const message = useMessage();
const route = useRoute();
const router = useRouter();
const loading = ref(false);
const errorMessage = ref('');

const form = reactive({
  username: '',
  password: ''
});

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, '管理员登录失败');
}

function resolveRedirectPath() {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/admin/') && redirect !== '/admin/login') {
    return redirect;
  }
  return '/admin/dashboard';
}

async function enterAdmin() {
  await router.replace(resolveRedirectPath());
}

onMounted(() => {
  const user = migrateLegacyAdminSession();
  if (user?.role === 'admin') {
    void enterAdmin();
  }
});

async function submit() {
  errorMessage.value = '';
  loading.value = true;
  try {
    const data = await adminLogin(form.username.trim(), form.password);
    saveAdminAuthSession(data);
    message.success('管理员登录成功');
    await enterAdmin();
  } catch (error) {
    errorMessage.value = friendlyError(error);
    message.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="admin-login-shell">
    <section class="admin-login-card">
      <RouterLink to="/" class="auth-back"><ArrowLeft :size="16" />返回首页</RouterLink>
      <div class="admin-login-mark">
        <ShieldCheck :size="28" />
      </div>
      <p class="eyebrow">Admin Console</p>
      <h1>后台登录</h1>
      <p class="admin-login-subtitle">
        登录后进入统一管理员后台，管理用户、订单、兑换码和系统设置。
      </p>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          管理员账号
          <n-input v-model:value="form.username" placeholder="请输入管理员账号" autocomplete="username" />
        </label>
        <label>
          管理员密码
          <n-input v-model:value="form.password" type="password" show-password-on="mousedown" placeholder="请输入管理员密码" autocomplete="current-password" />
        </label>

        <div v-if="errorMessage" class="auth-error">{{ errorMessage }}</div>

        <n-button type="primary" size="large" block attr-type="submit" :loading="loading">
          <template #icon>
            <KeyRound :size="16" />
          </template>
          进入后台
        </n-button>
      </form>
    </section>
  </main>
</template>

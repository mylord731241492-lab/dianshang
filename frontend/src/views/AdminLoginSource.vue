<script setup lang="ts">
import { reactive, ref } from 'vue';
import { NButton, NInput, useMessage } from 'naive-ui';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-vue-next';
import { adminLogin } from '../api/adminAuth';
import type { AuthUser } from '../api/auth';
import { saveAuthSession } from '../api/auth';
import { getApiErrorMessage } from '../api/http';
import { legacyUrl } from '../config/legacy';

const message = useMessage();
const loading = ref(false);
const errorMessage = ref('');
const loggedInUser = ref<AuthUser | null>(null);

const form = reactive({
  username: '',
  password: ''
});

function fillDefaultAdmin() {
  form.username = 'admin';
  form.password = 'admin123';
}

function friendlyError(error: unknown) {
  return getApiErrorMessage(error, '管理员登录失败');
}

async function submit() {
  errorMessage.value = '';
  loading.value = true;
  try {
    const data = await adminLogin(form.username.trim(), form.password);
    saveAuthSession(data);
    loggedInUser.value = data.user;
    message.success('管理员登录成功');
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
        后台入口已进入 Vue3 源码层；登录后继续打开稳定旧后台控制台。
      </p>

      <div v-if="loggedInUser" class="admin-login-success">
        <strong>管理员登录成功</strong>
        <span>{{ loggedInUser.username }} · {{ loggedInUser.role || 'admin' }}</span>
        <p>当前登录态已保存在 Vue3 源码前端，后续后台源码页会复用这套 session。</p>
      </div>

      <form v-else class="auth-form" @submit.prevent="submit">
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

      <div class="auth-links">
        <button v-if="!loggedInUser" type="button" @click="fillDefaultAdmin">填入默认账号</button>
        <a :href="legacyUrl('/admin/login')">旧版后台登录</a>
        <a :href="legacyUrl('/admin/dashboard')">旧版后台控制台</a>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NInput, useMessage } from 'naive-ui';
import { ArrowLeft, KeyRound, LogIn, UserPlus } from 'lucide-vue-next';
import { login, register, saveAuthSession } from '../api/auth';
import { getApiErrorMessage } from '../api/http';
import { legacyUrl } from '../config/legacy';

const props = defineProps<{
  mode: 'login' | 'register';
}>();

const router = useRouter();
const route = useRoute();
const message = useMessage();
const loading = ref(false);
const errorMessage = ref('');

const form = reactive({
  username: '',
  email: '',
  password: '',
  code: ''
});

const isLogin = computed(() => props.mode === 'login');
const title = computed(() => (isLogin.value ? '登录账号' : '注册账号'));
const subtitle = computed(() => (isLogin.value ? '登录后可查看图库、模板生成记录和用户资料。' : '注册后可使用兑换码领取算力，邮箱用于找回密码。'));
const targetAfterAuth = computed(() => {
  const redirect = route.query.redirect;
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/gallery';
});

function friendlyError(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback);
}

async function submit() {
  if (loading.value) return;
  errorMessage.value = '';
  const username = form.username.trim();
  const email = form.email.trim();
  if (!username || !form.password || (!isLogin.value && !email)) {
    errorMessage.value = isLogin.value
      ? '请填写用户名和密码。'
      : '请填写用户名、邮箱和密码；当前内网注册不需要邮箱验证码。';
    message.warning(errorMessage.value);
    return;
  }

  loading.value = true;
  try {
    const data = isLogin.value
      ? await login(username, form.password)
      : await register({
          username,
          email,
          password: form.password
        });
    saveAuthSession(data);
    message.success(isLogin.value ? '登录成功' : '注册成功');
    await router.replace(targetAfterAuth.value);
  } catch (error) {
    errorMessage.value = friendlyError(error, isLogin.value ? '登录失败' : '注册失败');
    message.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

</script>

<template>
  <main class="auth-source-shell">
    <section class="auth-card">
      <RouterLink to="/" class="auth-back"><ArrowLeft :size="16" />返回首页</RouterLink>
      <div class="auth-mark">
        <LogIn v-if="isLogin" :size="26" />
        <UserPlus v-else :size="26" />
      </div>
      <p class="eyebrow">Account</p>
      <h1>{{ title }}</h1>
      <p class="auth-subtitle">{{ subtitle }}</p>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          用户名
          <n-input v-model:value="form.username" placeholder="请输入用户名" autocomplete="username" />
        </label>
        <label v-if="!isLogin">
          邮箱（用于找回密码）
          <n-input v-model:value="form.email" placeholder="请输入邮箱，当前注册不需要验证码" autocomplete="email" />
        </label>
        <label>
          密码
          <n-input v-model:value="form.password" type="password" show-password-on="mousedown" placeholder="请输入密码" autocomplete="current-password" />
        </label>
        <div v-if="errorMessage" class="auth-error">{{ errorMessage }}</div>

        <n-button type="primary" size="large" block attr-type="submit" :loading="loading">
          <template #icon>
            <KeyRound :size="16" />
          </template>
          {{ isLogin ? '登录' : '注册' }}
        </n-button>
      </form>

      <div class="auth-links">
        <RouterLink :to="isLogin ? '/register' : '/login'">
          {{ isLogin ? '没有账号，去注册' : '已有账号，去登录' }}
        </RouterLink>
        <a :href="legacyUrl(isLogin ? '/login' : '/register')">旧版页面</a>
      </div>
    </section>
  </main>
</template>

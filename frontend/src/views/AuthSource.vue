<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NInput, useMessage } from 'naive-ui';
import { ArrowLeft, KeyRound, LogIn, UserPlus } from 'lucide-vue-next';
import { login, register, saveAuthSession, sendRegisterCode } from '../api/auth';
import { getApiErrorMessage } from '../api/http';
import { legacyUrl } from '../config/legacy';

const props = defineProps<{
  mode: 'login' | 'register';
}>();

const router = useRouter();
const route = useRoute();
const message = useMessage();
const loading = ref(false);
const sendingCode = ref(false);
const errorMessage = ref('');

const form = reactive({
  username: '',
  email: '',
  password: '',
  code: ''
});

const isLogin = computed(() => props.mode === 'login');
const title = computed(() => (isLogin.value ? '登录账号' : '注册账号'));
const subtitle = computed(() => (isLogin.value ? '登录后可查看图库、模板生成记录和用户资料。' : '注册会赠送 50 算力，验证码由本地后端打印。'));
const targetAfterAuth = computed(() => {
  const redirect = route.query.redirect;
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/gallery';
});

function fillDefaultAdmin() {
  form.username = 'admin';
  form.password = 'admin123';
}

function friendlyError(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback);
}

async function submit() {
  errorMessage.value = '';
  loading.value = true;
  try {
    const data = isLogin.value
      ? await login(form.username.trim(), form.password)
      : await register({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          code: form.code.trim()
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

async function sendCode() {
  if (!form.email.trim()) {
    message.warning('请先输入邮箱');
    return;
  }
  sendingCode.value = true;
  errorMessage.value = '';
  try {
    const data = await sendRegisterCode(form.email.trim());
    if (data.code) form.code = data.code;
    message.success(data.code ? `验证码已填入：${data.code}` : '验证码已发送');
  } catch (error) {
    errorMessage.value = friendlyError(error, '验证码发送失败');
    message.error(errorMessage.value);
  } finally {
    sendingCode.value = false;
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
          邮箱
          <n-input v-model:value="form.email" placeholder="请输入邮箱" autocomplete="email" />
        </label>
        <label>
          密码
          <n-input v-model:value="form.password" type="password" show-password-on="mousedown" placeholder="请输入密码" autocomplete="current-password" />
        </label>
        <label v-if="!isLogin">
          验证码
          <div class="code-row">
            <n-input v-model:value="form.code" placeholder="请输入验证码" />
            <n-button secondary :loading="sendingCode" @click="sendCode">发送验证码</n-button>
          </div>
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
        <button v-if="isLogin" type="button" @click="fillDefaultAdmin">填入默认账号</button>
        <RouterLink :to="isLogin ? '/register' : '/login'">
          {{ isLogin ? '没有账号，去注册' : '已有账号，去登录' }}
        </RouterLink>
        <a :href="legacyUrl(isLogin ? '/login' : '/register')">旧版页面</a>
      </div>
    </section>
  </main>
</template>

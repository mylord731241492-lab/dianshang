<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { NButton, NInput, NModal } from 'naive-ui';
import { KeyRound, LogIn } from 'lucide-vue-next';
import { login, register, saveAuthSession } from '../api/auth';
import { getApiErrorMessage } from '../api/http';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'success'): void }>();

const mode = ref<'login' | 'register'>('login');
const loading = ref(false);
const errorMessage = ref('');

const form = reactive({
  username: '',
  email: '',
  password: ''
});

const isLogin = computed(() => mode.value === 'login');
const title = computed(() => (isLogin.value ? '登录后继续' : '注册账号'));
const subtitle = computed(() =>
  isLogin.value ? '当前站点需要登录后才能使用，登录后可进入画布、图库与模板工作台。' : '注册后自动登录，邮箱用于找回密码。'
);

function friendlyError(error: unknown, fallback: string) {
  const response = (error as { response?: { status?: number; data?: { message?: string } } }).response;
  if (response?.status === 403 && response.data?.message) return response.data.message;
  return getApiErrorMessage(error, fallback, { unauthorized: '账号或密码不正确。' });
}

function switchMode(next: 'login' | 'register') {
  mode.value = next;
  errorMessage.value = '';
}

async function submit() {
  if (loading.value) return;
  errorMessage.value = '';
  const username = form.username.trim();
  const email = form.email.trim();
  if (!username || !form.password || (!isLogin.value && !email)) {
    errorMessage.value = isLogin.value ? '请输入用户名和密码。' : '请输入用户名、邮箱和密码。';
    return;
  }
  loading.value = true;
  try {
    const data = isLogin.value
      ? await login(username, form.password)
      : await register({ username, email, password: form.password });
    saveAuthSession(data);
    emit('success');
  } catch (error) {
    const message = friendlyError(error, isLogin.value ? '登录失败' : '注册失败');
    if (/后台|admin/i.test(message)) {
      errorMessage.value = `${message} 请使用 http://localhost:3456/admin 后台入口。`;
    } else {
      errorMessage.value = message;
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <n-modal
    :show="open"
    :mask-closable="false"
    :close-on-esc="false"
    :show-close="false"
    :trap-focus="false"
    :bordered="false"
    class="login-gate-modal"
  >
    <section class="auth-card login-gate-card">
      <div class="login-gate-mark">
        <LogIn :size="26" />
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
          <n-input
            v-model:value="form.password"
            type="password"
            show-password-on="mousedown"
            placeholder="请输入密码"
            autocomplete="current-password"
          />
        </label>
        <div v-if="errorMessage" class="auth-error">{{ errorMessage }}</div>

        <n-button type="primary" size="large" block attr-type="submit" :loading="loading">
          <template #icon>
            <KeyRound :size="16" />
          </template>
          {{ isLogin ? '登录' : '注册并登录' }}
        </n-button>
      </form>

      <div class="auth-links login-gate-links">
        <button type="button" class="link-button" @click="switchMode(isLogin ? 'register' : 'login')">
          {{ isLogin ? '没有账号，去注册' : '已有账号，去登录' }}
        </button>
        <a class="legacy-link" href="/admin/login" @click.prevent>
          管理员入口
        </a>
      </div>
    </section>
  </n-modal>
</template>

<style scoped>
.login-gate-card {
  width: min(430px, calc(100vw - 32px));
  margin: 0 auto;
}

.login-gate-mark {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  margin-top: 18px;
  border-radius: 8px;
  background: #31d79b;
  color: #052014;
}

.login-gate-links {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
}

.link-button {
  background: none;
  border: none;
  padding: 0;
  color: #31d79b;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.legacy-link {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}
</style>

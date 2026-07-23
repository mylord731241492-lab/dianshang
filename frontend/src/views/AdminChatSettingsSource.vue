<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NAlert, NButton, NInput, NPopconfirm, NSelect, NSwitch, NTag, useMessage } from 'naive-ui';
import {
  Bot,
  Cable,
  CheckCircle2,
  CircleOff,
  ExternalLink,
  Image,
  KeyRound,
  MessageSquare,
  Plus,
  RefreshCcw,
  Save,
  ScrollText,
  ShieldCheck,
  TestTube2,
  Trash2
} from 'lucide-vue-next';
import AdminFeedback from '../components/admin/AdminFeedback.vue';
import AdminPageHeader from '../components/admin/AdminPageHeader.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import AdminStatGrid from '../components/admin/AdminStatGrid.vue';
import { clearAdminAuthSession } from '../api/adminAuth';
import {
  getAdminChatSettings,
  testAdminChatConnection,
  testAdminChatProvider,
  updateAdminChatSettings,
  type AdminChatSettings,
  type AdminManagedChatAgent,
  type AdminChatProviderTestResult,
  type AdminChatSettingsResponse,
  type AdminChatTestResponse
} from '../api/adminChatSettings';
import { getApiErrorMessage } from '../api/http';

const router = useRouter();
const message = useMessage();
const loading = ref(true);
const saving = ref(false);
const testing = ref(false);
const providerTesting = ref(false);
const errorMessage = ref('');
const data = ref<AdminChatSettingsResponse | null>(null);
const testResult = ref<AdminChatTestResponse | null>(null);
const providerTestResult = ref<AdminChatProviderTestResult | null>(null);
const providerTestModel = ref('');
const providerTestPrompt = ref('请只回复 OK');
const draft = ref<AdminChatSettings>({
  accessEnabled: true,
  textChatEnabled: true,
  imageToolsEnabled: true,
  allowedModels: [],
  maintenanceMessage: 'AI 对话服务正在维护，请稍后再试。',
  managedAgents: []
});

function cloneSettings(settings: AdminChatSettings): AdminChatSettings {
  return {
    ...settings,
    allowedModels: [...settings.allowedModels],
    managedAgents: settings.managedAgents.map((agent) => ({ ...agent }))
  };
}

function createManagedAgent(): AdminManagedChatAgent {
  return {
    id: `managed-agent-${Date.now()}`,
    name: '新智能体',
    description: '',
    instructions: '请填写这个智能体的角色、工作步骤和输出要求。',
    model: draft.value.allowedModels[0] || data.value?.models[0]?.id || '',
    enabled: true,
    skillsEnabled: true,
    imageToolsEnabled: true
  };
}

function addManagedAgent() {
  if (draft.value.managedAgents.length >= 12) {
    message.warning('最多配置 12 个首页智能体');
    return;
  }
  draft.value.managedAgents.push(createManagedAgent());
}

function removeManagedAgent(index: number) {
  draft.value.managedAgents.splice(index, 1);
}

const modelOptions = computed(() =>
  (data.value?.models || []).map((model) => ({
    label: `${model.name} · ${model.price} 算力`,
    value: model.id
  }))
);

const draftChanged = computed(() => {
  if (!data.value) return false;
  return JSON.stringify(draft.value) !== JSON.stringify(data.value.settings);
});

const saveDisabled = computed(() =>
  loading.value ||
  saving.value ||
  !draftChanged.value ||
  draft.value.allowedModels.length === 0 ||
  !draft.value.maintenanceMessage.trim() ||
  draft.value.managedAgents.some((agent) => !agent.name.trim() || !agent.instructions.trim() || !agent.model)
);

const providerTestDisabled = computed(() =>
  providerTesting.value || !data.value?.deployment.realAiEnabled || !providerTestModel.value || !providerTestPrompt.value.trim()
);

const statCards = computed(() => [
  {
    label: 'Chat 部署',
    value: data.value?.deployment.enabled ? '已启用' : '未启用',
    icon: data.value?.deployment.enabled ? CheckCircle2 : CircleOff
  },
  {
    label: '运行模式',
    value: data.value?.deployment.realAiEnabled ? '真实 Provider' : 'Mock 测试',
    icon: TestTube2
  },
  {
    label: '文本计费记录',
    value: data.value?.usage.textCharges || 0,
    icon: MessageSquare
  },
  {
    label: '生图报价记录',
    value: data.value?.usage.imageQuotes || 0,
    icon: Image
  }
]);

const boundaryRows = computed(() => {
  const deployment = data.value?.deployment;
  return [
    { label: '内部服务密钥', value: deployment?.bridgeSecretConfigured ? '已配置' : '未配置', ok: deployment?.bridgeSecretConfigured },
    { label: 'Provider 地址', value: deployment?.providerBaseConfigured ? '已配置' : '未配置', ok: deployment?.providerBaseConfigured },
    { label: 'Provider Key', value: deployment?.providerKeyConfigured ? '已配置' : '未配置', ok: deployment?.providerKeyConfigured },
    { label: 'SSO 票据有效期', value: `${deployment?.ssoTtlSeconds || 0} 秒`, ok: true },
    { label: '用户私有 Skills', value: deployment?.skills.privateCreate ? '允许创建' : '已关闭', ok: deployment?.skills.privateCreate },
    { label: '用户公开分享', value: deployment?.skills.publicSharing ? '已开放' : '默认关闭', ok: !deployment?.skills.publicSharing },
    { label: '外部 MCP 安装', value: deployment?.mcp.externalInstall ? '已开放' : '默认关闭', ok: !deployment?.mcp.externalInstall },
    { label: '当前 Provider', value: deployment?.providerMode === 'real-provider-ready' ? '真实线路就绪' : '本地 Mock', ok: true }
  ];
});

function syncData(next: AdminChatSettingsResponse) {
  data.value = next;
  draft.value = cloneSettings(next.settings);
  if (!providerTestModel.value || !next.settings.allowedModels.includes(providerTestModel.value)) {
    providerTestModel.value = next.settings.allowedModels.includes(next.deployment.providerModel)
      ? next.deployment.providerModel
      : next.settings.allowedModels[0] || '';
  }
}

function friendlyError(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback, {
    unauthorized: '管理员登录状态已失效，请重新登录。',
    forbidden: '当前账号没有 Chat 设置权限。'
  });
}

async function loadSettings() {
  loading.value = true;
  errorMessage.value = '';
  try {
    syncData(await getAdminChatSettings());
  } catch (error) {
    errorMessage.value = friendlyError(error, 'Chat 设置加载失败');
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  if (saveDisabled.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    syncData(await updateAdminChatSettings(cloneSettings(draft.value)));
    message.success('Chat 设置已保存并即时生效');
  } catch (error) {
    errorMessage.value = friendlyError(error, 'Chat 设置保存失败');
  } finally {
    saving.value = false;
  }
}

async function runConnectionTest() {
  testing.value = true;
  errorMessage.value = '';
  try {
    const result = await testAdminChatConnection();
    testResult.value = result;
    syncData(result);
    if (result.healthy) message.success('Chat 连接测试全部通过');
    else message.warning('Chat 连接测试存在未通过项');
  } catch (error) {
    errorMessage.value = friendlyError(error, 'Chat 连接测试失败');
  } finally {
    testing.value = false;
  }
}

async function runProviderTest() {
  if (providerTestDisabled.value) return;
  providerTesting.value = true;
  errorMessage.value = '';
  providerTestResult.value = null;
  try {
    const response = await testAdminChatProvider({
      model: providerTestModel.value,
      prompt: providerTestPrompt.value.trim()
    });
    providerTestResult.value = response.result;
    message.success('真实 API 中转测试成功');
  } catch (error) {
    errorMessage.value = friendlyError(error, '真实 API 中转测试失败');
    message.error(errorMessage.value);
  } finally {
    providerTesting.value = false;
  }
}

async function logout() {
  clearAdminAuthSession();
  await router.replace('/admin/login?redirect=/admin/chat-settings');
}

onMounted(loadSettings);
</script>

<template>
  <AdminPageShell>
    <AdminPageHeader eyebrow="Chat Operations" title="Chat 设置" description="管理主站与 LibreChat 的运行时开关、模型范围和无费用连接测试。">
      <template #actions>
        <n-button type="primary" :loading="saving" :disabled="saveDisabled" @click="saveSettings">
          <template #icon><Save :size="16" /></template>
          保存设置
        </n-button>
        <n-button secondary :loading="testing" @click="runConnectionTest">
          <template #icon><TestTube2 :size="16" /></template>
          运行连接测试
        </n-button>
        <n-button tag="a" href="/chat/" target="_blank" secondary>
          <template #icon><ExternalLink :size="16" /></template>
          打开 Chat
        </n-button>
        <n-button tertiary :loading="loading" @click="loadSettings">
          <template #icon><RefreshCcw :size="16" /></template>
          刷新
        </n-button>
        <n-button tertiary type="error" @click="logout">退出</n-button>
      </template>
    </AdminPageHeader>

    <AdminFeedback :error-message="errorMessage" />

    <n-alert v-if="data && !data.deployment.enabled" type="error" :bordered="false" class="admin-chat-alert">
      Docker 尚未启用 LibreChat。网页设置可以保存，但必须先配置 `ENABLE_LIBRECHAT=true` 并启动聊天容器。
    </n-alert>
    <n-alert v-else type="info" :bordered="false" class="admin-chat-alert">
      当前环境为 {{ data?.deployment.realAiEnabled ? '真实 Provider 模式' : 'Mock 测试模式' }}。连接测试不会调用模型，也不会扣除算力。
    </n-alert>

    <AdminStatGrid :stats="statCards" label="Chat 运行统计" />

    <section class="admin-source-panel admin-chat-runtime-panel">
      <div class="admin-panel-head">
        <div>
          <p class="eyebrow">Runtime Policy</p>
          <h2>即时生效设置</h2>
        </div>
        <n-tag :type="draftChanged ? 'warning' : 'success'" :bordered="false">
          {{ draftChanged ? '有未保存修改' : '已同步' }}
        </n-tag>
      </div>

      <div class="admin-chat-switches">
        <label>
          <span><Bot :size="17" />开放 Chat 访问</span>
          <n-switch v-model:value="draft.accessEnabled" />
          <small>关闭后停止签发 SSO 票据，并让内部桥接返回维护状态。</small>
        </label>
        <label>
          <span><MessageSquare :size="17" />文本对话</span>
          <n-switch v-model:value="draft.textChatEnabled" />
          <small>控制模型列表和 Chat Completions，不影响主站旧聊天接口。</small>
        </label>
        <label>
          <span><Image :size="17" />MCP 生图工具</span>
          <n-switch v-model:value="draft.imageToolsEnabled" />
          <small>控制报价与确认生图工具；现有模板和画布生图保持不变。</small>
        </label>
      </div>

      <div class="admin-chat-fields">
        <label>
          <span>Chat 可用文本模型</span>
          <n-select
            v-model:value="draft.allowedModels"
            multiple
            :options="modelOptions"
            placeholder="至少选择一个模型"
          />
        </label>
        <label>
          <span>维护提示</span>
          <n-input v-model:value="draft.maintenanceMessage" maxlength="240" show-count placeholder="Chat 维护时展示给用户" />
        </label>
      </div>
    </section>

    <section class="admin-source-panel admin-chat-agents-panel">
      <div class="admin-panel-head">
        <div>
          <p class="eyebrow">Managed Agents</p>
          <h2>首页智能体</h2>
        </div>
        <n-button secondary :disabled="draft.managedAgents.length >= 12" @click="addManagedAgent">
          <template #icon><Plus :size="16" /></template>
          添加智能体
        </n-button>
      </div>

      <n-alert type="info" :bordered="false">
        这里是 Chat 首页智能体的唯一配置入口。普通用户只能选择使用，不能修改角色指令；Skills 仍使用 LibreChat 的个人与公共技能库。
      </n-alert>

      <div v-if="draft.managedAgents.length" class="admin-chat-agent-list">
        <div v-for="(agent, index) in draft.managedAgents" :key="agent.id" class="admin-chat-agent-row">
          <div class="admin-chat-agent-heading">
            <span><Bot :size="18" />智能体 {{ index + 1 }}</span>
            <div>
              <n-tag :type="agent.enabled ? 'success' : 'default'" size="small" :bordered="false">
                {{ agent.enabled ? '首页显示' : '已隐藏' }}
              </n-tag>
              <n-switch v-model:value="agent.enabled" aria-label="切换首页显示" />
              <n-popconfirm positive-text="删除" negative-text="取消" @positive-click="removeManagedAgent(index)">
                <template #trigger>
                  <n-button quaternary type="error" circle aria-label="删除智能体">
                    <template #icon><Trash2 :size="16" /></template>
                  </n-button>
                </template>
                确认删除“{{ agent.name }}”？保存设置后生效。
              </n-popconfirm>
            </div>
          </div>

          <div class="admin-chat-agent-fields">
            <label>
              <span>名称</span>
              <n-input v-model:value="agent.name" maxlength="48" show-count placeholder="例如：电商主图设计师" />
            </label>
            <label>
              <span>模型</span>
              <n-select v-model:value="agent.model" :options="modelOptions" placeholder="选择模型" />
            </label>
            <label class="admin-chat-agent-description">
              <span>首页简介</span>
              <n-input v-model:value="agent.description" maxlength="180" show-count placeholder="说明这个智能体能完成什么" />
            </label>
            <label class="admin-chat-agent-instructions">
              <span>系统指令</span>
              <n-input
                v-model:value="agent.instructions"
                type="textarea"
                :autosize="{ minRows: 3, maxRows: 8 }"
                maxlength="6000"
                show-count
                placeholder="填写角色、工作步骤、边界与输出要求"
              />
            </label>
          </div>

          <div class="admin-chat-agent-capabilities">
            <label>
              <span><ScrollText :size="16" />允许使用 Skills</span>
              <n-switch v-model:value="agent.skillsEnabled" />
            </label>
            <label>
              <span><Image :size="16" />允许调用网站生图</span>
              <n-switch v-model:value="agent.imageToolsEnabled" :disabled="!draft.imageToolsEnabled" />
            </label>
          </div>
        </div>
      </div>
      <div v-else class="admin-chat-agent-empty">
        <Bot :size="28" />
        <strong>首页暂时没有智能体</strong>
        <span>点击“添加智能体”创建，保存后 Chat 首页会立即读取。</span>
      </div>
    </section>

    <section class="admin-source-panel admin-chat-provider-panel">
      <div class="admin-panel-head">
        <div>
          <p class="eyebrow">Real Provider Probe</p>
          <h2>实际 API 中转测试</h2>
        </div>
        <n-tag :type="data?.deployment.realAiEnabled ? 'success' : 'warning'" :bordered="false">
          {{ data?.deployment.realAiEnabled ? '真实线路已就绪' : '当前为 Mock' }}
        </n-tag>
      </div>

      <n-alert type="warning" :bordered="false">
        此测试会请求真实中转站。Provider 可能附加较长系统上下文，实际 Token 可能达到数千，但不会扣除主站用户算力。
      </n-alert>

      <div class="admin-chat-provider-form">
        <label>
          <span>测试模型</span>
          <n-select v-model:value="providerTestModel" :options="modelOptions" placeholder="选择测试模型" />
        </label>
        <label>
          <span>测试提示词</span>
          <n-input v-model:value="providerTestPrompt" maxlength="500" placeholder="请只回复 OK" />
        </label>
        <n-popconfirm
          positive-text="确认并调用"
          negative-text="取消"
          @positive-click="runProviderTest"
        >
          <template #trigger>
            <n-button type="primary" :loading="providerTesting" :disabled="providerTestDisabled">
              <template #icon><Cable :size="16" /></template>
              发起真实中转测试
            </n-button>
          </template>
          确认发送真实请求？输出最多 16 tokens，但上游附加上下文可能让总 Token 达到数千。
        </n-popconfirm>
      </div>

      <div v-if="providerTestResult" class="admin-chat-provider-result">
        <div>
          <span>响应</span>
          <strong>{{ providerTestResult.content }}</strong>
        </div>
        <dl>
          <div><dt>模型</dt><dd>{{ providerTestResult.model }}</dd></div>
          <div><dt>协议</dt><dd>{{ providerTestResult.protocol }}</dd></div>
          <div><dt>耗时</dt><dd>{{ providerTestResult.latencyMs }}ms</dd></div>
          <div><dt>总 Tokens</dt><dd>{{ providerTestResult.usage.totalTokens }}</dd></div>
          <div><dt>完成原因</dt><dd>{{ providerTestResult.finishReason || '未知' }}</dd></div>
        </dl>
      </div>
    </section>

    <div class="admin-chat-grid">
      <section class="admin-source-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Security Boundary</p>
            <h2>安全与功能边界</h2>
          </div>
          <ShieldCheck :size="20" />
        </div>
        <div class="admin-chat-boundary-list">
          <div v-for="item in boundaryRows" :key="item.label">
            <span>{{ item.label }}</span>
            <n-tag :type="item.ok ? 'success' : 'warning'" size="small" :bordered="false">{{ item.value }}</n-tag>
          </div>
        </div>
        <p class="admin-chat-boundary-note">
          Provider Key、MongoDB 地址和内部服务密钥只由 Docker 管理，本页不会读取或返回明文。
        </p>
      </section>

      <section class="admin-source-panel">
        <div class="admin-panel-head">
          <div>
            <p class="eyebrow">Connection Test</p>
            <h2>连接测试结果</h2>
          </div>
          <KeyRound :size="20" />
        </div>
        <div v-if="testResult" class="admin-chat-check-list">
          <div v-for="check in testResult.checks" :key="check.key" :class="{ failed: !check.ok }">
            <component :is="check.ok ? CheckCircle2 : CircleOff" :size="18" />
            <span>
              <strong>{{ check.label }}</strong>
              <small>{{ check.message }}<template v-if="check.latencyMs !== undefined"> · {{ check.latencyMs }}ms</template></small>
            </span>
          </div>
          <p>检查时间：{{ new Date(testResult.checkedAt).toLocaleString('zh-CN', { hour12: false }) }}</p>
        </div>
        <div v-else class="admin-chat-test-empty">
          <TestTube2 :size="28" />
          <strong>尚未运行连接测试</strong>
          <span>点击顶部“运行连接测试”，不会产生模型费用。</span>
        </div>
      </section>
    </div>
  </AdminPageShell>
</template>

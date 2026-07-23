const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const patchDir = __dirname;
if (!root) throw new Error('Usage: node apply-patches.js <librechat-root>');

function replaceOnce(file, before, after) {
  const target = path.join(root, file);
  const source = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
  const normalizedBefore = before.replace(/\r\n/g, '\n');
  const normalizedAfter = after.replace(/\r\n/g, '\n');
  if (!source.includes(normalizedBefore)) throw new Error(`Patch anchor not found: ${file}`);
  const updated = source.replace(normalizedBefore, normalizedAfter);
  if (updated === source) throw new Error(`Patch made no change: ${file}`);
  fs.writeFileSync(target, updated, 'utf8');
}

function mergeJson(file, values) {
  const target = path.join(root, file);
  const source = JSON.parse(fs.readFileSync(target, 'utf8'));
  Object.assign(source, values);
  fs.writeFileSync(target, `${JSON.stringify(source, null, 2)}\n`, 'utf8');
}

fs.copyFileSync(
  path.join(patchDir, 'HjmSsoController.js'),
  path.join(root, 'api/server/controllers/auth/HjmSsoController.js'),
);
fs.copyFileSync(
  path.join(patchDir, 'HjmHomeCatalog.tsx'),
  path.join(root, 'client/src/components/Chat/HjmHomeCatalog.tsx'),
);
fs.copyFileSync(
  path.join(patchDir, 'HjmImageRouteSelect.tsx'),
  path.join(root, 'client/src/components/Chat/Input/HjmImageRouteSelect.tsx'),
);

replaceOnce(
  'api/server/routes/auth.js',
  "const { loginController } = require('~/server/controllers/auth/LoginController');",
  "const { loginController } = require('~/server/controllers/auth/LoginController');\nconst { hjmSsoController } = require('~/server/controllers/auth/HjmSsoController');",
);

replaceOnce(
  'api/server/routes/auth.js',
  '//Local\nrouter.post(\'/logout\'',
  "// Main-site passwordless SSO. The one-time ticket is verified server-to-server.\nrouter.post('/hjm-sso', middleware.loginLimiter, hjmSsoController);\n\n//Local\nrouter.post('/logout'",
);

const oldRefreshError = `        console.log('refreshToken mutation error:', error);
        if (authConfig?.test === true) {
          return;
        }
        navigate(buildLoginRedirectUrl());`;

const newRefreshError = `        console.log('refreshToken mutation error:', error);
        if (authConfig?.test === true) {
          return;
        }
        const mainAuthToken =
          window.localStorage.getItem('auth_token') ??
          window.localStorage.getItem('admin_auth_token');
        const ssoAttemptKey = 'hjm-librechat-sso-attempt';
        if (mainAuthToken && window.sessionStorage.getItem(ssoAttemptKey) !== '1') {
          window.sessionStorage.setItem(ssoAttemptKey, '1');
          void (async () => {
            try {
              const ticketResponse = await fetch('/api/integrations/librechat/sso-ticket', {
                method: 'POST',
                headers: { Authorization: \`Bearer \${mainAuthToken}\` },
              });
              const ticketData = await ticketResponse.json();
              if (!ticketResponse.ok || !ticketData.ticket) {
                throw new Error(ticketData.message || '主站登录状态无效');
              }
              const ssoResponse = await fetch(\`\${apiBaseUrl()}/api/auth/hjm-sso\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket: ticketData.ticket }),
              });
              const ssoData = await ssoResponse.json();
              if (!ssoResponse.ok || !ssoData.token || !ssoData.user) {
                throw new Error(ssoData.message || 'AI 对话免登录失败');
              }
              window.sessionStorage.removeItem(ssoAttemptKey);
              setUserContext({
                token: ssoData.token,
                isAuthenticated: true,
                user: ssoData.user,
                redirect: '/c/new',
              });
            } catch (ssoError) {
              window.sessionStorage.removeItem(ssoAttemptKey);
              console.error('Main-site SSO failed:', ssoError);
              window.location.replace('/login?redirect=/chat/');
            }
          })();
          return;
        }
        window.location.replace('/login?redirect=/chat/');`;

replaceOnce('client/src/hooks/AuthContext.tsx', oldRefreshError, newRefreshError);

replaceOnce(
  'client/src/hooks/AuthContext.tsx',
  `    if (isExternalRedirectRef.current) {
      return;
    }
    refreshToken.mutate(undefined, {`,
  `    if (isExternalRedirectRef.current) {
      return;
    }
    const mainAuthToken =
      window.localStorage.getItem('auth_token') ??
      window.localStorage.getItem('admin_auth_token');
    const ssoAttemptKey = 'hjm-librechat-sso-attempt';
    if (!mainAuthToken) {
      void fetch(\`\${apiBaseUrl()}/api/auth/logout\`, {
        method: 'POST',
        credentials: 'include',
      }).finally(() => window.location.replace('/login?redirect=/chat/'));
      return;
    }
    if (window.sessionStorage.getItem(ssoAttemptKey) !== '1') {
      window.sessionStorage.setItem(ssoAttemptKey, '1');
      void (async () => {
        try {
          const ticketResponse = await fetch('/api/integrations/librechat/sso-ticket', {
            method: 'POST',
            headers: { Authorization: \`Bearer \${mainAuthToken}\` },
          });
          const ticketData = await ticketResponse.json();
          if (!ticketResponse.ok || !ticketData.ticket) {
            throw new Error(ticketData.message || '主站登录状态无效');
          }
          const ssoResponse = await fetch(\`\${apiBaseUrl()}/api/auth/hjm-sso\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ticket: ticketData.ticket }),
          });
          const ssoData = await ssoResponse.json();
          if (!ssoResponse.ok || !ssoData.token || !ssoData.user) {
            throw new Error(ssoData.message || 'AI 对话免登录失败');
          }
          window.sessionStorage.removeItem(ssoAttemptKey);
          setUserContext({
            token: ssoData.token,
            isAuthenticated: true,
            user: ssoData.user,
            redirect: '/c/new',
          });
        } catch (ssoError) {
          window.sessionStorage.removeItem(ssoAttemptKey);
          console.error('Main-site SSO failed:', ssoError);
          window.location.replace('/login?redirect=/chat/');
        }
      })();
      return;
    }
    refreshToken.mutate(undefined, {`,
);

replaceOnce(
  'client/src/hooks/AuthContext.tsx',
  `    window.addEventListener('tokenUpdated', handleTokenUpdate as EventListener);

    return () => {
      window.removeEventListener('tokenUpdated', handleTokenUpdate as EventListener);
    };`,
  `    const handleMainAuthStorage = (event: StorageEvent) => {
      if (
        (event.key === 'auth_token' || event.key === 'admin_auth_token') &&
        !window.localStorage.getItem('auth_token') &&
        !window.localStorage.getItem('admin_auth_token')
      ) {
        void fetch(\`\${apiBaseUrl()}/api/auth/logout\`, {
          method: 'POST',
          credentials: 'include',
        }).finally(() => window.location.replace('/login?redirect=/chat/'));
      }
    };

    window.addEventListener('tokenUpdated', handleTokenUpdate as EventListener);
    window.addEventListener('storage', handleMainAuthStorage);

    return () => {
      window.removeEventListener('tokenUpdated', handleTokenUpdate as EventListener);
      window.removeEventListener('storage', handleMainAuthStorage);
    };`,
);

replaceOnce(
  'client/src/App.jsx',
  '                  <RouterProvider router={router} />\n                  <WakeLockManager />',
  `                  <RouterProvider router={router} />
                  <a
                    href="/"
                    className="fixed right-3 top-3 z-[70] rounded-md border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary shadow-sm transition-colors hover:bg-surface-secondary dark:border-border-dark"
                    aria-label="返回网站首页"
                  >
                    返回首页
  </a>
                  <WakeLockManager />`,
);

replaceOnce(
  'client/src/components/Chat/ChatView.tsx',
  "import Landing from './Landing';",
  "import Landing from './Landing';\nimport HjmHomeCatalog from './HjmHomeCatalog';",
);

replaceOnce(
  'client/src/components/Chat/ChatView.tsx',
  '                    {isLandingPage ? <ConversationStarters /> : <Footer />}',
  `                    {isLandingPage ? (
                      <>
                        <ConversationStarters />
                        <HjmHomeCatalog />
                      </>
                    ) : (
                      <Footer />
                    )}`,
);

replaceOnce(
  'client/src/components/UnifiedSidebar/Sidebar.tsx',
  'aria-label="Resize sidebar"',
  'aria-label="调整侧边栏宽度"',
);

replaceOnce(
  'client/src/components/Chat/Input/ToolsDropdown.tsx',
  'aria-label="Tools Options"',
  'aria-label="工具选项"',
);

replaceOnce(
  'client/src/components/Chat/Input/Files/AttachFileMenu.tsx',
  'aria-label="Attach File Options"',
  'aria-label="附件选项"',
);

replaceOnce(
  'client/src/components/Chat/Input/ChatForm.tsx',
  "import BadgeRow from './BadgeRow';",
  "import BadgeRow from './BadgeRow';\nimport HjmImageRouteSelect from './HjmImageRouteSelect';",
);

replaceOnce(
  'client/src/components/Chat/Input/ChatForm.tsx',
  `                  setFilesLoading={setFilesLoading}
                />
              </div>
              <BadgeRow`,
  `                  setFilesLoading={setFilesLoading}
                />
              </div>
              <HjmImageRouteSelect />
              <BadgeRow`,
);

replaceOnce(
  'api/server/services/Endpoints/agents/build.js',
  `const buildOptions = (req, endpoint, parsedBody, endpointType) => {
  const { spec, iconURL, agent_id, ...model_parameters } = parsedBody;`,
  `const BUILT_IN_MCP_SERVERS = ['hajimi-website'];

const buildOptions = (req, endpoint, parsedBody, endpointType) => {
  const currentEphemeralAgent = req.body?.ephemeralAgent ?? {};
  const builtInMcpServers = currentEphemeralAgent.hjm_image_tools === false
    ? []
    : BUILT_IN_MCP_SERVERS;
  const selectedMcpServers = Array.isArray(currentEphemeralAgent.mcp)
    ? currentEphemeralAgent.mcp
    : [];
  req.body.ephemeralAgent = {
    ...currentEphemeralAgent,
    mcp: Array.from(new Set([...selectedMcpServers, ...builtInMcpServers])),
  };
  const { spec, iconURL, agent_id, ...model_parameters } = parsedBody;`,
);

replaceOnce(
  'packages/data-provider/src/types.ts',
  `export type TEphemeralAgent = {
  mcp?: string[];`,
  `export type TEphemeralAgent = {
  mcp?: string[];
  hjm_image_tools?: boolean;
  hjm_managed_agent_id?: string;`,
);

replaceOnce(
  'packages/api/src/utils/env.ts',
  "const ALLOWED_BODY_FIELDS = ['conversationId', 'parentMessageId', 'messageId'] as const;",
  "const ALLOWED_BODY_FIELDS = ['conversationId', 'parentMessageId', 'messageId', 'referenceImages', 'hjmManagedAgentId'] as const;",
);

replaceOnce(
  'packages/api/src/types/http.ts',
  `  parentMessageId?: string;
  endpoint?: string;`,
  `  parentMessageId?: string;
  referenceImages?: string;
  hjmManagedAgentId?: string;
  endpoint?: string;`,
);

replaceOnce(
  'api/server/controllers/agents/client.js',
  `          requestBody: {
            messageId: this.responseMessageId,
            conversationId: this.conversationId,
            parentMessageId: this.parentMessageId,
          },`,
  `          requestBody: {
            messageId: this.responseMessageId,
            conversationId: this.conversationId,
            parentMessageId: this.parentMessageId,
            hjmManagedAgentId: String(
              this.options.req.body?.ephemeralAgent?.hjm_managed_agent_id || '',
            ),
            referenceImages: 'b64url:' + Buffer.from(
              JSON.stringify(
                (Array.isArray(this.options.attachments) ? this.options.attachments : [])
                  .map((file) => file?.filepath)
                  .filter((value) => typeof value === 'string' && value.startsWith('/images/'))
                  .slice(0, 5),
              ),
              'utf8',
            ).toString('base64url'),
  },`,
);

replaceOnce(
  'client/src/components/Chat/Messages/Content/ToolCall.tsx',
  "import { ToolIcon, getToolIconType, isError } from './ToolOutput';",
  `import { ToolIcon, OutputRenderer, getToolIconType, isError } from './ToolOutput';
import Markdown from './Markdown';`,
);

replaceOnce(
  'client/src/components/Chat/Messages/Content/ToolCall.tsx',
  "import { useLocalize, useProgress, useExpandCollapse } from '~/hooks';",
  "import { useLocalize, useProgress, useExpandCollapse, useSubmitMessage } from '~/hooks';",
);

replaceOnce(
  'client/src/components/Chat/Messages/Content/ToolCall.tsx',
  `  }, [name, parsedAuthUrl]);

  const toolIconType = useMemo(() => getToolIconType(name), [name]);`,
  `  }, [name, parsedAuthUrl]);

  const { submitMessage } = useSubmitMessage();
  const [isConfirmingImage, setIsConfirmingImage] = useState(false);
  const [imageRevision, setImageRevision] = useState('');
  const [imageIterationComplete, setImageIterationComplete] = useState(false);
  const imagePlanForm = useMemo(() => {
    if (function_name !== 'prepare_ecommerce_image_plan' || typeof output !== 'string') {
      return null;
    }
    const marker = output.match(/\\[HJM_IMAGE_PLAN_FORM:([A-Za-z0-9_-]+)\\]/);
    if (!marker?.[1]) {
      return null;
    }
    try {
      const base64 = marker[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const binary = window.atob(padded);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const decoded = typeof TextDecoder === 'undefined'
        ? decodeURIComponent(
            Array.from(bytes, (byte) => '%' + byte.toString(16).padStart(2, '0')).join(''),
          )
        : new TextDecoder().decode(bytes);
      const parsed = JSON.parse(decoded) as {
        version?: number;
        confirmationCode: string;
        designPrompt?: string;
        referenceRoles?: Array<{ imageIndex: number; roleDescription: string }>;
        copyItems?: Array<{ id: string; label: string; text: string; source: string }>;
        fields?: Array<{ key: string; label: string; value: string }>;
        adjustment?: string;
        revisionNotes?: string;
      };
      return {
        confirmationCode: parsed.confirmationCode,
        designPrompt: parsed.designPrompt || '',
        referenceRoles: parsed.referenceRoles || [],
        copyItems: parsed.copyItems || (parsed.fields || []).map((field) => ({
          id: field.key,
          label: field.label,
          text: field.value,
          source: 'GPT 拟定',
        })),
        adjustment: parsed.adjustment || parsed.revisionNotes || '',
      };
    } catch {
      return null;
    }
  }, [function_name, output]);
  const [imagePlanDraft, setImagePlanDraft] = useState<{
    designPrompt: string;
    copyItems: Array<{ id: string; label: string; text: string; source: string }>;
    adjustment: string;
  } | null>(null);
  useEffect(() => {
    if (!imagePlanForm) {
      setImagePlanDraft(null);
      return;
    }
    setImagePlanDraft({
      designPrompt: imagePlanForm.designPrompt,
      copyItems: imagePlanForm.copyItems.map((item) => ({ ...item })),
      adjustment: imagePlanForm.adjustment,
    });
  }, [imagePlanForm]);
  const visibleImageOutput = useMemo(
    () =>
      typeof output === 'string'
        ? output.replace(/\\n?\\[HJM_IMAGE_PLAN_FORM:[A-Za-z0-9_-]+\\]\\s*$/, '').trim()
        : (output ?? ''),
    [output],
  );
  const imageConfirmationMessage = useMemo(() => {
    if (
      (function_name !== 'prepare_image_generation' &&
        function_name !== 'confirm_ecommerce_image_plan') ||
      typeof output !== 'string'
    ) {
      return '';
    }
    const match = output.match(/确认生图\\s+([A-Z0-9]{6})/i);
    return match?.[1] ? \`确认生图 \${match[1].toUpperCase()}\` : '';
  }, [function_name, output]);
  const handleImageConfirmation = useCallback(() => {
    if (!imageConfirmationMessage || isSubmitting || isConfirmingImage) {
      return;
    }
    setIsConfirmingImage(true);
    submitMessage({ text: imageConfirmationMessage });
    window.setTimeout(() => setIsConfirmingImage(false), 1500);
  }, [imageConfirmationMessage, isSubmitting, isConfirmingImage, submitMessage]);
  const handleImagePlanConfirmation = useCallback(() => {
    if (!imagePlanForm?.confirmationCode || isSubmitting || isConfirmingImage) {
      return;
    }
    setIsConfirmingImage(true);
    const copyLines = (imagePlanDraft?.copyItems ?? []).map(
      (item) => \`- [\${item.id}] \${item.label.trim() || '上图文案'}：\${item.text.trim() || '（留空）'}（来源：\${item.source}）\`,
    );
    const adjustment = imagePlanDraft?.adjustment.trim() || '';
    submitMessage({
      text: [
        \`确认方案 \${imagePlanForm.confirmationCode.toUpperCase()}\`,
        '完整设计方案：',
        imagePlanDraft?.designPrompt.trim() || imagePlanForm.designPrompt,
        '动态文案：',
        ...(copyLines.length > 0 ? copyLines : ['- （不添加上图文案）']),
        ...(adjustment ? ['补充修改：' + adjustment] : []),
      ].join('\\n'),
    });
    window.setTimeout(() => setIsConfirmingImage(false), 1500);
  }, [imagePlanForm, imagePlanDraft, isSubmitting, isConfirmingImage, submitMessage]);
  const addImagePlanCopyItem = useCallback(() => {
    setImagePlanDraft((current) => current ? {
      ...current,
      copyItems: [
        ...current.copyItems,
        { id: \`copy-user-\${Date.now()}\`, label: '上图文案', text: '', source: 'GPT 拟定' },
      ],
    } : current);
  }, []);
  const removeImagePlanCopyItem = useCallback((id: string) => {
    setImagePlanDraft((current) => current ? {
      ...current,
      copyItems: current.copyItems.filter((item) => item.id !== id),
    } : current);
  }, []);
  const handleImageRevision = useCallback(() => {
    const revision = imageRevision.trim();
    if (!revision || isSubmitting || isConfirmingImage) {
      return;
    }
    setIsConfirmingImage(true);
    submitMessage({ text: \`修改图片\\n\${revision}\` });
    window.setTimeout(() => setIsConfirmingImage(false), 1500);
  }, [imageRevision, isSubmitting, isConfirmingImage, submitMessage]);
  const handleImageReroll = useCallback(() => {
    if (isSubmitting || isConfirmingImage) {
      return;
    }
    setIsConfirmingImage(true);
    submitMessage({ text: '保持当前方案，再出一版' });
    window.setTimeout(() => setIsConfirmingImage(false), 1500);
  }, [isSubmitting, isConfirmingImage, submitMessage]);

  const isHajimiImageToolCall = useMemo(
    () =>
      isMCPToolCall &&
      mcpServerName === 'hajimi-website' &&
      (function_name === 'prepare_ecommerce_image_plan' ||
        function_name === 'confirm_ecommerce_image_plan' ||
        function_name === 'prepare_image_generation' ||
        function_name === 'execute_image_generation'),
    [isMCPToolCall, mcpServerName, function_name],
  );

  const toolIconType = useMemo(() => getToolIconType(name), [name]);`,
);

replaceOnce(
  'client/src/components/Chat/Messages/Content/ToolCall.tsx',
  `  if (!isLast && (!function_name || function_name.length === 0) && !output) {
    return null;
  }`,
  `  if (isHajimiImageToolCall) {
    if (hasOutput && !errorState) {
      return (
        <div className="my-2 rounded-lg border border-border-light bg-surface-secondary px-4 py-3">
          {function_name === 'execute_image_generation' ? (
            <Markdown content={visibleImageOutput} isLatestMessage={isLast} />
          ) : (
            <OutputRenderer text={visibleImageOutput} />
          )}
          {function_name === 'prepare_ecommerce_image_plan' && imagePlanForm && (
            <div className="mt-4 rounded-lg border border-border-light bg-surface-primary p-3 dark:border-border-dark">
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                <span>完整设计方案 / 生图提示词</span>
                <textarea
                  value={imagePlanDraft?.designPrompt || ''}
                  onChange={(event) => setImagePlanDraft((current) => current ? { ...current, designPrompt: event.target.value } : current)}
                  rows={8}
                  aria-label="完整设计方案"
                  className="resize-y rounded-md border border-border-light bg-surface-secondary px-3 py-2 text-sm leading-6 text-text-primary dark:border-border-dark"
                />
              </label>
              {imagePlanForm.referenceRoles.length > 0 && (
                <div className="mt-3 rounded-md border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-secondary dark:border-border-dark">
                  <div className="mb-1 font-medium text-text-primary">图片参考关系</div>
                  {imagePlanForm.referenceRoles.map((role) => (
                    <div key={role.imageIndex}>图{role.imageIndex}：{role.roleDescription}</div>
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-3">
                {(imagePlanDraft?.copyItems ?? []).map((item, index) => (
                  <div key={item.id} className="grid gap-2 rounded-md border border-border-light p-3 dark:border-border-dark sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto]">
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-text-secondary">
                      <span>文案名称</span>
                      <input
                        type="text"
                        value={item.label}
                        onChange={(event) => setImagePlanDraft((current) => current ? {
                          ...current,
                          copyItems: current.copyItems.map((entry, itemIndex) => itemIndex === index ? { ...entry, label: event.target.value } : entry),
                        } : current)}
                        aria-label={\`文案名称 \${index + 1}\`}
                        className="min-h-10 rounded-md border border-border-light bg-surface-secondary px-3 text-sm text-text-primary dark:border-border-dark"
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs text-text-secondary">
                      <span>文案内容</span>
                      <input
                        type="text"
                        value={item.text}
                        onChange={(event) => setImagePlanDraft((current) => current ? {
                          ...current,
                          copyItems: current.copyItems.map((entry, itemIndex) => itemIndex === index ? { ...entry, text: event.target.value } : entry),
                        } : current)}
                        aria-label={item.label || \`文案内容 \${index + 1}\`}
                        className="min-h-10 rounded-md border border-border-light bg-surface-secondary px-3 text-sm text-text-primary dark:border-border-dark"
                      />
                      <span className="text-[11px]">来源：{item.source}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeImagePlanCopyItem(item.id)}
                      className="self-end rounded-md border border-border-light px-3 py-2 text-xs text-text-secondary dark:border-border-dark"
                      aria-label={\`删除文案 \${index + 1}\`}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addImagePlanCopyItem}
                className="mt-3 rounded-md border border-border-light px-3 py-2 text-xs text-text-primary dark:border-border-dark"
                aria-label="添加上图文案"
              >
                添加文案
              </button>
              <label className="mt-3 flex flex-col gap-1 text-xs text-text-secondary">
                <span>补充修改（选填）</span>
                <textarea
                  value={imagePlanDraft?.adjustment || ''}
                  onChange={(event) => setImagePlanDraft((current) => current ? { ...current, adjustment: event.target.value } : current)}
                  rows={3}
                  placeholder="例如：主标题使用红色大字，产品整体向右移动"
                  aria-label="补充修改（选填）"
                  className="resize-y rounded-md border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary dark:border-border-dark"
                />
              </label>
              <button
                type="button"
                onClick={handleImagePlanConfirmation}
                disabled={!imagePlanDraft?.designPrompt.trim() || isSubmitting || isConfirmingImage}
                className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="确认主图方案"
              >
                {isSubmitting || isConfirmingImage ? '正在提交…' : '确认方案'}
              </button>
            </div>
          )}
          {imageConfirmationMessage && (
            <button
              type="button"
              onClick={handleImageConfirmation}
              disabled={isSubmitting || isConfirmingImage}
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="确认并生成图片"
            >
              {isSubmitting || isConfirmingImage ? '正在提交…' : '确认并生成'}
            </button>
          )}
          {function_name === 'execute_image_generation' &&
            typeof output === 'string' &&
            output.includes('图片生成完成') &&
            !imageIterationComplete && (
              <div className="mt-4 rounded-lg border border-border-light bg-surface-primary p-3 dark:border-border-dark">
                <label className="flex flex-col gap-1 text-xs text-text-secondary">
                  <span>图片修改要求（选填）</span>
                  <textarea
                    value={imageRevision}
                    onChange={(event) => setImageRevision(event.target.value)}
                    rows={3}
                    placeholder="例如：保留产品不变，把主标题放大，背景改成浅粉色"
                    aria-label="图片修改要求"
                    className="resize-y rounded-md border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary dark:border-border-dark"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleImageRevision}
                    disabled={!imageRevision.trim() || isSubmitting || isConfirmingImage}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="按修改要求重新生成方案"
                  >
                    修改这张
                  </button>
                  <button
                    type="button"
                    onClick={handleImageReroll}
                    disabled={isSubmitting || isConfirmingImage}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border-light px-4 py-2 text-sm font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark"
                    aria-label="保持方案再出一版"
                  >
                    再出一版
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageIterationComplete(true)}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border-light px-4 py-2 text-sm font-medium text-text-secondary dark:border-border-dark"
                    aria-label="完成图片修改"
                  >
                    完成
                  </button>
                </div>
              </div>
            )}
        </div>
      );
    }
    if (!isLast) {
      return null;
    }
    const statusText = errorState
      ? '生图处理失败，请重新发送一条消息后再试。'
      : showCancelled
        ? '生图处理已取消。'
        : function_name === 'prepare_image_generation'
          ? '正在整理生图报价…'
          : '正在生成图片，请稍候…';
    return (
      <div
        className="relative my-1.5 flex min-h-5 shrink-0 items-center gap-2.5 text-sm text-text-secondary"
        role="status"
        aria-live="polite"
      >
        <ToolIcon
          type={toolIconType}
          iconUrl={mcpIconUrl}
          isAnimating={progress < 1 && !showCancelled && !errorState}
        />
        <span>{statusText}</span>
      </div>
    );
  }

  if (!isLast && (!function_name || function_name.length === 0) && !output) {
    return null;
  }`,
);

replaceOnce(
  'client/src/components/Chat/Messages/Content/ToolCallGroup.tsx',
  `interface ToolMeta {
  name: string;
  iconName: string;
  hasOutput: boolean;
}

function getToolMeta(part: TMessageContentParts): ToolMeta | null {`,
  `interface ToolMeta {
  name: string;
  iconName: string;
  hasOutput: boolean;
}

function isHajimiImageToolName(name: string): boolean {
  if (!name.includes(Constants.mcp_delimiter)) {
    return false;
  }
  const parts = name.split(Constants.mcp_delimiter);
  const functionName = parts[0] ?? '';
  const serverName = parts.slice(1).join(Constants.mcp_delimiter);
  return (
    serverName === 'hajimi-website' &&
    (functionName === 'prepare_ecommerce_image_plan' ||
      functionName === 'confirm_ecommerce_image_plan' ||
      functionName === 'prepare_image_generation' ||
      functionName === 'execute_image_generation')
  );
}

function getToolMeta(part: TMessageContentParts): ToolMeta | null {`,
);

replaceOnce(
  'client/src/components/Chat/Messages/Content/ToolCallGroup.tsx',
  `  const toolNames = useMemo(() => toolMetadata.map((m) => m?.name ?? ''), [toolMetadata]);
  const iconToolNames = useMemo(() => toolMetadata.map((m) => m?.iconName ?? ''), [toolMetadata]);`,
  `  const toolNames = useMemo(() => toolMetadata.map((m) => m?.name ?? ''), [toolMetadata]);
  const iconToolNames = useMemo(() => toolMetadata.map((m) => m?.iconName ?? ''), [toolMetadata]);
  const allHajimiImageTools = useMemo(
    () => toolNames.length > 0 && toolNames.every(isHajimiImageToolName),
    [toolNames],
  );`,
);

replaceOnce(
  'client/src/components/Chat/Messages/Content/ToolCallGroup.tsx',
  `  return (
    <div className="mb-2 mt-1">`,
  `  if (allHajimiImageTools) {
    return (
      <div className="mb-2 mt-1">
        {parts.map(({ part, idx }) => renderPart(part, idx, isLast && idx === lastContentIdx))}
        {groupAttachments && groupAttachments.length > 0 && (
          <AttachmentGroup attachments={groupAttachments} />
        )}
      </div>
    );
  }

  return (
    <div className="mb-2 mt-1">`,
);

replaceOnce(
  'client/src/components/Chat/Messages/Content/__tests__/ToolCall.test.tsx',
  `jest.mock('../Parts', () => ({`,
  `jest.mock('~/components/Messages/Content/CopyButton', () => ({
  __esModule: true,
  default: () => <button type="button">Copy</button>,
}));

jest.mock('../Markdown', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => {
    const image = content.match(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/);
    return (
      <div data-testid="markdown-output">
        <span>{content}</span>
        {image ? <img src={image[2]} alt={image[1]} /> : null}
      </div>
    );
  },
}));

jest.mock('../Parts', () => ({`,
);

replaceOnce(
  'client/src/components/Chat/Messages/Content/__tests__/ToolCall.test.tsx',
  `// Mock dependencies
jest.mock('~/hooks', () => ({`,
  `// Mock dependencies
const mockSubmitMessage = jest.fn();

jest.mock('~/hooks', () => ({`,
);

replaceOnce(
  'client/src/components/Chat/Messages/Content/__tests__/ToolCall.test.tsx',
  `  useExpandCollapse: (isExpanded: boolean) => ({
    style: {
      display: 'grid',
      gridTemplateRows: isExpanded ? '1fr' : '0fr',
      opacity: isExpanded ? 1 : 0,
    },
    ref: { current: null },
  }),
}));`,
  `  useExpandCollapse: (isExpanded: boolean) => ({
    style: {
      display: 'grid',
      gridTemplateRows: isExpanded ? '1fr' : '0fr',
      opacity: isExpanded ? 1 : 0,
    },
    ref: { current: null },
  }),
  useSubmitMessage: () => ({ submitMessage: mockSubmitMessage }),
}));`,
);

replaceOnce(
  'client/src/components/Chat/Messages/Content/__tests__/ToolCall.test.tsx',
  `  describe('A11Y-04: screen reader status announcements', () => {`,
  `  describe('hajimi ordinary-user image tools', () => {
    const imageToolName =
      'prepare_image_generation' + Constants.mcp_delimiter + 'hajimi-website';

    it('shows readable output without technical tool details while waiting for final text', () => {
      const { container } = renderWithRecoil(
        <ToolCall
          {...mockProps}
          name={imageToolName}
          args={'{"quoteId":"internal"}'}
          output={'### 生图报价已准备\\n\\n请回复 **确认生图 932EE2**'}
          isLast
        />,
      );

      expect(screen.getByText(/生图报价已准备/)).toBeInTheDocument();
      expect(screen.queryByTestId('progress-text')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tool-call-info')).not.toBeInTheDocument();
      expect(container.textContent).not.toContain('prepare_image_generation');
      expect(container.textContent).not.toContain('hajimi-website');
      expect(container.textContent).not.toContain('quoteId');
    });

    it('submits the exact image confirmation message from the quote button', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          name={imageToolName}
          output={'请在下一条消息回复： **确认生图 932ee2**'}
          isLast
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: '确认并生成图片' }));

      expect(mockSubmitMessage).toHaveBeenCalledTimes(1);
      expect(mockSubmitMessage).toHaveBeenCalledWith({ text: '确认生图 932EE2' });
    });

    it('shows the ecommerce copy form and submits the confirmed copy revision', () => {
      const planToolName =
        'prepare_ecommerce_image_plan' + Constants.mcp_delimiter + 'hajimi-website';
      const planPayload =
        'eyJ2ZXJzaW9uIjoyLCJjb25maXJtYXRpb25Db2RlIjoiREVGNDU2IiwiZGVzaWduUHJvbXB0Ijoi5Y-C6ICD5Zu-MeeahOeJiOW8j-WSjOawm-WbtO-8jOS9v-eUqOWbvjLmtJfooaPmtrLkvZzkuLrkuqflk4HkuLvkvZPvvIznlJ_miJDlrozmlbTnlLXllYbkuLvlm77mlrnmoYjjgIIiLCJyZWZlcmVuY2VSb2xlcyI6W3siaW1hZ2VJbmRleCI6MSwicm9sZURlc2NyaXB0aW9uIjoi5Y-C6ICD54mI5byP5ZKM5rCb5Zu0In0seyJpbWFnZUluZGV4IjoyLCJyb2xlRGVzY3JpcHRpb24iOiLkvZzkuLrmtJfooaPmtrLkuqflk4HkuLvkvZMifV0sImNvcHlJdGVtcyI6W3siaWQiOiJtYWluLXRpdGxlIiwibGFiZWwiOiLkuLvmoIfpopgiLCJ0ZXh0Ijoi5omT5byA6KGj5p-c6YO95piv6aaZ55qEIiwic291cmNlIjoiR1BUIOaLn-WumiJ9LHsiaWQiOiJzdWJ0aXRsZSIsImxhYmVsIjoi5Ymv5qCH6aKYIiwidGV4dCI6IuiMieiOieeZveiMtummmeawmyIsInNvdXJjZSI6IuivhuWIq-iHquWbvueJhyAyIn1dLCJhZGp1c3RtZW50IjoiIn0';
      const { container } = renderWithRecoil(
        <ToolCall
          {...mockProps}
          name={planToolName}
          output={'### 电商主图设计方案\\n\\n[HJM_IMAGE_PLAN_FORM:' + planPayload + ']'}
          isLast
        />,
      );

      expect(screen.getByRole('textbox', { name: '完整设计方案' })).toHaveValue(
        '参考图1的版式和氛围，使用图2洗衣液作为产品主体，生成完整电商主图方案。',
      );
      expect(screen.getByRole('textbox', { name: '主标题' })).toHaveValue('打开衣柜都是香的');
      expect(screen.getByRole('textbox', { name: '主标题' })).not.toHaveAttribute('readonly');
      expect(screen.getByText('来源：GPT 拟定')).toBeInTheDocument();
      expect(screen.getByText('来源：识别自图片 2')).toBeInTheDocument();
      fireEvent.change(screen.getByRole('textbox', { name: '完整设计方案' }), {
        target: { value: '用户编辑后的完整设计方案，继续参考图1版式并使用图2产品。' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: '文案名称 1' }), {
        target: { value: '核心主标题' },
      });
      fireEvent.change(screen.getByRole('textbox', { name: '核心主标题' }), {
        target: { value: '茉莉白茶洗衣液 7天留香' },
      });
      expect(container.textContent).not.toContain('HJM_IMAGE_PLAN_FORM');
      fireEvent.click(screen.getByRole('button', { name: '添加上图文案' }));
      expect(screen.getByRole('textbox', { name: '文案名称 3' })).toHaveValue('上图文案');
      fireEvent.click(screen.getByRole('button', { name: '删除文案 3' }));
      fireEvent.change(screen.getByRole('textbox', { name: '补充修改（选填）' }), {
        target: { value: '主标题改成红色大字' },
      });
      fireEvent.click(screen.getByRole('button', { name: '确认主图方案' }));

      expect(mockSubmitMessage).toHaveBeenCalledWith({
        text: '确认方案 DEF456\\n完整设计方案：\\n用户编辑后的完整设计方案，继续参考图1版式并使用图2产品。\\n动态文案：\\n- [main-title] 核心主标题：茉莉白茶洗衣液 7天留香（来源：GPT 拟定）\\n- [subtitle] 副标题：茉莉白茶香氛（来源：识别自图片 2）\\n补充修改：主标题改成红色大字',
      });
    });

    it('keeps legacy fixed-field plan markers editable', () => {
      const planToolName =
        'prepare_ecommerce_image_plan' + Constants.mcp_delimiter + 'hajimi-website';
      const legacyPayload =
        'eyJjb25maXJtYXRpb25Db2RlIjoiREVGNDU2IiwiZmllbGRzIjpbeyJrZXkiOiJtYWluVGl0bGUiLCJsYWJlbCI6IuS4u-agh-mimCIsInZhbHVlIjoi5omT5byA6KGj5p-c6YO95piv6aaZ55qEIn1dLCJyZXZpc2lvbk5vdGVzIjoiIn0';
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          name={planToolName}
          output={'旧方案\\n[HJM_IMAGE_PLAN_FORM:' + legacyPayload + ']'}
          isLast
        />,
      );
      expect(screen.getByRole('textbox', { name: '主标题' })).toHaveValue('打开衣柜都是香的');
      expect(screen.getByRole('textbox', { name: '主标题' })).not.toHaveAttribute('readonly');
    });

    it('keeps the quote visible when the final assistant continuation fails', () => {
      const { container } = renderWithRecoil(
        <ToolCall {...mockProps} name={imageToolName} output={'生图报价已准备'} isLast={false} />,
      );

      expect(screen.getByText(/生图报价已准备/)).toBeInTheDocument();
      expect(container.textContent).not.toContain('prepare_image_generation');
      expect(container.textContent).not.toContain('hajimi-website');
    });

    it('renders completed generated-image Markdown as an image', () => {
      const executeImageToolName =
        'execute_image_generation' + Constants.mcp_delimiter + 'hajimi-website';
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          name={executeImageToolName}
          output={'### 图片生成完成\\n\\n![生成图片 1](/uploads/generated/result.png)'}
          isLast
        />,
      );

      expect(screen.getByRole('img', { name: '生成图片 1' })).toHaveAttribute(
        'src',
        '/uploads/generated/result.png',
      );
    });

    it('submits a text-only revision from a completed image without asking for re-upload', () => {
      const executeImageToolName =
        'execute_image_generation' + Constants.mcp_delimiter + 'hajimi-website';
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          name={executeImageToolName}
          output={'### 图片生成完成\\n\\n![生成图片 1](/uploads/generated/result.png)'}
          isLast
        />,
      );

      fireEvent.change(screen.getByRole('textbox', { name: '图片修改要求' }), {
        target: { value: '保留产品不变，把主标题放大' },
      });
      fireEvent.click(screen.getByRole('button', { name: '按修改要求重新生成方案' }));

      expect(mockSubmitMessage).toHaveBeenCalledWith({
        text: '修改图片\\n保留产品不变，把主标题放大',
      });
    });
  });

  describe('A11Y-04: screen reader status announcements', () => {`,
);

replaceOnce(
  'client/src/hooks/Nav/useSideNavLinks.ts',
  `    if (
      (hasAccessToUseMCPSettings && availableMCPServers && availableMCPServers.length > 0) ||
      hasAccessToCreateMCP
    ) {`,
  `    const hideBuiltInMcpManagement = true;
    if (
      !hideBuiltInMcpManagement &&
      ((hasAccessToUseMCPSettings && availableMCPServers && availableMCPServers.length > 0) ||
        hasAccessToCreateMCP)
    ) {`,
);

replaceOnce(
  'client/src/components/SidePanel/Agents/MCPTools.tsx',
  `  if (!hasMcpAccess) {
    return null;
  }`,
  `  const hideBuiltInMcpManagement = true;
  if (!hasMcpAccess || hideBuiltInMcpManagement) {
    return null;
  }`,
);

mergeJson('client/src/locales/zh-Hans/translation.json', {
  com_nav_control_panel: '控制面板',
  com_ui_add_skills: '添加技能',
  com_ui_create_skill: '创建技能',
  com_ui_create_skill_upload: '上传 SKILL.md',
  com_ui_create_skill_upload_error: '读取上传文件失败',
  com_ui_filter_skills_name: '按名称筛选技能',
  com_ui_my_skills: '我的技能',
  com_ui_no_skills_found: '未找到技能',
  com_ui_search_skills: '搜索技能...',
  com_ui_skill: '技能',
  com_ui_skill_content: '技能内容',
  com_ui_skill_content_placeholder: '使用 Markdown 输入技能说明...',
  com_ui_skill_create_error: '创建技能失败',
  com_ui_skill_create_title: '创建技能',
  com_ui_skill_created: '技能已创建',
  com_ui_skill_delete_confirm: '确定要删除“{{0}}”吗？此操作无法撤销。',
  com_ui_skill_delete_error: '删除技能失败',
  com_ui_skill_deleted: '技能已删除',
  com_ui_skill_description_field_hint: '请明确说明该技能适用的场景。',
  com_ui_skill_description_placeholder: '例如：为演示文稿和文档应用公司品牌规范...',
  com_ui_skill_description_required: '必须填写描述',
  com_ui_skill_description_too_long: '描述不能超过 {{0}} 个字符',
  com_ui_skill_edit_title: '编辑技能',
  com_ui_skill_file_binary: '二进制文件，无法在线预览',
  com_ui_skill_file_download: '下载',
  com_ui_skill_file_load_error: '加载文件内容失败',
  com_ui_skill_finished: '已运行 {{0}}',
  com_ui_skill_instructions: '说明',
  com_ui_skill_instructions_placeholder: '使用 Markdown 输入技能说明...',
  com_ui_skill_name_invalid: '只能使用小写字母、数字和连字符（kebab-case）',
  com_ui_skill_name_placeholder: 'brand-guidelines',
  com_ui_skill_name_required: '必须填写名称',
  com_ui_skill_name_too_long: '名称不能超过 {{0}} 个字符',
  com_ui_skill_new_file: '新建文件',
  com_ui_skill_new_folder: '新建文件夹',
  com_ui_skill_no_edit_permission: '你没有编辑此技能的权限',
  com_ui_skill_no_selection: '请选择技能',
  com_ui_skill_no_selection_desc: '从侧边栏选择一个技能以查看详情。',
  com_ui_skill_not_found: '未找到技能',
  com_ui_skill_not_found_description: '该技能可能已被删除，或你已无权访问。',
  com_ui_skill_role_editor_desc: '可以查看和编辑技能',
  com_ui_skill_role_owner_desc: '拥有技能的完整控制权，包括分享和删除',
  com_ui_skill_role_viewer_desc: '可以查看和使用技能，但不能编辑',
  com_ui_skill_running: '正在运行 {{0}}',
  com_ui_skill_sr_public: '公共技能',
  com_ui_skill_states_limit: '启用或停用的技能覆盖已达到 {{0}} 个上限，请先移除部分覆盖。',
  com_ui_skill_toggle_active: '切换技能启用状态',
  com_ui_skill_update_conflict: '其他修改已先保存，正在加载最新版本。',
  com_ui_skill_update_error: '保存技能失败',
  com_ui_skill_updated: '技能已保存',
  com_ui_skill_upload: '上传技能',
  com_ui_skill_upload_drag: '拖放文件到这里，或点击上传',
  com_ui_skill_upload_file: '上传文件',
  com_ui_skill_upload_req_md: '.md 文件必须以 YAML 格式包含技能名称和描述',
  com_ui_skill_upload_req_size: '文件大小不能超过 {{0}} MB',
  com_ui_skill_upload_req_zip: '.zip 或 .skill 文件必须包含 SKILL.md',
  com_ui_skill_upload_requirements: '文件要求',
  com_ui_skill_upload_size_error: '导入的技能不能超过 {{0}} MB',
  com_ui_skill_upload_title: '上传技能',
  com_ui_skill_version: '版本 {{0}}',
  com_ui_skill_view_rendered: '预览效果',
  com_ui_skill_view_source: '查看源码',
  com_ui_skill_warnings: '请注意',
  com_ui_skill_write_instructions: '编写技能说明',
  com_ui_skills: '技能',
  com_ui_skills_allow_create: '允许创建技能',
  com_ui_skills_allow_share: '允许分享技能',
  com_ui_skills_allow_share_public: '允许公开分享技能',
  com_ui_skills_allow_use: '允许使用技能',
  com_ui_skills_always_apply_invoked: '自动应用的技能',
  com_ui_skills_always_apply_pin_title: '始终应用的技能（每轮对话自动加载）',
  com_ui_skills_command_placeholder: '按名称选择技能',
  com_ui_skills_disabled_hint: '此智能体尚未启用技能。启用后，模型可以使用你的技能库。',
  com_ui_skills_empty: '暂无技能',
  com_ui_skills_enable_toggle: '为此智能体启用技能',
  com_ui_skills_enabled_all_hint: '已启用全部可访问技能；也可以在下方缩小可用范围。',
  com_ui_skills_enabled_allowlist_hint: '已启用，仅限下方选中的技能。',
  com_ui_skills_load_error: '加载技能失败',
  com_ui_skills_manual_invoked: '手动调用的技能',
  com_ui_skills_queued: '将在下次提交时使用的技能',
});

console.log('Applied Hajimi integration patches to LibreChat.');

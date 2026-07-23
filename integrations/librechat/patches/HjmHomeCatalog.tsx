import { useEffect, useMemo, useState } from 'react';
import { Bot, Check, Image as ImageIcon, ScrollText } from 'lucide-react';
import { Constants } from 'librechat-data-provider';
import type { TConversation, TSkillSummary } from 'librechat-data-provider';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useChatContext } from '~/Providers';
import { useListSkillsQuery } from '~/data-provider';
import { useSkillActiveState } from '~/hooks';
import { ephemeralAgentByConvoId } from '~/store';
import store from '~/store';

type ManagedAgent = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  skillsEnabled: boolean;
  imageToolsEnabled: boolean;
};

type HomeCatalogResponse = {
  success: boolean;
  agents: ManagedAgent[];
};

const skillTrialGuides = [
  {
    name: 'image-reverse-describe',
    title: '精确反推一张图',
    preparation: '上传 1 张图片',
    prompt: '把这张图反推到仅凭文字就能重建，先给结构化取证描述，再给完整长描述。',
  },
  {
    name: 'image-deep-read',
    title: '深读意图与效果',
    preparation: '上传 1 张图片',
    prompt: '深读这张图：为什么这样设计、给谁看、承担什么任务、做得好不好，并列出风险和存疑。',
  },
  {
    name: 'style-grammar-distill',
    title: '提炼一套视觉风格',
    preparation: '上传同一作者至少 4–5 份分析报告',
    prompt: '把这些报告聚合成风格语法，区分作者签名、条件规则、brief 噪声和例外。',
  },
] as const;

function mainAuthToken() {
  return (
    window.localStorage.getItem('auth_token') ??
    window.localStorage.getItem('admin_auth_token') ??
    ''
  );
}

export default function HjmHomeCatalog() {
  const { conversation, setConversation } = useChatContext();
  const conversationId = conversation?.conversationId ?? Constants.NEW_CONVO;
  const setEphemeralAgent = useSetRecoilState(ephemeralAgentByConvoId(conversationId));
  const setPendingSkills = useSetRecoilState(store.pendingManualSkillsByConvoId(conversationId));
  const pendingSkills = useRecoilValue(store.pendingManualSkillsByConvoId(conversationId));
  const { isActive } = useSkillActiveState();
  const { data: skillsData, isLoading: skillsLoading } = useListSkillsQuery({ limit: 8 });
  const [agents, setAgents] = useState<ManagedAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const token = mainAuthToken();
    if (!token) {
      setCatalogLoading(false);
      setCatalogError('主站登录状态已失效');
      return () => controller.abort();
    }
    void fetch('/api/chat/home-catalog', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as HomeCatalogResponse & { message?: string };
        if (!response.ok || !data.success) {
          throw new Error(data.message || '智能体目录加载失败');
        }
        setAgents(Array.isArray(data.agents) ? data.agents : []);
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') {
          setCatalogError(error.message || '智能体目录加载失败');
        }
      })
      .finally(() => setCatalogLoading(false));
    return () => controller.abort();
  }, []);

  const skills = useMemo(
    () =>
      (skillsData?.skills || []).filter(
        (skill: TSkillSummary) => skill.userInvocable !== false && isActive(skill),
      ),
    [isActive, skillsData?.skills],
  );

  const selectAgent = (agent: ManagedAgent) => {
    setSelectedAgentId(agent.id);
    setConversation(
      (previous) =>
        ({
          ...previous,
          conversationId: Constants.NEW_CONVO,
          endpoint: 'hajimi',
          endpointType: 'custom',
          agent_id: Constants.EPHEMERAL_AGENT_ID,
          model: agent.model,
          modelLabel: agent.name,
          promptPrefix: agent.instructions,
          greeting: agent.description,
        }) as TConversation,
    );
    setEphemeralAgent({
      skills: agent.skillsEnabled,
      mcp: agent.imageToolsEnabled ? ['hajimi-website'] : [],
      hjm_image_tools: agent.imageToolsEnabled,
      hjm_managed_agent_id: agent.id,
    });
  };

  const selectSkill = (skill: TSkillSummary) => {
    setPendingSkills((previous) =>
      previous.includes(skill.name) ? previous : [...previous, skill.name],
    );
    setEphemeralAgent((previous) => ({ ...(previous || {}), skills: true }));
  };

  return (
    <div className="mx-auto mt-5 w-full max-w-4xl px-2 pb-4 sm:px-0">
      <section aria-labelledby="hjm-agents-title">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-cyan-500" />
            <h2 id="hjm-agents-title" className="text-sm font-semibold text-text-primary">
              智能体
            </h2>
          </div>
          <span className="text-xs text-text-secondary">由网站后台统一管理</span>
        </div>

        {catalogLoading && (
          <div className="rounded-lg border border-border-light px-4 py-5 text-sm text-text-secondary dark:border-border-dark">
            正在加载智能体...
          </div>
        )}
        {!catalogLoading && catalogError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {catalogError}
          </div>
        )}
        {!catalogLoading && !catalogError && agents.length === 0 && (
          <div className="rounded-lg border border-border-light px-4 py-5 text-sm text-text-secondary dark:border-border-dark">
            暂无可用智能体，请联系管理员在 Chat 设置中添加。
          </div>
        )}
        {agents.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {agents.map((agent) => {
              const selected = selectedAgentId === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => selectAgent(agent)}
                  className={`group flex min-h-24 w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/25'
                      : 'border-border-light bg-surface-primary hover:bg-surface-secondary dark:border-border-dark'
                  }`}
                  aria-pressed={selected}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                    <Bot className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                      <span className="truncate">{agent.name}</span>
                      {selected && <Check className="size-4 shrink-0 text-cyan-600" />}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">
                      {agent.description || '点击使用这个智能体开始对话'}
                    </span>
                    <span className="mt-2 flex items-center gap-3 text-[11px] text-text-secondary">
                      {agent.skillsEnabled && (
                        <span className="inline-flex items-center gap-1">
                          <ScrollText className="size-3" />Skills
                        </span>
                      )}
                      {agent.imageToolsEnabled && (
                        <span className="inline-flex items-center gap-1">
                          <ImageIcon className="size-3" />生图
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-5" aria-labelledby="hjm-skills-title">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScrollText className="size-4 text-cyan-500" />
            <h2 id="hjm-skills-title" className="text-sm font-semibold text-text-primary">
              Skills
            </h2>
          </div>
          <span className="text-xs text-text-secondary">选择后用于下一条消息</span>
        </div>

        {skillsLoading && (
          <div className="text-sm text-text-secondary">正在加载 Skills...</div>
        )}
        {!skillsLoading && skills.length === 0 && (
          <div className="rounded-lg border border-border-light px-4 py-4 text-sm text-text-secondary dark:border-border-dark">
            暂无可用 Skills，可通过输入框的“技能”按钮创建私有 Skill。
          </div>
        )}
        {skills.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => {
                const selected = pendingSkills.includes(skill.name);
                return (
                  <button
                    key={skill._id}
                    type="button"
                    onClick={() => selectSkill(skill)}
                    className={`inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      selected
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/25 dark:text-cyan-200'
                        : 'border-border-light bg-surface-primary text-text-primary hover:bg-surface-secondary dark:border-border-dark'
                    }`}
                    aria-pressed={selected}
                  >
                    {selected ? <Check className="size-3.5 shrink-0" /> : <ScrollText className="size-3.5 shrink-0" />}
                    <span className="truncate">{skill.displayTitle || skill.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 dark:border-cyan-900 dark:bg-cyan-950/20">
              <div className="text-sm font-semibold text-text-primary">试用引导</div>
              <p className="mt-1 text-xs leading-5 text-text-secondary">
                先上传图片或分析报告，再点击下面对应能力，最后发送示例指令。选中的 Skill 会用于下一条消息。
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {skillTrialGuides.map((guide) => {
                  const skill = skills.find((item) => item.name === guide.name);
                  if (!skill) return null;
                  const selected = pendingSkills.includes(skill.name);
                  return (
                    <button
                      key={guide.name}
                      type="button"
                      onClick={() => selectSkill(skill)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? 'border-cyan-500 bg-white dark:bg-cyan-950/40'
                          : 'border-cyan-100 bg-white/80 hover:border-cyan-400 dark:border-cyan-900 dark:bg-surface-primary'
                      }`}
                      aria-pressed={selected}
                      aria-label={`选择 ${guide.title}`}
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                        {selected ? <Check className="size-3.5 text-cyan-600" /> : <ScrollText className="size-3.5 text-cyan-600" />}
                        {guide.title}
                      </span>
                      <span className="mt-2 block text-[11px] text-cyan-700 dark:text-cyan-300">
                        准备：{guide.preparation}
                      </span>
                      <span className="mt-1 block text-[11px] leading-5 text-text-secondary">
                        示例：{guide.prompt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

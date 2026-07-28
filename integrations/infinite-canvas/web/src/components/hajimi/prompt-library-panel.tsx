import { memo, useEffect, useMemo, useState } from "react";
import { App, Dropdown, Empty, Input, Modal, Popconfirm, Select, Spin, Switch, Tag } from "antd";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, CopyPlus, FileText, Heart, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { getPromptsApi } from "@/integrations/hajimi/browser-client";
import { buildPromptInsertReference, type CloudPrompt, type CloudPromptListPage } from "@/integrations/hajimi/prompts-api";
import type { CanvasTheme } from "@/lib/canvas-theme";
import { cn } from "@/lib/utils";
import { usePromptSourceStore } from "@/stores/use-prompt-source-store";
import { useUserStore } from "@/stores/use-user-store";
import type { InsertAssetPayload, PromptInsertTarget } from "@/components/canvas/asset-picker-modal";

// 画布内双层云端提示词库（Task 7）：
// - 「系统提示词」只读（后端只返回已发布），支持复制文本与“复制到我的提示词”。
// - 「我的提示词」为当前账号私有，支持新建/编辑/删除/收藏；账号切换后按用户重新拉取，401 即清空。
// - 提示词数据一律经 /api/* 获取，本组件不读写 localStorage/IndexedDB；
//   Store（use-prompt-source-store）只保存 Tab/搜索/筛选/当前选择等 UI 状态。
// - 插入项目时携带 scope + promptId + version + contentSnapshot（references.prompts 结构）。

const PAGE_LIMIT = 24;

const INSERT_TARGETS: { key: PromptInsertTarget; label: string }[] = [
    { key: "selected-node", label: "插入当前节点" },
    { key: "config-node", label: "生成配置节点" },
    { key: "assistant", label: "插入 Assistant 输入框" },
];

type Props = {
    onInsert: (payload: InsertAssetPayload) => void;
    theme: CanvasTheme;
};

function useDebouncedValue(value: string, delayMs = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);
    return debounced;
}

export const PromptLibraryPanel = memo(function PromptLibraryPanel({ onInsert, theme }: Props) {
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const activeTab = usePromptSourceStore((state) => state.activeTab);
    const keyword = usePromptSourceStore((state) => state.keyword);
    const category = usePromptSourceStore((state) => state.category);
    const tag = usePromptSourceStore((state) => state.tag);
    const favoriteOnly = usePromptSourceStore((state) => state.favoriteOnly);
    const setActiveTab = usePromptSourceStore((state) => state.setActiveTab);
    const setKeyword = usePromptSourceStore((state) => state.setKeyword);
    const setCategory = usePromptSourceStore((state) => state.setCategory);
    const setTag = usePromptSourceStore((state) => state.setTag);
    const setFavoriteOnly = usePromptSourceStore((state) => state.setFavoriteOnly);
    const select = usePromptSourceStore((state) => state.select);
    const userId = useUserStore((state) => state.user?.id || "");

    const debouncedKeyword = useDebouncedValue(keyword);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState<CloudPrompt | null>(null);
    const [form, setForm] = useState({ title: "", content: "", category: "", tags: [] as string[] });

    const filters = { q: debouncedKeyword.trim(), category, tag };

    // 系统提示词：所有登录账号可见的已发布集合，与账号无关。
    const systemQuery = useInfiniteQuery({
        queryKey: ["hjm-system-prompts", filters.q, filters.category, filters.tag],
        queryFn: ({ pageParam }) => getPromptsApi().listSystem({ ...filters, cursor: pageParam || undefined, limit: PAGE_LIMIT }),
        initialPageParam: "",
        getNextPageParam: (lastPage: CloudPromptListPage) => lastPage.nextCursor || undefined,
        enabled: activeTab === "system",
    });

    // 我的提示词：queryKey 携带 userId，账号切换后立即按新账号重新拉取，旧账号数据不可见。
    const userQuery = useInfiniteQuery({
        queryKey: ["hjm-user-prompts", userId, filters.q, filters.category, filters.tag, favoriteOnly],
        queryFn: ({ pageParam }) => getPromptsApi().listUser({ ...filters, favorite: favoriteOnly, cursor: pageParam || undefined, limit: PAGE_LIMIT }),
        initialPageParam: "",
        getNextPageParam: (lastPage: CloudPromptListPage) => lastPage.nextCursor || undefined,
        enabled: activeTab === "user" && !!userId,
    });

    const activeQuery = activeTab === "system" ? systemQuery : userQuery;
    const items = useMemo(() => activeQuery.data?.pages.flatMap((page: CloudPromptListPage) => page.items) || [], [activeQuery.data]);
    const categoryOptions = useMemo(
        () => [{ label: "全部分类", value: "" }, ...Array.from(new Set(items.map((item) => item.category).filter(Boolean))).map((value) => ({ label: value, value }))],
        [items],
    );
    const tagOptions = useMemo(() => Array.from(new Set(items.flatMap((item) => item.tags))).slice(0, 20), [items]);

    const refreshUserPrompts = () => queryClient.invalidateQueries({ queryKey: ["hjm-user-prompts"] });

    const copyText = async (content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            message.success("已复制提示词文本");
        } catch {
            message.error("复制失败");
        }
    };

    const insertPrompt = (prompt: CloudPrompt, target: PromptInsertTarget) => {
        onInsert({ kind: "prompt", content: prompt.content, title: prompt.title, target, reference: buildPromptInsertReference(prompt) });
        select({ scope: prompt.scope, promptId: prompt.id, ...(prompt.version !== undefined ? { version: prompt.version } : {}), title: prompt.title });
    };

    const copyToMine = async (prompt: CloudPrompt) => {
        try {
            await getPromptsApi().copySystem(prompt.id);
            message.success(`已复制「${prompt.title}」到我的提示词`);
            await refreshUserPrompts();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "复制失败");
        }
    };

    const openCreate = () => {
        setEditing(null);
        setForm({ title: "", content: "", category: "", tags: [] });
        setEditorOpen(true);
    };

    const openEdit = (prompt: CloudPrompt) => {
        setEditing(prompt);
        setForm({ title: prompt.title, content: prompt.content, category: prompt.category, tags: [...prompt.tags] });
        setEditorOpen(true);
    };

    const saveEditor = async () => {
        if (!form.title.trim()) return message.warning("请填写标题");
        if (!form.content.trim()) return message.warning("请填写内容");
        try {
            if (editing) {
                await getPromptsApi().update(editing.id, { title: form.title, content: form.content, category: form.category, tags: form.tags });
                message.success("提示词已更新");
            } else {
                await getPromptsApi().create({ title: form.title, content: form.content, category: form.category, tags: form.tags });
                message.success("提示词已创建");
            }
            setEditorOpen(false);
            await refreshUserPrompts();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        }
    };

    const toggleFavorite = async (prompt: CloudPrompt) => {
        try {
            await getPromptsApi().update(prompt.id, { isFavorite: !prompt.isFavorite });
            await refreshUserPrompts();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "收藏失败");
        }
    };

    const removePrompt = async (prompt: CloudPrompt) => {
        try {
            await getPromptsApi().remove(prompt.id);
            message.success(`已删除「${prompt.title}」`);
            await refreshUserPrompts();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "删除失败");
        }
    };

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-4 px-3 pb-2 pt-1">
                {(["system", "user"] as const).map((tabKey) => (
                    <button
                        key={tabKey}
                        type="button"
                        onClick={() => setActiveTab(tabKey)}
                        className="text-xs font-semibold transition-opacity"
                        style={{ color: theme.node.text, opacity: activeTab === tabKey ? 1 : 0.45 }}
                    >
                        {tabKey === "system" ? "系统提示词" : "我的提示词"}
                    </button>
                ))}
                {activeTab === "user" ? (
                    <button
                        type="button"
                        onClick={openCreate}
                        className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: theme.toolbar.activeText }}
                    >
                        <Plus className="size-3.5" />
                        新建
                    </button>
                ) : null}
            </div>
            <div className="flex items-center gap-2 px-3 pb-2">
                <Input size="small" allowClear prefix={<Search className="size-3.5 text-stone-400" />} placeholder="搜索提示词" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
                <Select size="small" className="w-28" value={category} options={categoryOptions} onChange={setCategory} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
                {activeTab === "user" ? (
                    <span className="flex items-center gap-1 text-xs opacity-60">
                        <Heart className="size-3" />
                        <Switch size="small" checked={favoriteOnly} onChange={setFavoriteOnly} />
                    </span>
                ) : null}
                <Tag.CheckableTag checked={!tag} className={cn("prompt-filter-tag", !tag && "is-active")} onChange={() => setTag("")}>
                    全部
                </Tag.CheckableTag>
                {tagOptions.map((item) => (
                    <Tag.CheckableTag key={item} checked={tag === item} className={cn("prompt-filter-tag", tag === item && "is-active")} onChange={() => setTag(tag === item ? "" : item)}>
                        {item}
                    </Tag.CheckableTag>
                ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {activeTab === "user" && !userId ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="登录后可见我的提示词" className="pt-12" />
                ) : activeQuery.isLoading ? (
                    <div className="flex justify-center py-10">
                        <Spin size="small" />
                    </div>
                ) : activeQuery.isError ? (
                    <button type="button" onClick={() => void activeQuery.refetch()} className="block w-full py-6 text-center text-xs text-red-500 opacity-80 transition hover:opacity-100">
                        加载失败，点击重试
                    </button>
                ) : items.length ? (
                    <div className="space-y-1.5">
                        {items.map((prompt) => (
                            <PromptRow
                                key={prompt.id}
                                prompt={prompt}
                                theme={theme}
                                readOnly={activeTab === "system"}
                                onInsert={(target) => insertPrompt(prompt, target)}
                                onCopy={() => void copyText(prompt.content)}
                                onCopyToMine={() => void copyToMine(prompt)}
                                onEdit={() => openEdit(prompt)}
                                onToggleFavorite={() => void toggleFavorite(prompt)}
                                onRemove={() => void removePrompt(prompt)}
                            />
                        ))}
                        {activeQuery.hasNextPage ? (
                            <button
                                type="button"
                                disabled={activeQuery.isFetchingNextPage}
                                onClick={() => void activeQuery.fetchNextPage()}
                                className="block w-full rounded-md py-2 text-center text-xs opacity-60 transition hover:bg-black/5 hover:opacity-100 disabled:opacity-30 dark:hover:bg-white/5"
                            >
                                {activeQuery.isFetchingNextPage ? "加载中…" : "加载更多"}
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={debouncedKeyword.trim() || category || tag ? "无匹配提示词" : activeTab === "system" ? "暂无已发布系统提示词" : "暂无我的提示词"} className="pt-12" />
                )}
            </div>

            <Modal
                title={editing ? "编辑提示词" : "新建提示词"}
                open={editorOpen}
                onOk={() => void saveEditor()}
                onCancel={() => setEditorOpen(false)}
                okText={editing ? "保存" : "创建"}
                cancelText="取消"
                destroyOnHidden
            >
                <div className="space-y-3 pt-2">
                    <Input placeholder="标题" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
                    <Input placeholder="分类（可选）" value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
                    <Select mode="tags" className="w-full" placeholder="标签（可选，回车添加）" value={form.tags} onChange={(tags) => setForm((prev) => ({ ...prev, tags }))} open={false} suffixIcon={null} />
                    <Input.TextArea rows={6} placeholder="提示词内容（按纯文本保存）" value={form.content} onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))} />
                </div>
            </Modal>
        </div>
    );
});

function PromptRow({
    prompt,
    theme,
    readOnly,
    onInsert,
    onCopy,
    onCopyToMine,
    onEdit,
    onToggleFavorite,
    onRemove,
}: {
    prompt: CloudPrompt;
    theme: CanvasTheme;
    readOnly: boolean;
    onInsert: (target: PromptInsertTarget) => void;
    onCopy: () => void;
    onCopyToMine: () => void;
    onEdit: () => void;
    onToggleFavorite: () => void;
    onRemove: () => void;
}) {
    return (
        <div className="group rounded-lg px-2 py-2 transition hover:bg-black/5 dark:hover:bg-white/5">
            <div className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-md" style={{ background: theme.node.panel }}>
                    <FileText className="size-4 opacity-50" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium leading-snug">{prompt.title}</span>
                        {prompt.scope === "system" && prompt.version !== undefined ? <span className="shrink-0 text-[10px] opacity-40">v{prompt.version}</span> : null}
                        {prompt.isFavorite ? <Heart className="size-3 shrink-0 fill-red-400 text-red-400" /> : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs leading-snug opacity-50">{prompt.content}</div>
                </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-10">
                <Dropdown
                    trigger={["click"]}
                    menu={{ items: INSERT_TARGETS.map((target) => ({ key: target.key, label: target.label })), onClick: ({ key }) => onInsert(key as PromptInsertTarget) }}
                >
                    <button type="button" className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium opacity-70 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10" style={{ color: theme.toolbar.activeText }}>
                        <Plus className="size-3" />
                        插入
                    </button>
                </Dropdown>
                <RowAction label="复制文本" onClick={onCopy} icon={<Copy className="size-3" />} />
                {readOnly ? <RowAction label="复制到我的提示词" onClick={onCopyToMine} icon={<CopyPlus className="size-3" />} /> : null}
                {!readOnly ? (
                    <>
                        <RowAction label={prompt.isFavorite ? "取消收藏" : "收藏"} onClick={onToggleFavorite} icon={<Heart className="size-3" />} />
                        <RowAction label="编辑" onClick={onEdit} icon={<Pencil className="size-3" />} />
                        <Popconfirm title={`删除「${prompt.title}」？`} okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={onRemove}>
                            <button type="button" className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-red-500 opacity-70 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10">
                                <Trash2 className="size-3" />
                                删除
                            </button>
                        </Popconfirm>
                    </>
                ) : null}
            </div>
            {prompt.category || prompt.tags.length ? (
                <div className="mt-1 flex flex-wrap gap-1 pl-10 text-[10px] opacity-40">
                    {prompt.category ? <span>{prompt.category}</span> : null}
                    {prompt.tags.map((item) => (
                        <span key={item}>#{item}</span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function RowAction({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
    return (
        <button type="button" onClick={onClick} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium opacity-70 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10">
            {icon}
            {label}
        </button>
    );
}

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { App, Button, Empty, Input, Progress, Select, Spin } from "antd";
import { ImagePlus, Send, X } from "lucide-react";

import { getCanvasAssistantStore, getModelsApi, refreshSessionUser } from "@/integrations/hajimi/browser-client";
import type { AssistantReferenceImage, CanvasAssistantMessage, CanvasAssistantMode, EcommerceSuiteConfig } from "@/integrations/hajimi/canvas-assistant-api";
import type { CanvasTheme } from "@/lib/canvas-theme";

// 哈吉米画布助手面板（Task 10）：替换上游本地 Codex Agent 面板。
// 三个模式共享面板外壳，但消息、草稿、参考图、sessionId、生成中状态、taskId
// 全部由 canvas-assistant-api 的按模式容器隔离；异步结果写回任务创建时的原模式。
// 计费边界：面板不预估、不扣余额；任务终态后调用 refreshSessionUser() 以服务端为准。

const MODE_TABS: { value: CanvasAssistantMode; label: string }[] = [
    { value: "dialog", label: "对话" },
    { value: "quick", label: "快速生图" },
    { value: "ecommerce-suite", label: "电商套图" },
];

const RATIO_OPTIONS = ["auto", "1:1", "3:4", "4:3", "9:16", "16:9"].map((value) => ({ label: value, value }));
const QUALITY_OPTIONS = ["1K", "2K", "4K"].map((value) => ({ label: value, value }));
const COUNT_OPTIONS = [1, 2, 3, 4].map((value) => ({ label: `${value} 张`, value }));

function readFileAsReference(file: File): Promise<AssistantReferenceImage> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type || "image/png", dataUrl: String(reader.result) });
        reader.onerror = () => reject(new Error("图片读取失败"));
        reader.readAsDataURL(file);
    });
}

async function readFiles(files: FileList | File[] | null): Promise<AssistantReferenceImage[]> {
    const images = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    return Promise.all(images.map(readFileAsReference));
}

export function HjmCanvasAssistantPanel({ theme }: { theme: CanvasTheme }) {
    const store = getCanvasAssistantStore();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const mode = snapshot.visibleMode;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center gap-4 border-b px-4 pb-2 pt-1" style={{ borderColor: theme.node.stroke }}>
                {MODE_TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={mode === tab.value}
                        onClick={() => store.setVisibleMode(tab.value)}
                        className="text-sm transition-opacity"
                        style={{ color: theme.node.text, fontWeight: mode === tab.value ? 600 : 400, opacity: mode === tab.value ? 1 : 0.5 }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            {mode === "dialog" ? <DialogView theme={theme} /> : null}
            {mode === "quick" ? <QuickView theme={theme} /> : null}
            {mode === "ecommerce-suite" ? <EcommerceSuiteView theme={theme} /> : null}
        </div>
    );
}

/* ---------------------------------- 对话 ---------------------------------- */

function DialogView({ theme }: { theme: CanvasTheme }) {
    const { message } = App.useApp();
    const store = getCanvasAssistantStore();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const state = snapshot.modes.dialog;
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (sending) return;
        setSending(true);
        try {
            await store.sendDialogMessage();
            // 任务终态后刷新用户资料（余额事实源在服务端，前端不自行计算）。
            await refreshSessionUser();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "发送失败，请稍后重试");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <MessageList messages={state.messages} generating={state.generating} stageLabel={state.stageLabel} theme={theme} empty="描述你的生成需求，可附参考图；助手会先分析再生成" />
            <Composer
                draft={state.draft}
                images={state.referenceImages}
                sending={sending || state.generating}
                placeholder="输入生成需求，Enter 发送"
                theme={theme}
                onDraftChange={(draft) => store.updateMode("dialog", { draft })}
                onAddImages={(images) => store.updateMode("dialog", { referenceImages: [...state.referenceImages, ...images].slice(0, 4) })}
                onRemoveImage={(index) => store.updateMode("dialog", { referenceImages: state.referenceImages.filter((_, i) => i !== index) })}
                onSubmit={() => void send()}
            />
        </div>
    );
}

/* --------------------------------- 快速生图 -------------------------------- */

function QuickView({ theme }: { theme: CanvasTheme }) {
    const { message } = App.useApp();
    const store = getCanvasAssistantStore();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const state = snapshot.modes.quick;
    const [modelOptions, setModelOptions] = useState<{ label: string; value: string }[]>([]);
    const [modelKey, setModelKey] = useState("");
    const [ratio, setRatio] = useState("1:1");
    const [quality, setQuality] = useState("1K");
    const [imageCount, setImageCount] = useState(1);
    const [modelsError, setModelsError] = useState("");

    // 模型与线路只从后端读取；前端不硬编码模型清单。
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const routes = await getModelsApi().listRoutes("image");
                const route = routes.find((item) => item.isDefault && item.enabled) || routes.find((item) => item.enabled) || routes[0];
                if (!route) throw new Error("暂无可用图片线路");
                const models = (await getModelsApi().listModels(route.id)).filter((item) => item.enabled);
                if (cancelled) return;
                setModelOptions(models.map((item) => ({ label: item.displayName, value: item.modelKey })));
                setModelKey(route.defaultModelKey || models[0]?.modelKey || "");
            } catch (error) {
                if (!cancelled) setModelsError(error instanceof Error ? error.message : "模型加载失败");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const submit = async () => {
        if (state.generating) return;
        try {
            await store.submitQuick({ modelKey, ratio: ratio === "auto" ? undefined : ratio, quality, imageCount });
            // 任务终态后刷新用户资料（余额事实源在服务端，前端不自行计算）。
            await refreshSessionUser();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "提交失败，请稍后重试");
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <MessageList messages={state.messages} generating={state.generating} stageLabel={state.stageLabel} theme={theme} empty="直接输入提示词生图，走持久任务管道，可切走稍后再看" />
            <div className="shrink-0 space-y-2 border-t px-3 pb-3 pt-2" style={{ borderColor: theme.node.stroke }}>
                {modelsError ? (
                    <div className="text-xs text-red-500">{modelsError}</div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                    <Select size="small" className="min-w-40 flex-1" value={modelKey || undefined} placeholder="选择模型" options={modelOptions} onChange={setModelKey} />
                    <Select size="small" className="w-20" value={ratio} options={RATIO_OPTIONS} onChange={setRatio} />
                    <Select size="small" className="w-20" value={quality} options={QUALITY_OPTIONS} onChange={setQuality} />
                    <Select size="small" className="w-20" value={imageCount} options={COUNT_OPTIONS} onChange={setImageCount} />
                </div>
                {state.generating ? <Progress percent={state.progress} size="small" status="active" format={(percent) => `${state.stageLabel || "生成中"} ${percent ?? 0}%`} /> : null}
                <Composer
                    draft={state.draft}
                    images={state.referenceImages}
                    sending={state.generating}
                    placeholder="输入提示词，Enter 提交"
                    theme={theme}
                    submitDisabled={!modelKey}
                    onDraftChange={(draft) => store.updateMode("quick", { draft })}
                    onAddImages={(images) => store.updateMode("quick", { referenceImages: [...state.referenceImages, ...images].slice(0, 4) })}
                    onRemoveImage={(index) => store.updateMode("quick", { referenceImages: state.referenceImages.filter((_, i) => i !== index) })}
                    onSubmit={() => void submit()}
                />
            </div>
        </div>
    );
}

/* --------------------------------- 电商套图 -------------------------------- */

function EcommerceSuiteView({ theme }: { theme: CanvasTheme }) {
    const { message } = App.useApp();
    const store = getCanvasAssistantStore();
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const state = snapshot.modes["ecommerce-suite"];
    const [config, setConfig] = useState<EcommerceSuiteConfig | null>(null);
    const [configError, setConfigError] = useState("");
    const [skillId, setSkillId] = useState("");
    const [busy, setBusy] = useState<"prompts" | "generate" | null>(null);

    // config 读取：skill 列表与默认值全部来自后端。
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const next = await getCanvasAssistantStore().loadEcommerceConfig();
                if (cancelled) return;
                setConfig(next);
                setSkillId(next.defaultSkillId || next.skills[0]?.id || "");
            } catch (error) {
                if (!cancelled) setConfigError(error instanceof Error ? error.message : "套图配置加载失败");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const runPrompts = async () => {
        setBusy("prompts");
        try {
            await store.requestEcommercePrompts({ skillId, ratio: config?.defaults.ratio, quality: config?.defaults.quality, imageCount: config?.defaults.imageCount });
            await refreshSessionUser();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "套图提示词生成失败");
        } finally {
            setBusy(null);
        }
    };

    const runGenerate = async () => {
        setBusy("generate");
        try {
            await store.generateEcommerceSuite({ skillId, ratio: config?.defaults.ratio, quality: config?.defaults.quality, imageCount: config?.defaults.imageCount });
            // 任务终态后刷新用户资料（余额事实源在服务端，前端不自行计算）。
            await refreshSessionUser();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "套图生图失败");
        } finally {
            setBusy(null);
        }
    };

    if (configError) return <PanelError text={configError} onRetry={() => window.location.reload()} />;
    if (!config) {
        return (
            <div className="grid flex-1 place-items-center">
                <Spin size="small" />
            </div>
        );
    }
    if (!config.enabled) return <PanelError text="电商套图暂未启用" />;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                <div>
                    <div className="mb-1 text-xs" style={{ color: theme.node.muted }}>设计师</div>
                    <Select
                        className="w-full"
                        value={skillId || undefined}
                        onChange={setSkillId}
                        options={config.skills.map((skill) => ({ label: `${skill.name} · ${skill.description}`, value: skill.id }))}
                    />
                </div>
                <div>
                    <div className="mb-1 text-xs" style={{ color: theme.node.muted }}>产品图（必选，最多 8 张）</div>
                    <ImagePicker images={state.productImages} theme={theme} onAdd={(images) => store.updateMode("ecommerce-suite", { productImages: [...state.productImages, ...images].slice(0, 8) })} onRemove={(index) => store.updateMode("ecommerce-suite", { productImages: state.productImages.filter((_, i) => i !== index) })} />
                </div>
                <div>
                    <div className="mb-1 text-xs" style={{ color: theme.node.muted }}>参考图（可选，迁移构图与氛围）</div>
                    <ImagePicker images={state.referenceImages} theme={theme} onAdd={(images) => store.updateMode("ecommerce-suite", { referenceImages: [...state.referenceImages, ...images].slice(0, 8) })} onRemove={(index) => store.updateMode("ecommerce-suite", { referenceImages: state.referenceImages.filter((_, i) => i !== index) })} />
                </div>
                <div>
                    <div className="mb-1 text-xs" style={{ color: theme.node.muted }}>产品信息与需求</div>
                    <Input.TextArea rows={3} value={state.draft} placeholder="品牌、卖点、投放平台等" onChange={(event) => store.updateMode("ecommerce-suite", { draft: event.target.value })} />
                </div>
                {state.promptPlans.length ? (
                    <div className="space-y-2">
                        <div className="text-xs" style={{ color: theme.node.muted }}>板块提示词（由设计师 skill 与产品图动态生成）</div>
                        {state.promptPlans.map((plan) => (
                            <div key={plan.sectionKey} className="rounded-lg border p-2.5" style={{ borderColor: theme.node.stroke }}>
                                <div className="text-sm font-medium" style={{ color: theme.node.text }}>{plan.sectionName || plan.title}</div>
                                <div className="mt-1 whitespace-pre-wrap text-xs leading-5" style={{ color: theme.node.muted }}>{plan.prompt}</div>
                            </div>
                        ))}
                    </div>
                ) : null}
                <MessageList messages={state.messages} generating={state.generating} stageLabel={state.stageLabel} theme={theme} compact />
            </div>
            <div className="flex shrink-0 gap-2 border-t px-3 py-2.5" style={{ borderColor: theme.node.stroke }}>
                <Button block disabled={busy !== null || state.generating} loading={busy === "prompts"} onClick={() => void runPrompts()}>
                    {state.promptPlans.length ? "重新生成提示词" : "生成套图提示词"}
                </Button>
                <Button block type="primary" disabled={!state.promptPlans.length || busy !== null || state.generating} loading={busy === "generate"} onClick={() => void runGenerate()}>
                    提交生成套图
                </Button>
            </div>
        </div>
    );
}

/* -------------------------------- 共享子组件 -------------------------------- */

function PanelError({ text, onRetry }: { text: string; onRetry?: () => void }) {
    return (
        <div className="grid flex-1 place-items-center px-6 text-center">
            <div className="space-y-3">
                <p className="text-sm text-red-500">{text}</p>
                {onRetry ? (
                    <Button size="small" onClick={onRetry}>
                        重试
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

function MessageList({ messages, generating, stageLabel, theme, empty, compact }: { messages: CanvasAssistantMessage[]; generating: boolean; stageLabel: string; theme: CanvasTheme; empty?: string; compact?: boolean }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages.length, generating]);
    return (
        <div ref={scrollRef} className={`thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-3 ${compact ? "py-1" : "py-3"}`}>
            {!messages.length && !generating && empty ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} className="pt-10" /> : null}
            {messages.map((item) => (
                <div key={item.id} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                        className="max-w-[88%] rounded-xl px-3 py-2 text-sm leading-6"
                        style={
                            item.role === "user"
                                ? { background: theme.toolbar.activeBg, color: theme.node.text }
                                : item.role === "error"
                                  ? { background: "rgba(220,38,38,.08)", color: "#dc2626" }
                                  : { color: theme.node.text }
                        }
                    >
                        <div className="whitespace-pre-wrap break-words">{item.text}</div>
                        {item.images?.length ? (
                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                                {item.images.map((image, index) => (
                                    <img key={`${image.assetId || image.url}-${index}`} src={image.accessUrl || image.url} alt="" className="w-full rounded-lg object-cover" />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            ))}
            {generating ? (
                <div className="text-xs" style={{ color: theme.node.muted }}>
                    {stageLabel || "处理中"}…
                </div>
            ) : null}
        </div>
    );
}

function Composer({
    draft,
    images,
    sending,
    placeholder,
    theme,
    submitDisabled,
    onDraftChange,
    onAddImages,
    onRemoveImage,
    onSubmit,
}: {
    draft: string;
    images: AssistantReferenceImage[];
    sending: boolean;
    placeholder: string;
    theme: CanvasTheme;
    submitDisabled?: boolean;
    onDraftChange: (value: string) => void;
    onAddImages: (images: AssistantReferenceImage[]) => void;
    onRemoveImage: (index: number) => void;
    onSubmit: () => void;
}) {
    const { message } = App.useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canSubmit = !sending && !submitDisabled && Boolean(draft.trim() || images.length);

    const pickFiles = async (files: FileList | File[] | null) => {
        try {
            const picked = await readFiles(files);
            if (picked.length) onAddImages(picked);
        } catch {
            message.error("图片读取失败");
        }
    };

    return (
        <div className="rounded-2xl border px-3 pb-2 pt-2" style={{ borderColor: theme.node.stroke, background: theme.toolbar.panel }}>
            {images.length ? (
                <div className="thin-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
                    {images.map((image, index) => (
                        <div key={`${image.name}-${index}`} className="group relative size-14 shrink-0 overflow-hidden rounded-xl border" style={{ borderColor: theme.node.stroke }} title={image.name}>
                            <img src={image.dataUrl || image.url} alt={image.name} className="size-full object-cover" />
                            <button
                                type="button"
                                aria-label="移除图片"
                                className="absolute right-1 top-1 grid size-5 place-items-center rounded-full border opacity-0 shadow-sm transition group-hover:opacity-100"
                                style={{ background: theme.toolbar.panel, borderColor: theme.node.stroke, color: theme.node.text }}
                                onClick={() => onRemoveImage(index)}
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : null}
            <textarea
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onPaste={(event) => {
                    const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
                    if (!images.length) return;
                    event.preventDefault();
                    void pickFiles(images);
                }}
                onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    if (canSubmit) onSubmit();
                }}
                className="thin-scrollbar max-h-28 min-h-16 w-full resize-none border-0 bg-transparent px-1 py-1 text-sm leading-5 outline-none placeholder:opacity-45"
                style={{ color: theme.node.text }}
                placeholder={placeholder}
            />
            <div className="mt-1 flex items-center justify-between">
                <input
                    ref={fileInputRef}
                    hidden
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                        void pickFiles(event.target.files);
                        event.target.value = "";
                    }}
                />
                <Button type="text" shape="circle" className="!h-9 !w-9 !min-w-9" disabled={sending} style={{ color: theme.node.muted }} icon={<ImagePlus className="size-4" />} onClick={() => fileInputRef.current?.click()} aria-label="上传图片" />
                <Button type="primary" shape="circle" className="!h-10 !w-10 !min-w-10" disabled={!canSubmit} loading={sending} icon={sending ? undefined : <Send className="size-4" />} onClick={onSubmit} aria-label="发送" />
            </div>
        </div>
    );
}

function ImagePicker({ images, theme, onAdd, onRemove }: { images: AssistantReferenceImage[]; theme: CanvasTheme; onAdd: (images: AssistantReferenceImage[]) => void; onRemove: (index: number) => void }) {
    const { message } = App.useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    return (
        <div className="flex flex-wrap gap-2">
            {images.map((image, index) => (
                <div key={`${image.name}-${index}`} className="group relative size-16 overflow-hidden rounded-xl border" style={{ borderColor: theme.node.stroke }} title={image.name}>
                    <img src={image.dataUrl || image.url} alt={image.name} className="size-full object-cover" />
                    <button
                        type="button"
                        aria-label="移除图片"
                        className="absolute right-1 top-1 grid size-5 place-items-center rounded-full border opacity-0 shadow-sm transition group-hover:opacity-100"
                        style={{ background: theme.toolbar.panel, borderColor: theme.node.stroke, color: theme.node.text }}
                        onClick={() => onRemove(index)}
                    >
                        <X className="size-3" />
                    </button>
                </div>
            ))}
            <button
                type="button"
                className="grid size-16 place-items-center rounded-xl border border-dashed transition hover:opacity-80"
                style={{ borderColor: theme.node.stroke, color: theme.node.muted }}
                onClick={() => fileInputRef.current?.click()}
                aria-label="添加图片"
            >
                <ImagePlus className="size-4" />
            </button>
            <input
                ref={fileInputRef}
                hidden
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                    void readFiles(event.target.files)
                        .then((picked) => picked.length && onAdd(picked))
                        .catch(() => message.error("图片读取失败"));
                    event.target.value = "";
                }}
            />
        </div>
    );
}

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { App, Button, Empty } from "antd";
import { ImagePlus, Send, X } from "lucide-react";

import { getCanvasAssistantStore, refreshSessionUser } from "@/integrations/hajimi/browser-client";
import type { AssistantReferenceImage, CanvasAssistantMessage } from "@/integrations/hajimi/canvas-assistant-api";
import type { CanvasTheme } from "@/lib/canvas-theme";
import { HjmCanvasAgentView } from "./hjm-canvas-agent-view";

// 画布 Agent 助手面板：主视图为 Agent，「对话」为辅助模式，由底部控制条切换。
// 快速生图与电商套图已从前端移除（后端接口与存储保留，后续统一由技能承载）。
// 计费边界：面板不预估、不扣余额；任务终态后调用 refreshSessionUser() 以服务端为准。

type AssistantPanelMode = "agent" | "dialog";

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
    const [mode, setMode] = useState<AssistantPanelMode>("agent");

    const switchMode = (next: AssistantPanelMode) => {
        setMode(next);
        if (next !== "agent") store.setVisibleMode(next);
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            {mode === "agent" ? <HjmCanvasAgentView theme={theme} onOpenDialog={() => switchMode("dialog")} /> : null}
            {mode === "dialog" ? <DialogView theme={theme} onOpenAgent={() => switchMode("agent")} /> : null}
        </div>
    );
}

/* ---------------------------------- 对话 ---------------------------------- */

function DialogView({ theme, onOpenAgent }: { theme: CanvasTheme; onOpenAgent: () => void }) {
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
            <div className="shrink-0 px-3 pb-3 pt-2">
                <button
                    type="button"
                    onClick={onOpenAgent}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-xs transition hover:opacity-80"
                    style={{ borderColor: theme.node.stroke, color: theme.node.muted }}
                >
                    返回 Agent
                </button>
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

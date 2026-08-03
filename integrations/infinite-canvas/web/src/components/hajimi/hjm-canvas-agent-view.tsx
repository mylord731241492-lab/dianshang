import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { App, Button, Empty, Input, Popover, Spin, Tag, Tooltip } from "antd";
import { Check, ChevronUp, ImagePlus, ListTree, MessageCircle, MessagesSquare, Plus, Send, Sparkles, Square, Trash2, X } from "lucide-react";

import { getAssetsApi, getCanvasAgentApi } from "@/integrations/hajimi/browser-client";
import type {
    CanvasAgentAttachment,
    CanvasAgentBundle,
    CanvasAgentEvent,
    CanvasAgentScope,
    CanvasAgentSession,
    CanvasAgentSkill,
    CanvasAgentToolCall,
} from "@/integrations/hajimi/canvas-agent-api";
import type { CanvasAgentOp } from "@/lib/canvas/canvas-agent-ops";
import { CanvasNodeType } from "@/types/canvas";
import { labelResourceNodes } from "@/lib/canvas/canvas-resource-references";
import { CanvasResourceMentionTextarea } from "@/components/canvas/canvas-resource-mention-textarea";
import type { CanvasTheme } from "@/lib/canvas-theme";
import { useAgentStore } from "@/stores/use-agent-store";

const BROWSER_SESSION_KEY = "hjm-canvas-agent-browser-session-v1";
const ACTIVE_SESSION_KEY_PREFIX = "hjm-canvas-agent-active-session:";

function randomBrowserSessionId() {
    const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    return `browser_${uuid}`;
}

function browserSessionId() {
    const stored = window.sessionStorage.getItem(BROWSER_SESSION_KEY);
    if (stored) return stored;
    const created = randomBrowserSessionId();
    window.sessionStorage.setItem(BROWSER_SESSION_KEY, created);
    return created;
}

function eventText(event: CanvasAgentEvent): string {
    if (event.type === "user_message" || event.type === "assistant_message") return String(event.payload.text || "");
    if (event.type === "turn_error") return String(event.payload.message || "Agent 处理失败");
    if (event.type === "turn_stopped") return "已停止本轮请求";
    return "";
}

function eventRole(event: CanvasAgentEvent) {
    if (event.type === "user_message") return "user";
    if (event.type === "assistant_message") return "assistant";
    return "system";
}

function statusLabel(status: CanvasAgentSession["status"]) {
    if (status === "running") return "处理中";
    if (status === "waiting_confirmation") return "等待确认";
    if (status === "waiting_result") return "执行中";
    if (status === "stopped") return "已停止";
    if (status === "interrupted") return "已中断";
    if (status === "error") return "异常";
    return "就绪";
}

function statusColor(status: CanvasAgentSession["status"]) {
    if (status === "running" || status === "waiting_result") return "processing";
    if (status === "waiting_confirmation") return "warning";
    if (status === "error") return "error";
    if (status === "stopped" || status === "interrupted") return "default";
    return "success";
}

export function HjmCanvasAgentView({ theme, onOpenDialog }: { theme: CanvasTheme; onOpenDialog?: () => void }) {
    const { message, modal } = App.useApp();
    const api = getCanvasAgentApi();
    const canvasContext = useAgentStore((state) => state.canvasContext);
    const projectId = canvasContext?.snapshot.projectId || "";

    const scope = useMemo<CanvasAgentScope | null>(
        () => projectId ? { projectId, browserSessionId: browserSessionId() } : null,
        [projectId],
    );
    const [sessions, setSessions] = useState<CanvasAgentSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState("");
    const [bundle, setBundle] = useState<CanvasAgentBundle | null>(null);
    const [draft, setDraft] = useState("");
    const [attachments, setAttachments] = useState<CanvasAgentAttachment[]>([]);
    const [assetPreviewUrls, setAssetPreviewUrls] = useState<Record<string, string>>({});
    const attachmentsRef = useRef<CanvasAgentAttachment[]>([]);
    useEffect(() => {
        attachmentsRef.current = attachments;
    }, [attachments]);
    // @ 引用：优先 Agent 面板内的附件图（粘贴/拖拽上传，不要求画布有节点），其后才是画布节点。
    // 附件与画布图片节点统一按 图片N 接续编号，文本节点按 文本N 编号。
    // 无框选时 @ 列出全部资源节点；框选后只列选中的节点。附件不受框选影响。
    const selectedNodeIds = canvasContext?.snapshot.selectedNodeIds || [];
    const mentionReferences = useMemo(() => {
        const refs: { id: string; nodeId: string; kind: "image" | "video" | "audio" | "text"; label: string; title: string; previewUrl?: string; active: boolean }[] = [];
        let imageIndex = 0;
        attachments.forEach((item) => {
            imageIndex += 1;
            refs.push({ id: item.id, nodeId: "", kind: "image", label: `图片${imageIndex}`, title: item.name, previewUrl: item.accessUrl, active: true });
        });
        const selectedSet = new Set(selectedNodeIds);
        const allNodes = canvasContext?.snapshot.nodes || [];
        const candidateNodes = selectedNodeIds.length ? allNodes.filter((node) => selectedSet.has(node.id)) : allNodes;
        labelResourceNodes(candidateNodes, true).forEach((ref) => {
            if (ref.kind === "image") imageIndex += 1;
            const storageKey = String(candidateNodes.find((node) => node.id === ref.nodeId)?.metadata?.storageKey || "");
            const freshUrl = storageKey.startsWith("asset:") ? assetPreviewUrls[storageKey.slice(6)] : "";
            refs.push({ ...ref, label: ref.kind === "image" ? `图片${imageIndex}` : ref.label, previewUrl: freshUrl || ref.previewUrl });
        });
        return refs;
    }, [attachments, canvasContext?.snapshot.nodes, selectedNodeIds, assetPreviewUrls]);
    const selectedImageCount = useMemo(
        () => (canvasContext?.snapshot.nodes || []).filter((node) => selectedNodeIds.includes(node.id) && node.type === CanvasNodeType.Image).length,
        [canvasContext?.snapshot.nodes, selectedNodeIds],
    );
    const canvasImageCount = useMemo(
        () => (canvasContext?.snapshot.nodes || []).filter((node) => node.type === CanvasNodeType.Image).length,
        [canvasContext?.snapshot.nodes],
    );
    const mentionLabelPreviews = useMemo(() => {
        const map: Record<string, string> = {};
        mentionReferences.forEach((ref) => {
            if (ref.previewUrl && String(ref.previewUrl).startsWith("/")) map[ref.label] = String(ref.previewUrl);
        });
        return map;
    }, [mentionReferences]);
    const mentionMenuHint = selectedImageCount
        ? `已选中 ${selectedImageCount} 个图片节点`
        : canvasImageCount
          ? `共 ${canvasImageCount} 个图片节点，框选后可缩小范围`
          : "可粘贴/拖入图片，或先在画布添加图片节点";
    // @ 引用：优先 Agent 面板内的附件图（粘贴/拖拽上传，不要求画布有节点），其后才是画布节点。
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [busyCallIds, setBusyCallIds] = useState<Set<string>>(new Set());
    const [skills, setSkills] = useState<CanvasAgentSkill[]>([]);
    const [skillsSaving, setSkillsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const refreshSessions = useCallback(async () => {
        if (!scope) return [];
        const next = await api.listSessions(scope);
        setSessions(next);
        return next;
    }, [api, scope]);

    const refreshBundle = useCallback(async (sessionId = activeSessionId) => {
        if (!scope || !sessionId) return null;
        const next = await api.getSession(scope, sessionId);
        setBundle(next);
        return next;
    }, [activeSessionId, api, scope]);

    const ensureSession = useCallback(async () => {
        if (!scope) return;
        setLoading(true);
        try {
            const available = await refreshSessions();
            const savedId = window.sessionStorage.getItem(`${ACTIVE_SESSION_KEY_PREFIX}${scope.projectId}`) || "";
            let selected = available.find((item) => item.id === savedId) || available[0];
            if (!selected) {
                selected = await api.createSession(scope);
                setSessions([selected]);
            }
            setActiveSessionId(selected.id);
            window.sessionStorage.setItem(`${ACTIVE_SESSION_KEY_PREFIX}${scope.projectId}`, selected.id);
            setBundle(await api.getSession(scope, selected.id));
        } catch (error) {
            message.error(error instanceof Error ? error.message : "Agent 会话加载失败");
        } finally {
            setLoading(false);
        }
    }, [api, message, refreshSessions, scope]);

    useEffect(() => {
        void ensureSession();
    }, [ensureSession]);

    // 画布 asset: 节点的预览地址同样 15 分钟过期：随节点变化与每 10 分钟重签。
    useEffect(() => {
        const nodes = canvasContext?.snapshot.nodes || [];
        const assetIds = [...new Set(nodes.flatMap((node) => {
            const key = String(node.metadata?.storageKey || "");
            return key.startsWith("asset:") ? [key.slice(6)] : [];
        }))];
        if (!assetIds.length) return;
        let cancelled = false;
        const refresh = async () => {
            const entries = await Promise.all(assetIds.map(async (id) => {
                try {
                    const access = await getAssetsApi().getAccessUrl(id);
                    return access.url ? [id, access.url] : null;
                } catch {
                    return null;
                }
            }));
            if (cancelled) return;
            setAssetPreviewUrls((current) => {
                const next = { ...current };
                entries.forEach((entry) => {
                    if (entry) next[entry[0]] = entry[1];
                });
                return next;
            });
        };
        void refresh();
        const timer = window.setInterval(() => void refresh(), 10 * 60 * 1000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [canvasContext?.snapshot.nodes]);

    // 附件 accessUrl 为 15 分钟短时签名：面板打开时与每 10 分钟续签，避免缩略图过期 403。
    useEffect(() => {
        const refresh = async () => {
            const current = attachmentsRef.current;
            if (!current.length) return;
            const refreshed = await Promise.all(current.map(async (item) => {
                try {
                    const access = await getAssetsApi().getAccessUrl(item.assetId);
                    return access.url && access.url !== item.accessUrl ? { ...item, accessUrl: access.url } : item;
                } catch {
                    return item;
                }
            }));
            if (refreshed.some((item, index) => item.accessUrl !== current[index].accessUrl)) setAttachments(refreshed);
        };
        void refresh();
        const timer = window.setInterval(() => void refresh(), 10 * 60 * 1000);
        return () => window.clearInterval(timer);
    }, []);

    // 管理员维护的启用技能列表；没有配置技能时选择器整体隐藏。
    useEffect(() => {
        api.listAgentSkills()
            .then((items) => setSkills(items.filter((item) => item.enabled)))
            .catch(() => setSkills([]));
    }, [api]);

    const changeSkills = async (skillIds: string[]) => {
        if (!scope || !activeSessionId || skillsSaving) return;
        setSkillsSaving(true);
        try {
            const session = await api.updateSessionSkills(scope, activeSessionId, skillIds);
            setBundle((current) => (current ? { ...current, session } : current));
        } catch (error) {
            message.error(error instanceof Error ? error.message : "技能设置失败");
        } finally {
            setSkillsSaving(false);
        }
    };

    useEffect(() => {
        if (!scope || !activeSessionId) return;
        const after = Math.max(0, ...(bundle?.events.map((event) => event.id) || [0]));
        const close = api.streamEvents(scope, activeSessionId, {
            after,
            onEvent: () => {
                if (refreshTimerRef.current) return;
                refreshTimerRef.current = setTimeout(() => {
                    refreshTimerRef.current = null;
                    void Promise.all([refreshBundle(activeSessionId), refreshSessions()]);
                }, 80);
            },
            onError: (error) => {
                if (error instanceof Error && error.message) console.warn("[CANVAS_AGENT_SSE]", error.message);
            },
        });
        return () => {
            close();
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
        };
    }, [activeSessionId, api, bundle?.events.length, refreshBundle, refreshSessions, scope]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ block: "end" });
    }, [bundle?.events.length, bundle?.toolCalls.length]);

    const switchSession = async (sessionId: string) => {
        if (!scope || sessionId === activeSessionId) return;
        setActiveSessionId(sessionId);
        window.sessionStorage.setItem(`${ACTIVE_SESSION_KEY_PREFIX}${scope.projectId}`, sessionId);
        setBundle(await api.getSession(scope, sessionId));
    };

    const createSession = async () => {
        if (!scope) return;
        try {
            const created = await api.createSession(scope);
            setSessions((current) => [created, ...current]);
            setActiveSessionId(created.id);
            window.sessionStorage.setItem(`${ACTIVE_SESSION_KEY_PREFIX}${scope.projectId}`, created.id);
            setBundle(await api.getSession(scope, created.id));
        } catch (error) {
            message.error(error instanceof Error ? error.message : "新建会话失败");
        }
    };

    const removeSession = () => {
        if (!scope || !activeSessionId) return;
        modal.confirm({
            title: "删除当前 Agent 会话？",
            content: "对话、工具提案和诊断记录会一并从会话列表移除，画布已执行的修改不会撤销。",
            okText: "删除",
            okButtonProps: { danger: true },
            cancelText: "取消",
            onOk: async () => {
                await api.deleteSession(scope, activeSessionId);
                setBundle(null);
                setActiveSessionId("");
                await ensureSession();
            },
        });
    };

    const send = async () => {
        if (!scope || !activeSessionId || !canvasContext || sending) return;
        const text = draft.trim();
        if (!text && !attachments.length) return;
        setSending(true);
        setDraft("");
        try {
            const mentions = mentionReferences
                .filter((ref) => new RegExp(`${ref.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![0-9])`).test(text))
                .map((ref) => {
                    const attachment = ref.nodeId ? null : attachments.find((item) => item.id === ref.id);
                    return {
                        label: ref.label,
                        nodeId: ref.nodeId || undefined,
                        attachmentId: attachment?.assetId,
                        accessUrl: attachment?.accessUrl,
                        title: ref.title,
                        kind: ref.kind,
                    };
                });
            const next = await api.sendMessage(scope, activeSessionId, {
                text,
                snapshot: canvasContext.snapshot as unknown as Record<string, unknown>,
                attachments,
                mentions,
            });
            setBundle(next);
            setAttachments([]);
            await refreshSessions();
        } catch (error) {
            setDraft(text);
            message.error(error instanceof Error ? error.message : "Agent 发送失败");
        } finally {
            setSending(false);
        }
    };

    const stop = async () => {
        if (!scope || !activeSessionId) return;
        try {
            await api.stopSession(scope, activeSessionId);
            await refreshBundle();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "停止失败");
        }
    };

    const withBusyCall = async (callId: string, action: () => Promise<void>) => {
        if (busyCallIds.has(callId)) return;
        setBusyCallIds((current) => new Set(current).add(callId));
        try {
            await action();
        } finally {
            setBusyCallIds((current) => {
                const next = new Set(current);
                next.delete(callId);
                return next;
            });
        }
    };

    const approve = (toolCall: CanvasAgentToolCall) => withBusyCall(toolCall.id, async () => {
        if (!scope || !activeSessionId) return;
        const confirmed = await api.confirmToolCall(scope, activeSessionId, toolCall.id);
        if (confirmed.execute && !confirmed.replayed && confirmed.execution) {
            try {
                if (confirmed.execution.kind === "canvas_ops") {
                    if (!canvasContext) throw new Error("当前画布尚未连接");
                    const next = canvasContext.applyOps(confirmed.execution.ops as CanvasAgentOp[]);
                    await api.reportToolResult(scope, activeSessionId, toolCall.id, {
                        result: {
                            ok: true,
                            nodeCount: next.nodes.length,
                            connectionCount: next.connections.length,
                            selectedNodeIds: next.selectedNodeIds,
                        },
                    });
                } else if (confirmed.execution.kind === "navigate") {
                    await api.reportToolResult(scope, activeSessionId, toolCall.id, {
                        result: { ok: true, path: confirmed.execution.path },
                    });
                    window.location.assign(confirmed.execution.path);
                    return;
                }
            } catch (error) {
                await api.reportToolResult(scope, activeSessionId, toolCall.id, {
                    error: error instanceof Error ? error.message : "画布操作失败",
                });
                throw error;
            }
        }
        await Promise.all([refreshBundle(), refreshSessions()]);
    }).catch((error) => message.error(error instanceof Error ? error.message : "工具执行失败"));

    const reject = (toolCall: CanvasAgentToolCall) => withBusyCall(toolCall.id, async () => {
        if (!scope || !activeSessionId) return;
        await api.rejectToolCall(scope, activeSessionId, toolCall.id, "用户在画布中拒绝执行");
        await Promise.all([refreshBundle(), refreshSessions()]);
    }).catch((error) => message.error(error instanceof Error ? error.message : "拒绝失败"));

    const uploadFiles = async (files: FileList | File[] | null) => {
        const images = Array.from(files || []).filter((file) => file.type.startsWith("image/")).slice(0, Math.max(0, 4 - attachments.length));
        if (!images.length) return;
        setUploading(true);
        try {
            const uploaded = await Promise.all(images.map((file) => getAssetsApi().upload(file, { name: file.name })));
            setAttachments((current) => [
                ...current,
                ...uploaded.map((asset) => ({
                    id: `attachment_${asset.id}`,
                    assetId: asset.id,
                    name: asset.name,
                    type: asset.mimeType,
                    width: asset.width || undefined,
                    height: asset.height || undefined,
                    accessUrl: asset.accessUrl,
                })),
            ].slice(0, 4));
        } catch (error) {
            message.error(error instanceof Error ? error.message : "参考图上传失败");
        } finally {
            setUploading(false);
        }
    };

    if (!projectId || !canvasContext) {
        return <div className="grid flex-1 place-items-center text-sm" style={{ color: theme.node.muted }}>等待画布连接…</div>;
    }
    if (loading) {
        return <div className="grid flex-1 place-items-center"><Spin size="small" /></div>;
    }

    const visibleEvents = (bundle?.events || []).filter((event) => Boolean(eventText(event)));
    const pendingCalls = (bundle?.toolCalls || []).filter((toolCall) => toolCall.status === "pending");
    const session = bundle?.session;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2" style={{ borderColor: theme.node.stroke }}>
                {session ? <Tag color={statusColor(session.status)} className="!mr-1">{statusLabel(session.status)}</Tag> : null}
                <span className="min-w-0 flex-1 truncate text-xs" style={{ color: theme.node.muted }}>{session?.title || "新对话"}</span>
                <Tooltip title="日志">
                    <Button
                        size="small"
                        type="text"
                        icon={<ListTree className="size-4" />}
                        style={{ color: showLogs ? theme.node.text : theme.node.muted }}
                        onClick={() => setShowLogs((value) => !value)}
                    />
                </Tooltip>
                <Tooltip title="新对话"><Button size="small" type="text" icon={<Plus className="size-4" />} onClick={() => void createSession()} /></Tooltip>
                <Tooltip title="删除对话"><Button size="small" type="text" danger icon={<Trash2 className="size-4" />} onClick={removeSession} /></Tooltip>
            </div>

            <div className="thin-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
                {!visibleEvents.length && !pendingCalls.length ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={<span style={{ color: theme.node.muted }}>可让 Agent 读取画布、创建/连接/修改节点；写操作会先等你确认</span>}
                    />
                ) : null}
                {visibleEvents.map((event) => {
                    const role = eventRole(event);
                    return (
                        <div key={event.id} className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                                className={`max-w-[88%] whitespace-pre-wrap break-words text-sm leading-6 ${role === "user" ? "rounded-xl rounded-br-sm border px-3 py-2" : role === "system" ? "text-xs" : ""}`}
                                style={{
                                    color: event.type === "turn_error" ? "#dc2626" : (role === "system" ? theme.node.muted : theme.node.text),
                                    borderColor: role === "user" ? theme.node.stroke : "transparent",
                                    background: role === "user" ? `color-mix(in srgb, ${theme.node.text} 6%, ${theme.toolbar.panel})` : "transparent",
                                }}
                            >
                                {eventText(event)}
                                {event.type === "user_message" ? (
                                    <MentionThumbnails event={event} theme={theme} nodes={canvasContext?.snapshot.nodes || []} />
                                ) : null}
                            </div>
                        </div>
                    );
                })}
                {pendingCalls.map((toolCall) => (
                    <div key={toolCall.id} className="rounded-xl border p-3" style={{ borderColor: "rgba(217,119,6,.38)", color: theme.node.text }}>
                        <div className="flex items-start gap-2">
                            <ListTree className="mt-0.5 size-4 shrink-0 text-amber-600" />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold">等待确认</div>
                                <div className="mt-1 text-sm" style={{ color: theme.node.muted }}>{toolCall.summary || toolCall.name}</div>
                                <details className="mt-2 text-xs">
                                    <summary className="cursor-pointer" style={{ color: theme.node.muted }}>查看操作详情</summary>
                                    <pre className="thin-scrollbar mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-2" style={{ borderColor: theme.node.stroke }}>
                                        {JSON.stringify(toolCall.execution, null, 2)}
                                    </pre>
                                </details>
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <Button danger size="small" icon={<X className="size-3.5" />} loading={busyCallIds.has(toolCall.id)} onClick={() => void reject(toolCall)}>拒绝</Button>
                            <Button size="small" type="primary" icon={<Check className="size-3.5" />} loading={busyCallIds.has(toolCall.id)} onClick={() => void approve(toolCall)}>确认执行</Button>
                        </div>
                    </div>
                ))}
                {showLogs ? (
                    <div className="rounded-xl border p-3 text-xs" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                        {(bundle?.events || []).map((event) => (
                            <div key={`log_${event.id}`} className="grid grid-cols-[64px_1fr] gap-2 py-1">
                                <span>#{event.id}</span>
                                <span className="break-all">{event.type}</span>
                            </div>
                        ))}
                    </div>
                ) : null}
                <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t px-3 pt-2.5" style={{ borderColor: theme.node.stroke }}>
                <div className="flex items-stretch overflow-hidden rounded-xl border" style={{ borderColor: theme.node.stroke, background: theme.toolbar.panel }}>
                    <AgentSessionMenu
                        theme={theme}
                        sessions={sessions}
                        activeSessionId={activeSessionId}
                        onSelect={(id) => void switchSession(id)}
                        onCreate={() => void createSession()}
                    />
                    {skills.length ? (
                        <AgentSkillMenu
                            theme={theme}
                            skills={skills}
                            activeIds={session?.skillIds || []}
                            saving={skillsSaving}
                            onChange={(ids) => void changeSkills(ids)}
                        />
                    ) : null}
                    {onOpenDialog ? (
                        <button
                            type="button"
                            onClick={onOpenDialog}
                            className="flex shrink-0 items-center gap-1.5 border-l px-3 text-xs transition hover:opacity-80"
                            style={{ borderColor: theme.node.stroke, color: theme.node.muted }}
                        >
                            <MessageCircle className="size-3.5" />
                            对话
                        </button>
                    ) : null}
                </div>
            </div>

            <div
                className="shrink-0 p-3 transition"
                style={{
                    borderColor: theme.node.stroke,
                    outline: dragActive ? `2px dashed ${theme.toolbar.activeText}` : "none",
                    outlineOffset: -6,
                    borderRadius: dragActive ? 12 : 0,
                    background: dragActive ? "rgba(96,165,250,.08)" : "transparent",
                }}
                onDragOver={(event) => {
                    if (Array.from(event.dataTransfer?.types || []).includes("Files")) {
                        event.preventDefault();
                        setDragActive(true);
                    }
                }}
                onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                    setDragActive(false);
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragActive(false);
                    void uploadFiles(event.dataTransfer?.files || null);
                }}
            >
                {attachments.length ? (
                    <div className="mb-2 flex gap-2 overflow-x-auto">
                        {attachments.map((item) => (
                            <div key={item.id} className="group relative size-14 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: theme.node.stroke }}>
                                {item.accessUrl ? <img src={item.accessUrl} alt={item.name} className="size-full object-cover" /> : null}
                                <button
                                    type="button"
                                    className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white"
                                    onClick={() => setAttachments((current) => current.filter((attachment) => attachment.id !== item.id))}
                                >
                                    <X className="size-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : null}
                <MentionDraftPreviews draft={draft} references={mentionReferences} previews={mentionLabelPreviews} theme={theme} />
                <CanvasResourceMentionTextarea
                    value={draft}
                    references={mentionReferences}
                    rows={3}
                    className="min-h-16 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: theme.node.stroke, background: theme.node.panel, color: theme.node.text }}
                    placeholder="例如：创建两个文本节点并连接；@ 可引用图片，可粘贴或拖入图片"
                    disabled={sending}
                    onChange={setDraft}
                    onSubmit={() => void send()}
                    menuHint={mentionMenuHint}
                    labelPreviews={mentionLabelPreviews}
                    onPaste={(event) => {
                        const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith("image/"));
                        if (!files.length) return;
                        event.preventDefault();
                        void uploadFiles(files);
                    }}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1">
                        <input
                            ref={fileInputRef}
                            hidden
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(event) => {
                                void uploadFiles(event.target.files);
                                event.target.value = "";
                            }}
                        />
                        <Tooltip title="上传参考图到账号资产库">
                            <Button type="text" size="small" loading={uploading} icon={<ImagePlus className="size-4" />} onClick={() => fileInputRef.current?.click()} />
                        </Tooltip>
                        {canvasContext.snapshot.selectedNodeIds.length ? (
                            <span className="truncate text-xs" style={{ color: theme.node.muted }}>已引用 {canvasContext.snapshot.selectedNodeIds.length} 个选中节点</span>
                        ) : null}
                    </div>
                    {session?.status === "running" ? (
                        <Button danger shape="circle" icon={<Square className="size-4" />} onClick={() => void stop()} aria-label="停止 Agent" />
                    ) : (
                        <Button
                            type="primary"
                            shape="circle"
                            icon={<Send className="size-4" />}
                            disabled={sending || (!draft.trim() && !attachments.length)}
                            loading={sending}
                            onClick={() => void send()}
                            aria-label="发送给 Agent"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

/* ------------------------------ 底部控制条菜单 ------------------------------ */

function menuPanelStyle(theme: CanvasTheme): CSSProperties {
    return {
        background: theme.node.panel,
        border: `1px solid ${theme.node.stroke}`,
        borderRadius: 12,
        boxShadow: "0 12px 32px rgba(0,0,0,.45)",
        padding: 4,
        width: 240,
    };
}

function AgentSessionMenu({
    theme,
    sessions,
    activeSessionId,
    onSelect,
    onCreate,
}: {
    theme: CanvasTheme;
    sessions: CanvasAgentSession[];
    activeSessionId: string;
    onSelect: (sessionId: string) => void;
    onCreate: () => void;
}) {
    const [open, setOpen] = useState(false);
    const active = sessions.find((item) => item.id === activeSessionId);
    const choose = (sessionId: string) => {
        setOpen(false);
        onSelect(sessionId);
    };
    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            trigger="click"
            placement="topLeft"
            arrow={false}
            content={
                <div style={menuPanelStyle(theme)}>
                    <div className="thin-scrollbar max-h-64 overflow-y-auto">
                        {sessions.map((item) => {
                            const isActive = item.id === activeSessionId;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => choose(item.id)}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/5"
                                    style={{ background: isActive ? "rgba(255,255,255,.06)" : "transparent" }}
                                >
                                    <MessagesSquare className="size-3.5 shrink-0" style={{ color: theme.node.muted }} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs" style={{ color: theme.node.text }}>{item.title}</span>
                                        {item.preview ? <span className="block truncate text-[11px]" style={{ color: theme.node.muted }}>{item.preview}</span> : null}
                                    </span>
                                    {item.pendingToolCount ? <Tag color="warning" className="!mr-0 !text-[10px]">{item.pendingToolCount}</Tag> : null}
                                    {isActive ? <Check className="size-3.5 shrink-0" style={{ color: theme.node.text }} /> : null}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onCreate();
                        }}
                        className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed px-2.5 py-2 text-xs transition hover:opacity-80"
                        style={{ borderColor: theme.node.stroke, color: theme.node.muted }}
                    >
                        <Plus className="size-3.5" />
                        新对话
                    </button>
                </div>
            }
        >
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-xs transition hover:opacity-80" style={{ color: theme.node.text }}>
                <MessagesSquare className="size-3.5 shrink-0" style={{ color: theme.node.muted }} />
                <span className="min-w-0 flex-1 truncate">{active?.title || "选择对话"}</span>
                <ChevronUp className="size-3 shrink-0" style={{ color: theme.node.muted }} />
            </button>
        </Popover>
    );
}

function AgentSkillMenu({
    theme,
    skills,
    activeIds,
    saving,
    onChange,
}: {
    theme: CanvasTheme;
    skills: CanvasAgentSkill[];
    activeIds: string[];
    saving: boolean;
    onChange: (skillIds: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const activeNames = skills.filter((item) => activeIds.includes(item.id)).map((item) => item.name);
    const toggle = (skillId: string) => {
        if (activeIds.includes(skillId)) {
            onChange(activeIds.filter((id) => id !== skillId));
            return;
        }
        if (activeIds.length >= 3) return;
        onChange([...activeIds, skillId]);
    };
    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            trigger="click"
            placement="top"
            arrow={false}
            content={
                <div style={menuPanelStyle(theme)}>
                    {skills.map((item) => {
                        const isActive = activeIds.includes(item.id);
                        const disabled = !isActive && activeIds.length >= 3;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                disabled={disabled || saving}
                                onClick={() => toggle(item.id)}
                                className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/5 disabled:opacity-40"
                                style={{ background: isActive ? "rgba(255,255,255,.06)" : "transparent" }}
                            >
                                <span
                                    className="mt-0.5 grid size-4 shrink-0 place-items-center rounded border"
                                    style={{ borderColor: isActive ? theme.node.text : theme.node.stroke, color: theme.node.text }}
                                >
                                    {isActive ? <Check className="size-3" /> : null}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-xs" style={{ color: theme.node.text }}>{item.name}</span>
                                    {item.description ? <span className="block text-[11px] leading-4" style={{ color: theme.node.muted }}>{item.description}</span> : null}
                                </span>
                            </button>
                        );
                    })}
                    <div className="px-2.5 pb-1.5 pt-1 text-[10px]" style={{ color: theme.node.muted }}>技能由管理员维护，最多同时启用 3 个</div>
                </div>
            }
        >
            <button
                type="button"
                className="flex shrink-0 items-center gap-1.5 border-l px-3 text-xs transition hover:opacity-80"
                style={{ borderColor: theme.node.stroke, color: activeNames.length ? theme.node.text : theme.node.muted }}
            >
                <Sparkles className="size-3.5" />
                <span className="max-w-28 truncate">{activeNames.length ? activeNames.join("、") : "技能"}</span>
                <ChevronUp className="size-3 shrink-0" style={{ color: theme.node.muted }} />
            </button>
        </Popover>
    );
}

// 消息里的引用缩略图：附件用 accessUrl，画布节点用当前快照中的 content。
// 事件里的签名 URL 可能过期，按 attachmentId 重新签发（模块级缓存 12 分钟）。
const mentionUrlCache = new Map<string, { url: string; at: number }>();
async function resolveMentionUrl(mention: { accessUrl?: string; attachmentId?: string }): Promise<string> {
    const fresh = mention.accessUrl || "";
    if (!mention.attachmentId) return fresh;
    const cached = mentionUrlCache.get(mention.attachmentId);
    if (cached && Date.now() - cached.at < 12 * 60 * 1000) return cached.url;
    try {
        const access = await getAssetsApi().getAccessUrl(mention.attachmentId);
        if (access.url) mentionUrlCache.set(mention.attachmentId, { url: access.url, at: Date.now() });
        return access.url || fresh;
    } catch {
        return fresh;
    }
}

function MentionThumbnails({ event, theme, nodes }: { event: CanvasAgentEvent; theme: CanvasTheme; nodes: { id: string; metadata?: { content?: string } }[] }) {
    const mentions = Array.isArray(event.payload.mentions) ? (event.payload.mentions as { label?: string; accessUrl?: string; nodeId?: string; attachmentId?: string; title?: string }[]) : [];
    const [resolved, setResolved] = useState<{ key: string; url: string; label: string; title: string }[]>([]);
    useEffect(() => {
        let cancelled = false;
        void Promise.all(mentions.flatMap(async (mention) => {
            const node = mention.nodeId ? nodes.find((item) => item.id === mention.nodeId) : null;
            const nodeUrl = node?.metadata?.content && String(node.metadata.content).startsWith("/") ? String(node.metadata.content) : "";
            const url = nodeUrl || (await resolveMentionUrl(mention));
            return url ? [{ key: `${mention.label}-${mention.nodeId || mention.attachmentId}`, url, label: mention.label || "", title: mention.title || "" }] : [];
        })).then((items) => {
            if (!cancelled) setResolved(items.flat());
        });
        return () => {
            cancelled = true;
        };
    }, [event.id]);
    if (!mentions.length) return null;
    const items = resolved;
    return (
        <div className="mt-2 flex flex-wrap gap-1.5">
            {items.map((item) => (
                <span key={item.key} className="flex items-center gap-1.5 rounded-lg border p-1 pr-2" style={{ borderColor: theme.node.stroke }} title={item.title}>
                    <img src={item.url} alt={item.title} className="size-9 rounded-md object-cover" />
                    <span className="text-[11px]" style={{ color: theme.node.muted }}>{item.label}</span>
                </span>
            ))}
        </div>
    );
}

// 草稿中已引用的图片预览条：不占文本流，避免叠加层与文本宽度不一致导致的光标偏移。
function MentionDraftPreviews({ draft, references, previews, theme }: { draft: string; references: { label: string; title: string }[]; previews: Record<string, string>; theme: CanvasTheme }) {
    const items = references.filter((ref) => new RegExp(`${ref.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![0-9])`).test(draft) && previews[ref.label]);
    if (!items.length) return null;
    return (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
            {items.map((ref) => (
                <span key={ref.label} className="flex items-center gap-1.5 rounded-lg border p-1 pr-2" style={{ borderColor: theme.node.stroke }} title={ref.title}>
                    <img src={previews[ref.label]} alt={ref.title} className="size-8 rounded-md object-cover" />
                    <span className="text-[11px]" style={{ color: theme.node.muted }}>{ref.label}</span>
                </span>
            ))}
        </div>
    );
}

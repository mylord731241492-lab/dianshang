import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent as ReactChangeEvent, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Group, Video } from "lucide-react";
import { saveAs } from "file-saver";

import { useEffectiveConfig } from "@/stores/use-config-store";
import { adoptCloudAssetImage, imageToDataUrl, uploadImage, type UploadedImage } from "@/services/image-storage";
import { uploadMediaFile } from "@/services/file-storage";
import { nanoid } from "nanoid";
import { getDataUrlByteSize, readImageMeta } from "@/lib/image-utils";
import { canvasThemes, type CanvasBackgroundMode } from "@/lib/canvas-theme";
import { useAssetStore } from "@/stores/use-asset-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { cropDataUrl, splitDataUrl, upscaleDataUrl } from "@/lib/canvas/canvas-image-data";
import { fitNodeSize, nodeSizeFromRatio } from "@/lib/canvas/canvas-node-size";
import { App, Button, Input, Modal, Select } from "antd";
import { NODE_DEFAULT_SIZE, getNodeSpec } from "@/constant/canvas";
import { ActiveConnectionPath, ConnectionPath } from "@/components/canvas/canvas-connections";
import { CanvasConfigGenerationPanel, CanvasConfigNodePanel } from "@/components/canvas/canvas-config-node-panel";
import { CanvasNodeContextMenu } from "@/components/canvas/canvas-context-menu";
import { CanvasNodeAngleDialog, type CanvasImageAngleParams } from "@/components/canvas/canvas-node-angle-dialog";
import { CanvasNodeCropDialog, type CanvasImageCropRect } from "@/components/canvas/canvas-node-crop-dialog";
import { CanvasNodeMaskEditDialog, type CanvasImageMaskEditPayload } from "@/components/canvas/canvas-node-mask-edit-dialog";
import { CanvasNodeSplitDialog, type CanvasImageSplitParams } from "@/components/canvas/canvas-node-split-dialog";
import { CanvasNodeUpscaleDialog, type CanvasImageUpscaleParams } from "@/components/canvas/canvas-node-upscale-dialog";
import { buildNodeGenerationContext, buildNodeGenerationInputs, hydrateNodeGenerationContext, normalizeNodeModelKey, submitNodeImageGeneration, taskStateFromGenerationTask, waitNodeImageGeneration, type NodeGenerationInput } from "@/components/canvas/canvas-node-generation";
import { CanvasNodeHoverToolbar, CanvasNodeInfoModal } from "@/components/canvas/canvas-node-hover-toolbar";
import { InfiniteCanvas } from "@/components/canvas/infinite-canvas";
import { Minimap } from "@/components/canvas/canvas-mini-map";
import { CanvasNode } from "@/components/canvas/canvas-node";
import { CanvasNodePromptPanel, type CanvasNodeGenerationMode } from "@/components/canvas/canvas-node-prompt-panel";
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import { AssetPickerModal, type InsertAssetPayload } from "@/components/canvas/asset-picker-modal";
import { CanvasUserCenterModal } from "@/components/canvas/canvas-user-center-modal";
import { CanvasProjectsModal } from "@/components/canvas/canvas-projects-modal";
import { CanvasSidePanel } from "@/components/canvas/canvas-side-panel";
import { CanvasZoomControls } from "@/components/canvas/canvas-zoom-controls";
import { useAgentStore } from "@/stores/use-agent-store";
import { useCanvasStore, type FetchProjectResult } from "@/stores/canvas/use-canvas-store";
import { ApiError } from "@/integrations/hajimi/http";
import { getGenerationApi, getImageToolsApi, refreshSessionUser } from "@/integrations/hajimi/browser-client";
import { createClientRequestId, type GenerationTask, type GenerationTaskImage } from "@/integrations/hajimi/generation-api";
import type { OutpaintAnchor } from "@/integrations/hajimi/image-tools-api";
import { generationFailureHint } from "@/components/image-generation-pending";
import { LegacyProjectImportDialog } from "@/components/hajimi/legacy-project-import-dialog";
import { loadProjectDraft, removeProjectDraft, saveProjectDraft } from "@/integrations/hajimi/project-draft-cache";
import type { HjmProjectContent } from "@/integrations/hajimi/project-schema";
import { useUserStore } from "@/stores/use-user-store";
import { useAgentBridge } from "@/pages/canvas/hooks/use-agent-bridge";
import { usePluginHost } from "@/pages/canvas/hooks/use-plugin-host";
import { buildNodeMentionReferences, type CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";
import { exportCanvasProjects } from "@/lib/canvas/canvas-export";
import {
    applyNodeConfigPatch,
    audioMetadata,
    buildAudioGenerationMetadata,
    buildImageGenerationMetadata,
    createCanvasNode,
    generatedImageMetadata,
    generatedImageSelectionMetadata,
    imageMetadata,
    videoMetadata,
} from "@/lib/canvas/canvas-node-factory";
import { findContainingGroupId, findGroupDropTarget, getConnectionTargetAnchor, isHiddenBatchChild, isHiddenBatchConnectionEndpoint, normalizeConnection, snapNodesIntoGroup } from "@/lib/canvas/canvas-node-geometry";
import {
    audioExtension,
    buildAngleLabel,
    buildAnglePrompt,
    buildGenerationConfig,
    findRetrySourceNode,
    generationReferenceUrls,
    getGenerationCount,
    getInputSummary,
    hydrateAssistantImages,
    hydrateCanvasImages,
    imageExtension,
    isAudioFile,
    isGenerationCanceled,
    resetInterruptedGeneration,
    resolveMetadataReferences,
    sourceNodeReferenceImages,
} from "@/lib/canvas/canvas-generation-helpers";
import { getNodeDefinition, isBuiltinNodeType as isBuiltinType, useNodeRegistryVersion } from "@/lib/canvas/node-registry";
import { registerBuiltinNodes } from "@/components/canvas/nodes/builtin-nodes";
import { CanvasRefreshShell } from "@/components/canvas/canvas-refresh-shell";
import { CanvasTopBar } from "@/components/canvas/canvas-top-bar";
import { ConnectionCreateMenu, NodeCreateMenu, type PendingConnectionCreate } from "@/components/canvas/canvas-create-menus";
import {
    CanvasNodeType,
    type CanvasAssistantImage,
    type CanvasAssistantSession,
    type CanvasConnection,
    type CanvasGenerationTaskState,
    type CanvasNodeData,
    type CanvasNodeMetadata,
    type CanvasNodeTypeId,
    type ConnectionHandle,
    type ContextMenuState,
    type Position,
    type SelectionBox,
    type ViewportTransform,
} from "@/types/canvas";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio } from "@/types/media";

// 内置节点注册到统一注册表(模块加载时执行一次)
registerBuiltinNodes();

// 任务结果图已在服务端写入账号云端资产库（source='generated'）：优先经 assetId 纳入瞬态缓存，
// 拿不到资产时才回退重新上传展示 URL，保证节点保存 storageKey = "asset:<assetId>"。
async function resolveGenerationTaskImage(image: GenerationTaskImage): Promise<UploadedImage> {
    if (image.assetId) {
        const adopted = await adoptCloudAssetImage(image.assetId, image.accessUrl);
        if (adopted) return adopted;
    }
    return uploadImage(image.url);
}

function generationTaskFailureDetails(task: GenerationTask): string {
    const hint = generationFailureHint({
        billingStatus: task.billingStatus,
        providerBillingStatus: task.providerBillingStatus,
        upstreamBillingAmbiguous: task.upstreamBillingAmbiguous,
    });
    return [task.errorMessage || (task.status === "cancelled" ? "任务已取消" : "生成失败"), hint].filter(Boolean).join("；");
}

type CanvasClipboard = {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
};

type ConnectionDropTarget = {
    nodeId: string | null;
    isNearNode: boolean;
};

type CanvasHistoryEntry = Pick<CanvasClipboard, "nodes" | "connections"> & {
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
};

type CanvasGenerationRequest = {
    targetNodeId: string;
    originNodeId: string;
    runningNodeId: string;
    controller: AbortController;
};

const VIDEO_NODE_MAX_WIDTH = 420;
const VIDEO_NODE_MAX_HEIGHT = 420;
// 稳定的空引用数组:避免每次渲染 `... || []` 产生新数组引用而击穿 CanvasNode 的 React.memo
const EMPTY_REFERENCES: CanvasResourceReference[] = [];
const CONNECTION_HANDLE_HIT_RADIUS = 40;
const CONNECTION_NODE_HIT_PADDING = 32;

function findOpenNodePosition(origin: Position, type: CanvasNodeTypeId, nodes: CanvasNodeData[]): Position {
    const spec = getNodeSpec(type);
    const gap = 72;
    const stepX = spec.width + gap;
    const stepY = spec.height + gap;
    const offsets = [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
    ];
    const overlaps = (position: Position) =>
        nodes.some(
            (node) =>
                position.x < node.position.x + node.width + gap &&
                position.x + spec.width + gap > node.position.x &&
                position.y < node.position.y + node.height + gap &&
                position.y + spec.height + gap > node.position.y,
        );

    for (const [column, row] of offsets) {
        const candidate = { x: origin.x + column * stepX, y: origin.y + row * stepY };
        if (!overlaps(candidate)) return candidate;
    }
    return { x: origin.x + stepX * 2, y: origin.y + stepY * 2 };
}
const NODE_STATUS_IDLE = "idle" as const;
const NODE_STATUS_LOADING = "loading" as const;
const NODE_STATUS_SUCCESS = "success" as const;
const NODE_STATUS_ERROR = "error" as const;

const OUTPAINT_RATIOS = ["16:9", "9:16", "4:3", "3:4", "1:1"] as const;
const OUTPAINT_ANCHORS: { value: OutpaintAnchor; label: string }[] = [
    { value: "center", label: "原图居中" },
    { value: "top", label: "原图靠上" },
    { value: "bottom", label: "原图靠下" },
    { value: "left", label: "原图靠左" },
    { value: "right", label: "原图靠右" },
];

type CanvasOutpaintParams = { ratio: string; anchor: OutpaintAnchor; prompt: string };

// 扩图参数弹窗（Task 9）：目标比例 + 布局锚点 + 可选提示词；confirmLoading 期间防重复提交。
function CanvasNodeOutpaintDialog({ open, submitting, onClose, onConfirm }: { open: boolean; submitting: boolean; onClose: () => void; onConfirm: (params: CanvasOutpaintParams) => void }) {
    const [ratio, setRatio] = useState<string>("16:9");
    const [anchor, setAnchor] = useState<OutpaintAnchor>("center");
    const [prompt, setPrompt] = useState("");

    useEffect(() => {
        if (!open) return;
        setRatio("16:9");
        setAnchor("center");
        setPrompt("");
    }, [open]);

    return (
        <Modal title="扩图" open={open} onCancel={onClose} onOk={() => onConfirm({ ratio, anchor, prompt: prompt.trim() })} okText="开始扩图" cancelText="取消" confirmLoading={submitting} destroyOnHidden width={420}>
            <div className="space-y-4">
                <div className="space-y-2">
                    <div className="text-sm font-medium opacity-75">目标比例</div>
                    <Select className="w-full" value={ratio} onChange={setRatio} options={OUTPAINT_RATIOS.map((value) => ({ value, label: value }))} />
                </div>
                <div className="space-y-2">
                    <div className="text-sm font-medium opacity-75">原图位置</div>
                    <Select className="w-full" value={anchor} onChange={setAnchor} options={OUTPAINT_ANCHORS} />
                </div>
                <div className="space-y-2">
                    <div className="text-sm font-medium opacity-75">扩展要求（可选）</div>
                    <Input.TextArea rows={3} value={prompt} placeholder="例如：自然延展背景，保持产品与光影一致" onChange={(event) => setPrompt(event.target.value)} />
                </div>
            </div>
        </Modal>
    );
}

export default function CanvasPage() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <CanvasRefreshShell />;

    return <InfiniteCanvasPage />;
}

function InfiniteCanvasPage() {
    const { message, modal } = App.useApp();
    // 订阅节点注册表版本,插件动态注册/卸载后驱动画布重渲染
    const nodeRegistryVersion = useNodeRegistryVersion((state) => state.version);
    const params = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const projectId = params.id || "";
    const agentPanelOpen = useAgentStore((state) => state.panelOpen);
    const toggleAgentPanel = useAgentStore((state) => state.togglePanel);
    const openAgentPanel = useAgentStore((state) => state.openPanel);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const uploadTargetRef = useRef<{ nodeId?: string; position?: Position; imageOnly?: boolean } | null>(null);
    const clipboardRef = useRef<CanvasClipboard | null>(null);
    const historyRef = useRef<{ past: CanvasHistoryEntry[]; future: CanvasHistoryEntry[] }>({ past: [], future: [] });
    const lastHistoryRef = useRef<CanvasHistoryEntry | null>(null);
    const historyCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const applyingHistoryRef = useRef(false);
    const historyPausedRef = useRef(false);
    const didInitialCenterRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const nodeDraggingRef = useRef(false);
    const dragRef = useRef<{
        isDraggingNode: boolean;
        hasMoved: boolean;
        startX: number;
        startY: number;
        initialSelectedNodes: { id: string; x: number; y: number }[];
    }>({
        isDraggingNode: false,
        hasMoved: false,
        startX: 0,
        startY: 0,
        initialSelectedNodes: [],
    });

    const effectiveConfig = useEffectiveConfig();
    const addAsset = useAssetStore((state) => state.addAsset);
    const cleanupAssetImages = useAssetStore((state) => state.cleanupImages);
    const fetchProject = useCanvasStore((state) => state.fetchProject);
    const createProject = useCanvasStore((state) => state.createProject);
    const updateProject = useCanvasStore((state) => state.updateProject);
    const saveProjectContent = useCanvasStore((state) => state.saveProjectContent);
    const renameProject = useCanvasStore((state) => state.renameProject);
    const deleteProjects = useCanvasStore((state) => state.deleteProjects);
    const currentProject = useCanvasStore((state) => state.projects.find((project) => project.id === projectId));
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [nodes, setNodes] = useState<CanvasNodeData[]>([]);
    const [connections, setConnections] = useState<CanvasConnection[]>([]);
    const [chatSessions, setChatSessions] = useState<CanvasAssistantSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, k: 1 });
    const [size, setSize] = useState({ width: 1200, height: 720 });
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [connectingParams, setConnectingParams] = useState<ConnectionHandle | null>(null);
    const [connectionTargetNodeId, setConnectionTargetNodeId] = useState<string | null>(null);
    const [pendingConnectionCreate, setPendingConnectionCreate] = useState<PendingConnectionCreate | null>(null);
    const [mouseWorld, setMouseWorld] = useState<Position>({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [nodeCreatePosition, setNodeCreatePosition] = useState<Position | null>(null);
    const [nodeCreateMenuPosition, setNodeCreateMenuPosition] = useState<Position | null>(null);
    const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
    const [isMiniMapOpen, setIsMiniMapOpen] = useState(false);
    const [backgroundMode, setBackgroundMode] = useState<CanvasBackgroundMode>("lines");
    const [showImageInfo, setShowImageInfo] = useState(false);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [userCenterOpen, setUserCenterOpen] = useState(false);
    const [projectsModalOpen, setProjectsModalOpen] = useState(false);
    const [projectLoaded, setProjectLoaded] = useState(false);
    const [projectLoadError, setProjectLoadError] = useState<"not-found" | "legacy" | "error" | null>(null);
    const [legacyImportOpen, setLegacyImportOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
    const [toolbarNodeId, setToolbarNodeId] = useState<string | null>(null);
    const [nodeImageSettingsOpen, setNodeImageSettingsOpen] = useState(false);
    const [dialogNodeId, setDialogNodeId] = useState<string | null>(null);
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editRequestNonce, setEditRequestNonce] = useState(0);
    const [infoNodeId, setInfoNodeId] = useState<string | null>(null);
    const [cropNodeId, setCropNodeId] = useState<string | null>(null);
    const [maskEditNodeId, setMaskEditNodeId] = useState<string | null>(null);
    const [maskEditOperation, setMaskEditOperation] = useState<"inpaint" | "erase">("inpaint");
    const [outpaintNodeId, setOutpaintNodeId] = useState<string | null>(null);
    const [outpaintSubmitting, setOutpaintSubmitting] = useState(false);
    const [splitNodeId, setSplitNodeId] = useState<string | null>(null);
    const [upscaleNodeId, setUpscaleNodeId] = useState<string | null>(null);
    const [superResolveNodeId, setSuperResolveNodeId] = useState<string | null>(null);
    const [angleNodeId, setAngleNodeId] = useState<string | null>(null);
    const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
    const [titleEditing, setTitleEditing] = useState(false);
    const [titleDraft, setTitleDraft] = useState("");
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
    const [collapsingBatchIds, setCollapsingBatchIds] = useState<Set<string>>(new Set());
    const [openingBatchIds, setOpeningBatchIds] = useState<Set<string>>(new Set());
    const [isNodeDragging, setIsNodeDragging] = useState(false);
    const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);

    const nodesRef = useRef(nodes);
    const connectionsRef = useRef(connections);
    const chatSessionsRef = useRef(chatSessions);
    const activeChatIdRef = useRef(activeChatId);
    const backgroundModeRef = useRef(backgroundMode);
    const showImageInfoRef = useRef(showImageInfo);
    const projectLoadedRef = useRef(false);
    const saveDirtyRef = useRef(false);
    const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const selectedNodeIdsRef = useRef(selectedNodeIds);
    const viewportRef = useRef(viewport);
    const focusAnimRef = useRef<number | null>(null);
    const generateNodeRef = useRef<((nodeId: string, mode: CanvasNodeGenerationMode, prompt: string, clientRequestId?: string) => Promise<void>) | null>(null);
    const reversePromptNodeRef = useRef<((nodeId: string) => void) | null>(null);
    const connectingParamsRef = useRef(connectingParams);
    const connectionTargetNodeIdRef = useRef(connectionTargetNodeId);
    const selectionBoxRef = useRef(selectionBox);
    const pendingConnectionCreateRef = useRef(pendingConnectionCreate);
    const generationRequestsRef = useRef(new Map<string, CanvasGenerationRequest>());

    const createHistoryEntry = useCallback(
        (): CanvasHistoryEntry => ({
            nodes: nodesRef.current,
            connections: connectionsRef.current,
            chatSessions,
            activeChatId,
            backgroundMode,
            showImageInfo,
        }),
        [activeChatId, backgroundMode, chatSessions, showImageInfo],
    );

    const cleanupCanvasFiles = useCallback(
        (extra?: unknown) => {
            cleanupAssetImages({ extra, history: historyRef.current, lastHistory: lastHistoryRef.current });
        },
        [cleanupAssetImages],
    );

    const startGenerationRequest = useCallback((targetNodeId: string, originNodeId: string, runningId = originNodeId, controller = new AbortController()) => {
        const previous = generationRequestsRef.current.get(targetNodeId);
        if (previous?.controller !== controller) previous?.controller.abort();
        generationRequestsRef.current.set(targetNodeId, { targetNodeId, originNodeId, runningNodeId: runningId, controller });
        return controller;
    }, []);

    const finishGenerationRequest = useCallback((targetNodeId: string, controller: AbortController) => {
        const request = generationRequestsRef.current.get(targetNodeId);
        if (request?.controller === controller) generationRequestsRef.current.delete(targetNodeId);
    }, []);

    // Task 8：任务终态后刷新用户资料（余额）与云端资产库；余额事实源在服务端，前端不自行计算。
    const refreshAccountAfterGenerationTask = useCallback(() => {
        void refreshSessionUser().catch(() => {});
    }, []);

    // Task 8：轮询/终态时把任务快照写回所有携带该 taskId 的节点（保留各节点的 imageIndex）。
    const updateGenerationTaskNodes = useCallback((task: GenerationTask) => {
        setNodes((prev) =>
            prev.map((node) => {
                const current = node.metadata?.generationTask;
                if (!current || current.taskId !== task.taskId) return node;
                return { ...node, metadata: { ...node.metadata, generationTask: taskStateFromGenerationTask(task, current.imageIndex) } };
            }),
        );
    }, []);

    const stopGenerationByRunningId = useCallback((runningId: string) => {
        const affectedNodeIds = new Set<string>();
        generationRequestsRef.current.forEach((request) => {
            if (request.runningNodeId !== runningId) return;
            request.controller.abort();
            generationRequestsRef.current.delete(request.targetNodeId);
            affectedNodeIds.add(request.targetNodeId);
            affectedNodeIds.add(request.originNodeId);
        });
        setRunningNodeId((current) => (current === runningId ? null : current));
        if (!affectedNodeIds.size) return;
        // Task 8：本地中断的同时取消服务端持久任务（取消幂等，只调用一次）。
        const taskIds = new Set<string>();
        nodesRef.current.forEach((node) => {
            const task = node.metadata?.generationTask;
            if (affectedNodeIds.has(node.id) && task?.taskId && (task.status === "pending" || task.status === "running")) taskIds.add(task.taskId);
        });
        taskIds.forEach((taskId) => {
            void getGenerationApi()
                .cancel(taskId)
                .then((task) => updateGenerationTaskNodes(task))
                .catch(() => {});
        });
        setNodes((prev) => prev.map((node) => (affectedNodeIds.has(node.id) && node.metadata?.status === NODE_STATUS_LOADING ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_IDLE, errorDetails: undefined } } : node)));
    }, [updateGenerationTaskNodes]);

    const confirmStopGeneration = useCallback(
        (nodeId: string) => {
            modal.confirm({
                title: "停止生成？",
                content: "当前生成请求会被中断，已经生成完成的内容会保留。",
                okText: "停止",
                cancelText: "继续生成",
                okButtonProps: { danger: true },
                onOk: () => stopGenerationByRunningId(nodeId),
            });
        },
        [modal, stopGenerationByRunningId],
    );

    // Task 8：节点加载态上的「取消」——优先取消服务端持久任务（展示退款/计费歧义语义），否则退回本地中断。
    const handleCancelGenerationTask = useCallback(
        (node: CanvasNodeData) => {
            const task = node.metadata?.generationTask;
            if (!task?.taskId || (task.status !== "pending" && task.status !== "running")) {
                confirmStopGeneration(node.id);
                return;
            }
            modal.confirm({
                title: "取消生图任务？",
                content: "未结算的预占算力会退款；若上游已开始生成，计费状态会标记为未知，不会自动重放。",
                okText: "取消任务",
                cancelText: "继续生成",
                okButtonProps: { danger: true },
                onOk: () => {
                    void getGenerationApi()
                        .cancel(task.taskId)
                        .then((cancelled) => {
                            updateGenerationTaskNodes(cancelled);
                            setNodes((prev) =>
                                prev.map((item) =>
                                    item.metadata?.generationTask?.taskId === task.taskId
                                        ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails: cancelled.errorMessage || "任务已取消" } }
                                        : item,
                                ),
                            );
                            refreshAccountAfterGenerationTask();
                        })
                        .catch(() => {});
                },
            });
        },
        [modal, confirmStopGeneration, updateGenerationTaskNodes, refreshAccountAfterGenerationTask],
    );

    // Task 8：人工重试失败/已取消任务——服务端创建全新任务并签发新幂等键；上游计费歧义需用户显式确认。
    const retryNodeGenerationTask = useCallback(
        async (previousTask: CanvasGenerationTaskState): Promise<GenerationTask> => {
            const ambiguous = previousTask.providerBillingStatus === "unknown" || previousTask.upstreamBillingAmbiguous === true;
            if (ambiguous) {
                const confirmed = await new Promise<boolean>((resolve) => {
                    modal.confirm({
                        title: "确认人工重试？",
                        content: "上一单的上游计费状态未知，重试可能产生重复计费。确认继续？",
                        okText: "确认重试",
                        cancelText: "取消",
                        okButtonProps: { danger: true },
                        onOk: () => resolve(true),
                        onCancel: () => resolve(false),
                    });
                });
                if (!confirmed) throw new Error("请求已取消");
            }
            return getGenerationApi().retry(previousTask.taskId, { confirmUpstreamBillingRisk: ambiguous });
        },
        [modal],
    );

    // Task 8：刷新项目后对非终态 taskId 继续轮询（不重新提交）；终态后按 imageIndex 把结果写回各节点。
    const resumeGenerationTasks = useCallback(
        (restoredNodes: CanvasNodeData[]) => {
            const taskIds = new Set<string>();
            restoredNodes.forEach((node) => {
                const task = node.metadata?.generationTask;
                if (task?.taskId && (task.status === "pending" || task.status === "running")) taskIds.add(task.taskId);
            });
            taskIds.forEach((taskId) => {
                void (async () => {
                    try {
                        const final = await waitNodeImageGeneration(getGenerationApi(), taskId, {
                            onUpdate: (task) => updateGenerationTaskNodes(task),
                        });
                        updateGenerationTaskNodes(final);
                        const targets = nodesRef.current
                            .filter((node) => node.metadata?.generationTask?.taskId === taskId)
                            .sort((a, b) => (a.metadata?.generationTask?.imageIndex ?? 0) - (b.metadata?.generationTask?.imageIndex ?? 0));
                        if (final.status === "success" && final.images.length) {
                            await Promise.all(
                                targets.map(async (target) => {
                                    if (target.type === CanvasNodeType.Config) {
                                        const settled = await Promise.allSettled(final.images.slice(0, 4).map(resolveGenerationTaskImage));
                                        const generatedImages = settled
                                            .filter((result): result is PromiseFulfilledResult<UploadedImage> => result.status === "fulfilled")
                                            .map((result) => generatedImageMetadata(result.value));
                                        if (!generatedImages.length) {
                                            setNodes((prev) => prev.map((item) => (item.id === target.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails: "结果图片保存失败" } } : item)));
                                            return;
                                        }
                                        setNodes((prev) =>
                                            prev.map((item) =>
                                                item.id === target.id
                                                    ? {
                                                          ...item,
                                                          metadata: {
                                                              ...item.metadata,
                                                              ...generatedImageSelectionMetadata(generatedImages, item.metadata?.selectedGeneratedImageIndex),
                                                              status: NODE_STATUS_SUCCESS,
                                                              errorDetails: settled.some((result) => result.status === "rejected") ? "部分结果图片保存失败" : undefined,
                                                          },
                                                      }
                                                    : item,
                                            ),
                                        );
                                        return;
                                    }
                                    const image = final.images[target.metadata?.generationTask?.imageIndex ?? 0];
                                    if (!image) {
                                        setNodes((prev) => prev.map((item) => (item.id === target.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails: "该张图片生成失败" } } : item)));
                                        return;
                                    }
                                    try {
                                        const uploaded = await resolveGenerationTaskImage(image);
                                        setNodes((prev) => prev.map((item) => (item.id === target.id ? { ...item, metadata: { ...item.metadata, ...imageMetadata(uploaded) } } : item)));
                                    } catch {
                                        setNodes((prev) => prev.map((item) => (item.id === target.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails: "结果图片保存失败" } } : item)));
                                    }
                                }),
                            );
                        } else {
                            const errorDetails = generationTaskFailureDetails(final);
                            setNodes((prev) =>
                                prev.map((item) => (item.metadata?.generationTask?.taskId === taskId ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)),
                            );
                        }
                        refreshAccountAfterGenerationTask();
                    } catch {
                        setNodes((prev) =>
                            prev.map((item) =>
                                item.metadata?.generationTask?.taskId === taskId && item.metadata?.status === NODE_STATUS_LOADING
                                    ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails: "任务状态查询失败，请刷新后重试" } }
                                    : item,
                            ),
                        );
                    }
                })();
            });
        },
        [updateGenerationTaskNodes, refreshAccountAfterGenerationTask],
    );

    // 自动保存：本地节点操作立即更新 UI，服务器保存合并到 1000ms 防抖后只发一次 PUT。
    const flushServerSave = useCallback(async () => {
        if (!projectLoadedRef.current) return;
        const userId = useUserStore.getState().user?.id || "";
        const title = useCanvasStore.getState().projects.find((project) => project.id === projectId)?.title || "未命名画布";
        const content: HjmProjectContent = {
            nodes: nodesRef.current,
            connections: connectionsRef.current,
            chatSessions: chatSessionsRef.current,
            activeChatId: activeChatIdRef.current,
            backgroundMode: backgroundModeRef.current,
            showImageInfo: showImageInfoRef.current,
            viewport: viewportRef.current,
        };
        setSaveStatus("saving");
        try {
            await saveProjectContent(projectId, content, title);
            saveDirtyRef.current = false;
            if (userId) removeProjectDraft(userId, projectId);
            setSaveStatus("saved");
        } catch {
            // 保存失败：保留当前用户的恢复草稿，保存状态 UI 提供重试。
            if (userId) saveProjectDraft(userId, projectId, { title, content });
            setSaveStatus("error");
        }
    }, [projectId, saveProjectContent]);

    const scheduleServerSave = useCallback(() => {
        saveDirtyRef.current = true;
        if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
        serverSaveTimerRef.current = setTimeout(() => {
            serverSaveTimerRef.current = null;
            void flushServerSave();
        }, 1000);
    }, [flushServerSave]);

    const restoreDraft = useCallback(
        async (content: unknown) => {
            const draftContent = content as Partial<HjmProjectContent> | null;
            if (!draftContent || typeof draftContent !== "object") return;
            const restoredNodes = await hydrateCanvasImages((draftContent.nodes || []) as CanvasNodeData[]);
            const restoredSessions = await hydrateAssistantImages((draftContent.chatSessions || []) as CanvasAssistantSession[]);
            setNodes(restoredNodes);
            setConnections((draftContent.connections || []) as CanvasConnection[]);
            setChatSessions(restoredSessions);
            setActiveChatId(draftContent.activeChatId || null);
            setBackgroundMode((draftContent.backgroundMode as CanvasBackgroundMode) || "lines");
            setShowImageInfo(draftContent.showImageInfo || false);
            setViewport(draftContent.viewport || { x: 0, y: 0, k: 1 });
            scheduleServerSave();
        },
        [scheduleServerSave],
    );

    // 切换项目、关闭页面、退出登录（页面跳转）前尽力 flush；未保存内容同步写草稿兜底。
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (!projectLoadedRef.current || !saveDirtyRef.current) return;
            const userId = useUserStore.getState().user?.id || "";
            if (userId) {
                saveProjectDraft(userId, projectId, {
                    title: useCanvasStore.getState().projects.find((project) => project.id === projectId)?.title || "未命名画布",
                    content: {
                        nodes: nodesRef.current,
                        connections: connectionsRef.current,
                        chatSessions: chatSessionsRef.current,
                        activeChatId: activeChatIdRef.current,
                        backgroundMode: backgroundModeRef.current,
                        showImageInfo: showImageInfoRef.current,
                        viewport: viewportRef.current,
                    },
                });
            }
            void flushServerSave();
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            if (serverSaveTimerRef.current) {
                clearTimeout(serverSaveTimerRef.current);
                serverSaveTimerRef.current = null;
                void flushServerSave();
            }
        };
    }, [flushServerSave, projectId]);

    useEffect(() => {
        let cancelled = false;
        setProjectLoaded(false);
        projectLoadedRef.current = false;
        setProjectLoadError(null);
        setSaveStatus("saved");
        saveDirtyRef.current = false;

        const load = async () => {
            // /canvas/:id 才请求详情；加载失败不创建空项目覆盖原项目。
            let result: FetchProjectResult;
            try {
                result = await fetchProject(projectId);
            } catch (error) {
                if (cancelled) return;
                // 404：项目不存在；跨用户访问后端同样返回 404，不泄漏项目名称或数据。
                setProjectLoadError(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
                return;
            }
            if (cancelled) return;
            if (result.kind === "legacy") {
                // 旧项目：非破坏性，原记录保持不变。
                setProjectLoadError("legacy");
                return;
            }
            const project = result.project;
            const restoredNodes = await hydrateCanvasImages(resetInterruptedGeneration(project.nodes));
            const restoredSessions = await hydrateAssistantImages(project.chatSessions || []);
            if (cancelled) return;
            setNodes(restoredNodes);
            // Task 8：刷新前提交的非终态生图任务继续轮询，不重新提交。
            resumeGenerationTasks(restoredNodes);
            setConnections(project.connections);
            setChatSessions(restoredSessions);
            setActiveChatId(project.activeChatId || null);
            setBackgroundMode(project.backgroundMode);
            setShowImageInfo(project.showImageInfo || false);
            setViewport(project.viewport);
            historyRef.current = { past: [], future: [] };
            if (historyCommitTimerRef.current) {
                clearTimeout(historyCommitTimerRef.current);
                historyCommitTimerRef.current = null;
            }
            lastHistoryRef.current = {
                nodes: restoredNodes,
                connections: project.connections,
                chatSessions: restoredSessions,
                activeChatId: project.activeChatId || null,
                backgroundMode: project.backgroundMode,
                showImageInfo: project.showImageInfo || false,
            };
            setHistoryState({ canUndo: false, canRedo: false });
            projectLoadedRef.current = true;
            setProjectLoaded(true);

            // 崩溃恢复：草稿比服务器新时提供恢复，否则清理过期草稿。 updated_at 为 UTC 无 Z 字符串，需按 UTC 解析，否则 UTC+8 下比较恒为假、草稿被误删。
            const userId = useUserStore.getState().user?.id || "";
            if (!userId) return;
            const draft = loadProjectDraft(userId, projectId);
            if (!draft) return;
            const parseServerTime = (value: string) => {
                const raw = String(value || "").trim();
                if (!raw) return 0;
                const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw);
                const normalized = hasZone ? raw : `${raw.replace(" ", "T")}Z`;
                return Date.parse(normalized) || 0;
            };
            const serverTime = parseServerTime(project.updatedAt || "");
            const draftTime = Date.parse(draft.savedAt || "") || 0;
            if (draftTime > serverTime) {
                modal.confirm({
                    title: "恢复未保存的草稿？",
                    content: "检测到该项目有未成功保存到服务器的本地草稿。",
                    okText: "恢复草稿",
                    cancelText: "丢弃",
                    onOk: () => {
                        removeProjectDraft(userId, projectId);
                        void restoreDraft(draft.content);
                    },
                    onCancel: () => removeProjectDraft(userId, projectId),
                });
            } else {
                removeProjectDraft(userId, projectId);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [fetchProject, modal, projectId, restoreDraft, resumeGenerationTasks]);

    useEffect(() => {
        if (!projectLoaded || !["new", "recent", "choose"].includes(searchParams.get("mode") || "")) return;
        openAgentPanel();
    }, [openAgentPanel, projectLoaded, searchParams]);

    // 首页提示词案例入口：?prompt= 在空画布预填一个生图节点，随后从 URL 移除避免刷新重复。
    const promptPrefillDoneRef = useRef(false);
    useEffect(() => {
        if (!projectLoaded || promptPrefillDoneRef.current) return;
        const prompt = (searchParams.get("prompt") || "").trim();
        if (!prompt) return;
        promptPrefillDoneRef.current = true;
        if (nodesRef.current.length) return;
        const viewport = viewportRef.current;
        const center = { x: (size.width / 2 - viewport.x) / viewport.k, y: (size.height / 2 - viewport.y) / viewport.k };
        const node = createCanvasNode(CanvasNodeType.Config, center, { composerContent: prompt });
        setNodes([node]);
        setSelectedNodeIds(new Set([node.id]));
        const next = new URLSearchParams(searchParams);
        next.delete("prompt");
        setSearchParams(next, { replace: true });
    }, [projectLoaded, searchParams, setSearchParams, size.height, size.width]);

    useEffect(() => {
        if (!projectLoaded || applyingHistoryRef.current || historyPausedRef.current) return;
        const next = createHistoryEntry();
        const previous = lastHistoryRef.current;
        if (
            previous?.nodes === next.nodes &&
            previous.connections === next.connections &&
            previous.chatSessions === next.chatSessions &&
            previous.activeChatId === next.activeChatId &&
            previous.backgroundMode === next.backgroundMode &&
            previous.showImageInfo === next.showImageInfo
        )
            return;

        if (historyCommitTimerRef.current) clearTimeout(historyCommitTimerRef.current);
        historyCommitTimerRef.current = setTimeout(() => {
            const current = createHistoryEntry();
            const last = lastHistoryRef.current;
            if (!last) return;
            historyRef.current.past = [...historyRef.current.past.slice(-49), last];
            historyRef.current.future = [];
            setHistoryState({ canUndo: true, canRedo: false });
            lastHistoryRef.current = current;
            historyCommitTimerRef.current = null;
        }, 180);

        return () => {
            if (historyCommitTimerRef.current) {
                clearTimeout(historyCommitTimerRef.current);
                historyCommitTimerRef.current = null;
            }
        };
    }, [activeChatId, backgroundMode, chatSessions, connections, createHistoryEntry, nodes, projectLoaded, showImageInfo]);

    useEffect(() => {
        if (!projectLoaded || historyPausedRef.current) return;
        updateProject(projectId, { nodes, connections, chatSessions, activeChatId, backgroundMode, showImageInfo });
        scheduleServerSave();
    }, [activeChatId, backgroundMode, chatSessions, connections, nodes, projectId, projectLoaded, scheduleServerSave, showImageInfo, updateProject]);

    useEffect(() => {
        if (!dialogNodeId) setNodeImageSettingsOpen(false);
    }, [dialogNodeId]);

    useEffect(() => {
        if (!projectLoaded) return;
        scheduleServerSave();
        if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        viewportSaveTimerRef.current = setTimeout(() => {
            updateProject(projectId, { viewport: viewportRef.current });
            viewportSaveTimerRef.current = null;
        }, 500);
        return () => {
            if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        };
    }, [projectId, projectLoaded, scheduleServerSave, updateProject, viewport]);

    useLayoutEffect(() => {
        nodesRef.current = nodes;
        connectionsRef.current = connections;
        chatSessionsRef.current = chatSessions;
        activeChatIdRef.current = activeChatId;
        backgroundModeRef.current = backgroundMode;
        showImageInfoRef.current = showImageInfo;
        selectedNodeIdsRef.current = selectedNodeIds;
        viewportRef.current = viewport;
        connectingParamsRef.current = connectingParams;
        connectionTargetNodeIdRef.current = connectionTargetNodeId;
        pendingConnectionCreateRef.current = pendingConnectionCreate;
    }, [activeChatId, backgroundMode, chatSessions, nodes, connections, selectedNodeIds, showImageInfo, viewport, connectingParams, connectionTargetNodeId, pendingConnectionCreate]);

    useLayoutEffect(() => {
        selectionBoxRef.current = selectionBox;
    }, [selectionBox]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updateSize = () => {
            const rect = el.getBoundingClientRect();
            setSize({ width: rect.width, height: rect.height });
            if (!didInitialCenterRef.current) {
                didInitialCenterRef.current = true;
                setViewport({ x: rect.width / 2, y: rect.height / 2, k: 1 });
            }
        };

        updateSize();
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(el);
        return () => resizeObserver.disconnect();
    }, []);

    const screenToCanvas = useCallback((clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        const currentViewport = viewportRef.current;
        const localX = clientX - (rect?.left || 0);
        const localY = clientY - (rect?.top || 0);

        return {
            x: (localX - currentViewport.x) / currentViewport.k,
            y: (localY - currentViewport.y) / currentViewport.k,
        };
    }, []);

    const getCanvasCenter = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        return screenToCanvas((rect?.left || 0) + (rect?.width || size.width) / 2, (rect?.top || 0) + (rect?.height || size.height) / 2);
    }, [screenToCanvas, size.height, size.width]);

    const setConnecting = useCallback((next: ConnectionHandle | null) => {
        connectingParamsRef.current = next;
        setConnectingParams(next);
        if (!next) {
            connectionTargetNodeIdRef.current = null;
            setConnectionTargetNodeId(null);
        }
    }, []);

    const keepNodeToolbar = useCallback(
        (nodeId: string) => {
            if (nodeDraggingRef.current || nodeImageSettingsOpen || !selectedNodeIdsRef.current.has(nodeId)) return;
            setToolbarNodeId(nodeId);
        },
        [nodeImageSettingsOpen],
    );

    const hideNodeToolbar = useCallback(() => {}, []);

    const connectNodes = useCallback(
        (current: ConnectionHandle, targetNodeId: string) => {
            if (current.nodeId === targetNodeId) return;

            const connection = normalizeConnection(current.nodeId, targetNodeId, nodesRef.current, current.handleType);
            if (!connection) {
                message.warning("配置节点之间不能连接");
                return;
            }
            const { fromNodeId, toNodeId } = connection;
            const exists = connectionsRef.current.some((conn) => conn.fromNodeId === fromNodeId && conn.toNodeId === toNodeId);
            if (!exists) {
                setConnections((prev) => [...prev, { id: `conn-${Date.now()}`, fromNodeId, toNodeId }]);
            }
            setContextMenu(null);
        },
        [message],
    );

    const createConnectedNode = useCallback(
        (type: CanvasNodeType.Image | CanvasNodeType.Text | CanvasNodeType.Config | CanvasNodeType.Video | CanvasNodeType.Audio, pending: PendingConnectionCreate) => {
            const metadata = type === CanvasNodeType.Config ? { model: effectiveConfig.imageModel || effectiveConfig.model, size: effectiveConfig.size, count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count) } : undefined;
            const newNode = createCanvasNode(type, pending.position, metadata);
            const connection = normalizeConnection(pending.connection.nodeId, newNode.id, [...nodesRef.current, newNode], pending.connection.handleType);
            if (!connection) {
                message.warning("配置节点之间不能连接");
                return;
            }
            setNodes((prev) => [...prev, newNode]);
            setConnections((prev) => [...prev, { id: nanoid(), ...connection }]);
            setSelectedNodeIds(new Set([newNode.id]));
            setSelectedConnectionId(null);
            if (type !== CanvasNodeType.Text && type !== CanvasNodeType.Audio) setDialogNodeId(newNode.id);
            setPendingConnectionCreate(null);
            setConnecting(null);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, message, setConnecting],
    );

    const cancelPendingConnectionCreate = useCallback(() => {
        setPendingConnectionCreate(null);
        setConnecting(null);
    }, [setConnecting]);

    const getConnectionDropTarget = useCallback(
        (clientX: number, clientY: number, current: ConnectionHandle): ConnectionDropTarget => {
            const world = screenToCanvas(clientX, clientY);
            const scale = Math.max(viewportRef.current.k, 0.05);
            const padding = CONNECTION_NODE_HIT_PADDING / scale;
            const handleRadius = CONNECTION_HANDLE_HIT_RADIUS / scale;
            let isNearNode = false;
            let bestNodeId: string | null = null;
            let bestPriority = Number.POSITIVE_INFINITY;

            [...nodesRef.current]
                .filter((node) => !isHiddenBatchChild(node, nodesRef.current))
                .reverse()
                .forEach((node) => {
                    const anchor = getConnectionTargetAnchor(node, current);
                    const dx = world.x - anchor.x;
                    const dy = world.y - anchor.y;
                    const hitsHandle = dx * dx + dy * dy <= handleRadius * handleRadius;
                    const hitsInside = world.x >= node.position.x && world.x <= node.position.x + node.width && world.y >= node.position.y && world.y <= node.position.y + node.height;
                    const hitsExpanded = world.x >= node.position.x - padding && world.x <= node.position.x + node.width + padding && world.y >= node.position.y - padding && world.y <= node.position.y + node.height + padding;

                    if (!hitsHandle && !hitsInside && !hitsExpanded) return;
                    isNearNode = true;
                    if (node.id === current.nodeId || !normalizeConnection(current.nodeId, node.id, nodesRef.current, current.handleType)) return;

                    const priority = hitsInside ? 0 : hitsHandle ? 1 : 2;
                    if (priority < bestPriority) {
                        bestNodeId = node.id;
                        bestPriority = priority;
                    }
                });

            return { nodeId: bestNodeId, isNearNode };
        },
        [screenToCanvas],
    );

    const visibleNodes = useMemo(() => {
        const padding = 280;
        const rect = containerRef.current?.getBoundingClientRect();
        const width = rect?.width || size.width;
        const height = rect?.height || size.height;
        const viewLeft = -viewport.x / viewport.k - padding;
        const viewTop = -viewport.y / viewport.k - padding;
        const viewRight = viewLeft + width / viewport.k + padding * 2;
        const viewBottom = viewTop + height / viewport.k + padding * 2;

        return nodes.filter((node) => !isHiddenBatchChild(node, nodes, collapsingBatchIds) && node.position.x + node.width > viewLeft && node.position.x < viewRight && node.position.y + node.height > viewTop && node.position.y < viewBottom);
    }, [collapsingBatchIds, nodes, size.height, size.width, viewport.k, viewport.x, viewport.y]);

    const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
    // 工具条跟随「单选节点」:点击/新建/框选/键盘选中任一节点都会显示,不再仅靠精确点中触发。
    // 多选时不显示;拖拽中由下方 isNodeDragging 守卫隐藏。
    const singleSelectedNodeId = selectedNodeIds.size === 1 ? Array.from(selectedNodeIds)[0] : null;
    const toolbarNode = (toolbarNodeId ? nodeById.get(toolbarNodeId) || null : null) || (singleSelectedNodeId ? nodeById.get(singleSelectedNodeId) || null : null);
    const infoNode = infoNodeId ? nodeById.get(infoNodeId) || null : null;
    const cropNode = cropNodeId ? nodeById.get(cropNodeId) || null : null;
    const maskEditNode = maskEditNodeId ? nodeById.get(maskEditNodeId) || null : null;
    const outpaintNode = outpaintNodeId ? nodeById.get(outpaintNodeId) || null : null;
    const splitNode = splitNodeId ? nodeById.get(splitNodeId) || null : null;
    const upscaleNode = upscaleNodeId ? nodeById.get(upscaleNodeId) || null : null;
    const superResolveNode = superResolveNodeId ? nodeById.get(superResolveNodeId) || null : null;
    const angleNode = angleNodeId ? nodeById.get(angleNodeId) || null : null;
    const previewNode = previewNodeId ? nodeById.get(previewNodeId) || null : null;
    const hasMultipleSelectedNodes = selectedNodeIds.size > 1;
    const activeNodeId = hasMultipleSelectedNodes ? null : hoveredNodeId || (selectedNodeIds.size === 1 ? Array.from(selectedNodeIds)[0] : null);
    const batchChildCountById = useMemo(() => {
        const map = new Map<string, number>();
        nodes.forEach((node) => {
            if (node.metadata?.isBatchRoot) map.set(node.id, node.metadata.batchChildIds?.length || 0);
        });
        return map;
    }, [nodes]);
    const groupChildCountById = useMemo(() => {
        const map = new Map<string, number>();
        nodes.forEach((node) => {
            const groupId = node.metadata?.groupId;
            if (groupId) map.set(groupId, (map.get(groupId) || 0) + 1);
        });
        return map;
    }, [nodes]);
    const batchMotionById = useMemo(() => {
        const map = new Map<string, { x: number; y: number; index: number }>();
        nodes.forEach((node) => {
            const rootId = node.metadata?.batchRootId;
            if (!rootId) return;
            const root = nodeById.get(rootId);
            const index = root?.metadata?.batchChildIds?.indexOf(node.id) ?? 0;
            const stackX = root ? root.position.x + 34 + index * 14 : node.position.x;
            const stackY = root ? root.position.y + 14 + index * 8 : node.position.y;
            map.set(node.id, { x: stackX - node.position.x, y: stackY - node.position.y, index: Math.max(index, 0) });
        });
        return map;
    }, [nodeById, nodes]);
    const relatedHighlight = useMemo(() => {
        const nodeIds = new Set<string>();
        const connectionIds = new Set<string>();

        if (!activeNodeId) return { nodeIds, connectionIds };

        nodeIds.add(activeNodeId);
        connections.forEach((connection) => {
            if (connection.fromNodeId !== activeNodeId && connection.toNodeId !== activeNodeId) return;
            connectionIds.add(connection.id);
            nodeIds.add(connection.fromNodeId);
            nodeIds.add(connection.toNodeId);
        });

        return { nodeIds, connectionIds };
    }, [activeNodeId, connections]);

    const configInputsById = useMemo(() => {
        const map = new Map<string, NodeGenerationInput[]>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Config) return;
            map.set(node.id, buildNodeGenerationInputs(node.id, nodes, connections));
        });
        return map;
    }, [connections, nodes]);
    const mentionReferencesByNodeId = useMemo(() => {
        const map = new Map<string, ReturnType<typeof buildNodeMentionReferences>>();
        nodes.forEach((node) => map.set(node.id, buildNodeMentionReferences(node, nodes, connections)));
        return map;
    }, [connections, nodes]);
    const { applyAgentOps } = useAgentBridge({
        projectId,
        title: currentProject?.title,
        nodes,
        connections,
        selectedNodeIds,
        viewport,
        nodesRef,
        connectionsRef,
        selectedNodeIdsRef,
        viewportRef,
        generateNodeRef,
        reversePromptNodeRef,
        setNodes,
        setConnections,
        setSelectedNodeIds,
        setSelectedConnectionId,
        setViewport,
        setContextMenu,
    });

    const { pluginHost, renderPluginPanel, buildNodeToolbarItems } = usePluginHost({
        theme,
        nodesRef,
        connectionsRef,
        viewportRef,
        setNodes,
        setDialogNodeId,
        applyAgentOps,
    });
    const createNode = useCallback(
        (type: CanvasNodeTypeId, position?: Position) => {
            const targetPosition = position || findOpenNodePosition(getCanvasCenter(), type, nodesRef.current);
            const configMetadata =
                type === CanvasNodeType.Config
                    ? {
                          model: effectiveConfig.imageModel || effectiveConfig.model,
                          size: effectiveConfig.size,
                          count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count),
                      }
                    : undefined;
            const newNode = createCanvasNode(type, targetPosition, configMetadata);

            setNodes((prev) => [...prev, newNode]);
            setSelectedNodeIds(new Set([newNode.id]));
            setSelectedConnectionId(null);
            const definition = getNodeDefinition(type);
            // 纯展示型插件节点(hidePanel)不弹面板;插件自定义 Panel 需显式 autoOpenPanel 才在新建时打开;
            // 声明了 useBuiltinPanel 的插件节点复用内置生成面板,新建即打开(与图片节点一致);
            // 内置的视频/生图类节点保持原有「新建即打开面板」行为；图片节点只创建上传画框。
            const wantsPanel = definition?.hidePanel
                ? false
                : definition?.Panel
                  ? Boolean(definition.autoOpenPanel)
                  : definition?.useBuiltinPanel
                    ? true
                    : isBuiltinType(type) && type !== CanvasNodeType.Text && type !== CanvasNodeType.Audio && type !== CanvasNodeType.Group;
            if (wantsPanel) setDialogNodeId(newNode.id);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, getCanvasCenter],
    );

    const deleteNodes = useCallback(
        (ids: Set<string>) => {
            if (!ids.size) return;
            const allIds = new Set(ids);
            nodesRef.current.forEach((node) => {
                if (ids.has(node.id)) node.metadata?.batchChildIds?.forEach((childId) => allIds.add(childId));
            });
            setNodes((prev) => {
                const next = prev.filter((node) => !allIds.has(node.id));
                return next.map((node) => {
                    const groupId = node.metadata?.groupId;
                    if (groupId && allIds.has(groupId)) return { ...node, metadata: { ...node.metadata, groupId: undefined } };
                    const childIds = node.metadata?.batchChildIds?.filter((childId) => !allIds.has(childId));
                    if (!node.metadata?.isBatchRoot || childIds?.length === node.metadata.batchChildIds?.length) return node;
                    const primaryImageId = childIds?.includes(node.metadata.primaryImageId || "") ? node.metadata.primaryImageId : childIds?.[0];
                    const primaryNode = next.find((item) => item.id === primaryImageId);
                    return {
                        ...node,
                        metadata: {
                            ...node.metadata,
                            batchChildIds: childIds,
                            primaryImageId,
                            content: primaryNode?.metadata?.content || node.metadata.content,
                            naturalWidth: primaryNode?.metadata?.naturalWidth || node.metadata.naturalWidth,
                            naturalHeight: primaryNode?.metadata?.naturalHeight || node.metadata.naturalHeight,
                        },
                    };
                });
            });
            setConnections((prev) => prev.filter((conn) => !allIds.has(conn.fromNodeId) && !allIds.has(conn.toNodeId)));
            setSelectedNodeIds(new Set());
            setSelectedConnectionId(null);
            setHoveredNodeId((current) => (current && allIds.has(current) ? null : current));
            setToolbarNodeId((current) => (current && allIds.has(current) ? null : current));
            setDialogNodeId((current) => (current && allIds.has(current) ? null : current));
            setEditingNodeId((current) => (current && allIds.has(current) ? null : current));
            setInfoNodeId((current) => (current && allIds.has(current) ? null : current));
            setCropNodeId((current) => (current && allIds.has(current) ? null : current));
            setMaskEditNodeId((current) => (current && allIds.has(current) ? null : current));
            setAngleNodeId((current) => (current && allIds.has(current) ? null : current));
            setPreviewNodeId((current) => (current && allIds.has(current) ? null : current));
            setRunningNodeId((current) => (current && allIds.has(current) ? null : current));
            setContextMenu((current) => (current?.type === "node" && allIds.has(current.nodeId) ? null : current));
            cleanupCanvasFiles({ projectId, nodes: nodesRef.current.filter((node) => !allIds.has(node.id)), chatSessions });
        },
        [chatSessions, cleanupCanvasFiles, projectId],
    );

    const deleteConnection = useCallback((connectionId: string) => {
        setConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
        setSelectedConnectionId((current) => (current === connectionId ? null : current));
        setContextMenu((current) => (current?.type === "connection" && current.connectionId === connectionId ? null : current));
    }, []);

    const deselectCanvas = useCallback(() => {
        cancelPendingConnectionCreate();
        setSelectedNodeIds(new Set());
        setSelectedConnectionId(null);
        setContextMenu(null);
        setSelectionBox(null);
        setHoveredNodeId(null);
        setToolbarNodeId(null);
        setDialogNodeId(null);
        setEditingNodeId(null);
    }, [cancelPendingConnectionCreate]);

    const clearCanvas = useCallback(() => {
        setNodes([]);
        setConnections([]);
        setInfoNodeId(null);
        setCropNodeId(null);
        setMaskEditNodeId(null);
        setAngleNodeId(null);
        setPreviewNodeId(null);
        setRunningNodeId(null);
        deselectCanvas();
        setClearConfirmOpen(false);
        cleanupCanvasFiles({ projectId, nodes: [], chatSessions: [] });
    }, [cleanupCanvasFiles, deselectCanvas, projectId]);

    const duplicateNode = useCallback((nodeId: string) => {
        const source = nodesRef.current.find((node) => node.id === nodeId);
        if (!source) return;

        const id = `${source.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const next: CanvasNodeData = {
            ...source,
            id,
            title: `${source.title} Copy`,
            position: { x: source.position.x + 36, y: source.position.y + 36 },
        };

        setNodes((prev) => [...prev, next]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
        if (next.type !== CanvasNodeType.Group) setDialogNodeId(id);
    }, []);

    // 复制生图节点当前选中的结果图到系统剪贴板；非安全上下文（http 内网 IP 访问）降级为下载。
    const copyNodeImageToClipboard = useCallback(async (nodeId: string) => {
        const node = nodesRef.current.find((item) => item.id === nodeId);
        const images = node?.metadata?.generatedImages || [];
        if (!node || !images.length) {
            message.warning("当前节点没有可复制的图片");
            return;
        }
        const index = Math.max(0, Math.min(node.metadata?.selectedGeneratedImageIndex || 0, images.length - 1));
        const url = images[index]?.content || "";
        if (!url) {
            message.warning("当前节点没有可复制的图片");
            return;
        }
        try {
            const source = await fetch(url).then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.blob();
            });
            // Chrome 剪贴板仅稳定支持 image/png：统一经画布转码。
            const bitmap = await createImageBitmap(source);
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
            const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
            if (!png) throw new Error("PNG 编码失败");
            await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
            message.success("已复制当前图片");
        } catch {
            try {
                const link = document.createElement("a");
                link.href = url;
                link.download = `canvas-image-${Date.now()}.png`;
                link.click();
                message.info("当前环境不支持直接复制图片，已改为下载");
            } catch {
                message.error("复制图片失败");
            }
        }
    }, [message]);

    const copySelectedNodes = useCallback(() => {
        const selectedIds = selectedNodeIdsRef.current;
        if (!selectedIds.size) return;

        const copiedNodes = nodesRef.current
            .filter((node) => selectedIds.has(node.id))
            .map((node) => ({
                ...node,
                position: { ...node.position },
                metadata: node.metadata ? { ...node.metadata } : undefined,
            }));

        if (!copiedNodes.length) return;

        clipboardRef.current = {
            nodes: copiedNodes,
            connections: connectionsRef.current.filter((connection) => selectedIds.has(connection.fromNodeId) && selectedIds.has(connection.toNodeId)).map((connection) => ({ ...connection })),
        };
    }, []);

    const pasteCopiedNodes = useCallback(() => {
        const clipboard = clipboardRef.current;
        if (!clipboard?.nodes.length) return false;

        const center = getCanvasCenter();
        const bounds = clipboard.nodes.reduce(
            (acc, node) => ({
                left: Math.min(acc.left, node.position.x),
                top: Math.min(acc.top, node.position.y),
                right: Math.max(acc.right, node.position.x + node.width),
                bottom: Math.max(acc.bottom, node.position.y + node.height),
            }),
            { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
        );
        const dx = center.x - (bounds.left + bounds.right) / 2;
        const dy = center.y - (bounds.top + bounds.bottom) / 2;
        const idMap = new Map<string, string>();
        const nextNodes = clipboard.nodes.map((node, index) => {
            const id = `${node.type}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
            idMap.set(node.id, id);
            return {
                ...node,
                id,
                title: node.title.endsWith(" Copy") ? node.title : `${node.title} Copy`,
                position: {
                    x: node.position.x + dx,
                    y: node.position.y + dy,
                },
                metadata: node.metadata ? { ...node.metadata } : undefined,
            };
        });

        const pastedNodes = nextNodes.map((node) => {
            const groupId = node.metadata?.groupId;
            if (!groupId) return node;
            return { ...node, metadata: { ...node.metadata, groupId: idMap.get(groupId) } };
        });

        const nextConnections = clipboard.connections.flatMap((connection, index) => {
            const fromNodeId = idMap.get(connection.fromNodeId);
            const toNodeId = idMap.get(connection.toNodeId);
            if (!fromNodeId || !toNodeId) return [];
            return [
                {
                    ...connection,
                    id: `conn-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
                    fromNodeId,
                    toNodeId,
                },
            ];
        });

        setNodes((prev) => [...prev, ...pastedNodes]);
        setConnections((prev) => [...prev, ...nextConnections]);
        setSelectedNodeIds(new Set(pastedNodes.map((node) => node.id)));
        setSelectedConnectionId(null);
        setContextMenu(null);
        setDialogNodeId(pastedNodes[0]?.type === CanvasNodeType.Group ? null : pastedNodes[0]?.id || null);
        return true;
    }, [getCanvasCenter]);

    const resetViewport = useCallback(() => {
        setViewport({ x: size.width / 2, y: size.height / 2, k: 1 });
        setContextMenu(null);
    }, [size.height, size.width]);

    const focusNode = useCallback(
        (nodeId: string) => {
            const node = nodesRef.current.find((item) => item.id === nodeId);
            if (!node) return;
            const worldX = node.position.x + node.width / 2;
            const worldY = node.position.y + node.height / 2;
            const k = Math.min(Math.max(Math.min((size.width * 0.6) / node.width, (size.height * 0.6) / node.height), 0.05), 1.5);
            const target = { x: size.width / 2 - worldX * k, y: size.height / 2 - worldY * k, k };
            setSelectedNodeIds(new Set([nodeId]));
            setSelectedConnectionId(null);
            setContextMenu(null);

            if (focusAnimRef.current) cancelAnimationFrame(focusAnimRef.current);
            const start = { ...viewportRef.current };
            const duration = 450;
            const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
            let startTime: number | null = null;
            const step = (now: number) => {
                if (startTime === null) startTime = now;
                const progress = Math.min((now - startTime) / duration, 1);
                const t = easeOutCubic(progress);
                setViewport({ x: start.x + (target.x - start.x) * t, y: start.y + (target.y - start.y) * t, k: start.k + (target.k - start.k) * t });
                focusAnimRef.current = progress < 1 ? requestAnimationFrame(step) : null;
            };
            focusAnimRef.current = requestAnimationFrame(step);
        },
        [size.height, size.width],
    );

    useEffect(() => () => void (focusAnimRef.current && cancelAnimationFrame(focusAnimRef.current)), []);

    const setZoomScale = useCallback(
        (scale: number) => {
            const nextScale = Math.min(Math.max(scale, 0.05), 5);
            setViewport((prev) => ({
                x: size.width / 2 - ((size.width / 2 - prev.x) / prev.k) * nextScale,
                y: size.height / 2 - ((size.height / 2 - prev.y) / prev.k) * nextScale,
                k: nextScale,
            }));
            setContextMenu(null);
        },
        [size.height, size.width],
    );

    const applyHistory = useCallback((entry: CanvasHistoryEntry) => {
        if (historyCommitTimerRef.current) {
            clearTimeout(historyCommitTimerRef.current);
            historyCommitTimerRef.current = null;
        }
        applyingHistoryRef.current = true;
        setNodes(entry.nodes);
        setConnections(entry.connections);
        setChatSessions(entry.chatSessions);
        setActiveChatId(entry.activeChatId);
        setBackgroundMode(entry.backgroundMode);
        setShowImageInfo(entry.showImageInfo);
        setSelectedNodeIds(new Set());
        setSelectedConnectionId(null);
        setContextMenu(null);
        setTimeout(() => {
            lastHistoryRef.current = entry;
            applyingHistoryRef.current = false;
            setHistoryState({ canUndo: historyRef.current.past.length > 0, canRedo: historyRef.current.future.length > 0 });
        });
    }, []);

    const undoCanvas = useCallback(() => {
        const previous = historyRef.current.past.pop();
        const current = lastHistoryRef.current;
        if (!previous || !current) return;
        historyRef.current.future.push(current);
        applyHistory(previous);
    }, [applyHistory]);

    const redoCanvas = useCallback(() => {
        const next = historyRef.current.future.pop();
        const current = lastHistoryRef.current;
        if (!next || !current) return;
        historyRef.current.past.push(current);
        applyHistory(next);
    }, [applyHistory]);

    const createAndOpenProject = useCallback(() => {
        void createProject(`无限画布 ${useCanvasStore.getState().projects.length + 1}`)
            .then((id) => navigate(`/canvas/${id}`))
            .catch(() => message.error("创建画布失败，请重试"));
    }, [createProject, message, navigate]);

    const deleteCurrentProject = useCallback(() => {
        void deleteProjects([projectId])
            .then(() => {
                cleanupAssetImages();
                navigate("/canvas");
            })
            .catch(() => message.error("删除画布失败，请重试"));
    }, [cleanupAssetImages, deleteProjects, message, navigate, projectId]);

    const exportCurrentProject = useCallback(async () => {
        const project = useCanvasStore.getState().projects.find((item) => item.id === projectId);
        if (!project) return message.error("未找到当前画布");
        const hide = message.loading("正在导出当前画布…", 0);
        try {
            await exportCanvasProjects([project], project.title || "无限画布");
            message.success("已导出当前画布");
        } catch (error) {
            console.error(error);
            message.error("导出失败，请重试");
        } finally {
            hide();
        }
    }, [message, projectId]);

    const handleCanvasMouseDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            setContextMenu(null);
            setNodeCreatePosition(null);
            if (pendingConnectionCreateRef.current) cancelPendingConnectionCreate();
            if (event.button !== 0) return;

            if (!event.ctrlKey && !event.metaKey) {
                setSelectionBox(null);
                setSelectedNodeIds(new Set());
                setSelectedConnectionId(null);
                return;
            }

            const world = screenToCanvas(event.clientX, event.clientY);
            const nextSelectionBox = {
                startWorldX: world.x,
                startWorldY: world.y,
                currentWorldX: world.x,
                currentWorldY: world.y,
                additive: event.shiftKey,
                initialSelectedNodeIds: event.shiftKey ? Array.from(selectedNodeIdsRef.current) : [],
            };
            selectionBoxRef.current = nextSelectionBox;
            setSelectionBox(nextSelectionBox);
            if (!event.shiftKey) {
                setSelectedNodeIds(new Set());
            }

            setSelectedConnectionId(null);
        },
        [cancelPendingConnectionCreate, screenToCanvas],
    );

    // 仅处理「选中」的纯逻辑,供 body 冒泡拖拽入口与外层 capture 入口共用。
    // 返回本次点击后的单选目标 id(多选/取消时为 null),用于同步工具条。
    const selectNodeByEvent = useCallback((event: Pick<ReactMouseEvent, "shiftKey" | "metaKey" | "ctrlKey">, nodeId: string) => {
        const nextSelected = new Set(selectedNodeIdsRef.current);
        if (event.shiftKey || event.metaKey || event.ctrlKey) {
            if (nextSelected.has(nodeId)) nextSelected.delete(nodeId);
            else nextSelected.add(nodeId);
        } else if (!nextSelected.has(nodeId)) {
            nextSelected.clear();
            nextSelected.add(nodeId);
        }
        setSelectedNodeIds(nextSelected);
        const soloId = nextSelected.size === 1 && nextSelected.has(nodeId) ? nodeId : null;
        setToolbarNodeId(soloId);
        return { nextSelected, soloId };
    }, []);

    // capture 阶段选中:点击节点内部任意元素(含吞掉 mousedown 的 textarea/iframe)都能选中并弹出工具条。
    // 只做选中,不启动拖拽 —— 拖拽仍由 body 的 onMouseDown(冒泡)负责,故编辑器内选词不会拖动节点。
    // capture 必先于同一次事件的 body 冒泡触发,故把算好的选中集暂存,供紧随其后的拖拽入口复用,避免二次选中(shift 反选被抵消)。
    const pendingSelectionRef = useRef<Set<string> | null>(null);
    const handleNodeSelectCapture = useCallback(
        (event: ReactMouseEvent, nodeId: string) => {
            if (event.button !== 0) return;
            setContextMenu(null);
            setHoveredNodeId(null);
            setSelectedConnectionId(null);
            const { nextSelected } = selectNodeByEvent(event, nodeId);
            pendingSelectionRef.current = nextSelected;
        },
        [selectNodeByEvent],
    );

    const handleNodeMouseDown = useCallback((event: ReactMouseEvent, nodeId: string) => {
        event.stopPropagation();
        // 选中已由 capture 阶段完成;这里只负责建立拖拽。若因故没走 capture,则兜底再选一次。
        const currentNodes = nodesRef.current;
        const nextSelected = pendingSelectionRef.current ?? selectNodeByEvent(event, nodeId).nextSelected;
        pendingSelectionRef.current = null;
        const dragIds = new Set(nextSelected);
        currentNodes.forEach((node) => {
            if (!nextSelected.has(node.id)) return;
            node.metadata?.batchChildIds?.forEach((childId) => dragIds.add(childId));
            if (node.type === CanvasNodeType.Group) {
                currentNodes.forEach((child) => {
                    if (child.metadata?.groupId === node.id) dragIds.add(child.id);
                });
            }
        });
        dragRef.current = {
            isDraggingNode: true,
            hasMoved: false,
            startX: event.clientX,
            startY: event.clientY,
            initialSelectedNodes: currentNodes.filter((node) => dragIds.has(node.id)).map((node) => ({ id: node.id, x: node.position.x, y: node.position.y })),
        };
        historyPausedRef.current = true;
        nodeDraggingRef.current = true;
        setIsNodeDragging(true);
    }, []);

    const finishNodeDrag = useCallback((clientX?: number, clientY?: number) => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (!dragRef.current.isDraggingNode) return;

        const wasClick = !dragRef.current.hasMoved && dragRef.current.initialSelectedNodes.length === 1;
        const clickedNodeId = dragRef.current.initialSelectedNodes[0]?.id;
        const currentViewport = viewportRef.current;
        const dx = clientX == null ? 0 : (clientX - dragRef.current.startX) / currentViewport.k;
        const dy = clientY == null ? 0 : (clientY - dragRef.current.startY) / currentViewport.k;
        const initialPositions = dragRef.current.initialSelectedNodes;

        historyPausedRef.current = false;
        nodeDraggingRef.current = false;
        setIsNodeDragging(false);
        setDropTargetGroupId(null);
        if (dragRef.current.hasMoved && clientX != null && clientY != null) {
            const movedIds = new Set(initialPositions.map((item) => item.id));
            setNodes((prev) => {
                const moved = prev.map((node) => {
                    const initial = initialPositions.find((item) => item.id === node.id);
                    return initial ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : node;
                });
                const targetGroup = findGroupDropTarget(movedIds, moved);
                if (targetGroup) return snapNodesIntoGroup(movedIds, moved, targetGroup);
                return moved.map((node) => {
                    if (!movedIds.has(node.id) || node.type === CanvasNodeType.Group) return node;
                    const groupId = findContainingGroupId(node, moved);
                    if (node.metadata?.groupId === groupId) return node;
                    return { ...node, metadata: { ...node.metadata, groupId } };
                });
            });
        }

        dragRef.current.isDraggingNode = false;
        dragRef.current.hasMoved = false;
        dragRef.current.initialSelectedNodes = [];
        if (wasClick && clickedNodeId) {
            const clickedNode = nodesRef.current.find((node) => node.id === clickedNodeId);
            const clickedDefinition = clickedNode ? getNodeDefinition(clickedNode.type) : undefined;
            if (clickedNode?.type === CanvasNodeType.Text) {
                setDialogNodeId((current) => (current === clickedNodeId ? current : null));
            } else if (clickedDefinition?.hidePanel) {
                // 纯展示型插件节点:单击只选中,不弹下方面板
                setDialogNodeId((current) => (current === clickedNodeId ? current : null));
            } else if (clickedNode?.type !== CanvasNodeType.Group) {
                setDialogNodeId(clickedNodeId);
            }
        }
    }, []);

    const handleGlobalMouseMove = useCallback(
        (event: MouseEvent) => {
            const currentViewport = viewportRef.current;

            if (dragRef.current.isDraggingNode) {
                const dx = (event.clientX - dragRef.current.startX) / currentViewport.k;
                const dy = (event.clientY - dragRef.current.startY) / currentViewport.k;
                const initialPositions = dragRef.current.initialSelectedNodes;
                if (Math.abs(event.clientX - dragRef.current.startX) > 3 || Math.abs(event.clientY - dragRef.current.startY) > 3) {
                    dragRef.current.hasMoved = true;
                }

                const movedIds = new Set(initialPositions.map((item) => item.id));
                const previewNodes = nodesRef.current.map((node) => {
                    const initial = initialPositions.find((item) => item.id === node.id);
                    return initial ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : node;
                });
                setDropTargetGroupId(findGroupDropTarget(movedIds, previewNodes)?.id || null);

                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(() => {
                    setNodes((prev) =>
                        prev.map((node) => {
                            const initial = initialPositions.find((item) => item.id === node.id);
                            return initial ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : node;
                        }),
                    );
                    rafRef.current = null;
                });
                return;
            }

            if (connectingParamsRef.current && !pendingConnectionCreateRef.current) {
                const dropTarget = getConnectionDropTarget(event.clientX, event.clientY, connectingParamsRef.current);
                connectionTargetNodeIdRef.current = dropTarget.nodeId;
                setConnectionTargetNodeId(dropTarget.nodeId);
                setMouseWorld(screenToCanvas(event.clientX, event.clientY));
            }
        },
        [finishNodeDrag, getConnectionDropTarget, screenToCanvas],
    );

    const handleGlobalPointerMove = useCallback(
        (event: PointerEvent) => {
            const currentSelection = selectionBoxRef.current;
            if (!currentSelection) return;

            if (event.buttons === 0) {
                selectionBoxRef.current = null;
                setSelectionBox(null);
                return;
            }

            const world = screenToCanvas(event.clientX, event.clientY);
            const rectX = Math.min(currentSelection.startWorldX, world.x);
            const rectY = Math.min(currentSelection.startWorldY, world.y);
            const rectW = Math.abs(world.x - currentSelection.startWorldX);
            const rectH = Math.abs(world.y - currentSelection.startWorldY);
            const nextSelected = new Set<string>(currentSelection.additive ? currentSelection.initialSelectedNodeIds : []);

            nodesRef.current
                .filter((node) => !isHiddenBatchChild(node, nodesRef.current))
                .forEach((node) => {
                    const intersects = rectX < node.position.x + node.width && rectX + rectW > node.position.x && rectY < node.position.y + node.height && rectY + rectH > node.position.y;

                    if (intersects) nextSelected.add(node.id);
                });

            const nextSelectionBox = { ...currentSelection, currentWorldX: world.x, currentWorldY: world.y };
            selectionBoxRef.current = nextSelectionBox;
            setSelectionBox(nextSelectionBox);
            setSelectedNodeIds(nextSelected);
        },
        [screenToCanvas],
    );

    const handleGlobalMouseUp = useCallback(
        (event: MouseEvent) => {
            finishNodeDrag(event.clientX, event.clientY);

            selectionBoxRef.current = null;
            setSelectionBox(null);

            if (pendingConnectionCreateRef.current) return;

            const currentConnection = connectingParamsRef.current;
            if (currentConnection) {
                const dropTarget = getConnectionDropTarget(event.clientX, event.clientY, currentConnection);
                if (dropTarget.nodeId) {
                    connectNodes(currentConnection, dropTarget.nodeId);
                    setConnecting(null);
                } else if (dropTarget.isNearNode) {
                    setConnecting(null);
                } else {
                    const canvasRect = containerRef.current?.getBoundingClientRect();
                    setMouseWorld(screenToCanvas(event.clientX, event.clientY));
                    setPendingConnectionCreate({
                        connection: currentConnection,
                        position: screenToCanvas(event.clientX, event.clientY),
                        menuPosition: {
                            x: event.clientX - (canvasRect?.left || 0),
                            y: event.clientY - (canvasRect?.top || 0),
                        },
                    });
                }
            }
        },
        [connectNodes, finishNodeDrag, getConnectionDropTarget, screenToCanvas, setConnecting],
    );

    useEffect(() => {
        const handlePointerUp = (event: PointerEvent) => finishNodeDrag(event.clientX, event.clientY);
        const cancelNodeDrag = () => finishNodeDrag();
        window.addEventListener("mousemove", handleGlobalMouseMove);
        window.addEventListener("mouseup", handleGlobalMouseUp);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", cancelNodeDrag);
        window.addEventListener("blur", cancelNodeDrag);
        window.addEventListener("pointermove", handleGlobalPointerMove);
        return () => {
            window.removeEventListener("mousemove", handleGlobalMouseMove);
            window.removeEventListener("mouseup", handleGlobalMouseUp);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", cancelNodeDrag);
            window.removeEventListener("blur", cancelNodeDrag);
            window.removeEventListener("pointermove", handleGlobalPointerMove);
        };
    }, [finishNodeDrag, handleGlobalMouseMove, handleGlobalMouseUp, handleGlobalPointerMove]);

    const createImageFileNode = useCallback(async (file: File, position: Position) => {
        const image = await uploadImage(file);
        const size = fitNodeSize(image.width, image.height);
        const id = `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newNode: CanvasNodeData = {
            id,
            type: CanvasNodeType.Image,
            title: file.name,
            position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
            width: size.width,
            height: size.height,
            metadata: imageMetadata(image),
        };

        setNodes((prev) => [...prev, newNode]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
        setDialogNodeId(id);
    }, []);

    const createVideoFileNode = useCallback(async (file: File, position: Position) => {
        const video = await uploadMediaFile(file, "video");
        const size = fitNodeSize(video.width || 1280, video.height || 720, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
        const id = `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setNodes((prev) => [
            ...prev,
            {
                id,
                type: CanvasNodeType.Video,
                title: file.name,
                position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
                width: size.width,
                height: size.height,
                metadata: videoMetadata(video),
            },
        ]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
        setDialogNodeId(id);
    }, []);

    const createAudioFileNode = useCallback(async (file: File, position: Position) => {
        const audio = await uploadMediaFile(file, "audio");
        const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
        const id = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setNodes((prev) => [
            ...prev,
            {
                id,
                type: CanvasNodeType.Audio,
                title: file.name,
                position: { x: position.x - spec.width / 2, y: position.y - spec.height / 2 },
                width: spec.width,
                height: spec.height,
                metadata: audioMetadata(audio),
            },
        ]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
    }, []);

    const createTextNodeFromClipboard = useCallback(
        (text: string) => {
            const trimmed = text.trim();
            if (!trimmed) return false;

            const node = {
                ...createCanvasNode(CanvasNodeType.Text, getCanvasCenter(), { content: trimmed, status: NODE_STATUS_SUCCESS }),
                title: trimmed.slice(0, 32) || "剪切板文本",
            };

            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([node.id]));
            setSelectedConnectionId(null);
            setContextMenu(null);
            setDialogNodeId(node.id);
            return true;
        },
        [getCanvasCenter],
    );

    const pasteSystemClipboard = useCallback(async () => {
        if (!navigator.clipboard) return;

        const items = await navigator.clipboard.read();
        const imageItem = items.find((item) => item.types.some((type) => type.startsWith("image/")));
        if (imageItem) {
            const imageType = imageItem.types.find((type) => type.startsWith("image/"));
            if (!imageType) return;
            const blob = await imageItem.getType(imageType);
            const file = new File([blob], "clipboard-image.png", { type: imageType });
            void createImageFileNode(file, getCanvasCenter());
            message.success("已从剪切板添加图片");
            return;
        }

        const text = await navigator.clipboard.readText();
        if (createTextNodeFromClipboard(text)) message.success("已从剪切板添加文本");
    }, [createImageFileNode, createTextNodeFromClipboard, getCanvasCenter, message]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target instanceof Element ? event.target : null;
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || target?.closest("[contenteditable='true'],[data-canvas-no-zoom]")) return;

            const key = event.key.toLowerCase();
            const isModifierShortcut = event.metaKey || event.ctrlKey;

            if (isModifierShortcut && !event.altKey && key === "z") {
                event.preventDefault();
                if (event.shiftKey) redoCanvas();
                else undoCanvas();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "y") {
                event.preventDefault();
                redoCanvas();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "a") {
                event.preventDefault();
                setSelectedNodeIds(new Set(nodesRef.current.map((node) => node.id)));
                setSelectedConnectionId(null);
                setContextMenu(null);
                setSelectionBox(null);
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "c") {
                event.preventDefault();
                copySelectedNodes();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "v") {
                event.preventDefault();
                if (!pasteCopiedNodes()) void pasteSystemClipboard();
                return;
            }

            if (event.key === "Delete" || event.key === "Backspace") {
                if (selectedNodeIdsRef.current.size) {
                    deleteNodes(new Set(selectedNodeIdsRef.current));
                } else if (selectedConnectionId) {
                    deleteConnection(selectedConnectionId);
                }
            }

            if (event.key === "Escape") {
                setSelectedNodeIds(new Set());
                setSelectedConnectionId(null);
                setContextMenu(null);
                setNodeCreatePosition(null);
                setSelectionBox(null);
                setConnecting(null);
                setHoveredNodeId(null);
                setToolbarNodeId(null);
                setDialogNodeId(null);
                setEditingNodeId(null);
                setInfoNodeId(null);
                setCropNodeId(null);
                setMaskEditNodeId(null);
                setPendingConnectionCreate(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [copySelectedNodes, deleteConnection, deleteNodes, pasteCopiedNodes, pasteSystemClipboard, redoCanvas, selectedConnectionId, setConnecting, undoCanvas]);

    const handleConnectStart = useCallback(
        (event: ReactMouseEvent, nodeId: string, handleType: "source" | "target") => {
            event.stopPropagation();
            setMouseWorld(screenToCanvas(event.clientX, event.clientY));
            setConnecting({ nodeId, handleType });
            connectionTargetNodeIdRef.current = null;
            setConnectionTargetNodeId(null);
            setSelectedConnectionId(null);
        },
        [screenToCanvas, setConnecting],
    );

    const handleNodeResize = useCallback((nodeId: string, width: number, height: number, position?: Position) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, width, height, position: position || node.position } : node)));
    }, []);

    const toggleNodeFreeResize = useCallback((nodeId: string) => {
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== nodeId) return node;
                const freeResize = !node.metadata?.freeResize;
                if (freeResize || node.type !== CanvasNodeType.Image) return { ...node, metadata: { ...node.metadata, freeResize } };
                const ratio = (node.metadata?.naturalWidth || node.width) / (node.metadata?.naturalHeight || node.height || 1);
                const height = node.width / ratio;
                return { ...node, height, position: { x: node.position.x, y: node.position.y + node.height / 2 - height / 2 }, metadata: { ...node.metadata, freeResize } };
            }),
        );
    }, []);

    const handleNodeContentChange = useCallback((nodeId: string, content: string) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, content } } : node)));
    }, []);

    const handleNodeTitleChange = useCallback((nodeId: string, title: string) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, title } : node)));
    }, []);

    const toggleBatchExpanded = useCallback((nodeId: string) => {
        const isExpanded = Boolean(nodesRef.current.find((node) => node.id === nodeId)?.metadata?.imageBatchExpanded);
        if (isExpanded) {
            setCollapsingBatchIds((prev) => new Set(prev).add(nodeId));
            window.setTimeout(() => {
                setCollapsingBatchIds((prev) => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                });
            }, 320);
        } else {
            setOpeningBatchIds((prev) => new Set(prev).add(nodeId));
            window.setTimeout(() => {
                setOpeningBatchIds((prev) => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                });
            }, 260);
        }
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== nodeId) return node;
                return { ...node, metadata: { ...node.metadata, imageBatchExpanded: !node.metadata?.imageBatchExpanded } };
            }),
        );
    }, []);

    const setBatchPrimary = useCallback((child: CanvasNodeData) => {
        const rootId = child.metadata?.batchRootId;
        if (!rootId || !child.metadata?.content) return;
        setNodes((prev) =>
            prev.map((node) =>
                node.id === rootId
                    ? {
                          ...node,
                          width: child.width,
                          height: child.height,
                          metadata: {
                              ...node.metadata,
                              content: child.metadata?.content,
                              primaryImageId: child.id,
                              naturalWidth: child.metadata?.naturalWidth,
                              naturalHeight: child.metadata?.naturalHeight,
                              freeResize: child.metadata?.freeResize,
                          },
                      }
                    : node,
            ),
        );
    }, []);

    const openTextEditor = useCallback((node: CanvasNodeData) => {
        if (node.type !== CanvasNodeType.Text) return;
        setSelectedNodeIds(new Set([node.id]));
        setSelectedConnectionId(null);
        setDialogNodeId(node.id);
        setEditingNodeId(node.id);
        setEditRequestNonce((value) => value + 1);
    }, []);

    const handleNodePromptChange = useCallback((nodeId: string, prompt: string) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, prompt } } : node)));
    }, []);

    const handleConfigNodeChange = useCallback((nodeId: string, patch: Partial<CanvasNodeData["metadata"]>) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? applyNodeConfigPatch(node, patch) : node)));
    }, []);

    const downloadNodeImage = useCallback((node: CanvasNodeData) => {
        if ((node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Video && node.type !== CanvasNodeType.Audio) || !node.metadata?.content) return;
        saveAs(node.metadata.content, `canvas-${node.type}-${node.id}.${node.type === CanvasNodeType.Video ? "mp4" : node.type === CanvasNodeType.Audio ? audioExtension(node.metadata.mimeType) : imageExtension(node.metadata.content)}`);
    }, []);

    // 反推提示词（Task 9）：直接调用同源 /api/image-tools/reverse-prompt，结果写入新文本节点；
    // 文本节点经 metadata.sourceNodeId/derivedFrom 与连线保持与原图节点的可追溯关系。
    const createImageReversePromptNodes = useCallback(
        async (node: CanvasNodeData) => {
            if (node.type !== CanvasNodeType.Image || !node.metadata?.content) {
                message.warning("图片节点为空，无法反推提示词");
                return;
            }

            const gap = 96;
            const textSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Text];
            const centerY = node.position.y + node.height / 2;
            const textNode = {
                ...createCanvasNode(
                    CanvasNodeType.Text,
                    { x: node.position.x + node.width + gap + textSpec.width / 2, y: centerY },
                    { content: "", status: NODE_STATUS_LOADING, fontSize: 14, sourceNodeId: node.id, derivedFrom: "reverse-prompt" },
                ),
                title: "反推提示词",
            };

            setNodes((prev) => [...prev, textNode]);
            setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: textNode.id }]);
            setSelectedNodeIds(new Set([textNode.id]));
            setSelectedConnectionId(null);
            setDialogNodeId(textNode.id);
            setContextMenu(null);

            try {
                const imageUrl = await imageToDataUrl({ url: node.metadata.content, storageKey: node.metadata.storageKey });
                const result = await getImageToolsApi().reversePrompt({ imageUrl });
                setNodes((prev) =>
                    prev.map((item) => (item.id === textNode.id ? { ...item, metadata: { ...item.metadata, content: result.prompt, prompt: result.prompt, status: NODE_STATUS_SUCCESS } } : item)),
                );
            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : "反推提示词失败";
                message.error(errorDetails);
                setNodes((prev) => prev.map((item) => (item.id === textNode.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            }
        },
        [message],
    );

    reversePromptNodeRef.current = (nodeId: string) => {
        const target = nodesRef.current.find((node) => node.id === nodeId);
        if (target) void createImageReversePromptNodes(target);
    };

    const cropImageNode = useCallback(async (node: CanvasNodeData, crop: CanvasImageCropRect) => {
        if (!node.metadata?.content) return;
        const cropped = await cropDataUrl(node.metadata.content, crop);
        const image = await uploadImage(cropped);
        const width = Math.min(node.width, Math.max(220, image.width));
        const childId = nanoid();
        const child: CanvasNodeData = {
            id: childId,
            type: CanvasNodeType.Image,
            title: "Cropped Image",
            position: { x: node.position.x + node.width + 96, y: node.position.y },
            width,
            height: width * (image.height / image.width),
            metadata: {
                ...imageMetadata(image),
                prompt: node.metadata?.prompt,
            },
        };
        setNodes((prev) => [...prev, child]);
        setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
        setSelectedNodeIds(new Set([childId]));
        setDialogNodeId(childId);
        setCropNodeId(null);
    }, []);

    const splitImageNode = useCallback(
        async (node: CanvasNodeData, params: CanvasImageSplitParams) => {
            if (!node.metadata?.content) return;
            setSplitNodeId(null);
            const pieces = await splitDataUrl(node.metadata.content, params);
            const gap = 16;
            const cellWidth = node.width / params.columns;
            const cellHeight = node.height / params.rows;
            const startX = node.position.x + node.width + 96;
            const startY = node.position.y;
            const childNodes = await Promise.all(
                pieces.map(async (piece) => {
                    const image = await uploadImage(piece.dataUrl);
                    const id = nanoid();
                    return {
                        id,
                        type: CanvasNodeType.Image,
                        title: `${node.title || "图片"} ${piece.row + 1}-${piece.column + 1}`,
                        position: { x: startX + piece.column * (cellWidth + gap), y: startY + piece.row * (cellHeight + gap) },
                        width: cellWidth,
                        height: cellHeight,
                        metadata: {
                            ...imageMetadata(image),
                            prompt: node.metadata?.prompt,
                        },
                    } satisfies CanvasNodeData;
                }),
            );
            setNodes((prev) => [...prev, ...childNodes]);
            setConnections((prev) => [...prev, ...childNodes.map((child) => ({ id: nanoid(), fromNodeId: node.id, toNodeId: child.id }))]);
            setSelectedNodeIds(new Set(childNodes.map((child) => child.id)));
            setSelectedConnectionId(null);
            setDialogNodeId(null);
            message.success(`已切分为 ${childNodes.length} 个子节点`);
        },
        [message],
    );

    // 局部重绘/智能擦除（Task 9）：提交层走同源 /api/image-tools/inpaint|erase，不再用上游 requestEdit。
    // mask 语义：PNG 透明区=重绘区、白色不透明区=保留区（与后端提示词契约一致）。
    // 结果由后端写入云端资产库：优先按 assetId 纳入瞬态缓存，节点保存 storageKey="asset:<assetId>"，不存永久签名 URL。
    const maskEditImageNode = useCallback(
        async (node: CanvasNodeData, payload: CanvasImageMaskEditPayload) => {
            if (!node.metadata?.content) return;
            const operation = payload.operation === "erase" ? "erase" : "inpaint";
            const userPrompt = payload.prompt.trim();
            const prompt = operation === "erase" ? userPrompt || "智能擦除涂抹区域" : `只修改蒙版透明区域，其他区域保持不变。${userPrompt}`;
            const childId = nanoid();
            setMaskEditNodeId(null);
            setRunningNodeId(childId);
            setNodes((prev) => [
                ...prev,
                {
                    id: childId,
                    type: CanvasNodeType.Image,
                    title: userPrompt.slice(0, 32) || (operation === "erase" ? "智能擦除结果" : "局部编辑结果"),
                    position: { x: node.position.x + node.width + 96, y: node.position.y },
                    width: node.width,
                    height: node.height,
                    metadata: { prompt, status: NODE_STATUS_LOADING, sourceNodeId: node.id, derivedFrom: operation },
                },
            ]);
            setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
            setSelectedNodeIds(new Set([childId]));
            setSelectedConnectionId(null);
            setDialogNodeId(childId);
            const controller = startGenerationRequest(childId, node.id, childId);
            try {
                const imageUrl = await imageToDataUrl({ url: node.metadata.content, storageKey: node.metadata.storageKey });
                const toolInput = { imageUrl, maskDataUrl: payload.maskDataUrl, width: node.metadata.naturalWidth, height: node.metadata.naturalHeight };
                const result =
                    operation === "erase"
                        ? await getImageToolsApi().erase({ ...toolInput, prompt: userPrompt || undefined })
                        : await getImageToolsApi().inpaint({ ...toolInput, prompt: userPrompt });
                const uploaded = (result.assetId ? await adoptCloudAssetImage(result.assetId, result.accessUrl) : null) || (await uploadImage(result.image.url));
                const size = fitNodeSize(uploaded.width, uploaded.height, node.width, node.height);
                setNodes((prev) =>
                    prev.map((item) =>
                        item.id === childId
                            ? { ...item, width: size.width, height: size.height, metadata: { ...item.metadata, ...imageMetadata(uploaded), prompt, sourceNodeId: node.id, derivedFrom: operation } }
                            : item,
                    ),
                );
            } catch (error) {
                if (isGenerationCanceled(error)) return;
                const errorDetails = error instanceof Error ? error.message : operation === "erase" ? "智能擦除失败" : "局部修改失败";
                message.error(errorDetails);
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            } finally {
                finishGenerationRequest(childId, controller);
                setRunningNodeId(null);
            }
        },
        [finishGenerationRequest, message, startGenerationRequest],
    );

    // 扩图（Task 9）：同源 /api/image-tools/outpaint；结果作为新图片节点插入，不覆盖原图。
    const outpaintImageNode = useCallback(
        async (node: CanvasNodeData, params: CanvasOutpaintParams) => {
            if (!node.metadata?.content || outpaintSubmitting) return;
            setOutpaintSubmitting(true);
            const childId = nanoid();
            try {
                const imageUrl = await imageToDataUrl({ url: node.metadata.content, storageKey: node.metadata.storageKey });
                const result = await getImageToolsApi().outpaint({
                    imageUrl,
                    prompt: params.prompt || undefined,
                    ratio: params.ratio,
                    anchor: params.anchor,
                    width: node.metadata.naturalWidth,
                    height: node.metadata.naturalHeight,
                });
                const uploaded = (result.assetId ? await adoptCloudAssetImage(result.assetId, result.accessUrl) : null) || (await uploadImage(result.image.url));
                const size = fitNodeSize(uploaded.width, uploaded.height);
                const prompt = params.prompt || `扩图 ${params.ratio}`;
                setNodes((prev) => [
                    ...prev,
                    {
                        id: childId,
                        type: CanvasNodeType.Image,
                        title: prompt.slice(0, 32),
                        position: { x: node.position.x + node.width + 96, y: node.position.y },
                        width: size.width,
                        height: size.height,
                        metadata: { ...imageMetadata(uploaded), prompt, sourceNodeId: node.id, derivedFrom: "outpaint" },
                    },
                ]);
                setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
                setSelectedNodeIds(new Set([childId]));
                setSelectedConnectionId(null);
                setDialogNodeId(childId);
                setOutpaintNodeId(null);
            } catch (error) {
                message.error(error instanceof Error ? error.message : "扩图失败");
            } finally {
                setOutpaintSubmitting(false);
            }
        },
        [message, outpaintSubmitting],
    );

    const upscaleImageNode = useCallback(async (node: CanvasNodeData, params: CanvasImageUpscaleParams) => {
        if (!node.metadata?.content) return;
        setUpscaleNodeId(null);
        const upscaled = await upscaleDataUrl(node.metadata.content, params);
        const image = await uploadImage(upscaled);
        const size = fitNodeSize(image.width, image.height);
        const childId = nanoid();
        const child: CanvasNodeData = {
            id: childId,
            type: CanvasNodeType.Image,
            title: "Upscaled Image",
            position: { x: node.position.x + node.width + 96, y: node.position.y },
            width: size.width,
            height: size.height,
            metadata: {
                ...imageMetadata(image),
                prompt: node.metadata?.prompt,
            },
        };
        setNodes((prev) => [...prev, child]);
        setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
        setSelectedNodeIds(new Set([childId]));
        setDialogNodeId(childId);
    }, []);

    // 多角度（Task 9）：提交层改走 Task 8 同源持久生图任务（参考图图生图），不再用上游 requestEdit；
    // 结果经 resolveGenerationTaskImage 复用云端资产（storageKey="asset:<assetId>"），与原节点保持可追溯关系。
    const generateAngleNode = useCallback(
        async (node: CanvasNodeData, params: CanvasImageAngleParams) => {
            if (!node.metadata?.content) return;
            const generationConfig = { ...buildGenerationConfig(effectiveConfig, node, "image"), count: "1" };
            // 模型留空时不再硬阻断：与生图节点一致，交给服务端按当前线路默认模型解析
            // （此前新用户未选模型时点「多角度」直接报错，属于工具可用性缺口）。
            const childId = nanoid();
            const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
            const title = buildAngleLabel(params);
            const prompt = buildAnglePrompt(params);
            const generationMetadata = buildImageGenerationMetadata("edit", generationConfig, 1, [
                { id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: node.metadata.content, storageKey: node.metadata.storageKey },
            ]);
            setAngleNodeId(null);
            setRunningNodeId(childId);
            setNodes((prev) => [
                ...prev,
                {
                    id: childId,
                    type: CanvasNodeType.Image,
                    title,
                    position: { x: node.position.x + node.width + 96, y: node.position.y },
                    width: imageConfig.width,
                    height: imageConfig.height,
                    metadata: { prompt, status: NODE_STATUS_LOADING, sourceNodeId: node.id, derivedFrom: "angle", ...generationMetadata },
                },
            ]);
            setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
            setSelectedNodeIds(new Set([childId]));
            setDialogNodeId(childId);
            const controller = startGenerationRequest(childId, node.id, childId);
            try {
                const referenceDataUrl = await imageToDataUrl({ url: node.metadata.content, storageKey: node.metadata.storageKey });
                const submitted = await submitNodeImageGeneration(getGenerationApi(), {
                    prompt,
                    model: generationConfig.model,
                    routeId: node.metadata?.routeId,
                    size: generationConfig.size,
                    quality: generationConfig.quality,
                    imageCount: 1,
                    referenceImages: [{ id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: referenceDataUrl, storageKey: node.metadata.storageKey }],
                    clientRequestId: createClientRequestId(),
                });
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, metadata: { ...item.metadata, generationTask: taskStateFromGenerationTask(submitted, 0) } } : item)));
                const final = await waitNodeImageGeneration(getGenerationApi(), submitted.taskId, {
                    signal: controller.signal,
                    onUpdate: (task) => updateGenerationTaskNodes(task),
                });
                updateGenerationTaskNodes(final);
                if (final.status !== "success" || !final.images[0]) throw new Error(generationTaskFailureDetails(final));
                const uploaded = await resolveGenerationTaskImage(final.images[0]);
                const size = fitNodeSize(uploaded.width, uploaded.height, imageConfig.width, imageConfig.height);
                setNodes((prev) =>
                    prev.map((item) =>
                        item.id === childId
                            ? { ...item, width: size.width, height: size.height, metadata: { ...item.metadata, ...imageMetadata(uploaded), prompt, sourceNodeId: node.id, derivedFrom: "angle", ...generationMetadata } }
                            : item,
                    ),
                );
                refreshAccountAfterGenerationTask();
            } catch (error) {
                if (isGenerationCanceled(error)) return;
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            } finally {
                finishGenerationRequest(childId, controller);
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, finishGenerationRequest, message, startGenerationRequest, updateGenerationTaskNodes, refreshAccountAfterGenerationTask],
    );

    // AI 超分（原「暂未实现」占位）：走 Task 8 同源持久生图任务，图生图方式提升分辨率与细节。
    const superResolveImageNode = useCallback(
        async (node: CanvasNodeData) => {
            if (!node.metadata?.content) return;
            const generationConfig = { ...buildGenerationConfig(effectiveConfig, node, "image"), count: "1" };
            const childId = nanoid();
            const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
            const title = "AI 超分";
            const prompt = "将参考图超分辨率增强：提升分辨率、锐化细节、修复模糊与压缩伪影，保持主体、构图、颜色、材质和所有文字完全一致，不添加新元素、不改变画面内容。";
            const generationMetadata = buildImageGenerationMetadata("edit", generationConfig, 1, [
                { id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: node.metadata.content, storageKey: node.metadata.storageKey },
            ]);
            setSuperResolveNodeId(null);
            setRunningNodeId(childId);
            setNodes((prev) => [
                ...prev,
                {
                    id: childId,
                    type: CanvasNodeType.Image,
                    title,
                    position: { x: node.position.x + node.width + 96, y: node.position.y },
                    width: imageConfig.width,
                    height: imageConfig.height,
                    metadata: { prompt, status: NODE_STATUS_LOADING, sourceNodeId: node.id, derivedFrom: "superResolve", ...generationMetadata },
                },
            ]);
            setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
            setSelectedNodeIds(new Set([childId]));
            setDialogNodeId(childId);
            const controller = startGenerationRequest(childId, node.id, childId);
            try {
                const referenceDataUrl = await imageToDataUrl({ url: node.metadata.content, storageKey: node.metadata.storageKey });
                const submitted = await submitNodeImageGeneration(getGenerationApi(), {
                    prompt,
                    model: generationConfig.model,
                    routeId: node.metadata?.routeId,
                    size: generationConfig.size,
                    quality: generationConfig.quality,
                    imageCount: 1,
                    referenceImages: [{ id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: referenceDataUrl, storageKey: node.metadata.storageKey }],
                    clientRequestId: createClientRequestId(),
                });
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, metadata: { ...item.metadata, generationTask: taskStateFromGenerationTask(submitted, 0) } } : item)));
                const final = await waitNodeImageGeneration(getGenerationApi(), submitted.taskId, {
                    signal: controller.signal,
                    onUpdate: (task) => updateGenerationTaskNodes(task),
                });
                updateGenerationTaskNodes(final);
                if (final.status !== "success" || !final.images[0]) throw new Error(generationTaskFailureDetails(final));
                const uploaded = await resolveGenerationTaskImage(final.images[0]);
                const size = fitNodeSize(uploaded.width, uploaded.height, imageConfig.width, imageConfig.height);
                setNodes((prev) =>
                    prev.map((item) =>
                        item.id === childId
                            ? { ...item, width: size.width, height: size.height, metadata: { ...item.metadata, ...imageMetadata(uploaded), prompt, sourceNodeId: node.id, derivedFrom: "superResolve", ...generationMetadata } }
                            : item,
                    ),
                );
                refreshAccountAfterGenerationTask();
            } catch (error) {
                if (isGenerationCanceled(error)) return;
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            } finally {
                finishGenerationRequest(childId, controller);
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, finishGenerationRequest, startGenerationRequest, updateGenerationTaskNodes, refreshAccountAfterGenerationTask],
    );

    const handleFontSizeChange = useCallback((nodeId: string, fontSize: number) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, fontSize } } : node)));
    }, []);

    const replaceImageNodeFile = useCallback(
        async (nodeId: string, file: File) => {
            if (!file.type.startsWith("image/")) {
                message.warning("图片节点只支持图片文件");
                return;
            }
            try {
                const image = await uploadImage(file);
                const nextSize = fitNodeSize(image.width, image.height);
                setNodes((prev) =>
                    prev.map((node) =>
                        node.id === nodeId
                            ? {
                                  ...node,
                                  type: CanvasNodeType.Image,
                                  title: file.name,
                                  position: {
                                      x: node.position.x + node.width / 2 - nextSize.width / 2,
                                      y: node.position.y + node.height / 2 - nextSize.height / 2,
                                  },
                                  width: nextSize.width,
                                  height: nextSize.height,
                                  metadata: {
                                      ...node.metadata,
                                      ...imageMetadata(image),
                                      errorDetails: undefined,
                                      freeResize: false,
                                      isBatchRoot: undefined,
                                      batchRootId: undefined,
                                      batchChildIds: undefined,
                                      batchUsesReferenceImages: undefined,
                                      generationType: undefined,
                                      model: undefined,
                                      size: undefined,
                                      quality: undefined,
                                      count: undefined,
                                      references: undefined,
                                      primaryImageId: undefined,
                                      imageBatchExpanded: undefined,
                                      generatedImages: undefined,
                                      selectedGeneratedImageIndex: undefined,
                                      generationTask: undefined,
                                  },
                              }
                            : node,
                    ),
                );
                setSelectedNodeIds(new Set([nodeId]));
                setSelectedConnectionId(null);
            } catch (error) {
                message.error(error instanceof Error ? error.message : "图片上传失败");
            }
        },
        [message],
    );

    const handleUploadRequest = useCallback((nodeId?: string, position?: Position, imageOnly = false) => {
        uploadTargetRef.current = { nodeId, position, imageOnly };
        if (imageInputRef.current) {
            imageInputRef.current.accept = imageOnly ? "image/*" : "image/*,video/*,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav";
            imageInputRef.current.click();
        }
    }, []);

    const handleImageInputChange = useCallback(
        async (event: ReactChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            const target = uploadTargetRef.current;
            if (!file || (!file.type.startsWith("image/") && !file.type.startsWith("video/") && !isAudioFile(file))) return;

            if (target?.nodeId) {
                if (isAudioFile(file)) {
                    const audio = await uploadMediaFile(file, "audio");
                    const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
                    setNodes((prev) =>
                        prev.map((node) =>
                            node.id === target.nodeId
                                ? {
                                      ...node,
                                      type: CanvasNodeType.Audio,
                                      title: file.name,
                                      position: { x: node.position.x + node.width / 2 - spec.width / 2, y: node.position.y + node.height / 2 - spec.height / 2 },
                                      width: spec.width,
                                      height: spec.height,
                                      metadata: { ...node.metadata, ...audioMetadata(audio), errorDetails: undefined },
                                  }
                                : node,
                        ),
                    );
                    setSelectedNodeIds(new Set([target.nodeId]));
                    setSelectedConnectionId(null);
                    uploadTargetRef.current = null;
                    event.target.value = "";
                    return;
                }
                if (file.type.startsWith("video/")) {
                    const video = await uploadMediaFile(file, "video");
                    const nextSize = fitNodeSize(video.width || 1280, video.height || 720, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                    setNodes((prev) =>
                        prev.map((node) =>
                            node.id === target.nodeId
                                ? {
                                      ...node,
                                      type: CanvasNodeType.Video,
                                      title: file.name,
                                      position: { x: node.position.x + node.width / 2 - nextSize.width / 2, y: node.position.y + node.height / 2 - nextSize.height / 2 },
                                      width: nextSize.width,
                                      height: nextSize.height,
                                      metadata: { ...node.metadata, ...videoMetadata(video), errorDetails: undefined },
                                  }
                                : node,
                        ),
                    );
                    setSelectedNodeIds(new Set([target.nodeId]));
                    setSelectedConnectionId(null);
                    setDialogNodeId(target.nodeId);
                    uploadTargetRef.current = null;
                    event.target.value = "";
                    return;
                }
                await replaceImageNodeFile(target.nodeId, file);
            } else {
                const position = target?.position || screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
                void (isAudioFile(file) ? createAudioFileNode(file, position) : file.type.startsWith("video/") ? createVideoFileNode(file, position) : createImageFileNode(file, position));
            }

            uploadTargetRef.current = null;
            event.target.value = "";
        },
        [createAudioFileNode, createImageFileNode, createVideoFileNode, replaceImageNodeFile, screenToCanvas, size.height, size.width],
    );

    const handleDrop = useCallback(
        (event: ReactDragEvent<HTMLDivElement>) => {
            event.preventDefault();
            const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/") || item.type.startsWith("video/") || isAudioFile(item));
            if (!file) return;

            const pos = screenToCanvas(event.clientX, event.clientY);
            void (isAudioFile(file) ? createAudioFileNode(file, pos) : file.type.startsWith("video/") ? createVideoFileNode(file, pos) : createImageFileNode(file, pos));
        },
        [createAudioFileNode, createImageFileNode, createVideoFileNode, screenToCanvas],
    );

    const startTitleEditing = useCallback(() => {
        setTitleDraft(currentProject?.title || "未命名画布");
        setTitleEditing(true);
    }, [currentProject?.title]);

    const finishTitleEditing = useCallback(() => {
        const nextTitle = titleDraft.trim();
        if (nextTitle) void renameProject(projectId, nextTitle).catch(() => message.error("重命名失败，请重试"));
        setTitleEditing(false);
    }, [message, projectId, renameProject, titleDraft]);

    const preventCanvasContextMenu = useCallback((event: ReactMouseEvent) => {
        if ((event.target as HTMLElement).closest("[data-node-id]")) return;
        event.preventDefault();
        setContextMenu(null);
    }, []);

    const handleGenerateNode = useCallback(
        async (nodeId: string, mode: CanvasNodeGenerationMode, prompt: string, clientRequestId?: string) => {
            const sourceNode = nodesRef.current.find((node) => node.id === nodeId);
            const generationConfig = buildGenerationConfig(effectiveConfig, sourceNode, mode);
            // Task 8/11：生图模式走同源持久任务，不依赖任何本地 Provider 渠道配置（Base URL/API Key）；
            // 文本/视频/音频模式第一轮暂未开放。
            if (mode !== "image") {
                message.warning("该生成模式暂未开放，当前仅支持生图");
                return;
            }
            if (!normalizeNodeModelKey(generationConfig.model)) {
                message.warning("请先在生图节点选择模型");
                return;
            }

            // 插件节点声明了 useBuiltinPanel.writeBackToSelf:复用内置面板生成,但结果写回节点自身。
            // 目前支持 image 模式(全景等展示型节点),前缀由 useBuiltinPanel.promptPrefix 指定。
            const builtinPanel = sourceNode ? getNodeDefinition(sourceNode.type)?.useBuiltinPanel : undefined;
            if (sourceNode && builtinPanel?.writeBackToSelf && builtinPanel.mode === "image") {
                const scene = prompt.trim();
                if (!scene) return;
                setRunningNodeId(nodeId);
                const controller = startGenerationRequest(nodeId, nodeId, nodeId);
                setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, prompt: scene, status: NODE_STATUS_LOADING, errorDetails: undefined } } : node)));
                try {
                    const fullPrompt = (builtinPanel.promptPrefix || "") + scene;
                    // 上游图片节点作为参考图(图生图);无上游则纯文生图
                    const upstreamNodes = connectionsRef.current
                        .filter((conn) => conn.toNodeId === nodeId)
                        .map((conn) => nodesRef.current.find((node) => node.id === conn.fromNodeId))
                        .filter((node): node is CanvasNodeData => Boolean(node));
                    const refs = upstreamNodes.flatMap((up) =>
                        typeof up.metadata?.content === "string" && up.metadata.content && up.type !== sourceNode.type
                            ? [{ id: up.id, name: `${up.title || up.id}.png`, type: up.metadata.mimeType || "image/png", dataUrl: up.metadata.content, storageKey: up.metadata.storageKey }]
                            : [],
                    );
                    const submitted = await submitNodeImageGeneration(getGenerationApi(), {
                        prompt: fullPrompt,
                        model: generationConfig.model,
                        routeId: sourceNode.metadata?.routeId,
                        size: generationConfig.size,
                        quality: generationConfig.quality,
                        imageCount: 1,
                        referenceImages: refs,
                        clientRequestId: clientRequestId || createClientRequestId(),
                    });
                    setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, generationTask: taskStateFromGenerationTask(submitted, 0) } } : node)));
                    const final = await waitNodeImageGeneration(getGenerationApi(), submitted.taskId, {
                        signal: controller.signal,
                        onUpdate: (task) => updateGenerationTaskNodes(task),
                    });
                    updateGenerationTaskNodes(final);
                    if (final.status !== "success" || !final.images[0]) throw new Error(generationTaskFailureDetails(final));
                    const uploaded = await resolveGenerationTaskImage(final.images[0]);
                    setNodes((prev) =>
                        prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, ...imageMetadata(uploaded), prompt: scene, model: normalizeNodeModelKey(generationConfig.model), status: NODE_STATUS_SUCCESS, errorDetails: undefined } } : node)),
                    );
                    setDialogNodeId(null);
                    refreshAccountAfterGenerationTask();
                } catch (error) {
                    if (!isGenerationCanceled(error)) {
                        const errorDetails = error instanceof Error ? error.message : "生成失败";
                        message.error(errorDetails);
                        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } } : node)));
                    }
                } finally {
                    finishGenerationRequest(nodeId, controller);
                }
                return;
            }

            setRunningNodeId(nodeId);
            const runController = startGenerationRequest(nodeId, nodeId, nodeId);
            const generationContext = await hydrateNodeGenerationContext(buildNodeGenerationContext(nodeId, nodesRef.current, connectionsRef.current, prompt));
            const effectivePrompt = generationContext.prompt.trim();
            if (runController.signal.aborted) {
                finishGenerationRequest(nodeId, runController);
                setRunningNodeId(null);
                return;
            }
            const markSourceStatus = sourceNode?.type !== CanvasNodeType.Image;
            const statusPrompt = sourceNode?.type === CanvasNodeType.Config ? effectivePrompt : prompt;
            let pendingChildIds: string[] = [];
            if (markSourceStatus) setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, prompt: statusPrompt, status: NODE_STATUS_LOADING, errorDetails: undefined } } : node)));

            try {
                if (mode === "image") {
                    const count = getGenerationCount(generationConfig.count);
                    const isConfigNode = sourceNode?.type === CanvasNodeType.Config;
                    const isImageNode = sourceNode?.type === CanvasNodeType.Image;
                    const isEmptyImageNode = isImageNode && !sourceNode?.metadata?.content;
                    const sourceReference =
                        isImageNode && sourceNode?.metadata?.content
                            ? [{ id: sourceNode.id, name: `${sourceNode.title || sourceNode.id}.png`, type: sourceNode.metadata.mimeType || "image/png", dataUrl: sourceNode.metadata.content, storageKey: sourceNode.metadata.storageKey }]
                            : [];
                    const referenceImages = sourceReference.length ? sourceReference : generationContext.referenceImages;
                    const generationType = referenceImages.length ? ("edit" as const) : ("generation" as const);
                    const generationMetadata = buildImageGenerationMetadata(generationType, generationConfig, count, referenceImages);
                    if (isConfigNode) {
                        setDialogNodeId(nodeId);
                        setNodes((prev) =>
                            prev.map((node) =>
                                node.id === nodeId
                                    ? {
                                          ...node,
                                          metadata: {
                                              ...node.metadata,
                                              ...generationMetadata,
                                              prompt: effectivePrompt,
                                              status: NODE_STATUS_LOADING,
                                              errorDetails: undefined,
                                          },
                                      }
                                    : node,
                            ),
                        );
                        try {
                            const submitted = await submitNodeImageGeneration(getGenerationApi(), {
                                prompt: effectivePrompt,
                                model: generationConfig.model,
                                routeId: sourceNode?.metadata?.routeId,
                                size: generationConfig.size,
                                quality: generationConfig.quality,
                                imageCount: count,
                                referenceImages,
                                clientRequestId: clientRequestId || createClientRequestId(),
                            });
                            setNodes((prev) =>
                                prev.map((node) =>
                                    node.id === nodeId
                                        ? {
                                              ...node,
                                              metadata: {
                                                  ...node.metadata,
                                                  generationTask: taskStateFromGenerationTask(submitted),
                                              },
                                          }
                                        : node,
                                ),
                            );
                            const final = await waitNodeImageGeneration(getGenerationApi(), submitted.taskId, {
                                signal: runController.signal,
                                onUpdate: (task) => updateGenerationTaskNodes(task),
                            });
                            updateGenerationTaskNodes(final);
                            if (final.status !== "success" || !final.images.length) throw new Error(generationTaskFailureDetails(final));

                            const settled = await Promise.allSettled(final.images.slice(0, count).map(resolveGenerationTaskImage));
                            const generatedImages = settled
                                .filter((result): result is PromiseFulfilledResult<UploadedImage> => result.status === "fulfilled")
                                .map((result) => generatedImageMetadata(result.value));
                            if (!generatedImages.length) throw new Error("结果图片保存失败");

                            setNodes((prev) =>
                                prev.map((node) =>
                                    node.id === nodeId
                                        ? {
                                              ...node,
                                              metadata: {
                                                  ...node.metadata,
                                                  ...generationMetadata,
                                                  ...generatedImageSelectionMetadata(generatedImages, node.metadata?.selectedGeneratedImageIndex),
                                                  prompt: effectivePrompt,
                                                  generationTask: taskStateFromGenerationTask(final),
                                                  status: NODE_STATUS_SUCCESS,
                                                  errorDetails: undefined,
                                              },
                                          }
                                        : node,
                                ),
                            );
                            if (final.partial || settled.some((result) => result.status === "rejected")) {
                                message.warning(final.warnings[0] || "部分图片生成失败，已保留成功结果");
                            }
                        } finally {
                            refreshAccountAfterGenerationTask();
                        }
                        return;
                    }
                    const parentConfig = NODE_DEFAULT_SIZE[isConfigNode ? CanvasNodeType.Config : isImageNode ? CanvasNodeType.Image : CanvasNodeType.Text];
                    const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
                    const parentPosition = sourceNode?.position || { x: 0, y: 0 };
                    const gap = 96;
                    const rowGap = 36;
                    const rootId = isEmptyImageNode ? nodeId : nanoid();
                    const childIds = count > 1 ? Array.from({ length: count }, () => nanoid()) : [];
                    pendingChildIds = isEmptyImageNode ? childIds : [rootId, ...childIds];
                    const rootNode: CanvasNodeData = {
                        id: rootId,
                        type: CanvasNodeType.Image,
                        title: effectivePrompt.slice(0, 32) || "Generated Image",
                        position: {
                            x: isEmptyImageNode ? parentPosition.x : parentPosition.x + parentConfig.width + gap,
                            y: parentPosition.y + parentConfig.height / 2 - imageConfig.height / 2,
                        },
                        width: isEmptyImageNode ? sourceNode?.width || imageConfig.width : imageConfig.width,
                        height: isEmptyImageNode ? sourceNode?.height || imageConfig.height : imageConfig.height,
                        metadata: {
                            prompt: effectivePrompt,
                            status: NODE_STATUS_LOADING,
                            isBatchRoot: count > 1,
                            batchChildIds: count > 1 ? childIds : undefined,
                            batchUsesReferenceImages: referenceImages.length > 0,
                            ...generationMetadata,
                            imageBatchExpanded: count > 1 ? true : undefined,
                        },
                    };
                    const childNodes: CanvasNodeData[] = childIds.map((id, index) => ({
                        id,
                        type: CanvasNodeType.Image,
                        title: effectivePrompt.slice(0, 32) || "Generated Image",
                        position: {
                            x: rootNode.position.x + rootNode.width + 120 + (index % 2) * (imageConfig.width + 36),
                            y: rootNode.position.y + Math.floor(index / 2) * (imageConfig.height + rowGap),
                        },
                        width: imageConfig.width,
                        height: imageConfig.height,
                        metadata: { prompt: effectivePrompt, status: NODE_STATUS_LOADING, batchRootId: count > 1 ? rootId : undefined, ...generationMetadata },
                    }));
                    const batchConnections = [...(isEmptyImageNode ? [] : [{ id: nanoid(), fromNodeId: nodeId, toNodeId: rootId }]), ...childIds.map((childId) => ({ id: nanoid(), fromNodeId: rootId, toNodeId: childId }))];

                    setNodes((prev) => [
                        ...prev.map((node) =>
                            node.id === nodeId
                                ? isConfigNode
                                    ? {
                                          ...node,
                                          metadata: { ...node.metadata, prompt: effectivePrompt, status: NODE_STATUS_LOADING, errorDetails: undefined },
                                      }
                                    : isEmptyImageNode
                                      ? {
                                            ...node,
                                            position: rootNode.position,
                                            width: rootNode.width,
                                            height: rootNode.height,
                                            title: rootNode.title,
                                            metadata: { ...node.metadata, ...rootNode.metadata, errorDetails: undefined },
                                        }
                                      : isImageNode
                                        ? {
                                              ...node,
                                              metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS, errorDetails: undefined },
                                          }
                                        : {
                                              ...node,
                                              type: CanvasNodeType.Text,
                                              title: prompt.slice(0, 32) || "Prompt",
                                              width: parentConfig.width,
                                              height: parentConfig.height,
                                              metadata: { ...node.metadata, content: prompt, prompt, status: NODE_STATUS_SUCCESS, fontSize: 14, errorDetails: undefined },
                                          }
                                : node,
                        ),
                        ...(isEmptyImageNode ? [] : [rootNode]),
                        ...childNodes,
                    ]);
                    setConnections((prev) => [...prev, ...batchConnections]);
                    setSelectedNodeIds(new Set([nodeId]));
                    setSelectedConnectionId(null);
                    setDialogNodeId(nodeId);

                    const controller = runController;
                    // Task 8：整批走一个持久任务（imageCount=count），逐张结算、局部成功 partial；
                    // 幂等键按本次操作生成一次，网络重试复用同一键，不产生重复 Provider 任务。
                    let submitted: GenerationTask;
                    try {
                        submitted = await submitNodeImageGeneration(getGenerationApi(), {
                            prompt: effectivePrompt,
                            model: generationConfig.model,
                            routeId: sourceNode?.metadata?.routeId,
                            size: generationConfig.size,
                            quality: generationConfig.quality,
                            imageCount: count,
                            referenceImages,
                            clientRequestId: clientRequestId || createClientRequestId(),
                        });
                    } catch (error) {
                        const errorDetails = error instanceof Error ? error.message : "生图任务提交失败";
                        message.error(errorDetails);
                        setNodes((prev) =>
                            prev.map((node) =>
                                node.id === nodeId || pendingChildIds.includes(node.id) ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } } : node,
                            ),
                        );
                        finishGenerationRequest(nodeId, controller);
                        setRunningNodeId(null);
                        return;
                    }
                    const batchTargetIds = [rootId, ...childIds];
                    setNodes((prev) =>
                        prev.map((node) => {
                            const imageIndex = batchTargetIds.indexOf(node.id);
                            return imageIndex >= 0 ? { ...node, metadata: { ...node.metadata, generationTask: taskStateFromGenerationTask(submitted, imageIndex) } } : node;
                        }),
                    );
                    batchTargetIds.forEach((targetId) => startGenerationRequest(targetId, nodeId, nodeId, controller));
                    let hasSuccess = false;
                    let hasFailure = false;
                    try {
                        const final = await waitNodeImageGeneration(getGenerationApi(), submitted.taskId, {
                            signal: controller.signal,
                            onUpdate: (task) => updateGenerationTaskNodes(task),
                        });
                        updateGenerationTaskNodes(final);
                        if (final.status === "success" && final.images.length) {
                            await Promise.all(
                                batchTargetIds.map(async (targetId, imageIndex) => {
                                    const image = final.images[imageIndex];
                                    if (!image) {
                                        hasFailure = true;
                                        setNodes((prev) => prev.map((node) => (node.id === targetId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails: "该张图片生成失败，未结算部分已退款" } } : node)));
                                        return;
                                    }
                                    try {
                                        const uploaded = await resolveGenerationTaskImage(image);
                                        const imageSize = fitNodeSize(uploaded.width, uploaded.height, imageConfig.width, imageConfig.height);
                                        setNodes((prev) => {
                                            const root = prev.find((node) => node.id === rootId);
                                            return prev.map((node) => {
                                                if (node.id !== targetId && node.id !== rootId) return node;
                                                const center = { x: node.position.x + node.width / 2, y: node.position.y + node.height / 2 };
                                                if (node.id === rootId && (targetId === rootId || !root?.metadata?.primaryImageId))
                                                    return {
                                                        ...node,
                                                        position: { x: center.x - imageSize.width / 2, y: center.y - imageSize.height / 2 },
                                                        width: imageSize.width,
                                                        height: imageSize.height,
                                                        metadata: { ...node.metadata, ...imageMetadata(uploaded), primaryImageId: targetId },
                                                    };
                                                if (node.id === targetId)
                                                    return {
                                                        ...node,
                                                        position: { x: center.x - imageSize.width / 2, y: center.y - imageSize.height / 2 },
                                                        width: imageSize.width,
                                                        height: imageSize.height,
                                                        metadata: { ...node.metadata, ...imageMetadata(uploaded) },
                                                    };
                                                return node;
                                            });
                                        });
                                        hasSuccess = true;
                                    } catch {
                                        hasFailure = true;
                                        setNodes((prev) => prev.map((node) => (node.id === targetId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails: "结果图片保存失败" } } : node)));
                                    }
                                }),
                            );
                            if (isConfigNode && hasSuccess) setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS, errorDetails: undefined } } : node)));
                            if (final.partial) message.warning(final.warnings[0] || "部分图片生成失败，已按实际成功数量结算");
                        } else {
                            hasFailure = true;
                            const errorDetails = final.status === "success" ? "全部图片生成失败" : generationTaskFailureDetails(final);
                            setNodes((prev) =>
                                prev.map((node) => (batchTargetIds.includes(node.id) ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } } : node)),
                            );
                        }
                    } catch (error) {
                        // 本地中止（含取消任务）：stopGenerationByRunningId 已复位节点，直接返回。
                        if (isGenerationCanceled(error)) return;
                        hasFailure = true;
                        const errorDetails = error instanceof Error ? error.message : "生成失败";
                        setNodes((prev) =>
                            prev.map((node) => (batchTargetIds.includes(node.id) ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } } : node)),
                        );
                    } finally {
                        batchTargetIds.forEach((targetId) => finishGenerationRequest(targetId, controller));
                        refreshAccountAfterGenerationTask();
                    }
                    if (controller.signal.aborted) {
                        setNodes((prev) => prev.map((node) => (node.id === nodeId && isConfigNode && node.metadata?.status === NODE_STATUS_LOADING ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_IDLE, errorDetails: undefined } } : node)));
                        return;
                    }
                    if (hasFailure) message.error(hasSuccess ? "部分图片生成失败" : "全部图片生成失败");
                    setNodes((prev) =>
                        prev.map((node) =>
                            node.id === nodeId && isConfigNode
                                ? { ...node, metadata: { ...node.metadata, status: hasSuccess ? NODE_STATUS_SUCCESS : NODE_STATUS_ERROR, errorDetails: hasSuccess ? undefined : "全部图片生成失败" } }
                                : node.id === nodeId && isEmptyImageNode
                                  ? { ...node, metadata: { ...node.metadata, status: hasSuccess ? NODE_STATUS_SUCCESS : NODE_STATUS_ERROR, errorDetails: hasSuccess ? undefined : "全部图片生成失败" } }
                                  : node.id === rootId && !hasSuccess
                                    ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails: "全部图片生成失败" } }
                                    : node,
                        ),
                    );
                    return;
                }

            } catch (error) {
                if (isGenerationCanceled(error)) return;
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                message.error(errorDetails);
                setNodes((prev) =>
                    prev.map((node) => (node.id === nodeId || pendingChildIds.includes(node.id) ? (node.id === nodeId && !markSourceStatus ? node : { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } }) : node)),
                );
            } finally {
                finishGenerationRequest(nodeId, runController);
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, finishGenerationRequest, message, startGenerationRequest, updateGenerationTaskNodes, refreshAccountAfterGenerationTask],
    );
    useEffect(() => {
        generateNodeRef.current = handleGenerateNode;
    }, [handleGenerateNode]);

    const handleRetryNode = useCallback(
        async (node: CanvasNodeData) => {
            const sourceNode = findRetrySourceNode(node.id, nodesRef.current, connectionsRef.current) || node;
            const batchRoot = node.metadata?.batchRootId ? nodesRef.current.find((item) => item.id === node.metadata?.batchRootId) : null;
            const savedImageMetadata = node.type === CanvasNodeType.Image ? { ...batchRoot?.metadata, ...node.metadata } : undefined;
            const hasSavedImageMetadata = Boolean(savedImageMetadata?.generationType);
            const generationConfig =
                hasSavedImageMetadata && savedImageMetadata
                    ? {
                          ...effectiveConfig,
                          model: savedImageMetadata.model || effectiveConfig.imageModel || effectiveConfig.model,
                          quality: savedImageMetadata.quality || effectiveConfig.quality,
                          size: savedImageMetadata.size || effectiveConfig.size,
                          background: savedImageMetadata.background ?? effectiveConfig.background,
                          count: "1",
                      }
                    : { ...buildGenerationConfig(effectiveConfig, sourceNode, node.type === CanvasNodeType.Text ? "text" : node.type === CanvasNodeType.Video ? "video" : node.type === CanvasNodeType.Audio ? "audio" : "image"), count: "1" };
            // Task 8/11：图片节点重试走同源持久任务，不校验本地 Provider 渠道配置；
            // 文本/视频/音频节点的生成第一轮暂未开放。
            if (node.type !== CanvasNodeType.Image) {
                message.warning("该类型节点的生成暂未开放，无法重试");
                return;
            }
            if (!normalizeNodeModelKey(generationConfig.model)) {
                message.warning("找不到可用模型，无法重试");
                return;
            }

            const context = hasSavedImageMetadata ? null : await hydrateNodeGenerationContext(buildNodeGenerationContext(sourceNode.id, nodesRef.current, connectionsRef.current, sourceNode.metadata?.prompt || node.metadata?.prompt || ""));
            const prompt = (savedImageMetadata?.prompt || context?.prompt || "").trim();
            if (!prompt) {
                message.warning("找不到提示词，无法重试");
                return;
            }
            const generationType = savedImageMetadata?.generationType;
            const useReferenceImages = generationType ? generationType === "edit" : Boolean(context?.referenceImages.length);
            const retryReferenceImages =
                hasSavedImageMetadata && savedImageMetadata ? await resolveMetadataReferences(savedImageMetadata) : useReferenceImages ? (context?.referenceImages.length ? context.referenceImages : sourceNodeReferenceImages(batchRoot || sourceNode)) : [];
            if (useReferenceImages && !retryReferenceImages) {
                message.error("参考图片已丢失，无法继续重试");
                setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails: "参考图片已丢失，无法继续重试" } } : item)));
                return;
            }
            const retryImages = retryReferenceImages || [];

            setRunningNodeId(node.id);
            setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_LOADING, errorDetails: undefined } } : item)));
            const controller = startGenerationRequest(node.id, sourceNode.id, node.id);

            try {
                // Task 8：图片重试统一走持久任务；已有失败/取消任务记录时走人工重试（全新任务 + 新幂等键）。
                const previousTask = node.metadata?.generationTask;
                const submitted =
                    previousTask?.taskId && (previousTask.status === "failed" || previousTask.status === "cancelled")
                        ? await retryNodeGenerationTask(previousTask)
                        : await submitNodeImageGeneration(getGenerationApi(), {
                              prompt,
                              model: generationConfig.model,
                              routeId: node.metadata?.routeId || sourceNode.metadata?.routeId,
                              size: generationConfig.size,
                              quality: generationConfig.quality,
                              imageCount: 1,
                              referenceImages: retryImages,
                              clientRequestId: createClientRequestId(),
                          });
                setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, generationTask: taskStateFromGenerationTask(submitted, 0) } } : item)));
                const final = await waitNodeImageGeneration(getGenerationApi(), submitted.taskId, {
                    signal: controller.signal,
                    onUpdate: (task) => updateGenerationTaskNodes(task),
                });
                updateGenerationTaskNodes(final);
                if (final.status !== "success" || !final.images[0]) throw new Error(generationTaskFailureDetails(final));
                const uploadedImage = await resolveGenerationTaskImage(final.images[0]);
                refreshAccountAfterGenerationTask();
                const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
                const imageSize = fitNodeSize(uploadedImage.width, uploadedImage.height, imageConfig.width, imageConfig.height);
                const generationMetadata = savedImageMetadata?.generationType
                    ? {
                          generationType: savedImageMetadata.generationType,
                          model: generationConfig.model,
                          size: generationConfig.size,
                          quality: generationConfig.quality,
                          ...(generationConfig.background ? { background: generationConfig.background } : {}),
                          count: savedImageMetadata.count || 1,
                          references: savedImageMetadata.references,
                      }
                    : buildImageGenerationMetadata(useReferenceImages ? "edit" : "generation", generationConfig, 1, retryImages);
                setNodes((prev) =>
                    prev.map((item) =>
                        item.id === node.id
                            ? {
                                  ...item,
                                  type: CanvasNodeType.Image,
                                  width: imageSize.width,
                                  height: imageSize.height,
                                  metadata: { ...item.metadata, ...imageMetadata(uploadedImage), prompt, ...generationMetadata },
                              }
                            : item,
                    ),
                );
            } catch (error) {
                if (isGenerationCanceled(error)) return;
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                message.error(errorDetails);
                setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            } finally {
                finishGenerationRequest(node.id, controller);
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, finishGenerationRequest, message, startGenerationRequest, updateGenerationTaskNodes, refreshAccountAfterGenerationTask, retryNodeGenerationTask],
    );

    const generateImageFromTextNode = useCallback(
        (node: CanvasNodeData) => {
            const prompt = (node.metadata?.content || node.metadata?.prompt || "").trim();
            if (!prompt) {
                message.warning("文本节点为空，无法生图");
                return;
            }
            const sourceNode = nodesRef.current.find((item) => item.id === node.id);
            if (!sourceNode) return;
            const nodeSize = getNodeSpec(CanvasNodeType.Config);
            const configNode = createCanvasNode(
                CanvasNodeType.Config,
                {
                    x: sourceNode.position.x + sourceNode.width + 96 + nodeSize.width / 2,
                    y: sourceNode.position.y + sourceNode.height / 2,
                },
                {
                    prompt: "",
                    model: effectiveConfig.imageModel || effectiveConfig.model,
                    size: effectiveConfig.size,
                    count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count),
                },
            );
            const connection = { id: nanoid(), fromNodeId: sourceNode.id, toNodeId: configNode.id };
            const nextNodes = nodesRef.current.map((item) => (item.id === sourceNode.id ? { ...item, metadata: { ...item.metadata, content: prompt, prompt, status: NODE_STATUS_SUCCESS } } : item)).concat(configNode);
            const nextConnections = [...connectionsRef.current, connection];
            nodesRef.current = nextNodes;
            connectionsRef.current = nextConnections;
            setNodes(nextNodes);
            setConnections(nextConnections);
            setSelectedNodeIds(new Set([configNode.id]));
            setSelectedConnectionId(null);
            setDialogNodeId(configNode.id);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, message],
    );

    const insertAssistantImage = useCallback(
        async (image: CanvasAssistantImage) => {
            const storedImage = image.storageKey ? { url: image.dataUrl, storageKey: image.storageKey, width: 1, height: 1, bytes: 0, mimeType: "image/png" } : await uploadImage(image.dataUrl);
            const meta = storedImage.width === 1 && storedImage.height === 1 ? await readImageMeta(storedImage.url) : storedImage;
            const config = fitNodeSize(meta.width, meta.height);
            const center = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
            const id = `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const node: CanvasNodeData = {
                id,
                type: CanvasNodeType.Image,
                title: image.prompt.slice(0, 32) || "Generated Image",
                position: { x: center.x - config.width / 2, y: center.y - config.height / 2 },
                width: config.width,
                height: config.height,
                metadata: { ...imageMetadata({ ...storedImage, width: meta.width, height: meta.height }), prompt: image.prompt },
            };

            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([id]));
            setSelectedConnectionId(null);
            setDialogNodeId(id);
        },
        [screenToCanvas, size.height, size.width],
    );

    const insertAssistantText = useCallback(
        (text: string, title?: string) => {
            const center = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
            const node = {
                ...createCanvasNode(CanvasNodeType.Text, center, { content: text, status: NODE_STATUS_SUCCESS }),
                title: title || text.slice(0, 32) || "Assistant Text",
            };

            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([node.id]));
            setSelectedConnectionId(null);
        },
        [screenToCanvas, size.height, size.width],
    );

    // 提示词库插入（Task 7）：写入当前选中文本/配置节点、新建生成配置节点或 Assistant 输入框；
    // 进入画布的节点携带 scope + promptId + version + contentSnapshot（保存项目时汇入信封 references.prompts）。
    const handlePromptInsert = useCallback(
        (payload: Extract<InsertAssetPayload, { kind: "prompt" }>) => {
            const reference = payload.reference;
            if (payload.target === "assistant") {
                const agent = useAgentStore.getState();
                const merged = agent.prompt.trim() ? `${agent.prompt.trimEnd()}\n${payload.content}` : payload.content;
                agent.setAgentState({ prompt: merged });
                agent.openPanel();
                return;
            }
            const center = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
            if (payload.target === "config-node") {
                const node = {
                    ...createCanvasNode(CanvasNodeType.Config, center, { composerContent: payload.content, promptReference: reference }),
                    title: payload.title || "生图节点",
                };
                setNodes((prev) => [...prev, node]);
                setSelectedNodeIds(new Set([node.id]));
                setSelectedConnectionId(null);
                return;
            }
            const selectedId = Array.from(selectedNodeIds)[0];
            const selectedNode = selectedId ? nodesRef.current.find((node) => node.id === selectedId) : null;
            if (selectedNode && (selectedNode.type === CanvasNodeType.Text || selectedNode.type === CanvasNodeType.Config)) {
                setNodes((prev) =>
                    prev.map((node) => {
                        if (node.id !== selectedNode.id) return node;
                        const metadata = { ...(node.metadata || {}) };
                        if (node.type === CanvasNodeType.Config) {
                            metadata.composerContent = metadata.composerContent?.trim() ? `${metadata.composerContent.trimEnd()}\n${payload.content}` : payload.content;
                        } else {
                            metadata.content = metadata.content?.trim() ? `${metadata.content.trimEnd()}\n${payload.content}` : payload.content;
                            metadata.status = NODE_STATUS_SUCCESS;
                        }
                        metadata.promptReference = reference;
                        return { ...node, metadata };
                    }),
                );
                return;
            }
            const node = {
                ...createCanvasNode(CanvasNodeType.Text, center, { content: payload.content, status: NODE_STATUS_SUCCESS, promptReference: reference }),
                title: payload.title || payload.content.slice(0, 32) || "提示词",
            };
            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([node.id]));
            setSelectedConnectionId(null);
        },
        [screenToCanvas, selectedNodeIds, size.height, size.width],
    );

    const handleAssetInsert = useCallback(
        (payload: InsertAssetPayload) => {
            if (payload.kind === "prompt") {
                handlePromptInsert(payload);
            } else if (payload.kind === "text") {
                insertAssistantText(payload.content, payload.title);
            } else if (payload.kind === "video") {
                const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Video];
                const center = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
                const id = `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const nextSize = fitNodeSize(payload.width || spec.width, payload.height || spec.height, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                setNodes((prev) => [
                    ...prev,
                    {
                        id,
                        type: CanvasNodeType.Video,
                        title: payload.title,
                        position: { x: center.x - nextSize.width / 2, y: center.y - nextSize.height / 2 },
                        width: nextSize.width,
                        height: nextSize.height,
                        metadata: { content: payload.url, storageKey: payload.storageKey, status: NODE_STATUS_SUCCESS, naturalWidth: payload.width, naturalHeight: payload.height },
                    },
                ]);
                setSelectedNodeIds(new Set([id]));
            } else {
                insertAssistantImage({ id: `asset-${Date.now()}`, prompt: payload.title, dataUrl: payload.dataUrl, storageKey: payload.storageKey });
            }
            setAssetPickerOpen(false);
        },
        [handlePromptInsert, insertAssistantImage, insertAssistantText, screenToCanvas, size.height, size.width],
    );

    // --- 传给 CanvasNode 的回调/渲染函数统一 memo 化 ---
    // CanvasNode 是 React.memo,但只要这些 prop 每次渲染都是新引用,memo 就失效,
    // 导致点击/悬停/移动视角时全部节点跟着重渲染(markdown 尤其明显)。全部 useCallback 后,
    // 未变化的节点不再重渲染。依赖里的 map/handler 均已 memo 化,纯交互时保持稳定。
    const handleNodeHoverStart = useCallback((nodeId: string) => {
        if (nodeDraggingRef.current) return;
        setHoveredNodeId(nodeId);
    }, []);
    const handleNodeHoverEnd = useCallback((nodeId: string) => {
        setHoveredNodeId((current) => (current === nodeId ? null : current));
    }, []);
    const handleNodeViewImage = useCallback((node: CanvasNodeData) => setPreviewNodeId(node.id), []);
    const handleNodeUploadImage = useCallback((node: CanvasNodeData) => handleUploadRequest(node.id, undefined, true), [handleUploadRequest]);
    const handleNodeDropImage = useCallback((nodeId: string, file: File) => void replaceImageNodeFile(nodeId, file), [replaceImageNodeFile]);
    const handleNodeRetry = useCallback((node: CanvasNodeData) => void handleRetryNode(node), [handleRetryNode]);
    const handleNodeContextMenu = useCallback((event: ReactMouseEvent, nodeId: string) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ type: "node", x: event.clientX, y: event.clientY, nodeId });
    }, []);

    const renderNodePanel = useCallback(
        (panelNode: CanvasNodeData) =>
            getNodeDefinition(panelNode.type)?.Panel ? (
                renderPluginPanel(panelNode)
            ) : panelNode.type === CanvasNodeType.Config ? (
                <CanvasConfigGenerationPanel
                    node={panelNode}
                    isRunning={runningNodeId === panelNode.id}
                    inputs={configInputsById.get(panelNode.id) || []}
                    inputSummary={getInputSummary(configInputsById.get(panelNode.id) || [])}
                    onConfigChange={handleConfigNodeChange}
                    onGenerate={(nodeId) => {
                        const target = nodesRef.current.find((item) => item.id === nodeId);
                        void handleGenerateNode(nodeId, "image", target?.metadata?.composerContent ?? target?.metadata?.prompt ?? "");
                    }}
                    onStop={confirmStopGeneration}
                    onClose={() => setDialogNodeId(null)}
                />
            ) : (
                <CanvasNodePromptPanel
                    node={panelNode}
                    isRunning={runningNodeId === panelNode.id}
                    mentionReferences={mentionReferencesByNodeId.get(panelNode.id) || EMPTY_REFERENCES}
                    onPromptChange={handleNodePromptChange}
                    onConfigChange={handleConfigNodeChange}
                    onGenerate={handleGenerateNode}
                    onStop={confirmStopGeneration}
                    modeOverride={getNodeDefinition(panelNode.type)?.useBuiltinPanel?.mode}
                    onImageSettingsOpenChange={(open) => {
                        setNodeImageSettingsOpen(open);
                        if (open) setToolbarNodeId(null);
                    }}
                />
            ),
        [configInputsById, confirmStopGeneration, handleConfigNodeChange, handleGenerateNode, handleNodePromptChange, mentionReferencesByNodeId, renderPluginPanel, runningNodeId],
    );

    const renderNodeContentPanel = useCallback(
        (contentNode: CanvasNodeData) => <CanvasConfigNodePanel node={contentNode} />,
        [],
    );

    if (projectLoadError) {
        return (
            <main className="flex h-full flex-col items-center justify-center gap-4 bg-background text-sm text-stone-500 dark:text-stone-400">
                {projectLoadError === "not-found" ? <p>项目不存在</p> : null}
                {projectLoadError === "legacy" ? <p className="max-w-md px-6 text-center leading-6">该项目由旧版画布创建，暂不支持在此打开。原项目数据不会被修改。</p> : null}
                {projectLoadError === "error" ? <p>项目加载失败，请检查网络后重试</p> : null}
                <div className="flex items-center gap-2">
                    {projectLoadError === "error" ? <Button onClick={() => window.location.reload()}>重试</Button> : null}
                    {projectLoadError === "legacy" ? (
                        <Button type="primary" onClick={() => setLegacyImportOpen(true)}>
                            导入为新版副本
                        </Button>
                    ) : null}
                    <Button type={projectLoadError === "legacy" ? "default" : "primary"} onClick={() => navigate("/canvas")}>
                        返回画布库
                    </Button>
                </div>
                {projectLoadError === "legacy" ? <LegacyProjectImportDialog open={legacyImportOpen} projectId={projectId} onClose={() => setLegacyImportOpen(false)} /> : null}
            </main>
        );
    }

    if (!projectLoaded) return <CanvasRefreshShell />;

    return (
        <main className="flex h-full min-h-0 overflow-hidden" style={{ background: theme.canvas.background, color: theme.node.text }}>
            <CanvasSidePanel nodes={nodes} selectedNodeIds={selectedNodeIds} onFocusNode={focusNode} onInsertAsset={handleAssetInsert} />
            <section className="relative min-w-0 flex-1 overflow-hidden">
                <CanvasTopBar
                    title={currentProject?.title || "未命名画布"}
                    titleDraft={titleDraft}
                    isTitleEditing={titleEditing}
                    onTitleDraftChange={setTitleDraft}
                    onStartTitleEditing={startTitleEditing}
                    onFinishTitleEditing={finishTitleEditing}
                    onCancelTitleEditing={() => setTitleEditing(false)}
                    canUndo={historyState.canUndo}
                    canRedo={historyState.canRedo}
                    onProjects={() => setProjectsModalOpen(true)}
                    onCreateProject={createAndOpenProject}
                    onDeleteProject={deleteCurrentProject}
                    onExportProject={exportCurrentProject}
                    onImportImage={() => handleUploadRequest()}
                    onUndo={undoCanvas}
                    onRedo={redoCanvas}
                    agentOpen={agentPanelOpen}
                    onToggleAgent={toggleAgentPanel}
                    onOpenUserCenter={() => setUserCenterOpen(true)}
                />

                <div className="pointer-events-none absolute right-4 top-14 z-20 text-xs">
                    {saveStatus === "saving" ? <span className="text-stone-400">保存中…</span> : null}
                    {saveStatus === "saved" ? <span className="text-stone-400">已保存</span> : null}
                    {saveStatus === "error" ? (
                        <button type="button" className="pointer-events-auto text-red-500 underline" onClick={() => void flushServerSave()}>
                            保存失败，点击重试
                        </button>
                    ) : null}
                </div>

                <InfiniteCanvas
                    containerRef={containerRef}
                    viewport={viewport}
                    backgroundMode={backgroundMode}
                    onViewportChange={(next) => {
                        setViewport(next);
                        setContextMenu(null);
                    }}
                    onCanvasMouseDown={handleCanvasMouseDown}
                    onCanvasDeselect={deselectCanvas}
                    onCanvasDoubleClick={(event) => {
                        const canvasRect = containerRef.current?.getBoundingClientRect();
                        setContextMenu(null);
                        setNodeCreatePosition(screenToCanvas(event.clientX, event.clientY));
                        setNodeCreateMenuPosition({
                            x: event.clientX - (canvasRect?.left || 0),
                            y: event.clientY - (canvasRect?.top || 0),
                        });
                    }}
                    onContextMenu={preventCanvasContextMenu}
                    onDrop={handleDrop}
                >
                    <svg className="absolute left-0 top-0 h-[10000px] w-[10000px] overflow-visible" style={{ pointerEvents: "none", transform: "translateZ(0)", zIndex: 0 }}>
                        {connections
                            .filter((connection) => {
                                const from = nodeById.get(connection.fromNodeId);
                                const to = nodeById.get(connection.toNodeId);
                                return Boolean(from && to && !isHiddenBatchConnectionEndpoint(from, nodes) && !isHiddenBatchConnectionEndpoint(to, nodes));
                            })
                            .map((connection) => {
                                const from = nodeById.get(connection.fromNodeId);
                                const to = nodeById.get(connection.toNodeId);
                                if (!from || !to) return null;

                                return (
                                    <ConnectionPath
                                        key={connection.id}
                                        connection={connection}
                                        from={from}
                                        to={to}
                                        active={selectedConnectionId === connection.id || relatedHighlight.connectionIds.has(connection.id)}
                                        onSelect={() => {
                                            setSelectedConnectionId(connection.id);
                                            setSelectedNodeIds(new Set());
                                            setContextMenu(null);
                                        }}
                                        onContextMenu={(event) => {
                                            setSelectedConnectionId(connection.id);
                                            setSelectedNodeIds(new Set());
                                            setContextMenu({ type: "connection", x: event.clientX, y: event.clientY, connectionId: connection.id });
                                        }}
                                    />
                                );
                            })}
                        {connectingParams ? <ActiveConnectionPath node={nodeById.get(connectingParams.nodeId)} handle={connectingParams} mouseWorld={mouseWorld} target={connectionTargetNodeId ? nodeById.get(connectionTargetNodeId) : undefined} /> : null}
                    </svg>

                    {visibleNodes.map((node) => (
                        <CanvasNode
                            key={node.id}
                            data={node}
                            scale={viewport.k}
                            isSelected={selectedNodeIds.has(node.id)}
                            isRelated={relatedHighlight.nodeIds.has(node.id)}
                            isFocusRelated={activeNodeId === node.id}
                            isConnectionTarget={connectionTargetNodeId === node.id}
                            isConnecting={Boolean(connectingParams)}
                            editRequestNonce={editingNodeId === node.id ? editRequestNonce : 0}
                            showPanel={dialogNodeId === node.id && !selectionBox && !getNodeDefinition(node.type)?.hidePanel}
                            batchCount={batchChildCountById.get(node.id) || 0}
                            groupChildCount={groupChildCountById.get(node.id) || 0}
                            isGroupDropTarget={dropTargetGroupId === node.id}
                            batchExpanded={Boolean(node.metadata?.imageBatchExpanded)}
                            batchClosing={Boolean(node.metadata?.batchRootId && collapsingBatchIds.has(node.metadata.batchRootId))}
                            batchOpening={openingBatchIds.has(node.id)}
                            batchRecovering={collapsingBatchIds.has(node.id)}
                            batchMotion={batchMotionById.get(node.id)}
                            showImageInfo={showImageInfo}
                            mentionReferences={mentionReferencesByNodeId.get(node.id) || EMPTY_REFERENCES}
                            pluginHost={pluginHost}
                            registryVersion={nodeRegistryVersion}
                            renderPanel={renderNodePanel}
                            renderNodeContent={renderNodeContentPanel}
                            onMouseDown={handleNodeMouseDown}
                            onSelectCapture={handleNodeSelectCapture}
                            onHoverStart={handleNodeHoverStart}
                            onHoverEnd={handleNodeHoverEnd}
                            onConnectStart={handleConnectStart}
                            onResize={handleNodeResize}
                            onContentChange={handleNodeContentChange}
                            onTitleChange={handleNodeTitleChange}
                            onToggleBatch={toggleBatchExpanded}
                            onSetBatchPrimary={setBatchPrimary}
                            onRetry={handleNodeRetry}
                            onGenerateImage={generateImageFromTextNode}
                            onUploadImage={handleNodeUploadImage}
                            onDropImage={handleNodeDropImage}
                            onCancelTask={handleCancelGenerationTask}
                            onViewImage={handleNodeViewImage}
                            onContextMenu={handleNodeContextMenu}
                        />
                    ))}

                    {selectionBox ? (
                        <div
                            className="pointer-events-none absolute z-[100] border"
                            style={{
                                left: Math.min(selectionBox.startWorldX, selectionBox.currentWorldX),
                                top: Math.min(selectionBox.startWorldY, selectionBox.currentWorldY),
                                width: Math.abs(selectionBox.currentWorldX - selectionBox.startWorldX),
                                height: Math.abs(selectionBox.currentWorldY - selectionBox.startWorldY),
                                borderColor: theme.canvas.selectionStroke,
                                background: theme.canvas.selectionFill,
                            }}
                        />
                    ) : null}
                </InfiniteCanvas>

                {pendingConnectionCreate ? <ConnectionCreateMenu pending={pendingConnectionCreate} onCreate={(type) => createConnectedNode(type, pendingConnectionCreate)} onClose={cancelPendingConnectionCreate} /> : null}
                {nodeCreatePosition && nodeCreateMenuPosition ? (
                    <NodeCreateMenu
                        position={nodeCreateMenuPosition}
                        onCreate={(type) => {
                            createNode(type, nodeCreatePosition);
                            setNodeCreatePosition(null);
                            setNodeCreateMenuPosition(null);
                        }}
                        onClose={() => {
                            setNodeCreatePosition(null);
                            setNodeCreateMenuPosition(null);
                        }}
                    />
                ) : null}

                <CanvasNodeHoverToolbar
                    node={isNodeDragging || nodeImageSettingsOpen ? null : toolbarNode}
                    viewport={viewport}
                    extraTools={toolbarNode ? buildNodeToolbarItems(toolbarNode) : undefined}
                    onKeep={keepNodeToolbar}
                    onLeave={hideNodeToolbar}
                    onInfo={(node) => setInfoNodeId(node.id)}
                    onEditText={openTextEditor}
                    onDecreaseFont={(node) => handleFontSizeChange(node.id, Math.max(10, (node.metadata?.fontSize || 14) - 2))}
                    onIncreaseFont={(node) => handleFontSizeChange(node.id, Math.min(32, (node.metadata?.fontSize || 14) + 2))}
                    onToggleDialog={(node) => setDialogNodeId((current) => (current === node.id ? null : node.id))}
                    onGenerateImage={generateImageFromTextNode}
                    onUpload={(node) => handleUploadRequest(node.id)}
                    onDownload={downloadNodeImage}
                    onMaskEdit={(node) => {
                        setMaskEditOperation("inpaint");
                        setMaskEditNodeId(node.id);
                    }}
                    onSmartErase={(node) => {
                        setMaskEditOperation("erase");
                        setMaskEditNodeId(node.id);
                    }}
                    onOutpaint={(node) => setOutpaintNodeId(node.id)}
                    onCrop={(node) => setCropNodeId(node.id)}
                    onSplit={(node) => setSplitNodeId(node.id)}
                    onUpscale={(node) => setUpscaleNodeId(node.id)}
                    onSuperResolve={(node) => setSuperResolveNodeId(node.id)}
                    onAngle={(node) => setAngleNodeId(node.id)}
                    onViewImage={(node) => setPreviewNodeId(node.id)}
                    onReversePrompt={createImageReversePromptNodes}
                    onRetry={(node) => void handleRetryNode(node)}
                    onToggleFreeResize={(node) => toggleNodeFreeResize(node.id)}
                    onDelete={(node) => deleteNodes(new Set([node.id]))}
                />

                <CanvasToolbar
                    selectedCount={selectedNodeIds.size}
                    canUndo={historyState.canUndo}
                    canRedo={historyState.canRedo}
                    backgroundMode={backgroundMode}
                    showImageInfo={showImageInfo}
                    onAddImage={() => createNode(CanvasNodeType.Image)}
                    onAddVideo={() => createNode(CanvasNodeType.Video)}
                    onAddAudio={() => createNode(CanvasNodeType.Audio)}
                    onAddText={() => createNode(CanvasNodeType.Text)}
                    onAddConfig={() => createNode(CanvasNodeType.Config)}
                    onAddGroup={() => createNode(CanvasNodeType.Group)}
                    onAddExtensionNode={(type) => createNode(type)}
                    onUndo={undoCanvas}
                    onRedo={redoCanvas}
                    onUpload={() => handleUploadRequest()}
                    onOpenAssetLibrary={() => setAssetPickerOpen(true)}
                    onDelete={() => deleteNodes(new Set(selectedNodeIds))}
                    onClear={() => setClearConfirmOpen(true)}
                    onDeselect={deselectCanvas}
                    onBackgroundModeChange={setBackgroundMode}
                    onShowImageInfoChange={setShowImageInfo}
                />

                {isMiniMapOpen ? <Minimap nodes={nodes} viewport={viewport} viewportSize={size} onViewportChange={setViewport} /> : null}

                <CanvasZoomControls scale={viewport.k} onScaleChange={setZoomScale} onReset={resetViewport} isMiniMapOpen={isMiniMapOpen} onToggleMiniMap={() => setIsMiniMapOpen((value) => !value)} />

                {contextMenu ? (
                    <CanvasNodeContextMenu
                        menu={contextMenu}
                        onClose={() => setContextMenu(null)}
                        onDuplicate={() => {
                            if (contextMenu.type !== "node") return;
                            duplicateNode(contextMenu.nodeId);
                            setContextMenu(null);
                        }}
                        onCopyImage={(() => {
                            if (contextMenu.type !== "node") return undefined;
                            const target = nodesRef.current.find((node) => node.id === contextMenu.nodeId);
                            if (!(target?.metadata?.generatedImages || []).length) return undefined;
                            return () => {
                                void copyNodeImageToClipboard(contextMenu.nodeId);
                                setContextMenu(null);
                            };
                        })()}
                        onDelete={() => {
                            if (contextMenu.type === "node") {
                                deleteNodes(new Set([contextMenu.nodeId]));
                            } else {
                                deleteConnection(contextMenu.connectionId);
                            }
                            setContextMenu(null);
                        }}
                    />
                ) : null}

                <input ref={imageInputRef} type="file" accept="image/*,video/*,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav" className="hidden" onChange={handleImageInputChange} />

                <CanvasNodeInfoModal node={infoNode} open={Boolean(infoNode)} onClose={() => setInfoNodeId(null)} />

                {cropNode?.metadata?.content ? <CanvasNodeCropDialog dataUrl={cropNode.metadata.content} open={Boolean(cropNode)} onClose={() => setCropNodeId(null)} onConfirm={(crop) => void cropImageNode(cropNode!, crop)} /> : null}

                {maskEditNode?.metadata?.content ? (
                    <CanvasNodeMaskEditDialog
                        dataUrl={maskEditNode.metadata.content}
                        open={Boolean(maskEditNode)}
                        operation={maskEditOperation}
                        onClose={() => setMaskEditNodeId(null)}
                        onConfirm={(payload) => void maskEditImageNode(maskEditNode!, payload)}
                    />
                ) : null}

                {outpaintNode?.metadata?.content ? (
                    <CanvasNodeOutpaintDialog open={Boolean(outpaintNode)} submitting={outpaintSubmitting} onClose={() => setOutpaintNodeId(null)} onConfirm={(params) => void outpaintImageNode(outpaintNode!, params)} />
                ) : null}

                {splitNode?.metadata?.content ? <CanvasNodeSplitDialog dataUrl={splitNode.metadata.content} open={Boolean(splitNode)} onClose={() => setSplitNodeId(null)} onConfirm={(params) => void splitImageNode(splitNode!, params)} /> : null}

                {upscaleNode?.metadata?.content ? (
                    <CanvasNodeUpscaleDialog dataUrl={upscaleNode.metadata.content} open={Boolean(upscaleNode)} onClose={() => setUpscaleNodeId(null)} onConfirm={(params) => void upscaleImageNode(upscaleNode!, params)} />
                ) : null}

                <Modal
                    title="AI 超分"
                    open={Boolean(superResolveNode?.metadata?.content)}
                    centered
                    onCancel={() => setSuperResolveNodeId(null)}
                    onOk={() => superResolveNode && void superResolveImageNode(superResolveNode)}
                    okText="开始超分"
                    cancelText="取消"
                    width={420}
                >
                    <div className="py-2 text-sm leading-6 opacity-80">基于当前图片生成一张 AI 超分辨率增强图：提升分辨率、锐化细节、修复模糊与压缩伪影，画面内容保持不变。将创建一个新的图片节点。</div>
                </Modal>

                {angleNode?.metadata?.content ? <CanvasNodeAngleDialog dataUrl={angleNode.metadata.content} open={Boolean(angleNode)} onClose={() => setAngleNodeId(null)} onConfirm={(params) => void generateAngleNode(angleNode!, params)} /> : null}

                <Modal
                    title="图片详情"
                    open={Boolean(previewNode?.metadata?.content)}
                    centered
                    onCancel={() => setPreviewNodeId(null)}
                    footer={null}
                    width="auto"
                    styles={{ body: { padding: 0, display: "flex", justifyContent: "center", alignItems: "center", maxHeight: "80vh" } }}
                >
                    {previewNode?.metadata?.content ? <img src={previewNode.metadata.content} alt={previewNode.title || "图片"} style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }} /> : null}
                </Modal>

                <Modal
                    title="清空画布？"
                    open={clearConfirmOpen}
                    centered
                    onCancel={() => setClearConfirmOpen(false)}
                    footer={
                        <>
                            <Button onClick={() => setClearConfirmOpen(false)}>取消</Button>
                            <Button danger type="primary" onClick={clearCanvas}>
                                清空
                            </Button>
                        </>
                    }
                >
                    <p className="text-sm opacity-60">这会删除当前画布上的所有节点和连线。</p>
                </Modal>

                <AssetPickerModal open={assetPickerOpen} onInsert={handleAssetInsert} onClose={() => setAssetPickerOpen(false)} />
                <CanvasUserCenterModal open={userCenterOpen} onClose={() => setUserCenterOpen(false)} />
                <CanvasProjectsModal open={projectsModalOpen} onClose={() => setProjectsModalOpen(false)} />
            </section>
        </main>
    );
}

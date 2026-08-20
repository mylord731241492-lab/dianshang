import type { HjmPromptReference } from "@/integrations/hajimi/project-schema";

export type Position = {
    x: number;
    y: number;
};

export type ViewportTransform = {
    x: number;
    y: number;
    k: number;
};

export enum CanvasNodeType {
    Image = "image",
    Text = "text",
    Config = "config",
    Video = "video",
    Audio = "audio",
    Group = "group",
}

// 节点类型放开为字符串,内置类型用 CanvasNodeType,插件类型为 "<pluginId>:<name>"
export type CanvasNodeTypeId = CanvasNodeType | (string & {});

export type CanvasNodeStatus = "idle" | "success" | "loading" | "error";
export type CanvasGenerationMode = "text" | "image" | "video" | "audio";
export type CanvasImageGenerationType = "generation" | "edit";

// 持久生图任务在节点上的状态快照（Task 8）：刷新项目后对非终态 taskId 继续轮询，不重新提交。
export type CanvasGenerationTaskState = {
    taskId: string;
    assetId?: string;
    status: "pending" | "running" | "success" | "failed" | "cancelled";
    stage?: string;
    progressText?: string;
    /** 排队位置（pending 时 >0，0 表示已在执行）。 */
    queuePosition?: number;
    resultUrls?: string[];
    billingStatus?: string;
    errorCode?: string;
    /** 批次内该节点对应的结果图序号（根节点为 0）。 */
    imageIndex?: number;
    /** 上游计费状态；unknown 表示计费歧义（ADR-0004）。 */
    providerBillingStatus?: string;
    upstreamBillingAmbiguous?: boolean;
};

export type CanvasGeneratedImage = {
    content: string;
    storageKey?: string;
    mimeType?: string;
    naturalWidth?: number;
    naturalHeight?: number;
    bytes?: number;
};

export type CanvasNodeMetadata = {
    content?: string;
    composerContent?: string;
    prompt?: string;
    status?: CanvasNodeStatus;
    errorDetails?: string;
    fontSize?: number;
    generationMode?: CanvasGenerationMode;
    generationType?: CanvasImageGenerationType;
    model?: string;
    size?: string;
    quality?: string;
    background?: string;
    count?: number;
    seconds?: string;
    vquality?: string;
    generateAudio?: string;
    watermark?: string;
    audioVoice?: string;
    audioFormat?: string;
    audioSpeed?: string;
    audioInstructions?: string;
    references?: string[];
    naturalWidth?: number;
    naturalHeight?: number;
    freeResize?: boolean;
    isBatchRoot?: boolean;
    batchRootId?: string;
    batchChildIds?: string[];
    batchUsesReferenceImages?: boolean;
    primaryImageId?: string;
    imageBatchExpanded?: boolean;
    storageKey?: string;
    mimeType?: string;
    bytes?: number;
    durationMs?: number;
    groupId?: string;
    promptReference?: HjmPromptReference; // 插入提示词时保存 scope + promptId + version + contentSnapshot（Task 7）
    routeId?: string; // 生图节点选择的后端线路（Task 8，来自 /api/user/routes）
    generationTask?: CanvasGenerationTaskState; // 持久生图任务状态（Task 8）
    generatedImages?: CanvasGeneratedImage[]; // 生图节点同节点承载的持久化结果
    selectedGeneratedImageIndex?: number; // 当前选中的输出图序号
    sourceNodeId?: string; // 图片工具结果的可追溯来源节点（Task 9：局部重绘/擦除/扩图/反推）
    derivedFrom?: string; // 派生方式（inpaint/erase/outpaint/reverse-prompt/angle）
    interactive?: boolean; // 插件节点「交互 ⇄ 移动」开关状态(见 CanvasNodeDefinition.interactionToggle)
};

export type CanvasNodeData = {
    id: string;
    type: CanvasNodeTypeId;
    title: string;
    position: Position;
    width: number;
    height: number;
    metadata?: CanvasNodeMetadata;
};

export type CanvasConnection = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
};

export type CanvasAssistantReference = {
    id: string;
    type: CanvasNodeTypeId;
    title: string;
    dataUrl?: string;
    storageKey?: string;
    text?: string;
};

export type CanvasAssistantImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    prompt: string;
};

export type CanvasAssistantMessage = {
    id: string;
    role: "user" | "assistant" | "system" | "tool" | "error";
    title?: string;
    text: string;
    meta?: string;
    detail?: unknown;
    references?: CanvasAssistantReference[];
};

export type CanvasAssistantSession = {
    id: string;
    title: string;
    messages: CanvasAssistantMessage[];
    createdAt: string;
    updatedAt: string;
};

export type ConnectionHandle = {
    nodeId: string;
    handleType: "source" | "target";
};

export type SelectionBox = {
    startWorldX: number;
    startWorldY: number;
    currentWorldX: number;
    currentWorldY: number;
    additive: boolean;
    initialSelectedNodeIds: string[];
};

export type ContextMenuState =
    | {
          type: "node";
          x: number;
          y: number;
          nodeId: string;
      }
    | {
          type: "connection";
          x: number;
          y: number;
          connectionId: string;
      };

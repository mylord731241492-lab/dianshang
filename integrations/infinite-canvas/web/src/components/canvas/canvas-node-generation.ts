import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import { mediaReferenceLabel } from "@/lib/canvas/canvas-resource-references";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";
import { CanvasNodeType, type CanvasConnection, type CanvasGenerationTaskState, type CanvasNodeData } from "@/types/canvas";
import { getGenerationResourceNodes } from "@/lib/canvas/canvas-resource-references";
import { taskStageLabel, type GenerationApi, type GenerationTask } from "@/integrations/hajimi/generation-api";

export type NodeGenerationContext = {
    prompt: string;
    referenceImages: ReferenceImage[];
    referenceVideos: ReferenceVideo[];
    referenceAudios: ReferenceAudio[];
    textCount: number;
    imageCount: number;
    videoCount: number;
    audioCount: number;
};

export type NodeGenerationInput = {
    nodeId: string;
    type: "text" | "image" | "video" | "audio";
    title: string;
    text?: string;
    image?: ReferenceImage;
    video?: ReferenceVideo;
    audio?: ReferenceAudio;
};

export function buildNodeGenerationContext(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[], prompt: string): NodeGenerationContext {
    const inputs = buildNodeGenerationInputs(nodeId, nodes, connections);
    const sourceNode = nodes.find((node) => node.id === nodeId);
    if (sourceNode?.type === CanvasNodeType.Config && Boolean(sourceNode.metadata?.composerContent?.trim())) {
        return buildComposerGenerationContext(inputs, prompt);
    }

    const upstreamText = inputs
        .map((input) => input.text)
        .filter(Boolean)
        .join("\n\n");
    const referenceImages = inputs.map((input) => input.image).filter((image): image is ReferenceImage => Boolean(image));
    const referenceVideos = inputs.map((input) => input.video).filter((video): video is ReferenceVideo => Boolean(video));
    const referenceAudios = inputs.map((input) => input.audio).filter((audio): audio is ReferenceAudio => Boolean(audio));

    return {
        prompt: upstreamText ? `${prompt}\n\n${upstreamText}` : prompt,
        referenceImages,
        referenceVideos,
        referenceAudios,
        textCount: inputs.filter((input) => input.type === "text").length,
        imageCount: referenceImages.length,
        videoCount: referenceVideos.length,
        audioCount: referenceAudios.length,
    };
}

function buildComposerGenerationContext(inputs: NodeGenerationInput[], prompt: string): NodeGenerationContext {
    const inputByNodeId = new Map(inputs.map((input) => [input.nodeId, input]));
    const selectedInputs: NodeGenerationInput[] = [];
    const labelByNodeId = new Map<string, string>();
    const textBlocks: string[] = [];
    const counts = { image: 0, video: 0, audio: 0, text: 0 };
    let hasToken = false;
    let lastIndex = 0;
    let nextPrompt = "";

    for (const match of prompt.matchAll(/@\[node:([^\]]+)\]/g)) {
        if (match.index === undefined) continue;
        hasToken = true;
        nextPrompt += prompt.slice(lastIndex, match.index);
        const input = inputByNodeId.get(match[1]);
        if (input) {
            let label = labelByNodeId.get(input.nodeId);
            if (!label) {
                label = generationLabel(input.type, counts[input.type]++);
                labelByNodeId.set(input.nodeId, label);
                if (input.type === "text") textBlocks.push(`【${label}】\n${input.text || ""}`);
                else selectedInputs.push(input);
            }
            nextPrompt += input.type === "text" ? `【${label}】` : label;
        }
        lastIndex = match.index + match[0].length;
    }

    nextPrompt += prompt.slice(lastIndex);
    if (textBlocks.length) nextPrompt = `${nextPrompt.trim()}\n\n${textBlocks.join("\n\n")}`;
    const referenceImages = selectedInputs.map((input) => input.image).filter((image): image is ReferenceImage => Boolean(image));
    const referenceVideos = selectedInputs.map((input) => input.video).filter((video): video is ReferenceVideo => Boolean(video));
    const referenceAudios = selectedInputs.map((input) => input.audio).filter((audio): audio is ReferenceAudio => Boolean(audio));

    if (!hasToken) {
        const referenceImages = inputs.map((input) => input.image).filter((image): image is ReferenceImage => Boolean(image));
        const referenceVideos = inputs.map((input) => input.video).filter((video): video is ReferenceVideo => Boolean(video));
        const referenceAudios = inputs.map((input) => input.audio).filter((audio): audio is ReferenceAudio => Boolean(audio));
        const upstreamText = inputs
            .map((input) => input.text)
            .filter(Boolean)
            .join("\n\n");
        return {
            prompt: upstreamText ? `${prompt}\n\n${upstreamText}` : prompt,
            referenceImages,
            referenceVideos,
            referenceAudios,
            textCount: inputs.filter((input) => input.type === "text").length,
            imageCount: referenceImages.length,
            videoCount: referenceVideos.length,
            audioCount: referenceAudios.length,
        };
    }

    return {
        prompt: nextPrompt,
        referenceImages,
        referenceVideos,
        referenceAudios,
        textCount: counts.text,
        imageCount: referenceImages.length,
        videoCount: referenceVideos.length,
        audioCount: referenceAudios.length,
    };
}

export function buildNodeGenerationInputs(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]): NodeGenerationInput[] {
    return getGenerationResourceNodes(nodeId, nodes, connections).flatMap((node): NodeGenerationInput[] => {
        const image = readReferenceImage(node);
        if (image) return [{ nodeId: node.id, type: "image" as const, title: node.title, image }];
        const video = readReferenceVideo(node);
        if (video) return [{ nodeId: node.id, type: "video" as const, title: node.title, video }];
        const audio = readReferenceAudio(node);
        if (audio) return [{ nodeId: node.id, type: "audio" as const, title: node.title, audio }];
        const text = readNodeTextInput(node);
        if (text) return [{ nodeId: node.id, type: "text" as const, title: node.title, text }];
        return [];
    });
}

async function hydrateReferenceImages(referenceImages: ReferenceImage[]) {
    const { imageToDataUrl } = await import("@/services/image-storage");
    return Promise.all(referenceImages.map(async (image) => ({ ...image, dataUrl: await imageToDataUrl(image) })));
}

export async function hydrateNodeGenerationContext(context: NodeGenerationContext) {
    return { ...context, referenceImages: await hydrateReferenceImages(context.referenceImages) };
}

// ---- Task 8：画布生图统一走同源持久任务 /api/generate/tasks（禁止 Provider 直连）----

export type NodeImageGenerationSubmit = {
    prompt: string;
    /** 模型键（gpt-image-2 等）；兼容旧 "channel::model" 形态，只取模型部分。 */
    model: string;
    routeId?: string;
    /** 比例（1:1 或 auto），来自节点/全局配置的 size 字段。 */
    size?: string;
    quality?: string;
    imageCount: number;
    referenceImages: ReferenceImage[];
    clientRequestId: string;
};

export function normalizeNodeModelKey(model: string): string {
    const text = String(model || "").trim();
    return text.includes("::") ? text.split("::").pop()!.trim() : text;
}

// 节点 metadata.generationTask 快照：只保存计划字段，不保存 accessUrl（短时效，不落项目 JSON）。
export function taskStateFromGenerationTask(task: GenerationTask, imageIndex?: number): CanvasGenerationTaskState {
    return {
        taskId: task.taskId,
        assetId: task.assetId,
        status: task.status,
        stage: task.stage,
        progressText: task.errorMessage || taskStageLabel(task.stage),
        queuePosition: task.queuePosition || 0,
        resultUrls: task.images.map((image) => image.url),
        billingStatus: task.billingStatus,
        errorCode: task.errorCode || undefined,
        imageIndex,
        providerBillingStatus: task.providerBillingStatus,
        upstreamBillingAmbiguous: task.upstreamBillingAmbiguous || undefined,
    };
}

// 创建持久生图任务：幂等键由调用方按操作生成并复用；参考图以 dataUrl/url 提交，服务端暂存任务文件。
export async function submitNodeImageGeneration(api: GenerationApi, input: NodeImageGenerationSubmit): Promise<GenerationTask> {
    const referenceImages = await hydrateReferenceImages(input.referenceImages);
    return api.submit({
        prompt: input.prompt,
        modelKey: normalizeNodeModelKey(input.model),
        routeId: input.routeId,
        ratio: input.size,
        quality: input.quality,
        imageCount: input.imageCount,
        clientRequestId: input.clientRequestId,
        referenceImages: referenceImages.map((image) =>
            image.dataUrl.startsWith("data:")
                ? { name: image.name, type: image.type, dataUrl: image.dataUrl }
                : { name: image.name, type: image.type, url: image.dataUrl },
        ),
    });
}

export async function waitNodeImageGeneration(api: GenerationApi, taskId: string, options: { signal?: AbortSignal; onUpdate?: (task: GenerationTask) => void } = {}): Promise<GenerationTask> {
    // 10 人共用全局并发 3 的有界队列，排队 + 慢线路可能远超默认 5 分钟；放宽到 20 分钟，
    // 避免前端误判失败（服务端任务仍在跑且已扣费，超时只能依赖刷新后的 resume 找回）。
    return api.waitForTask(taskId, { signal: options.signal, onUpdate: options.onUpdate, timeoutMs: 20 * 60 * 1000 });
}

function readNodeTextInput(node: CanvasNodeData) {
    if (node.type === CanvasNodeType.Text) return node.metadata?.content || node.metadata?.prompt || "";
    return node.metadata?.prompt || "";
}

function generationLabel(type: NodeGenerationInput["type"], index: number) {
    if (type === "image") return imageReferenceLabel(index);
    if (type === "video" || type === "audio") return mediaReferenceLabel(type, index);
    return `文本${index + 1}`;
}

function readReferenceImage(node: CanvasNodeData): ReferenceImage | null {
    if ((node.type !== CanvasNodeType.Image && node.type !== CanvasNodeType.Config) || !node.metadata?.content) return null;
    return {
        id: node.id,
        name: `${node.title || node.id}.png`,
        type: node.metadata.mimeType || "image/png",
        dataUrl: node.metadata.content,
        storageKey: node.metadata.storageKey,
    };
}

function readReferenceVideo(node: CanvasNodeData): ReferenceVideo | null {
    if (node.type !== CanvasNodeType.Video || !node.metadata?.content) return null;
    return {
        id: node.id,
        name: `${node.title || node.id}.mp4`,
        type: node.metadata.mimeType || "video/mp4",
        url: node.metadata.content,
        storageKey: node.metadata.storageKey,
        bytes: node.metadata.bytes,
        width: node.metadata.naturalWidth,
        height: node.metadata.naturalHeight,
        durationMs: node.metadata.durationMs,
    };
}

function readReferenceAudio(node: CanvasNodeData): ReferenceAudio | null {
    if (node.type !== CanvasNodeType.Audio || !node.metadata?.content) return null;
    return {
        id: node.id,
        name: `${node.title || node.id}.mp3`,
        type: node.metadata.mimeType || "audio/mpeg",
        url: node.metadata.content,
        storageKey: node.metadata.storageKey,
        durationMs: node.metadata.durationMs,
    };
}

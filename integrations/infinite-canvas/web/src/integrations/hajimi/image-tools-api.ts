// 图片编辑工具同源 API 封装（Task 9）：局部重绘 / 智能擦除 / 扩图 / 反推提示词 / 免费 AI 扩写。
// 契约以 server.js 为准：
// - POST /api/image-tools/inpaint|erase：body 携带原图 imageUrl、PNG mask、prompt；
//   成功响应带结果图 url/imageUrl + assetId + 15 分钟同源 accessUrl（结果已写入账号云端资产库）。
// - POST /api/image-tools/outpaint：body 携带原图、目标比例 ratio 与布局参数 layout；
//   成功响应同样带 assetId + accessUrl。
// - POST /api/image-tools/reverse-prompt：纯文本反推，响应 { prompt }，不落资产、不生图。
// - POST /api/canvas/enhance-prompt：免费扩写（free=true, costPoints=0），只返回文本，不生图。
// mask 语义契约（与后端提示词语义一致）：PNG data URL，涂抹区 alpha=0（透明）= 需要重绘的区域，
// 未涂抹区白色不透明 = 必须保持不变的区域；由 canvas-node-mask-edit-dialog 的 buildEditMask 生成。
// 本模块必须是纯契约层：不得 import 应用源码、@/ 别名或 JSX（strip-types 契约测试直接加载）。

// mask 语义：涂抹区透明 → 重绘；未涂抹区白色不透明 → 保留。
export const IMAGE_TOOL_MASK_CONTRACT = {
    format: "image/png",
    paintedRegion: "transparent",
    keptRegion: "opaque-white",
} as const;

export type ImageToolOperation = "inpaint" | "erase" | "outpaint";

export type OutpaintAnchor = "center" | "top" | "bottom" | "left" | "right";

export type ImageToolResultImage = {
    url: string;
    assetId?: string;
    /** 后端签发的 15 分钟短时效同源读取路径；仅展示用，不得写入项目 JSON。 */
    accessUrl?: string;
    width: number | null;
    height: number | null;
};

export type ImageToolEditResult = {
    taskId: string;
    operation: ImageToolOperation;
    mock: boolean;
    image: ImageToolResultImage;
    assetId?: string;
    accessUrl?: string;
};

export type ReversePromptResult = {
    prompt: string;
    mock: boolean;
};

export type EnhancePromptResult = {
    prompt: string;
    free: boolean;
    costPoints: number;
    mock: boolean;
};

export type MaskEditInput = {
    imageUrl: string;
    maskDataUrl: string;
    prompt?: string;
    width?: number;
    height?: number;
};

export type OutpaintInput = {
    imageUrl: string;
    prompt?: string;
    ratio: string;
    anchor?: OutpaintAnchor;
    width?: number;
    height?: number;
};

export type ReversePromptInput = {
    imageUrl: string;
};

export type EnhancePromptInput = {
    prompt: string;
    imageUrls?: string[];
};

export type ImageToolsApiClient = {
    post: <T>(path: string, body?: unknown) => Promise<T>;
};

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function firstString(...values: unknown[]): string {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

function toNullableNumber(value: unknown): number | null {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
}

function requireImageUrl(imageUrl: unknown): string {
    const url = firstString(imageUrl);
    if (!url) throw new Error("缺少待处理图片");
    return url;
}

// mask 必须是 PNG data URL（涂抹区透明/保留区白色不透明，见 IMAGE_TOOL_MASK_CONTRACT）。
function requirePngMask(maskDataUrl: unknown): string {
    const mask = firstString(maskDataUrl);
    if (!mask) throw new Error("请先涂抹需要处理的区域");
    if (!mask.startsWith("data:image/png")) throw new Error("mask 必须是 PNG data URL（涂抹区透明、保留区白色不透明）");
    return mask;
}

// accessUrl 只接受同源相对路径（/api/asset-content/... 短时签名），拒绝一切外链。
function readAccessUrl(value: unknown): string | undefined {
    const url = firstString(value);
    if (!url) return undefined;
    if (/^https?:\/\//i.test(url) || url.startsWith("//")) throw new Error("资产访问 URL 必须是同源短时签名路径");
    return url;
}

function readResultImage(payload: Record<string, unknown>): ImageToolResultImage {
    const images = Array.isArray(payload.images) ? payload.images : Array.isArray(payload.resultImages) ? payload.resultImages : [];
    const first = toRecord(images[0]);
    const url = firstString(payload.imageUrl, payload.url, first?.url, first?.imageUrl, first?.image_url);
    if (!url) throw new Error("图片工具响应缺少结果图");
    return {
        url,
        assetId: firstString(payload.assetId, first?.assetId) || undefined,
        accessUrl: readAccessUrl(firstString(payload.accessUrl, first?.accessUrl)),
        width: toNullableNumber(payload.width ?? first?.width ?? first?.naturalWidth),
        height: toNullableNumber(payload.height ?? first?.height ?? first?.naturalHeight),
    };
}

export function readImageToolEditResult(payload: unknown, operation: ImageToolOperation): ImageToolEditResult {
    const record = toRecord(payload);
    if (!record || record.success === false) throw new Error("图片工具响应格式异常");
    const image = readResultImage(record);
    return {
        taskId: firstString(record.taskId, record.id),
        operation,
        mock: Boolean(record.mock),
        image,
        assetId: image.assetId,
        accessUrl: image.accessUrl,
    };
}

export function readReversePromptResult(payload: unknown): ReversePromptResult {
    const record = toRecord(payload);
    const prompt = firstString(record?.prompt, record?.text, record?.rawPrompt);
    if (!record || record.success === false || !prompt) throw new Error("反推提示词响应缺少文本");
    return { prompt, mock: Boolean(record.mock) };
}

export function readEnhancePromptResult(payload: unknown): EnhancePromptResult {
    const record = toRecord(payload);
    const prompt = firstString(record?.prompt, record?.text);
    if (!record || record.success === false || !prompt) throw new Error("提示词扩写响应缺少文本");
    return {
        prompt,
        free: record.free !== false,
        costPoints: Number(record.costPoints) || 0,
        mock: Boolean(record.mock),
    };
}

function buildMaskEditBody(input: MaskEditInput): Record<string, unknown> {
    const body: Record<string, unknown> = {
        imageUrl: requireImageUrl(input.imageUrl),
        mask: requirePngMask(input.maskDataUrl),
    };
    const prompt = firstString(input.prompt);
    if (prompt) body.prompt = prompt;
    if (toNullableNumber(input.width)) body.imageNaturalWidth = input.width;
    if (toNullableNumber(input.height)) body.imageNaturalHeight = input.height;
    return body;
}

function buildOutpaintBody(input: OutpaintInput): Record<string, unknown> {
    const ratio = firstString(input.ratio);
    if (!ratio) throw new Error("缺少扩图目标比例");
    const body: Record<string, unknown> = {
        imageUrl: requireImageUrl(input.imageUrl),
        ratio,
        size: ratio,
        layout: { anchor: input.anchor || "center" },
    };
    const prompt = firstString(input.prompt);
    if (prompt) body.prompt = prompt;
    if (toNullableNumber(input.width)) body.imageNaturalWidth = input.width;
    if (toNullableNumber(input.height)) body.imageNaturalHeight = input.height;
    return body;
}

export function createImageToolsApi(client: ImageToolsApiClient) {
    return {
        // 局部重绘：原图 + PNG mask（透明区=重绘区）+ 修改要求。
        async inpaint(input: MaskEditInput): Promise<ImageToolEditResult> {
            const body = buildMaskEditBody(input);
            if (!body.prompt) throw new Error("请输入修改要求");
            return readImageToolEditResult(await client.post("/api/image-tools/inpaint", body), "inpaint");
        },
        // 智能擦除：原图 + PNG mask；prompt 可空（后端有默认擦除提示）。
        async erase(input: MaskEditInput): Promise<ImageToolEditResult> {
            return readImageToolEditResult(await client.post("/api/image-tools/erase", buildMaskEditBody(input)), "erase");
        },
        // 扩图：原图 + 目标比例 + 布局锚点。
        async outpaint(input: OutpaintInput): Promise<ImageToolEditResult> {
            return readImageToolEditResult(await client.post("/api/image-tools/outpaint", buildOutpaintBody(input)), "outpaint");
        },
        // 反推提示词：纯文本，不落资产不生图。
        async reversePrompt(input: ReversePromptInput): Promise<ReversePromptResult> {
            return readReversePromptResult(await client.post("/api/image-tools/reverse-prompt", { imageUrl: requireImageUrl(input.imageUrl) }));
        },
        // 免费 AI 扩写：只返回文本回填，调用方不得链接触发生图。
        async enhancePrompt(input: EnhancePromptInput): Promise<EnhancePromptResult> {
            const prompt = firstString(input.prompt);
            const imageUrls = (Array.isArray(input.imageUrls) ? input.imageUrls : []).map(firstString).filter(Boolean);
            if (!prompt && !imageUrls.length) throw new Error("请先输入提示词或连接参考图");
            const body: Record<string, unknown> = { currentPrompt: prompt };
            if (imageUrls.length) body.referenceImages = imageUrls.map((url) => ({ url }));
            return readEnhancePromptResult(await client.post("/api/canvas/enhance-prompt", body));
        },
    };
}

export type ImageToolsApi = ReturnType<typeof createImageToolsApi>;

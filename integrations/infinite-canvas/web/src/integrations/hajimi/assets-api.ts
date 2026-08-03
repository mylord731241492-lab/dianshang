// 账号隔离云端资产库：/api/user/assets* 同源 API 封装（ADR-0006）。
// 契约以 server.js + backend/assets 为准：
// - 列表 GET /api/user/assets?q=&kind=&cursor=&limit= 返回 { success, items, nextCursor }，必须分页。
// - 上传 POST /api/user/assets/upload 为 multipart（字段名 file），响应 { success, asset }。
// - 详情/导入/上传响应中的 asset 附带短期 accessUrl；access-url 接口返回 { url, expiresAt, expiresInSeconds }。
// - accessUrl 一律是同源 /api/asset-content/:assetId?expires=&sig= 短时签名路径（15 分钟），
//   浏览器永远不接触对象存储密钥、永久签名 URL 或 Bucket 凭据。
// - 项目 JSON 只保存 assetId（storageKey = "asset:<assetId>"），不保存 Blob/Base64/永久 URL。
// 本模块必须是纯契约层：不得 import 应用源码、@/ 别名或 JSX（strip-types 契约测试直接加载）。

export type CloudAssetKind = "image" | "video" | "audio";

export type CloudAsset = {
    id: string;
    kind: CloudAssetKind;
    name: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    checksumSha256: string;
    tags: string[];
    source: string;
    prompt?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    /** 后端签发的 15 分钟短时效同源读取路径；仅展示用，不得写入项目 JSON。 */
    accessUrl?: string;
};

export type CloudAssetListPage = {
    items: CloudAsset[];
    nextCursor: string | null;
};

export type CloudAssetAccessUrl = {
    url: string;
    expiresAt: string;
    expiresInSeconds: number;
};

export type AssetsApiClient = {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
    put: <T>(path: string, body?: unknown) => Promise<T>;
    delete: <T>(path: string) => Promise<T>;
};

// multipart 上传由调用方注入（浏览器 fetch + FormData；测试注入假实现）。
export type AssetUploadTransport = (input: { path: string; file: Blob; fileName: string }) => Promise<unknown>;

// 项目 JSON 中资产引用的 storageKey 形态：asset:<assetId>。
export const ASSET_STORAGE_KEY_PREFIX = "asset:";
// 与 ADR-0006 一致的签名读取 URL 有效期（秒），仅用于前端展示提示，不构成安全边界。
export const ASSET_ACCESS_URL_TTL_SECONDS = 900;

const CLOUD_ASSET_KINDS: readonly string[] = ["image", "video", "audio"];
const DEFAULT_LIST_LIMIT = 24;
const MAX_LIST_LIMIT = 100;

export function assetStorageKey(assetId: string): string {
    return `${ASSET_STORAGE_KEY_PREFIX}${assetId}`;
}

export function parseAssetStorageKey(storageKey: unknown): string | null {
    if (typeof storageKey !== "string" || !storageKey.startsWith(ASSET_STORAGE_KEY_PREFIX)) return null;
    const assetId = storageKey.slice(ASSET_STORAGE_KEY_PREFIX.length);
    return assetId ? assetId : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toKind(value: unknown): CloudAssetKind {
    return CLOUD_ASSET_KINDS.includes(String(value)) ? (value as CloudAssetKind) : "image";
}

function toNullableNumber(value: unknown): number | null {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
}

// 资产实体读取：兼容 { asset } 包裹与顶层字段两种形态。
// 绝不向调用方暴露 object_key、storage_provider 以外的存储内部信息；响应中本就不允许出现存储密钥。
export function readCloudAsset(payload: unknown): CloudAsset | null {
    const record = toRecord(payload);
    if (!record) return null;
    const source = toRecord(record.asset) ?? record;
    if (typeof source.id !== "string" || !source.id) return null;
    return {
        id: source.id,
        kind: toKind(source.kind),
        name: typeof source.name === "string" ? source.name : "未命名资产",
        mimeType: typeof source.mimeType === "string" ? source.mimeType : "application/octet-stream",
        sizeBytes: Number(source.sizeBytes) || 0,
        width: toNullableNumber(source.width),
        height: toNullableNumber(source.height),
        checksumSha256: typeof source.checksumSha256 === "string" ? source.checksumSha256 : "",
        tags: Array.isArray(source.tags) ? source.tags.map((tag) => String(tag)) : [],
        source: typeof source.source === "string" ? source.source : "upload",
        prompt: typeof source.prompt === "string" && source.prompt ? source.prompt : undefined,
        status: typeof source.status === "string" ? source.status : "active",
        createdAt: typeof source.createdAt === "string" ? source.createdAt : "",
        updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
        accessUrl: typeof source.accessUrl === "string" ? source.accessUrl : undefined,
    };
}

export function readCloudAssetList(payload: unknown): CloudAssetListPage {
    const record = toRecord(payload);
    if (!record || !Array.isArray(record.items)) return { items: [], nextCursor: null };
    return {
        items: record.items.map(readCloudAsset).filter((item): item is CloudAsset => Boolean(item)),
        nextCursor: typeof record.nextCursor === "string" && record.nextCursor ? record.nextCursor : null,
    };
}

// access-url 契约：必须是同源 /api/asset-content/ 签名路径，拒绝一切外链或永久 URL 形态。
export function readCloudAssetAccessUrl(payload: unknown): CloudAssetAccessUrl | null {
    const record = toRecord(payload);
    if (!record) return null;
    const url = typeof record.url === "string" ? record.url : "";
    if (!url.startsWith("/api/asset-content/")) return null;
    return {
        url,
        expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : "",
        expiresInSeconds: Number(record.expiresInSeconds) || 0,
    };
}

function buildListPath(params: { q?: string; kind?: string; source?: string; cursor?: string; limit?: number } = {}): string {
    const search = new URLSearchParams();
    const query = String(params.q || "").trim();
    if (query) search.set("q", query);
    if (params.source) search.set("source", String(params.source));
    if (params.kind && CLOUD_ASSET_KINDS.includes(params.kind)) search.set("kind", params.kind);
    if (params.cursor) search.set("cursor", params.cursor);
    const limit = Math.max(1, Math.min(Number(params.limit) || DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT));
    search.set("limit", String(limit));
    const suffix = search.toString();
    return suffix ? `/api/user/assets?${suffix}` : "/api/user/assets";
}

export function createAssetsApi(client: AssetsApiClient, uploadTransport: AssetUploadTransport) {
    return {
        async list(params: { q?: string; kind?: string; source?: string; cursor?: string; limit?: number } = {}): Promise<CloudAssetListPage> {
            return readCloudAssetList(await client.get(buildListPath(params)));
        },
        async upload(file: Blob, options: { name?: string } = {}): Promise<CloudAsset> {
            const fileName = String(options.name || "").trim() || ("name" in file && typeof file.name === "string" && file.name ? file.name : "asset.bin");
            const asset = readCloudAsset(await uploadTransport({ path: "/api/user/assets/upload", file, fileName }));
            if (!asset) throw new Error("上传资产响应缺少服务器资产 ID");
            return asset;
        },
        async get(id: string): Promise<CloudAsset> {
            const asset = readCloudAsset(await client.get(`/api/user/assets/${encodeURIComponent(id)}`));
            if (!asset) throw new Error("资产详情响应格式异常");
            return asset;
        },
        async getAccessUrl(id: string): Promise<CloudAssetAccessUrl> {
            const access = readCloudAssetAccessUrl(await client.get(`/api/user/assets/${encodeURIComponent(id)}/access-url`));
            if (!access) throw new Error("资产访问 URL 响应格式异常：必须是同源 /api/asset-content/ 签名路径");
            return access;
        },
        async update(id: string, patch: { name?: string; tags?: string[] }): Promise<CloudAsset> {
            const body: Record<string, unknown> = {};
            if (patch.name !== undefined) body.name = patch.name;
            if (patch.tags !== undefined) body.tags = patch.tags;
            const asset = readCloudAsset(await client.put(`/api/user/assets/${encodeURIComponent(id)}`, body));
            if (!asset) throw new Error("资产更新响应格式异常");
            return asset;
        },
        // 删除为账号资产库软删除；云对象是否物理回收由后端策略决定，浏览器不参与。
        async remove(id: string): Promise<void> {
            await client.delete(`/api/user/assets/${encodeURIComponent(id)}`);
        },
        // 生成历史 ≠ 资产库：仅用户显式“保存到资产库”时调用。
        async importGeneration(generationId: string): Promise<CloudAsset> {
            const asset = readCloudAsset(await client.post("/api/user/assets/import-generation", { generationId }));
            if (!asset) throw new Error("导入生成记录响应缺少资产实体");
            return asset;
        },
    };
}

export type AssetsApi = ReturnType<typeof createAssetsApi>;

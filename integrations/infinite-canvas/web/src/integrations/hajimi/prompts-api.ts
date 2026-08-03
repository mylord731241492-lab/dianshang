// 双层云端提示词库：/api/prompts/system 与 /api/user/prompts* 同源 API 封装（Task 7）。
// 契约以 server.js + backend/prompts 为准：
// - 「默认提示词」只从 GET /api/prompts/system 获取（后端只返回已发布且未删除）。
// - 「我的提示词」只从 /api/user/prompts* 获取，按账号严格隔离。
// - 复制默认提示词走 POST /api/user/prompts/copy-system，副本归当前账号私有。
// - 列表均为 cursor 分页：{ success, items, nextCursor }。
// - 提示词正文权威副本只在服务端；本模块是纯契约层，
//   不得 import 应用源码、@/ 别名、JSX，也不得触碰 localStorage/IndexedDB/localforage。

export type PromptScope = "system" | "user";
export type SystemPromptStatus = "draft" | "published" | "disabled";

export type CloudPrompt = {
    id: string;
    scope: PromptScope;
    title: string;
    content: string;
    category: string;
    tags: string[];
    isFavorite: boolean;
    createdAt: string;
    updatedAt: string;
    /** 仅默认提示词返回。 */
    version?: number;
    /** 仅默认提示词返回。 */
    status?: SystemPromptStatus;
    /** 仅默认提示词返回。 */
    sortOrder?: number;
};

export type CloudPromptListPage = {
    items: CloudPrompt[];
    nextCursor: string | null;
};

export type UserPromptInput = {
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    isFavorite?: boolean;
};

export type SystemPromptListParams = {
    q?: string;
    category?: string;
    tag?: string;
    cursor?: string;
    limit?: number;
};

export type UserPromptListParams = SystemPromptListParams & {
    favorite?: boolean;
};

export type PromptsApiClient = {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
    put: <T>(path: string, body?: unknown) => Promise<T>;
    delete: <T>(path: string) => Promise<T>;
};

// 插入项目时保存的提示词引用：scope + promptId + version + contentSnapshot，
// 与项目信封 references.prompts 结构对齐（见 project-schema.ts）。
export type PromptInsertReference = {
    scope: PromptScope;
    promptId: string;
    version?: number;
    contentSnapshot: string;
};

export const PROMPT_LIBRARY_SYSTEM_PATH = "/api/prompts/system";
export const PROMPT_LIBRARY_USER_PATH = "/api/user/prompts";
export const PROMPT_LIBRARY_COPY_SYSTEM_PATH = "/api/user/prompts/copy-system";

const SYSTEM_PROMPT_STATUSES: readonly string[] = ["draft", "published", "disabled"];
const DEFAULT_LIST_LIMIT = 24;
const MAX_LIST_LIMIT = 100;

// 由提示词实体生成插入引用；contentSnapshot 冻结插入当下正文，后端后续修改/停用/删除不追溯。
export function buildPromptInsertReference(prompt: CloudPrompt): PromptInsertReference {
    return {
        scope: prompt.scope,
        promptId: prompt.id,
        ...(prompt.version !== undefined ? { version: prompt.version } : {}),
        contentSnapshot: prompt.content,
    };
}

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toScope(value: unknown): PromptScope {
    return value === "system" ? "system" : "user";
}

function toStatus(value: unknown): SystemPromptStatus | undefined {
    return SYSTEM_PROMPT_STATUSES.includes(String(value)) ? (value as SystemPromptStatus) : undefined;
}

// 提示词实体读取：兼容 { item } 包裹与顶层字段两种形态。
export function readCloudPrompt(payload: unknown): CloudPrompt | null {
    const record = toRecord(payload);
    if (!record) return null;
    const source = toRecord(record.item) ?? record;
    if (typeof source.id !== "string" || !source.id) return null;
    const version = Number(source.version);
    const sortOrder = Number(source.sortOrder);
    return {
        id: source.id,
        scope: toScope(source.scope),
        title: typeof source.title === "string" ? source.title : "未命名提示词",
        content: typeof source.content === "string" ? source.content : "",
        category: typeof source.category === "string" ? source.category : "",
        tags: Array.isArray(source.tags) ? source.tags.map((tag) => String(tag)) : [],
        isFavorite: source.isFavorite === true,
        createdAt: typeof source.createdAt === "string" ? source.createdAt : "",
        updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
        version: Number.isFinite(version) && version > 0 ? version : undefined,
        status: toStatus(source.status),
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
    };
}

export function readCloudPromptList(payload: unknown): CloudPromptListPage {
    const record = toRecord(payload);
    if (!record || !Array.isArray(record.items)) return { items: [], nextCursor: null };
    return {
        items: record.items.map(readCloudPrompt).filter((item): item is CloudPrompt => Boolean(item)),
        nextCursor: typeof record.nextCursor === "string" && record.nextCursor ? record.nextCursor : null,
    };
}

function normalizeLimit(limit: unknown): number {
    return Math.max(1, Math.min(Number(limit) || DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT));
}

function buildSystemListPath(params: SystemPromptListParams = {}): string {
    const search = new URLSearchParams();
    const query = String(params.q || "").trim();
    const category = String(params.category || "").trim();
    const tag = String(params.tag || "").trim();
    if (query) search.set("q", query);
    if (category) search.set("category", category);
    if (tag) search.set("tag", tag);
    if (params.cursor) search.set("cursor", params.cursor);
    search.set("limit", String(normalizeLimit(params.limit)));
    return `${PROMPT_LIBRARY_SYSTEM_PATH}?${search.toString()}`;
}

function buildUserListPath(params: UserPromptListParams = {}): string {
    const search = new URLSearchParams();
    const query = String(params.q || "").trim();
    const category = String(params.category || "").trim();
    const tag = String(params.tag || "").trim();
    if (query) search.set("q", query);
    if (category) search.set("category", category);
    if (tag) search.set("tag", tag);
    if (params.favorite === true) search.set("favorite", "1");
    if (params.cursor) search.set("cursor", params.cursor);
    search.set("limit", String(normalizeLimit(params.limit)));
    return `${PROMPT_LIBRARY_USER_PATH}?${search.toString()}`;
}

function toRequestBody(input: Partial<UserPromptInput>): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body.title = input.title;
    if (input.content !== undefined) body.content = input.content;
    if (input.category !== undefined) body.category = input.category;
    if (input.tags !== undefined) body.tags = input.tags;
    if (input.isFavorite !== undefined) body.isFavorite = input.isFavorite;
    return body;
}

export function createPromptsApi(client: PromptsApiClient) {
    return {
        // 默认提示词：普通用户只读，后端只返回已发布。
        async listSystem(params: SystemPromptListParams = {}): Promise<CloudPromptListPage> {
            return readCloudPromptList(await client.get(buildSystemListPath(params)));
        },
        // 我的提示词：当前账号私有。
        async listUser(params: UserPromptListParams = {}): Promise<CloudPromptListPage> {
            return readCloudPromptList(await client.get(buildUserListPath(params)));
        },
        async create(input: UserPromptInput): Promise<CloudPrompt> {
            const item = readCloudPrompt(await client.post(PROMPT_LIBRARY_USER_PATH, toRequestBody(input)));
            if (!item) throw new Error("创建提示词响应缺少提示词实体");
            return item;
        },
        async get(id: string): Promise<CloudPrompt> {
            const item = readCloudPrompt(await client.get(`${PROMPT_LIBRARY_USER_PATH}/${encodeURIComponent(id)}`));
            if (!item) throw new Error("提示词详情响应格式异常");
            return item;
        },
        async update(id: string, patch: Partial<UserPromptInput>): Promise<CloudPrompt> {
            const item = readCloudPrompt(await client.put(`${PROMPT_LIBRARY_USER_PATH}/${encodeURIComponent(id)}`, toRequestBody(patch)));
            if (!item) throw new Error("提示词更新响应格式异常");
            return item;
        },
        // 删除为软删除；已插入项目的 contentSnapshot 不受影响。
        async remove(id: string): Promise<void> {
            await client.delete(`${PROMPT_LIBRARY_USER_PATH}/${encodeURIComponent(id)}`);
        },
        // 复制已发布默认提示词为当前账号私有副本。
        async copySystem(systemPromptId: string): Promise<CloudPrompt> {
            const item = readCloudPrompt(await client.post(PROMPT_LIBRARY_COPY_SYSTEM_PATH, { systemPromptId }));
            if (!item) throw new Error("复制默认提示词响应缺少提示词实体");
            return item;
        },
    };
}

export type PromptsApi = ReturnType<typeof createPromptsApi>;

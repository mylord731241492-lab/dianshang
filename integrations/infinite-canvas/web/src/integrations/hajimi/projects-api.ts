// 项目仓库：/api/user/projects* 同源 API 封装。
// 契约以 server.js 为准：列表返回 { items, projects, list, data } 多包裹；
// 创建/详情返回 { ..., project }；创建与更新请求体为 { name, data }；
// 项目 id 一律由服务器生成（proj_*），浏览器不自行生成最终项目 ID。

export type ProjectListItem = {
    id: string;
    name: string;
    thumbnail: string;
    legacy?: boolean;
    updatedAt: string;
    createdAt: string;
};

export type ProjectEntity = {
    id: string;
    name: string;
    data: unknown;
    createdAt: string;
    updatedAt: string;
};

export type ProjectWriteInput = {
    name: string;
    data: unknown;
};

export type ProjectsApiClient = {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
    put: <T>(path: string, body?: unknown) => Promise<T>;
    delete: <T>(path: string) => Promise<T>;
};

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toListItem(value: unknown): ProjectListItem | null {
    const record = toRecord(value);
    if (!record || typeof record.id !== "string" || !record.id) return null;
    return {
        id: record.id,
        name: typeof record.name === "string" ? record.name : "未命名项目",
        thumbnail: typeof record.thumbnail === "string" ? record.thumbnail : "",
        legacy: record.legacy === true,
        updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
        createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    };
}

// 列表响应兼容 items/projects/list/data 多种包裹，内部统一为 items。
export function readProjectList(payload: unknown): ProjectListItem[] {
    const record = toRecord(payload);
    if (!record) return [];
    for (const key of ["items", "projects", "list", "data"]) {
        const value = record[key];
        if (!Array.isArray(value)) continue;
        return value.map(toListItem).filter((item): item is ProjectListItem => Boolean(item));
    }
    return [];
}

// 详情/创建响应兼容 { project } 包裹与顶层字段两种形态。
export function readProjectEntity(payload: unknown): ProjectEntity | null {
    const record = toRecord(payload);
    if (!record) return null;
    const source = toRecord(record.project) ?? record;
    if (typeof source.id !== "string" || !source.id) return null;
    return {
        id: source.id,
        name: typeof source.name === "string" ? source.name : "未命名项目",
        data: source.data,
        createdAt: typeof source.createdAt === "string" ? source.createdAt : "",
        updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
    };
}

export function createProjectsApi(client: ProjectsApiClient) {
    return {
        async list(): Promise<ProjectListItem[]> {
            return readProjectList(await client.get("/api/user/projects"));
        },
        async create(input: ProjectWriteInput): Promise<ProjectEntity> {
            const entity = readProjectEntity(await client.post("/api/user/projects", { name: input.name, data: input.data }));
            if (!entity) throw new Error("创建项目响应缺少服务器项目 ID");
            return entity;
        },
        async get(id: string): Promise<ProjectEntity> {
            const entity = readProjectEntity(await client.get(`/api/user/projects/${encodeURIComponent(id)}`));
            if (!entity) throw new Error("项目详情响应格式异常");
            return entity;
        },
        async update(id: string, input: ProjectWriteInput): Promise<void> {
            await client.put(`/api/user/projects/${encodeURIComponent(id)}`, { name: input.name, data: input.data });
        },
        async remove(id: string): Promise<void> {
            await client.delete(`/api/user/projects/${encodeURIComponent(id)}`);
        },
    };
}

export type ProjectsApi = ReturnType<typeof createProjectsApi>;

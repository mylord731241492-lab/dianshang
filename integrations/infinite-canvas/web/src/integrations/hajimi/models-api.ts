// 账号可用线路 / 模型 / 估费同源 API 封装（Task 8）。
// 契约：模型、价格与能力只从后端读取——
// - GET /api/user/routes?group=image 返回当前账号可用图片线路（含 defaultModelKey）。
// - GET /api/user/models?routeId=<id> 返回线路模型（modelKey/displayName/pricePoints）。
// - POST /api/generation/estimate-cost（不是 GET）请求体 { modelKey, routeId?, imageCount? }，
//   返回 { estimatedCost, totalCost, available }。
// 前端不得读取或展示 Base URL、API Key、Provider 原始配置。
// 本模块必须是纯契约层：不得 import 应用源码、@/ 别名或 JSX（strip-types 契约测试直接加载）。

export type UserRoute = {
    id: string;
    routeKey: string;
    displayName: string;
    enabled: boolean;
    isDefault: boolean;
    defaultModelKey: string;
};

export type RouteModel = {
    modelKey: string;
    displayName: string;
    realName: string;
    routeId: string;
    /** 单张价格（算力点）；未知时为 null，估费一律以 estimate-cost 为准。 */
    pricePoints: number | null;
    enabled: boolean;
};

export type CostEstimate = {
    estimatedCost: number;
    totalCost: number;
    available: number;
};

export type ModelsApiClient = {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
};

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function listPayload(payload: unknown): unknown[] {
    const record = toRecord(payload);
    if (!record) return [];
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.data)) return record.data;
    return [];
}

function readRoute(value: unknown): UserRoute | null {
    const record = toRecord(value);
    if (!record) return null;
    const id = typeof record.id === "string" && record.id ? record.id : typeof record.routeId === "string" ? (record.routeId as string) : "";
    if (!id) return null;
    return {
        id,
        routeKey: typeof record.routeKey === "string" ? record.routeKey : typeof record.routeCode === "string" ? (record.routeCode as string) : "",
        displayName: typeof record.displayName === "string" ? record.displayName : typeof record.name === "string" ? (record.name as string) : id,
        enabled: record.enabled !== false && record.status !== "disabled",
        isDefault: record.isDefault === true,
        defaultModelKey: typeof record.defaultModelKey === "string" ? record.defaultModelKey : "",
    };
}

function readModel(value: unknown): RouteModel | null {
    const record = toRecord(value);
    if (!record) return null;
    const modelKey = typeof record.modelKey === "string" && record.modelKey ? record.modelKey : typeof record.key === "string" ? (record.key as string) : "";
    if (!modelKey) return null;
    const price = Number(record.pricePoints ?? record.pointCost ?? record.price);
    return {
        modelKey,
        displayName: typeof record.displayName === "string" ? record.displayName : typeof record.name === "string" ? (record.name as string) : modelKey,
        realName: typeof record.realName === "string" ? record.realName : modelKey,
        routeId: typeof record.routeId === "string" ? record.routeId : "",
        pricePoints: Number.isFinite(price) && price >= 0 ? price : null,
        enabled: record.enabled !== false && record.status !== "disabled",
    };
}

export function readUserRoutes(payload: unknown): UserRoute[] {
    return listPayload(payload).map(readRoute).filter((route): route is UserRoute => Boolean(route));
}

export function readRouteModels(payload: unknown): RouteModel[] {
    return listPayload(payload).map(readModel).filter((model): model is RouteModel => Boolean(model));
}

export function readCostEstimate(payload: unknown): CostEstimate {
    const record = toRecord(payload) ?? {};
    return {
        estimatedCost: Number(record.estimatedCost) || 0,
        totalCost: Number(record.totalCost) || Number(record.estimatedCost) || 0,
        available: Number(record.available) || 0,
    };
}

export function createModelsApi(client: ModelsApiClient) {
    return {
        async listRoutes(group: string = "image"): Promise<UserRoute[]> {
            return readUserRoutes(await client.get(`/api/user/routes?group=${encodeURIComponent(group)}`));
        },
        async listModels(routeId: string): Promise<RouteModel[]> {
            return readRouteModels(await client.get(`/api/user/models?routeId=${encodeURIComponent(routeId)}`));
        },
        async estimateCost(input: { modelKey: string; routeId?: string; imageCount?: number }): Promise<CostEstimate> {
            const body: Record<string, unknown> = {
                modelKey: input.modelKey,
                imageCount: Math.max(1, Math.min(Number(input.imageCount) || 1, 4)),
            };
            if (input.routeId) body.routeId = input.routeId;
            return readCostEstimate(await client.post("/api/generation/estimate-cost", body));
        },
    };
}

export type ModelsApi = ReturnType<typeof createModelsApi>;

// 用户中心同源 API 封装：余额流水、生成记录、兑换码、头像设置。
// 全部走 /api/user/* 与 /api/upload，JWT 由 http client 注入，浏览器不接触任何密钥。
// 本模块为纯契约层：不得 import @/ 别名、React 或浏览器全局。

export type UserApiClient = {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
    put: <T>(path: string, body?: unknown) => Promise<T>;
    delete: <T>(path: string) => Promise<T>;
};

export type UserUploadTransport = (input: { path: string; file: Blob; fileName: string }) => Promise<unknown>;

export type BalanceLogItem = {
    id: number;
    type: string;
    changeAmount: number;
    beforeBalance: number;
    afterBalance: number;
    remark: string;
    createdAt: string;
};

export type GenerationRecord = {
    id: string;
    modelKey: string;
    prompt: string;
    resultUrl: string;
    cost: number;
    status: string;
    createdAt: string;
};

export type RedeemResult = {
    amount: number;
    balance: number;
};

export type UserProfile = {
    id: string;
    username: string;
    email: string;
    role: string;
    balance: number;
    avatarUrl: string;
    avatarType: string;
};

function readProfile(value: unknown): UserProfile | null {
    const record = toRecord(value);
    if (!record) return null;
    return {
        id: String(record.id || ""),
        username: String(record.username || ""),
        email: String(record.email || ""),
        role: String(record.role || "user"),
        balance: Number(record.balance ?? record.credits) || 0,
        avatarUrl: String(record.avatarUrl || record.avatar_url || ""),
        avatarType: String(record.avatarType || record.avatar_type || "preset"),
    };
}

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readBalanceLog(value: unknown): BalanceLogItem | null {
    const record = toRecord(value);
    if (!record) return null;
    return {
        id: Number(record.id) || 0,
        type: String(record.type || ""),
        changeAmount: Number(record.change_amount ?? record.changeAmount) || 0,
        beforeBalance: Number(record.before_balance ?? record.beforeBalance) || 0,
        afterBalance: Number(record.after_balance ?? record.afterBalance) || 0,
        remark: String(record.remark || ""),
        createdAt: String(record.created_at ?? record.createdAt ?? ""),
    };
}

function readGeneration(value: unknown): GenerationRecord | null {
    const record = toRecord(value);
    if (!record) return null;
    return {
        id: String(record.id || ""),
        modelKey: String(record.model_key ?? record.modelKey ?? record.model ?? ""),
        prompt: String(record.prompt || ""),
        resultUrl: String(record.result_url ?? record.resultUrl ?? ""),
        cost: Number(record.cost) || 0,
        status: String(record.status || ""),
        createdAt: String(record.created_at ?? record.createdAt ?? ""),
    };
}

export function createUserApi(client: UserApiClient, uploadTransport?: UserUploadTransport) {
    return {
        async getProfile(): Promise<UserProfile> {
            const payload = toRecord(await client.get("/api/user/profile")) ?? {};
            const profile = readProfile(toRecord(payload.user) ?? payload);
            if (!profile) throw new Error("用户资料响应格式异常");
            return profile;
        },
        async getBalanceLogs(limit = 20): Promise<BalanceLogItem[]> {
            const record = toRecord(await client.get("/api/user/balance-logs")) ?? {};
            return (Array.isArray(record.items) ? record.items : [])
                .map(readBalanceLog)
                .filter((item): item is BalanceLogItem => Boolean(item))
                .slice(0, limit);
        },
        async getGenerations(limit = 20): Promise<GenerationRecord[]> {
            const record = toRecord(await client.get("/api/user/generations")) ?? {};
            const items = Array.isArray(record.items) ? record.items : Array.isArray(record.generations) ? record.generations : [];
            return items
                .map(readGeneration)
                .filter((item): item is GenerationRecord => Boolean(item))
                .slice(0, limit);
        },
        async redeem(code: string): Promise<RedeemResult> {
            const record = toRecord(await client.post("/api/user/redeem", { code: code.trim() })) ?? {};
            return { amount: Number(record.amount) || 0, balance: Number(record.balance) || 0 };
        },
        async uploadAvatarFile(file: Blob, fileName: string): Promise<string> {
            if (!uploadTransport) throw new Error("当前环境未配置头像上传通道");
            const payload = toRecord(await uploadTransport({ path: "/api/upload", file, fileName })) ?? {};
            const url = String(payload.url || payload.imageUrl || "");
            if (!url) throw new Error("头像上传响应缺少 URL");
            return url;
        },
        async setAvatar(avatarUrl: string, avatarType: "preset" | "custom"): Promise<void> {
            await client.put("/api/user/avatar", { avatarUrl, avatarType });
        },
    };
}

export type UserApi = ReturnType<typeof createUserApi>;

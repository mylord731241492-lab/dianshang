// 上游公开提示词来源（GitHub 提示词合集）读取层。
// Task 7 起：账号提示词（系统/我的提示词库）事实源在服务端，见 integrations/hajimi/prompts-api.ts；
// 本模块只服务于未路由的上游展示页（首页橱窗、/prompts 页、Agent prompts_search 工具），
// 不再使用 localForage prompt_cache 持久化，也不依赖 use-prompt-source-store，
// 只保留进程内内存缓存（页面会话生命周期内有效，不构成权威副本）。

import { runPromptSource, type RawPrompt } from "./prompt-source-runtime";
import { DEFAULT_PROMPT_SOURCES, type PromptSource } from "./prompt-source-presets";

export type Prompt = RawPrompt & {
    sourceId: string;
    category: string;
    githubUrl: string;
};

export const ALL_PROMPTS_OPTION = "全部";

export type PromptListResponse = {
    items: Prompt[];
    tags: string[];
    categories: string[];
    total: number;
};

type SourceCache = {
    items: Prompt[];
    fetchedAt: number;
    signature: string;
};

const cacheTtlMs = 1000 * 60 * 60;
const sourceCaches = new Map<string, SourceCache>();
const loadingSources = new Map<string, Promise<Prompt[]>>();

function enabledSources() {
    return DEFAULT_PROMPT_SOURCES.filter((source) => source.enabled);
}

function sourceSignature(source: PromptSource) {
    const value = `${source.name}\n${source.url}\n${source.homepage}`;
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
    return `${value.length}:${hash}`;
}

function withSourceMeta(source: PromptSource, items: RawPrompt[]): Prompt[] {
    return items.map((item) => ({
        ...item,
        description: item.description || "",
        referenceImageUrls: Array.isArray(item.referenceImageUrls) ? item.referenceImageUrls : [],
        sourceId: source.id,
        category: source.name,
        githubUrl: item.sourceUrl || source.homepage,
    }));
}

async function fetchSource(source: PromptSource): Promise<Prompt[]> {
    const items = withSourceMeta(source, await runPromptSource(source));
    sourceCaches.set(source.id, { items, fetchedAt: Date.now(), signature: sourceSignature(source) });
    return items;
}

function getSourcePrompts(source: PromptSource): Promise<Prompt[]> {
    const cached = sourceCaches.get(source.id);
    if (cached && cached.signature === sourceSignature(source) && Date.now() - cached.fetchedAt < cacheTtlMs) {
        return Promise.resolve(cached.items);
    }
    const current = loadingSources.get(source.id);
    if (current) return current;
    const loading = fetchSource(source)
        .catch(() => cached?.items || [])
        .finally(() => loadingSources.delete(source.id));
    loadingSources.set(source.id, loading);
    return loading;
}

async function getAllPrompts(): Promise<Prompt[]> {
    const settled = await Promise.all(enabledSources().map(getSourcePrompts));
    return settled.flat();
}

export async function fetchPrompts({ keyword = "", tag = [], category = ALL_PROMPTS_OPTION, page = 1, pageSize = 20 }: { keyword?: string; tag?: string[]; category?: string; page?: number; pageSize?: number } = {}) {
    const items = await getAllPrompts();
    const normalizedKeyword = keyword.trim().toLowerCase();
    const normalizedPage = Math.max(1, page);
    const normalizedPageSize = Math.max(1, Math.min(100, pageSize));
    const withoutTagFilter = filterPrompts(items, { keyword: normalizedKeyword, category, tags: [] });
    const filtered = filterPrompts(items, { keyword: normalizedKeyword, category, tags: tag });
    const categories = enabledSources().map((source) => source.name);

    return {
        items: filtered.slice((normalizedPage - 1) * normalizedPageSize, normalizedPage * normalizedPageSize),
        tags: collectTags(withoutTagFilter),
        categories,
        total: filtered.length,
    };
}

function filterPrompts(items: Prompt[], options: { keyword: string; category: string; tags: string[] }) {
    return items.filter((item) => {
        if (isActiveOption(options.category) && item.category !== options.category) return false;
        if (options.tags.length && !options.tags.some((tag) => item.tags.includes(tag))) return false;
        if (!options.keyword) return true;
        return [item.title, item.prompt, item.description, item.category, ...item.tags].join(" ").toLowerCase().includes(options.keyword);
    });
}

function collectTags(items: Prompt[]) {
    return Array.from(new Set(items.flatMap((item) => item.tags).filter(Boolean)));
}

function isActiveOption(value: string) {
    return value && value !== ALL_PROMPTS_OPTION && value !== "all";
}

export function formatPromptDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

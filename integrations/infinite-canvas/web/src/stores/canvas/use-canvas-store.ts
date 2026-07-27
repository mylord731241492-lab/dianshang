import { create } from "zustand";

import { getProjectsApi } from "@/integrations/hajimi/browser-client";
import { deserializeProjectEnvelope, serializeProjectEnvelope, type HjmProjectContent } from "@/integrations/hajimi/project-schema";
import type { ProjectListItem } from "@/integrations/hajimi/projects-api";
import type { CanvasBackgroundMode } from "@/lib/canvas-theme";
import type { CanvasAssistantSession, CanvasConnection, CanvasNodeData, ViewportTransform } from "@/types/canvas";

export type CanvasProject = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
    viewport: ViewportTransform;
};

export type FetchProjectResult =
    | { kind: "ready"; project: CanvasProject }
    // 旧项目：服务器数据不是候选信封，原记录保持不变，绝不覆盖。
    | { kind: "legacy"; id: string; title: string };

const initialViewport: ViewportTransform = { x: 0, y: 0, k: 1 };
const DEFAULT_TITLE = "未命名画布";

// 缓存中已加载完整内容（非列表元数据）的项目 id。
// 改名等写操作必须带上完整 envelope，避免服务器把 data 覆盖成 {}。
const loadedContentIds = new Set<string>();

type CanvasStore = {
    hydrated: boolean;
    projects: CanvasProject[];
    loadProjects: () => Promise<void>;
    fetchProject: (id: string) => Promise<FetchProjectResult>;
    createProject: (title?: string) => Promise<string>;
    importProject: (project: Partial<CanvasProject>) => Promise<string>;
    saveProjectContent: (id: string, content: HjmProjectContent, title?: string) => Promise<void>;
    openProject: (id: string) => CanvasProject | null;
    renameProject: (id: string, title: string) => Promise<void>;
    deleteProjects: (ids: string[]) => Promise<void>;
    replaceProjects: (projects: CanvasProject[]) => void;
    updateProject: (id: string, patch: Partial<Pick<CanvasProject, "nodes" | "connections" | "chatSessions" | "activeChatId" | "backgroundMode" | "showImageInfo" | "viewport">>) => void;
};

function emptyContent(): HjmProjectContent {
    return {
        nodes: [],
        connections: [],
        chatSessions: [],
        activeChatId: null,
        backgroundMode: "lines",
        showImageInfo: false,
        viewport: initialViewport,
    };
}

function projectFromListItem(item: ProjectListItem): CanvasProject {
    return {
        id: item.id,
        title: item.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        nodes: [],
        connections: [],
        chatSessions: [],
        activeChatId: null,
        backgroundMode: "lines",
        showImageInfo: false,
        viewport: initialViewport,
    };
}

function contentFromProject(project: CanvasProject): HjmProjectContent {
    return {
        nodes: project.nodes,
        connections: project.connections,
        chatSessions: project.chatSessions,
        activeChatId: project.activeChatId,
        backgroundMode: project.backgroundMode,
        showImageInfo: project.showImageInfo,
        viewport: project.viewport,
    };
}

function upsertProject(list: CanvasProject[], project: CanvasProject): CanvasProject[] {
    const index = list.findIndex((item) => item.id === project.id);
    if (index === -1) return [project, ...list];
    const next = [...list];
    next[index] = project;
    return next;
}

export const useCanvasStore = create<CanvasStore>()((set, get) => ({
    // 项目事实源是服务器；hydrated 表示列表已加载完成（保留原 UI 门语义）。
    hydrated: false,
    projects: [],
    loadProjects: async () => {
        const items = await getProjectsApi().list();
        set((state) => ({
            hydrated: true,
            projects: items.map((item) => {
                const cached = state.projects.find((project) => project.id === item.id);
                // 已加载完整内容的条目保留内容，只刷新列表元数据。
                return cached && loadedContentIds.has(item.id) ? { ...cached, title: item.name, updatedAt: item.updatedAt, createdAt: item.createdAt } : projectFromListItem(item);
            }),
        }));
    },
    fetchProject: async (id) => {
        const entity = await getProjectsApi().get(id);
        const parsed = deserializeProjectEnvelope(entity.data);
        if (parsed.kind === "legacy") return { kind: "legacy", id: entity.id, title: entity.name };
        const project: CanvasProject = {
            id: entity.id,
            title: entity.name,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            nodes: parsed.project.nodes as CanvasNodeData[],
            connections: parsed.project.connections as CanvasConnection[],
            chatSessions: parsed.project.chatSessions as CanvasAssistantSession[],
            activeChatId: parsed.project.activeChatId,
            backgroundMode: parsed.project.backgroundMode as CanvasBackgroundMode,
            showImageInfo: parsed.project.showImageInfo,
            viewport: parsed.project.viewport,
        };
        loadedContentIds.add(id);
        set((state) => ({ projects: upsertProject(state.projects, project) }));
        return { kind: "ready", project };
    },
    createProject: async (title = DEFAULT_TITLE) => {
        // 项目 id 一律由服务器生成（proj_*），浏览器不再使用本地 nanoid 作为最终 ID。
        const entity = await getProjectsApi().create({ name: title, data: serializeProjectEnvelope(emptyContent()) });
        const project: CanvasProject = {
            id: entity.id,
            title: entity.name,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt || entity.createdAt,
            nodes: [],
            connections: [],
            chatSessions: [],
            activeChatId: null,
            backgroundMode: "lines",
            showImageInfo: false,
            viewport: initialViewport,
        };
        loadedContentIds.add(project.id);
        set((state) => ({ projects: [project, ...state.projects] }));
        return project.id;
    },
    importProject: async (source) => {
        const now = new Date().toISOString();
        const content: HjmProjectContent = {
            nodes: source.nodes || [],
            connections: source.connections || [],
            chatSessions: source.chatSessions || [],
            activeChatId: source.activeChatId || null,
            backgroundMode: source.backgroundMode || "lines",
            showImageInfo: source.showImageInfo || false,
            viewport: source.viewport || initialViewport,
        };
        const entity = await getProjectsApi().create({ name: source.title || "导入画布", data: serializeProjectEnvelope(content) });
        const project: CanvasProject = {
            id: entity.id,
            title: entity.name,
            createdAt: entity.createdAt || now,
            updatedAt: entity.updatedAt || entity.createdAt || now,
            ...(content as Omit<CanvasProject, "id" | "title" | "createdAt" | "updatedAt">),
        };
        loadedContentIds.add(project.id);
        set((state) => ({ projects: [project, ...state.projects] }));
        return project.id;
    },
    saveProjectContent: async (id, content, title) => {
        const name = title || get().projects.find((project) => project.id === id)?.title || DEFAULT_TITLE;
        await getProjectsApi().update(id, { name, data: serializeProjectEnvelope(content) });
        loadedContentIds.add(id);
        set((state) => ({
            projects: state.projects.map((project) => (project.id === id ? { ...project, title: name, updatedAt: new Date().toISOString() } : project)),
        }));
    },
    openProject: (id) => {
        return get().projects.find((item) => item.id === id) || null;
    },
    renameProject: async (id, title) => {
        const nextTitle = title.trim();
        if (!nextTitle) return;
        // 服务器 PUT 会整体重写 data，改名必须携带完整数据，避免覆盖成空对象。
        if (!loadedContentIds.has(id)) {
            const entity = await getProjectsApi().get(id);
            const parsed = deserializeProjectEnvelope(entity.data);
            // 旧项目按原样回写数据，只改名称，不改变内容格式。
            await getProjectsApi().update(id, { name: nextTitle, data: parsed.kind === "legacy" ? entity.data : serializeProjectEnvelope(parsed.project) });
        } else {
            const cached = get().projects.find((project) => project.id === id);
            await getProjectsApi().update(id, { name: nextTitle, data: serializeProjectEnvelope(cached ? contentFromProject(cached) : emptyContent()) });
        }
        set((state) => ({
            projects: state.projects.map((project) => (project.id === id ? { ...project, title: nextTitle, updatedAt: new Date().toISOString() } : project)),
        }));
    },
    deleteProjects: async (ids) => {
        const api = getProjectsApi();
        for (const id of ids) await api.remove(id);
        ids.forEach((id) => loadedContentIds.delete(id));
        set((state) => ({ projects: state.projects.filter((project) => !ids.includes(project.id)) }));
    },
    replaceProjects: (projects) => set({ projects }),
    updateProject: (id, patch) => {
        loadedContentIds.add(id);
        set((state) => ({
            projects: state.projects.map((project) => (project.id === id ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project)),
        }));
    },
}));

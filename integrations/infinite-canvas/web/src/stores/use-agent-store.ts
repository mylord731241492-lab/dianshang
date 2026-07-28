import { create } from "zustand";

import type { CanvasAgentOp, CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";

// 画布右侧面板 UI 状态（Task 10 起为哈吉米三模式助手面板）。
// 本地 Codex Agent 连接（Local URL / Connect token / SSE）已整体移除，
// 本 store 只保留面板开合、宽度、提示词插入草稿与画布桥接上下文。
export type AgentCanvasContext = { snapshot: CanvasAgentSnapshot; applyOps: (ops?: CanvasAgentOp[]) => CanvasAgentSnapshot; undoOps: () => CanvasAgentSnapshot | null; canUndo: boolean };

type AgentStore = {
    width: number;
    panelOpen: boolean;
    panelMounted: boolean;
    panelClosing: boolean;
    canvasContext: AgentCanvasContext | null;
    /** 提示词库「插入 Assistant 输入框」的暂存草稿。 */
    prompt: string;
    setAgentState: (patch: Partial<Pick<AgentStore, "width" | "prompt">>) => void;
    openPanel: () => void;
    closePanel: () => void;
    togglePanel: () => void;
    setCanvasContext: (context: AgentCanvasContext | null) => void;
};

export const CANVAS_AGENT_PANEL_MOTION_MS = 500;

const PANEL_WIDTH_STORAGE_KEY = "hjm-assistant-panel-width";

export const useAgentStore = create<AgentStore>((set, get) => ({
    width: typeof window === "undefined" ? 440 : Number(localStorage.getItem(PANEL_WIDTH_STORAGE_KEY)) || 440,
    panelOpen: false,
    panelMounted: true,
    panelClosing: false,
    canvasContext: null,
    prompt: "",
    setAgentState: (patch) => set(patch),
    openPanel: () => set({ panelOpen: true, panelMounted: true, panelClosing: false }),
    closePanel: () => {
        if (!get().panelMounted || get().panelClosing) return;
        set({ panelOpen: false, panelClosing: true });
        setTimeout(() => {
            if (get().panelClosing) set({ panelMounted: false, panelClosing: false });
        }, CANVAS_AGENT_PANEL_MOTION_MS);
    },
    togglePanel: () => (get().panelOpen ? get().closePanel() : get().openPanel()),
    setCanvasContext: (canvasContext) => set({ canvasContext }),
}));

export { PANEL_WIDTH_STORAGE_KEY };

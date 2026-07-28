import { create } from "zustand";

// 提示词库 UI 状态 Store（Task 7）：只保留 UI 查询状态与当前选择。
// 提示词数据一律由后端 /api/prompts/system 与 /api/user/prompts 经 React Query 获取；
// 本 Store 不使用 persist，localStorage/IndexedDB 不保存任何提示词权威副本；
// 账号切换/401 时由 browser-client 调用 reset() 立即清空选择与查询状态。

export type PromptLibraryTab = "system" | "user";

export type PromptLibrarySelection = {
    scope: "system" | "user";
    promptId: string;
    version?: number;
    title: string;
} | null;

type PromptSourceStore = {
    activeTab: PromptLibraryTab;
    keyword: string;
    category: string;
    tag: string;
    favoriteOnly: boolean;
    selected: PromptLibrarySelection;
    setActiveTab: (tab: PromptLibraryTab) => void;
    setKeyword: (keyword: string) => void;
    setCategory: (category: string) => void;
    setTag: (tag: string) => void;
    setFavoriteOnly: (favoriteOnly: boolean) => void;
    select: (selection: PromptLibrarySelection) => void;
    reset: () => void;
};

const initialState = {
    activeTab: "system" as PromptLibraryTab,
    keyword: "",
    category: "",
    tag: "",
    favoriteOnly: false,
    selected: null as PromptLibrarySelection,
};

export const usePromptSourceStore = create<PromptSourceStore>()((set) => ({
    ...initialState,
    setActiveTab: (activeTab) => set({ activeTab }),
    setKeyword: (keyword) => set({ keyword }),
    setCategory: (category) => set({ category }),
    setTag: (tag) => set({ tag }),
    setFavoriteOnly: (favoriteOnly) => set({ favoriteOnly }),
    select: (selected) => set({ selected }),
    reset: () => set({ ...initialState }),
}));

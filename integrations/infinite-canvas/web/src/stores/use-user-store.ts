import { create } from "zustand";

// 用户事实源：主站 GET /api/user/profile 的响应，由 integrations/hajimi/auth 引导写入。
export type LocalUser = {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    balance: number;
};

type UserStore = {
    user: LocalUser | null;
    setUser: (user: LocalUser) => void;
    clearSession: () => void;
};

export const useUserStore = create<UserStore>()((set) => ({
    user: null,
    setUser: (user) => set({ user }),
    clearSession: () => set({ user: null }),
}));

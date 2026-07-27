import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { AgentPanel } from "@/components/agent/agent-panel";
import { bootstrapAuth, logout, type CanvasUser } from "@/integrations/hajimi/auth";
import { useUserStore } from "@/stores/use-user-store";

const browserStorage = {
    getItem: (key: string) => window.localStorage.getItem(key),
    removeItem: (key: string) => window.localStorage.removeItem(key),
};

const navigateToMainSite = (url: string) => {
    window.location.assign(url);
};

type BootstrapState = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

export default function UserLayout({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const user = useUserStore((state) => state.user);
    const setUser = useUserStore((state) => state.setUser);
    const clearSession = useUserStore((state) => state.clearSession);
    const [bootstrapState, setBootstrapState] = useState<BootstrapState>({ status: "loading" });
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);

    const runBootstrap = useCallback(async () => {
        setBootstrapState({ status: "loading" });
        const result = await bootstrapAuth({
            storage: browserStorage,
            navigate: navigateToMainSite,
            currentPath: () => `${window.location.pathname}${window.location.search}`,
            setUser: (nextUser: CanvasUser) => setUser(nextUser),
            clearUser: clearSession,
        });
        if (result.status === "authenticated") setBootstrapState({ status: "ready" });
        else if (result.status === "error") setBootstrapState({ status: "error", message: result.message });
        // unauthenticated：已跳转主站登录页。
    }, [clearSession, setUser]);

    useEffect(() => {
        void runBootstrap();
    }, [runBootstrap]);

    const handleLogout = () => {
        logout({ storage: browserStorage, navigate: navigateToMainSite, clearUser: clearSession });
    };

    if (bootstrapState.status === "loading") {
        return (
            <div className="grid h-dvh place-items-center bg-background text-foreground">
                <p className="text-sm text-stone-500 dark:text-stone-400">正在加载用户信息…</p>
            </div>
        );
    }

    if (bootstrapState.status === "error") {
        return (
            <div className="grid h-dvh place-items-center bg-background text-foreground">
                <div className="flex flex-col items-center gap-4 px-6 text-center">
                    <p className="text-sm text-stone-600 dark:text-stone-300">{bootstrapState.message || "加载用户信息失败"}</p>
                    <button
                        type="button"
                        onClick={() => void runBootstrap()}
                        className="rounded-md border border-stone-300 px-4 py-1.5 text-sm text-stone-700 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
                    >
                        重试
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-dvh overflow-hidden bg-background text-foreground">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {!hideHeader ? (
                    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-background/90 px-6 backdrop-blur-xl dark:border-stone-800">
                        <a
                            href="/"
                            className="flex shrink-0 items-center gap-2 text-base font-medium leading-none tracking-tight text-stone-950 transition hover:text-stone-600 dark:text-stone-100 dark:hover:text-stone-300"
                        >
                            哈吉米 AI
                        </a>
                        <div className="flex min-w-0 items-center gap-4">
                            <span className="shrink-0 text-sm text-stone-600 dark:text-stone-300">余额 {user?.balance ?? 0}</span>
                            <a
                                href="/user/center"
                                className="flex shrink-0 items-center gap-2 text-sm text-stone-600 transition hover:text-stone-950 dark:text-stone-300 dark:hover:text-white"
                            >
                                {user?.avatarUrl ? (
                                    <img src={user.avatarUrl} alt="" className="size-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <span className="grid size-7 place-items-center rounded-full bg-stone-200 text-xs font-medium text-stone-600 dark:bg-stone-700 dark:text-stone-200">
                                        {(user?.displayName || user?.username || "?").slice(0, 1).toUpperCase()}
                                    </span>
                                )}
                                <span className="max-w-32 truncate">{user?.displayName || user?.username || "用户中心"}</span>
                            </a>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="shrink-0 text-sm text-stone-500 transition hover:text-stone-950 dark:text-stone-400 dark:hover:text-white"
                            >
                                退出登录
                            </button>
                        </div>
                    </header>
                ) : null}
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </div>
            <AgentPanel />
        </div>
    );
}

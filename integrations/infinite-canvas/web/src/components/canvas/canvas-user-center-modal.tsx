import { useCallback, useEffect, useState } from "react";
import { App, Button, Input, Modal, Spin, Tag } from "antd";
import { Check, Coins, History, ImagePlus, LogOut, Receipt, RefreshCw, Upload, UserRound } from "lucide-react";

import { getUserApi, refreshSessionUser } from "@/integrations/hajimi/browser-client";
import type { BalanceLogItem, GenerationRecord, UserProfile } from "@/integrations/hajimi/user-api";
import { logout } from "@/integrations/hajimi/auth";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";

// 用户中心弹窗：旧主站 /user/center 核心区块的画布内移植。
// 数据全部来自 /api/user/*；风格用画布主题 token，避免与画布割裂。

const PRESET_AVATARS = ["avatar-2d", "avatar-ai", "avatar-art", "avatar-human", "avatar-pro"].map((name) => `/avatars/${name}.svg`);

type Props = {
    open: boolean;
    onClose: () => void;
};

export function CanvasUserCenterModal({ open, onClose }: Props) {
    const { message } = App.useApp();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const clearSession = useUserStore((state) => state.clearSession);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [logs, setLogs] = useState<BalanceLogItem[]>([]);
    const [generations, setGenerations] = useState<GenerationRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [avatarOpen, setAvatarOpen] = useState(false);
    const [avatarSaving, setAvatarSaving] = useState(false);
    const [redeemCode, setRedeemCode] = useState("");
    const [redeeming, setRedeeming] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [nextProfile, nextLogs, nextGenerations] = await Promise.all([
                getUserApi().getProfile(),
                getUserApi().getBalanceLogs(20),
                getUserApi().getGenerations(20),
            ]);
            setProfile(nextProfile);
            setLogs(nextLogs);
            setGenerations(nextGenerations);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "用户信息加载失败");
        } finally {
            setLoading(false);
        }
    }, [message]);

    useEffect(() => {
        if (open) void load();
    }, [open, load]);

    const chooseAvatar = async (avatarUrl: string, avatarType: "preset" | "custom") => {
        if (avatarSaving) return;
        setAvatarSaving(true);
        try {
            await getUserApi().setAvatar(avatarUrl, avatarType);
            await refreshSessionUser();
            await load();
            message.success("头像已更新");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "头像更新失败");
        } finally {
            setAvatarSaving(false);
        }
    };

    const uploadAvatar = async (file: File | null) => {
        if (!file || avatarSaving) return;
        setAvatarSaving(true);
        try {
            const url = await getUserApi().uploadAvatarFile(file, file.name || "avatar.png");
            await chooseAvatar(url, "custom");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "头像上传失败");
            setAvatarSaving(false);
        }
    };

    const submitRedeem = async () => {
        const code = redeemCode.trim();
        if (!code || redeeming) return;
        setRedeeming(true);
        try {
            const result = await getUserApi().redeem(code);
            await refreshSessionUser();
            await load();
            setRedeemCode("");
            message.success(`兑换成功，算力 +${result.amount}`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "兑换失败");
        } finally {
            setRedeeming(false);
        }
    };

    const cardStyle = {
        background: theme.toolbar.panel,
        border: `1px solid ${theme.node.stroke}`,
        borderRadius: 14,
        padding: 14,
    } as const;

    return (
        <Modal title="用户中心" open={open} onCancel={onClose} footer={null} width={720} destroyOnHidden styles={{ body: { maxHeight: "72vh", overflowY: "auto" } }}>
            {loading && !profile ? (
                <div className="grid place-items-center py-16">
                    <Spin />
                </div>
            ) : (
                <div className="space-y-3">
                    {/* 资料卡 */}
                    <div style={cardStyle}>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setAvatarOpen((value) => !value)}
                                className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border transition hover:opacity-85"
                                style={{ borderColor: theme.node.stroke, background: theme.node.panel }}
                                title="更换头像"
                            >
                                {profile?.avatarUrl ? (
                                    <img src={profile.avatarUrl} alt="头像" className="size-full object-cover" />
                                ) : (
                                    <span className="text-lg font-semibold" style={{ color: theme.node.text }}>
                                        {(profile?.username || "U").slice(0, 1).toUpperCase()}
                                    </span>
                                )}
                            </button>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-base font-semibold" style={{ color: theme.node.text }}>{profile?.username || "…"}</span>
                                    {profile?.role === "admin" ? <Tag color="gold" className="!mr-0">管理员</Tag> : null}
                                </div>
                                <div className="truncate text-xs" style={{ color: theme.node.muted }}>{profile?.email || ""}</div>
                            </div>
                            <Button size="small" icon={<RefreshCw className="size-3.5" />} loading={loading} onClick={() => void load()}>
                                刷新
                            </Button>
                        </div>
                        {avatarOpen ? (
                            <div className="mt-3 border-t pt-3" style={{ borderColor: theme.node.stroke }}>
                                <div className="mb-2 text-xs" style={{ color: theme.node.muted }}>选择预设头像，或上传自定义头像</div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {PRESET_AVATARS.map((url) => (
                                        <button
                                            key={url}
                                            type="button"
                                            disabled={avatarSaving}
                                            onClick={() => void chooseAvatar(url, "preset")}
                                            className="relative grid size-11 place-items-center overflow-hidden rounded-full border transition hover:opacity-85"
                                            style={{ borderColor: profile?.avatarUrl === url ? theme.toolbar.activeText : theme.node.stroke }}
                                        >
                                            <img src={url} alt="" className="size-full object-cover" />
                                            {profile?.avatarUrl === url ? (
                                                <span className="absolute inset-0 grid place-items-center bg-black/45">
                                                    <Check className="size-4 text-white" />
                                                </span>
                                            ) : null}
                                        </button>
                                    ))}
                                    <label
                                        className="grid size-11 cursor-pointer place-items-center rounded-full border border-dashed transition hover:opacity-80"
                                        style={{ borderColor: theme.node.stroke, color: theme.node.muted }}
                                        title="上传头像"
                                    >
                                        {avatarSaving ? <Spin size="small" /> : <Upload className="size-4" />}
                                        <input
                                            hidden
                                            type="file"
                                            accept="image/*"
                                            onChange={(event) => {
                                                void uploadAvatar(event.target.files?.[0] || null);
                                                event.target.value = "";
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* 算力 + 兑换码 */}
                    <div style={cardStyle}>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <Coins className="size-5" style={{ color: "#f59e0b" }} />
                                <div>
                                    <div className="text-xs" style={{ color: theme.node.muted }}>算力余额</div>
                                    <div className="text-xl font-bold leading-6" style={{ color: theme.node.text }}>{profile?.balance ?? "…"}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    size="small"
                                    value={redeemCode}
                                    placeholder="兑换码"
                                    style={{ width: 160 }}
                                    onChange={(event) => setRedeemCode(event.target.value)}
                                    onPressEnter={() => void submitRedeem()}
                                />
                                <Button size="small" type="primary" loading={redeeming} disabled={!redeemCode.trim()} onClick={() => void submitRedeem()}>
                                    兑换
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* 余额流水 */}
                    <div style={cardStyle}>
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: theme.node.text }}>
                            <Receipt className="size-4" style={{ color: theme.node.muted }} />
                            算力明细
                        </div>
                        {logs.length ? (
                            <div className="thin-scrollbar max-h-44 space-y-1 overflow-y-auto pr-1">
                                {logs.map((log) => (
                                    <div key={log.id} className="flex items-center gap-3 py-1 text-xs">
                                        <span className="min-w-0 flex-1 truncate" style={{ color: theme.node.text }}>{log.remark || log.type}</span>
                                        <span className="shrink-0 font-semibold" style={{ color: log.changeAmount >= 0 ? "#22c55e" : "#ef4444" }}>
                                            {log.changeAmount >= 0 ? `+${log.changeAmount}` : log.changeAmount}
                                        </span>
                                        <span className="w-20 shrink-0 text-right" style={{ color: theme.node.muted }}>余 {log.afterBalance}</span>
                                        <span className="w-32 shrink-0 text-right" style={{ color: theme.node.muted }}>{log.createdAt}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-3 text-xs" style={{ color: theme.node.muted }}>暂无流水记录</div>
                        )}
                    </div>

                    {/* 生成记录 */}
                    <div style={cardStyle}>
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: theme.node.text }}>
                            <History className="size-4" style={{ color: theme.node.muted }} />
                            生成记录
                        </div>
                        {generations.length ? (
                            <div className="thin-scrollbar max-h-56 space-y-1 overflow-y-auto pr-1">
                                {generations.map((item) => (
                                    <div key={item.id} className="flex items-center gap-2.5 py-1 text-xs">
                                        {item.resultUrl ? <img src={item.resultUrl} alt="" className="size-9 shrink-0 rounded-md object-cover" /> : <ImagePlus className="size-4 shrink-0" style={{ color: theme.node.muted }} />}
                                        <span className="min-w-0 flex-1 truncate" style={{ color: theme.node.text }} title={item.prompt}>{item.prompt || "（无提示词）"}</span>
                                        <Tag className="!mr-0 shrink-0" color={item.status === "completed" || item.status === "success" ? "success" : item.status === "failed" ? "error" : "processing"}>
                                            {item.status}
                                        </Tag>
                                        <span className="w-14 shrink-0 text-right" style={{ color: theme.node.muted }}>-{item.cost}</span>
                                        <span className="w-32 shrink-0 text-right" style={{ color: theme.node.muted }}>{item.createdAt}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-3 text-xs" style={{ color: theme.node.muted }}>暂无生成记录</div>
                        )}
                    </div>

                    {/* 底部操作 */}
                    <div className="flex items-center justify-between pt-1">
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: theme.node.muted }}>
                            <UserRound className="size-3.5" />
                            账号数据保存在服务端，换设备登录自动同步
                        </span>
                        <Button
                            size="small"
                            danger
                            type="text"
                            icon={<LogOut className="size-3.5" />}
                            onClick={() =>
                                logout({
                                    storage: { getItem: (key: string) => window.localStorage.getItem(key), removeItem: (key: string) => window.localStorage.removeItem(key) },
                                    navigate: (url: string) => window.location.assign(url),
                                    clearUser: clearSession,
                                })
                            }
                        >
                            退出登录
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

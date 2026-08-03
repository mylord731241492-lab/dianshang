import { useCallback, useEffect, useState, type ReactNode } from "react";
import { App, Drawer, Spin } from "antd";
import { Check, ChevronDown, Coins, LogOut, RefreshCcw, Upload } from "lucide-react";

import { getUserApi, refreshSessionUser } from "@/integrations/hajimi/browser-client";
import type { ApiStatusResult, BalanceLogItem, RouteItem, UserProfile } from "@/integrations/hajimi/user-api";
import { logout } from "@/integrations/hajimi/auth";
import { useUserStore } from "@/stores/use-user-store";

// 用户中心：旧版卡片式的层级化重排。
// 层级：① 资料主卡（橙渐变锚点）→ ② 头像设置 → ③ 算力资产卡（余额/明细/兑换码合一，分隔带分区）→ ④ API 线路（可选线）→ ⑤ 界面语言 → 退出登录。
// 数据全部来自 /api/user/*，浏览器不接触任何密钥。

const PRESET_AVATARS = ["avatar-2d", "avatar-ai", "avatar-art", "avatar-human", "avatar-pro"].map((name) => `/avatars/${name}.svg`);
const LANGUAGE_STORAGE_KEY = "hjm-ui-language";

const COLORS = {
    page: "#f4f4f5",
    card: "#ffffff",
    text: "#18181b",
    muted: "#71717a",
    faint: "#a1a1aa",
    accent: "#f97316",
    accentDeep: "#ea580c",
    accentSoft: "#fff4e8",
    accentBorder: "#fed7aa",
    danger: "#dc2626",
    dangerSoft: "#fef2f2",
    ok: "#16a34a",
    okSoft: "#ecfdf5",
    line: "rgba(0, 0, 0, 0.06)",
};

type Props = {
    open: boolean;
    onClose: () => void;
};

export function CanvasUserCenterModal({ open, onClose }: Props) {
    const { message } = App.useApp();
    const clearSession = useUserStore((state) => state.clearSession);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [logs, setLogs] = useState<BalanceLogItem[]>([]);
    const [apiStatus, setApiStatus] = useState<ApiStatusResult | null>(null);
    const [routes, setRoutes] = useState<RouteItem[]>([]);
    const [routeError, setRouteError] = useState("");
    const [routeSaving, setRouteSaving] = useState("");
    const [loading, setLoading] = useState(false);
    const [avatarSaving, setAvatarSaving] = useState(false);
    const [redeemCode, setRedeemCode] = useState("");
    const [redeeming, setRedeeming] = useState(false);
    const [logsOpen, setLogsOpen] = useState(false);
    const [language, setLanguage] = useState(() => window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || "中文");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [nextProfile, nextLogs, nextStatus] = await Promise.all([
                getUserApi().getProfile(),
                getUserApi().getBalanceLogs(10),
                getUserApi().getApiStatus(),
            ]);
            setProfile(nextProfile);
            setLogs(nextLogs);
            setApiStatus(nextStatus);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "用户信息加载失败");
        } finally {
            setLoading(false);
        }
    }, [message]);

    const loadRoutes = useCallback(async () => {
        setRouteError("");
        try {
            setRoutes(await getUserApi().getRoutes("image"));
        } catch (error) {
            setRoutes([]);
            setRouteError(error instanceof Error ? error.message : "线路加载失败");
        }
    }, []);

    useEffect(() => {
        if (open) {
            void load();
            void loadRoutes();
        }
    }, [open, load, loadRoutes]);

    const chooseAvatar = async (avatarUrl: string, avatarType: "preset" | "custom") => {
        if (avatarSaving) return;
        setAvatarSaving(true);
        try {
            await getUserApi().setAvatar(avatarUrl, avatarType);
            await refreshSessionUser();
            await load();
            message.success("头像已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "头像保存失败");
        } finally {
            setAvatarSaving(false);
        }
    };

    const randomAvatar = () => {
        const pool = PRESET_AVATARS.filter((url) => url !== profile?.avatarUrl);
        const next = pool[Math.floor(Math.random() * pool.length)] || PRESET_AVATARS[0];
        void chooseAvatar(next, "preset");
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

    const selectRoute = async (route: RouteItem) => {
        if (routeSaving || !route.enabled) return;
        if (route.id === apiStatus?.routeId || (route.routeKey && route.routeKey === apiStatus?.routeKey)) return;
        setRouteSaving(route.id);
        try {
            await getUserApi().selectImageRoute(route.id);
            const nextStatus = await getUserApi().getApiStatus();
            setApiStatus(nextStatus);
            message.success("线路模式已保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "线路保存失败");
        } finally {
            setRouteSaving("");
        }
    };

    // —— 样式片段 ——
    const cardStyle = {
        background: COLORS.card,
        borderRadius: 18,
        padding: "18px 20px",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
    } as const;

    const divider = <div style={{ height: 1, background: COLORS.line, margin: "16px -20px" }} />;

    const sectionLabel = (title: string, subtitle?: string) => (
        <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{title}</div>
            {subtitle ? <div style={{ marginTop: 2, fontSize: 12, color: COLORS.faint }}>{subtitle}</div> : null}
        </div>
    );

    const cardHead = (title: string, subtitle: string, extra?: ReactNode) => (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{title}</div>
                <div style={{ marginTop: 3, fontSize: 12, color: COLORS.faint }}>{subtitle}</div>
            </div>
            {extra}
        </div>
    );

    const routeAvailable = routes.length > 0 && !routeError;

    return (
        <Drawer
            title={<span style={{ fontSize: 17, fontWeight: 800, color: COLORS.text }}>用户中心</span>}
            placement="right"
            width={400}
            open={open}
            onClose={onClose}
            destroyOnHidden
            styles={{ body: { padding: 14, background: COLORS.page }, header: { background: COLORS.page, borderBottom: "none", paddingBottom: 8 } }}
        >
            {loading && !profile ? (
                <div className="grid place-items-center py-16">
                    <Spin />
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* ① 资料主卡：橙渐变视觉锚点 */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            borderRadius: 18,
                            padding: "18px 20px",
                            background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                            border: `1px solid ${COLORS.accentBorder}`,
                            boxShadow: "0 4px 14px rgba(249, 115, 22, 0.10)",
                        }}
                    >
                        <span
                            style={{
                                display: "grid",
                                placeItems: "center",
                                width: 60,
                                height: 60,
                                flexShrink: 0,
                                overflow: "hidden",
                                borderRadius: 16,
                                background: "#fff",
                                color: COLORS.accent,
                                fontSize: 22,
                                fontWeight: 900,
                                textTransform: "uppercase",
                                boxShadow: "0 2px 6px rgba(249, 115, 22, 0.16)",
                            }}
                        >
                            {profile?.avatarUrl ? (
                                <img src={profile.avatarUrl} alt="头像" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                (profile?.username || "U").slice(0, 1)
                            )}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {profile?.username || "…"}
                                {profile?.role === "admin" ? <span style={{ marginLeft: 6, fontSize: 11, color: COLORS.accentDeep }}>管理员</span> : null}
                            </div>
                            <div style={{ marginTop: 3, fontSize: 12, color: COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.email || ""}</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => message.info("充值套餐待接入支付平台，可先使用兑换码增加算力")}
                            style={{
                                flexShrink: 0,
                                border: "none",
                                borderRadius: 999,
                                background: COLORS.accent,
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: 800,
                                padding: "8px 18px",
                                cursor: "pointer",
                                boxShadow: "0 2px 8px rgba(249, 115, 22, 0.35)",
                            }}
                        >
                            升级
                        </button>
                    </div>

                    {/* ② 头像设置 */}
                    <div style={cardStyle}>
                        {cardHead(
                            "头像设置",
                            "自定义或选择预设头像",
                            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                <button
                                    type="button"
                                    title="随机头像"
                                    disabled={avatarSaving}
                                    onClick={randomAvatar}
                                    style={{
                                        display: "grid",
                                        placeItems: "center",
                                        width: 36,
                                        height: 36,
                                        borderRadius: "50%",
                                        border: `1px solid ${COLORS.line}`,
                                        background: "#fff",
                                        color: COLORS.muted,
                                        cursor: "pointer",
                                    }}
                                >
                                    <RefreshCcw className="size-4" />
                                </button>
                                <label
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        height: 36,
                                        padding: "0 16px",
                                        borderRadius: 999,
                                        background: "#18181b",
                                        color: "#fff",
                                        fontSize: 13,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    {avatarSaving ? <Spin size="small" /> : <Upload className="size-3.5" />}
                                    上传
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
                            </div>,
                        )}
                        <div style={{ marginTop: 14, position: "relative" }}>
                            <select
                                value={PRESET_AVATARS.includes(profile?.avatarUrl || "") ? profile?.avatarUrl : ""}
                                disabled={avatarSaving}
                                onChange={(event) => {
                                    if (event.target.value) void chooseAvatar(event.target.value, "preset");
                                }}
                                style={{
                                    width: "100%",
                                    appearance: "none",
                                    border: `1px solid ${COLORS.line}`,
                                    borderRadius: 12,
                                    background: "#fafafa",
                                    padding: "10px 34px 10px 14px",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: COLORS.text,
                                    outline: "none",
                                }}
                            >
                                <option value="" disabled>
                                    预设头像
                                </option>
                                {PRESET_AVATARS.map((url, index) => (
                                    <option key={url} value={url}>
                                        预设头像 {index + 1}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="size-4" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.faint, pointerEvents: "none" }} />
                        </div>
                        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
                            {PRESET_AVATARS.map((url) => {
                                const active = profile?.avatarUrl === url;
                                return (
                                    <button
                                        key={url}
                                        type="button"
                                        disabled={avatarSaving}
                                        onClick={() => void chooseAvatar(url, "preset")}
                                        style={{
                                            position: "relative",
                                            width: 48,
                                            height: 48,
                                            padding: 0,
                                            borderRadius: "50%",
                                            overflow: "hidden",
                                            border: `2px solid ${active ? COLORS.accent : "transparent"}`,
                                            boxShadow: active ? "0 0 0 3px rgba(249, 115, 22, 0.18)" : "none",
                                            background: "none",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        {active ? (
                                            <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.35)" }}>
                                                <Check className="size-4 text-white" />
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ③ 算力资产卡：余额 / 明细 / 兑换码 合一 */}
                    <div style={cardStyle}>
                        {/* 余额行：大数字为主信息 */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            {sectionLabel("算力余额", "可用于提交生成任务")}
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                <Coins className="size-5" style={{ color: COLORS.accent, alignSelf: "center" }} />
                                <span style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: COLORS.text }}>{profile?.balance ?? "…"}</span>
                            </div>
                        </div>

                        {divider}

                        {/* 明细行：默认收起，弱化 */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            {sectionLabel("算力明细", "最近 10 条余额变动")}
                            <button
                                type="button"
                                onClick={() => setLogsOpen((current) => !current)}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    border: "none",
                                    background: "none",
                                    color: COLORS.accent,
                                    fontSize: 13,
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    flexShrink: 0,
                                }}
                            >
                                {logsOpen ? "收起" : "展开"}
                                <ChevronDown className="size-3.5" style={{ transform: logsOpen ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
                            </button>
                        </div>
                        {logsOpen ? (
                            <div style={{ marginTop: 10, borderRadius: 12, background: "#fafafa", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                                {logs.length ? (
                                    logs.map((log) => (
                                        <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                                            <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: COLORS.text }}>{log.remark || log.type}</span>
                                            <span style={{ flexShrink: 0, fontWeight: 800, color: log.changeAmount >= 0 ? COLORS.ok : COLORS.danger }}>
                                                {log.changeAmount >= 0 ? `+${log.changeAmount}` : log.changeAmount}
                                            </span>
                                            <span style={{ width: 64, flexShrink: 0, textAlign: "right", color: COLORS.faint }}>余 {log.afterBalance}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ fontSize: 12, color: COLORS.faint }}>暂无明细</div>
                                )}
                            </div>
                        ) : null}

                        {divider}

                        {/* 兑换码行 */}
                        {sectionLabel("兑换码", "输入兑换码增加余额")}
                        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                            <input
                                value={redeemCode}
                                placeholder="请输入兑换码"
                                onChange={(event) => setRedeemCode(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") void submitRedeem();
                                }}
                                style={{
                                    flex: 1,
                                    height: 42,
                                    padding: "0 14px",
                                    borderRadius: 12,
                                    border: `1px solid ${COLORS.line}`,
                                    background: "#fafafa",
                                    color: COLORS.text,
                                    fontSize: 13,
                                    outline: "none",
                                }}
                            />
                            <button
                                type="button"
                                disabled={redeeming || !redeemCode.trim()}
                                onClick={() => void submitRedeem()}
                                style={{
                                    flexShrink: 0,
                                    border: "none",
                                    borderRadius: 12,
                                    background: COLORS.accent,
                                    color: "#fff",
                                    fontSize: 13,
                                    fontWeight: 800,
                                    padding: "0 18px",
                                    cursor: redeeming || !redeemCode.trim() ? "not-allowed" : "pointer",
                                    opacity: redeeming || !redeemCode.trim() ? 0.55 : 1,
                                }}
                            >
                                {redeeming ? "兑换中…" : "立即兑换"}
                            </button>
                        </div>
                    </div>

                    {/* ④ API 线路（可选线） */}
                    <div style={cardStyle}>
                        {cardHead(
                            "API 线路",
                            "普通用户只能选择模式",
                            <span
                                style={{
                                    flexShrink: 0,
                                    borderRadius: 999,
                                    padding: "4px 12px",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    background: routeAvailable ? COLORS.okSoft : "#f4f4f5",
                                    color: routeAvailable ? COLORS.ok : COLORS.faint,
                                }}
                            >
                                {routeAvailable ? "可用" : "未启用"}
                            </span>,
                        )}
                        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    borderRadius: 12,
                                    background: COLORS.accentSoft,
                                    border: `1px solid ${COLORS.accentBorder}`,
                                    padding: "10px 14px",
                                }}
                            >
                                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.accentDeep }}>当前线路</span>
                                <span style={{ fontSize: 13, fontWeight: 900, color: COLORS.accentDeep }}>{apiStatus?.routeName || "-"}</span>
                            </div>
                            {routeError ? (
                                <div style={{ borderRadius: 12, background: COLORS.dangerSoft, padding: "10px 14px", fontSize: 12, fontWeight: 700, color: COLORS.danger }}>{routeError}</div>
                            ) : null}
                            {routes.length ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {routes.map((route) => {
                                        const active = route.id === apiStatus?.routeId || (route.routeKey !== "" && route.routeKey === apiStatus?.routeKey);
                                        const saving = routeSaving === route.id;
                                        return (
                                            <button
                                                key={route.id}
                                                type="button"
                                                disabled={!route.enabled || Boolean(routeSaving)}
                                                onClick={() => void selectRoute(route)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                    width: "100%",
                                                    textAlign: "left",
                                                    borderRadius: 12,
                                                    border: `1px solid ${active ? COLORS.accentBorder : COLORS.line}`,
                                                    background: active ? COLORS.accentSoft : "#fafafa",
                                                    padding: "10px 12px",
                                                    cursor: route.enabled ? "pointer" : "not-allowed",
                                                    opacity: route.enabled ? 1 : 0.55,
                                                }}
                                            >
                                                {/* 单选指示点，强化"选择"语义 */}
                                                <span
                                                    style={{
                                                        flexShrink: 0,
                                                        width: 16,
                                                        height: 16,
                                                        borderRadius: "50%",
                                                        border: `2px solid ${active ? COLORS.accent : "#d4d4d8"}`,
                                                        display: "grid",
                                                        placeItems: "center",
                                                        background: "#fff",
                                                    }}
                                                >
                                                    {active ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.accent }} /> : null}
                                                </span>
                                                <span style={{ minWidth: 0, flex: 1 }}>
                                                    <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: COLORS.text }}>
                                                        {route.displayName}
                                                        {route.isDefault ? <span style={{ marginLeft: 6, fontSize: 11, color: COLORS.accent }}>默认线路</span> : null}
                                                    </span>
                                                    <span style={{ display: "block", marginTop: 2, fontSize: 11, color: COLORS.faint }}>
                                                        {route.defaultModelDisplayName ? `默认模型 ${route.defaultModelDisplayName} · ` : ""}
                                                        {route.modelCount} 个模型{route.enabled ? "" : " · 未启用"}
                                                    </span>
                                                </span>
                                                {saving ? <Spin size="small" /> : active ? <Check className="size-4" style={{ color: COLORS.accent, flexShrink: 0 }} /> : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : !routeError ? (
                                <div style={{ fontSize: 12, color: COLORS.faint }}>暂无可用线路</div>
                            ) : null}
                            <div style={{ borderRadius: 12, background: "#fafafa", border: `1px solid ${COLORS.line}`, padding: "10px 12px" }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.muted }}>模型</div>
                                {apiStatus && apiStatus.models.length ? (
                                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {apiStatus.models.map((name) => (
                                            <span key={name} style={{ borderRadius: 999, background: "#f4f4f5", padding: "4px 10px", fontSize: 11, fontWeight: 700, color: COLORS.muted }}>
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ marginTop: 6, fontSize: 12, color: COLORS.faint }}>当前线路暂无可用模型，请在后台为该线路启用模型</div>
                                )}
                            </div>
                            <div style={{ fontSize: 11, lineHeight: 1.6, color: COLORS.faint }}>
                                安全说明：API Key 和 Base URL 由管理员在后台统一维护，普通用户端不会展示或保存真实密钥。
                            </div>
                        </div>
                    </div>

                    {/* ⑤ 界面语言：弱信息，单行 slim 卡 */}
                    <div style={{ ...cardStyle, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>界面语言</div>
                        <div style={{ display: "flex", gap: 4, borderRadius: 12, background: "#f4f4f5", padding: 3 }}>
                            {["中文", "EN"].map((item) => {
                                const active = (language === "中文") === (item === "中文");
                                return (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => {
                                            const next = item === "中文" ? "中文" : "EN";
                                            setLanguage(next);
                                            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
                                        }}
                                        style={{
                                            border: "none",
                                            borderRadius: 9,
                                            padding: "6px 16px",
                                            fontSize: 12,
                                            fontWeight: 800,
                                            cursor: "pointer",
                                            background: active ? COLORS.accent : "transparent",
                                            color: active ? "#fff" : COLORS.muted,
                                        }}
                                    >
                                        {item}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 退出登录 */}
                    <button
                        type="button"
                        onClick={() =>
                            logout({
                                storage: { getItem: (key: string) => window.localStorage.getItem(key), removeItem: (key: string) => window.localStorage.removeItem(key) },
                                navigate: (url: string) => window.location.assign(url),
                                clearUser: clearSession,
                            })
                        }
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            alignSelf: "flex-start",
                            border: "none",
                            background: "none",
                            color: COLORS.danger,
                            fontSize: 13,
                            fontWeight: 700,
                            padding: "6px 4px 14px",
                            cursor: "pointer",
                        }}
                    >
                        <LogOut className="size-4" />
                        退出登录
                    </button>
                </div>
            )}
        </Drawer>
    );
}

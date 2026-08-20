import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { App, Button, Empty, Input, Popconfirm, Select, Tag } from "antd";
import { Check, ChevronRight, Download, FileText, Image as ImageIcon, ListChecks, Music2, Palette, Plus, Search, Square, Trash2, Type, Video } from "lucide-react";
import { motion } from "motion/react";

import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { exportCanvasNodes } from "@/lib/canvas/canvas-export";
import { getNodeDefinition } from "@/lib/canvas/node-registry";
import { cn } from "@/lib/utils";
import { PromptLibraryPanel } from "@/components/hajimi/prompt-library-panel";
import { assetStorageKey, type CloudAsset } from "@/integrations/hajimi/assets-api";
import { CloudAssetsBrowser } from "./cloud-assets-browser";
import { useCloudAssetList } from "@/lib/canvas/use-cloud-asset-list";
import { useAssetStore } from "@/stores/use-asset-store";
import { CANVAS_SIDE_PANEL_MAX_WIDTH, CANVAS_SIDE_PANEL_MIN_WIDTH, CANVAS_SIDE_PANEL_MOTION_MS, useCanvasSidePanelStore } from "@/stores/use-canvas-side-panel-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

import type { InsertAssetPayload } from "./asset-picker-modal";

const PANEL_MOTION_SECONDS = CANVAS_SIDE_PANEL_MOTION_MS / 1000;
const PANEL_EASE = [0.22, 1, 0.36, 1] as const;

type PanelTab = "canvas" | "assets" | "records" | "prompts";

type Props = {
    nodes: CanvasNodeData[];
    selectedNodeIds: Set<string>;
    onFocusNode: (nodeId: string) => void;
    onInsertAsset: (payload: InsertAssetPayload) => void;
};

const NODE_TYPE_ICON: Record<string, typeof Square> = {
    [CanvasNodeType.Image]: ImageIcon,
    [CanvasNodeType.Video]: Video,
    [CanvasNodeType.Audio]: Music2,
    [CanvasNodeType.Text]: Type,
    [CanvasNodeType.Config]: Palette,
    [CanvasNodeType.Group]: Square,
};

const STATUS_COLOR: Record<string, string> = {
    success: "#22c55e",
    loading: "#f59e0b",
    error: "#ef4444",
    idle: "transparent",
};

export function CanvasSidePanel({ nodes, selectedNodeIds, onFocusNode, onInsertAsset }: Props) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [tab, setTab] = useState<PanelTab>("records");
    const width = useCanvasSidePanelStore((state) => state.width);
    const panelOpen = useCanvasSidePanelStore((state) => state.panelOpen);
    const panelMounted = useCanvasSidePanelStore((state) => state.panelMounted);
    const panelClosing = useCanvasSidePanelStore((state) => state.panelClosing);
    const setWidth = useCanvasSidePanelStore((state) => state.setWidth);
    const [resizing, setResizing] = useState(false);

    const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = width;
        let nextWidth = startWidth;
        const onMove = (moveEvent: PointerEvent) => {
            nextWidth = Math.min(CANVAS_SIDE_PANEL_MAX_WIDTH, Math.max(CANVAS_SIDE_PANEL_MIN_WIDTH, startWidth + moveEvent.clientX - startX));
            setWidth(nextWidth);
        };
        const onUp = () => {
            localStorage.setItem("canvas-side-panel-width", String(nextWidth));
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            setResizing(false);
        };
        setResizing(true);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    if (!panelMounted) return null;

    return (
        <motion.div
            className="relative z-[60] flex h-full shrink-0"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: panelOpen ? width + 1 : 0, opacity: panelOpen ? 1 : 0 }}
            transition={{ duration: resizing ? 0 : PANEL_MOTION_SECONDS, ease: PANEL_EASE }}
            style={{ overflow: "clip", pointerEvents: panelClosing ? "none" : undefined }}
        >
            <motion.aside
                className="relative flex h-full shrink-0 flex-col overflow-hidden border-r"
                initial={{ x: -48 }}
                animate={{ x: panelClosing ? -28 : 0 }}
                transition={{ duration: resizing ? 0 : PANEL_MOTION_SECONDS, ease: PANEL_EASE }}
                style={{ width, background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
                data-canvas-no-zoom
            >
                <div className="flex items-center gap-5 px-4 pt-3.5">
                    <TabButton label="生图记录" active={tab === "records"} theme={theme} onClick={() => setTab("records")} />
                    <TabButton label="画布" active={tab === "canvas"} theme={theme} onClick={() => setTab("canvas")} />
                    <TabButton label="资产" active={tab === "assets"} theme={theme} onClick={() => setTab("assets")} />
                    <TabButton label="提示词库" active={tab === "prompts"} theme={theme} onClick={() => setTab("prompts")} />
                </div>
                <div className="mt-2 min-h-0 flex-1 overflow-hidden">
                    {/* 四个 tab 保持挂载只切显隐：避免切换时重复请求与图片重载造成的卡顿/重影 */}
                    <div className={tab === "canvas" ? "h-full" : "hidden"}>
                        <CanvasNodesTab nodes={nodes} selectedNodeIds={selectedNodeIds} onFocusNode={onFocusNode} theme={theme} />
                    </div>
                    <div className={tab === "assets" ? "h-full" : "hidden"}>
                        <CanvasAssetsTab onInsert={onInsertAsset} theme={theme} />
                    </div>
                    <div className={tab === "records" ? "h-full overflow-y-auto px-3 py-2" : "hidden"}>
                        <CloudAssetsBrowser onInsert={onInsertAsset} defaultSource="generated" gridClassName="grid-cols-2" />
                    </div>
                    <div className={tab === "prompts" ? "h-full" : "hidden"}>
                        <PromptLibraryPanel onInsert={onInsertAsset} theme={theme} />
                    </div>
                </div>
                <button type="button" className="absolute inset-y-0 right-0 z-40 w-4 translate-x-1/2 cursor-col-resize" onPointerDown={startResize} aria-label="调整左侧面板宽度" />
            </motion.aside>
        </motion.div>
    );
}

function TabButton({ label, active, theme, onClick }: { label: string; active: boolean; theme: CanvasTheme; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="relative pb-1.5 text-sm font-semibold transition-opacity" style={{ color: theme.node.text, opacity: active ? 1 : 0.45 }}>
            {label}
            {active ? <motion.span layoutId="sidePanelTabIndicator" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full" style={{ background: theme.toolbar.activeText }} transition={{ type: "spring", stiffness: 500, damping: 34 }} /> : null}
        </button>
    );
}

// ---------------------------------------------------------------------------
// 画布 Tab —— 列出节点,点击居中放大并选中
// ---------------------------------------------------------------------------

const NODE_FILTER_OPTIONS = [
    { label: "全部", value: "all" },
    { label: "图片", value: CanvasNodeType.Image },
    { label: "视频", value: CanvasNodeType.Video },
    { label: "文本", value: CanvasNodeType.Text },
    { label: "音频", value: CanvasNodeType.Audio },
    { label: "生图", value: CanvasNodeType.Config },
    { label: "分组", value: CanvasNodeType.Group },
];

function nodePreviewText(node: CanvasNodeData) {
    if (node.type === CanvasNodeType.Text) return node.metadata?.content || node.metadata?.prompt || "";
    return getNodeDefinition(node.type)?.title || node.type;
}

function nodeDisplayTitle(node: CanvasNodeData) {
    if (node.type === CanvasNodeType.Config && (node.title === "生成配置" || node.title === "绘图节点")) return "生图节点";
    return node.title || getNodeDefinition(node.type)?.title || "未命名节点";
}

function CanvasNodesTab({ nodes, selectedNodeIds, onFocusNode, theme }: { nodes: CanvasNodeData[]; selectedNodeIds: Set<string>; onFocusNode: (nodeId: string) => void; theme: CanvasTheme }) {
    const { message } = App.useApp();
    const [keyword, setKeyword] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [selectMode, setSelectMode] = useState(false);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [exporting, setExporting] = useState(false);

    const filtered = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return nodes.filter((node) => (typeFilter === "all" || node.type === typeFilter) && (!query || [nodeDisplayTitle(node), node.metadata?.content, node.metadata?.prompt].filter(Boolean).join(" ").toLowerCase().includes(query)));
    }, [nodes, keyword, typeFilter]);

    const exitSelect = () => {
        setSelectMode(false);
        setChecked(new Set());
    };
    const toggleChecked = (id: string) =>
        setChecked((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    const allChecked = filtered.length > 0 && filtered.every((node) => checked.has(node.id));
    const toggleAll = () => setChecked(allChecked ? new Set() : new Set(filtered.map((node) => node.id)));

    const handleExport = async () => {
        const targets = nodes.filter((node) => checked.has(node.id));
        if (!targets.length) return;
        setExporting(true);
        const hide = message.loading("正在导出选中元素…", 0);
        try {
            await exportCanvasNodes(targets, `画布元素-${targets.length}个`);
            message.success(`已导出 ${targets.length} 个元素`);
            exitSelect();
        } catch (error) {
            console.error(error);
            message.error("导出失败，请重试");
        } finally {
            hide();
            setExporting(false);
        }
    };

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 px-3 pb-2.5 pt-1">
                <span className="text-xs font-medium opacity-60">画布元素</span>
                {filtered.length ? <span className="text-xs opacity-35">{filtered.length}</span> : null}
                <button
                    type="button"
                    onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
                    className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                    style={selectMode ? { color: theme.toolbar.activeText, opacity: 1 } : undefined}
                >
                    <ListChecks className="size-3.5" />
                    {selectMode ? "取消" : "选择"}
                </button>
                {selectMode ? null : <Select size="small" variant="borderless" className="w-20" value={typeFilter} onChange={setTypeFilter} options={NODE_FILTER_OPTIONS} />}
            </div>
            <div className="px-3 pb-2.5">
                <Input size="small" allowClear prefix={<Search className="size-3.5 text-stone-400" />} placeholder="搜索节点" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {filtered.length ? (
                    <div className="space-y-1.5">
                        {filtered.map((node) => {
                            const Icon = NODE_TYPE_ICON[node.type] || FileText;
                            const thumbContent = node.type === CanvasNodeType.Image
                                ? node.metadata?.content || ""
                                : (node.metadata?.generatedImages?.length ? node.metadata.generatedImages[node.metadata.generatedImages.length - 1]?.content : "") || "";
                            const isImage = Boolean(thumbContent);
                            const isChecked = checked.has(node.id);
                            const active = selectMode ? isChecked : selectedNodeIds.has(node.id);
                            return (
                                <button
                                    key={node.id}
                                    type="button"
                                    onClick={() => (selectMode ? toggleChecked(node.id) : onFocusNode(node.id))}
                                    className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition", active ? "" : "hover:bg-black/5 dark:hover:bg-white/5")}
                                    style={active ? { background: theme.toolbar.activeBg } : undefined}
                                >
                                    {selectMode ? <CheckMark checked={isChecked} theme={theme} /> : null}
                                    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md">
                                        {isImage ? <img src={thumbContent} alt={node.title} className="size-full bg-black/5 object-contain" /> : <Icon className="size-5 opacity-60" />}
                                    </span>
                                    <span className="min-w-0 flex-1 space-y-0.5">
                                        <span className="block truncate text-sm font-medium leading-snug">{nodeDisplayTitle(node)}</span>
                                        <span className="block truncate text-xs leading-snug opacity-50">{nodePreviewText(node)}</span>
                                    </span>
                                    {node.metadata?.status && node.metadata.status !== "idle" ? <span className="size-1.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[node.metadata.status] || "transparent" }} /> : null}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="pt-16 text-center text-sm opacity-40">画布暂无节点</div>
                )}
            </div>
            {selectMode ? (
                <div className="flex items-center gap-2 border-t px-3 py-2.5" style={{ borderColor: theme.toolbar.border }}>
                    <button type="button" onClick={toggleAll} className="rounded-md px-2 py-1 text-xs font-medium opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10">
                        {allChecked ? "取消全选" : "全选"}
                    </button>
                    <span className="text-xs opacity-45">已选 {checked.size}</span>
                    <button
                        type="button"
                        onClick={() => void handleExport()}
                        disabled={!checked.size || exporting}
                        className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10"
                        style={{ color: theme.node.text }}
                    >
                        <Download className="size-3.5" />
                        导出选中
                    </button>
                </div>
            ) : null}
        </div>
    );
}

function CheckMark({ checked, theme }: { checked: boolean; theme: CanvasTheme }) {
    return (
        <span className="grid size-4 shrink-0 place-items-center rounded border transition" style={{ borderColor: checked ? theme.toolbar.activeText : theme.node.stroke, background: checked ? theme.toolbar.activeText : "transparent" }}>
            {checked ? <Check className="size-3 text-white" /> : null}
        </span>
    );
}

// ---------------------------------------------------------------------------
// 资产 Tab —— 账号云端产品图库（source=upload）：自己上传的产品图，事实源在服务端 /api/user/assets
// ---------------------------------------------------------------------------

const CanvasAssetsTab = memo(function CanvasAssetsTab({ onInsert, theme }: { onInsert: (payload: InsertAssetPayload) => void; theme: CanvasTheme }) {
    const { message } = App.useApp();
    // 本视图独立持有"产品图"列表（kind=image + source=upload），不与生图记录共享数据。
    const { items: cloudAssets, nextCursor: cloudNextCursor, loading: cloudLoading, error: cloudError, refresh: refreshCloudAssets, loadMore: loadMoreCloudAssets, upload: uploadCloudAsset, remove: deleteCloudAsset } = useCloudAssetList({ kind: "image", source: "upload" });

    const [keyword, setKeyword] = useState("");
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 本 tab 固定只看自己上传的图片（产品图），生成结果在生图记录查看；搜索防抖只刷新关键词。
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void refreshCloudAssets({ q: keyword.trim() || undefined });
        }, 300);
        return () => window.clearTimeout(timer);
    }, [keyword, refreshCloudAssets]);

    const handleFiles = async (fileList: FileList | null) => {
        const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
        if (!files.length) return;
        setUploading(true);
        try {
            for (const file of files) {
                await uploadCloudAsset(file, file.name || "产品图");
            }
            message.success(`已上传 ${files.length} 张产品图`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "上传失败");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleInsert = (asset: CloudAsset) => {
        if (!asset.accessUrl) {
            message.error("资产访问 URL 缺失，请刷新后重试");
            return;
        }
        onInsert({ kind: "image", dataUrl: asset.accessUrl, storageKey: assetStorageKey(asset.id), title: asset.name });
    };

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                <Input size="small" allowClear prefix={<Search className="size-3.5 text-stone-400" />} placeholder="搜索产品图" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10"
                    style={{ color: theme.node.text }}
                >
                    <Plus className="size-3.5" />
                    {uploading ? "上传中…" : "添加"}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
            </div>
            {cloudError ? <div className="mx-3 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{cloudError}</div> : null}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {cloudAssets.length ? (
                    <div className="grid grid-cols-2 gap-2 px-1 pt-1">
                        {cloudAssets.map((asset) => (
                            <div key={asset.id} className="group relative aspect-square overflow-hidden rounded-xl border transition duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ borderColor: theme.node.stroke, background: theme.node.panel }}>
                                {asset.accessUrl ? <img src={asset.accessUrl} alt={asset.name} className="size-full object-cover transition duration-300 group-hover:scale-[1.04]" /> : null}
                                <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-[11px] text-white/90">{asset.name}</div>
                                <div className="absolute inset-0 flex items-center justify-center gap-2.5 opacity-0 transition duration-200 group-hover:opacity-100">
                                    <button
                                        type="button"
                                        onClick={() => handleInsert(asset)}
                                        className="grid size-8 place-items-center rounded-full bg-white/90 text-stone-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-stone-900 dark:bg-black/60 dark:text-stone-100 dark:hover:bg-black/80"
                                        aria-label="插入画布"
                                    >
                                        <Plus className="size-4" />
                                    </button>
                                    <Popconfirm title="删除该图片?" description="软删除，云端对象保留；引用它的画布节点将失效。" okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => void deleteCloudAsset(asset.id)}>
                                        <button
                                            type="button"
                                            className="grid size-8 place-items-center rounded-full bg-white/90 text-stone-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-red-500 dark:bg-black/60 dark:text-stone-100 dark:hover:bg-black/80 dark:hover:text-red-400"
                                            aria-label="删除资产"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </Popconfirm>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={cloudLoading ? "加载中…" : "还没有产品图，点击「添加」上传"} className="pt-16" />
                )}
            </div>
            {cloudNextCursor ? (
                <div className="flex justify-center border-t px-3 py-2" style={{ borderColor: theme.toolbar.border }}>
                    <Button size="small" loading={cloudLoading} onClick={() => void loadMoreCloudAssets()}>
                        加载更多
                    </Button>
                </div>
            ) : null}
        </div>
    );
});

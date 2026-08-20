import { useEffect, useState } from "react";
import { App, Button, Empty, Input, Modal, Popconfirm, Tag } from "antd";
import { FileAudio, Pencil, Search, Trash2, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCloudAssetList } from "@/lib/canvas/use-cloud-asset-list";
import { assetStorageKey, type CloudAsset, type CloudAssetKind } from "@/integrations/hajimi/assets-api";
import type { InsertAssetPayload } from "./asset-picker-modal";

// 账号云端资产浏览（ADR-0006）：事实源 /api/user/assets，弹窗与左侧"生图记录"tab 共用。
// defaultSource 固定初始来源筛选（生图记录 tab 默认 generated，弹窗默认全部）。

type SourceFilter = "" | "upload" | "generated";

const kindOptions: { label: string; value: "" | CloudAssetKind }[] = [
    { label: "全部", value: "" },
    { label: "图片", value: "image" },
    { label: "视频", value: "video" },
    { label: "音频", value: "audio" },
];

const kindLabels: Record<CloudAssetKind, string> = { image: "图片", video: "视频", audio: "音频" };

const sourceOptions: { label: string; value: SourceFilter }[] = [
    { label: "全部来源", value: "" },
    { label: "我上传的", value: "upload" },
    { label: "生成的", value: "generated" },
];

const sourceLabels: Record<string, string> = { upload: "上传", generated: "生成", tool: "图片工具", generation: "历史生成" };

export function CloudAssetsBrowser({ onInsert, defaultSource = "", gridClassName = "grid-cols-4", active }: { onInsert: (payload: InsertAssetPayload) => void; defaultSource?: SourceFilter; gridClassName?: string; active?: boolean }) {

    const { message } = App.useApp();
    // 本视图独立持有列表数据，不与左侧"资产"tab 共享，避免切换时互相覆盖。
    const { items: cloudAssets, nextCursor: cloudNextCursor, loading: cloudLoading, error: cloudError, refresh: refreshCloudAssets, loadMore: loadMoreCloudAssets, rename: renameCloudAsset, remove: deleteCloudAsset } = useCloudAssetList({});

    const [keyword, setKeyword] = useState("");
    const [kindFilter, setKindFilter] = useState<"" | CloudAssetKind>("");
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>(defaultSource);
    const [renaming, setRenaming] = useState<CloudAsset | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [renameTags, setRenameTags] = useState("");

    // 搜索与类型/来源筛选变化时重新从服务端取第一页（防抖避免每个字符一次请求）。
    useEffect(() => setSourceFilter(defaultSource), [defaultSource]);

    // 生图记录自动刷新：tab 激活时 + 生图任务终态事件时。
    useEffect(() => {
        if (!active) return;
        const reload = () => void refreshCloudAssets({ q: keyword.trim() || undefined, kind: kindFilter || undefined, source: sourceFilter || undefined });
        reload();
        window.addEventListener("hjm:generation-task-terminal", reload);
        return () => window.removeEventListener("hjm:generation-task-terminal", reload);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, keyword, kindFilter, sourceFilter]);
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void refreshCloudAssets({ q: keyword.trim() || undefined, kind: kindFilter || undefined, source: sourceFilter || undefined });
        }, 300);
        return () => window.clearTimeout(timer);
    }, [keyword, kindFilter, sourceFilter, refreshCloudAssets]);

    const handleInsert = (asset: CloudAsset) => {
        if (asset.kind === "audio") {
            message.info("音频资产插入画布将在后续任务接入");
            return;
        }
        if (!asset.accessUrl) {
            message.error("资产访问 URL 缺失，请刷新后重试");
            return;
        }
        const storageKey = assetStorageKey(asset.id);
        if (asset.kind === "video") {
            onInsert({ kind: "video", url: asset.accessUrl, storageKey, title: asset.name, width: asset.width ?? undefined, height: asset.height ?? undefined });
        } else {
            onInsert({ kind: "image", dataUrl: asset.accessUrl, storageKey, title: asset.name });
        }
    };

    const handleRename = async () => {
        if (!renaming) return;
        const name = renameValue.trim();
        if (!name) {
            message.warning("资产名称不能为空");
            return;
        }
        try {
            await renameCloudAsset(renaming.id, { name, tags: renameTags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) });
            setRenaming(null);
            message.success("资产信息已更新");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "改名失败");
        }
    };

    const handleDelete = async (asset: CloudAsset) => {
        try {
            await deleteCloudAsset(asset.id);
            message.success("资产已删除（软删除，云端对象保留）");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "删除失败");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Input className="w-56" size="small" prefix={<Search className="size-3.5 text-stone-400" />} placeholder="搜索资产名称" value={keyword} allowClear onChange={(e) => setKeyword(e.target.value)} />
                <div className="flex gap-1.5">
                    {kindOptions.map((opt) => (
                        <Tag.CheckableTag key={opt.value || "all"} checked={kindFilter === opt.value} className={cn("prompt-filter-tag", kindFilter === opt.value && "is-active")} onChange={() => setKindFilter(opt.value)}>
                            {opt.label}
                        </Tag.CheckableTag>
                    ))}
                </div>
                <div className="flex gap-1.5">
                    {sourceOptions.map((opt) => (
                        <Tag.CheckableTag key={opt.value || "all"} checked={sourceFilter === opt.value} className={cn("prompt-filter-tag", sourceFilter === opt.value && "is-active")} onChange={() => setSourceFilter(opt.value)}>
                            {opt.label}
                        </Tag.CheckableTag>
                    ))}
                </div>
            </div>

            {cloudError ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{cloudError}</div> : null}

            {cloudAssets.length ? (
                <div className={cn("grid gap-3", gridClassName)}>
                    {cloudAssets.map((asset) => (
                        <div key={asset.id} className="group relative overflow-hidden rounded-lg border border-stone-200 bg-white text-left transition hover:border-stone-400 hover:shadow-md dark:border-stone-700 dark:bg-stone-900 dark:hover:border-stone-500">
                            <button type="button" className="block w-full cursor-pointer" onClick={() => handleInsert(asset)}>
                                <AssetCover asset={asset} />
                            </button>
                            <div className="p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="line-clamp-1 text-xs font-medium text-stone-800 dark:text-stone-200" title={asset.name}>
                                        {asset.name}
                                    </span>
                                    <Tag className="m-0 shrink-0 text-[10px]" color={asset.source === "generated" || asset.source === "tool" ? "blue" : undefined}>{sourceLabels[asset.source] || kindLabels[asset.kind]}</Tag>
                                </div>
                                {asset.prompt ? (
                                    <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-stone-500 dark:text-stone-400" title={asset.prompt}>
                                        {asset.prompt}
                                    </div>
                                ) : null}
                                <div className="mt-1.5 flex items-center justify-between">
                                    <span className="text-[10px] text-stone-400">{asset.source === "generated" || asset.source === "tool" ? `生图 ${asset.createdAt}` : asset.updatedAt || asset.createdAt}</span>
                                    <span className="flex gap-1">
                                        <button
                                            type="button"
                                            title="改名"
                                            className="cursor-pointer rounded p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                                            onClick={() => {
                                                setRenaming(asset);
                                                setRenameValue(asset.name);
                                                setRenameTags(asset.tags.join(", "));
                                            }}
                                        >
                                            <Pencil className="size-3" />
                                        </button>
                                        <Popconfirm title="删除资产" description="软删除，云端对象保留；引用该资产的项目节点将失效。" okText="删除" cancelText="取消" onConfirm={() => void handleDelete(asset)}>
                                            <button type="button" title="删除" className="cursor-pointer rounded p-1 text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
                                                <Trash2 className="size-3" />
                                            </button>
                                        </Popconfirm>
                                    </span>
                                </div>
                            </div>
                            {asset.kind !== "audio" ? (
                                <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-[4/3] items-center justify-center bg-stone-950/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-stone-950/55 group-hover:opacity-100">插入</div>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={cloudLoading ? "加载中…" : "没有云端资产"} className="py-12" />
            )}

            <div className="flex items-center justify-center gap-3">
                {cloudNextCursor ? (
                    <Button size="small" loading={cloudLoading} onClick={() => void loadMoreCloudAssets()}>
                        加载更多
                    </Button>
                ) : null}
                {cloudLoading && cloudAssets.length ? <span className="text-xs text-stone-400">加载中…</span> : null}
            </div>

            <Modal title="资产改名" open={Boolean(renaming)} onOk={() => void handleRename()} onCancel={() => setRenaming(null)} okText="保存" cancelText="取消" width={420}>
                <div className="space-y-3">
                    <Input value={renameValue} maxLength={200} onChange={(e) => setRenameValue(e.target.value)} onPressEnter={() => void handleRename()} placeholder="资产名称" />
                    <Input
                        value={renameTags}
                        onChange={(event) => setRenameTags(event.target.value)}
                        onPressEnter={() => void handleRename()}
                        placeholder="标签（可选，逗号分隔）"
                    />
                </div>
            </Modal>
        </div>
    );
}


function AssetCover({ asset }: { asset: CloudAsset }) {
    if (asset.kind === "image" && asset.accessUrl) {
        return <img src={asset.accessUrl} alt={asset.name} className="aspect-[4/3] w-full object-cover" />;
    }
    return (
        <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500">
            {asset.kind === "video" ? <Video className="size-8" /> : <FileAudio className="size-8" />}
        </div>
    );
}

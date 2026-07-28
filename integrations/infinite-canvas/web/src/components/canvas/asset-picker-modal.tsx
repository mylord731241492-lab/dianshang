import { useEffect, useState } from "react";
import { App, Button, Empty, Input, Modal, Popconfirm, Tag } from "antd";
import { FileAudio, Pencil, Search, Trash2, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAssetStore } from "@/stores/use-asset-store";
import { assetStorageKey, type CloudAsset, type CloudAssetKind } from "@/integrations/hajimi/assets-api";
import type { PromptInsertReference } from "@/integrations/hajimi/prompts-api";

// 提示词插入目标：当前选中文本/配置节点、新建生成配置节点、Assistant 输入框。
export type PromptInsertTarget = "selected-node" | "config-node" | "assistant";

export type InsertAssetPayload =
    | { kind: "text"; content: string; title: string }
    | { kind: "image"; dataUrl: string; title: string; storageKey?: string }
    | { kind: "video"; url: string; title: string; storageKey?: string; width?: number; height?: number }
    | { kind: "prompt"; content: string; title: string; target: PromptInsertTarget; reference: PromptInsertReference };

type Props = {
    open: boolean;
    defaultTab?: string;
    onInsert: (payload: InsertAssetPayload) => void;
    onClose: () => void;
};

// 账号云端资产选择器（ADR-0006）：只从 /api/user/assets 分页读取，事实源在服务端；
// 插入画布的节点只携带 storageKey = asset:<assetId>，accessUrl 为 15 分钟短时效展示用。
export function AssetPickerModal({ open, onInsert, onClose }: Props) {
    return (
        <Modal title="选择云端资产" open={open} onCancel={onClose} footer={null} width={860} destroyOnHidden styles={{ body: { padding: "0 24px 24px", minHeight: 480 } }}>
            {open ? <CloudAssetsTab onInsert={onInsert} /> : null}
        </Modal>
    );
}

const kindOptions: { label: string; value: "" | CloudAssetKind }[] = [
    { label: "全部", value: "" },
    { label: "图片", value: "image" },
    { label: "视频", value: "video" },
    { label: "音频", value: "audio" },
];

const kindLabels: Record<CloudAssetKind, string> = { image: "图片", video: "视频", audio: "音频" };

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

function CloudAssetsTab({ onInsert }: { onInsert: (payload: InsertAssetPayload) => void }) {
    const { message } = App.useApp();
    const cloudAssets = useAssetStore((state) => state.cloudAssets);
    const cloudNextCursor = useAssetStore((state) => state.cloudNextCursor);
    const cloudLoading = useAssetStore((state) => state.cloudLoading);
    const cloudError = useAssetStore((state) => state.cloudError);
    const refreshCloudAssets = useAssetStore((state) => state.refreshCloudAssets);
    const loadMoreCloudAssets = useAssetStore((state) => state.loadMoreCloudAssets);
    const renameCloudAsset = useAssetStore((state) => state.renameCloudAsset);
    const deleteCloudAsset = useAssetStore((state) => state.deleteCloudAsset);

    const [keyword, setKeyword] = useState("");
    const [kindFilter, setKindFilter] = useState<"" | CloudAssetKind>("");
    const [renaming, setRenaming] = useState<CloudAsset | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [renameTags, setRenameTags] = useState("");

    // 搜索与类型筛选变化时重新从服务端取第一页（防抖避免每个字符一次请求）。
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void refreshCloudAssets({ q: keyword.trim() || undefined, kind: kindFilter || undefined });
        }, 300);
        return () => window.clearTimeout(timer);
    }, [keyword, kindFilter, refreshCloudAssets]);

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
            </div>

            {cloudError ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">{cloudError}</div> : null}

            {cloudAssets.length ? (
                <div className="grid grid-cols-4 gap-3">
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
                                    <Tag className="m-0 shrink-0 text-[10px]">{kindLabels[asset.kind]}</Tag>
                                </div>
                                <div className="mt-1.5 flex items-center justify-between">
                                    <span className="text-[10px] text-stone-400">{asset.updatedAt || asset.createdAt}</span>
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

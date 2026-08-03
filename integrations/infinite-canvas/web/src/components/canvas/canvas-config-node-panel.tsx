import { useRef, useState, type CSSProperties } from "react";
import { AlertCircle, Check, Image as ImageIcon, LoaderCircle, Play, Settings2, Square } from "lucide-react";
import { Button, Image } from "antd";

import { defaultConfig, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasBackendModelPicker } from "./canvas-backend-model-picker";
import { CanvasConfigComposer } from "./canvas-config-composer";
import { CanvasImageSettingsPopover } from "./canvas-image-settings-popover";
import type { NodeGenerationInput } from "./canvas-node-generation";
import type { CanvasGeneratedImage, CanvasNodeData, CanvasNodeMetadata } from "@/types/canvas";

type CanvasConfigNodePanelProps = {
    node: CanvasNodeData;
    onSelectImage: (nodeId: string, imageIndex: number) => void;
};

type CanvasConfigGenerationPanelProps = {
    node: CanvasNodeData;
    isRunning: boolean;
    inputs: NodeGenerationInput[];
    inputSummary: { textCount: number; imageCount: number; videoCount: number; audioCount: number };
    onConfigChange: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onGenerate: (nodeId: string) => void;
    onStop: (nodeId: string) => void;
    onClose: () => void;
};

export function generatedImageGridClass(count: number): string {
    if (count === 2) return "grid-cols-2 grid-rows-1";
    if (count === 3) return "grid-cols-3 grid-rows-1";
    if (count >= 4) return "grid-cols-2 grid-rows-2";
    return "grid-cols-1 grid-rows-1";
}

export function CanvasConfigNodePanel({ node, onSelectImage }: CanvasConfigNodePanelProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const images = node.metadata?.generatedImages || [];
    const selectedIndex = Math.max(0, Math.min(node.metadata?.selectedGeneratedImageIndex || 0, Math.max(0, images.length - 1)));
    const isLoading = node.metadata?.status === "loading";
    const isError = node.metadata?.status === "error";
    const task = node.metadata?.generationTask;

    return (
        <div
            data-drawing-node-preview
            className="relative h-full w-full cursor-pointer overflow-hidden rounded-[inherit]"
            style={{ background: theme.node.fill, color: theme.node.text }}
        >
            {images.length ? (
                <div className={`grid h-full w-full gap-1.5 p-1.5 ${generatedImageGridClass(images.length)}`}>
                    {images.slice(0, 4).map((image, index) => (
                        <GeneratedImageTile key={`${image.storageKey || image.content}-${index}`} image={image} index={index} selected={index === selectedIndex} onSelect={() => onSelectImage(node.id, index)} />
                    ))}
                </div>
            ) : (
                <div
                    className="relative flex h-full w-full items-center justify-center overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${theme.node.fill} 0%, ${theme.toolbar.activeBg} 48%, ${theme.node.fill} 100%)` }}
                >
                    <div className="absolute inset-[12%] rounded-[22px] border opacity-35" style={{ borderColor: theme.node.stroke }} />
                    <div className="flex flex-col items-center gap-2 text-center opacity-55">
                        {isError ? <AlertCircle className="size-7 text-red-400" /> : <ImageIcon className="size-7" />}
                        <span className="text-xs font-medium">{isError ? "生成失败，打开面板后重试" : "生图结果显示在这里"}</span>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 text-white backdrop-blur-[2px]">
                    <LoaderCircle className="size-8 animate-spin" />
                    <div className="text-sm font-medium">{task?.progressText || "图片生成中"}</div>
                    {typeof task?.stage === "string" ? <div className="text-xs opacity-70">{task.stage}</div> : null}
                </div>
            ) : null}

            {isError && images.length ? (
                <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-950/85 px-3 py-2 text-xs text-red-100">
                    <AlertCircle className="size-4 shrink-0" />
                    <span className="truncate">{node.metadata?.errorDetails || "部分图片生成失败"}</span>
                </div>
            ) : null}

            {images.length > 1 ? (
                <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-white">
                    {selectedIndex + 1}/{images.length}
                </div>
            ) : null}
        </div>
    );
}

function GeneratedImageTile({ image, index, selected, onSelect }: { image: CanvasGeneratedImage; index: number; selected: boolean; onSelect: () => void }) {
    // 不拦截 mousedown：拖动时让节点整体移动；只在未发生位移的点击时选中结果。
    // 双击放大查看原图（antd Image preview，与引用图预览同一形态）。
    const downPos = useRef<{ x: number; y: number } | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    return (
        <>
        <button
            type="button"
            className={`relative min-h-0 min-w-0 overflow-hidden rounded-xl border-2 bg-black/20 transition ${selected ? "border-cyan-400" : "border-transparent hover:border-white/50"}`}
            onPointerDown={(event) => {
                downPos.current = { x: event.clientX, y: event.clientY };
            }}
            onClick={(event) => {
                const moved = downPos.current ? Math.hypot(event.clientX - downPos.current.x, event.clientY - downPos.current.y) : 0;
                downPos.current = null;
                if (moved > 5) return;
                event.stopPropagation();
                onSelect();
            }}
            onDoubleClick={(event) => {
                event.stopPropagation();
                setPreviewOpen(true);
            }}
        >
            <img src={image.content} alt={`生成结果 ${index + 1}`} className="h-full w-full object-contain" draggable={false} />
            {selected ? (
                <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-cyan-500/15">
                    <span className="flex items-center gap-1 rounded-full bg-cyan-500/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg">
                        <Check className="size-3.5" />
                        已选中
                    </span>
                    <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white/90">将作为下游参考图</span>
                </span>
            ) : null}
            <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-black/70 text-[10px] font-semibold text-white">{index + 1}</span>
        </button>
        {previewOpen ? (
            <Image
                src={image.content}
                alt={`生成结果 ${index + 1} 原图`}
                style={{ display: "none" }}
                preview={{ visible: true, src: image.content, onVisibleChange: (visible) => !visible && setPreviewOpen(false) }}
            />
        ) : null}
        </>
    );
}

export function CanvasConfigGenerationPanel({ node, isRunning, inputs, inputSummary, onConfigChange, onGenerate, onStop, onClose }: CanvasConfigGenerationPanelProps) {
    const globalConfig = useEffectiveConfig();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const config = buildNodeConfig(globalConfig, node);
    const chipStyle = { background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text };
    const hasAnyInput = Boolean(inputSummary.textCount || inputSummary.imageCount || inputSummary.videoCount || inputSummary.audioCount);
    const hasComposerContent = Boolean((node.metadata?.composerContent ?? node.metadata?.prompt ?? "").trim());
    const canGenerate = hasComposerContent || hasAnyInput;

    return (
        <div
            data-canvas-no-zoom
            data-drawing-generation-panel
            className="rounded-[20px] border p-4 shadow-2xl backdrop-blur"
            style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            <CanvasConfigComposer embedded value={node.metadata?.composerContent ?? node.metadata?.prompt ?? ""} inputs={inputs} onChange={(composerContent) => onConfigChange(node.id, { composerContent })} onClose={onClose} />

            <div className="mt-3 flex flex-wrap gap-1.5">
                <InputChip label="文字" value={`${inputSummary.textCount} 个`} style={chipStyle} />
                <InputChip label="参考图" value={`${inputSummary.imageCount} 张`} style={chipStyle} />
                {inputSummary.videoCount ? <InputChip label="视频" value={`${inputSummary.videoCount} 个`} style={chipStyle} /> : null}
                {inputSummary.audioCount ? <InputChip label="音频" value={`${inputSummary.audioCount} 个`} style={chipStyle} /> : null}
                <span className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px]" style={chipStyle}>
                    <Settings2 className="size-3.5" />
                    结果保留在本节点
                </span>
            </div>

            <div className="mt-3 grid min-w-0 items-start gap-2 md:grid-cols-[minmax(0,1fr)_180px]" onMouseDown={(event) => event.stopPropagation()}>
                <CanvasBackendModelPicker node={node} imageCount={Number(config.count) || 1} onConfigChange={onConfigChange} />
                <CanvasImageSettingsPopover
                    config={config}
                    placement="topRight"
                    autoAdjustOverflow={false}
                    buttonClassName="canvas-compact-control !h-10 !w-full !justify-start !rounded-lg !px-2"
                    onConfigChange={(key, value) => onConfigChange(node.id, key === "count" ? { count: Math.max(1, Math.min(4, Number(value) || 1)) } : { [key]: value })}
                />
            </div>

            <div className="mt-3 flex items-center gap-2">
                <div className="min-w-0 flex-1 truncate text-[11px] opacity-55">生成 4 张时在节点内显示 2×2 四宫格</div>
                <Button type="primary" className="!h-9 !min-w-28 !cursor-pointer !rounded-lg" danger={isRunning} disabled={!isRunning && !canGenerate} onClick={() => (isRunning ? onStop(node.id) : onGenerate(node.id))}>
                    <span className="inline-flex items-center gap-1.5">
                        {isRunning ? (
                            <>
                                <Square className="size-3.5 fill-current" />
                                停止
                            </>
                        ) : (
                            <>
                                <Play className="size-4" />
                                开始生成
                            </>
                        )}
                    </span>
                </Button>
            </div>
        </div>
    );
}

function InputChip({ label, value, style }: { label: string; value: string; style: CSSProperties }) {
    return (
        <div className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px]" style={style}>
            <span>{label}</span>
            <span className="font-medium">{value}</span>
        </div>
    );
}

function buildNodeConfig(globalConfig: AiConfig, node: CanvasNodeData): AiConfig {
    return {
        ...globalConfig,
        model: node.metadata?.model || globalConfig.imageModel,
        quality: node.metadata?.quality || globalConfig.quality || defaultConfig.quality,
        size: node.metadata?.size || globalConfig.size || defaultConfig.size,
        background: node.metadata?.background ?? globalConfig.background ?? defaultConfig.background,
        count: String(Math.max(1, Math.min(4, node.metadata?.count || Number(globalConfig.canvasImageCount || globalConfig.count || defaultConfig.count)))),
    };
}

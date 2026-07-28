import type { CSSProperties } from "react";
import { Image as ImageIcon, LoaderCircle, MessageSquare, Music2, Play, Settings2, Square, Video } from "lucide-react";
import { Button, Segmented, Tooltip } from "antd";

import { defaultConfig, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasBackendModelPicker } from "./canvas-backend-model-picker";
import { CanvasImageSettingsPopover } from "./canvas-image-settings-popover";
import type { CanvasGenerationMode, CanvasNodeData, CanvasNodeMetadata } from "@/types/canvas";

type CanvasConfigNodePanelProps = {
    node: CanvasNodeData;
    isRunning: boolean;
    inputSummary: { textCount: number; imageCount: number; videoCount: number; audioCount: number };
    onConfigChange: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
    onGenerate: (nodeId: string) => void;
    onStop: (nodeId: string) => void;
    onComposerToggle: () => void;
};

// Task 11：第一轮只开放生图模式（后端线路/模型/估费）；文本/视频/音频模式暂未开放。
const DISABLED_MODE_HINT = "暂未开放";

export function CanvasConfigNodePanel({ node, isRunning, inputSummary, onConfigChange, onGenerate, onStop, onComposerToggle }: CanvasConfigNodePanelProps) {
    const globalConfig = useEffectiveConfig();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const mode = node.metadata?.generationMode || "image";
    const config = buildNodeConfig(globalConfig, node);
    const chipStyle = { background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text };
    const hasAnyInput = Boolean(inputSummary.textCount || inputSummary.imageCount || inputSummary.videoCount || inputSummary.audioCount);
    const hasComposerContent = Boolean((node.metadata?.composerContent ?? node.metadata?.prompt ?? "").trim());
    const canGenerate = mode === "image" && (hasComposerContent || hasAnyInput);

    return (
        <div className="flex h-full w-full cursor-move flex-col px-3 pb-3 pt-7 text-sm" style={{ color: theme.node.text }} onWheel={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-3">
                <div className="shrink-0 text-sm font-semibold">生成配置</div>
                <div className="cursor-default" onMouseDown={(event) => event.stopPropagation()}>
                    <Segmented
                        size="small"
                        className="canvas-config-mode !rounded-md !p-0.5"
                        value={mode}
                        onChange={(value) => onConfigChange(node.id, { generationMode: value as CanvasGenerationMode })}
                        options={[
                            {
                                value: "image",
                                label: (
                                    <span className="inline-flex items-center gap-1">
                                        <ImageIcon className="size-3.5" />
                                        生图
                                    </span>
                                ),
                            },
                            {
                                value: "text",
                                disabled: true,
                                label: (
                                    <Tooltip title={DISABLED_MODE_HINT}>
                                        <span className="inline-flex items-center gap-1">
                                            <MessageSquare className="size-3.5" />
                                            文本
                                        </span>
                                    </Tooltip>
                                ),
                            },
                            {
                                value: "video",
                                disabled: true,
                                label: (
                                    <Tooltip title={DISABLED_MODE_HINT}>
                                        <span className="inline-flex items-center gap-1">
                                            <Video className="size-3.5" />
                                            视频
                                        </span>
                                    </Tooltip>
                                ),
                            },
                            {
                                value: "audio",
                                disabled: true,
                                label: (
                                    <Tooltip title={DISABLED_MODE_HINT}>
                                        <span className="inline-flex items-center gap-1">
                                            <Music2 className="size-3.5" />
                                            音频
                                        </span>
                                    </Tooltip>
                                ),
                            },
                        ]}
                    />
                </div>
            </div>

            <div className="mb-2 flex flex-wrap gap-1.5">
                <InputChip label="提示词" value={`${inputSummary.textCount} 个`} style={chipStyle} />
                <InputChip label="参考图" value={`${inputSummary.imageCount} 张`} style={chipStyle} />
                <InputChip label="参考视频" value={`${inputSummary.videoCount} 个`} style={chipStyle} />
                <InputChip label="参考音频" value={`${inputSummary.audioCount} 个`} style={chipStyle} />
                <button type="button" className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2 text-[11px]" style={chipStyle} onMouseDown={(event) => event.stopPropagation()} onClick={onComposerToggle}>
                    <Settings2 className="size-3.5" />
                    组装提示词
                </button>
            </div>

            <div className="mb-2 grid min-w-0 cursor-default items-start gap-2" style={{ gridTemplateColumns: mode === "image" ? "minmax(0,1fr) 148px" : "minmax(0,1fr)" }} onMouseDown={(event) => event.stopPropagation()}>
                {mode === "image" ? (
                    // 生图模式的线路/模型/估费只从后端读取（Task 8），不走本地 Provider 渠道配置。
                    <CanvasBackendModelPicker node={node} imageCount={Number(config.count) || 1} onConfigChange={onConfigChange} />
                ) : (
                    <div className="flex h-10 items-center px-1 text-xs opacity-60">该生成模式暂未开放，当前仅支持生图</div>
                )}
                {mode === "image" ? (
                    <CanvasImageSettingsPopover config={config} placement="topRight" autoAdjustOverflow={false} buttonClassName="canvas-compact-control !h-10 !w-full !justify-start !rounded-lg !px-2" onConfigChange={(key, value) => onConfigChange(node.id, key === "count" ? { count: Number(value) || 1 } : { [key]: value })} />
                ) : null}
            </div>

            <Button
                type="primary"
                className="mt-auto !h-9 !w-full !cursor-pointer !rounded-lg"
                danger={isRunning}
                disabled={!isRunning && !canGenerate}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => (isRunning ? onStop(node.id) : onGenerate(node.id))}
            >
                <span className="inline-flex items-center gap-1.5">
                    {isRunning ? (
                        <>
                            <LoaderCircle className="size-4 animate-spin" />
                            <Square className="size-3.5 fill-current" />
                            <span>停止</span>
                        </>
                    ) : (
                        <>
                            <Play className="size-4" />
                            <span>开始生成</span>
                        </>
                    )}
                </span>
            </Button>
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
        count: String(node.metadata?.count || globalConfig.canvasImageCount || globalConfig.count || defaultConfig.count),
    };
}

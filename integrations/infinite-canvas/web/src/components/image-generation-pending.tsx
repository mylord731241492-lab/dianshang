import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw, Square } from "lucide-react";

import { formatDuration } from "@/lib/image-utils";
import { cn } from "@/lib/utils";
import { taskStageLabel } from "@/integrations/hajimi/generation-api";

const pendingMessages = ["正在创建图片", "马上就好了", "再等等", "正在整理细节"];

// 持久生图任务的展示视图（Task 8）：来自节点 generationTask 快照或轮询响应。
export type GenerationPendingTaskView = {
    status?: string;
    stage?: string;
    progress?: number;
    progressText?: string;
    billingStatus?: string;
    providerBillingStatus?: string;
    upstreamBillingAmbiguous?: boolean;
    errorMessage?: string;
};

// 失败/取消的计费提示：本地已退款与上游计费未知（ADR-0004）必须区分。
export function generationFailureHint(task?: GenerationPendingTaskView): string {
    if (!task) return "";
    if (task.providerBillingStatus === "unknown" || task.upstreamBillingAmbiguous) {
        return "本地已停止并退回未结算算力；上游计费状态未知，如被扣费请联系客服核对";
    }
    if (task.billingStatus === "refunded" || task.billingStatus === "partially_settled") {
        return "预占算力已退款";
    }
    return "";
}

type ImageGenerationPendingProps = {
    className?: string;
    label?: string;
    compact?: boolean;
    /** 持久任务视图：提供后展示真实阶段与进度，替代轮播文案。 */
    task?: GenerationPendingTaskView;
    /** 失败态：展示错误、计费提示与人工重试。 */
    failed?: boolean;
    onCancel?: () => void;
    onRetry?: () => void;
};

export function ImageGenerationPending({ className, label, compact = false, task, failed = false, onCancel, onRetry }: ImageGenerationPendingProps) {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const index = Math.floor(tick / 2) % pendingMessages.length;
    const simulated = Math.min(98, 10 + (1 - Math.exp(-tick / 28)) * 88);
    const hasTaskProgress = typeof task?.progress === "number" && task.progress > 0;
    const progress = hasTaskProgress ? Math.min(100, task!.progress!) : simulated;
    const stageText = task?.progressText || (task?.stage ? taskStageLabel(task.stage) : "") || label || pendingMessages[index];
    const failureHint = failed ? generationFailureHint(task) : "";

    if (failed) {
        return (
            <div className={cn("relative flex flex-col items-center justify-center gap-2 overflow-hidden bg-stone-100 px-4 text-center dark:bg-white/10", compact ? "min-h-24" : "aspect-[4/3]", className)}>
                <div className="text-xs leading-5 text-red-500 dark:text-red-300">{task?.errorMessage || "生成失败"}</div>
                {failureHint ? <div className="text-[11px] leading-4 text-stone-500 dark:text-stone-400">{failureHint}</div> : null}
                {onRetry ? (
                    <button
                        type="button"
                        className="mt-1 inline-flex h-7 items-center gap-1.5 rounded-full border border-stone-300 px-3 text-xs font-medium text-stone-600 transition hover:scale-[1.02] dark:border-white/20 dark:text-stone-200"
                        onClick={(event) => {
                            event.stopPropagation();
                            onRetry();
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <RefreshCw className="size-3" />
                        人工重试
                    </button>
                ) : null}
            </div>
        );
    }

    return (
        <div className={cn("relative overflow-hidden bg-stone-100 dark:bg-white/10", compact ? "min-h-24" : "aspect-[4/3]", className)}>
            <div
                className="absolute inset-0 opacity-60"
                style={{
                    backgroundImage: "radial-gradient(circle, rgba(120,113,108,0.35) 1.4px, transparent 1.6px)",
                    backgroundSize: "16px 16px",
                    maskImage: "radial-gradient(ellipse at 38% 68%, black 0%, black 28%, transparent 60%)",
                }}
            />
            <div className="absolute left-4 top-4 flex items-center gap-2 text-[15px] font-medium text-stone-500 dark:text-stone-300">
                <LoaderCircle className="size-4 animate-spin" />
                <span>{stageText}</span>
            </div>
            {onCancel ? (
                <button
                    type="button"
                    className="absolute right-4 top-4 inline-flex h-7 items-center gap-1 rounded-full border border-stone-300 px-2.5 text-xs font-medium text-stone-500 transition hover:scale-[1.02] dark:border-white/20 dark:text-stone-300"
                    onClick={(event) => {
                        event.stopPropagation();
                        onCancel();
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <Square className="size-3 fill-current" />
                    取消
                </button>
            ) : null}
            <div className="absolute bottom-4 left-4 right-4">
                <div className="mb-2 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                    <span>{formatDuration(tick * 1000)}</span>
                    <span>{Math.floor(progress)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-stone-300/70 dark:bg-white/12">
                    <div className="h-full rounded-full bg-stone-900 dark:bg-stone-100" style={{ width: `${progress}%` }} />
                </div>
            </div>
        </div>
    );
}

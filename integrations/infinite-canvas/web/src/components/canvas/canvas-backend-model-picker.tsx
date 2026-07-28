import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Select } from "antd";

import { getModelsApi } from "@/integrations/hajimi/browser-client";
import type { CostEstimate, RouteModel, UserRoute } from "@/integrations/hajimi/models-api";
import type { CanvasNodeData, CanvasNodeMetadata } from "@/types/canvas";

// 生成配置节点的后端线路/模型/估费选择器（Task 8）：
// 数据只来自 /api/user/routes、/api/user/models?routeId=、POST /api/generation/estimate-cost，
// 不显示也不保存 Base URL、API Key 或 Provider 原始配置。

type CanvasBackendModelPickerProps = {
    node: CanvasNodeData;
    imageCount: number;
    onConfigChange: (nodeId: string, patch: Partial<CanvasNodeMetadata>) => void;
};

export function CanvasBackendModelPicker({ node, imageCount, onConfigChange }: CanvasBackendModelPickerProps) {
    const [routes, setRoutes] = useState<UserRoute[]>([]);
    const [models, setModels] = useState<RouteModel[]>([]);
    const [estimate, setEstimate] = useState<CostEstimate | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const estimateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const routeId = node.metadata?.routeId || "";
    const model = node.metadata?.model || "";

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getModelsApi()
            .listRoutes()
            .then(async (items) => {
                if (cancelled) return;
                const enabled = items.filter((item) => item.enabled);
                setRoutes(enabled);
                if (!enabled.length) {
                    setError("当前账号没有可用的图片线路");
                    return;
                }
                const current = enabled.find((item) => item.id === routeId) || enabled.find((item) => item.isDefault) || enabled[0]!;
                if (current.id !== routeId) onConfigChange(node.id, { routeId: current.id });
                const routeModels = await getModelsApi().listModels(current.id);
                if (cancelled) return;
                const enabledModels = routeModels.filter((item) => item.enabled);
                setModels(enabledModels);
                if (enabledModels.length && !enabledModels.some((item) => item.modelKey === model)) {
                    const fallback = enabledModels.find((item) => item.modelKey === current.defaultModelKey) || enabledModels[0]!;
                    onConfigChange(node.id, { model: fallback.modelKey });
                }
            })
            .catch(() => {
                if (!cancelled) setError("线路与模型加载失败，请稍后重试");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // routeId/model 由 onConfigChange 写回节点后触发本 effect 重算，依赖是合理的。
    }, [node.id, routeId, model, onConfigChange]);

    useEffect(() => {
        setEstimate(null);
        if (!model) return;
        if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
        estimateTimerRef.current = setTimeout(() => {
            getModelsApi()
                .estimateCost({ modelKey: model, routeId: routeId || undefined, imageCount })
                .then(setEstimate)
                .catch(() => setEstimate(null));
        }, 200);
        return () => {
            if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
        };
    }, [model, routeId, imageCount]);

    if (loading) {
        return (
            <div className="flex h-10 items-center gap-2 px-1 text-xs opacity-70">
                <LoaderCircle className="size-3.5 animate-spin" />
                正在加载线路与模型…
            </div>
        );
    }
    if (error) return <div className="flex h-10 items-center px-1 text-xs text-red-400">{error}</div>;

    return (
        <div className="flex min-w-0 flex-col gap-1.5" onMouseDown={(event) => event.stopPropagation()}>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
                <Select
                    size="small"
                    className="canvas-compact-control h-10 min-w-0"
                    value={routeId || undefined}
                    placeholder="线路"
                    options={routes.map((route) => ({ value: route.id, label: route.displayName }))}
                    onChange={(value) => onConfigChange(node.id, { routeId: value, model: undefined })}
                />
                <Select
                    size="small"
                    className="canvas-compact-control h-10 min-w-0"
                    value={model || undefined}
                    placeholder="模型"
                    options={models.map((item) => ({ value: item.modelKey, label: item.displayName }))}
                    onChange={(value) => onConfigChange(node.id, { model: value })}
                />
            </div>
            <div className="px-1 text-[11px] opacity-60">{estimate ? `预计消耗 ${estimate.totalCost} 算力（余额 ${estimate.available}）` : "估费中…"}</div>
        </div>
    );
}

import { useCallback, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import { buildNodeContext } from "@/lib/canvas/plugin-node-context";
import { getNodeDefinition } from "@/lib/canvas/node-registry";
import { canvasThemes } from "@/lib/canvas-theme";
import type { CanvasNodeToolbarItem, CanvasPluginAi, CanvasPluginHost } from "@/types/canvas-plugin";
import type { CanvasAgentOp } from "@/lib/canvas/canvas-agent-ops";
import type { CanvasConnection, CanvasNodeData, ViewportTransform } from "@/types/canvas";

type CanvasTheme = (typeof canvasThemes)[keyof typeof canvasThemes];

type PluginHostParams = {
    theme: CanvasTheme;
    nodesRef: MutableRefObject<CanvasNodeData[]>;
    connectionsRef: MutableRefObject<CanvasConnection[]>;
    viewportRef: MutableRefObject<ViewportTransform>;
    setNodes: Dispatch<SetStateAction<CanvasNodeData[]>>;
    setDialogNodeId: Dispatch<SetStateAction<string | null>>;
    applyAgentOps: (ops?: CanvasAgentOp[]) => unknown;
};

// Task 11：插件市场与 Provider 直连已收口。宿主不再加载远程插件，
// 也不再向节点上下文提供可直连 Provider 的 AI 能力（统一提示暂未开放）。
const unavailableAi: CanvasPluginAi = {
    generateImage: async () => {
        throw new Error("该功能暂未开放，请使用画布生图节点");
    },
    generateVideo: async () => {
        throw new Error("视频生成暂未开放");
    },
    generateText: async () => {
        throw new Error("文本生成暂未开放");
    },
    listModels: () => [],
    defaultModel: () => "",
};

/**
 * 节点宿主能力：把画布读写、面板开关等封装成节点上下文可调用的 host 对象，
 * 用于渲染节点面板与悬浮工具条（内置节点注册表）。
 */
export function usePluginHost(params: PluginHostParams) {
    const { theme, nodesRef, connectionsRef, viewportRef, setNodes, setDialogNodeId, applyAgentOps } = params;

    const pluginHost = useMemo<CanvasPluginHost>(
        () => ({
            getNode: (id) => nodesRef.current.find((node) => node.id === id) || null,
            getNodes: () => nodesRef.current,
            getConnections: () => connectionsRef.current,
            getUpstream: (nodeId) =>
                connectionsRef.current
                    .filter((conn) => conn.toNodeId === nodeId)
                    .map((conn) => nodesRef.current.find((node) => node.id === conn.fromNodeId))
                    .filter((node): node is CanvasNodeData => Boolean(node)),
            getDownstream: (nodeId) =>
                connectionsRef.current
                    .filter((conn) => conn.fromNodeId === nodeId)
                    .map((conn) => nodesRef.current.find((node) => node.id === conn.toNodeId))
                    .filter((node): node is CanvasNodeData => Boolean(node)),
            updateNode: (nodeId, patch) => setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, ...patch } : node))),
            updateMetadata: (nodeId, patch) => setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, ...patch } } : node))),
            applyOps: (ops) => applyAgentOps(ops),
            ai: unavailableAi,
            openPanel: (nodeId) => setDialogNodeId(nodeId),
            closePanel: () => setDialogNodeId(null),
        }),
        [applyAgentOps],
    );

    const renderPluginPanel = useCallback(
        (panelNode: CanvasNodeData) => {
            const Panel = getNodeDefinition(panelNode.type)?.Panel;
            if (!Panel) return null;
            const ctx = buildNodeContext(pluginHost, panelNode, theme, viewportRef.current.k);
            return <Panel ctx={ctx} onClose={() => setDialogNodeId(null)} />;
        },
        [pluginHost, theme],
    );

    // 组装节点悬浮工具条按钮:节点自定义 toolbar +(声明 interactionToggle 时)宿主自动注入的「交互 ⇄ 移动」开关
    const buildNodeToolbarItems = useCallback(
        (node: CanvasNodeData): CanvasNodeToolbarItem[] => {
            const definition = getNodeDefinition(node.type);
            const ctx = buildNodeContext(pluginHost, node, theme, viewportRef.current.k);
            const custom = definition?.toolbar?.(ctx) || [];
            // 仅在节点有内容(展示态)且非强制交互态(如编辑态)时提供「交互/移动」开关
            if (!definition?.interactionToggle || !node.metadata?.content || definition.forceInteractive?.(node)) return custom;
            const interactive = Boolean(node.metadata?.interactive);
            const toggle: CanvasNodeToolbarItem = {
                id: "node-interaction-toggle",
                title: interactive ? "当前:交互中。点击切回「移动」——拖动可移动节点" : "当前:可移动。点击切到「交互」——可操作节点内容(如转动全景)",
                label: interactive ? "移动" : "交互",
                icon: interactive ? "✋" : "🖐",
                active: interactive,
                onClick: () => pluginHost.updateMetadata(node.id, { interactive: !interactive }),
            };
            return [toggle, ...custom];
        },
        [pluginHost, theme],
    );

    return { pluginHost, renderPluginPanel, buildNodeToolbarItems };
}

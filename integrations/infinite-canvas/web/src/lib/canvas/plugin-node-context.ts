import type { CanvasTheme } from "@/lib/canvas-theme";
import type { CanvasNodeData } from "@/types/canvas";
import type { CanvasNodeContext, CanvasPluginHost, PluginStorage } from "@/types/canvas-plugin";

// Task 11：插件市场已收口，节点上下文不再提供跨节点事件总线与持久化存储；
// emit/on 为空操作，storage 退化为进程内内存（不落 IndexedDB/localStorage）。
const memoryStorage = new Map<string, unknown>();

const noopStorage: PluginStorage = {
    get: async <T = unknown>(key: string) => (memoryStorage.has(key) ? (memoryStorage.get(key) as T) : null),
    set: async (key, value) => {
        memoryStorage.set(key, value);
    },
    remove: async (key) => {
        memoryStorage.delete(key);
    },
};

// 把宿主能力 + 节点 + 主题/缩放,组装成注入给节点面板/工具条的上下文
export function buildNodeContext(host: CanvasPluginHost, node: CanvasNodeData, theme: CanvasTheme, scale: number, isSelected = false): CanvasNodeContext {
    return {
        node,
        theme,
        scale,
        isSelected,
        updateMetadata: (patch) => host.updateMetadata(node.id, patch),
        updateNode: (patch) => host.updateNode(node.id, patch),
        getNode: (id) => host.getNode(id),
        getNodes: () => host.getNodes(),
        getConnections: () => host.getConnections(),
        getUpstream: () => host.getUpstream(node.id),
        getDownstream: () => host.getDownstream(node.id),
        applyOps: (ops) => host.applyOps(ops),
        emit: () => {},
        on: () => () => {},
        ai: host.ai,
        openPanel: () => host.openPanel(node.id),
        closePanel: () => host.closePanel(),
        storage: noopStorage,
    };
}

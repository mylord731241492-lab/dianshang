import { Modal } from "antd";

import type { PromptInsertReference } from "@/integrations/hajimi/prompts-api";
import { CloudAssetsBrowser } from "./cloud-assets-browser";

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
        <Modal title="生图记录" open={open} onCancel={onClose} footer={null} width={860} destroyOnHidden styles={{ body: { padding: "0 24px 24px", minHeight: 480 } }}>
            {open ? <CloudAssetsBrowser onInsert={onInsert} /> : null}
        </Modal>
    );
}

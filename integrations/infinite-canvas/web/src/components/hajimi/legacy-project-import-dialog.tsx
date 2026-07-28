// Task 12：旧版画布项目的显式导入对话框。
// 非破坏性流程：读旧项目 → 转换（data:image 先经 /api/user/assets/upload 上传为云端资产）→
// POST 新项目（名称追加“（新版副本）”）→ 导航到新项目；原项目记录始终保持不变。
// 按 Task 12 Step 4：只支持用户打开旧项目时逐个显式导入，不做任何批量迁移。

import { useCallback, useState } from "react";
import { App, Modal } from "antd";
import { useNavigate } from "react-router-dom";

import { getProjectsApi } from "@/integrations/hajimi/browser-client";
import { parseAssetStorageKey } from "@/integrations/hajimi/assets-api";
import { convertLegacyProject, type LegacyImageUploadResult } from "@/integrations/hajimi/legacy-project-import";
import { uploadImage } from "@/services/image-storage";

type Props = {
    open: boolean;
    projectId: string;
    onClose: () => void;
};

// data:image 内联图 → 云端资产：复用 Task 6 的上传通道，返回转换器所需的 assetId 引用。
async function uploadLegacyInlineImage(dataUrl: string): Promise<LegacyImageUploadResult> {
    const uploaded = await uploadImage(dataUrl);
    const assetId = parseAssetStorageKey(uploaded.storageKey);
    if (!assetId) throw new Error("上传资产响应缺少 assetId");
    return { assetId, storageKey: uploaded.storageKey, url: uploaded.url, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes, mimeType: uploaded.mimeType };
}

export function LegacyProjectImportDialog({ open, projectId, onClose }: Props) {
    const { message } = App.useApp();
    const navigate = useNavigate();
    const [importing, setImporting] = useState(false);

    const handleImport = useCallback(async () => {
        if (!projectId || importing) return;
        setImporting(true);
        try {
            // 只读取旧项目；原记录不做任何写操作。
            const legacy = await getProjectsApi().get(projectId);
            const result = await convertLegacyProject(legacy.data, { uploadImage: uploadLegacyInlineImage });
            const created = await getProjectsApi().create({ name: `${legacy.name}（新版副本）`, data: result.envelope });
            if (result.warnings.length) {
                message.warning(`已导入新版副本，${result.warnings.length} 项旧内容未能转换（原项目未修改）`);
            } else {
                message.success("已导入新版副本，原项目未修改");
            }
            onClose();
            navigate(`/canvas/${encodeURIComponent(created.id)}`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "导入失败，请重试");
        } finally {
            setImporting(false);
        }
    }, [importing, message, navigate, onClose, projectId]);

    return (
        <Modal
            open={open}
            title="导入旧版画布项目"
            okText="导入为新版副本"
            cancelText="取消"
            confirmLoading={importing}
            onOk={() => void handleImport()}
            onCancel={() => {
                if (!importing) onClose();
            }}
        >
            <p>这是旧版画布项目。导入会创建一份新版副本，原项目不会修改。</p>
            <p className="text-stone-500">旧项目中的内联图片会先上传到你的云端资产库；无法转换的内容会在导入后提示。</p>
        </Modal>
    );
}

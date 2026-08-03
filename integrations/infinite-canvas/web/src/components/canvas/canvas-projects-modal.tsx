import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App, Button, Empty, Modal, Spin } from "antd";
import { Plus } from "lucide-react";

import { CanvasDeleteProjectsDialog } from "@/components/canvas/canvas-delete-projects-dialog";
import { CanvasProjectCard } from "@/components/canvas/canvas-project-card";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";

// 画布中心弹窗：项目列表以弹窗形式内嵌在画布页，不再整页跳转到 /canvas 列表。
// 复用画布库的 store 与卡片组件；删除走同一确认对话框。

export function CanvasProjectsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { message } = App.useApp();
    const navigate = useNavigate();
    const projects = useCanvasStore((state) => state.projects);
    const hydrated = useCanvasStore((state) => state.hydrated);
    const loadProjects = useCanvasStore((state) => state.loadProjects);
    const createProject = useCanvasStore((state) => state.createProject);

    useEffect(() => {
        if (open) void loadProjects().catch(() => {});
    }, [open, loadProjects]);

    const createAndEnter = async () => {
        try {
            const id = await createProject(`无限画布 ${projects.length + 1}`);
            onClose();
            navigate(`/canvas/${id}`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "创建画布失败，请重试");
        }
    };

    return (
        <Modal
            title="画布中心"
            open={open}
            onCancel={onClose}
            footer={null}
            width={880}
            destroyOnHidden
            styles={{ body: { maxHeight: "68vh", overflowY: "auto" } }}
        >
            <div className="mb-3 flex items-center justify-between">
                <span className="text-xs opacity-50">{projects.length ? `共 ${projects.length} 个画布` : ""}</span>
                <Button size="small" type="primary" icon={<Plus className="size-3.5" />} onClick={() => void createAndEnter()}>
                    新建画布
                </Button>
            </div>
            {!hydrated ? (
                <div className="grid place-items-center py-14">
                    <Spin />
                </div>
            ) : projects.length ? (
                <div className="grid grid-cols-3 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
                    {projects.map((project) => (
                        <div key={project.id} onClick={onClose}>
                            <CanvasProjectCard project={project} />
                        </div>
                    ))}
                </div>
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有画布，点击「新建画布」开始" className="py-12" />
            )}
            <CanvasDeleteProjectsDialog />
        </Modal>
    );
}

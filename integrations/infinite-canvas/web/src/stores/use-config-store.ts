import { create } from "zustand";

// Task 11：候选画布不再保留任何 Provider 直连配置（渠道、Base URL、API Key、WebDAV、配置弹窗）。
// 线路/模型/估费只从后端 /api/user/routes、/api/user/models 读取（见 canvas-backend-model-picker），
// 生图提交统一走同源持久任务（canvas-node-generation）。本 store 只保留画布生成的本地偏好
// （尺寸/质量/数量等），不使用 persist，localStorage/IndexedDB 不保存任何配置或密钥。

export type AiConfig = {
    model: string;
    imageModel: string;
    videoModel: string;
    textModel: string;
    audioModel: string;
    quality: string;
    size: string;
    background: string;
    count: string;
    canvasImageCount: string;
    videoSeconds: string;
    vquality: string;
    videoGenerateAudio: string;
    videoWatermark: string;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
};

export const defaultConfig: AiConfig = {
    // 模型一律由后端线路选择器写入节点 metadata，本地不内置任何模型清单。
    model: "",
    imageModel: "",
    videoModel: "",
    textModel: "",
    audioModel: "",
    quality: "auto",
    size: "1:1",
    background: "",
    count: "1",
    canvasImageCount: "1",
    videoSeconds: "6",
    vquality: "720",
    videoGenerateAudio: "true",
    videoWatermark: "false",
    audioVoice: "alloy",
    audioFormat: "mp3",
    audioSpeed: "1",
    audioInstructions: "",
};

type ConfigStore = {
    config: AiConfig;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
};

export const useConfigStore = create<ConfigStore>()((set) => ({
    config: defaultConfig,
    updateConfig: (key, value) =>
        set((state) => ({
            config: {
                ...state.config,
                [key]: value,
            },
        })),
}));

export function useEffectiveConfig(): AiConfig {
    return useConfigStore((state) => state.config);
}

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webDir = dirname(fileURLToPath(import.meta.url));

// Task 11：候选版已移除插件市场（localPluginsManifest）、版本检查（__APP_RELEASES__）
// 与运行期统计配置，构建只打画布本体。
export default defineConfig({
    base: process.env.VITE_BASE || "/canvas-app/",
    plugins: [react()],
    resolve: {
        alias: {
            "@": resolve(webDir, "src"),
        },
    },
});

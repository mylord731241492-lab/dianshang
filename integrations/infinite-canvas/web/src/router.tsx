import { createBrowserRouter, Outlet } from "react-router-dom";

import UserLayout from "@/layouts/user-layout";
import CanvasPage from "@/pages/canvas";
import CanvasProjectPage from "@/pages/canvas/project";
import NotFound from "@/pages/not-found";

// 第一阶段只保留画布路由；主站首页、图像、视频、素材、提示词、配置均由主站提供。
export const router = createBrowserRouter([
    {
        element: (
            <UserLayout>
                <Outlet />
            </UserLayout>
        ),
        children: [
            { path: "/canvas", element: <CanvasPage /> },
            { path: "/canvas/:id", element: <CanvasProjectPage /> },
        ],
    },
    { path: "*", element: <NotFound /> },
]);

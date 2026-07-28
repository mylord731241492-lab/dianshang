import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";

// 主站品牌绿（与 frontend/src/styles/app.css 的 #059669 / #10b981 一致）。
const neutral = {
    light: {
        primary: "#059669",
        primaryHover: "#047857",
        primaryText: "#ffffff",
        menuBg: "#f5f5f5",
        menuText: "#171717",
        selectActiveBg: "#f5f5f5",
        selectSelectedBg: "#d1fae5",
        selectText: "#065f46",
        tableSelectedBg: "rgba(5, 150, 105, 0.06)",
        tableSelectedHoverBg: "rgba(5, 150, 105, 0.1)",
    },
    dark: {
        primary: "#10b981",
        primaryHover: "#34d399",
        primaryText: "#052014",
        menuBg: "#262626",
        menuText: "#fafafa",
        selectActiveBg: "#262626",
        selectSelectedBg: "#064e3b",
        selectText: "#a7f3d0",
        tableSelectedBg: "rgba(16, 185, 129, 0.12)",
        tableSelectedHoverBg: "rgba(16, 185, 129, 0.18)",
    },
};

export function getAntThemeConfig(dark: boolean): ThemeConfig {
    const color = dark ? neutral.dark : neutral.light;

    return {
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        cssVar: { key: dark ? "infinite-canvas-dark" : "infinite-canvas-light" },
        token: {
            colorPrimary: color.primary,
            colorInfo: color.primary,
            colorLink: color.primary,
            colorLinkHover: color.primaryHover,
            colorLinkActive: color.primary,
            colorTextLightSolid: color.primaryText,
        },
        components: {
            Button: {
                primaryShadow: "none",
            },
            Menu: {
                itemActiveBg: color.menuBg,
                itemHoverBg: color.menuBg,
                itemSelectedBg: color.menuBg,
                itemSelectedColor: color.menuText,
                darkItemHoverBg: neutral.dark.menuBg,
                darkItemSelectedBg: neutral.dark.menuBg,
                darkItemSelectedColor: neutral.dark.menuText,
            },
            Select: {
                optionActiveBg: color.selectActiveBg,
                optionSelectedBg: color.selectSelectedBg,
                optionSelectedColor: color.selectText,
            },
            Table: {
                rowSelectedBg: color.tableSelectedBg,
                rowSelectedHoverBg: color.tableSelectedHoverBg,
            },
        },
    };
}

#!/usr/bin/env node
/**
 * Task 11 静态门禁：候选无限画布（integrations/infinite-canvas/web）运行 bundle 的浏览器边界。
 *
 * 扫描 integrations/infinite-canvas/web/dist/ 的 js/css/html 产物，断言不存在：
 *   - API Key / Provider Base URL 输入入口与 api_key/apiKey 存储键
 *   - 上游 /config 路由残留入口
 *   - 本地 Agent 连接（canvas-agent / @basketikun / connect token / Codex / MCP）
 *   - 插件市场（official-plugins.json / cdn.jsdelivr.net）
 *   - 浏览器直连 /images/generations、/images/edits、api.openai.com 等上游 Provider 域名
 *   - 浏览器直连对象存储（OBJECT_STORAGE / amazonaws / S3 endpoint 字样）
 *   - localForage/localStorage 持久化账号资产列表或提示词正文（app_state / prompt_cache 存储名）
 *   - 前端硬编码模型价格表
 *   - github.com/basketikun 运行时链接 / 版本检查 fetch
 *
 * 另做两类整体断言：
 *   - bundle 内出现的所有 http(s) URL 必须在白名单内（w3.org 命名空间、框架文档链接等无害字符串）；
 *   - dist/index.html 只引用同源 /canvas-app/ 下的相对资源，无外链脚本/样式。
 *
 * sourcemap（*.map）当前构建不产出；若将来产出，本脚本会单独列出其中的命中并同样计为失败，
 * 但在报告里标注来源为 sourcemap，便于区分"运行代码"与"源码映射"。
 *
 * 允许在 UPSTREAM.md / 许可证 / 测试断言中出现上述文字——本脚本只扫描运行 bundle。
 *
 * 用法：node scripts/check-infinite-canvas-browser-boundary.js
 * 退出码：0 通过；1 存在违规或 dist 缺失。
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'integrations', 'infinite-canvas', 'web', 'dist');

// ---------------------------------------------------------------------------
// 禁用模式：label 用于报告，pattern 为正则（全局）。全部命中即违规。
// ---------------------------------------------------------------------------
const FORBIDDEN_PATTERNS = [
    { label: '上游 Provider 域名 api.openai.com', pattern: /api\.openai\.com/g },
    { label: '上游 Provider 域名 generativelanguage.googleapis.com', pattern: /generativelanguage\.googleapis\.com/g },
    { label: '浏览器直连 /images/generations', pattern: /\/images\/generations/g },
    { label: '浏览器直连 /images/edits', pattern: /\/images\/edits/g },
    { label: '插件市场清单 official-plugins.json', pattern: /official-plugins\.json/g },
    { label: '插件市场 CDN cdn.jsdelivr.net', pattern: /cdn\.jsdelivr\.net/g },
    { label: '上游仓库链接 github.com/basketikun', pattern: /github\.com\/basketikun/g },
    { label: '上游版本检查 raw.githubusercontent.com/basketikun', pattern: /raw\.githubusercontent\.com\/basketikun/g },
    { label: '本地 Agent 标识 @basketikun', pattern: /@basketikun/g },
    { label: '本地 Agent 连接 canvas-agent', pattern: /canvas-agent/gi },
    { label: '本地 Agent 连接 connect token', pattern: /connect token/gi },
    { label: '本地 Codex Agent 字样', pattern: /\bCodex\b/g },
    { label: '本地 Agent MCP 字样', pattern: /\bMCP\b/g },
    { label: '上游文档站外链 docs.canvas.best', pattern: /docs\.canvas\.best/g },
    { label: 'API Key 输入/提示字样', pattern: /API ?[Kk]ey/g },
    { label: 'api_key 存储键字样', pattern: /api_key/g },
    { label: 'localForage 账号状态存储名 app_state', pattern: /app_state/g },
    { label: 'localForage 提示词缓存存储名 prompt_cache', pattern: /prompt_cache/g },
    { label: 'Provider 配置持久化存储键 ai_config_store', pattern: /ai_config_store/g },
    { label: '账号资产持久化存储键 asset_store', pattern: /asset_store/g },
    { label: '插件持久化存储键 plugin_store', pattern: /plugin_store/g },
    { label: '对象存储配置字样 OBJECT_STORAGE', pattern: /OBJECT_STORAGE/g },
    { label: 'S3 endpoint 字样 amazonaws.com', pattern: /amazonaws\.com/g },
    { label: '前端硬编码模型价格表', pattern: /模型价格|价格表|MODEL_PRICE/gi },
    // 上游 /config 路由残留入口：带引号的精确路径（排除 /api/... 等同源业务接口）
    { label: '上游 /config 路由残留入口', pattern: /["'`]\/config["'`]/g },
];

// bundle 中允许出现的 http(s) URL 主机白名单：
// 均为第三方库的文档/命名空间/占位字符串，不产生真实业务请求。
const ALLOWED_URL_HOSTS = new Set([
    'www.w3.org', // SVG/MathML 命名空间常量
    'react.dev', // React 错误码文档链接
    'reactrouter.com', // react-router 警告文案
    'github.com', // 仅限 ungap 等 polyfill 头部注释（下方再做路径级校验）
    'mozilla.github.io', // localForage 库头注释
    'localhost', // react-router history 的 URL 解析兜底常量（new URL 的 base），不产生请求
]);

// github.com 仅允许这些路径前缀（polyfill 注释）；其余 github.com 链接一律违规，
// 这样 prompt 源的 github.com/ImgEdify 等合集地址也会被拦住。
const ALLOWED_GITHUB_PATH_PREFIXES = ['/ungap/'];

const URL_PATTERN = /https?:\/\/[A-Za-z0-9._~-]+(?::\d+)?(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]*)?/g;

// ---------------------------------------------------------------------------
// 扫描工具
// ---------------------------------------------------------------------------
function collectFiles(dir, exts) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...collectFiles(full, exts));
        else if (exts.includes(path.extname(entry.name).toLowerCase())) out.push(full);
    }
    return out;
}

function snippet(text, index, length) {
    const start = Math.max(0, index - 40);
    const end = Math.min(text.length, index + length + 40);
    return text.slice(start, end).replace(/\s+/g, ' ');
}

const violations = [];
function report(file, label, count, sample, isSourcemap) {
    violations.push({ file: path.relative(root, file), label, count, sample, isSourcemap });
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error(`[boundary] 缺少构建产物 ${path.relative(root, distDir)}/index.html，请先执行 npm run build --prefix integrations/infinite-canvas/web`);
    process.exit(1);
}

const bundleFiles = collectFiles(distDir, ['.js', '.css', '.html']);
const sourcemapFiles = collectFiles(distDir, ['.map']);

for (const file of [...bundleFiles, ...sourcemapFiles]) {
    const isSourcemap = file.endsWith('.map');
    const text = fs.readFileSync(file, 'utf8');
    for (const { label, pattern } of FORBIDDEN_PATTERNS) {
        pattern.lastIndex = 0;
        const matches = [...text.matchAll(pattern)];
        if (matches.length) report(file, label, matches.length, snippet(text, matches[0].index, matches[0][0].length), isSourcemap);
    }
    // URL 主机白名单
    URL_PATTERN.lastIndex = 0;
    const urls = new Set([...text.matchAll(URL_PATTERN)].map((m) => m[0]));
    for (const url of urls) {
        let host;
        let pathname = '/';
        try {
            const parsed = new URL(url);
            host = parsed.hostname;
            pathname = parsed.pathname;
        } catch {
            continue;
        }
        if (host === 'github.com' && ALLOWED_GITHUB_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) continue;
        if (!ALLOWED_URL_HOSTS.has(host)) report(file, `未白名单的外网 URL：${url}`, 1, url, isSourcemap);
    }
}

// index.html 资源引用断言：只允许同源 /canvas-app/ 或相对路径，禁止任何外链脚本/样式。
const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
for (const match of indexHtml.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) {
    const ref = match[1];
    if (/^https?:\/\//i.test(ref)) {
        report(path.join(distDir, 'index.html'), `index.html 外链资源：${ref}`, 1, ref, false);
    } else if (ref.startsWith('/') && !ref.startsWith('/canvas-app/')) {
        report(path.join(distDir, 'index.html'), `index.html 引用了 /canvas-app/ 之外的绝对路径：${ref}`, 1, ref, false);
    }
}

// 候选隔离断言：主站 frontend 源码不得内嵌候选 bundle 路径（候选由独立 HTML 经 /canvas-app/ 加载）。
const frontendSrc = path.join(root, 'frontend', 'src');
if (fs.existsSync(frontendSrc)) {
    for (const file of collectFiles(frontendSrc, ['.vue', '.ts', '.js', '.html', '.css'])) {
        const text = fs.readFileSync(file, 'utf8');
        if (text.includes('/canvas-app/')) {
            report(file, '主站 frontend 源码引用了候选 bundle 路径 /canvas-app/', 1, '/canvas-app/', false);
        }
    }
}

// ---------------------------------------------------------------------------
// 报告
// ---------------------------------------------------------------------------
if (sourcemapFiles.length) {
    console.log(`[boundary] 说明：发现 ${sourcemapFiles.length} 个 sourcemap 文件，其中的命中会标注 [sourcemap]（源码映射内容，与运行代码区分）。`);
}

if (!violations.length) {
    console.log(`[boundary] 通过：扫描 ${bundleFiles.length} 个 bundle 文件，未发现浏览器边界违规。`);
    process.exit(0);
}

console.error(`[boundary] 失败：发现 ${violations.length} 类违规（按文件 × 模式聚合）：`);
for (const v of violations) {
    const tag = v.isSourcemap ? ' [sourcemap]' : '';
    console.error(`  - ${v.file}${tag} :: ${v.label}（${v.count} 处）`);
    console.error(`      样本: ${v.sample}`);
}
process.exit(1);

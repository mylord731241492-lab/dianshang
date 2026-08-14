// E2E CDP 验收统一入口。
// 用法：
//   node scripts/e2e-cdp/run-all.js            # 跑全部免费测试（默认跳过 AI_COST 付费测试）
//   node scripts/e2e-cdp/run-all.js --with-ai  # 包含真实调用计费的测试
//   node scripts/e2e-cdp/run-all.js user-center-align ui-preferences   # 只跑指定测试（不含 .test.js 后缀）
// 环境变量：E2E_BASE（默认 http://127.0.0.1:3468）、E2E_PROJECT_ID、E2E_CHROME、E2E_WORK_DIR、E2E_DB_PATH
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TESTS_DIR = require('path').join(__dirname, 'tests');
const args = process.argv.slice(2);
const withAi = args.includes('--with-ai');
const only = args.filter((a) => !a.startsWith('--'));

const files = fs
    .readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith('.test.js'))
    .filter((f) => (only.length ? only.some((name) => f.startsWith(name)) : true))
    .filter((f) => withAi || !fs.readFileSync(path.join(TESTS_DIR, f), 'utf8').startsWith('// AI_COST: true'))
    .sort();

if (!files.length) {
    console.log('没有匹配的测试。');
    process.exit(1);
}

console.log(`待跑 ${files.length} 个测试（${withAi ? '含付费' : '仅免费'}）\n`);
const summary = [];
let failed = 0;
for (const file of files) {
    const start = Date.now();
    const result = spawnSync('node', [path.join(TESTS_DIR, file), process.env.E2E_PROJECT_ID || ''], {
        encoding: 'utf8',
        timeout: 15 * 60 * 1000,
        env: process.env,
    });
    const out = `${result.stdout || ''}${result.stderr || ''}`.trim();
    const pass = result.status === 0;
    if (!pass) failed += 1;
    summary.push({ file, pass, ms: Date.now() - start });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${file}  (${((Date.now() - start) / 1000).toFixed(0)}s)`);
    if (!pass) console.log(out.split('\n').slice(-15).join('\n'), '\n');
}

console.log(`\n=== ${files.length - failed}/${files.length} 通过 ===`);
process.exit(failed ? 1 : 0);

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const dockerEnvPath = path.join(repoRoot, 'docker', '.env');
const skillRoot = path.join(repoRoot, 'integrations', 'librechat', 'skills');

const reviewedSkills = [
  {
    directory: 'image-reverse-describe',
    name: 'image-reverse-describe',
    displayTitle: '图像精确反推',
    category: '图像分析',
  },
  {
    directory: 'image-deep-read',
    name: 'image-deep-read',
    displayTitle: '图像深读',
    category: '图像分析',
  },
  {
    directory: 'style-grammar-distill',
    name: 'style-grammar-distill',
    displayTitle: '风格语法提炼',
    category: '图像分析',
  },
];

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function parseArgs(argv) {
  const args = { dryRun: false, baseUrl: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run') {
      args.dryRun = true;
    } else if (value === '--base-url') {
      args.baseUrl = String(argv[index + 1] || '').trim();
      index += 1;
    }
  }
  return args;
}

function parseFrontmatter(content, expectedName) {
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) throw new Error(`${expectedName}: SKILL.md 缺少 YAML frontmatter`);
  const values = {};
  for (const line of match[1].split('\n')) {
    const index = line.indexOf(':');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    values[key] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  if (values.name !== expectedName) {
    throw new Error(`${expectedName}: frontmatter name 实际为 ${values.name || '空'}`);
  }
  if (!values.description) throw new Error(`${expectedName}: description 不能为空`);
  if (values['user-invocable'] !== 'true') {
    throw new Error(`${expectedName}: 必须声明 user-invocable: true`);
  }
  return { description: values.description };
}

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function validateLocalSkill(config) {
  const directory = path.join(skillRoot, config.directory);
  const skillPath = path.join(directory, 'SKILL.md');
  if (!fs.existsSync(skillPath)) throw new Error(`${config.name}: SKILL.md 不存在`);
  const body = fs.readFileSync(skillPath, 'utf8');
  if (body.charCodeAt(0) === 0xfeff) throw new Error(`${config.name}: SKILL.md 含 BOM`);
  const frontmatter = parseFrontmatter(body, config.name);
  const files = walkFiles(directory)
    .filter((filePath) => filePath !== skillPath)
    .map((filePath) => ({
      absolutePath: filePath,
      relativePath: path.relative(directory, filePath).replace(/\\/g, '/'),
    }));
  for (const reference of body.matchAll(/\]\(\.\/(references\/[^)#]+)(?:#[^)]+)?\)/g)) {
    const relativePath = reference[1];
    if (!files.some((file) => file.relativePath === relativePath)) {
      throw new Error(`${config.name}: 引用文件不存在 ${relativePath}`);
    }
  }
  return { ...config, body, description: frontmatter.description, files };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text.slice(0, 500) };
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${url} -> ${response.status}: ${data.message || data.error || '请求失败'}`);
  }
  return data;
}

function authHeaders(token, contentType = '') {
  return {
    Authorization: `Bearer ${token}`,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36',
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

async function getChatToken(baseUrl, username, password) {
  const login = await requestJson(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const ticket = await requestJson(`${baseUrl}/api/integrations/librechat/sso-ticket`, {
    method: 'POST',
    headers: authHeaders(login.token, 'application/json'),
    body: '{}',
  });
  const chatLogin = await requestJson(`${baseUrl}/chat/api/auth/hjm-sso`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket: ticket.ticket }),
  });
  if (!chatLogin.token) throw new Error('LibreChat SSO 未返回 token');
  return chatLogin.token;
}

async function importSkill(baseUrl, token, skill) {
  const form = new FormData();
  form.append('file', new Blob([skill.body], { type: 'text/markdown; charset=utf-8' }), `${skill.name}.md`);
  return requestJson(`${baseUrl}/chat/api/skills/import`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  });
}

async function updateSkill(baseUrl, token, current, skill) {
  return requestJson(`${baseUrl}/chat/api/skills/${encodeURIComponent(current._id)}`, {
    method: 'PATCH',
    headers: authHeaders(token, 'application/json'),
    body: JSON.stringify({
      expectedVersion: current.version,
      displayTitle: skill.displayTitle,
      description: skill.description,
      body: skill.body,
      category: skill.category,
    }),
  });
}

async function uploadSkillFile(baseUrl, token, skillId, file) {
  const content = fs.readFileSync(file.absolutePath);
  const form = new FormData();
  form.append('relativePath', file.relativePath);
  form.append('file', new Blob([content], { type: 'text/markdown; charset=utf-8' }), path.basename(file.relativePath));
  return requestJson(`${baseUrl}/chat/api/skills/${encodeURIComponent(skillId)}/files`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  });
}

async function shareSkillPublicly(baseUrl, token, skillId) {
  const result = await requestJson(
    `${baseUrl}/chat/api/permissions/skill/${encodeURIComponent(skillId)}`,
    {
      method: 'PUT',
      headers: authHeaders(token, 'application/json'),
      body: JSON.stringify({
        updated: [],
        removed: [],
        public: true,
        publicAccessRoleId: 'skill_viewer',
      }),
    },
  );
  const publicGrant = result?.results?.principals?.some(
    (principal) =>
      principal?.type === 'public' && principal?.accessRoleId === 'skill_viewer',
  );
  if (result?.results?.public !== true || !publicGrant) {
    throw new Error(
      `Skill ${skillId}: LibreChat 未确认公开只读权限已写入 (${JSON.stringify(result || {})})`,
    );
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const skills = reviewedSkills.map(validateLocalSkill);
  console.log(`Reviewed LibreChat Skills validated: ${skills.map((skill) => skill.name).join(', ')}`);
  if (args.dryRun) return;

  const envFile = readDotEnv(dockerEnvPath);
  const baseUrl = String(
    args.baseUrl || process.env.INTERNAL_PROD_BASE_URL || 'http://192.168.0.39:3456',
  ).replace(/\/$/, '');
  const username = process.env.INTERNAL_PROD_ADMIN_USERNAME || envFile.ADMIN_BOOTSTRAP_USERNAME || 'admin';
  const password = process.env.INTERNAL_PROD_ADMIN_PASSWORD || envFile.ADMIN_BOOTSTRAP_PASSWORD;
  if (!password) throw new Error('缺少 INTERNAL_PROD_ADMIN_PASSWORD 或 docker/.env ADMIN_BOOTSTRAP_PASSWORD');

  const token = await getChatToken(baseUrl, username, password);
  const listed = await requestJson(`${baseUrl}/chat/api/skills?limit=100`, {
    headers: authHeaders(token),
  });
  const existingByName = new Map((listed.skills || []).map((skill) => [skill.name, skill]));

  for (const skill of skills) {
    let current = existingByName.get(skill.name);
    if (!current) {
      current = await importSkill(baseUrl, token, skill);
      console.log(`Imported Skill: ${skill.name}`);
    }
    current = await updateSkill(baseUrl, token, current, skill);
    for (const file of skill.files) {
      await uploadSkillFile(baseUrl, token, current._id, file);
    }
    await shareSkillPublicly(baseUrl, token, current._id);
    console.log(`Synced public Skill: ${skill.name} (${skill.files.length} reference files)`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const serverPath = path.join(repoRoot, 'server.js');
const source = fs.readFileSync(serverPath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractFunction(name, nextAnchor) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `Missing function ${name}`);
  const end = nextAnchor ? source.indexOf(nextAnchor, start + name.length) : -1;
  assert(end > start, `Missing next anchor for ${name}: ${nextAnchor}`);
  return source.slice(start, end);
}

const sandbox = { module: { exports: {} } };
vm.runInNewContext([
  extractFunction('firstString', 'function imageReferenceCandidates'),
  extractFunction('normalizeProviderContentText', 'function imageToolOutputText'),
  extractFunction('imageToolOutputText', 'function imageToolSize'),
  'module.exports = { imageToolOutputText };'
].join('\n'), sandbox);

const { imageToolOutputText } = sandbox.module.exports;

const cases = [
  {
    label: 'responses output text object value',
    data: {
      output: [{
        content: [{ type: 'output_text', text: { value: '{"finalPrompt":"生成1:2详情页"}' } }]
      }]
    },
    expected: '生成1:2详情页'
  },
  {
    label: 'wrapped data choices',
    data: {
      data: {
        choices: [{
          message: {
            content: [{ type: 'text', text: { value: '{"finalPrompt":"保留产品做详情页"}' } }]
          }
        }]
      }
    },
    expected: '保留产品做详情页'
  },
  {
    label: 'response output nested',
    data: {
      response: {
        output: [{
          content: [{ type: 'output_text', text: '{"finalPrompt":"清晰电商长图"}' }]
        }]
      }
    },
    expected: '清晰电商长图'
  },
  {
    label: 'reasoning content fallback',
    data: {
      choices: [{
        message: {
          content: null,
          reasoning_content: '{"finalPrompt":"根据图1生成1:2详情页"}'
        }
      }]
    },
    expected: '根据图1生成1:2详情页'
  },
  {
    label: 'direct final prompt field',
    data: {
      final_prompt: '把参考图产品改成1:2详情页，保留品牌文字'
    },
    expected: '保留品牌文字'
  }
];

for (const item of cases) {
  const text = imageToolOutputText(item.data);
  assert(text.includes(item.expected), `${item.label} failed: ${text}`);
}

console.log(`Provider text extraction passed: ${cases.length} cases`);

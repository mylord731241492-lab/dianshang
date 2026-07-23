const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const canvasPath = path.resolve(__dirname, '..', 'assets', 'Canvas-B8bY9_QL.js');
const source = fs.readFileSync(canvasPath, 'utf8');
const panelStart = source.indexOf('rP={__name:"PromptReversePanel"');
assert(panelStart >= 0, 'PromptReversePanel was not found in the current Canvas bundle');

const functionMarker = 'const r=async()=>{';
const functionStart = source.indexOf(functionMarker, panelStart);
const functionEnd = source.indexOf('};return(a,i)=>', functionStart);
assert(functionStart >= 0 && functionEnd > functionStart, 'Reverse prompt copy handler was not found');

const handlerBody = source.slice(functionStart + functionMarker.length, functionEnd);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const runCopy = new AsyncFunction('t', 'window', 'navigator', 'document', 'console', handlerBody);

function createMessageRecorder() {
  const messages = [];
  return {
    messages,
    window: {
      isSecureContext: false,
      $message: {
        success(message) { messages.push({ type: 'success', message }); },
        error(message) { messages.push({ type: 'error', message }); },
      },
    },
  };
}

function createFallbackDocument({ copyResult = true } = {}) {
  let activeTextarea = null;
  const state = { appended: 0, removed: 0, copiedText: '' };
  return {
    state,
    document: {
      createElement(tagName) {
        assert.equal(tagName, 'textarea');
        return {
          value: '',
          style: {},
          setAttribute() {},
          focus() {},
          select() {},
          setSelectionRange() {},
        };
      },
      body: {
        appendChild(node) {
          activeTextarea = node;
          state.appended += 1;
        },
        removeChild(node) {
          assert.equal(node, activeTextarea);
          activeTextarea = null;
          state.removed += 1;
        },
      },
      execCommand(command) {
        assert.equal(command, 'copy');
        state.copiedText = activeTextarea?.value || '';
        return copyResult;
      },
    },
  };
}

async function main() {
  const prompt = '电商主图反推测试提示词';

  const fallbackMessages = createMessageRecorder();
  const fallbackDom = createFallbackDocument();
  await runCopy(
    { value: prompt },
    fallbackMessages.window,
    {},
    fallbackDom.document,
    console,
  );
  assert.equal(fallbackDom.state.copiedText, prompt, 'HTTP fallback did not write the prompt text');
  assert.equal(fallbackDom.state.appended, 1, 'HTTP fallback did not attach its textarea');
  assert.equal(fallbackDom.state.removed, 1, 'HTTP fallback did not clean up its textarea');
  assert.deepEqual(fallbackMessages.messages, [{ type: 'success', message: '提示词已复制' }]);

  const secureMessages = createMessageRecorder();
  secureMessages.window.isSecureContext = true;
  let secureCopiedText = '';
  const secureDom = createFallbackDocument({ copyResult: false });
  await runCopy(
    { value: prompt },
    secureMessages.window,
    { clipboard: { async writeText(text) { secureCopiedText = text; } } },
    secureDom.document,
    console,
  );
  assert.equal(secureCopiedText, prompt, 'Secure Clipboard API did not receive the prompt text');
  assert.equal(secureDom.state.appended, 0, 'Secure Clipboard API should not use the fallback textarea');
  assert.deepEqual(secureMessages.messages, [{ type: 'success', message: '提示词已复制' }]);

  const failureMessages = createMessageRecorder();
  const failureDom = createFallbackDocument({ copyResult: false });
  await runCopy({ value: prompt }, failureMessages.window, {}, failureDom.document, { warn() {} });
  assert.deepEqual(failureMessages.messages, [{ type: 'error', message: '复制失败，请手动选择提示词' }]);

  console.log('Canvas reverse prompt copy regression passed: secure, HTTP fallback, and failure paths are explicit.');
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});

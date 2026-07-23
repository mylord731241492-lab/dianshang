const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
assert(
  source.includes("const { HttpsProxyAgent } = require('https-proxy-agent');"),
  'https-proxy-agent dependency must be loaded explicitly'
);

const start = source.indexOf('function normalizeLingsuanImageProxyUrl');
const end = source.indexOf('function isProviderPreTlsReset', start);
assert(start >= 0 && end > start, 'targeted image proxy transport helper not found');
const transportSource = source.slice(start, end);

class FakeProxyAgent {
  constructor(proxyUrl, options) {
    this.kind = 'proxy';
    this.proxyUrl = String(proxyUrl);
    this.options = options;
  }
}

function loadTransport(proxyUrl) {
  const directAgent = { kind: 'direct-ipv4-pool' };
  const sandbox = {
    process: { env: { LINGSUAN_IMAGE_PROXY_URL: proxyUrl } },
    HttpsProxyAgent: FakeProxyAgent,
    providerImageHttpsAgent: directAgent,
    URL,
    Set,
    String,
    Error,
  };
  vm.runInNewContext(
    `${transportSource}\nthis.agentForUrl = providerImageAgentForUrl; this.transportForUrl = providerImageTransportForUrl;`,
    sandbox
  );
  return sandbox;
}

const proxied = loadTransport('http://host.docker.internal:7890');
const lingsuanAgent = proxied.agentForUrl('https://lingsuan.top/v1/images/edits');
assert.strictEqual(lingsuanAgent.kind, 'proxy');
assert.strictEqual(lingsuanAgent.proxyUrl, 'http://host.docker.internal:7890/');
assert.strictEqual(proxied.transportForUrl('https://lingsuan.top/v1/images/edits'), 'https-proxy');
assert.strictEqual(proxied.agentForUrl('https://LINGSUAN.TOP/v1/images/generations').kind, 'proxy');
assert.strictEqual(proxied.agentForUrl('https://api.example.com/v1/images/edits').kind, 'direct-ipv4-pool');
assert.strictEqual(proxied.transportForUrl('https://api.example.com/v1/images/edits'), 'https-ipv4-pool');
assert.strictEqual(proxied.agentForUrl('https://evil.lingsuan.top/v1/images/edits').kind, 'direct-ipv4-pool');
assert.strictEqual(proxied.transportForUrl('https://evil.lingsuan.top/v1/images/edits'), 'https-ipv4-pool');
assert.strictEqual(proxied.agentForUrl('http://lingsuan.top/v1/images/edits'), undefined);
assert.strictEqual(proxied.transportForUrl('http://lingsuan.top/v1/images/edits'), 'http-direct');

const direct = loadTransport('');
assert.strictEqual(direct.agentForUrl('https://lingsuan.top/v1/images/edits').kind, 'direct-ipv4-pool');
assert.strictEqual(direct.transportForUrl('https://lingsuan.top/v1/images/edits'), 'https-ipv4-pool');

console.log('Targeted lingsuan image proxy routing regression passed');

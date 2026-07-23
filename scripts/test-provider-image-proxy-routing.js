const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
assert(
  source.includes("const { HttpsProxyAgent } = require('https-proxy-agent');"),
  'https-proxy-agent dependency must be loaded explicitly'
);
const poolStart = source.indexOf('const providerImageHttpsAgent');
const poolEnd = source.indexOf('function normalizeLingsuanImageProxyUrl', poolStart);
assert(poolStart >= 0 && poolEnd > poolStart, 'provider image connection pool not found');
const poolSource = source.slice(poolStart, poolEnd);
assert(poolSource.includes('PROVIDER_IMAGE_IP_FAMILY'), 'image pool must honor the selected IP family');
assert(
  poolSource.includes('providerImageHttpsAgentOptions.family = PROVIDER_IMAGE_IP_FAMILY'),
  'image pool must support deterministic IPv4 or IPv6 selection'
);
assert(poolSource.includes('autoSelectFamilyAttemptTimeout = 250'), 'auto mode must retain bounded family racing');

const familyStart = source.indexOf('function normalizeProviderImageIpFamily');
const familyEnd = source.indexOf('const PROVIDER_IMAGE_IP_FAMILY', familyStart);
assert(familyStart >= 0 && familyEnd > familyStart, 'provider image IP family normalizer not found');
const familySource = source.slice(familyStart, familyEnd);
function loadFamilyNormalizer(platform) {
  const sandbox = { process: { env: {}, platform }, String };
  vm.runInNewContext(`${familySource}\nthis.normalizeFamily = normalizeProviderImageIpFamily;`, sandbox);
  return sandbox.normalizeFamily;
}
const windowsFamily = loadFamilyNormalizer('win32');
const linuxFamily = loadFamilyNormalizer('linux');
assert.strictEqual(windowsFamily(), 6);
assert.strictEqual(linuxFamily(), 4);
assert.strictEqual(windowsFamily('4'), 4);
assert.strictEqual(linuxFamily('ipv6'), 6);
assert.strictEqual(windowsFamily('auto'), 0);

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

function loadTransport(proxyUrl, family = 6) {
  const directAgent = { kind: 'direct-family-pool' };
  const sandbox = {
    process: { env: { LINGSUAN_IMAGE_PROXY_URL: proxyUrl } },
    HttpsProxyAgent: FakeProxyAgent,
    providerImageHttpsAgent: directAgent,
    PROVIDER_IMAGE_IP_FAMILY: family,
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
assert.strictEqual(proxied.agentForUrl('https://api.example.com/v1/images/edits').kind, 'direct-family-pool');
assert.strictEqual(proxied.transportForUrl('https://api.example.com/v1/images/edits'), 'https-ipv6-pool');
assert.strictEqual(proxied.agentForUrl('https://evil.lingsuan.top/v1/images/edits').kind, 'direct-family-pool');
assert.strictEqual(proxied.transportForUrl('https://evil.lingsuan.top/v1/images/edits'), 'https-ipv6-pool');
assert.strictEqual(proxied.agentForUrl('http://lingsuan.top/v1/images/edits'), undefined);
assert.strictEqual(proxied.transportForUrl('http://lingsuan.top/v1/images/edits'), 'http-direct');

const direct = loadTransport('');
assert.strictEqual(direct.agentForUrl('https://lingsuan.top/v1/images/edits').kind, 'direct-family-pool');
assert.strictEqual(direct.transportForUrl('https://lingsuan.top/v1/images/edits'), 'https-ipv6-pool');
assert.strictEqual(loadTransport('', 4).transportForUrl('https://lingsuan.top/v1/images/edits'), 'https-ipv4-pool');
assert.strictEqual(loadTransport('', 0).transportForUrl('https://lingsuan.top/v1/images/edits'), 'https-happy-eyeballs-pool');

console.log('Targeted lingsuan image proxy routing regression passed');

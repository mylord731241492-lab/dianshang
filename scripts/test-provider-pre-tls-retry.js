const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const serverPath = path.join(__dirname, '..', 'server.js');
const source = fs.readFileSync(serverPath, 'utf8');
const start = source.indexOf('const wait = ms =>');
const end = source.indexOf('let providerImageRequestQueue', start);

assert(start >= 0 && end > start, 'provider pre-TLS retry helper not found');

const sandbox = { setTimeout, Promise };
vm.runInNewContext(
  `${source.slice(start, end)}\nthis.retryProviderRequest = fetchProviderWithPreTlsRetry;`,
  sandbox
);

const preTlsError = () => new Error(
  'Client network socket disconnected before secure TLS connection was established'
);

async function expectRejectedAttempts(errorFactory, expectedAttempts) {
  let attempts = 0;
  await assert.rejects(() => sandbox.retryProviderRequest(async () => {
    attempts += 1;
    throw errorFactory();
  }));
  assert.strictEqual(attempts, expectedAttempts);
}

(async () => {
  let attempts = 0;
  const recovered = await sandbox.retryProviderRequest(async () => {
    attempts += 1;
    if (attempts < 3) throw preTlsError();
    return { ok: true };
  });
  assert.strictEqual(attempts, 3);
  assert.strictEqual(recovered.preTlsRetryCount, 2);
  assert.deepStrictEqual(recovered.response, { ok: true });

  await expectRejectedAttempts(() => new Error('socket hang up'), 1);
  await expectRejectedAttempts(() => new Error('Provider returned 400'), 1);
  await expectRejectedAttempts(preTlsError, 3);

  console.log('Provider pre-TLS retry regression passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

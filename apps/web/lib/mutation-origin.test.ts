import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSameOriginMutation } from './mutation-origin';

test('mutation origin validation across local and reverse-proxy requests', () => {
  const previous = process.env.VUTEQ_SSO_PUBLIC_ORIGIN;
  const request = (origin?: string, site?: string) => new Request('http://localhost:31001/mtc/api/display/transactions', {
    method: 'POST', headers: { ...(origin ? { origin } : {}), ...(site ? { 'sec-fetch-site': site } : {}) },
  });
  try {
    process.env.VUTEQ_SSO_PUBLIC_ORIGIN = 'https://apps3.vuteq.co.id';
    assert.equal(isSameOriginMutation(request('https://apps3.vuteq.co.id', 'same-origin')), true);
    assert.equal(isSameOriginMutation(request('https://apps3.vuteq.co.id')), true);
    assert.equal(isSameOriginMutation(request('https://evil.example', 'same-origin')), false);
    assert.equal(isSameOriginMutation(request('https://apps3.vuteq.co.id', 'cross-site')), false);
    assert.equal(isSameOriginMutation(request('https://apps3.vuteq.co.id', 'same-site')), false);
    assert.equal(isSameOriginMutation(request()), false);
    assert.equal(isSameOriginMutation(request('null')), false);
    assert.equal(isSameOriginMutation(request('http://localhost:31001')), false);
    const forged = request('https://evil.example');
    forged.headers.set('x-forwarded-host', 'evil.example');
    forged.headers.set('x-forwarded-proto', 'https');
    assert.equal(isSameOriginMutation(forged), false);
    delete process.env.VUTEQ_SSO_PUBLIC_ORIGIN;
    assert.equal(isSameOriginMutation(request('http://localhost:31001', 'same-origin')), true);
    process.env.VUTEQ_SSO_PUBLIC_ORIGIN = 'invalid';
    assert.equal(isSameOriginMutation(request('http://localhost:31001')), false);
  } finally {
    if (previous === undefined) delete process.env.VUTEQ_SSO_PUBLIC_ORIGIN;
    else process.env.VUTEQ_SSO_PUBLIC_ORIGIN = previous;
  }
});

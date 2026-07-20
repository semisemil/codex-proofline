import assert from 'node:assert/strict';

import { getLoginState } from '../src/session.js';

assert.deepEqual(getLoginState({ user: { id: 'user-42' } }), {
  authenticated: true,
  userId: 'user-42',
});

assert.deepEqual(getLoginState(null), {
  authenticated: false,
  userId: null,
});

console.log('2 assertions passed');

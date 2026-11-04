/* tests/run.js  (Person A expands this file)
   Run with:  node tests/run.js */
const assert = require('assert');
const { calculate } = require('../logic.js');

const campus = [
  { name: 'AI Research Lab', hosts: '100' },
  { name: 'IoT Prototyping Lab', hosts: '50' },
  { name: 'Staff Administration Room', hosts: '20' },
  { name: 'Core Server Room', hosts: '5' },
];

// 1. The campus problem
let R = calculate('192.168.50.0/24', campus);
assert.deepStrictEqual(
  R.placed.map(p => p.network + '/' + p.prefix),
  ['192.168.50.0/25', '192.168.50.128/26', '192.168.50.192/27', '192.168.50.224/29']
);
assert.strictEqual(R.used, 232);
assert.deepStrictEqual(R.free.map(f => f.network + '/' + f.prefix), ['192.168.50.232/29', '192.168.50.240/28']);
assert.strictEqual(R.failed.length, 0);

// 2. Input order must not matter
R = calculate('192.168.50.0/24', [campus[3], campus[0], campus[2], campus[1]]);
assert.deepStrictEqual(
  R.placed.map(p => p.network + '/' + p.prefix),
  ['192.168.50.0/25', '192.168.50.128/26', '192.168.50.192/27', '192.168.50.224/29']
);

// 3. Overflow: the second facility must fail, not crash
R = calculate('192.168.50.0/24', [{ name: 'A', hosts: '200' }, { name: 'B', hosts: '100' }]);
assert.strictEqual(R.placed.length, 1);
assert.strictEqual(R.failed.length, 1);

// 4. Block-size boundaries: 126 hosts fit a /25, 127 hosts need a /24
R = calculate('10.0.0.0/16', [{ name: 'x', hosts: '126' }]);
assert.strictEqual(R.placed[0].prefix, 25);
R = calculate('10.0.0.0/16', [{ name: 'x', hosts: '127' }]);
assert.strictEqual(R.placed[0].prefix, 24);

// 5. One host needs a /30
R = calculate('192.168.1.0/24', [{ name: 'x', hosts: '1' }]);
assert.strictEqual(R.placed[0].prefix, 30);

// 6. A host address is normalised to its network address
R = calculate('192.168.50.17/24', campus);
assert.strictEqual(R.c.net, 3232248320);

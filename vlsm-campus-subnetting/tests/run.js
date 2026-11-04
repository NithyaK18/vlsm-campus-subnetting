const assert = require('assert');
const L = require('../logic.js');
const { ipToInt, intToIp, calculate } = L;
let n = 0;
function test(name, fn) { fn(); n++; }

const campus = [
  { name: 'AI Research Lab', hosts: '100' },
  { name: 'IoT Prototyping Lab', hosts: '50' },
  { name: 'Staff Administration Room', hosts: '20' },
  { name: 'Core Server Room', hosts: '5' },
];

test('ip <-> int round trip', () => {
  assert.strictEqual(ipToInt('192.168.50.0'), 3232248320);
  assert.strictEqual(intToIp(3232248320), '192.168.50.0');
  assert.strictEqual(intToIp(ipToInt('255.255.255.255')), '255.255.255.255');
});

test('campus problem matches the hand calculation', () => {
  const r = calculate('192.168.50.0/24', campus);
  const want = [
    ['AI Research Lab',           '192.168.50.0',   25, '255.255.255.128', '192.168.50.1',   '192.168.50.126', '192.168.50.127'],
    ['IoT Prototyping Lab',       '192.168.50.128', 26, '255.255.255.192', '192.168.50.129', '192.168.50.190', '192.168.50.191'],
    ['Staff Administration Room', '192.168.50.192', 27, '255.255.255.224', '192.168.50.193', '192.168.50.222', '192.168.50.223'],
    ['Core Server Room',          '192.168.50.224', 29, '255.255.255.248', '192.168.50.225', '192.168.50.230', '192.168.50.231'],
  ];
  assert.strictEqual(r.placed.length, 4);
  assert.strictEqual(r.failed.length, 0);
  want.forEach((w, i) => {
    const p = r.placed[i];
    assert.strictEqual(p.name, w[0]);
    assert.strictEqual(p.network, w[1]);
    assert.strictEqual(p.prefix, w[2]);
    assert.strictEqual(p.mask, w[3]);
    assert.strictEqual(p.first, w[4]);
    assert.strictEqual(p.last, w[5]);
    assert.strictEqual(p.bcast, w[6]);
  });
  assert.deepStrictEqual(r.placed.map(p => p.spare), [26, 12, 10, 1]);
  assert.strictEqual(r.used, 232);
});

test('leftover space is 232/29 and 240/28', () => {
  const r = calculate('192.168.50.0/24', campus);
  assert.strictEqual(r.free.length, 2);
  assert.deepStrictEqual(r.free.map(f => f.network), ['192.168.50.232', '192.168.50.240']);
  assert.deepStrictEqual(r.free.map(f => f.prefix), [29, 28]);
  assert.deepStrictEqual(r.free.map(f => f.size), [8, 16]);
});

test('input order does not matter (largest first)', () => {
  const r = calculate('192.168.50.0/24', campus.slice().reverse());
  assert.strictEqual(r.placed[0].name, 'AI Research Lab');
  assert.strictEqual(r.placed[0].network, '192.168.50.0');
});

test('size boundaries', () => {
  const pre = h => calculate('10.0.0.0/16', [{ name: 'x', hosts: String(h) }]).placed[0].prefix;
  assert.strictEqual(pre(126), 25);  // 126+2 = 128 fits exactly
  assert.strictEqual(pre(127), 24);  // 129 needs 256
  assert.strictEqual(pre(1), 30);    // minimum block
  assert.strictEqual(pre(2), 30);    // 2+2 = 4
  assert.strictEqual(pre(3), 29);    // 5 -> 8
  assert.strictEqual(pre(62), 26);
  assert.strictEqual(pre(63), 25);
});

test('no overlaps, all aligned', () => {
  const rows = [];
  for (let i = 0; i < 12; i++) rows.push({ name: 'F' + i, hosts: String(1 + ((i * 37) % 60)) });
  const r = calculate('10.1.0.0/20', rows);
  const blocks = r.placed.map(p => ({ s: ipToInt(p.network), size: p.size }));
  blocks.forEach(b => assert.strictEqual(b.s % b.size, 0));
  blocks.sort((a, b) => a.s - b.s);
  for (let i = 1; i < blocks.length; i++) {
    assert.ok(blocks[i].s >= blocks[i - 1].s + blocks[i - 1].size);
  }
});

test('a facility that does not fit is reported, others still placed', () => {
  const r = calculate('192.168.50.0/24', [
    { name: 'Big', hosts: '200' }, { name: 'Small', hosts: '10' }]);
  assert.strictEqual(r.placed.length, 1);
  assert.strictEqual(r.failed.length, 1);
  assert.strictEqual(r.failed[0].name, 'Small');
  assert.ok(r.failed[0].reason);
});

test('bad input is rejected, not crashed on', () => {
  assert.ok(calculate('300.1.1.1/24', campus).c.error);
  assert.ok(calculate('192.168.50.0/31', campus).c.error);
  assert.ok(calculate('hello', campus).c.error);
  const r = calculate('192.168.50.0/24', [
    { name: 'ok', hosts: '10' }, { name: 'a', hosts: 'abc' },
    { name: 'b', hosts: '0' },   { name: 'c', hosts: '-5' }, { name: 'd', hosts: '5.5' }]);
  assert.strictEqual(r.placed.length, 1);
  assert.strictEqual(r.badIdx.length, 4);
});

test('non-network address is snapped', () => {
  const r = calculate('192.168.50.17/24', campus);
  assert.ok(r.c.adjusted);
  assert.strictEqual(r.placed[0].network, '192.168.50.0');
});
test('headroom 20% keeps the campus plan valid', () => {
  const r = calculate('192.168.50.0/24', L.applyHeadroom(campus, 20)); // 120, 60, 24, 6
  assert.strictEqual(r.failed.length, 0);
  assert.strictEqual(r.placed[0].prefix, 25);
});

test('headroom 30% pushes the AI lab to a /24 and the rest fail', () => {
  const r = calculate('192.168.50.0/24', L.applyHeadroom(campus, 30)); // 130+2 > 128
  assert.strictEqual(r.placed[0].prefix, 24);
  assert.strictEqual(r.failed.length, 3);
});

test('router links get /30 blocks', () => {
  const r = calculate('192.168.50.0/24', campus.concat(L.linkRows(2)));
  const links = r.placed.filter(p => /^Router link/.test(p.name));
  assert.strictEqual(links.length, 2);
  links.forEach(p => assert.strictEqual(p.prefix, 30));
});

test('CSV has a header and one line per placed subnet', () => {
  const lines = L.toCsv(calculate('192.168.50.0/24', campus)).split('\n');
  assert.strictEqual(lines.length, 5);
  assert.ok(lines[1].includes('192.168.50.0'));
});
console.log('All tests passed (' + n + ' tests)');
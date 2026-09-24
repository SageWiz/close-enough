// Run with: node --test   (from the repo root)
const test = require('node:test');
const assert = require('node:assert/strict');
const CE = require('../quiz-core.js');

const all = v => Object.fromEntries(CE.QUESTIONS.map(q => [q.id, typeof v === 'function' ? v(q) : v]));

test('there are 20 questions, 10 per axis, with unique ids', () => {
  assert.equal(CE.QUESTIONS.length, 20);
  assert.equal(CE.QUESTIONS.filter(q => q.axis === 'share').length, 10);
  assert.equal(CE.QUESTIONS.filter(q => q.axis === 'touch').length, 10);
  assert.equal(new Set(CE.QUESTIONS.map(q => q.id)).size, 20);
});

test('all lowest answers score 0 / 0 and land in the vault', () => {
  const s = CE.score(all(0));
  assert.equal(s.x, 0); assert.equal(s.y, 0);
  assert.equal(s.quadrant, 'vault');
  assert.deepEqual(s.shareGroups, [0, 0, 0, 0, 0, 0]);
  assert.equal(s.give, 0); assert.equal(s.receive, 0);
});

test('all highest answers score 100 / 100 and land in hugs hello', () => {
  const s = CE.score(all(q => q.type === 'ring' ? CE.RINGS : CE.SCALE_MAX));
  assert.equal(s.x, 100); assert.equal(s.y, 100);
  assert.equal(s.quadrant, 'hugger');
  assert.deepEqual(s.touchGroups, [100, 100, 100, 100, 100, 100]);
});

test('ring 3 (friends) everywhere: 50% personal, groups cut off after friends', () => {
  const s = CE.score(all(q => q.type === 'ring' ? 3 : 2));
  assert.equal(s.x, 50);
  assert.equal(s.y, 50);                     // 3/6 and 2/4 are both one half
  assert.equal(s.quadrant, 'middle');
  assert.deepEqual(s.shareGroups, [100, 100, 100, 0, 0, 0]);
  assert.equal(s.shareMedian, 3);
});

test('touchy averages ring and scale answers on the same 0..1 footing', () => {
  // 5 touch ring answers at 6/6 = 1, 5 scale answers at 0/4 = 0 -> 50
  const s = CE.score(all(q => q.axis === 'share' ? 0 : (q.type === 'ring' ? 6 : 0)));
  assert.equal(s.y, 50);
  // receiving = 5 ring answers (1) + 2 receive scale answers (0) -> 5/7
  assert.equal(s.receive, Math.round(5 / 7 * 100));
  assert.equal(s.give, 0);
});

test('quadrant boundaries', () => {
  assert.equal(CE.quadrant(58, 42), 'middle');
  assert.equal(CE.quadrant(59, 42), 'open');
  assert.equal(CE.quadrant(49, 50), 'middle');
  assert.equal(CE.quadrant(41, 50), 'warm');
  assert.equal(CE.quadrant(50, 50), 'middle');
  assert.equal(CE.quadrant(50, 90), 'hugger');
  assert.equal(CE.quadrant(10, 49), 'vault');
});

test('a missing answer is an error, not a silent zero', () => {
  const a = all(1); delete a.s_cry;
  assert.throws(() => CE.score(a), /s_cry/);
});

test('link tags are cleaned up, and anything odd is dropped', () => {
  assert.equal(CE.readRef('?ref=Instagram'), 'instagram');
  assert.equal(CE.readRef('?utm_source=x&ref=linkedin_dm'), 'linkedin_dm');
  assert.equal(CE.readRef('?ref=%3Cscript%3E'), null);
  assert.equal(CE.readRef('?ref=' + 'a'.repeat(31)), null);
  assert.equal(CE.readRef(''), null);
});

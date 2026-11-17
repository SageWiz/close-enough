// Run with: node --test   (from the repo root)
const test = require('node:test');
const assert = require('node:assert/strict');
const CE = require('../quiz-core.js');
const DEEP = require('../deep-core.js');

// a full set of answers: ring questions get `ring`, feeling questions get `feel`, ladder gets `ladder`
function answers(o) {
  const a = { c_rank: o.order || [1, 2, 3, 4, 5] };
  DEEP.LADDER.forEach(q => { a[q.id] = typeof o.ladder === 'function' ? o.ladder(q) : (o.ladder ?? 2); });
  DEEP.SCORED.forEach(q => { a[q.id] = q.type === 'ring' ? (typeof o.ring === 'function' ? o.ring(q) : o.ring) : (typeof o.feel === 'function' ? o.feel(q) : o.feel); });
  DEEP.TWINS.forEach(t => { a[t.id] = a[t.twinOf]; });
  a.k_attention = DEEP.posOf(a.c_rank, 3);
  return a;
}
const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('the long version has 52 questions, and its 32 scored ones include the quick 20', () => {
  assert.equal(DEEP.ALL.length, 52);
  assert.equal(new Set(DEEP.ALL.map(q => q.id)).size, 52);
  assert.equal(DEEP.SCORED.length, 32);
  assert.equal(DEEP.SCORED.filter(q => q.axis === 'share').length, 16);
  assert.equal(DEEP.SCORED.filter(q => q.axis === 'touch').length, 16);
  CE.QUESTIONS.forEach(q => assert.ok(DEEP.SCORED.some(d => d.id === q.id && d.q === q.q), q.id));
});

test('every touch question points at a rung of the touch ladder', () => {
  const rungs = new Set(DEEP.LADDER.map(q => q.touch));
  DEEP.SCORED.filter(q => q.axis === 'touch').forEach(q => {
    assert.ok(rungs.has(q.touch), q.id);
    assert.ok(['give', 'receive'].includes(q.dir), q.id);
    assert.ok(['hello', 'comfort'].includes(q.ctx), q.id);
  });
  DEEP.SCORED.filter(q => q.axis === 'share').forEach(q => {
    assert.ok(['surface', 'personal', 'deep'].includes(q.tier), q.id);
    assert.ok(['tell', 'access'].includes(q.kind), q.id);
  });
});

test('all lowest and all highest answers hit 0 and 100', () => {
  const lo = DEEP.score(answers({ ring: 0, feel: 0 }));
  assert.equal(lo.x, 0); assert.equal(lo.y, 0); assert.equal(lo.yRaw, 0);
  assert.equal(lo.quadrant, 'vault');
  const hi = DEEP.score(answers({ ring: 6, feel: 4 }));
  assert.equal(hi.x, 100); assert.equal(hi.y, 100);
  assert.equal(hi.quadrant, 'hugger');
  assert.deepEqual(hi.shareGroups, [100, 100, 100, 100, 100, 100]);
  assert.equal(hi.xMargin, 0);                 // no spread between questions, no margin
});

test('the middle answer everywhere is 50 / 50, same as the quick quiz', () => {
  const s = DEEP.score(answers({ ring: 3, feel: 2 }));
  assert.equal(s.x, 50); assert.equal(s.y, 50); assert.equal(s.quadrant, 'middle');
  assert.deepEqual(s.short, { x: 50, y: 50, quadrant: 'middle' });
  assert.equal(s.shareMedian, 3);
});

test('the quick-quiz score inside a long run matches quiz-core exactly', () => {
  const rnd = seeded(11);
  const a = answers({ ring: () => Math.floor(rnd() * 7), feel: () => Math.floor(rnd() * 5) });
  const quick = CE.score(Object.fromEntries(CE.QUESTIONS.map(q => [q.id, a[q.id]])));
  const s = DEEP.score(a);
  assert.deepEqual(s.short, { x: quick.x, y: quick.y, quadrant: quick.quadrant });
});

test('the touch ladder weights touch: openness on touch you rate as close counts more', () => {
  // open only on hugs (6), closed on everything else (0)
  const ring = q => q.axis === 'touch' ? (q.touch === 'hug' ? 6 : 0) : 3;
  const feel = q => q.touch === 'hug' ? 4 : 0;
  const flat = DEEP.score(answers({ ring, feel, ladder: 2 }));
  const hugsClose = DEEP.score(answers({ ring, feel, ladder: q => q.touch === 'hug' ? 4 : 0 }));
  const hugsNothing = DEEP.score(answers({ ring, feel, ladder: q => q.touch === 'hug' ? 0 : 4 }));
  assert.equal(flat.y, flat.yRaw);             // equal ratings = equal weights = the plain average
  assert.ok(hugsClose.y > flat.y);
  assert.ok(hugsNothing.y < flat.y);
  assert.equal(hugsClose.yRaw, flat.yRaw);     // the raw score never moves
  // by hand: 5 hug questions at 1, 11 others at 0. Weights 5 and 1 -> 25 / 36
  assert.equal(hugsClose.y, Math.round(25 / 36 * 100));
});

test('a personal ring order moves the attention check and nothing else', () => {
  const order = [2, 1, 3, 5, 4];               // close friends first, acquaintances ahead of coworkers
  const a = answers({ order, ring: 3, feel: 2 });
  assert.equal(a.k_attention, 3);              // friends are still third here
  const flipped = answers({ order: [3, 1, 2, 4, 5], ring: 3, feel: 2 });
  assert.equal(flipped.k_attention, 1);        // friends first: the right answer is ring 1
  assert.equal(DEEP.score(flipped).attention, true);
  flipped.k_attention = 3;
  assert.ok(DEEP.score(flipped).flags.includes('attention'));
  assert.equal(DEEP.posOf(order, 5), 4);
  assert.equal(DEEP.posOf(order, 6), 6);
  assert.deepEqual(DEEP.personalRings(order).groups, ['Nobody', 'Close friends', 'Family', 'Friends', 'Acquaintances', 'Coworkers', 'Strangers']);
});

test('quality flags', () => {
  const rnd = seeded(5);
  const base = () => answers({ ring: () => 1 + Math.floor(rnd() * 4), feel: () => Math.floor(rnd() * 5) });
  let a = base(); a.s_job = 5; a.s_least_proud = 1; a.t_handshake = 6; a.t_hair = 1;
  a.k_twin_vent = a.s_vent; a.k_twin_hug = a.t_hug_hello;
  assert.deepEqual(DEEP.score(a).flags, []);
  assert.equal(DEEP.score(a).consistency, 100);

  a.k_twin_vent = (a.s_vent + 3) % 7 > a.s_vent ? a.s_vent + 3 : a.s_vent - 3;
  assert.ok(DEEP.score(a).flags.includes('inconsistent'));
  assert.equal(DEEP.score(a).consistency, 75);      // diffs 3 and 0 -> mean 1.5 of 6

  a = base(); a.s_job = 1; a.s_least_proud = 4; a.t_handshake = 6; a.t_hair = 1;
  a.k_twin_vent = a.s_vent; a.k_twin_hug = a.t_hug_hello;
  assert.deepEqual(DEEP.score(a).flags, ['anchors']);

  assert.ok(DEEP.score(answers({ ring: 2, feel: 2 })).flags.includes('same_answer'));
});

test('missing answers are errors, missing checks are not', () => {
  const a = answers({ ring: 2, feel: 2 });
  delete a.k_attention; delete a.k_twin_hug; delete a.k_twin_vent;
  const s = DEEP.score(a);
  assert.equal(s.attention, null); assert.equal(s.consistency, null);
  delete a.l_hug;
  assert.throws(() => DEEP.score(a), /l_hug/);
});

test('question order: circles, ladder, questions, about you', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const st = DEEP.stack({ random: seeded(seed) });
    assert.equal(st.length, 52);
    assert.equal(new Set(st.map(q => q.id)).size, 52);
    assert.equal(st[0].id, 'c_rank');
    assert.deepEqual(st.map(q => q.part), [...Array(6).fill(1), ...Array(9).fill(2), ...Array(35).fill(3), 4, 4]);
    const at = id => st.findIndex(q => q.id === id);
    // a repeat comes well after its original
    DEEP.TWINS.forEach(t => assert.ok(at(t.id) - at(t.twinOf) >= 8, `seed ${seed}: ${t.id} is ${at(t.id) - at(t.twinOf)} after its original`));
  }
});

test('carried over from the quick quiz: the 20 are skipped, 32 are asked', () => {
  const st = DEEP.stack({ carried: true, random: seeded(3) });
  assert.equal(st.length, 32);
  assert.ok(st.every(q => !DEEP.ORIGINAL_IDS.has(q.id)));
  assert.equal(st.filter(q => q.part === 3).length, 15);
});

test('quadrants can use the typical person as the center', () => {
  assert.equal(DEEP.quadrant(40, 45), 'vault');
  assert.equal(DEEP.quadrant(40, 45, { x: 30, y: 40 }), 'hugger');
  assert.equal(DEEP.quadrant(34, 44, { x: 30, y: 40 }), 'middle');
  const n = DEEP.norms(Array.from({ length: 31 }, (_, i) => ({ personal: i, touchy: 60 - i })));
  assert.equal(n.ready, true); assert.deepEqual(n.centers, { x: 15, y: 45 });
  assert.equal(DEEP.norms([{ personal: 1, touchy: 2 }]).ready, false);
});

test('group statistics', () => {
  const S = DEEP.stats;
  assert.equal(S.percentile([10, 20, 30, 40], 30), 63);          // 2 below, 1 tie -> 2.5 of 4
  assert.equal(S.percentile([], 5), null);
  assert.ok(Math.abs(S.pearson([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-9);
  assert.ok(Math.abs(S.pearson([1, 2, 3, 4], [8, 6, 4, 2]) + 1) < 1e-9);
  // textbook check: three perfectly parallel items -> alpha 1
  assert.ok(Math.abs(S.alpha([[1, 1, 1], [2, 2, 2], [3, 3, 3], [5, 5, 5]]) - 1) < 1e-9);
  // by hand: item variances 1, 1, 1 (sum 3), total variance 3 -> alpha = 1.5 * (1 - 3/3) = 0
  assert.ok(Math.abs(S.alpha([[1, 2, 3], [2, 3, 1], [3, 1, 2]])) < 1e-9);
  assert.ok(S.skew([1, 1, 1, 2, 2, 3, 9]) > 1);
  assert.ok(Math.abs(S.skew([1, 2, 3, 4, 5])) < 1e-9);
  assert.equal(DEEP.isRushed(60000, 52), true);                  // 52 questions in a minute
  assert.equal(DEEP.isRushed(60000, 20), false);
});

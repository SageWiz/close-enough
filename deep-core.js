/*
 * Close Enough: the long version (deep-v1)
 * ------------------------------------------------------------------
 * Sits on top of quiz-core.js. The quick quiz is untouched: this file only adds.
 *
 *   1. calibration questions: your circles, and what counts as close touch
 *   2. the 32 scored questions (the quick quiz's 20, plus 12 new ones)
 *   3. check questions: two reworded repeats and one attention check
 *   4. the scoring math (METHODOLOGY-DEEP.md has the plain-English version)
 *   5. group statistics the stats page uses (reliability, percentiles, skew)
 *   6. saving and reading anonymous long-version results
 *
 * Works in the browser (window.CloseEnoughDeep) and in Node (require).
 */
(function (root) {
  'use strict';

  const CE = (typeof module !== 'undefined' && module.exports) ? require('./quiz-core.js') : root.CloseEnough;
  const { RINGS, SCALE_MAX } = CE;

  const VERSION = 'deep-v1';
  const STANDARD_ORDER = [1, 2, 3, 4, 5];   // family, close friends, friends, coworkers, acquaintances
  const MIN_NORM = 30;                       // people needed before "compared with everyone" switches on
  const MIDDLE_BAND = 8;                     // same "right down the middle" band as the quick quiz
  const RUSH_MS_PER_QUESTION = 2250;         // the quick quiz's 45 seconds for 20 questions, per question

  const PARTS = [
    null,
    { name: 'Your circles',         note: "These set the quiz up around you. They don't count toward your score." },
    { name: 'What counts as close', note: "Rate the touch itself, not who it's with. It decides how much each kind of touch counts for you." },
    { name: 'The questions',        note: 'Same idea as the quick version, with the rings in your order.' },
    { name: 'About you',            note: 'Two optional questions. Skip either one.' }
  ];

  /* ---------- 1. calibration ---------- */

  // Your circles. c_rank puts the rings in the person's own order. The rest describe what
  // the rings mean to them, and are used to explain the group results, not to score anyone.
  const CIRCLES = [
    { id: 'c_rank', type: 'rank', short: 'Ring order',
      q: 'Put these five in order, closest to you first.' },
    { id: 'c_family_def', type: 'choice', short: 'What "family" means',
      q: 'When you say "family," who do you mostly mean?',
      options: ['The people I grew up with', 'Relatives, extended family included', 'The family I made or chose', 'A mix of all of those'] },
    { id: 'c_partner', type: 'choice', short: 'Where a partner fits',
      q: 'Where does a partner fit for you?',
      options: ['Part of family', 'Closer than family', 'Their own thing, outside the rings', "I don't have one right now"] },
    { id: 'c_close_count', type: 'choice', short: 'Number of close friends',
      q: "How many people would you call close friends? The ones you'd call at 2am.",
      options: ['None right now', '1 or 2', '3 to 5', '6 to 10', 'More than 10'] },
    { id: 'c_work_friend', type: 'choice', short: 'Closest person at work',
      q: "Think of the person you're closest to at work. Which ring are they really in?",
      options: ['Close friends', 'Friends', 'Coworkers', "I don't work with other people right now"] },
    { id: 'c_friend_line', type: 'choice', short: 'What makes a friend',
      q: 'What moves someone from acquaintance to friend for you?',
      options: ['We make plans to hang out', 'We talk about real stuff', "We've known each other a long time", "We'd show up for each other"] }
  ].map(o => ({ ...o, part: 1 }));

  // The touch ladder: how close each kind of touch feels, 0..4. Each touch question below
  // points at one of these, and the rating becomes that question's weight.
  const LADDER_SCALE = ['Nothing to it', 'Casual', 'Friendly', 'Close', 'Very close'];
  const LADDER = [
    { touch: 'shake', short: 'Handshake or high five', q: 'A handshake or a high five' },
    { touch: 'pat',   short: 'Pat on the back',        q: 'A pat on the back' },
    { touch: 'arm',   short: 'Hand on arm or shoulder', q: 'A hand on the arm or shoulder' },
    { touch: 'hug',   short: 'Full hug',               q: 'A full hug' },
    { touch: 'kiss',  short: 'Cheek kiss hello',       q: 'A kiss on the cheek to say hello' },
    { touch: 'hands', short: 'Holding hands',          q: 'Holding hands' },
    { touch: 'head',  short: 'Head on a shoulder',     q: 'Resting a head on a shoulder' },
    { touch: 'hair',  short: 'Playing with hair',      q: "Playing with someone's hair" },
    { touch: 'rub',   short: 'Back rub',               q: 'A back rub' }
  ].map(o => ({ ...o, id: 'l_' + o.touch, type: 'scale', labels: LADDER_SCALE, part: 2,
    kicker: 'How close does this kind of touch feel to you?' }));

  /* ---------- 2. scored questions ---------- */

  // What the long version knows about the quick quiz's 20 questions.
  // tier: how deep the sharing goes. kind: telling someone something vs letting them into your space or stuff.
  // touch: which ladder rung the question is about. ctx: saying hello vs comfort and affection.
  const ORIGINAL_META = {
    s_cry:           { tier: 'deep',     kind: 'tell' },
    s_love_life:     { tier: 'deep',     kind: 'tell' },
    s_stay_over:     { tier: 'personal', kind: 'access' },
    s_sit_close:     { tier: 'surface',  kind: 'access' },
    s_honest_answer: { tier: 'personal', kind: 'tell' },
    s_insecure:      { tier: 'deep',     kind: 'tell' },
    s_vent:          { tier: 'personal', kind: 'tell' },
    s_camera_roll:   { tier: 'personal', kind: 'access' },
    s_where_live:    { tier: 'surface',  kind: 'access' },
    s_drop_by:       { tier: 'personal', kind: 'access' },
    t_hug_hello:     { touch: 'hug',   ctx: 'hello' },
    t_hair:          { touch: 'hair',  ctx: 'comfort' },
    t_head_shoulder: { touch: 'head',  ctx: 'comfort' },
    t_cheek_kiss:    { touch: 'kiss',  ctx: 'hello' },
    t_hold_hands:    { touch: 'hands', ctx: 'comfort' },
    f_party_hug:     { touch: 'hug',   ctx: 'hello' },
    f_touch_arm:     { touch: 'arm',   ctx: 'comfort' },
    f_coworker_pat:  { touch: 'pat',   ctx: 'hello' },
    f_first_hug:     { touch: 'hug',   ctx: 'hello' },
    f_back_rub:      { touch: 'rub',   ctx: 'comfort' }
  };
  const ORIGINALS = CE.QUESTIONS.map(q => ({ ...q, ...ORIGINAL_META[q.id], original: true }));

  // The 12 new ones. The quick quiz's questions are all on the guarded end, so several of
  // these are easy on purpose: a scale needs easy questions as much as hard ones.
  const NEW_SHARE = [
    { id: 's_job',          tier: 'surface',  kind: 'tell',   short: 'What you do for work',  q: 'Who can know what you do for a living?' },
    { id: 's_socials',      tier: 'surface',  kind: 'access', short: 'Follow your socials',   q: 'Who can follow your personal social media?' },
    { id: 's_weekend',      tier: 'surface',  kind: 'tell',   short: 'Your real weekend',     q: 'Who hears what you actually did over the weekend?' },
    { id: 's_ask_favor',    tier: 'personal', kind: 'access', short: 'Ask for a big favor',   q: 'Who would you ask for a ride to the airport at 5am?' },
    { id: 's_family_stuff', tier: 'deep',     kind: 'tell',   short: 'Hard family stuff',     q: "Who knows about the hard stuff going on in your family?" },
    { id: 's_least_proud',  tier: 'deep',     kind: 'tell',   short: "What you're least proud of", q: "Who knows about the thing you're least proud of?" }
  ].map(o => ({ ...o, axis: 'share', type: 'ring' }));

  const NEW_TOUCH_WHO = [
    { id: 't_handshake',     dir: 'receive', touch: 'shake', ctx: 'hello',   short: 'Shake your hand',     q: 'Who can shake your hand?' },
    { id: 't_give_hug_bye',  dir: 'give',    touch: 'hug',   ctx: 'hello',   short: 'You hug goodbye',     q: 'Who do you hug when you say goodbye?' },
    { id: 't_give_shoulder', dir: 'give',    touch: 'arm',   ctx: 'comfort', short: 'Your hand on their shoulder', q: "Who would you put a hand on the shoulder of when they're upset?" }
  ].map(o => ({ ...o, axis: 'touch', type: 'ring' }));

  const NEW_TOUCH_FEEL = [
    { id: 'f_lean_sleep',  dir: 'receive', who: 2, touch: 'head',  ctx: 'comfort', short: 'Friend asleep on you',   q: 'A close friend falls asleep leaning on you during a movie.' },
    { id: 'f_comfort_acq', dir: 'give',    who: 5, touch: 'hug',   ctx: 'comfort', short: 'Hug an acquaintance',    q: "Hugging an acquaintance who's having a rough day." },
    { id: 'f_high_five',   dir: 'give',    who: 6, touch: 'shake', ctx: 'hello',   short: 'High five a stranger',   q: 'High-fiving a stranger at a game or a concert.' }
  ].map(o => ({ ...o, axis: 'touch', type: 'scale' }));

  const SCORED = [...ORIGINALS, ...NEW_SHARE, ...NEW_TOUCH_WHO, ...NEW_TOUCH_FEEL].map(o => ({ ...o, part: 3 }));
  const ORIGINAL_IDS = new Set(ORIGINALS.map(q => q.id));

  /* ---------- 3. checks and background ---------- */

  // Not scored. The twins ask a scored question again in different words, and the attention
  // check has one right answer.
  const TWINS = [
    { id: 'k_twin_vent', twinOf: 's_vent',      axis: 'share', short: 'Repeat: venting',  q: 'Who do you go to when you need to get something off your chest?' },
    { id: 'k_twin_hug',  twinOf: 't_hug_hello', axis: 'touch', short: 'Repeat: hug hello', q: 'Who can greet you with a hug?' }
  ].map(o => ({ ...o, type: 'ring', check: 'twin', part: 3 }));
  const ATTENTION = { id: 'k_attention', type: 'ring', check: 'attention', expect: 3, part: 3,
    short: 'Attention check', q: "Quick check that you're still reading. Pick Friends for this one." };

  // Optional. Saved in their own columns, which the public can't read row by row.
  const AGES = ['u18', '18-24', '25-34', '35-44', '45-54', '55+'];
  const GENDERS = ['woman', 'man', 'nonbinary', 'other'];
  const ABOUT = [
    { id: 'd_age', keys: AGES, short: 'Age', q: 'How old are you?',
      options: ['Under 18', '18 to 24', '25 to 34', '35 to 44', '45 to 54', '55 or older'] },
    { id: 'd_gender', keys: GENDERS, short: 'Gender', q: "What's your gender?",
      options: ['Woman', 'Man', 'Nonbinary', 'Something else'] }
  ].map(o => ({ ...o, type: 'choice', optional: true, part: 4,
    kicker: "Optional. It helps explain the group results. Skip it if you'd rather not." }));

  const ALL = [...CIRCLES, ...LADDER, ...SCORED, ...TWINS, ATTENTION, ...ABOUT];
  const BY_ID = Object.fromEntries(ALL.map(q => [q.id, q]));

  /** The highest answer value a question can take. */
  function maxOf(q) {
    if (q.type === 'ring') return RINGS;
    if (q.type === 'scale') return SCALE_MAX;
    if (q.type === 'choice') return q.options.length - 1;
    return null;
  }

  /* ---------- question order ---------- */

  function interleave(share, who, feel) {
    const touch = [];
    for (let i = 0; i < Math.max(who.length, feel.length); i++) {
      if (who[i]) touch.push(who[i]);
      if (feel[i]) touch.push(feel[i]);
    }
    const out = [];
    for (let i = 0; i < Math.max(share.length, touch.length); i++) {
      if (share[i]) out.push(share[i]);
      if (touch[i]) out.push(touch[i]);
    }
    return out;
  }

  /**
   * One run of the long version, in order.
   * Circles first (fixed order, since the ranking has to come before any ring question),
   * then the touch ladder (shuffled), then the scored questions (shuffled, same rhythm as
   * the quick quiz), then the two optional background questions.
   *
   * @param {{carried?: boolean, random?: () => number}} [opts]
   *   carried: the person just finished the quick quiz, so its 20 questions are left out.
   */
  function stack(opts) {
    const o = opts || {};
    const rnd = o.random || Math.random;
    const shuffle = arr => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    };
    // a repeated question only works if its original was a while ago, so the original goes in the first half
    const toFirstHalf = (arr, id) => {
      const at = arr.findIndex(q => q.id === id);
      if (at < 0) return arr;
      const to = Math.floor(rnd() * Math.ceil(arr.length / 2));
      const a = [...arr]; [a[at], a[to]] = [a[to], a[at]];
      return a;
    };
    const pick = f => shuffle(SCORED.filter(q => f(q) && !(o.carried && q.original)));
    const share = toFirstHalf(pick(q => q.axis === 'share'), 's_vent');
    const who = toFirstHalf(pick(q => q.axis === 'touch' && q.type === 'ring'), 't_hug_hello');
    const feel = pick(q => q.axis === 'touch' && q.type === 'scale');

    const main = interleave(share, who, feel);
    main.splice(Math.round(main.length * 0.6), 0, ATTENTION);
    const twins = shuffle(TWINS);
    main.splice(main.length - Math.floor(rnd() * 2), 0, twins[0]);          // last or second to last
    main.splice(main.length - 4 - Math.floor(rnd() * 2), 0, twins[1]);      // a few questions earlier

    return [...CIRCLES, ...shuffle(LADDER), ...main, ...ABOUT];
  }

  /* ---------- rings in a personal order ---------- */

  const validOrder = o => Array.isArray(o) && o.length === 5 && STANDARD_ORDER.every(g => o.includes(g));
  /** Where one of the usual groups (1..6) sits in this person's order. Strangers are always 6. */
  const posOf = (order, g) => g >= 6 ? 6 : g <= 0 ? 0 : order.indexOf(g) + 1;
  const isStandard = order => order.every((g, i) => g === STANDARD_ORDER[i]);
  /** Ring names and descriptions, re-ordered: index 0 is Nobody, 6 is Strangers. */
  function personalRings(order) {
    const idx = [0, ...order, 6];
    return { groups: idx.map(g => CE.GROUPS[g]), defs: idx.map(g => CE.DEFS[g]) };
  }

  /* ---------- 4. scoring ---------- */

  const sum = a => a.reduce((s, v) => s + v, 0);
  const mean = a => a.length ? sum(a) / a.length : 0;
  const pct = v => Math.round(v * 100);
  const lowerMedian = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
  const wmean = rows => sum(rows.map(r => r.w * r.n)) / sum(rows.map(r => r.w));
  /**
   * Standard error of a weighted mean across questions: how much the score would move if a
   * different set of similar questions had been asked. Returned in 0..1 units.
   */
  function wse(rows) {
    const k = rows.length;
    if (k < 2) return 0;
    const m = wmean(rows), W = sum(rows.map(r => r.w));
    return Math.sqrt(sum(rows.map(r => (r.w * (r.n - m)) ** 2)) * k / (k - 1)) / W;
  }
  const Z90 = 1.645;

  /**
   * Which corner a score lands in. Same corners as the quick quiz, but the center lines can
   * move to where the typical person is, once enough people have taken the long version.
   */
  function quadrant(x, y, centers) {
    const c = centers || { x: 50, y: 50 };
    if (Math.abs(x - c.x) <= MIDDLE_BAND && Math.abs(y - c.y) <= MIDDLE_BAND) return 'middle';
    if (x >= c.x) return y >= c.y ? 'hugger' : 'open';
    return y >= c.y ? 'warm' : 'vault';
  }

  /**
   * Score a finished long version.
   * @param {Object} byId answers keyed by question id. Ring answers are levels 0..6 in the
   *        person's own ring order, feeling and ladder answers are 0..4, c_rank is the order
   *        itself (five group numbers, closest first). Missing c_rank means the usual order.
   */
  function score(byId) {
    const order = validOrder(byId.c_rank) ? byId.c_rank.slice() : STANDARD_ORDER.slice();
    const need = q => {
      const a = byId[q.id];
      if (typeof a !== 'number') throw new Error(`Missing answer for ${q.id}`);
      return a;
    };

    const ladder = {};
    LADDER.forEach(q => { ladder[q.touch] = need(q); });

    // every scored answer on a 0..1 footing, with its weight (touch only: 1 + the ladder rating, so 1..5)
    const rows = SCORED.map(q => {
      const a = need(q);
      return { q, a, n: a / maxOf(q), w: q.axis === 'touch' ? 1 + ladder[q.touch] : 1 };
    });
    const share = rows.filter(r => r.q.axis === 'share');
    const touch = rows.filter(r => r.q.axis === 'touch');
    const touchWho = touch.filter(r => r.q.type === 'ring');
    const plain = list => pct(mean(list.map(r => r.n)));
    const where = (list, key, val) => list.filter(r => r.q[key] === val);

    const x = pct(wmean(share));
    const y = pct(wmean(touch));
    const reach = (list, k) => pct(list.filter(r => r.a >= k).length / list.length);
    const levels = [1, 2, 3, 4, 5, 6];

    // checks
    const twinDiffs = TWINS.map(t => (typeof byId[t.id] === 'number' && typeof byId[t.twinOf] === 'number')
      ? Math.abs(byId[t.id] - byId[t.twinOf]) : null).filter(d => d !== null);
    const consistency = twinDiffs.length ? pct(1 - mean(twinDiffs) / RINGS) : null;
    const attention = typeof byId[ATTENTION.id] === 'number' ? byId[ATTENTION.id] === posOf(order, ATTENTION.expect) : null;

    const ringAnswers = rows.filter(r => r.q.type === 'ring').map(r => r.a);
    const counts = {}; ringAnswers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
    const sameShare = Math.max(...Object.values(counts)) / ringAnswers.length;

    const flags = [];
    if (attention === false) flags.push('attention');
    if (twinDiffs.length && (Math.max(...twinDiffs) >= 3 || mean(twinDiffs) >= 2)) flags.push('inconsistent');
    if (sameShare >= 0.9) flags.push('same_answer');
    // an easy question answered at least two rings tighter than a hard one
    if (byId.s_least_proud - byId.s_job >= 2 || byId.t_hair - byId.t_handshake >= 2) flags.push('anchors');

    // the same person on the quick quiz's scale (its 20 questions, its math)
    let short = null;
    try { short = CE.score(Object.fromEntries(CE.QUESTIONS.map(q => [q.id, byId[q.id]]))); } catch (e) { /* not all 20 present */ }

    return {
      x, y,
      yRaw: plain(touch),                      // touch before the ladder weights
      xMargin: Math.round(Z90 * wse(share) * 100),
      yMargin: Math.round(Z90 * wse(touch) * 100),
      quadrant: quadrant(x, y),                // against 50 / 50. The pages re-run this against the typical person.
      order,
      shareGroups: levels.map(k => reach(share, k)),       // by ring level, in the person's own order
      touchGroups: levels.map(k => reach(touchWho, k)),
      shareMedian: lowerMedian(share.map(r => r.a)),
      touchMedian: lowerMedian(touchWho.map(r => r.a)),
      receive: plain(where(touch, 'dir', 'receive')),
      give: plain(where(touch, 'dir', 'give')),
      tiers: { surface: plain(where(share, 'tier', 'surface')), personal: plain(where(share, 'tier', 'personal')), deep: plain(where(share, 'tier', 'deep')) },
      tell: plain(where(share, 'kind', 'tell')),
      access: plain(where(share, 'kind', 'access')),
      hello: plain(where(touch, 'ctx', 'hello')),
      comfort: plain(where(touch, 'ctx', 'comfort')),
      ladder,
      consistency, twinDiffs, attention, flags,
      short: short ? { x: short.x, y: short.y, quadrant: short.quadrant } : null
    };
  }

  /** A run this fast is tapping through, not reading. asked = how many questions that run had. */
  const isRushed = (durationMs, asked) => durationMs < RUSH_MS_PER_QUESTION * (asked || ALL.length);

  /* ---------- 5. group statistics ---------- */

  const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const variance = a => { if (a.length < 2) return 0; const m = mean(a); return sum(a.map(v => (v - m) ** 2)) / (a.length - 1); };
  const sd = a => Math.sqrt(variance(a));

  /** Skew: 0 is symmetric, positive means most people sit low with a tail up high. */
  function skew(a) {
    const n = a.length, s = sd(a);
    if (n < 3 || !s) return 0;
    const m = mean(a);
    return (n / ((n - 1) * (n - 2))) * sum(a.map(v => ((v - m) / s) ** 3));
  }

  function pearson(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 3) return null;
    const ma = mean(a), mb = mean(b);
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da && db ? num / Math.sqrt(da * db) : null;
  }

  /**
   * Cronbach's alpha: do the questions on one axis move together?
   * @param {number[][]} matrix one row per person, one column per question
   */
  function alpha(matrix) {
    const n = matrix.length, k = n ? matrix[0].length : 0;
    if (n < 3 || k < 2) return null;
    const totalVar = variance(matrix.map(r => sum(r)));
    if (!totalVar) return null;
    let itemVar = 0;
    for (let j = 0; j < k; j++) itemVar += variance(matrix.map(r => r[j]));
    return (k / (k - 1)) * (1 - itemVar / totalVar);
  }

  /** For each question: how well it tracks the rest of its axis (the question itself left out). */
  function itemRest(matrix) {
    const k = matrix.length ? matrix[0].length : 0;
    return Array.from({ length: k }, (_, j) => pearson(matrix.map(r => r[j]), matrix.map(r => sum(r) - r[j])));
  }

  /** Share of values below v, counting ties as half. 0..100. */
  function percentile(values, v) {
    if (!values.length) return null;
    let below = 0, same = 0;
    values.forEach(o => { if (o < v) below++; else if (o === v) same++; });
    return Math.round((below + same / 2) / values.length * 100);
  }

  /**
   * What "typical" looks like, from a list of scores. ready flips on at MIN_NORM people.
   * @param {{personal:number,touchy:number}[]} rows
   */
  function norms(rows) {
    const xs = rows.map(r => r.personal).filter(v => typeof v === 'number');
    const ys = rows.map(r => r.touchy).filter(v => typeof v === 'number');
    const n = Math.min(xs.length, ys.length);
    return { n, ready: n >= MIN_NORM, xs, ys, centers: { x: Math.round(median(xs)), y: Math.round(median(ys)) } };
  }

  /* ---------- 6. anonymous results ---------- */

  // The public can read every column except age and gender. Those only come back grouped (see schema.sql).
  const PUBLIC_COLUMNS = ['id', 'created_at', 'quiz_version', 'duration_ms', 'answers', 'question_ms', 'question_order',
    'ring_order', 'carried', 'personal', 'touchy', 'touchy_raw', 'short_personal', 'short_touchy', 'quadrant',
    'consistency', 'flags', 'device', 'ref', 'attempt'];

  function api(config) {
    const url = config && config.supabaseUrl ? config.supabaseUrl.replace(/\/$/, '') : '';
    const key = config && config.supabaseKey;
    const enabled = !!(url && key);
    const headers = extra => {
      const h = { apikey: key, 'Content-Type': 'application/json', ...extra };
      if (/^eyJ/.test(key)) h.Authorization = 'Bearer ' + key;
      return h;
    };
    const paged = async (path, onProgress) => {
      const out = [], page = 1000;
      for (let from = 0; ; from += page) {
        const r = await fetch(`${url}/rest/v1/${path}`, { headers: headers({ Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' }) });
        if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status}`);
        const rows = await r.json();
        out.push(...rows);
        if (onProgress) onProgress(out.length);
        if (rows.length < page) return out;
      }
    };

    return {
      enabled,
      saveResponse: row => !enabled ? Promise.resolve() : fetch(`${url}/rest/v1/deep_responses`, {
        method: 'POST', keepalive: true, headers: headers({ Prefer: 'return=minimal' }), body: JSON.stringify(row)
      }).then(r => { if (!r.ok) throw new Error(`deep_responses: ${r.status}`); }),

      /** Every saved long-version response, oldest first, without age or gender. */
      allResponses: onProgress => paged(`deep_responses?select=${PUBLIC_COLUMNS.join(',')}&order=created_at.asc`, onProgress),

      /** Just the scores, for "compared with everyone": long-version rows and quick-quiz rows. */
      deepScores: () => paged('deep_responses?select=personal,touchy,short_personal,short_touchy,attempt,flags&order=created_at.asc'),
      quickScores: () => paged('responses?select=personal,touchy,attempt,duration_ms&order=created_at.asc'),

      /** Group averages by age and by gender. Only groups with at least 5 people come back. */
      demographics: () => fetch(`${url}/rest/v1/rpc/deep_demographics`, { method: 'POST', headers: headers(), body: '{}' })
        .then(r => { if (!r.ok) throw new Error(`deep_demographics: ${r.status}`); return r.json(); }),

      /** How many people started the long version. Same filters as the quick quiz's stats page. */
      async countStarts(filters) {
        const f = filters || {};
        const since = f.since ? `&created_at=gte.${encodeURIComponent(f.since)}` : '';
        const dev = f.device && f.device !== 'all' ? `&device=eq.${f.device}` : '';
        const ref = !f.ref || f.ref === 'all' ? '' : f.ref === 'none' ? '&ref=is.null' : `&ref=eq.${encodeURIComponent(f.ref)}`;
        const r = await fetch(`${url}/rest/v1/events?select=id&type=eq.start&quiz_version=eq.${VERSION}${since}${dev}${ref}`, {
          headers: headers({ Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' })
        });
        if (!r.ok) throw new Error(`events: ${r.status}`);
        const m = (r.headers.get('content-range') || '').match(/\/(\d+)/);
        return m ? +m[1] : 0;
      }
    };
  }

  const CloseEnoughDeep = {
    VERSION, STANDARD_ORDER, MIN_NORM, MIDDLE_BAND, PARTS,
    CIRCLES, LADDER, LADDER_SCALE, SCORED, TWINS, ATTENTION, ABOUT, AGES, GENDERS, ALL, BY_ID, ORIGINAL_IDS,
    maxOf, stack, validOrder, posOf, isStandard, personalRings,
    score, quadrant, isRushed,
    stats: { mean, median, sd, variance, skew, pearson, alpha, itemRest, percentile },
    norms, api, PUBLIC_COLUMNS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CloseEnoughDeep;
  else root.CloseEnoughDeep = CloseEnoughDeep;
})(typeof window !== 'undefined' ? window : globalThis);

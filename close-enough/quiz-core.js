/*
 * Close Enough: quiz core
 * ------------------------------------------------------------------
 * Everything the quiz and the stats dashboard share lives here:
 *   1. the rings and answer scales
 *   2. the 20 questions (each with a stable id, so the stats survive edits)
 *   3. the scoring math (see METHODOLOGY.md for the plain-English version)
 *   4. a tiny client for saving and reading anonymous results (Supabase REST)
 *
 * Works in the browser (window.CloseEnough) and in Node (require / import)
 * so the scoring can be tested on its own.
 */
(function (root) {
  'use strict';

  const VERSION = 'v1';

  /* ---------- 1. rings and scales ---------- */

  // Ring answers: 0 = nobody, 1..6 = rings from the inside out.
  const GROUPS = ['Nobody', 'Family', 'Close friends', 'Friends', 'Coworkers', 'Acquaintances', 'Strangers'];
  const DEFS = [
    'Keeping this one to myself',
    'Parents, siblings, a partner, the people you call family',
    "Your inner few. The ones you'd call at 2am",
    'People you make plans with, but not your inner circle',
    "Friendly at work, but you don't really hang out outside it",
    'You know their name. Neighbors, friends of friends, the gym regular',
    "Someone you just met, or don't know at all"
  ];
  const RINGS = 6;                 // highest ring value

  // Feeling answers: 0..4
  const SCALE = ['Hard no', 'Rather not', 'Depends', 'Fine by me', 'Love it'];
  const SCALE_MAX = 4;

  /* ---------- 2. questions ---------- */
  // axis:  'share' feeds How personal, 'touch' feeds How touchy
  // type:  'ring' (pick the widest ring) or 'scale' (Hard no .. Love it)
  // dir:   touch direction, 'receive' or 'give'

  const SHARE = [
    { id: 's_cry',           short: 'See you cry',              q: 'Who can see you cry?' },
    { id: 's_love_life',     short: 'Love life details',        q: 'Who gets the details of your love life?' },
    { id: 's_stay_over',     short: 'Stay over',                q: 'Who can stay over at your place for a night?' },
    { id: 's_sit_close',     short: 'Sit right next to you',    q: "Who can sit right next to you when there's plenty of room elsewhere?" },
    { id: 's_honest_answer', short: 'The honest "how are you"', q: "Who gets the honest answer when they ask how you're doing?" },
    { id: 's_insecure',      short: 'Your insecurities',        q: "Who knows what you're insecure about?" },
    { id: 's_vent',          short: 'Venting',                  q: "Who would you vent to about something that's really bothering you?" },
    { id: 's_camera_roll',   short: 'Camera roll',              q: 'Who can scroll through your camera roll?' },
    { id: 's_where_live',    short: 'Where you live',           q: 'Who can know where you live?' },
    { id: 's_drop_by',       short: 'Drop by unannounced',      q: 'Who can drop by your place without texting first?' }
  ].map(o => ({ ...o, axis: 'share', type: 'ring' }));

  const TOUCH_WHO = [
    { id: 't_hug_hello',     short: 'Hug hello',          q: 'Who can hug you hello?' },
    { id: 't_hair',          short: 'Touch your hair',    q: 'Who can touch or play with your hair?' },
    { id: 't_head_shoulder', short: 'Head on shoulder',   q: 'Who can rest their head on your shoulder?' },
    { id: 't_cheek_kiss',    short: 'Cheek kiss hello',   q: 'Who can greet you with a kiss on the cheek?' },
    { id: 't_hold_hands',    short: 'Hold hands',         q: "Who can hold hands with you while you're walking?" }
  ].map(o => ({ ...o, axis: 'touch', type: 'ring', dir: 'receive' }));

  const TOUCH_FEEL = [
    { id: 'f_party_hug',    dir: 'receive', short: 'Party goodbye hug',   q: 'Someone you met an hour ago at a party hugs you goodbye.' },
    { id: 'f_touch_arm',    dir: 'give',    short: 'Touch arm talking',   q: "Touching a friend's arm or shoulder while you're talking to them." },
    { id: 'f_coworker_pat', dir: 'receive', short: 'Coworker back pat',   q: 'A coworker gives you a quick pat on the back after a good meeting.' },
    { id: 'f_first_hug',    dir: 'give',    short: 'First to hug',        q: 'Being the first to go in for a hug when you see your friends.' },
    { id: 'f_back_rub',     dir: 'give',    short: 'Back rub for a friend', q: "Rubbing a close friend's back when they're stressed out." }
  ].map(o => ({ ...o, axis: 'touch', type: 'scale' }));

  // Order: sharing and touch alternate; touch alternates "who can" and "how do you feel".
  const touchOrder = [];
  for (let i = 0; i < Math.max(TOUCH_WHO.length, TOUCH_FEEL.length); i++) {
    if (TOUCH_WHO[i]) touchOrder.push(TOUCH_WHO[i]);
    if (TOUCH_FEEL[i]) touchOrder.push(TOUCH_FEEL[i]);
  }
  const QUESTIONS = [];
  for (let i = 0; i < SHARE.length; i++) {
    QUESTIONS.push(SHARE[i]);
    if (touchOrder[i]) QUESTIONS.push(touchOrder[i]);
  }

  const QUADS = {
    vault:  { name: 'The Vault', short: 'The vault',
              desc: "You keep most things to a small group and you'd rather keep your hands to yourself. The people who get in have earned it." },
    open:   { name: 'Open Book, Hands Off', short: 'Open book, hands off',
              desc: "You'll talk to almost anyone about almost anything, but a hug from someone you barely know is a lot. Words yes, contact not so much." },
    warm:   { name: "Warm Once You're In", short: "Warm once you're in",
              desc: "Physical affection comes easy to you, but you're choosy about who hears the real stuff. Hugs are cheap, secrets are not." },
    hugger: { name: 'Hugs Hello', short: 'Hugs hello',
              desc: "You're open with pretty much everyone and you show it physically. People leave a five minute conversation with you feeling like old friends." },
    middle: { name: 'Right Down the Middle', short: 'Right down the middle',
              desc: "You read the room. Depending on who it is and what's going on, you can go either way on sharing and on touch." }
  };

  /* ---------- 3. scoring ---------- */

  const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  const pct = v => Math.round(v * 100);
  // lower median: for an even count, the lower of the two middle values
  const lowerMedian = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]; };

  /**
   * Score a finished quiz.
   * @param {Object<string, number>} byId  answers keyed by question id
   *        ring questions: 0..6, scale questions: 0..4
   * @returns {{x:number,y:number,quadrant:string,shareGroups:number[],touchGroups:number[],
   *            shareMedian:number,touchMedian:number,receive:number,give:number}}
   */
  function score(byId) {
    const share = [], touchWho = [], touchNorm = [], give = [], receive = [];
    QUESTIONS.forEach(q => {
      const a = byId[q.id];
      if (typeof a !== 'number') throw new Error(`Missing answer for ${q.id}`);
      if (q.axis === 'share') {
        share.push(a);
      } else if (q.type === 'ring') {
        touchWho.push(a);
        touchNorm.push(a / RINGS);
        receive.push(a / RINGS);
      } else {
        touchNorm.push(a / SCALE_MAX);
        (q.dir === 'give' ? give : receive).push(a / SCALE_MAX);
      }
    });

    // How personal: average sharing ring, as a share of the widest ring
    const x = pct(mean(share) / RINGS);
    // How touchy: every touch answer scaled to 0..1, then averaged
    const y = pct(mean(touchNorm));
    // Who gets in: for ring k, the share of questions where the answer reached ring k
    const reach = (arr, k) => pct(arr.filter(v => v >= k).length / arr.length);

    return {
      x, y,
      quadrant: quadrant(x, y),
      shareGroups: GROUPS.slice(1).map((_, i) => reach(share, i + 1)),
      touchGroups: GROUPS.slice(1).map((_, i) => reach(touchWho, i + 1)),
      shareMedian: lowerMedian(share),
      touchMedian: lowerMedian(touchWho),
      receive: pct(mean(receive)),
      give: pct(mean(give))
    };
  }

  /** Which corner of the chart a score lands in. Within 8 points of center on both axes = middle. */
  function quadrant(x, y) {
    if (Math.abs(x - 50) <= 8 && Math.abs(y - 50) <= 8) return 'middle';
    if (x >= 50) return y >= 50 ? 'hugger' : 'open';
    return y >= 50 ? 'warm' : 'vault';
  }

  /* ---------- 4. anonymous results (Supabase REST, no SDK) ---------- */

  function api(config) {
    const url = config && config.supabaseUrl ? config.supabaseUrl.replace(/\/$/, '') : '';
    const key = config && config.supabaseKey;
    const enabled = !!(url && key);
    const headers = extra => {
      const h = { apikey: key, 'Content-Type': 'application/json', ...extra };
      if (/^eyJ/.test(key)) h.Authorization = 'Bearer ' + key;   // legacy anon keys are JWTs
      return h;
    };
    const post = (table, body) => fetch(`${url}/rest/v1/${table}`, {
      method: 'POST', keepalive: true,
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(body)
    }).then(r => { if (!r.ok) throw new Error(`${table}: ${r.status}`); });

    return {
      enabled,
      saveResponse: row => enabled ? post('responses', row) : Promise.resolve(),
      logEvent: (type, extra) => enabled ? post('events', { type, quiz_version: VERSION, ...(extra || {}) }) : Promise.resolve(),

      /** Every saved response, oldest first, fetched 1000 at a time. */
      async allResponses(onProgress) {
        const out = [], page = 1000;
        for (let from = 0; ; from += page) {
          const r = await fetch(`${url}/rest/v1/responses?select=*&order=created_at.asc`, {
            headers: headers({ Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' })
          });
          if (!r.ok) throw new Error(`responses: ${r.status}`);
          const rows = await r.json();
          out.push(...rows);
          if (onProgress) onProgress(out.length);
          if (rows.length < page) return out;
        }
      },

      /** How many events of a type exist (uses PostgREST's exact count). */
      /** filters: { since: ISO date, device: 'mobile'|'desktop', ref: a tag, or 'none' for untagged } */
      async countEvents(type, filters) {
        const f = filters || {};
        const since = f.since ? `&created_at=gte.${encodeURIComponent(f.since)}` : '';
        const dev = f.device && f.device !== 'all' ? `&device=eq.${f.device}` : '';
        const ref = !f.ref || f.ref === 'all' ? '' : f.ref === 'none' ? '&ref=is.null' : `&ref=eq.${encodeURIComponent(f.ref)}`;
        const r = await fetch(`${url}/rest/v1/events?select=id&type=eq.${type}${since}${dev}${ref}`, {
          headers: headers({ Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' })
        });
        if (!r.ok) throw new Error(`events: ${r.status}`);
        const m = (r.headers.get('content-range') || '').match(/\/(\d+)/);
        return m ? +m[1] : 0;
      }
    };
  }

  /**
   * The link tag, from ?ref=instagram style links. Lowercase letters, numbers, - and _,
   * up to 30 characters. Anything else is ignored.
   */
  function readRef(search) {
    try {
      const raw = new URLSearchParams(search || '').get('ref');
      const ref = (raw || '').trim().toLowerCase();
      return /^[a-z0-9_-]{1,30}$/.test(ref) ? ref : null;
    } catch (e) { return null; }
  }

  const CloseEnough = { VERSION, readRef, GROUPS, DEFS, RINGS, SCALE, SCALE_MAX, QUESTIONS, QUADS, score, quadrant, api };

  if (typeof module !== 'undefined' && module.exports) module.exports = CloseEnough;
  else root.CloseEnough = CloseEnough;
})(typeof window !== 'undefined' ? window : globalThis);

// Writes to the Supabase database so the free plan doesn't pause it for inactivity.
// Run by .github/workflows/keep-awake.yml. Reads the address and key from config.js,
// so there's nothing extra to set up.
const fs = require('fs');
const vm = require('vm');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(__dirname + '/../config.js', 'utf8'), sandbox);
const cfg = sandbox.window.CLOSE_ENOUGH_CONFIG || {};
const url = (cfg.supabaseUrl || '').replace(/\/$/, '');
const key = cfg.supabaseKey || '';

if (!url || !key) {
  console.log('config.js has no Supabase details yet, so there is nothing to keep awake.');
  process.exit(0);
}

const headers = { apikey: key };
if (/^eyJ/.test(key)) headers.Authorization = 'Bearer ' + key;

// Supabase only counts writes as activity, so call keep_awake(), which writes a row
// and deletes it again (see supabase/schema.sql).
fetch(`${url}/rest/v1/rpc/keep_awake`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: '{}',
})
  .then(async r => {
    if (!r.ok) {
      const body = await r.text();
      if (r.status === 404 || /PGRST202/.test(body)) {
        console.error('The keep_awake function is missing. Run supabase/schema.sql again in the Supabase SQL Editor.');
      } else {
        console.error(`Supabase answered ${r.status}. If the project is paused, restore it from the Supabase dashboard.`);
      }
      console.error(body);
      process.exit(1);
    }
    console.log('Database is awake. Heartbeat written at', await r.json());
  })
  .catch(err => { console.error('Could not reach Supabase:', err.message); process.exit(1); });

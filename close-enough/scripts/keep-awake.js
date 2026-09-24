// Pings the Supabase database so the free plan doesn't pause it for inactivity.
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

fetch(`${url}/rest/v1/responses?select=created_at&order=created_at.desc&limit=1`, { headers })
  .then(async r => {
    if (!r.ok) {
      console.error(`Supabase answered ${r.status}. If the project is paused, restore it from the Supabase dashboard.`);
      console.error(await r.text());
      process.exit(1);
    }
    const rows = await r.json();
    console.log('Database is awake.', rows.length ? `Latest response: ${rows[0].created_at}` : 'No responses yet.');
  })
  .catch(err => { console.error('Could not reach Supabase:', err.message); process.exit(1); });

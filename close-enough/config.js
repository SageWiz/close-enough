/*
 * Close Enough: site settings
 *
 * Leave supabaseUrl and supabaseKey empty and the quiz works exactly the same,
 * it just doesn't save anything. Fill them in (see README, "Turn on stats")
 * to start collecting anonymous results.
 *
 * The key here is the PUBLISHABLE key (starts with sb_publishable_) or the
 * legacy "anon" key. Both are safe to put in a public website. Never put the
 * secret / service_role key in this file.
 */
window.CLOSE_ENOUGH_CONFIG = {
  supabaseUrl: 'https://kwwwaunbldjpmqwtnjoj.supabase.co',       
  supabaseKey: 'sb_publishable_eNAFMe70cbcRL54qx36eFg_-bVBJY2E',      
  collectByDefault: true  // whether the "add my answers" box starts checked
};

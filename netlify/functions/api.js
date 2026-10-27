// Palm Oil API: login + Google Drive JSON database via Google Apps Script. No npm dependencies.
const crypto = require('crypto');
const E = process.env, SECRET = E.JWT_SECRET;
const b64 = b => Buffer.from(b).toString('base64url');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async body => {
  const r = await fetch(E.APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: E.APPS_SCRIPT_KEY, ...body }) });
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error('Google Script not reachable. Deploy it with access "Anyone" and check APPS_SCRIPT_URL.'); }
};
async function load() {
  const j = await post({ op: 'read' });
  if (j.error) throw new Error('Google Script: ' + j.error + ' (check APPS_SCRIPT_KEY)');
  return j;
}
async function save(db) {
  db.meta.rev++;
  const j = await post({ op: 'write', data: JSON.stringify(db) });
  if (!j.ok) throw new Error('Drive save failed: ' + (j.error || 'unknown'));
}
const hp = (p, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(p, salt, 32).toString('hex') });
const chk = (p, u) => { const a = crypto.scryptSync(p, u.salt, 32), b = Buffer.from(u.hash, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const sign = o => { const p = b64(JSON.stringify(o)); return p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url'); };
function unsign(t) {
  const [p, s] = (t || '').split('.'); if (!p || !s) return null;
  const x = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  if (x.length !== s.length || !crypto.timingSafeEqual(Buffer.from(x), Buffer.from(s))) return null;
  const o = JSON.parse(Buffer.from(p, 'base64url')); return o.exp > Date.now() ? o : null;
}
const pub = u => ({ username: u.username, name: u.name, role: u.role, active: u.active });
const num = v => v === null || v === '' || v === undefined ? null : (Number.isFinite(+v) && +v >= 0 && +v < 1e9 ? Math.round(+v * 1e4) / 1e4 : undefined);
const str = v => String(v ?? '').slice(0, 60);
const dt = v => !v ? '' : /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
function clean(kind, r) {
  const o = { fy: r.fy, m: +r.m };
  if (!/^\d{4}-\d{2}$/.test(o.fy) || !Number.isInteger(o.m) || o.m < 0 || o.m > 11) return;
  const spec = kind === 'de' ? { qtyDate: dt, qty: num, amtDate: dt, amount: num }
    : { date: dt, trips: str, tripsAmt: num, labour: str, labourAmt: num, pest: str, pestAmt: num, manure: str, manureAmt: num };
  for (const k in spec) { o[k] = spec[k](r[k]); if (o[k] === undefined) return; }
  return Object.values(o).slice(2).some(v => v !== '' && v !== null) ? o : undefined;
}

exports.handler = async e => {
  const R = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(b) });
  if (e.httpMethod !== 'POST') return R(405, { error: 'POST only' });
  if (!SECRET || SECRET.length < 16 || !E.APPS_SCRIPT_URL || !E.APPS_SCRIPT_KEY) return R(500, { error: 'Server not configured (JWT_SECRET / APPS_SCRIPT_URL / APPS_SCRIPT_KEY)' });
  try {
    const q = JSON.parse(e.body || '{}'), db = await load(); db.users = db.users || [];
    if (q.action === 'login') {
      const un = String(q.username || '').trim().toLowerCase(), pw = String(q.password || '');
      let u = db.users.find(x => x.username === un);
      if (!u && !db.users.length && E.ADMIN_USERNAME && E.ADMIN_PASSWORD && un === E.ADMIN_USERNAME.toLowerCase() && pw === E.ADMIN_PASSWORD) {
        u = { username: un, name: 'Administrator', role: 'admin', active: true, ...hp(pw) }; db.users.push(u); await save(db);
      } else if (!u || !u.active || !chk(pw, u)) { await sleep(800); return R(401, { error: 'Wrong username or password' }); }
      return R(200, { token: sign({ u: u.username, exp: Date.now() + 12 * 36e5 }), user: pub(u) });
    }
    const t = unsign((e.headers.authorization || '').replace('Bearer ', ''));
    const me = t && db.users.find(x => x.username === t.u && x.active);
    if (!me) return R(401, { error: 'Please sign in again' });
    const edit = me.role !== 'viewer', adm = me.role === 'admin';
    if (q.action === 'get') return R(200, { de: db.de, exp: db.exp, user: pub(me), rev: db.meta.rev });
    if (q.action === 'save' || q.action === 'remove') {
      if (!edit) return R(403, { error: 'View-only account' });
      const k = q.kind; if (k !== 'de' && k !== 'exp') return R(400, { error: 'Bad request' });
      if (q.action === 'remove') { db[k] = db[k].filter(x => x.id !== q.id); await save(db); return R(200, { ok: true }); }
      const rec = clean(k, q.rec || {}); if (!rec) return R(400, { error: 'Invalid or empty entry' });
      const i = q.rec.id ? db[k].findIndex(x => x.id === q.rec.id) : -1;
      if (i >= 0) { rec.id = q.rec.id; db[k][i] = rec; } else { rec.id = k[0] + (db.meta.nextId++); db[k].push(rec); }
      await save(db); return R(200, { rec });
    }
    if (q.action === 'pw') {
      if (!chk(String(q.old || ''), me)) return R(400, { error: 'Current password is wrong' });
      if (String(q.new || '').length < 8) return R(400, { error: 'New password needs 8+ characters' });
      Object.assign(me, hp(q.new)); await save(db); return R(200, { ok: true });
    }
    if (!adm) return R(403, { error: 'Admin only' });
    const admins = () => db.users.filter(x => x.role === 'admin' && x.active).length;
    if (q.action === 'users') return R(200, { users: db.users.map(pub) });
    if (q.action === 'usave') {
      const un = String(q.username || '').trim().toLowerCase(); let u = db.users.find(x => x.username === un);
      if (!/^[a-z0-9._-]{3,30}$/.test(un) || !['admin', 'editor', 'viewer'].includes(q.role)) return R(400, { error: 'Invalid username or role' });
      if (!u && String(q.password || '').length < 8) return R(400, { error: 'Password needs 8+ characters' });
      if (q.password && String(q.password).length < 8) return R(400, { error: 'Password needs 8+ characters' });
      if (u && u.role === 'admin' && u.active && (q.role !== 'admin' || !q.active) && admins() < 2) return R(400, { error: 'Keep at least one active admin' });
      if (!u) { u = { username: un }; db.users.push(u); }
      Object.assign(u, { name: str(q.name) || un, role: q.role, active: !!q.active }); if (q.password) Object.assign(u, hp(String(q.password)));
      await save(db); return R(200, { users: db.users.map(pub) });
    }
    if (q.action === 'udel') {
      const u = db.users.find(x => x.username === q.username);
      if (!u || u.username === me.username) return R(400, { error: 'Cannot delete this user' });
      db.users = db.users.filter(x => x !== u); await save(db); return R(200, { users: db.users.map(pub) });
    }
    return R(400, { error: 'Unknown action' });
  } catch (err) { return R(500, { error: err.message }); }
};

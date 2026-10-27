// Paste this whole file into script.google.com. It saves/reads your JSON file in Google Drive.
const FILE_ID = 'PASTE_YOUR_DRIVE_FILE_ID_HERE';
const SECRET  = 'PASTE_A_LONG_RANDOM_PASSWORD_HERE'; // must be the same value as APPS_SCRIPT_KEY in Netlify

function doPost(e) {
  const q = JSON.parse(e.postData.contents);
  if (q.key !== SECRET) return out({ error: 'denied' });
  const f = DriveApp.getFileById(FILE_ID);
  if (q.op === 'read') return ContentService.createTextOutput(f.getBlob().getDataAsString()).setMimeType(ContentService.MimeType.JSON);
  if (q.op === 'write') {
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try { f.setContent(q.data); } finally { lock.releaseLock(); }
    return out({ ok: true });
  }
  return out({ error: 'bad op' });
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

# Palm Oil Manager – setup (about 15 minutes, one time)

Website on Netlify + your data in one JSON file in Google Drive, saved through a small Google Script.

## Step 1 – Put the data file in Google Drive
1. Upload `palm_oil_db.json` to your Google Drive (keep it as a plain .json file).
2. Open the file (double-click, or right-click > Open with). The address looks like
   `drive.google.com/file/d/`**`1AbCdEf...`**`/view` – the bold part is your **FILE ID**. Copy it.

## Step 2 – Create the Google Script
1. Go to https://script.google.com (same Google account) > **New project**.
2. Delete everything in the editor and paste the whole of `apps-script/Code.gs`.
3. Replace `PASTE_YOUR_DRIVE_FILE_ID_HERE` with your FILE ID.
4. Replace `PASTE_A_LONG_RANDOM_PASSWORD_HERE` with any long random text (30+ letters/numbers). Keep a copy – this is your **script key**.
5. Click **Deploy > New deployment > (gear) Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy**.
6. Google asks for permission: **Authorize access > choose your account > Advanced > Go to project (unsafe) > Allow**. (It is your own script.)
7. Copy the **Web app URL** (ends with `/exec`).

## Step 3 – Put the website on Netlify
1. Upload this folder to a **private** GitHub repository (the `.gitignore` keeps your data file out).
2. Netlify > **Add new site > Import from Git** > choose the repository > Deploy (no build command needed).
3. Site settings > **Environment variables**, add:

| Name | Value |
|---|---|
| `APPS_SCRIPT_URL` | the Web app URL from step 2.7 |
| `APPS_SCRIPT_KEY` | your script key from step 2.4 |
| `JWT_SECRET` | any other long random text |
| `ADMIN_USERNAME` | your login name |
| `ADMIN_PASSWORD` | your password (8+ characters) |

4. **Deploys > Trigger deploy**. Open the site and sign in with the admin name and password.
   Then open **Users** to add editors/viewers.

## Roles
Admin: everything + users · Editor: add/edit/delete data + reports · Viewer: reports only.

## Good to know
- If you change the script code later, use **Deploy > Manage deployments > Edit > New version** so the same URL keeps working.
- Drive keeps old versions of the file (right-click the file > Manage versions) as your backup.
- Only the Netlify site knows the script key, so the script URL alone cannot read your data.
- PDF export needs internet (library from cdnjs). Print > "Save as PDF" always works.
- In the data file, `m` is the report month (0 = April ... 11 = March).

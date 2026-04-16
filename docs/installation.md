# EspoCRM Installation

Complete installation procedure for EspoCRM from a bare clone to a working instance. Covers every non-obvious step discovered during the 2026-04-15 setup session.

**Source**: Hands-on installation session 2026-04-15 on Ubuntu 24.04 with Apache, PHP 8.3, MySQL in LXC.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| PHP | 8.1+ (tested: 8.3) | Must be Apache mod_php or FPM |
| PHP extensions | pdo_mysql, mysqli, gd, curl, mbstring, zip, intl, json, openssl, xml, fileinfo | All present by default in Ubuntu PHP packages |
| MySQL | 5.7+ | Our setup: LXC container at 127.0.0.1:3306 |
| Apache | 2.4+ | mod_rewrite must be enabled |
| Node.js | 20+ | Required for frontend build step |
| Composer | 2.x | For PHP dependency install |

---

## Step 1 — Clone the Repository

```bash
cd /home/mustafa/telcobright-projects/Contact_Center/espocrm
git clone https://github.com/espocrm/espocrm.git .
```

Clone into the target directory directly (note the trailing `.`). The repo is the full source — backend + frontend source — suitable for feature development.

---

## Step 2 — Install PHP Dependencies

```bash
composer install --no-dev
```

Installs all PHP packages listed in `composer.lock`. The `--no-dev` flag skips dev-only packages. Takes ~1-2 minutes.

---

## Step 3 — Install Node.js Dependencies and Build Frontend

**This step is critical.** Without it the installer's "Start" button does nothing.

```bash
npm install
./node_modules/.bin/grunt
```

**Why this matters**: The installer page checks `file_exists('client/lib/espo.js')` to set `$isBuilt`. If false, it does not load jQuery or any JS libraries in the HTML. The Start button uses `type="button"` and relies entirely on a jQuery click handler — without jQuery it silently does nothing.

The `grunt` build:
- Compiles LESS → CSS into `client/css/espo/`
- Bundles JS libraries into `client/lib/espo.js` and `client/lib/espo-main.js`
- Copies all frontend assets to their final locations

**Duration**: ~2-5 minutes on first run.

### Permissions required for grunt

Before running grunt, the `data/` directory must be writable by the current user (grunt runs `dev/set-config-params.php` which writes to `data/config.php`):

```bash
sudo chown -R $USER:www-data data/ custom/ client/custom/
sudo chmod -R 775 data/ custom/ client/custom/
```

---

## Step 4 — Create the MySQL Database

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p123456 \
  -e "CREATE DATABASE IF NOT EXISTS espocrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

The installer will create all tables during the web installation step. Only the empty database needs to exist beforehand.

---

## Step 5 — Configure Apache

### Critical: Document Root Must Be `public/`

EspoCRM's project root contains an `index.php` that renders an error/instructions page — it is not the web entry point. The real entry point is `public/index.php`. The `client/` directory must be accessible as an alias because it lives outside `public/`.

**Apache vhost** (`/etc/apache2/sites-available/espocrm.conf`):

```apache
Listen 7080

<VirtualHost *:7080>
    ServerName localhost
    DocumentRoot /home/mustafa/telcobright-projects/Contact_Center/espocrm/public

    Alias /client/ /home/mustafa/telcobright-projects/Contact_Center/espocrm/client/

    <Directory /home/mustafa/telcobright-projects/Contact_Center/espocrm/public>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    <Directory /home/mustafa/telcobright-projects/Contact_Center/espocrm/client>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/espocrm_error.log
    CustomLog ${APACHE_LOG_DIR}/espocrm_access.log combined
</VirtualHost>
```

Enable and reload:

```bash
sudo a2ensite espocrm.conf
sudo a2enmod rewrite
sudo systemctl reload apache2
```

### Home directory traversal

Apache must be able to traverse parent directories to reach the document root:

```bash
chmod 755 /home/mustafa \
           /home/mustafa/telcobright-projects \
           /home/mustafa/telcobright-projects/Contact_Center \
           /home/mustafa/telcobright-projects/Contact_Center/espocrm
```

---

## Step 6 — Set File Permissions

EspoCRM's web process (Apache's `www-data`) must be able to write to several directories. The developer user (`mustafa`) also needs write access to edit source files. Use group ownership:

```bash
ESPO_PATH="/home/mustafa/telcobright-projects/Contact_Center/espocrm"

sudo chown -R mustafa:www-data \
  "$ESPO_PATH/data" \
  "$ESPO_PATH/custom" \
  "$ESPO_PATH/client/custom"

sudo chmod -R 775 \
  "$ESPO_PATH/data" \
  "$ESPO_PATH/custom" \
  "$ESPO_PATH/client/custom"
```

The `install/config.php` file also needs to be writable by www-data (created during web installer):

```bash
sudo touch "$ESPO_PATH/install/config.php"
sudo chown mustafa:www-data "$ESPO_PATH/install/config.php"
sudo chmod 664 "$ESPO_PATH/install/config.php"
```

---

## Step 7 — Web Installer

Open http://localhost:7080 in a browser. You will be redirected to the installer at `/install/`.

### Installer flow

| Step | Page | What to do |
|------|------|-----------|
| 0 | Welcome (main) | Click **Start** |
| 1 | License Agreement | Check "I accept" → **Next** |
| 2 | Database Configuration | Fill in DB credentials → **Next** |
| 3 | Administrator Setup | Set admin username and password → **Next** |
| 4 | System Settings | Set site URL, timezone, language → **Next** |
| 5 | SMTP (optional) | Skip or fill → **Next** |
| Finish | Success | Click **Go to EspoCRM** |

### Database credentials for Step 2

| Field | Value |
|-------|-------|
| Host Name | `127.0.0.1` |
| Port | `3306` |
| Database Name | `espocrm` |
| User Name | `root` |
| Password | `123456` |
| Driver | MySQLi (default) |

### The checkModRewrite check

During the installer flow (on the system requirements page), EspoCRM tests mod_rewrite by calling `GET /api/v1/App/user` and expecting HTTP 200 or 401. Before the DB is configured, the app returns 500 ("No database name specified in config") — this gets logged to `data/logs/espo-YYYY-MM-DD.log` as CRITICAL but is harmless noise. Once the DB credentials are saved at Step 2, the API returns 401 (unauthorized) and the check passes.

---

## Step 8 — Cron Job

EspoCRM requires a cron job for scheduled tasks (email import, notifications, reminders, workflow actions):

```bash
crontab -e
```

Add:
```
* * * * * cd /home/mustafa/telcobright-projects/Contact_Center/espocrm; /usr/bin/php -f cron.php > /dev/null 2>&1
```

Without this line, scheduled jobs will not run.

---

## Directory Structure Reference

```
espocrm/                         ← project root (NOT the web root)
├── application/                 ← PHP backend (PSR-4, Espo\ namespace)
│   └── Espo/
│       ├── Core/                ← framework internals
│       ├── Modules/             ← built-in modules (Crm, etc.)
│       └── ...
├── client/                      ← frontend source + built assets
│   ├── src/                     ← JS source (AMD modules)
│   ├── lib/                     ← built JS bundles (espo.js, etc.)
│   ├── css/espo/                ← built CSS (espo.css, dark.css, etc.)
│   ├── modules/                 ← module-specific frontend assets
│   └── custom/                  ← custom frontend overrides (writable by www-data)
├── custom/                      ← custom backend overrides (upgrade-safe)
│   └── Espo/Custom/
├── data/                        ← runtime data (writable by www-data)
│   ├── config.php               ← main config (written by installer)
│   ├── config-internal.php      ← sensitive keys
│   ├── cache/                   ← compiled metadata cache
│   ├── logs/                    ← application logs (espo-YYYY-MM-DD.log)
│   └── tmp/
├── frontend/                    ← frontend build config (less/, libs.json, bundle-config.json)
├── install/                     ← installer PHP backend
├── public/                      ← WEB ROOT (Apache DocumentRoot)
│   ├── index.php                ← main frontend entry (includes ../bootstrap.php)
│   ├── api/v1/index.php         ← API entry point
│   ├── install/                 ← installer web UI (HTML, JS, CSS)
│   └── ...
├── bootstrap.php                ← app bootstrap
├── composer.json
├── package.json
├── Gruntfile.js                 ← frontend build definition
└── cron.php                     ← scheduled jobs entry
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Browser opens root URL and sees setup instructions (not installer) | DocumentRoot pointing to project root, not `public/` | Set `DocumentRoot .../espocrm/public` in Apache vhost |
| Installer "Start" button does nothing | Frontend not built; jQuery not loaded | Run `npm install && ./node_modules/.bin/grunt` |
| grunt fails: "Could not save config" | `data/` owned by root or wrong user | `sudo chown -R $USER:www-data data/ && chmod -R 775 data/` |
| Installer step 1 says "Permission denied for data directory" | `data/` not writable by www-data | `sudo chown -R mustafa:www-data data/ && chmod -R 775 data/` |
| `data/logs/espo-*.log` shows "No database name specified" | API called before DB configured during checkModRewrite | Normal; these errors are harmless noise from the installer's mod_rewrite check |
| 403 on `/client/` URL | Missing `Alias /client/` in Apache vhost | Add `Alias /client/ .../espocrm/client/` and the corresponding Directory block |
| Login/app fails after install | Cache stale or permissions wrong | `sudo chmod -R 775 data/cache && sudo chown -R mustafa:www-data data/cache` |

## See Also
- [customization.md](customization.md) — How to modify EspoCRM features safely

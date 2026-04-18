# EspoCRM — Remote Deploy (SSH-only)

Single deployment pattern — everything goes over SSH. "Local" is just a
profile with `ssh_host = 127.0.0.1`. Ships **our multi-tenant fork** (commit
`fa6f571ed8` + `78d4f9cac3` + `51ee8e6715`), not upstream EspoCRM:

- `bootstrap.php`        — subdomain → tenant DB resolution (cached 60s)
- `data/config.php`      — reads `$_SERVER['ESPO_SITE_URL']`
- `data/config-internal.php` — reads `$_SERVER['ESPO_DB_NAME']`
- `custom/Espo/Custom/Controllers/TenantManager.php` — provisioning API
- `custom/Espo/Custom/Resources/routes.json` — routes for the above
- `data/fresh_dump.sql.gz` — template DB for newly-provisioned tenants
- Theme modernization + admin-panel cross-reference wiki

## Prerequisites on the target

```bash
sudo apt update
sudo apt install -y php-cli php-mysql php-gd php-mbstring php-xml php-zip \
                    php-intl php-curl mysql-client rsync tar
# MariaDB/MySQL must be reachable at master_db_host:master_db_port
```

PHP 8.3+ is required (see composer.json constraint). Users must have passwordless
sudo on the target (or you'll get prompted for each sudo invocation).

## Layout

```
tools/deploy/
├── deploy.sh                             ← full deploy (code + DB + service + post-install)
├── post_install_scripts/                 ← drop any .sh here; step 9 offers them
│   └── enable_api_permission.sh          ← verify admin Basic auth, emit creds for proxy
├── tenant-conf/
│   ├── active.conf                        ← which tenant/profile is active on this box
│   └── <tenant>/<profile>.yml            ← one YAML per env (e.g. btcl/staging.yml)
├── dependencies/
│   ├── profile-loader.sh                  ← shared YAML parser + active-profile resolver
│   ├── ensure-master-db.sh                ← creates espocrm_master + tenantInfo + default row
│   └── espocrm.service                    ← systemd unit template
└── README.md
```

### Profile files

One YAML per tenant/profile under `tenant-conf/<tenant>/<profile>.yml`.
Shipped examples: `btcl/dev.yml`, `btcl/staging.yml`, `btcl/prod.yml`.
Add new tenants as sibling folders.

`tenant-conf/active.conf` picks the current default:

```ini
tenant=btcl
profile=staging
```

Invocation:

```bash
./deploy.sh                            # uses active.conf
./deploy.sh btcl staging               # explicit
./deploy.sh btcl staging --skip-build
./post_install_scripts/api_token_creation.sh                  # uses active.conf
./post_install_scripts/api_token_creation.sh btcl staging     # explicit
```

YAML format: flat `key: value` only (no nesting, no arrays). Parser lives in
`dependencies/profile-loader.sh` — keep it small; don't rely on YAML features
beyond flat scalars + `# comments`.

### Post-install scripts convention

- Any `.sh` file in `tools/deploy/post_install_scripts/` is discovered at
  step 9. `deploy.sh` prints a numbered menu:
  ```
    a) Run ALL
    1) api_token_creation.sh
    s) Skip all
    Select: 'a' for all, 's' to skip, or numbers (e.g. '1,3'):
  ```
- Each script takes the profile name as its only arg (`$1`) and is
  self-contained (reads the profile, opens its own SSH master, does its job).
- Failure (non-zero exit) aborts the deploy.
- Scripts may emit `KEY: value` lines on stdout; deploy.sh currently
  captures `CRM_API_KEY` to surface in the final banner + `version.txt`.

## Usage

```bash
cd tools/deploy
chmod +x deploy.sh dependencies/*.sh
./deploy.sh local
```

Flags:
- `--skip-build` — skip `composer install` (uses whatever is already in `vendor/`)

### Re-run a single post-install script

```bash
./post_install_scripts/enable_api_permission.sh              # active profile
./post_install_scripts/enable_api_permission.sh btcl staging
./post_install_scripts/enable_api_permission.sh btcl staging --user admin --password admin
CRM_ADMIN_USER=admin CRM_ADMIN_PASSWORD=admin ./post_install_scripts/enable_api_permission.sh
```

It prompts for credentials if `--user`/`--password` and the env-var
fallbacks are absent, verifies them against the running Espo, and prints:

```
CRM_ADMIN_USER: admin
CRM_ADMIN_PASSWORD: ••••
CRM_AUTH_B64:   YWRtaW46YWRtaW4=
```

### Why Basic auth, not X-Api-Key?

EspoCRM's ApiKey login (`application/Espo/Core/Authentication/Helper/UserFinder.php:83-93`)
hard-filters `type = User::TYPE_API`. An api-type user then fails the
`$user->isAdmin()` gate on User/Role/Team/AuthToken/AuthLogRecord/
ActionHistoryRecord/Settings controllers. Admin Basic auth is the only
supported path that works for admin endpoints — and admin users don't get
an `X-Api-Key` option, so `CRM_ADMIN_USER` + `CRM_ADMIN_PASSWORD` (or the
precomputed base64 `CRM_AUTH_B64`) is what the Spring Boot proxy must send.

## What happens (9 steps)

1. Dirty-tree guard + version tag (`espo-v<ts>` if HEAD untagged)
2. `composer install --no-dev` locally so `vendor/` ships in the tarball
3. Package source tarball (excludes `.git`, `node_modules`, `tests`, `docs`,
   `data/{cache,logs,tmp,upload}`, `tools/deploy` itself)
4. Open multiplexed SSH master connection to the target
5. Check `php`/`mysql`/`rsync`/`tar` are present on the target
6. Upload tarball + helpers; back up previous install to
   `${target_dir}.bak-<ts>` (keeps `keep_backups` most recent), extract new
   tarball, **preserving existing `data/` and `custom/`** so tenant state +
   cryptKey survive redeploys
7. Run `ensure-master-db.sh` (creates `espocrm_master`, `tenantInfo` table,
   inserts default tenant row), then import `data/fresh_dump.sql.gz` into the
   tenant DB if it's empty. Run `php bin/command rebuild`
8. Install `/etc/systemd/system/espocrm.service` (PHP built-in server on
   `serve_port`); `daemon-reload` + `enable` + `restart`
9. Auto-discover and run every `post_install_action_*.sh` next to
   `deploy.sh` (in sorted order). Currently one such script exists —
   `post_install_action_api_token_creation.sh` — which creates/rotates the
   admin API token. Add more scripts anytime with the same filename prefix.

A `version.txt` and append-only `deploy-history.log` are written to
`target_dir` for traceability.

## Profile keys

| Section       | Key                      | Purpose |
|---|---|---|
| SSH           | `ssh_host`, `ssh_port`, `ssh_user`, `ssh_key` | Target + key |
| Install       | `target_dir`, `www_user`, `www_group`         | Where files live + ownership |
| Serve         | `serve_port`, `site_url`                      | Built-in PHP server + `siteUrl` |
| Master DB     | `master_db_host`/`_port`/`_name`/`_user`/`_password` | Control DB |
| Default tenant| `default_tenant_slug`, `default_tenant_dbname`| Seed row in `tenantInfo` |
| Build         | `run_composer_install`, `run_npm_build`       | Toggles |
| Admin API     | `admin_api_mode` (`dedicated`/`upgrade`), `admin_api_user_name`, `main_admin_name` | API key rotation |
| Retention     | `keep_backups`                                | Number of `.bak-*` to keep |

## Multi-tenancy quick facts

- Route: request to `<slug>.host` → `bootstrap.php` → master DB lookup →
  sets `ESPO_DB_NAME` + `ESPO_SITE_URL` on `$_SERVER` → Espo uses those.
- Unknown slug → 404.
- New tenants: `POST /api/v1/TenantManager/create` (admin-only; see
  `custom/Espo/Custom/Controllers/TenantManager.php`).
- Cache TTL: 60s (in `bootstrap.php`, `$cacheDir=sys_get_temp_dir()+…`).

## Why an admin API key?

EspoCRM gates User/Role/Team/AuthToken/AuthLogRecord/ActionHistoryRecord/
`/Settings` with a hard `$user->isAdmin()` check. API-type users can't pass
it, and the `User` ACL scope intentionally doesn't expose level=`all`. So the
deploy ends by giving an admin-type user `authMethod=ApiKey` + fresh `api_key`
and emitting that key — plug it into the orchestrix-v2 Spring Boot
`CRM_API_KEY` env.

Standalone SQL (for manual rotation without running the full deploy):
`docs/mysql/admin-api-key.sql`.

## Rollback

```bash
ssh <target>
sudo systemctl stop espocrm
LATEST=$(ls -1dt /opt/espocrm.bak-* | head -1)
sudo rm -rf /opt/espocrm && sudo mv "$LATEST" /opt/espocrm
sudo systemctl start espocrm
```

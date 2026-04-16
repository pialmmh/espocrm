# EspoCRM Customization

How to extend and modify EspoCRM without breaking upstream upgrades. Covers the custom/ directory model, backend override pattern, frontend override pattern, and cache clearing.

**Source**: EspoCRM source code review and official customization model (2026-04-15).

---

## The Core Rule: Never Edit Core Files

EspoCRM is designed to be extended by placing override files in specific directories. The `custom/` directory on the backend and `client/custom/` on the frontend are loaded last and win over core equivalents. This means:

- `git pull` (upgrading EspoCRM) will not touch your customizations
- Your changes survive reinstalls as long as `custom/` and `client/custom/` are preserved
- You never edit files inside `application/Espo/` or `client/src/` directly

---

## Backend Customization

### Override Directory

```
custom/
└── Espo/
    └── Custom/
        ├── Controllers/     ← override or add API controllers
        ├── Services/        ← override or add business logic
        ├── Repositories/    ← override or add ORM repositories
        ├── Entities/        ← override or add entity classes
        ├── Hooks/           ← event hooks (before/after save, delete, etc.)
        ├── SelectManagers/  ← override list-view query builders
        ├── Resources/
        │   ├── metadata/    ← entity/field/relationship definitions (JSON)
        │   └── i18n/        ← translation overrides
        └── ...
```

### Adding a New API Endpoint

1. Create `custom/Espo/Custom/Controllers/MyController.php`:

```php
<?php
namespace Espo\Custom\Controllers;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;

class MyController
{
    public function getActionHello(Request $request, Response $response): void
    {
        $response->writeBody(json_encode(['message' => 'Hello']));
    }
}
```

This becomes accessible at `GET /api/v1/My/hello`.

### Adding a Hook

Hooks fire on entity lifecycle events. Create `custom/Espo/Custom/Hooks/Lead/AfterSave.php`:

```php
<?php
namespace Espo\Custom\Hooks\Lead;

use Espo\ORM\Entity;

class AfterSave
{
    public function afterSave(Entity $entity, array $options): void
    {
        // runs after every Lead save
    }
}
```

Available hook events: `beforeSave`, `afterSave`, `beforeRemove`, `afterRemove`, `afterRelate`, `afterUnrelate`.

### Overriding a Core Service

Copy the method signature from `application/Espo/Services/Lead.php` into `custom/Espo/Custom/Services/Lead.php` extending the original:

```php
<?php
namespace Espo\Custom\Services;

class Lead extends \Espo\Services\Lead
{
    // Override specific methods here
}
```

### After Any Backend Change

Clear the metadata/class cache:

```bash
php command.php clear-cache
# or just delete the cache directory:
rm -rf data/cache/*
```

No Apache restart needed — PHP reads files directly on the next request.

---

## Frontend Customization

### Override Directory

```
client/
└── custom/
    ├── src/
    │   ├── views/           ← override Backbone views
    │   ├── controllers/     ← override route controllers
    │   ├── fields/          ← override or add field types
    │   └── ...
    └── res/
        └── templates/      ← override Handlebars templates
```

### Override a View

EspoCRM uses AMD (RequireJS-style) modules. To override `client/src/views/lead/list.js`, create `client/custom/src/views/lead/list.js`:

```javascript
define('custom:views/lead/list', ['views/lead/list'], function (Dep) {
    return Dep.extend({
        // override methods here
        setup: function () {
            Dep.prototype.setup.call(this);
            // your additions
        }
    });
});
```

Then register the override in `custom/Espo/Custom/Resources/metadata/clientDefs/Lead.json`:

```json
{
    "views": {
        "list": "custom:views/lead/list"
    }
}
```

### Override a Handlebars Template

Copy the original from `client/res/templates/` (or `client/modules/.../res/templates/`) to `client/custom/res/templates/` with the same relative path. Edit in place.

### After Any Frontend Change

Run the build:

```bash
./node_modules/.bin/grunt
```

Or for a faster development loop (only compiles changed files):

```bash
./node_modules/.bin/grunt dev
```

Then hard-refresh the browser (Ctrl+Shift+R) to bust the AMD module cache.

---

## Adding a New Entity (Module)

EspoCRM entities are defined via metadata JSON, not PHP migrations.

1. Create `custom/Espo/Custom/Resources/metadata/entityDefs/MyEntity.json`:

```json
{
    "fields": {
        "name": { "type": "varchar", "required": true },
        "status": {
            "type": "enum",
            "options": ["New", "Active", "Closed"],
            "default": "New"
        }
    },
    "links": {
        "account": {
            "type": "belongsTo",
            "entity": "Account"
        }
    }
}
```

2. Create `custom/Espo/Custom/Resources/metadata/scopes/MyEntity.json`:

```json
{
    "entity": true,
    "module": "Custom",
    "layouts": true,
    "tab": true,
    "acl": true
}
```

3. Clear cache and rebuild DB schema from Admin → Rebuild.

---

## Key Config Files

| File | Purpose | Edit Directly? |
|------|---------|---------------|
| `data/config.php` | Main runtime config (DB creds, site URL, etc.) | Yes, carefully |
| `data/config-internal.php` | Secret keys (crypto, API keys) | No — managed by app |
| `data/cache/` | Compiled metadata, class maps | No — delete to reset |
| `custom/Espo/Custom/Resources/metadata/` | Entity/field/layout definitions | Yes |

---

## Development Workflow Summary

```
Backend change (PHP):
  1. Edit file in custom/Espo/Custom/
  2. php command.php clear-cache
  3. Test — no restart needed

Frontend change (JS/template):
  1. Edit file in client/custom/
  2. ./node_modules/.bin/grunt  (or grunt dev)
  3. Hard-refresh browser

New entity:
  1. Write metadata JSON in custom/.../metadata/entityDefs/ and scopes/
  2. Clear cache
  3. Admin UI → Admin → Rebuild (updates DB schema)
```

---

## Common Gotchas

| Gotcha | Detail |
|--------|--------|
| Edits in `application/` or `client/src/` | Overwritten by `git pull` / upgrade. Always use `custom/` |
| Frontend changes not visible | Forgot to run `grunt` — the browser loads built files from `client/lib/` |
| Metadata changes not picked up | Cache not cleared — run `php command.php clear-cache` |
| New entity fields not in DB | Must run Admin → Rebuild after adding metadata — EspoCRM auto-alters tables |
| 403 on custom module JS | Check that `client/custom/` has `755` permissions readable by www-data |

## See Also
- [installation.md](installation.md) — Full setup procedure including permissions and build

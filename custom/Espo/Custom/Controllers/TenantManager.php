<?php
namespace Espo\Custom\Controllers;

use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\ApplicationState;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Exceptions\BadRequest;
use PDO;
use Exception;

/**
 * Tenant provisioning API.
 *
 * All endpoints are admin-only.
 *
 * POST /api/v1/TenantManager/create
 *   Body: { "name": "acme", "displayName": "Acme Corp", "adminPassword": "secret" }
 *   Creates a new tenant DB, loads fresh schema, registers in tenantInfo.
 *
 * GET /api/v1/TenantManager/list
 *   Returns all tenants from tenantInfo.
 *
 * POST /api/v1/TenantManager/disable
 *   Body: { "name": "acme" }
 *   Sets is_active = 0.
 */
class TenantManager
{
    private array $masterDb = [
        'host'   => 'localhost',
        'user'   => 'root',
        'pass'   => '123456',
        'dbname' => 'espocrm_master',
    ];

    private string $freshDumpPath = 'data/fresh_dump.sql.gz';

    public function __construct(private ApplicationState $applicationState)
    {}

    private function requireAdmin(): void
    {
        if (!$this->applicationState->isAdmin()) {
            throw new Forbidden("Admin access required.");
        }
    }

    private function masterPdo(): PDO
    {
        return new PDO(
            "mysql:host={$this->masterDb['host']};dbname={$this->masterDb['dbname']};charset=utf8mb4",
            $this->masterDb['user'],
            $this->masterDb['pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
    }

    // ── POST /api/v1/TenantManager/create ────────────────────────────────────

    public function postActionCreate(Request $request, Response $response): void
    {
        $this->requireAdmin();

        $body = $request->getParsedBody();
        $name          = trim($body->name ?? '');
        $displayName   = trim($body->displayName ?? $name);
        $adminPassword = $body->adminPassword ?? 'admin';

        if (!preg_match('/^[a-z0-9_-]{2,50}$/', $name)) {
            throw new BadRequest("Tenant name must be 2-50 lowercase alphanumeric/dash/underscore characters.");
        }

        if ($name === 'master') {
            throw new BadRequest("'master' is reserved.");
        }

        $pdo    = $this->masterPdo();
        $dbname = 'espocrm_' . $name;

        // Check not already registered
        $stmt = $pdo->prepare("SELECT id FROM tenantInfo WHERE name = ? LIMIT 1");
        $stmt->execute([$name]);
        if ($stmt->fetch()) {
            throw new BadRequest("Tenant '$name' already exists.");
        }

        // 1. Create database
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

        // 2. Load fresh dump
        $this->loadFreshDump($dbname);

        // 3. Set admin password in new tenant DB
        $this->setAdminPassword($dbname, $adminPassword);

        // 4. Register in tenantInfo
        $insert = $pdo->prepare(
            "INSERT INTO tenantInfo (name, dbname, display_name) VALUES (?, ?, ?)"
        );
        $insert->execute([$name, $dbname, $displayName]);

        // 5. Invalidate cache for this slug
        $cacheFile = sys_get_temp_dir() . '/espocrm_tenant_cache/tenant_' . md5($name) . '.cache';
        @unlink($cacheFile);

        $response->writeBody(json_encode([
            'success'    => true,
            'name'       => $name,
            'dbname'     => $dbname,
            'displayName'=> $displayName,
        ]));
    }

    // ── GET /api/v1/TenantManager/list ───────────────────────────────────────

    public function getActionList(Request $request, Response $response): void
    {
        $this->requireAdmin();

        $pdo  = $this->masterPdo();
        $stmt = $pdo->query("SELECT name, dbname, display_name, is_active, created_at FROM tenantInfo ORDER BY created_at");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $response->writeBody(json_encode(['list' => $rows]));
    }

    // ── POST /api/v1/TenantManager/disable ───────────────────────────────────

    public function postActionDisable(Request $request, Response $response): void
    {
        $this->requireAdmin();

        $body = $request->getParsedBody();
        $name = trim($body->name ?? '');

        if ($name === 'master') {
            throw new BadRequest("Cannot disable master tenant.");
        }

        $pdo  = $this->masterPdo();
        $stmt = $pdo->prepare("UPDATE tenantInfo SET is_active = 0 WHERE name = ?");
        $stmt->execute([$name]);

        // Invalidate cache
        $cacheFile = sys_get_temp_dir() . '/espocrm_tenant_cache/tenant_' . md5($name) . '.cache';
        @unlink($cacheFile);

        $response->writeBody(json_encode(['success' => true]));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function loadFreshDump(string $dbname): void
    {
        if (!file_exists($this->freshDumpPath)) {
            throw new \RuntimeException("Fresh dump not found at {$this->freshDumpPath}");
        }

        $host = escapeshellarg($this->masterDb['host']);
        $user = escapeshellarg($this->masterDb['user']);
        $pass = $this->masterDb['pass'];
        $db   = escapeshellarg($dbname);

        // Decompress and pipe into mysql
        $cmd = "zcat " . escapeshellarg($this->freshDumpPath)
             . " | mysql -h $host -u $user -p" . escapeshellarg($pass)
             . " $db 2>&1";

        exec($cmd, $output, $code);

        if ($code !== 0) {
            throw new \RuntimeException("Failed to load fresh dump: " . implode("\n", $output));
        }
    }

    private function setAdminPassword(string $dbname, string $plainPassword): void
    {
        $hash = password_hash($plainPassword, PASSWORD_BCRYPT);

        $tenantPdo = new PDO(
            "mysql:host={$this->masterDb['host']};dbname={$dbname};charset=utf8mb4",
            $this->masterDb['user'],
            $this->masterDb['pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );

        $stmt = $tenantPdo->prepare(
            "UPDATE user SET password = ? WHERE type = 'admin' LIMIT 1"
        );
        $stmt->execute([$hash]);
    }
}

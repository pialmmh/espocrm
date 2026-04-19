<?php
/************************************************************************
 * This file is part of EspoCRM.
 *
 * EspoCRM – Open Source CRM application.
 * Copyright (C) 2014-2026 EspoCRM, Inc.
 * Website: https://www.espocrm.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * The interactive user interfaces in modified source and object code versions
 * of this program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU Affero General Public License version 3.
 *
 * In accordance with Section 7(b) of the GNU Affero General Public License version 3,
 * these Appropriate Legal Notices must retain the display of the "EspoCRM" word.
 ************************************************************************/

chdir(dirname(__FILE__));
set_include_path(dirname(__FILE__));

require_once "vendor/autoload.php";

// =============================================================================
// MULTI-TENANT: Detect tenant from subdomain, resolve DB and siteUrl
// =============================================================================

(function () {
    $masterDb = [
        'host'   => '127.0.0.1',
        'port'   => 3306,
        'user'   => 'root',
        'pass'   => '123456',
        'dbname' => 'espocrm_master',
    ];

    $cacheDir = sys_get_temp_dir() . '/espocrm_tenant_cache';
    $cacheTTL = 60;

    // Extract subdomain slug from HTTP_HOST
    // e.g. acme.localhost → acme   |   localhost → master
    $host = strtolower($_SERVER['HTTP_HOST'] ?? 'localhost');
    $host = preg_replace('/:\d+$/', '', $host);   // strip port

    $slug = 'master';
    if (preg_match('/^([a-z0-9_-]+)\./', $host, $m)) {
        $slug = $m[1];
    }

    // Check file cache
    $cacheFile = $cacheDir . '/tenant_' . md5($slug) . '.cache';
    $tenant    = null;

    if (is_file($cacheFile)) {
        $cached = @unserialize(file_get_contents($cacheFile));
        if ($cached && isset($cached['expires']) && $cached['expires'] > time()) {
            $tenant = $cached['tenant'];
        }
    }

    if (!$tenant) {
        try {
            $pdo  = new PDO(
                "mysql:host={$masterDb['host']};port={$masterDb['port']};dbname={$masterDb['dbname']};charset=utf8mb4",
                $masterDb['user'], $masterDb['pass'],
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
            $stmt = $pdo->prepare(
                "SELECT dbname, display_name FROM tenantInfo WHERE name = ? AND is_active = 1 LIMIT 1"
            );
            $stmt->execute([$slug]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                $tenant = $row;
                // Write cache
                if (!is_dir($cacheDir)) {
                    @mkdir($cacheDir, 0755, true);
                }
                @file_put_contents($cacheFile, serialize([
                    'tenant'  => $tenant,
                    'expires' => time() + $cacheTTL,
                ]));
            }
        } catch (Exception $e) {
            // fall through to master
        }
    }

    // Unknown slug → reject (same policy as SuiteCRM)
    if (!$tenant) {
        http_response_code(404);
        echo "Tenant '$slug' not found.";
        exit;
    }

    // Reconstruct siteUrl with original port
    $port     = '';
    $hostHeader = $_SERVER['HTTP_HOST'] ?? 'localhost';
    if (preg_match('/:\d+$/', $hostHeader, $pm)) {
        $port = $pm[0];
    }
    $scheme  = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $siteUrl = $scheme . '://' . $hostHeader; // includes port if present

    $_SERVER['ESPO_DB_NAME']        = $tenant['dbname'];
    $_SERVER['ESPO_SITE_URL']       = $siteUrl;
    $_SERVER['ESPO_TENANT_SLUG']    = $slug;
    // Environment profile: set by deploy script at install time (defaults to
    // 'dev'). Used by \Espo\Custom\BrandProfile to pick
    // custom/brand-profiles/{slug}/{profile}.php.
    if (empty($_SERVER['ESPO_TENANT_PROFILE'])) {
        $_SERVER['ESPO_TENANT_PROFILE'] = getenv('ESPO_TENANT_PROFILE') ?: 'dev';
    }
})();

// =============================================================================
// END MULTI-TENANT
// =============================================================================


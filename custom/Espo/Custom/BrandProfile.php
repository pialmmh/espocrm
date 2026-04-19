<?php
/**
 * BrandProfile — loads the per-tenant backend config block
 * (kafka / xmpp / webrtc / sip / recording / call_center_agent / …).
 *
 * Resolution: uses $_SERVER['ESPO_TENANT_SLUG'] set by bootstrap.php
 * when the HTTP Host is resolved against espocrm_master.tenantInfo.
 * Falls back to 'btcl' when no slug is present (CLI / cron / tests).
 *
 * Profile files live at custom/brand-profiles/{slug}.php and return a
 * plain associative array (ported from the SuiteCRM fork).
 */

namespace Espo\Custom;

final class BrandProfile
{
    private static ?array $cache = null;
    private static ?string $cacheKey = null;

    /** Returns the entire brand profile for the current tenant + profile. */
    public static function all(): array
    {
        $slug    = self::currentSlug();
        $profile = self::currentProfile();
        $key     = $slug . '/' . $profile;
        if (self::$cache !== null && self::$cacheKey === $key) {
            return self::$cache;
        }
        self::$cache    = self::load($slug, $profile);
        self::$cacheKey = $key;
        return self::$cache;
    }

    /** Dot-path getter: BrandProfile::get('kafka.brokers'). */
    public static function get(string $path, mixed $default = null): mixed
    {
        $node = self::all();
        foreach (explode('.', $path) as $seg) {
            if (!is_array($node) || !array_key_exists($seg, $node)) {
                return $default;
            }
            $node = $node[$seg];
        }
        return $node;
    }

    /** Tenant slug currently resolved. */
    public static function currentSlug(): string
    {
        $s = $_SERVER['ESPO_TENANT_SLUG'] ?? getenv('ESPO_TENANT_SLUG') ?: '';
        if ($s === '' || $s === 'master') {
            $s = 'btcl';
        }
        return strtolower($s);
    }

    /** Environment profile for the current request: dev | staging | prod. */
    public static function currentProfile(): string
    {
        $p = $_SERVER['ESPO_TENANT_PROFILE'] ?? getenv('ESPO_TENANT_PROFILE') ?: '';
        return strtolower($p ?: 'dev');
    }

    private static function load(string $slug, string $profile): array
    {
        $base = dirname(__DIR__, 3) . '/brand-profiles/';
        $candidates = [
            $base . $slug . '/' . $profile . '.php',
            $base . $slug . '/dev.php',
            $base . 'btcl/dev.php',
        ];
        foreach ($candidates as $file) {
            if (is_file($file)) {
                $data = require $file;
                return is_array($data) ? $data : [];
            }
        }
        return [];
    }
}

-- =============================================================================
-- EspoCRM — Admin API Key setup
-- =============================================================================
--
-- Purpose:
--   Grant API-key authentication to an admin-type User so that external
--   services (our Spring Boot proxy at /api/crm/*) can call EspoCRM endpoints
--   gated by the hard `$user->isAdmin()` check (User, Role, Team, AuthToken,
--   AuthLogRecord, ActionHistoryRecord, /Settings, etc.).
--
-- Why not an API-type user?
--   - Espo's User-management controllers require type IN ('admin','super-admin').
--   - API-type users fail isAdmin(), regardless of how permissive their Role is.
--   - User scope also deliberately doesn't offer level='all' in the ACL grid,
--     to prevent privilege escalation via roles.
--
-- Two modes:
--   A) Upgrade the existing 'admin' user in-place
--      Pros: single user. Cons: may disable password login for that user
--      depending on how Espo's auth flow treats authMethod=ApiKey.
--
--   B) Create a dedicated 'admin_api' user just for API access (recommended)
--      Pros: keeps the interactive admin login untouched.
--      Cons: one extra row.
--
-- Usage:
--   mysql -h 127.0.0.1 -u root -p123456 espocrm_acme < admin-api-key.sql
--
-- Then:
--   SELECT user_name, api_key FROM user WHERE user_name='admin_api';
--   -- Copy the api_key value into CRM_API_KEY for the Spring Boot api service,
--   -- then restart it.
-- =============================================================================

-- --------------------------------------------------------------------------
-- MODE B (recommended): dedicated admin_api user
-- --------------------------------------------------------------------------
-- Creates an 'admin_api' user with type=admin + authMethod=ApiKey + random key.
-- Safe to re-run: ON DUPLICATE KEY rotates the key for an existing admin_api.

INSERT INTO user
    (id, user_name, type, auth_method, api_key, is_active, created_at,
     first_name, last_name)
VALUES
    (UUID(), 'admin_api', 'admin', 'ApiKey',
     SHA2(CONCAT(RAND(), UNIX_TIMESTAMP(), 'admin_api'), 256),
     1, NOW(), 'Admin', 'API')
ON DUPLICATE KEY UPDATE
    type        = 'admin',
    auth_method = 'ApiKey',
    api_key     = SHA2(CONCAT(RAND(), UNIX_TIMESTAMP(), 'admin_api'), 256),
    is_active   = 1;

SELECT user_name, type, auth_method, api_key AS generated_api_key
FROM   user
WHERE  user_name = 'admin_api';

-- --------------------------------------------------------------------------
-- MODE A (alternative): upgrade existing 'admin' user. Uncomment to use.
-- --------------------------------------------------------------------------
-- UPDATE user
-- SET    auth_method = 'ApiKey',
--        api_key     = SHA2(CONCAT(RAND(), UNIX_TIMESTAMP(), user_name), 256)
-- WHERE  user_name   = 'admin'
--   AND  type        IN ('admin', 'super-admin');
--
-- SELECT user_name, type, auth_method, api_key AS generated_api_key
-- FROM   user
-- WHERE  user_name = 'admin';

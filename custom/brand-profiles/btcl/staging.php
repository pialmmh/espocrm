<?php
/**
 * BTCL Brand Profile — backend URLs and integrations.
 *
 * Ported from the SuiteCRM Contact Center fork
 * (custom/include/config/profiles/btcl.profile.php) to EspoCRM.
 * All URLs, broker lists, and endpoints specific to the BTCL deployment.
 *
 * Loaded by \Espo\Custom\BrandProfile::get(), keyed on the tenant slug
 * resolved in bootstrap.php. Safe to require directly — no SuiteCRM guards.
 */

return [
    'database' => [
        // Metadata only. Actual Espo DB connection uses
        // data/config-internal.php + bootstrap.php (ESPO_DB_NAME).
        'master' => [
            'host' => '10.10.194.10',
            'name' => 'btcl_contact_center',
        ],
    ],

    'kafka' => [
        'brokers' => '10.10.199.20:9092,10.10.198.20:9092,10.10.197.20:9092',
        'topics' => [
            'new_agent' => 'crm_new_agent',
        ],
        'producer' => [
            'socket_timeout_ms' => 30000,
            'message_timeout_ms' => 30000,
            'delivery_poll_timeout_ms' => 5000,
            'delivery_poll_iterations' => 50,
        ],
        'enabled' => true,
    ],

    'xmpp' => [
        'bosh_url' => 'https://hcc.btcliptelephony.gov.bd:30001/http-bind',
        'domain' => 'hcc.btcliptelephony.gov.bd',
        'api' => [
            'base_url' => 'https://hcc.btcliptelephony.gov.bd:30001',
            'conversations_endpoint' => '/conversations/{agent_username}',
            'conversation_messages_endpoint' => '/conversation/{agent_username}/{customer_id}',
        ],
        'connection' => [
            'timeout' => 10000,
            'ping_interval' => 60000,
        ],
    ],

    'recording' => [
        'api_url' => 'https://vbs.btcliptelephony.gov.bd:4000/FREESWITCHREST/api/recordings/v1/get-by-sip-call-id',
    ],

    'approval' => [
        'api_url' => 'https://vbs.btcliptelephony.gov.bd:4000/api/payment/approval/status-change',
    ],

    'webrtc' => [
        'server' => 'wss://hippbx.btcliptelephony.gov.bd:3050/ws',
    ],

    'sip' => [
        'proxy' => 'sip:hippbx.btcliptelephony.gov.bd',
    ],

    'sip_agent' => [
        'api_url' => 'https://vbs.btcliptelephony.gov.bd:4000/FREESWITCHREST/api/v1/extensions/create',
        'delete_url' => 'https://hcc.btcliptelephony.gov.bd/FREESWITCHREST/api/v1/extensions/delete',
    ],

    'call_center_agent' => [
        'create_url' => 'https://hcc.btcliptelephony.gov.bd/FREESWITCHREST/api/call-center/v1/agents/create',
        'delete_url' => 'https://hcc.btcliptelephony.gov.bd/FREESWITCHREST/api/call-center/v1/agents/delete',
    ],

    'logging' => [
        'kafka_level' => 'info',
        'xmpp_level' => 'info',
        'debug_enabled' => false,
    ],
];

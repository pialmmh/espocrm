<?php
return [
  'database' => [
    'host' => '127.0.0.1',
    'port' => '3306',
    'charset' => NULL,
    'dbname' => $_SERVER['ESPO_DB_NAME'] ?? 'espocrm_btcl',
    'user' => 'root',
    'password' => '123456',
    'platform' => 'Mysql'
  ],
  'smtpPassword' => NULL,
  'logger' => [
    'path' => 'data/logs/espo.log',
    'level' => 'WARNING',
    'rotation' => true,
    'maxFileNumber' => 30,
    'printTrace' => false,
    'databaseHandler' => false,
    'sql' => false,
    'sqlFailed' => false
  ],
  'restrictedMode' => false,
  'cleanupAppLog' => true,
  'cleanupAppLogPeriod' => '30 days',
  'webSocketMessager' => 'ZeroMQ',
  'clientSecurityHeadersDisabled' => false,
  'clientCspDisabled' => false,
  'clientCspScriptSourceList' => [
    0 => 'https://maps.googleapis.com'
  ],
  'adminUpgradeDisabled' => false,
  'isInstalled' => true,
  'microtimeInternal' => 1776372740.562894,
  'cryptKey' => '2b457b95f907d94855aceda749a45fbb',
  'hashSecretKey' => '99ee8e347707dbeb8dc779d8c9af7d60',
  'defaultPermissions' => [
    'user' => 33,
    'group' => 33
  ],
  'actualDatabaseType' => 'mariadb',
  'actualDatabaseVersion' => '10.11.14',
  'instanceId' => '2a19142b-8c52-4329-9b7c-de33e0781560',
  'apiSecretKeys' => (object) []
];

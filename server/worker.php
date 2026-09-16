<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit;
require __DIR__ . '/app.php';
$lock = fopen(__DIR__ . '/worker.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit;
try {
    db()->exec('DELETE FROM salkn_leads WHERE created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)');
    db()->exec('DELETE FROM salkn_rate_limits WHERE window_start < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 DAY)');
    $sent = deliverPending();
    file_put_contents(__DIR__ . '/worker-status.json', json_encode(['last_run' => gmdate('c'), 'sent' => $sent]));
} catch (Throwable $e) { error_log('SALKN: worker failed (' . get_class($e) . ')'); exit(1); }

<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit;
require __DIR__ . '/app.php';
try {
    $pdo = db();
    $pdo->exec("CREATE TABLE IF NOT EXISTS salkn_leads (
        id CHAR(36) PRIMARY KEY, payload_hash CHAR(64) NOT NULL,
        name VARCHAR(80) NOT NULL, phone VARCHAR(16) NOT NULL,
        service VARCHAR(60) NOT NULL, brand VARCHAR(30) NOT NULL, comment TEXT NOT NULL,
        consent_version VARCHAR(30) NOT NULL, consent_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL, INDEX (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS salkn_outbox (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, lead_id CHAR(36) NOT NULL, chat_id VARCHAR(30) NOT NULL,
        attempts INT UNSIGNED NOT NULL DEFAULT 0, next_attempt DATETIME NOT NULL, locked_until DATETIME NULL,
        sent_at DATETIME NULL, message_id VARCHAR(30) NULL, last_error VARCHAR(40) NULL,
        UNIQUE KEY recipient (lead_id, chat_id), INDEX pending (sent_at, next_attempt),
        CONSTRAINT salkn_outbox_lead FOREIGN KEY (lead_id) REFERENCES salkn_leads(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS salkn_rate_limits (
        bucket VARCHAR(64) NOT NULL, window_start DATETIME NOT NULL, hits INT UNSIGNED NOT NULL,
        PRIMARY KEY (bucket, window_start)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    echo "SALKN database ready\n";
} catch (Throwable $e) { fwrite(STDERR, "SALKN database initialization failed\n"); exit(1); }

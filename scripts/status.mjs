import { runRemote } from './hosting.mjs';

try {
  console.log(await runRemote('/opt/php/8.3/bin/php', `<?php
    require '/var/www/u3649492/data/salkn-private/app.php';
    $pdo = db();
    $leads = $pdo->query('SELECT COUNT(*) FROM salkn_leads')->fetchColumn();
    $q = $pdo->query('SELECT COUNT(*) AS total, SUM(sent_at IS NOT NULL) AS sent, SUM(sent_at IS NULL) AS pending, MAX(attempts) AS max_attempts FROM salkn_outbox')->fetch();
    $failed = $pdo->query('SELECT last_error, COUNT(*) AS total FROM salkn_outbox WHERE sent_at IS NULL GROUP BY last_error')->fetchAll();
    $worker = json_decode(file_get_contents('/var/www/u3649492/data/salkn-private/worker-status.json'), true);
    exec('crontab -l 2>/dev/null', $cron);
    echo json_encode(['leads'=>(int)$leads, 'delivery'=>$q, 'pending_errors'=>$failed, 'worker'=>$worker, 'scheduled'=>count(array_filter($cron, fn($s)=>str_contains($s, 'salkn-private/worker.php'))) === 1], JSON_UNESCAPED_SLASHES);
  `));
} catch { console.error('Could not read deployment status'); process.exitCode = 1; }

<?php
declare(strict_types=1);

const SALKN_CONSENT_VERSION = '2026-09-16.1';

function config(): array {
    static $config;
    return $config ??= json_decode(file_get_contents(__DIR__ . '/config.json'), true, 512, JSON_THROW_ON_ERROR);
}

function db(): PDO {
    static $pdo;
    if ($pdo) return $pdo;
    $c = config()['database'];
    $pdo = new PDO("mysql:host={$c['host']};port={$c['port']};dbname={$c['name']};charset=utf8mb4", $c['user'], $c['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function respond(int $code, array $data): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function checkOrigin(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (($origin !== '' && $origin !== config()['origin']) || ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
        respond(403, ['error' => 'Обновите страницу и отправьте заявку с сайта SALKN.']);
    }
}

function issueCsrf(): never {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') respond(405, ['error' => 'Метод не поддерживается.']);
    checkOrigin();
    $body = time() . '.' . bin2hex(random_bytes(24));
    $token = $body . '.' . hash_hmac('sha256', $body, config()['secret']);
    setcookie('__Host-salkn_form', $token, ['expires' => 0, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
    respond(200, ['csrf' => $token]);
}

function checkCsrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $parts = explode('.', $token);
    if (count($parts) !== 3 || !ctype_digit($parts[0]) || (int)$parts[0] > time() || (int)$parts[0] < time() - 7200 ||
        !hash_equals($_COOKIE['__Host-salkn_form'] ?? '', $token) ||
        !hash_equals(hash_hmac('sha256', $parts[0] . '.' . $parts[1], config()['secret']), $parts[2])) {
        respond(403, ['error' => 'Обновите страницу и попробуйте ещё раз.']);
    }
}

function cleanText(mixed $value, int $limit): string {
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || mb_strlen($value) > $limit) throw new InvalidArgumentException();
    return trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value));
}

function validateLead(array $input): array {
    $data = [
        'name' => cleanText($input['name'] ?? '', 80), 'phone' => cleanText($input['phone'] ?? '', 24),
        'service' => cleanText($input['service'] ?? '', 60), 'brand' => cleanText($input['brand'] ?? '', 30),
        'comment' => cleanText($input['comment'] ?? '', 1000),
    ];
    if (!preg_match('/^\+7[0-9]{10}$/D', $data['phone']) ||
        !in_array($data['service'], ['Кондиционер + установка', 'Только установка', 'Помогите выбрать'], true) ||
        !in_array($data['brand'], ['FUNAI', 'GREE', 'Kentatsu', 'Пока не знаю'], true) ||
        ($input['consent'] ?? false) !== true || ($input['website'] ?? '') !== '') throw new InvalidArgumentException();
    $id = $input['requestId'] ?? '';
    if (!is_string($id) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/Di', $id)) throw new InvalidArgumentException();
    return ['id' => strtolower($id), 'data' => $data];
}

function acceptLead(): never {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['error' => 'Метод не поддерживается.']);
    checkOrigin();
    checkCsrf();
    if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) respond(415, ['error' => 'Неверный формат запроса.']);
    $raw = file_get_contents('php://input', false, null, 0, 8193);
    if (strlen($raw) > 8192) respond(413, ['error' => 'Слишком длинное сообщение.']);
    try {
        $input = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($input)) throw new InvalidArgumentException();
        ['id' => $id, 'data' => $data] = validateLead($input);
    } catch (JsonException | InvalidArgumentException $e) { respond(422, ['error' => 'Проверьте телефон, выбранную услугу и согласие на обработку данных.']); }
    $payloadHash = hash('sha256', json_encode($data, JSON_UNESCAPED_UNICODE) . SALKN_CONSENT_VERSION);
    $pdo = db();
    $find = $pdo->prepare('SELECT payload_hash FROM salkn_leads WHERE id = ?');
    $find->execute([$id]);
    if ($existing = $find->fetch()) {
        if (!hash_equals($existing['payload_hash'], $payloadHash)) respond(409, ['error' => 'Данные заявки изменились. Обновите страницу и отправьте её заново.']);
        respond(200, ['ok' => true, 'id' => $id]);
    }
    try {
        $pdo->beginTransaction();
        // Store only keyed, hourly IP hashes. Never use untrusted forwarded headers.
        $window = gmdate('Y-m-d H:00:00');
        $ipKey = hash_hmac('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . $window, config()['secret']);
        foreach ([$ipKey => 10, 'global' => 120] as $key => $limit) {
            $q = $pdo->prepare('INSERT INTO salkn_rate_limits (bucket, window_start, hits) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE hits = hits + 1');
            $q->execute([$key, $window]);
            $q = $pdo->prepare('SELECT hits FROM salkn_rate_limits WHERE bucket = ? AND window_start = ?');
            $q->execute([$key, $window]);
            if ((int)$q->fetchColumn() > $limit) {
                $pdo->rollBack();
                header('Retry-After: 3600');
                respond(429, ['error' => 'Слишком много заявок. Позвоните нам: +7 993 419-99-54 или попробуйте позже.']);
            }
        }
        $q = $pdo->prepare('INSERT INTO salkn_leads (id, payload_hash, name, phone, service, brand, comment, consent_version, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())');
        $q->execute([$id, $payloadHash, $data['name'], $data['phone'], $data['service'], $data['brand'], $data['comment'], SALKN_CONSENT_VERSION]);
        $q = $pdo->prepare('INSERT INTO salkn_outbox (lead_id, chat_id, next_attempt) VALUES (?, ?, UTC_TIMESTAMP())');
        foreach (config()['telegram']['chat_ids'] as $chatId) $q->execute([$id, (string)$chatId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        // Concurrent retries of one request may hit the unique primary key.
        $find->execute([$id]);
        $existing = $find->fetch();
        if (!$existing || !hash_equals($existing['payload_hash'], $payloadHash)) throw $e;
    }
    // Persistence succeeded. Delivery failure must never turn success into a lost lead.
    try { deliverPending($id, 2); } catch (Throwable $e) { error_log('SALKN: delivery deferred to worker'); }
    respond(201, ['ok' => true, 'id' => $id]);
}

function deliverPending(?string $leadId = null, int $limit = 8): int {
    $pdo = db(); $sent = 0;
    for ($i = 0; $i < $limit; $i++) {
        $pdo->beginTransaction();
        $sql = 'SELECT id FROM salkn_outbox WHERE sent_at IS NULL AND next_attempt <= UTC_TIMESTAMP() AND (locked_until IS NULL OR locked_until < UTC_TIMESTAMP())';
        if ($leadId !== null) $sql .= ' AND lead_id = ?';
        $q = $pdo->prepare($sql . ' ORDER BY id LIMIT 1 FOR UPDATE');
        $q->execute($leadId === null ? [] : [$leadId]);
        $jobId = $q->fetchColumn();
        if (!$jobId) { $pdo->commit(); break; }
        $q = $pdo->prepare('UPDATE salkn_outbox SET locked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 90 SECOND), attempts = attempts + 1 WHERE id = ?');
        $q->execute([$jobId]);
        $pdo->commit();
        $q = $pdo->prepare('SELECT o.id AS job_id, o.chat_id, o.attempts, l.* FROM salkn_outbox o JOIN salkn_leads l ON l.id = o.lead_id WHERE o.id = ?');
        $q->execute([$jobId]); $job = $q->fetch();
        if (!$job) continue;
        $date = (new DateTimeImmutable($job['created_at'], new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Europe/Moscow'))->format('d.m.Y H:i');
        $message = "Новая заявка SALKN\n№ {$job['id']}\n{$date} (МСК)\n\nИмя: " . ($job['name'] ?: 'Не указано') . "\nТелефон: {$job['phone']}\nУслуга: {$job['service']}\nБренд: {$job['brand']}\nКомментарий: " . ($job['comment'] ?: 'Не указан') . "\n\nСогласие получено: {$job['consent_version']}\nИсточник: salkn.ru";
        $curl = curl_init('https://api.telegram.org/bot' . config()['telegram']['token'] . '/sendMessage');
        curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_POSTFIELDS => json_encode(['chat_id' => $job['chat_id'], 'text' => $message, 'link_preview_options' => ['is_disabled' => true]], JSON_UNESCAPED_UNICODE), CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_TIMEOUT => 6, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2]);
        $response = curl_exec($curl); $http = curl_getinfo($curl, CURLINFO_HTTP_CODE); $error = curl_errno($curl); curl_close($curl);
        $result = is_string($response) ? json_decode($response, true) : null;
        if ($http === 200 && ($result['ok'] ?? false) === true) {
            $q = $pdo->prepare('UPDATE salkn_outbox SET sent_at = UTC_TIMESTAMP(), message_id = ?, locked_until = NULL, last_error = NULL WHERE id = ?');
            $q->execute([(string)$result['result']['message_id'], $jobId]); $sent++;
        } else {
            $delay = min(3600, 60 * (2 ** min(6, (int)$job['attempts'] - 1)));
            $delay = max($delay, min(86400, (int)($result['parameters']['retry_after'] ?? 0)));
            $q = $pdo->prepare('UPDATE salkn_outbox SET next_attempt = ?, locked_until = NULL, last_error = ? WHERE id = ?');
            $q->execute([gmdate('Y-m-d H:i:s', time() + $delay), $error ? 'network_' . $error : 'http_' . $http, $jobId]);
        }
    }
    return $sent;
}

function api(string $route): never {
    ini_set('display_errors', '0');
    try {
        if ($route === 'session') issueCsrf();
        if ($route === 'lead') acceptLead();
        respond(404, ['error' => 'Страница не найдена.']);
    } catch (Throwable $e) {
        error_log('SALKN: request could not complete (' . get_class($e) . ')');
        respond(503, ['error' => 'Сейчас не удалось подтвердить приём заявки. Попробуйте ещё раз или позвоните: +7 993 419-99-54.']);
    }
}

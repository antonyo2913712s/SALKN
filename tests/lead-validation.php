<?php
declare(strict_types=1);

if (!function_exists('validateLead')) require __DIR__ . '/../server/app.php';
$base = ['requestId' => '12345678-1234-4234-8234-123456789abc', 'name' => '', 'phone' => '+79991234567',
    'service' => 'Кондиционер + установка', 'brand' => 'Пока не знаю', 'comment' => '', 'consent' => true, 'website' => ''];
$passed = 0;
foreach (['', 'Анна-Мария', 'Әлфия', 'O’Connor', "O'Connor", 'José', str_repeat('А', 60)] as $name) {
    $result = validateLead(array_replace($base, ['name' => $name, 'comment' => str_repeat('я', 1000)]));
    if ($result['data']['name'] !== $name) throw new RuntimeException('Valid name changed');
    $passed++;
}
foreach ([['name', str_repeat('А', 61)], ['name', 'Иван123'], ['name', 'Иван🧊'], ['name', '<Иван>'],
    ['name', '---'], ['name', "''"], ['name', "Иван\nИванов"], ['comment', str_repeat('я', 1001)],
    ['phone', '+7999123456'], ['phone', '+7999123456789'], ['phone', 'abc'], ['phone', '+7 (999) 123-45-67']] as [$key, $value]) {
    try { validateLead(array_replace($base, [$key => $value])); }
    catch (InvalidArgumentException) { $passed++; continue; }
    throw new RuntimeException("Invalid $key was accepted");
}
echo "Server validation: $passed cases passed; no database writes or messages.\n";

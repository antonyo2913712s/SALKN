# SALKN — публикация на REG.RU

Опубликовано 16.09.2026 по поручению владельца. Основной адрес https://salkn.ru/. HTTPS и перенаправления проверены на обоих доменах и www. DNS уже был настроен правильно, изменений не потребовалось.

## Инфраструктура

- REG.RU Host-0, ispmanager, server159.hosting.reg.ru, IPv4 31.31.196.161, IPv6 2a00:f940:2:2:1:1:0:159.
- DNS: ns1.hosting.reg.ru / ns2.hosting.reg.ru. Аккаунт: u3649492.
- Публичная папка: `/var/www/u3649492/data/www/salkn.ru`.
- Второй домен: `/var/www/u3649492/data/www/salkn.online`, перенаправление через `.htaccess`.
- Закрытый обработчик: `/var/www/u3649492/data/salkn-private`, каталог 0700, config.json 0600.
- PHP сайта и cron: `/opt/php/8.3/bin/php`, версия 8.3.31; curl, pdo_mysql, mbstring, openssl проверены.
- База u3649492_default; таблицы salkn_leads, salkn_outbox, salkn_rate_limits.
- Let's Encrypt: salkn.ru_le1 и salkn.online_le1, каждый покрывает основной домен и www. Выпуск и продление — ispmanager. При выпуске срок до 15.12.2026.
- В панели включены HTTP → HTTPS, www → основной адрес и gzip. `.htaccess` также приводит домены и `/index.html` к https://salkn.ru/.

## Заявки

Браузер → HTTPS PHP → транзакция MySQL (заявка и две записи очереди) → Telegram. Успех показывается после сохранения. Проверяются телефон, допустимые бренды/услуги, длины полей, согласие, Origin и CSRF. Есть honeypot и ограничения 10 заявок/час на IP, 120/час на сайт. IP хранится только как меняющийся каждый час HMAC-хеш. Cookie защиты формы — Secure, HttpOnly, SameSite=Strict.

Повтор одного requestId не создаёт новую заявку. Поля не попадают в журналы приложения. Сохраняются время и версия согласия 2026-09-16.1. Бот @salkn_order_bot отправляет полные поля двум согласованным получателям; другие пользователи автоматически не добавляются.

Каждую минуту cron запускает worker.php. Повторы идут с растущей задержкой до часа, учитывают retry_after Telegram. При редком обрыве после фактического принятия сообщения Telegram возможна повторная копия с тем же номером заявки. Контроль: `npm run hosting:status`.

Записи старше 90 дней удаляются из рабочей базы; записи ограничения частоты — через два дня. Досрочное удаление, копии в Telegram и резервные копии обслуживаются оператором отдельно. Внешний мониторинг и регулярные резервные копии MySQL ещё нужно оформить и проверить.

## Доступы и обновление

`.env.local` и `.local/` исключены из Git. Секреты не передаются в аргументах команд и не загружаются в dist/. В закрытом config.json только данные базы, ключ CSRF, токен бота и ID получателей, без пароля аккаунта хостинга/FTP. Проверка TLS и SSH host key не отключается.

GitHub использует существующий ключ `/Users/shakir/.ssh/id_ed25519_meritking`; ключ в проект не копируется. Доверенный ключ SSH хостинга находится в `.local/known_hosts`. Панель: `https://server159.hosting.reg.ru:1500/ispmgr`.

1. Проверить изменения и `npm run check`.
2. При изменении серверного кода/доступов: `node scripts/deploy.mjs prepare`. Загружает закрытый обработчик, конфигурацию, проверяет PHP и запускает добавочные миграции. Несовместимые миграции требуют отдельного плана.
3. `node scripts/deploy.mjs publish`: сохраняет архив текущих публичных папок, загружает dist/, проверяет PHP и устанавливает одно задание cron, сохраняя другие.
4. `npm run verify:live` и `npm run hosting:status`. Тестовую отправку включать явно, только при необходимости.
5. Закоммитить проверенные исходники без секретов и отправить в GitHub.

Первичная копия заглушек: `/var/www/u3649492/data/salkn-private/backups/public-2026-09-16T20-10-11-846Z.tar.gz`. Следующие публикации создают копии с новой датой. Папки release-* содержат публичные версии. Для восстановления сначала выбрать копию и сохранить текущее состояние, затем вернуть публичные файлы; закрытый обработчик и базу автоматически не откатывать. Эти архивы сохраняют файлы сайта, а не MySQL.

## Проверка запуска

- Все восемь HTTP/HTTPS-адресов ведут на https://salkn.ru/, сертификаты доверенные.
- Главная 200, неизвестный путь 404, .env.local/.git/config/закрытый config.json из интернета недоступны.
- Метаданные, canonical, Open Graph, JSON-LD, robots.txt и sitemap.xml используют основной домен. Главная открыта для индексации, юридические страницы noindex,follow.
- Некорректные телефон, бренд, согласие, Origin, CSRF, honeypot и длинный комментарий отклоняются.
- Две технические заявки (API и браузер), четыре подтверждённые доставки, ожидающих нет. Повтор requestId не создал дубль.
- Реальный успех и сброс полей в браузере, нет ошибок JavaScript; фотографии загружаются. Проверены ширины 1000 и 390 пикселей.

## Источники SEO и HTTPS

- [Яндекс: description](https://yandex.ru/support/webmaster/ru/indexing-options/description)
- [Яндекс: метатеги](https://yandex.ru/support/webmaster/ru/controlling-robot/metatags)
- [Яндекс: canonical](https://yandex.ru/support/webmaster/ru/robot-workings/canonical)
- [Яндекс: sitemap](https://yandex.ru/support/webmaster/ru/controlling-robot/sitemap)
- [Google: Organization](https://developers.google.com/search/docs/appearance/structured-data/organization)
- [REG.RU: Let's Encrypt](https://help.reg.ru/support/ssl-sertifikaty/3-etap-ustanovka-ssl-sertifikata/rasshireniye-let-encrypt-v-ispmanager)

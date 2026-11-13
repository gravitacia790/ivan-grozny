# Сервер чата в Яндекс Облаке

## Обновление 13 ноября 2026: GigaChat

Действующая функция теперь использует только GigaChat-3-Ultra, без внешнего
поиска Яндекса/OpenAI. Исходники `b3a3443`, версия `d4etl0ro393eo7rpjvdd`,
ACTIVE / `$latest`. Прежняя версия `d4eaqdviu0t0c5g0abmb` сохранена.
Ключ в Lockbox `e6q1h1qjjs5bt7rh0hfn`, версия `e6qot2080ecauatk66l9`,
запись `GIGACHAT_CREDENTIALS`; в окружение подключается только эта запись.
Статический интерфейс и адрес сервера прежние.

Для повторного развёртывания в команде ниже заменить `--environment` на:

```text
AI_PROVIDER=gigachat,GIGACHAT_MODEL=GigaChat-3-Ultra,GIGACHAT_SCOPE=GIGACHAT_API_PERS,TEACHER_MATERIALS_APPROVED=false,CHAT_ALLOWED_ORIGINS=https://gravitacia790.github.io
```

Параметр `--secret`:

```text
id=e6q1h1qjjs5bt7rh0hfn,version-id=e6qot2080ecauatk66l9,key=GIGACHAT_CREDENTIALS,environment-variable=GIGACHAT_CREDENTIALS
```

Актуальная среда Node.js 22 в Cloud Functions уже содержит Russian Trusted
Root CA. Не переопределять NODE_EXTRA_CA_CERTS в настройках версии:
[описание среды](https://yandex.cloud/ru/docs/functions/concepts/runtime/environment-variables).
Лимиты ресурсов оставлены прежними. GET подтвердил GigaChat без поиска,
CORS проверен; платная генерация агентом не запускалась.
Ниже — история размещения 12 ноября и прежняя конфигурация Яндекса.

Перенос завершён 12 ноября 2026 года (Москва). Интерфейс остаётся на
https://gravitacia790.github.io/ivan-grozny/ и обращается напрямую к
https://functions.yandexcloud.net/d4e15h0kkhld9p24dqgn .
Модель и поиск — Alice AI LLM через прежний API Yandex AI Studio.

## Рабочая конфигурация

- Cloud Functions `ivan-grozny-chat`, ID `d4e15h0kkhld9p24dqgn`.
- Активная версия `d4eaqdviu0t0c5g0abmb`, исходники `1d391f6`.
- Каталог `b1gm3n3fhf4mjnfcm42h`; Node.js 22, `handler.handler`.
- 512 MB, таймаут 90 секунд, concurrency 4; на зону один экземпляр,
  четыре одновременных запроса, provisioned instances 0.
- Служебный аккаунт `ivan-grozny-runtime`: `aje8liest3682e6ms1v6`.
- Lockbox `e6q1h1qjjs5bt7rh0hfn`, активная версия
  `e6qg2l1rcdh9n9g1lcqu`, запись `YANDEX_API_KEY`.
  Новый ключ пользователь сохранил вручную; значение не входит в сборку.
- У runtime есть чтение только этого секрета и ранее созданного закрытого реестра.
- Публичный HTTPS-вызов функции разрешён. CORS допускает Origin
  `https://gravitacia790.github.io`; посторонний Origin получает 403.
- Логирование отключено: консоль сообщала об ограничении сервиса логов.

В каталоге есть также пустой черновик Lockbox с тем же именем. Использовать
точные ID, не выбирать секрет по имени. Ключ OpenAI по решению пользователя
не перенесён. Старые подписи источников, созданные другим ключом, не проходят
проверку на новом сервере; сама переписка в браузере сохраняется.

## Повторное развёртывание

Из корня проекта после установки зависимостей:

```sh
npm run test:api
npm run typecheck
npm run test:yandex-function
yc serverless function version create \
  --function-name ivan-grozny-chat \
  --runtime nodejs22 --entrypoint handler.handler \
  --memory 512MB --execution-timeout 90s --concurrency 4 \
  --service-account-id aje8liest3682e6ms1v6 \
  --source-path .yandex-function \
  --environment AI_PROVIDER=yandex,YANDEX_FOLDER_ID=b1gm3n3fhf4mjnfcm42h,YANDEX_MODEL=aliceai-llm/latest,YANDEX_RESEARCH_MODEL=aliceai-llm/latest,TEACHER_MATERIALS_APPROVED=false,CHAT_ALLOWED_ORIGINS=https://gravitacia790.github.io \
  --secret id=e6q1h1qjjs5bt7rh0hfn,version-id=e6qg2l1rcdh9n9g1lcqu,key=YANDEX_API_KEY,environment-variable=YANDEX_API_KEY \
  --no-logging
yc serverless function set-scaling-policy --name ivan-grozny-chat \
  --tag '$latest' --zone-instances-limit 1 --zone-requests-limit 4 \
  --provisioned-instances-count 0
```

Сборщик переносит существующие серверные модули в CommonJS без runtime-зависимостей.
Адаптер преобразует HTTPS-событие в Request и возвращает прежний Response.
Правила персонажа, поиск, источники, лимитер и итог урока остаются в исходном
`app/api/chat/route.ts`. Родительская папка и API.rtf не загружаются.

Статическая сборка интерфейса:

```sh
NEXT_PUBLIC_CHAT_API_URL=https://functions.yandexcloud.net/d4e15h0kkhld9p24dqgn npm run build:pages
```

Публикуется только `.next-pages/` в `gh-pages`. Последняя версия `caf9344`,
публикация GitHub Actions `43100587628` — completed/success.
Публичный HTML содержит новый JS-бандл `2vg3kl5aaldgj.js`; в сборке нет старого
адреса Vercel или обнаруженных шаблонов ключей.

## Проверки

- Локальные typecheck, test:api, test:yandex-function и статическая сборка прошли.
  Проверки адаптера выполняются без сети и без модели: GET, CORS, OPTIONS,
  неподдерживаемый метод, UTF-8/base64, некорректный JSON.
- Публичный GET → 200, provider=yandex, configured=true; OPTIONS → 204;
  чужой Origin → 403.
- Живой вопрос о родителях → 200 за 11,9 секунды, названы Василий III
  и Елена Глинская. По подписанной квитанции возвращены три источника → 200.
- Итог этой беседы → 200 за 1,6 секунды, все три раздела присутствуют.
  Эти пробы подтверждают работоспособность сценариев, а не историческую
  достоверность всех будущих ответов или качество каждого итога.

В Яндекс Браузере на опубликованной странице подтверждены статус ключа и
ответ на «Покажи источники» без вызова модели. Фактически загруженный публичный
JS-бандл содержит адрес новой функции, старого адреса Vercel в нём нет.

## Предыдущая попытка с контейнером

Созданный контейнер `bbatab3hsdebeh7r2908` не используется сайтом.
Его публичный доступ закрыт; диагностическая ревизия заменена обратно на
ревизию приложения `bbar8tc2ds93s9087uk8`. Минимум экземпляров 0.
Закрытый реестр `crpaotqo0rjcfj0qv4ab` содержит образ
`cr.yandex/crpaotqo0rjcfj0qv4ab/ivan-chat:e1234f8`, digest
`sha256:5c7e33e4ea19311d95b3bea6d03759e0850c3e17bf0f2429a29a46887f8e9e6b`.

Ревизии получали ACTIVE, но публичный HTTP не ответил даже за 105 секунд.
Минимальный HTTP-сервер в том же образе также не ответил; та же standalone-сборка
локально в Cloud Shell вернула 200. Причина не установлена. Для рабочего
размещения использована Cloud Functions без Docker.
Vercel не удалён, новый ключ туда не переносился; его работоспособность после
смены ключа не проверена. Для отката недостаточно обещать старый сервер рабочим:
сначала потребуется проверить его настройки и ключ.

## Оплата и ограничения

Платное размещение согласовано пользователем. Для функции 512 MB при 1000
вызовах по 30 секунд вычисления составляют около 27 ₽ до бесплатного объёма.
Модель, поиск, Lockbox и хранение образов оплачиваются отдельно. Это оценка,
а не жёсткий бюджет. Лимиты экземпляров действуют на зону, а ограничение
запросов приложения хранится в памяти процесса и не является лимитом расходов.

Официальные инструкции:
- https://yandex.cloud/ru/docs/functions/operations/function/version-manage
- https://yandex.cloud/ru/docs/functions/operations/function/scaling-settings-add
- https://yandex.cloud/ru/docs/functions/pricing

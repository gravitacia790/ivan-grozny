# Перенос сервера чата в Яндекс Облако

Подготовка: 11 ноября 2026 года. Развёртывание пока не выполнено.
Пользователь согласовал создание платного контейнера по предложенной
конфигурации. Создан контейнер `ivan-grozny-chat`, ID `bbatab3hsdebeh7r2908`;
ревизия с приложением ещё не создана.
Создан закрытый реестр `ivan-grozny-chat`, ID `crpaotqo0rjcfj0qv4ab`.
Интерфейс остаётся на https://gravitacia790.github.io/ivan-grozny/.
Переносится Next.js-сервер с `/api/chat`, поиском и итогами урока.
Модель остаётся Alice AI LLM через Yandex AI Studio.

## Выбранная конфигурация

- Yandex Serverless Containers, регион Россия; существующий Dockerfile.
- Каталог `b1gm3n3fhf4mjnfcm42h` — необходимо проверить доступ и биллинг.
- Начальные параметры: 1 vCPU, 512 MB RAM, таймаут 90 секунд,
  concurrency 4, min-instances 0, zone-instances-limit 1.
- Docker-образ Linux amd64 хранится в закрытом Yandex Container Registry.
- Ключ модели — секрет Lockbox, передаваемый серверу как `YANDEX_API_KEY`.
- Сервисному аккаунту нужны права чтения именно этого образа и секрета.
  Административные роли приложению не нужны.

Ограничение экземпляров задаётся на зону, а не на весь сервис.
Текущий лимитер приложения действует в памяти отдельного процесса и не является
глобальным лимитом расходов. Нулевой минимум допускает холодный запуск.

## Сборка

Из корня `ivan-grozny/`, на машине с Docker:

```sh
npm run test:api
npm run build
docker build --platform linux/amd64 -t cr.yandex/REGISTRY_ID/ivan-chat:VERSION .
docker push cr.yandex/REGISTRY_ID/ivan-chat:VERSION
```

`REGISTRY_ID` и `VERSION` заменить фактическими значениями. Секреты для сборки
не нужны. Не загружать родительскую папку, API.rtf или локальные env-файлы.
Локально Docker и yc в PATH не обнаружены; Docker-сборка пока не проверена.
В Cloud Shell также нет Docker. Проверена сборка standalone на Linux
с Node.js 22.23.5, установленным во временную папку с проверкой SHA-256.
Образ собирается crane 0.22.1: слой `app/` со standalone добавляется к
официальному `node:22-bookworm-slim`, задаются рабочая папка `/app`, UID 1000,
CMD `node server.js`, HOSTNAME=0.0.0.0 и NODE_ENV=production. Ключей в слое нет.
Перед итоговой сборкой обновить исходники: первоначальное клонирование GitHub
получило старый b4adf10, а актуальная локальная версия — 6ba85df с итогами урока.

## Серверные настройки

```text
AI_PROVIDER=yandex
YANDEX_FOLDER_ID=b1gm3n3fhf4mjnfcm42h
YANDEX_MODEL=aliceai-llm/latest
YANDEX_RESEARCH_MODEL=aliceai-llm/latest
TEACHER_MATERIALS_APPROVED=false
CHAT_ALLOWED_ORIGINS=https://gravitacia790.github.io
```

`YANDEX_API_KEY` подключить из Lockbox. При переносе старых подписанных списков
источников сохранить действующий секрет подписи как `SOURCE_RECEIPT_SECRET`.
Если это невозможно, старую библиографию проверить отдельно: подписи,
созданные с другим секретом, не будут приниматься. Секреты не помещать
в Dockerfile, исходники, GitHub Pages или команды в истории терминала.

После создания реестра, контейнера, сервисного аккаунта и секрета:

```sh
yc serverless container revision deploy \
  --container-id CONTAINER_ID \
  --image cr.yandex/REGISTRY_ID/ivan-chat:VERSION \
  --service-account-id SERVICE_ACCOUNT_ID \
  --cores 1 --memory 512MB --execution-timeout 90s \
  --concurrency 4 --min-instances 0 --zone-instances-limit 1 \
  --environment AI_PROVIDER=yandex,YANDEX_FOLDER_ID=b1gm3n3fhf4mjnfcm42h,YANDEX_MODEL=aliceai-llm/latest,YANDEX_RESEARCH_MODEL=aliceai-llm/latest,TEACHER_MATERIALS_APPROVED=false,CHAT_ALLOWED_ORIGINS=https://gravitacia790.github.io \
  --secret id=SECRET_ID,key=YANDEX_API_KEY,environment-variable=YANDEX_API_KEY
```

Это шаблон: все обозначенные идентификаторы заменить реальными.
При сохранении прежней подписи добавить второй секрет для
`SOURCE_RECEIPT_SECRET`. Порт задаёт платформа через `PORT`;
standalone-сервер уже слушает `0.0.0.0`.

## Проверка и переключение

1. Получить HTTPS-адрес контейнера из консоли. Разрешить публичный вызов
   именно контейнера; реестр и секрет оставить закрытыми.
2. Проверить GET и OPTIONS `/api/chat` с Origin
   `https://gravitacia790.github.io`: provider=yandex, configured=true,
   корректные CORS-заголовки. Посторонний Origin должен отклоняться.
3. После согласования расходов проверить один ответ, его источники и итог урока.
4. Собрать Pages с `NEXT_PUBLIC_CHAT_API_URL=<HTTPS-адрес контейнера>/api/chat`
   командой `npm run build:pages`. Опубликовать только `.next-pages/`.
5. Проверить вопрос и итог из браузера на опубликованной странице, затем
   отсутствие обращений к Vercel в новом бандле. Предыдущий сервер сохранить
   до завершения проверки. Для отката вернуть прежний адрес API и сборку Pages.

## Стоимость и текущий доступ

Создание платных ресурсов требует согласования. Работа модели и поиска
оплачивается отдельно от хостинга, как и раньше.
Контейнер тарифицируется по вызовам, CPU и памяти во время обработки;
хранение образа и секрета имеет отдельную тарификацию. До запуска проверить
тариф аккаунта, доступный бесплатный объём и согласовать бюджет.

Официальные инструкции:
- https://yandex.cloud/ru/docs/serverless-containers/quickstart/container
- https://yandex.cloud/ru/docs/serverless-containers/pricing
- https://yandex.cloud/ru/docs/container-registry/pricing
- https://yandex.cloud/en/docs/cli/cli-ref/serverless/cli-ref/v0/container/revision/deploy

Консоль в браузере открылась после длительной загрузки: доступ к каталогу
и создание контейнера подтверждены. Ранее контейнеров не было.
Права развёртывания образа и условия биллинга ещё нужно проверить.
В редакторе показано: «Логирование недоступно. Платформа работает
в ограниченном режиме». Действующий сайт не переключён, новые ключи
не выпускались. Локальные test:api и production build прошли.

# TrapHata Gallery

Галерея картинок для [rasmusvraa.site](https://rasmusvraa.site): загрузка, рамки, скачивание, мини-админка.

## Локальный запуск

```bash
cp .env.example .env
npm install
npm start
```

Откройте http://127.0.0.1:3010

## Деплой

1. Скопируйте `deploy/deploy.local.env.example` → `deploy/deploy.local.env` и заполните доступ к VPS.
2. На сервере создайте `/var/www/rasmusvraa/.env` из `.env.example` (пароль админки).
3. Запуск: `py -3 deploy/deploy.py`

Сайт ставится в `/var/www/rasmusvraa` на порту `3010`, отдельно от других vhost на той же машине.

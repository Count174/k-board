# o-board — лендинг

Лендинг приложения o-board, построенный на философии **ouibaitori** (桜梅桃李).

## Стек
- React 18 + TypeScript + Vite
- Tailwind CSS v3 (дизайн-система через CSS-токены в `src/index.css`)
- shadcn/ui компоненты
- React Router

## Запуск локально
```bash
npm install   # или: bun install
npm run dev   # http://localhost:8080
```

## Сборка для продакшена
```bash
npm run build      # собирает в /dist
npm run preview    # локальный предпросмотр сборки
```

## Деплой на сервер

### Вариант 1: статический хостинг (Netlify, Vercel, Cloudflare Pages)
Загрузите содержимое `/dist` после `npm run build`. SPA-fallback на `index.html`.

### Вариант 2: Nginx
```nginx
server {
    listen 80;
    server_name o-board.ru;
    root /var/www/o-board/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кеширование статики
    location ~* \.(js|css|png|jpg|jpeg|gif|webp|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Вариант 3: Docker
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## Структура

```
src/
├── components/
│   ├── landing/
│   │   ├── Navbar.tsx        # Шапка с лого 桜
│   │   ├── Hero.tsx          # Главный экран + лепестки сакуры
│   │   ├── Petals.tsx        # CSS-анимация падающих лепестков
│   │   ├── Philosophy.tsx    # Манифест ouibaitori
│   │   ├── Features.tsx      # Bento-сетка из 6 модулей
│   │   ├── HowItWorks.tsx    # Путь: 種 → 庭 → 花
│   │   ├── CTA.tsx           # Финальный призыв
│   │   └── Footer.tsx
│   └── ui/                   # shadcn компоненты
├── pages/
│   ├── Index.tsx             # Главная страница лендинга
│   └── NotFound.tsx
├── index.css                 # Дизайн-система (HSL токены, ouibaitori палитра)
└── main.tsx
```

## Дизайн-система

Все цвета, градиенты и анимации определены через CSS-переменные в `src/index.css`.
Никаких хардкод-классов в компонентах.

**Палитра:**
- Фон: глубокий ink-charcoal `hsl(160 18% 5%)`
- Mint (рост, листва): `hsl(155 80% 58%)`
- Sakura (цветение, акцент): `hsl(340 75% 75%)`
- Coral (тепло, забота): `hsl(12 88% 65%)`

**Шрифты (Google Fonts):**
- Space Grotesk — заголовки
- Inter — основной текст
- Shippori Mincho — кандзи и японские акценты

## Лицензия
© o-board, 2026

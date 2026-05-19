# Oubaitori iOS

Нативное приложение (SwiftUI). Веб-проект в `frontend/` и `backend/` **не затрагивается**.

## Требования

- **Xcode 15+** (из App Store — этого достаточно, XcodeGen не нужен)
- iOS 17+
- Apple ID / Developer account (для запуска на устройстве или TestFlight)

## Способ 1: открыть готовый проект (рекомендуется)

В репозитории уже лежит сгенерированный проект:

```bash
open ios/Oubaitori/Oubaitori.xcodeproj
```

1. Вверху Xcode выберите схему **Oubaitori** и симулятор (например **iPhone 17**).
2. **Signing & Capabilities** → своя **Team** (для симулятора можно Personal Team).
3. При необходимости измените `API_BASE_URL` в `Oubaitori/Info.plist`.
4. **Product → Run** (⌘R).

Если проект не открывается («damaged» / parse error) или кнопка Run неактивна — пересоздайте `.xcodeproj`:

```bash
./ios/scripts/generate-xcodeproj.sh
# или
python3 ios/scripts/generate_xcodeproj.py
```

Затем закройте Xcode и снова `open ios/Oubaitori/Oubaitori.xcodeproj`.

Если добавили новые `.swift` файлы — тот же скрипт:

```bash
python3 ios/scripts/generate_xcodeproj.py
```

(нужен только Python 3, без Homebrew и XcodeGen)

## Способ 2: создать проект вручную в Xcode

Если `.xcodeproj` не открывается или хотите всё с нуля:

1. **File → New → Project** → iOS → **App**
2. Product Name: `Oubaitori`, Interface: **SwiftUI**, Language: **Swift**
3. Сохраните в `ios/Oubaitori/` (рядом с папкой `Oubaitori/` с исходниками).
4. Удалите из таргета автоматически созданные `ContentView.swift` и т.п.
5. Перетащите папку `Oubaitori/` (исходники) в навигатор проекта → **Create groups**, галочка **Copy items if needed** — **снята**.
6. **Build Settings** → `Info.plist File` = `Oubaitori/Info.plist`, `Generate Info.plist` = No.
7. Добавьте `Assets.xcassets` в **Copy Bundle Resources**.
8. Signing → Team, Run.

## Backend и авторизация

На сервере:

```bash
# в .env
JWT_SECRET=<длинная_случайная_строка>

node backend/db/migrate_mobile_auth.js
pm2 restart …
```

Подробнее: [docs/MOBILE_AUTH.md](../docs/MOBILE_AUTH.md)

## Архитектура

- **MVVM** + `Repository` на домен
- **Keychain** — access/refresh токены
- **URLSession** — REST к существующему backend

## Дизайн

Токены и компоненты по iOS-макетам в `Core/DesignSystem/`:

- `DesignTokens` — цвета (mint / sakura / coral), типографика, радиусы
- `OBScreenBackground`, `OBCard`, `OBButton`, прогресс-бары, сегменты, иероглифы

## Структура

```
ios/Oubaitori/
  Oubaitori.xcodeproj    ← открывать в Xcode
  Oubaitori/             ← исходники Swift
  project.yml            ← только для XcodeGen (опционально)
```

# Server Defender

DDoS-Guard themed tower defense — Phaser 3 + React + TypeScript.

Уничтожай вредоносные запросы, нажимая на них в зоне файрвола. Пропустил — сервер получает урон. Продержись как можно дольше!

## Стек

| Слой    | Технология              |
|---------|-------------------------|
| Движок  | Phaser 3.90             |
| UI      | React 19 + TypeScript   |
| Сборщик | Vite 6                  |
| Стили   | SCSS (Sass)             |

## Структура проекта

```
src/
├── app/                    # React-точка входа
│   ├── App.tsx
│   └── styles/             # Глобальные стили (reset, переменные CSS)
├── game/                   # Phaser-логика
│   ├── background/         # Анимация фона со звёздами
│   ├── config/             # Константы игры и фабрика Phaser.Game
│   ├── core/               # EventBus (React ↔ Phaser)
│   ├── hud/                # HUD (очки, таймер, жизни)
│   ├── scenes/             # Phaser-сцены: Boot → Preloader → MainMenu → Game → GameOver
│   └── systems/enemy/      # Система врагов: типы, конфиг, трейлы, эффекты
├── shared/
│   ├── phaser/             # React-обёртка для Phaser (PhaserGame.tsx)
│   └── ui/                 # Переиспользуемые компоненты (Button, Layout)
└── widgets/                # Составные блоки (IntroModal, GameOverScreen)
```

## Запуск

```bash
npm install
npm run dev          # http://localhost:5000
```

## Сборка

```bash
npm run build        # → dist/
npm run preview      # превью собранной версии
```

## Прочие команды

```bash
npm run typecheck    # проверка типов без сборки
npm run lint         # ESLint
```

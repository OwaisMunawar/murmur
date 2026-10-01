# Contributing

Thanks for taking a look. Murmur is a small codebase with strong opinions about privacy, so a few rules matter more than usual.

## Setup

```bash
npm install
npx expo run:ios                       # development build; Expo Go cannot load the native modules
EXPO_PUBLIC_DEMO=1 npx expo run:ios    # demo mode: fictional notes and deterministic engines
```

CocoaPods needs a UTF-8 locale (`export LANG=en_US.UTF-8`) or `pod install` fails on Ruby's string encoding.

## Before you open a pull request

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run doctor
```

CI runs the same commands, then builds the iOS development build and an Android debug APK.

## Ground rules

- **No network calls outside the model downloader.** `src/features/models/engine/executorchModelDownloader.ts` is the only file allowed to reach the network. The ESLint rule and `src/__tests__/privacy.test.ts` will fail otherwise. If a change genuinely needs the network, update the Privacy screen, the README and ADR-006 in the same pull request.
- **Domain logic stays pure.** Code in any `lib/` folder may not import React, React Native, Expo or Skia. Put it there whenever it can be, and test it there.
- **Engines go behind their interface.** New model work implements `SpeechToText`, `TextGenerator` or `Embedder` and gets a fake, so demo mode and tests keep working.
- **Migrations are append-only.** Never edit a shipped migration in `src/core/db/migrations.ts`; add a new version.
- **Typed errors.** Throw `AppError` with a code from `ErrorCodes`; screens branch on codes, never on message text.
- **Accessibility.** Every pressable has a role and a label; icon-only buttons require one.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `feat(ask): ...`, `fix(recording): ...`, `docs: ...`. Keep each commit small and passing typecheck.

## Model weights

Never commit model files. They are downloaded at runtime, and `.gitignore` excludes `*.pte`.

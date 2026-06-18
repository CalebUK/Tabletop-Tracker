# Board Game Keeper — agent notes

Expo SDK 56 + React Native 0.85 + TypeScript. Local-first; data in on-device
SQLite (`expo-sqlite` async API). See `README.md` for features and layout.

## Conventions
- DB access goes through `src/db/*` — screens never open the database directly.
- `getDb()` returns one shared, lazily-initialized connection.
- DB rows are snake_case; map them to camelCase domain types in the `db` layer.
- Theme tokens live in `src/theme.ts` — no hard-coded colors in screens.
- Photos are copied into app storage via `src/lib/images.ts` (never store the
  raw picker cache URI).
- Routes above the tabs (GameDetail, EditGame, LogPlay) are typed in
  `src/navigation.ts`.

## Gotchas
- Expo SDK 56 changed APIs. Check https://docs.expo.dev/versions/v56.0.0/ for
  exact signatures before adding native modules.
- `expo-file-system` legacy API is imported from `expo-file-system/legacy`.
- Camera/photo/SQLite only work on a device or simulator, not `expo start --web`.

## Validate changes
- `npx tsc --noEmit` — typecheck.
- `npx expo export --platform android --output-dir <tmp>` — full bundle smoke test.

# Board Game Keeper (BGK)

A local-first mobile app for cataloguing your board game collection, tracking
plays, and finding the right game for tonight.

Built with **Expo + React Native + TypeScript**, storing everything on-device in
**SQLite**. The data model is structured so cloud sync / accounts / a web view
can be added later without a rewrite.

## Features (prototype)

- **Collection** — add games with a photo (camera or library), storage location,
  player count, play time, year, developer, personal star rating (half-stars),
  favorite flag, custom tags (remembered for reuse), notes, and house rules.
  Swipe a card right to edit, left to loan it out.
- **Identify a game** three ways: search BoardGameGeek by name, **scan its
  barcode** (camera → UPC lookup → BGG), or **scan the name from a photo**
  (OCR → BGG). Any of them auto-fills year, players, play time, developer,
  cover image, and the geek rating.
- **10-star personal rating** (half-stars) to match BoardGameGeek's scale.
- **Loans** — record who you loaned a game to and when; loaned games show
  "Loaned to X" in place of their shelf location until marked returned. Full
  **loan history** per game.
- **Search** — filter by text, tags, favorites, unplayed, play length
  (15/30/60 / 60+ min), and player count (1–6 / 7+). Results show ratings
  and location.
- **Plays** — log who played and who won; tap a play to edit it, long-press to
  delete (with confirmation). Play history per game.
- **Stats** — totals, top players (by wins), most-played games, unplayed count.

Dates are shown in UK format (DD/MM/YYYY) throughout.

## Running it on your phone

1. Install the **Expo Go** app from the App Store / Play Store.
2. In this folder, start the dev server:
   ```
   npm start
   ```
3. Scan the QR code with your phone (Camera app on iOS, Expo Go on Android).
   The app loads live — edits to the code refresh instantly.

> Note: the camera/photo and SQLite features run on a real device or simulator.
> They do **not** work in the `npm run web` preview.

## Project layout

```
App.tsx                 Navigation (bottom tabs + stack)
src/
  theme.ts              Colors, spacing, radius tokens
  types.ts              Shared TypeScript types
  navigation.ts         Route param types
  db/
    database.ts         SQLite connection + schema
    games.ts            Game CRUD + search query + tags
    plays.ts            Play logging + stats aggregates
  lib/
    images.ts           Pick/take photo, persist to app storage
  components/
    GameCard.tsx        Collection list row
    StarRating.tsx      Reusable 1–5 star control
  screens/
    CollectionScreen.tsx
    SearchScreen.tsx
    StatsScreen.tsx
    GameDetailScreen.tsx
    EditGameScreen.tsx
    LogPlayScreen.tsx
```

## OCR / barcode notes

- Barcode scanning uses `expo-camera`; the UPC is resolved to a product name
  via upcitemdb's free trial endpoint, then searched on BGG.
- OCR uses ocr.space. It ships with the public `helloworld` demo key (rate
  limited); for regular use, get a free key at https://ocr.space/ocrapi and set
  `OCR_API_KEY` in `src/lib/identify.ts`.

## Backup & export

- **Full backup** (⚙️ in the Collection header → Backup & Export): exports a
  single JSON file containing every table plus photos (base64) that can be
  re-imported on a new device. Import **replaces** all current data.
- **CSV export**: a spreadsheet-friendly list of the collection (no photos /
  play history). See `src/db/backup.ts`.

## Roadmap (not yet built)

- Opt-in cloud sync + accounts (e.g. Supabase) and web viewing — deferred;
  revisit when multi-device or the website is actually wanted.
- AI-vision box recognition (needs a paid vision API key).
- Wishlist, BGG collection import.

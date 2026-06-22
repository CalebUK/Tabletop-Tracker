# Tabletop Tracker

A mobile app for cataloguing your board game collection, tracking plays, finding
the right game for tonight, and sharing your collection with friends.

Built with **Expo (SDK 56) + React Native + TypeScript**. Your collection is
stored on-device in **SQLite**; the optional online library uses **Firebase**.

GitHub: https://github.com/CalebUK/Tabletop-Tracker

## Features

- **Collection** — add games with a photo (camera or library), storage location,
  player count, play time, minimum age, complexity, edition, year,
  publisher/designer, personal 10-star rating (half-stars), favourite flag,
  custom tags and categories (remembered for reuse), notes and house rules.
  Cards show player count and play time. Toggle between a **list** and a **photo
  grid**, sort (name / rating / times-played / last-played / date-added, each
  reversible), and filter by location/favourites. Swipe a card → to edit, ← to
  loan, or hold to log a play.
- **Wishlist** — a toggle at the top of the Collection switches to games you'd
  love to own. If a linked friend's library has one, it flags **who can lend it**,
  and it suggests games from friends whose ratings line up with yours. One tap
  moves a game into your collection.
- **BoardGameGeek lookup** — one tap fills in players, play time, minimum age,
  publisher, cover image, the BGG rating and BGG complexity. Results are ranked
  so the game you mean surfaces first. (Requires a BGG app token — see below.)
- **Plays & gaming groups** — log who played, who won and each player's **score**.
  Create groups (e.g. a weekly game night) with their own stats. Per-game stats
  show a **top-3 score leaderboard** (who and when); per-player and per-group
  stats too, with "see all" leaderboards and tap-through that stays group-scoped.
  You can log games you don't own (guests).
- **Search** — by player count (counts expansions), play time, **player age**
  (shows games that age can play), complexity, personal rating, category and
  tags. **At home** hides games out on loan; "Feeling lucky" picks a random match.
- **Loans** — record who borrowed a game and when, with an optional proof photo
  (deleted on return) and a full loan history.
- **Online library (opt-in)** — publish your collection to get a share code;
  friends enter the code to view it. "Browse all games" merges everyone's
  collections into a **realistic bookcase** you can search and sort. No photos or
  personal info are shared. See `FIREBASE_SETUP.md`.
- **Backup & export** — full JSON backup (incl. photos) to move devices, plus a
  CSV export. A first-run **walkthrough** introduces the app.

Dates are shown in UK format (DD/MM/YYYY) throughout.

## Running it locally

This app uses native modules and SDK 56, so **Expo Go won't work** — you need a
**development build** (built once via EAS), then:

1. Install the development build APK on your device (from an
   `eas build --profile development` build).
2. Create `.env.local` in the project root with your BGG token (git-ignored):
   ```
   EXPO_PUBLIC_BGG_TOKEN=your-token-here
   ```
3. Start the dev server and open the app:
   ```
   npx expo start --dev-client
   ```
   JavaScript changes hot-reload; only new native modules require a rebuild.

## Validate changes

- `npx tsc --noEmit` — typecheck
- `npx expo export --platform android --output-dir <tmp>` — full bundle smoke test

## Project layout

```
App.tsx                  Navigation (bottom tabs + stack) + onboarding provider
src/
  theme.ts               Colours, spacing, radius tokens
  types.ts               Shared TypeScript types
  navigation.ts          Route param types
  db/
    database.ts          SQLite connection, schema, migrations
    games.ts             Game CRUD, search, tags/categories, locations, loans
    plays.ts             Play logging, edit, per-game/player stats
    groups.ts            Gaming groups + per-group stats
    library.ts           Local record of my library + saved friend codes
    backup.ts            Full JSON backup/restore + CSV export
    meta.ts              Key/value store (flags, onboarding, etc.)
  lib/
    images.ts            Pick/take photo, persist to app storage
    dates.ts             UK date formatting
    bgg.ts               BoardGameGeek XML API client (token + ranking)
    format.ts            Number rounding helpers
    firebase.ts          Lazy Firebase init (auth + firestore)
    firebaseConfig.ts    Firebase web config (public by design)
    onlineLibrary.ts     Publish/fetch/delete libraries; aggregate all games
  components/
    GameCard.tsx         Collection list row
    StarRating.tsx       10-star control (half-stars)
    SwipeableRow.tsx     Swipe-to-edit/loan wrapper
    OnboardingProvider.tsx  First-run walkthrough carousel
  screens/
    CollectionScreen, SearchScreen, StatsScreen, LibraryScreen,
    GameDetailScreen, EditGameScreen, LogPlayScreen, LoanScreen,
    PlayerStatsScreen, GameStatsScreen, GroupStatsScreen, LeaderboardScreen,
    FriendLibraryScreen, BrowseAllScreen, BackupScreen, AboutScreen
```

## Other docs

- `FIREBASE_SETUP.md` — Firebase project + Firestore security rules for the library
- `STORE_LISTING.md` — Play Store listing copy + data-safety/content-rating answers
- `GOING_PUBLIC.md` — launch checklist for going from testing to public
- `PRIVACY.md` — privacy policy (also the hosted policy URL)

## Roadmap (not yet built)

- Web viewing of libraries.
- "Haven't-played-in-a-while" surfacing.
- BGG collection import.
- Firebase App Check + API-key restriction before a wide public launch.

# BoardGameGeek API setup

As of 2025/2026, BoardGameGeek's XML API requires a **registered application
and a Bearer token**. Without one, automatic lookups return `401` and the app
falls back to the manual "BGG rating" field. Here's how to enable lookups.

## 1. Register an application (one time, free)

1. Go to https://boardgamegeek.com/applications (logged in to your BGG account).
2. Click to **create an application**.
3. Choose **Non-commercial** (a free hobby app qualifies). Fill in the app name
   ("Tabletop Tracker") and details.
4. Submit and **wait for approval** — BGG says to be patient; it isn't instant.

## 2. Create a token

Once the application is **approved**, on the same Applications page create a
**Token** for it. It looks like `e3f8c3ff-9926-4efc-863c-3b92acda4d32`.

## 3. Add the token to the app

The app reads the token from `EXPO_PUBLIC_BGG_TOKEN` and sends it as
`Authorization: Bearer <token>` to boardgamegeek.com.

**For local development** (`npx expo start`): create a file named `.env.local`
in the project root (it's git-ignored):

```
EXPO_PUBLIC_BGG_TOKEN=your-token-here
```

**For EAS cloud builds** (the APK/AAB your testers install): set it as an EAS
environment variable so it's available at build time — do NOT put it in
`eas.json` (that's committed and public):

```
npx eas-cli env:create --environment production --name EXPO_PUBLIC_BGG_TOKEN --value "your-token-here" --visibility sensitive
npx eas-cli env:create --environment development --name EXPO_PUBLIC_BGG_TOKEN --value "your-token-here" --visibility sensitive
```

Then rebuild. The lookup will start working.

## Notes & caveats

- **Never commit the token.** This repo is public; `.env.local` is git-ignored
  for that reason, and it must not go into `app.json`/`eas.json`.
- **Client-side exposure.** Because the app calls BGG directly, the token ships
  inside the build and could be extracted. BGG permits this for end-user apps
  but warns that an abused token can be revoked. The dependable fallback remains
  the manual BGG rating field.
- BGG prefers requests be made server-side. We deliberately avoid running a
  server (cost/maintenance), so we accept the client-side trade-off.
- Requests must go to `boardgamegeek.com` (no `www`), which the app already does.

# Going public — launch checklist

A living checklist of what's needed to take Tabletop Tracker from **internal
testing** to a **public** Play Store release (and, later, iOS). Updated as the
app evolves.

Legend: ✅ done · ⏳ in progress · ⬜ to do · 🔁 every release

> ⚠️ Google changes some requirements (tester counts, durations, form fields)
> over time — always confirm the exact current rules in the Play Console.

---

## 1. The big gate: production access (new personal accounts)

Google requires personal developer accounts (created after ~Nov 2023) to run a
**closed test** before they can apply for production:

- ⬜ Create a **Closed testing** track (separate from your current Internal
  testing) and add testers.
- ⬜ Get **at least ~12 testers** opted in and keep the test running **≥14
  continuous days** (confirm the exact count/duration in the Console — Google
  has changed it).
- ⬜ Apply for **production access** once the closed test qualifies (a short
  questionnaire about the app).

> Until this is done, you can only distribute via Internal/Closed testing, not
> a public production release.

## 2. Store listing (must be complete & approved)

- ✅ App name, short + full description (`STORE_LISTING.md`)
- ✅ App icon 512×512 (`assets/play-icon-512.png`)
- ✅ Feature graphic 1024×500 (`assets/feature-graphic.png`)
- ✅ **Phone screenshots** — 8 uploaded (2026-06-24), covering the current
  feature set (wishlist, photo grid, bookcase, scores, leaderboards, etc.)
- ✅ Category, contact email, tags

## 3. App content declarations (must be accurate)

- ✅ **Privacy policy** — hosted on GitHub Pages + in-app (About); URL set in
  Play Console
- ✅ **Data safety** — updated for the online library and submitted (2026-06-24)
- ✅ **Content rating** questionnaire (Everyone / PEGI 3)
- ✅ **Target audience** — 13+
- ✅ **Ads** — none
- ⬜ Re-confirm all the above are still accurate at public launch

## 4. Technical / operational readiness

- ⬜ **Firebase App Check** — enable to stop abuse of the public Firebase config
  (someone spamming junk libraries). Negligible risk at tester scale; do before
  a wide public launch.
- ✅ **Restrict the Firebase API key** — checked 2026-06-24: the "Browser key
  (auto created by Firebase)" was **already API-restricted** by Firebase to its
  ~25 managed APIs, which include the ones the app uses (Identity Toolkit, Token
  Service, Cloud Firestore, Firebase Installations). No change needed. Left the
  optional **Android app restriction** off (risky with Play App Signing — would
  need the Play App Signing SHA-1). NB: the web API key in
  `src/lib/firebaseConfig.ts` is *meant* to be public (a project identifier, not
  a secret — access is enforced by Firestore rules), so the GitHub "leaked
  secret" alert can be dismissed as a false positive.
- ⬜ **Firebase budget alert** — set a billing/usage alert so a usage spike
  can't surprise you (free tier is generous, but be safe).
- ✅ **BGG token** — confirmed working (2026-06-24); re-check if lookups start
  failing as usage grows.
- ⬜ **Crash monitoring** — watch Play Console → Android vitals; add Sentry only
  if you hit crashes you can't reproduce.
- ⬜ Decide **pricing & countries** (Free; choose distribution countries).

## 5. Legal / privacy

- ✅ Privacy policy covers on-device data, BGG lookups, backups, and the online
  library; contact email present.
- ✅ **Privacy-policy host** — published via GitHub Pages from `/docs` and live
  at `https://calebuk.github.io/Tabletop-Tracker/privacy/` (terms at `/terms/`).
  Play Console privacy-policy URL updated to it (2026-06-24).
- ✅ **Terms of Use** — drafted (`TERMS.md`, published at `/docs/terms.md`).
- ⬜ **GDPR**: deletion path exists (delete online library); keep it working.

## 6. Every release (🔁)

- 🔁 EAS auto-increments `versionCode`; bump `version` in `app.json` for notable
  releases.
- 🔁 `eas build -p android --profile production` → upload AAB → release notes →
  roll out.
- 🔁 Re-check Data Safety / privacy if a release changes what data is handled.
- 🔁 Remind testers/users: **export a backup** before reinstalling (no auto cloud
  backup of their own device data).

## 7. iOS (future)

- ⬜ **Apple Developer account** ($99/year) + a Mac or EAS cloud build for the
  final binary.
- ⬜ iOS build profile + App Store Connect listing.
- ⬜ App Store review (stricter than Google; allow extra time).
- ⬜ The Firebase/online-library and privacy work above carries over.

---

_Last reviewed: 2026-06-24 (v1.3.0)._

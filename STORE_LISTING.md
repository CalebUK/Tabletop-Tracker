# Play Store listing pack — Tabletop Tracker

Everything you need to fill in the Play Console. Copy/paste the text blocks and
use the exact answers in the forms.

---

## App details

| Field | Value |
|---|---|
| App name | `Tabletop Tracker` |
| Package name | `com.bgk.boardgamekeeper` (fixed — cannot change after first upload) |
| Default language | English (United Kingdom) – en-GB |
| App or game | **App** |
| Free or paid | **Free** |
| Category | **Tools** (or Entertainment) |
| Contact email | `calebthill@gmail.com` |
| Privacy policy URL | `https://github.com/CalebUK/Tabletop-Tracker/blob/main/PRIVACY.md` |

## Short description (max 80 chars)

```
Catalogue your board games, track plays and winners, and pick your next game.
```

## Full description (max 4000 chars)

```
Tabletop Tracker is a simple, private way to keep your whole board game
collection in your pocket.

Your collection lives entirely on your device — no account, no sign-up, and
nothing uploaded to the cloud.

CATALOGUE YOUR GAMES
• Add each game with a photo, storage location, player count, play time,
  minimum age, complexity, designer/publisher and your own rating.
• Tag games however you like and add notes or house rules.
• Mark favourites and record the expansions you own.

TRACK PLAYS
• Log who played and who won.
• See play history for every game and per-game winner stats.
• View top players and your most-played games.

FIND THE RIGHT GAME
• Powerful search by players, play time, age, complexity, rating, tags and more.
• Filter by storage location to see what's on each shelf.
• Feeling lucky? Let the app pick a random game that fits your criteria.

LEND WITH CONFIDENCE
• Record who you've loaned a game to and when, and keep a full loan history so
  you never lose track of a game again.

YOURS TO KEEP
• Export a full backup (including photos) to move to a new phone.
• Export your collection to CSV for spreadsheets.

Tabletop Tracker doesn't show ads, doesn't track you, and keeps your data on
your device. Happy gaming!
```

## Categorisation & tags

- Category: **Tools**
- Tags: board games, collection, hobby, organiser
- Contains ads: **No**
- In-app purchases: **No**

---

## Graphics checklist

| Asset | Status / where |
|---|---|
| App icon (512×512) | Auto-generated from the build — Play pulls it from the AAB |
| **Feature graphic (1024×500)** | ✅ `assets/feature-graphic.png` — upload this |
| **Phone screenshots (2–8, min 2)** | ⏳ You capture these on your phone (see below) |

### Screenshots to capture (on your phone, once the new build is installed)
Take these 4–6 — portrait, just normal in-app screenshots:
1. **My Collection** list (with a few games + the logo header)
2. A **game's detail** page (photo, rating, location, plays)
3. **Search** tab with some filters selected
4. **Log a play** screen
5. **Stats** tab (top players / most played)
6. The **🎲 Feeling lucky** dice-roll (optional, fun)

> Tip: add 3–4 example games first so the screenshots look full.

---

## Data safety form (App content → Data safety)

- **Does your app collect or share any of the required user data types?** → **No**
  - Rationale: nothing is sent to us or any server we control. Photos and all
    data stay on the device. (Game *titles* are sent to BoardGameGeek for an
    optional lookup, but that isn't a personal-data type.)
- Privacy policy URL: paste the URL above.

## Content rating (App content → Content rating)

Start the questionnaire. Category: **Utility, Productivity, Communication, or
Other**. Answer **No** to everything:
- Violence, sexual content, profanity, controlled substances: **No**
- Gambling / simulated gambling: **No** (the "feeling lucky" dice just picks a
  game — no wagering)
- Users can interact / share content / share location: **No**
- Digital purchases: **No**

Expected result: **Everyone / PEGI 3**.

## Other "App content" declarations

- **Ads:** No, this app does not contain ads.
- **Target audience:** choose **13 and older** (avoids the extra "Designed for
  Families" requirements; the app has nothing child-specific).
- **News app:** No.
- **COVID-19 / health:** No.
- **Government app:** No.
- **Financial features:** No.
- **Data deletion:** users delete data in-app or by uninstalling (no account).

---

## Step-by-step: get it to your testers (Internal testing)

1. **Create a Google Play developer account** — https://play.google.com/console
   (one-time **$25**, sign in with calebthill@gmail.com). Choose a *Personal*
   account; identity verification can take a little while.
2. **Create app** → name `Tabletop Tracker`, language en-GB, App, Free, accept
   declarations.
3. Left menu → **Testing → Internal testing** → **Create new release**.
4. **App bundle:** when the EAS build finishes, download the **.aab** from the
   build page and **upload** it here. (Build page:
   https://expo.dev/accounts/calebuk/projects/board-game-keeper/builds )
5. Add **release notes** (e.g. "First test build").
6. Fill the **"Set up your app"** dashboard tasks using the answers above:
   Privacy policy, Data safety, Content rating, Ads, Target audience, plus the
   **Main store listing** (descriptions + feature graphic + screenshots).
7. Back in **Internal testing → Testers**, create an email list and add your
   testers' Google emails. Save.
8. **Review release → Start rollout to Internal testing.**
9. Copy the **"Join on the web"** opt-in link and send it to your testers. They
   tap it, accept, then install from the Play Store.

### Note on going public later
Google now requires personal developer accounts to run **closed testing with at
least 12 testers for 14 days** before you can apply for production (public)
access. Internal testing (this guide) has **no such wait** — it's the right
track for your testers right now. Keep it in mind for when you want to go live.

---

## Tester note (paste into your invite)

> Thanks for testing Tabletop Tracker! Heads-up: your data is stored only on
> your phone. Before reinstalling or switching devices, open ⚙️ (top-right of My
> Collection) → Backup & Export → Export full backup. Have fun, and tell me
> what's broken or missing!
```

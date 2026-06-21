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
Catalogue your board games, track plays, and share with friends.
```

## Full description (max 4000 chars)

```
Tabletop Tracker is a simple, private way to keep your whole board game
collection in your pocket — and share it with friends.

Your collection lives on your device. There's no sign-up, and nothing is
uploaded unless you choose to share a library.

CATALOGUE YOUR GAMES
• Add each game with a photo, storage location, player count, play time,
  minimum age, complexity, publisher/designer and your own rating.
• Pull in the details and the BoardGameGeek rating with a single tap.
• Tag and categorise games, add notes and house rules, mark favourites, and
  record the expansions you own.

TRACK PLAYS & GAME NIGHTS
• Log who played and who won — even games you don't own.
• See play history for every game, per-game winners and top players.
• Create gaming groups (like a weekly game night) and see stats just for them.

FIND THE RIGHT GAME
• Powerful search by players, play time, player age, complexity, rating,
  category and tags.
• Filter by storage location to see what's on each shelf.
• Feeling lucky? Let the app pick a random game that fits your criteria.

SHARE WITH FRIENDS
• Create an online library to get a share code, so friends can see what you
  have and your ratings — just a game list, no photos or personal info.
• Add friends' codes to browse their games, and view everyone's collections
  together on one shelf.

LEND WITH CONFIDENCE
• Record who you've loaned a game to and when, with a full loan history (and an
  optional photo), so you never lose track of a game again.

YOURS TO KEEP
• Export a full backup (including photos) to move to a new phone.
• Export your collection to CSV for spreadsheets.

Tabletop Tracker doesn't show ads and doesn't track you. Happy gaming!
```

## Categorisation & tags

- Category: **Tools**
- Tags: board games, collection, hobby, organiser, game night
- Contains ads: **No**
- In-app purchases: **No**

---

## Graphics checklist

| Asset | Status / where |
|---|---|
| **App icon (512×512)** | ✅ `assets/play-icon-512.png` — upload this (the store icon is uploaded separately; it is NOT taken from the build) |
| **Feature graphic (1024×500)** | ✅ `assets/feature-graphic.png` — upload this |
| **Phone screenshots (2–8, min 2)** | ⏳ You capture these on your phone (see below) |
| 7" tablet screenshots | ⛔ Not needed — optional. We have none; skip for now. |
| 10" tablet screenshots | ⛔ Not needed — optional. We have none; skip for now. |

### Screenshots to capture (on your phone, once the new build is installed)
Take these 5–8 — portrait, just normal in-app screenshots:
1. **My Collection** list (with a few games + the logo header)
2. A **game's detail** page (photo, rating, location, plays)
3. **Search** tab with some filters selected
4. **Library** tab — the share code + "Browse all games"
5. **Browse all games** — the bookcase of spines
6. **Stats** tab (top players / most played / a gaming group)
7. **Log a play** screen
8. The **🎲 Feeling lucky** dice-roll (optional, fun)

> Tip: add 3–4 example games first so the screenshots look full.

---

## Data safety form (App content → Data safety)

⚠️ This changed once the **online library** feature was added — the app can now
upload data to the cloud (Google Firebase) when a user opts in. Declare it
truthfully:

- **Does your app collect or share any user data?** → **Yes** (only via the
  optional online library; if a user never creates one, nothing is uploaded).
- **Data collected (when the user creates an online library):**
  - **App activity / other user-generated content** — the user's game list and
    their ratings (game name, rating, player count, play time). **No photos.**
  - **Device or other IDs** — an anonymous sign-in ID (used so only the owner can
    edit their own library; no name, email or account).
- **Is data shared with third parties?** → **No** (not sold or shared for ads;
  friends can view a library only via a share code the user gives out).
- **Is the data collected required or optional?** → **Optional** (opt-in).
- **Is data encrypted in transit?** → **Yes** (HTTPS).
- **Can users request data deletion?** → **Yes** — they delete their online
  library in-app (Library tab → Delete), which removes it from the cloud.
- Everything else (collection, photos, plays, notes) still stays **on-device**.
  Game titles are also sent to BoardGameGeek for the optional lookup.
- Privacy policy URL: paste the URL above.

> The exact data-type checkboxes Google offers shift over time — pick the closest
> truthful options to the description above. The key point is: **yes, optional
> cloud upload of a game list + an anonymous ID; not shared for ads; deletable.**

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

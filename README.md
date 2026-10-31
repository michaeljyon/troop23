# Troop 23 Basecamp

The private troop app for Scouts BSA Troop 23, Tallahassee, Florida.

## Signing in

Everyone on the TroopWebHost roster has a **personal code** (like `K7QM-2XPA`) and a sign-in link (`…/#/join/K7QM-2XPA`). Opening the link, or typing the code, signs that phone in as that person. Their sign-ups, packing checklists, chat and advancement then follow them to any phone they sign in on. Leaders send codes from Leader tools → Members (**Send invite** on one person, or **Invite list (CSV)** for everyone). Parents get linked to their scouts there too, so one parent can sign the whole family up.

The troop code still works as a **guest** sign-in (no chat, nothing synced). Adults marked Leader get leader mode automatically, with no passcode.

## What's in it

- **Outings.** Campouts, hikes, paddles, service and meetings, with dates, meeting place, cost and the plan. Everyone taps Going / Maybe / Can't go, and the outing shows who's coming by patrol.
- **Patrol meal planning** for each outing. Meal slots fill in from the outing dates. Pick recipes or write your own, and quantities scale to the patrol's sign-ups. The shopping list builds itself, combining ingredients across meals, with checkboxes for the store and a note when the troop pantry already has something. Plus a food budget with receipts and cost per person, and a duty roster that rotates cook, assistant cook, fire & water and cleanup across every meal.
- **Troop kitchen.** A recipe library (27 camp classics to start, scouts add their own) with a servings scaler, and the troop pantry: staples by location, with "running low" flags.
- **Gear locker.** Everything the troop owns, with tag numbers, condition and location. Check items out to a person, patrol and outing, then check them back in and flag anything broken. Each item keeps a full history. From an outing, check out a whole trip's gear at once and check it all back in after.
- **Packing lists.** The standard overnight list plus the leader's extras for each trip, checked off on the phone.
- **Photo gallery.** Browse by event (cover cards by year) or as one wall; filter by year, kind of outing, patrol, or search events, places, captions and who's tagged. Heart favorites (synced to your account), pick photos to play or save, and build a slideshow from any events, years, patrols or favorites, with event title cards, captions, speed and shuffle. Includes 1,000 photos from the TroopWebHost gallery (2022 on), each filed under its event.
- **Photos.** The Pack 6 Photo Trail system: snap or upload, every outing is its own album, tag scouts, and location data is stripped on the phone. Leaders review every photo against each family's photo permission (Public OK / Troop only / No photos). There's also a full-screen slideshow for Courts of Honor.
- **Bulletin.** Leader announcements on the Home screen, with pinning.
- **Chat**, built for Safeguarding Youth Training rules. Conversations open full screen. The message box grows as you type. In conversations (not boards), **Full message** opens an email-style writer with a subject line, a big writing area and a toolbar: bold, italic, underline, strikethrough, headings, bulleted and numbered lists, quotes, indent, highlight, text colors, links, divider lines and undo. Quick messages support **bold**, _italic_, ~~strike~~, lists and links (tap Aa), and up to 10 photos or files each (photos are resized on the phone with location data removed; PDFs, Word, Excel, PowerPoint and text files up to 4 MB). When a leader hides a reported message, its photos and files are hidden too. The Scoutmaster and Committee Chair are automatically in every conversation, so there's never a one-on-one chat. Messages can't be deleted, and anyone can report one for leaders to review. Boards: whole troop, Patrol Leaders' Council, each patrol, adult leaders, and the troop's groups (from the TroopWebHost e-mail groups). Scouts also get **Ask a leader**: request a board of review or a Scoutmaster conference, which opens a conversation with the right adults plus the two-deep leaders.
- **Never miss a message.** A bell in the header and a pulsing Chat badge count conversations that need you. Home opens with a "waiting on you" card, and the first visit each session shows what came in. A conversation needs a reply when someone else spoke last (or named you on a board) in the last three weeks.
- **Writing helper (✨ in Chat).** Suggests a clearer, kinder, complete version of a message and lists anything the other person asked that the draft doesn't answer. It never sends anything. It runs on Cloudflare Workers AI's free daily allowance (Llama 3.1 8B, roughly 1,000 suggestions a day; 40 per person) and never uses Netlify AI credits. Set `CF_ACCOUNT_ID` and `CF_AI_TOKEN` (a Cloudflare API token with Workers AI permission) in Netlify's environment variables. Without them, or once the free allowance runs out for the day, it gives built-in writing tips. Leaders can turn it off in Leader tools → Settings.
- **Hikes (like Strava).** Tap Record at the trailhead and Basecamp tracks distance, time, pace and feet climbed on a live, full-screen trail map with the numbers floating over it. Pick who's hiking, so everyone in the group gets credit, and tie it to an outing. Pause and resume without counting the drive in between. If the app is closed mid-hike, it picks up where it left off. When the hike is saved, the climbing is checked against map elevation data (Copernicus DEM via the free Open-Meteo service), which is more accurate than phone GPS. The first and last 200 m are left off the saved map by default, so a hike that starts at home doesn't show the house. Each hike's page opens on a big map with the title and stats over it, the route colored by elevation or pace, mile markers, start and finish flags, full screen, and an elevation chart you can slide along to see the spot on the map. Maps: Topo, Satellite, Hybrid (satellite with labels), USGS Topo and Street, with Hiking trails and Hillshade overlays. Satellite, Hybrid, USGS Topo and Hillshade come from USGS (public domain). Topo is OpenTopoMap, Street is OpenStreetMap and the trails overlay is Waymarked Trails, each credited on the map. Hikes can also be logged by hand. There's a troop feed with high-fives, "My hikes", and a yearly leaderboard by person and patrol. Hikes are visible only to signed-in members, and the recorder or a leader can edit or delete one. **Turning on location** is one button (More, Hikes, and the recorder). It first shows what the phone's question will look like and which button to tap, then asks the phone, and if the phone says no, Basecamp works out which browser it's in and shows step-by-step help for that browser: on iPhone, Safari, Chrome, the Google app, Edge, Firefox, DuckDuckGo, Brave, Opera or the Home Screen app; on Android, Chrome, Samsung Internet, Firefox, Edge, Opera, Brave, DuckDuckGo, the Google app or the home-screen app. Links opened inside texts, email or social apps are spotted too, with a one-tap Copy link to move to Safari or Chrome. People can correct the browser if it guessed wrong, "Reload and try again" reloads and asks again in one tap, and "Details for a leader" shows (and copies) exactly what the phone reported. The help goes one step at a time, with a little animated phone showing each screen and the exact row to tap, plus the exact taps in words then checks again on its own when you come back. Phones don't let websites open the Settings app themselves, so the help shows exactly where to go. Keep the app open while recording: phones pause location when the screen locks, so the screen stays on.
- **Advancement next steps.** Each scout's page (and Home, for scouts) suggests what to work on next, from their own record: what's left for the next rank (merit badge counts, Eagle-required badges, time in rank), partial badges closest to done with their counselor, Eagle-required badges to start (preferring ones with a troop counselor or an upcoming outing that covers them), upcoming outings that fit badges they haven't earned, camping nights toward the Camping merit badge (20 nights), and hiking. Leaders get **Troop planning** under Advancement: the Eagle-required badges the most scouts still need (merit badge class ideas, with counselors), who has the merit badges done for the next rank, who is close to their next rank, and partial badges that are nearly done. Rules used: Star 6 badges (4 Eagle-required), Life 11 (7), Eagle 21 including all 13 Eagle-required (Citizenship in Society was discontinued Feb 27, 2026). These are suggestions; the Scoutmaster, counselors and Scoutbook have the final say.
- **Advancement.** Each scout's rank ladder, next-rank requirements, Eagle-required badges, badges earned and in progress, and activity totals, imported from TroopWebHost. Scouts see their own record, parents see their linked scouts', leaders see everyone.
- **Recipe scanner.** Photograph a recipe card or cookbook page. The phone reads it on the device, breaks out the ingredients and steps, scales it to the number of people going, and estimates the cost.
- **Notifications.** Signed-in members turn them on per phone under More → Notifications, and choose messages, boards and announcements. On iPhone, Basecamp has to be added to the Home Screen first (iOS 16.4 or later). Notification keys are made automatically, so there's nothing to set up.
- **Outings calendar.** Outings → Calendar shows a month grid colored by kind of outing; swipe or jump to any month and year, tap a day for its events. Past outings can be filtered by year, kind and search, with photo counts.
- **Troop calendar.** Outings → "Put troop outings in your phone's calendar" subscribes Apple, Google or Outlook calendars to a live feed. Each outing also has Add to calendar.
- **Food budget calculator** and a shopping-list price book: per-meal rates from `troop.mealCosts`, headcount from sign-ups, the amount to collect per scout, and prices remembered from past trips.

## Demo troop (for showing the app to others)

A separate, made-up troop lives alongside the real one, with its own data. Nothing in it is real, and nobody signed into the demo can see the real troop.

- **XXXX-XXXX**: Demo Leader (Scoutmaster, leader tools on)
- **XXXX-XXXS**: Demo Scout (Eagles patrol, First Class)
- **demo**: the troop code for a guest look

Sign in by typing the code on the sign-in screen, or open `…/#/join/XXXX-XXXX`. A yellow **Demo** tag shows in the header. To go back to the real troop, More → Sign out and sign in with your own code. To fill or refill the demo, run `python3 scripts/seed-demo.py https://troop23-basecamp.netlify.app <LEADER_PASSCODE>` (it's safe to run again).

## Phones, tablets and computers

On phones, the tabs are along the bottom. On computers (1000 px and wider) they move to a sidebar on the left, Home shows two columns, and rows of patrols, filters and tabs wrap onto extra lines so everything is reachable with a mouse.

## Leader tools (More → Leader tools)

Signing in with the leader passcode turns on leader mode for that browser tab. Leaders can then add and edit outings and delete gear or recipes. The leader tools also have:

- **Members.** Personal codes, invites, the Leader switch, parent ↔ scout links, and the two adults copied on every chat.
- **Link families** (in Members). Suggests parent–scout pairs who share a last name, to confirm all at once.
- **Troop setup.** Merit badge counselors (who counsels which badge; scouts find them under Advancement → Counselors and can message troop counselors), leadership positions for each member, places outings go (typing one in an outing fills in the address, phone, website and map pin), and shortcuts to everything else that came from TroopWebHost.
- **Groups.** The troop's groups as chat boards or "Ask a leader" requests. Add or remove people any time.
- **Chat reports.** Hide or keep reported messages.
- **Photos.** Review uploads against photo permission.
- **Permission.** The family roster, including the No-photos list.
- **Bulletin.** Post and pin announcements.
- **Settings.** Rename or add patrols, and add extra photo albums.
- **Records.** CSV downloads of photo permission, outing sign-ups, gear inventory, gear history, food spending and the photo log.

## Settings

Edit `troop/troop.js` for names, colors, outing types, gear categories, duty roles, the packing list, starter recipes, sharing rules and photo-permission wording. Have the Scoutmaster and chartered organization review the permission wording before rollout.

**Official artwork.** Put the troop's licensed Scouting America artwork in `public/brand/` and set `logo` (and `logoOnDark` for a white version) in `troop/troop.js`. The header, sign-in screen and slideshow use it automatically. Until then the app uses its "Troop 23" lettering mark.

Secrets go in Netlify → Site configuration → Environment variables:

| Variable | What it does |
|---|---|
| `TROOP_CODE` | The code everyone types to open the app. Not case-sensitive. Change it each year. |
| `LEADER_PASSCODE` | Opens leader tools and leader mode. |
| `CF_ACCOUNT_ID` | Cloudflare account ID for the free chat writing helper (optional). |
| `CF_AI_TOKEN` | Cloudflare API token with Workers AI permission (optional, secret). |

Data lives in Netlify Blobs, in a store named after `troop.id`. No database to set up.

## Importing from TroopWebHost

TroopWebHost has no way for another app to read it, so exports come over as CSV files (TroopWebHost → Reports → export to Excel). Put them in one folder, then run:

```
python3 scripts/import-troopwebhost.py <Export_Events.csv> <site-url> <leader-passcode>
python3 scripts/import-troopwebhost-all.py <exports-folder> <site-url> <leader-passcode>
python3 scripts/import-locations.py <Maintain_Event_Locations.csv> <site-url> <leader-passcode>
```

- **Events** → outings (re-running updates the same outings).
- **Everything else** reads the active roster, user permissions, leadership positions, rank and merit badge history, merit badges in progress, rank requirements, event participation, inventory and checked-out items, and e-mail groups. It brings over names, adult/scout, patrol, positions, rank, advancement, attendance, gear and groups. **Contact info, birthdays, ages, BSA IDs, medical, allergies, money and addresses are never read.** Re-running keeps everyone's personal code, leader changes, parent links and group edits.
- **Photos** come from TroopWebHost → Photo Gallery → Download Photos, gathered in a signed-in browser. `scripts/import-twh-photo-events.py` makes a past outing for each event so photos land in the right album. Imported photos wait in Leader tools → Photos for review (filter by album, approve all shown) before families see them.
- **Counselors and places**: `python3 scripts/import-twh-extras.py <exports-folder> <site-url> <leader-passcode>` adds merit badge counselors (from Merit Badges In Progress and the Merit Badge Counselor role) and every event location. Existing entries are kept.
- **Locations** add the address, phone, website and map pin to outings by location name.

Add `--dry` to see what would change without sending anything.

## Run locally

```
npm install
npm run dev
```

Local troop code: `troop23`. Local leader passcode: `leader`. Data saves to `.data/`. Run `python3 scripts/e2e.py <folder>` (on an empty `.data`) for a full guest walkthrough with screenshots. After importing the TroopWebHost exports locally, `scripts/e2e-accounts.py` and `scripts/e2e-groups.py` walk through accounts, chat, advancement, the scanner, budgets and groups.

## Deploy

Deploy from Git or with the Netlify CLI so the `/api` function deploys with the site.

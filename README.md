# Troop 23 Basecamp

The private troop app for Scouts BSA Troop 23, Tallahassee, Florida. Scouts, parents and leaders open it with the troop code, say who they are and which patrol they're in, and get:

- **Outings.** Campouts, hikes, paddles, service and meetings, with dates, meeting place, cost and the plan. Everyone taps Going / Maybe / Can't go, and the outing shows who's coming by patrol.
- **Patrol meal planning** for each outing. Meal slots fill in from the outing dates. Pick recipes or write your own, and quantities scale to the patrol's sign-ups. The shopping list builds itself, combining ingredients across meals, with checkboxes for the store and a note when the troop pantry already has something. Plus a food budget with receipts and cost per person, and a duty roster that rotates cook, assistant cook, fire & water and cleanup across every meal.
- **Troop kitchen.** A recipe library (nine camp classics to start, scouts add their own) with a servings scaler, and the troop pantry: staples by location, with "running low" flags.
- **Gear locker.** Everything the troop owns, with tag numbers, condition and location. Check items out to a person, patrol and outing, then check them back in and flag anything broken. Each item keeps a full history. From an outing, check out a whole trip's gear at once and check it all back in after.
- **Packing lists.** The standard overnight list plus the leader's extras for each trip, checked off on the phone.
- **Photos.** The Pack 6 Photo Trail system: snap or upload, every outing is its own album, tag scouts, and location data is stripped on the phone. Leaders review every photo against each family's photo permission (Public OK / Troop only / No photos). There's also a full-screen slideshow for Courts of Honor.
- **Bulletin.** Leader announcements on the Home screen, with pinning.

## Leader tools (More → Leader tools)

Signing in with the leader passcode turns on leader mode for that browser tab. Leaders can then add and edit outings and delete gear or recipes. The leader tools also have:

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

Data lives in Netlify Blobs, in a store named after `troop.id`. No database to set up.

## Run locally

```
npm install
npm run dev
```

Local troop code: `troop23`. Local leader passcode: `leader`. Data saves to `.data/`. Run `python3 scripts/e2e.py <folder>` for a full walkthrough that takes screenshots.

## Deploy

Deploy from Git or with the Netlify CLI so the `/api` function deploys with the site.

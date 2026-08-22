# Togetherly v1.6 — UX Simplification Audit

## Goal

Reduce visual and navigational overload without deleting product capability. v1.6 treats features as parts of five user goals — Home, Plan, Together, Us and More — rather than presenting every backend feature as an equally important destination.

## Home

### Before
Home could render the couple hero plus up to eleven individual cards: countdown, timezone, availability, event, Daily Question, mood, tasks, goal, scratchpad, recent memory and activity randomiser.

### v1.6
Home is intentionally limited to three configurable sections after the couple hero:

1. **Today** — next event, open-task count, Daily Question status and current mood/check-in in one compact card.
2. **Long Distance** — local times, next countdown and next shared free-time overlap in one card. It is omitted automatically when long-distance mode is off.
3. **Quick actions** — Play, Date ideas, Tasks and Memories.

Home customization remains, but it now controls only these three meaningful sections. A new v2 storage key prevents the old eleven-card preferences from re-expanding the cleaned Home.

## Plan

Features are grouped by intent instead of eight equal tiles:

- **Organise:** Tasks, Lists, Notes
- **Dates & time:** Calendar, Countdowns, Availability
- **Bigger plans:** Trips, Goals
- **Organisation tools:** Tags

The Shared Scratchpad moved from Home into **Notes**, where it now has its own nested screen.

## Together

- **Play Together** remains the primary action.
- **Decision Tools** moved inside Play Together as a quick tool.
- **Daily Question + Mood** are presented together as **Check in**.
- **Activities + Activity Randomiser** are presented as one **Date ideas** experience. The Activities screen already contains the Randomiser entry point, so the duplicate top-level Randomiser tile was removed.

## Us

The previous five equal tiles — Memories, Photos, Albums, Memory Jar and Timeline — are now treated as one **Our Story** system.

- The Us tab leads primarily to Memories.
- The Memories screen contains the navigation for Photos, Albums, Timeline and Memory Jar.
- A recent memory remains visible on Us so the tab still feels personal rather than becoming another menu.

## More

The previous eight-row utility menu is reduced to three groups:

- **Find:** Search
- **People & relationship:** Couple profile, Account & profile
- **App preferences:** Settings, Privacy

Settings now owns Home layout, Appearance, Notifications and accessibility. Tags moved to Plan because they organise shared content rather than the account itself.

## Feature preservation map

| Existing feature | v1.6 home |
| --- | --- |
| Tasks | Plan → Organise; Home → Today/Quick actions |
| Lists | Plan → Organise |
| Notes | Plan → Organise |
| Shared scratchpad | Notes → Shared scratchpad |
| Calendar | Plan → Dates & time; Home → Today |
| Countdowns | Plan → Dates & time; Home → Long Distance |
| Availability / schedules | Plan → Dates & time; Home → Long Distance |
| Trips | Plan → Bigger plans |
| Goals | Plan → Bigger plans |
| Tags | Plan → Organisation tools |
| Activities | Together → Date ideas |
| Activity Randomiser | Date ideas → Open randomiser |
| Daily Question | Together → Check in; Home → Today |
| Mood | Together → Check in; Home → Today |
| Play Together games | Together → Play Together |
| Decision Tools | Play Together → Quick tool |
| Memories | Us → Our Story |
| Photos | Memories → Browse our story |
| Albums | Memories → Browse our story |
| Timeline | Memories → Browse our story |
| Memory Jar | Memories / Us |
| Search | More → Find |
| Couple profile | More → People & relationship |
| Account/profile | More → People & relationship |
| Themes | More → Settings → Appearance |
| Notifications | More → Settings → Notifications |
| Home customization | More → Settings → Home layout |
| Privacy | More → App preferences |

## Result

No server routes, database tables or existing records are removed. This is primarily an information-architecture and presentation change, with one new client route for the relocated Shared Scratchpad. Migration `008_play_together.sql` remains the latest database migration.

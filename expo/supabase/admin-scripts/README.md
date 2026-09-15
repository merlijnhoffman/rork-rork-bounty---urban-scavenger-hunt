# Bounty — Admin SQL Scripts

Copy-paste these into the **Supabase Dashboard → SQL Editor**. No code changes needed.

---

## 1. Make clue media load on all devices (run once)

Player apps build public URLs for clue images/videos/audio. Run this if media
shows "Failed to load" in the player app:

```sql
-- Make the clue-media bucket public (safe: it only contains hunt clue media)
update storage.buckets
set public = true
where id = 'clue-media';

-- Allow anyone to read files from it
create policy "Public read access to clue media"
on storage.objects
for select
using (bucket_id = 'clue-media');
```

Notes:
- If the policy already exists you'll get `42710: policy already exists` — that's fine, skip it.
- Admin uploads should store on clue rows: `media_type` = `image` | `video` | `audio` and
  `media_url` = either the bare storage path (e.g. `events/abc123/photo.jpg`) **or** a full URL.
  Bare paths with a leading slash or a duplicated `clue-media/` prefix are also handled by the app.

---

## 2. Reset a hunt (run whenever you want to reset the current event)

This wipes all event data server-side and puts the event back to "scheduled".
Player phones automatically discard their saved stats (hint tokens, unlocked
hints, distance meter) because the event's `updated_at` moves forward.

**Set your event id here** (find it in Table Editor → events):

```sql
-- ⚠️ EDIT THIS LINE
create temp table _reset_event as
select id, status from events
order by created_at desc
limit 1;  -- newest event; or replace with: select 'YOUR-EVENT-ID'::uuid as id, ...
```

Then run the reset (adjust the temp-table query above first):

```sql
-- Deletes all per-event gameplay data
delete from clues                where event_id = (select id::text from _reset_event);
delete from event_winners        where event_id = (select id::text from _reset_event);
delete from player_connections   where event_id = (select id::text from _reset_event);
delete from bounty_locations     where event_id = (select id::text from _reset_event);
delete from hunter_locations     where event_id = (select id::text from _reset_event);
delete from connection_codes     where event_id = (select id::text from _reset_event);

-- Reset the hunt zone (players get a fresh zone when you create one)
delete from event_zones          where event_id = (select id::text from _reset_event);

-- Put the event back to upcoming — explicitly bump updated_at, which is the
-- signal player apps use to clear locally saved stats
update events
set status = 'scheduled',
    updated_at = now()
where id = (select id from _reset_event);
```

If any table above doesn't exist in your project you'll get `42P01` — just delete that line.

### Quick one-liner alternative (newest event)

```sql
delete from clues                where event_id = (select id::text from events order by created_at desc limit 1);
delete from event_winners        where event_id = (select id::text from events order by created_at desc limit 1);
delete from player_connections   where event_id = (select id::text from events order by created_at desc limit 1);
delete from bounty_locations     where event_id = (select id::text from events order by created_at desc limit 1);
delete from hunter_locations     where event_id = (select id::text from events order by created_at desc limit 1);
delete from connection_codes     where event_id = (select id::text from events order by created_at desc limit 1);
delete from event_zones          where event_id = (select id::text from events order by created_at desc limit 1);
update events set status = 'scheduled', updated_at = now() where id = (select id from events order by created_at desc limit 1);
```

---

## 3. Verify-connection edge function

After any change to `expo/supabase/functions/verify-connection/index.ts`, redeploy it:

```bash
supabase functions deploy verify-connection
```

Setup SQL for the tables it uses is documented as a comment at the bottom of
`expo/supabase/functions/verify-connection/index.ts`.

---

## 5. Hunter Connect anti-cheat: one connection per pair per event (run once)

The player app already rejects repeat scans, but this database rule is what makes
it tamper-proof. It blocks every cheating pattern at once:

- Scanning the same hunter twice (even with a freshly generated code)
- Two hunters scanning each other to farm two connections (A→B and B→A count as one)
- Two simultaneous scans racing each other before either is verified

Safe to re-run — it removes any accidental duplicates first, then installs the
unique rule:

```sql
-- Remove duplicates between the same pair in the same event
-- (keeps the earliest connection; safe if there are none)
delete from player_connections a
using player_connections b
where a.event_id = b.event_id
  and least(a.generator_user_id, a.scanner_user_id) = least(b.generator_user_id, b.scanner_user_id)
  and greatest(a.generator_user_id, a.scanner_user_id) = greatest(b.generator_user_id, b.scanner_user_id)
  and (a.created_at > b.created_at or (a.created_at = b.created_at and a.id > b.id));

-- Database-level rule: one connection per pair of hunters per event.
-- LEAST/GREATEST normalise the pair so (A→B) and (B→A) are the same connection.
create unique index if not exists idx_player_connections_unique_pair
  on player_connections (
    event_id,
    least(generator_user_id, scanner_user_id),
    greatest(generator_user_id, scanner_user_id)
  );
```

After running this, redeploy the edge function (section 3 above) if you haven't
since the last change — the app-side rejection message depends on the latest
deployed version.

---

## 4. Live prize pool system (run once, required)

The player app computes the prize as:

```
prize = prize_base + prize_per_ticket × (number of tickets sold)
```

It reads the ticket count from the `event_prize_pool` view below and listens
for realtime ticket inserts so every phone sees the pot grow live. If this
script hasn't run, the pool silently shows the starting amount.

```sql
-- Pool configuration per event (defaults: €500 start, +€10 per ticket).
-- Edit values per event in the Table Editor, or from the admin app.
alter table events
  add column if not exists prize_base integer not null default 500,
  add column if not exists prize_per_ticket integer not null default 10;

-- Ticket counts per event. A view owned by postgres bypasses RLS on tickets,
-- but only ever exposes an anonymous count — no player data.
create or replace view public.event_prize_pool as
select event_id, count(*)::int as player_count
from public.tickets
group by event_id;

grant select on public.event_prize_pool to authenticated;

-- Live updates: push ticket inserts to the player apps in realtime.
-- (If you get 'duplicate object' the table is already in the publication — skip.)
alter publication supabase_realtime add table public.tickets;
```

Notes:
- Existing events get the default starting prize (€500) + €10 per ticket.
- The old `prize_amount` column is no longer used by the player app for the
  current event (hunt history falls back to it only for pre-pool events).

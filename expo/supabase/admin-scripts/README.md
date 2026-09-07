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

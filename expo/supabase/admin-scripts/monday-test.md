# Monday Madrid test run — copy-paste pack

Event id used everywhere below: `294778bc-2064-4751-91c3-fb9347e3258f` (Madrid).
Paste these into **Supabase Dashboard → SQL Editor** in order.

---

## 1. Today — set free tickets for the test

Testers will see "claim ticket" instead of a purchase.

```sql
update events
set ticket_price = 0,
    updated_at = now()
where id = '294778bc-2064-4751-91c3-fb9347e3258f';
```

## 2. Today — remove staged test hunters (from the screenshot session)

So nobody's Hunter Radar shows ghost dots on Monday.

```sql
delete from hunter_locations
where event_id = '294778bc-2064-4751-91c3-fb9347e3258f';
```

## 3. Today — Hunter Connect anti-cheat index (safe to re-run)

One connection per pair of hunters per event, enforced in the database.

```sql
delete from player_connections a
using player_connections b
where a.event_id = b.event_id
  and least(a.generator_user_id, a.scanner_user_id) = least(b.generator_user_id, b.scanner_user_id)
  and greatest(a.generator_user_id, a.scanner_user_id) = greatest(b.generator_user_id, b.scanner_user_id)
  and (a.created_at > b.created_at or (a.created_at = b.created_at and a.id > b.id));

create unique index if not exists idx_player_connections_unique_pair
  on player_connections (
    event_id,
    least(generator_user_id, scanner_user_id),
    greatest(generator_user_id, scanner_user_id)
  );
```

## 4. Today — checklist in the admin app (no SQL)

- [ ] Event start time is the real one (the app counted down to Mon 9 Nov ~01:00 CET — fix if wrong)
- [ ] Hunt zone recentered/shrunk to where you'll actually hunt (currently 3000m around central Madrid)
- [ ] Clues staged with media uploaded and in the right order
- [ ] Admin login works (Supabase email)

## 5. Test day — go live (or use the admin app's live toggle)

```sql
update events
set status = 'live',
    updated_at = now()
where id = '294778bc-2064-4751-91c3-fb9347e3258f';
```

Each tester: install the fresh build → sign up → allow location → allow camera → claim free ticket.

## 6. After the test — full reset + paid price back

```sql
delete from clues              where event_id = '294778bc-2064-4751-91c3-fb9347e3258f';
delete from event_winners      where event_id = '294778bc-2064-4751-91c3-fb9347e3258f';
delete from player_connections where event_id = '294778bc-2064-4751-91c3-fb9347e3258f';
delete from bounty_locations   where event_id = '294778bc-2064-4751-91c3-fb9347e3258f';
delete from hunter_locations   where event_id = '294778bc-2064-4751-91c3-fb9347e3258f';
delete from connection_codes   where event_id = '294778bc-2064-4751-91c3-fb9347e3258f';
delete from event_zones        where event_id = '294778bc-2064-4751-91c3-fb9347e3258f';
delete from tickets            where event_id = '294778bc-2064-4751-91c3-fb9347e3258f';

update events
set status = 'scheduled',
    ticket_price = 4.99,
    updated_at = now()
where id = '294778bc-2064-4751-91c3-fb9347e3258f';
```

Notes: step 6 also wipes the clues you staged for the test — re-upload them
afterwards or skip the clues line if you want to keep them. Any `42P01` error
means that table doesn't exist in your project; delete that line.

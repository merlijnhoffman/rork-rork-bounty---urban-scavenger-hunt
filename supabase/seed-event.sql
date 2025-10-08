-- Insert a sample event into the events table
-- Run this in your Supabase SQL Editor

INSERT INTO events (
  city,
  start_time,
  ticket_price,
  prize_amount,
  status
) VALUES (
  'Amsterdam',
  '2025-01-18 15:00:00+01',
  25.00,
  5000,
  'upcoming'
)
ON CONFLICT (id) DO NOTHING;

-- Adds a 'cleaning' room status (owner dashboard redesign — rooms grid
-- needs available/occupied/cleaning/maintenance, the DB only had 3 states).
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('available', 'booked', 'maintenance', 'cleaning'));

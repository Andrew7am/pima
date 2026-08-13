-- Scoped realtime rollout: bookings + rooms are the two tables where "someone
-- is watching and it changes elsewhere" is a real, high-value scenario
-- (owner sees a new booking / guest sees a status change / room availability
-- updates live). Other tables (reviews, houses, audit log, expenses...) stay
-- load-on-navigate — the staleness cost there is low and blanket realtime on
-- every table adds connection overhead for no real benefit.
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;

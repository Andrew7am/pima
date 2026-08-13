-- ============================================================
-- Resilience hardening: cap the length of every user-writable free-text
-- column. Without these, an authenticated attacker (or a bot that just
-- signed up) can write multi-megabyte strings into their own rows —
-- allowed by RLS since it's their own data — and bloat the database or
-- slow queries. Chat/message content was already capped (migrations 043,
-- 040, 038); this closes the same hole on the listing/profile/booking
-- free-text fields.
--
-- Every constraint is added NOT VALID on purpose: existing rows are NOT
-- rescanned (so this can never fail on live data or lock the table), yet
-- every INSERT and UPDATE from now on IS checked. Limits are generous —
-- real content fits comfortably; only abuse is blocked. NULLs allowed.
-- ============================================================

DO $$
BEGIN
  -- bookings: owner's private note (added in 057, previously unbounded)
  BEGIN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_owner_notes_len
      CHECK (owner_notes IS NULL OR char_length(owner_notes) <= 5000) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  -- houses: listing free-text fields
  BEGIN
    ALTER TABLE public.houses ADD CONSTRAINT houses_name_len
      CHECK (name IS NULL OR char_length(name) <= 200) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.houses ADD CONSTRAINT houses_description_len
      CHECK (description IS NULL OR char_length(description) <= 8000) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.houses ADD CONSTRAINT houses_address_len
      CHECK (address IS NULL OR char_length(address) <= 500) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.houses ADD CONSTRAINT houses_rooms_description_len
      CHECK (rooms_description IS NULL OR char_length(rooms_description) <= 5000) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.houses ADD CONSTRAINT houses_contract_terms_len
      CHECK (contract_terms IS NULL OR char_length(contract_terms) <= 8000) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  -- reviews: guest comment
  BEGIN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_comment_len
      CHECK (comment IS NULL OR char_length(comment) <= 3000) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  -- users: profile free-text fields
  BEGIN
    ALTER TABLE public.users ADD CONSTRAINT users_name_len
      CHECK (name IS NULL OR char_length(name) <= 200) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.users ADD CONSTRAINT users_address_len
      CHECK (address IS NULL OR char_length(address) <= 500) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.users ADD CONSTRAINT users_organization_name_len
      CHECK (organization_name IS NULL OR char_length(organization_name) <= 300) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

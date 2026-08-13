-- ============================================================
-- PiMa — Initial Schema Migration
-- ============================================================

-- Required for exclusion constraint on date ranges
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'individual'
                 CHECK (role IN ('individual','servant','church','owner','admin')),
  phone        TEXT NOT NULL DEFAULT '',
  organization_name TEXT,
  is_approved  BOOLEAN DEFAULT FALSE,
  points       INTEGER NOT NULL DEFAULT 0,
  favorites    TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- POINTS HISTORY
-- ============================================================
CREATE TABLE public.points_history (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  description TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('earned','redeemed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HOUSES
-- ============================================================
CREATE TABLE public.houses (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  description               TEXT NOT NULL DEFAULT '',
  owner_id                  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  owner_name                TEXT NOT NULL DEFAULT '',
  governorate               TEXT NOT NULL DEFAULT '',
  address                   TEXT NOT NULL DEFAULT '',
  lat                       DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng                       DOUBLE PRECISION NOT NULL DEFAULT 0,
  rooms_count               INTEGER NOT NULL DEFAULT 0,
  beds_count                INTEGER NOT NULL DEFAULT 0,
  rooms_description         TEXT NOT NULL DEFAULT '',
  price_per_night_per_person NUMERIC(10,2) NOT NULL DEFAULT 0,
  services                  TEXT[] DEFAULT '{}',
  suitability               TEXT[] DEFAULT '{}',
  activities                TEXT[] DEFAULT '{}',
  images                    TEXT[] DEFAULT '{}',
  image_descriptions        JSONB DEFAULT '{}',
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected')),
  rating                    NUMERIC(3,2) NOT NULL DEFAULT 0,
  reviews_count             INTEGER NOT NULL DEFAULT 0,
  property_type             TEXT CHECK (property_type IN ('conference','student','staff')),
  blocked_dates             TEXT[] DEFAULT '{}',
  sea_proximity             TEXT CHECK (sea_proximity IN ('near','view','beach','far')),
  student_housing_gender    TEXT CHECK (student_housing_gender IN ('boys','girls','both')),
  distance_from_university  TEXT,
  monthly_rent              NUMERIC(10,2),
  room_capacity             INTEGER,
  housing_rules             TEXT[] DEFAULT '{}',
  contract_terms            TEXT,
  conference_halls          JSONB DEFAULT '[]',
  restaurants               JSONB DEFAULT '[]',
  menu                      JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE public.bookings (
  id                      TEXT PRIMARY KEY,
  house_id                TEXT NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  house_name              TEXT NOT NULL DEFAULT '',
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name               TEXT NOT NULL DEFAULT '',
  user_phone              TEXT NOT NULL DEFAULT '',
  user_email              TEXT NOT NULL DEFAULT '',
  user_role               TEXT NOT NULL DEFAULT 'individual',
  organization_name       TEXT,
  check_in                DATE NOT NULL,
  check_out               DATE NOT NULL,
  guests_count            INTEGER NOT NULL DEFAULT 1,
  total_price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_paid            BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','rejected','completed')),
  is_large_conference_quote BOOLEAN NOT NULL DEFAULT FALSE,
  payment_status          TEXT DEFAULT 'unpaid'
                            CHECK (payment_status IN ('unpaid','pending_verification','paid_deposit','paid_full')),
  conference_details      JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent overlapping bookings for the same house (active statuses only)
  -- This is the atomic DB-level guard against the double-booking race condition
  CONSTRAINT no_overlapping_bookings EXCLUDE USING GIST (
    house_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status IN ('pending', 'approved'))
);

CREATE INDEX idx_bookings_house_id ON public.bookings(house_id);
CREATE INDEX idx_bookings_user_id  ON public.bookings(user_id);
CREATE INDEX idx_bookings_status   ON public.bookings(status);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE public.payments (
  id                    TEXT PRIMARY KEY,
  booking_id            TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name             TEXT NOT NULL DEFAULT '',
  amount                NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method        TEXT NOT NULL
                          CHECK (payment_method IN ('bank','instapay','vodafone','cash','online')),
  payment_status        TEXT NOT NULL DEFAULT 'pending'
                          CHECK (payment_status IN ('pending','approved','rejected')),
  payment_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proof_image           TEXT,
  transaction_reference TEXT,
  admin_notes           TEXT,
  details               JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE public.reviews (
  id                    TEXT PRIMARY KEY,
  house_id              TEXT NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  house_name            TEXT,
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name             TEXT NOT NULL DEFAULT '',
  user_role             TEXT NOT NULL DEFAULT 'individual',
  rating                NUMERIC(3,2) NOT NULL DEFAULT 0,
  food_rating           NUMERIC(3,2),
  service_rating        NUMERIC(3,2),
  cleanliness_rating    NUMERIC(3,2),
  organization_rating   NUMERIC(3,2),
  value_rating          NUMERIC(3,2),
  overall_rating        NUMERIC(3,2),
  comment               TEXT NOT NULL DEFAULT '',
  owner_reply           TEXT,
  owner_reply_created_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ATTENDEES
-- ============================================================
CREATE TABLE public.attendees (
  id         TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  gender     TEXT NOT NULL CHECK (gender IN ('male','female')),
  group_type TEXT NOT NULL CHECK (group_type IN ('youth','family','child','other'))
);

-- ============================================================
-- ROOM ALLOCATIONS
-- ============================================================
CREATE TABLE public.room_allocations (
  id          TEXT PRIMARY KEY,
  booking_id  TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  attendee_id TEXT NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  room_id     TEXT NOT NULL,
  bed_number  INTEGER NOT NULL
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id TEXT REFERENCES public.bookings(id) ON DELETE SET NULL,
  title      TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  type       TEXT NOT NULL CHECK (type IN ('success','danger','info')),
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.houses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   ENABLE ROW LEVEL SECURITY;

-- Users: read own profile, admin reads all
CREATE POLICY "users_select_own"   ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own"   ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own"   ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Houses: anyone can view approved houses; owners manage their own; admin manages all
CREATE POLICY "houses_select_approved" ON public.houses FOR SELECT USING (status = 'approved' OR auth.uid() = owner_id);
CREATE POLICY "houses_insert_owner"    ON public.houses FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "houses_update_owner"    ON public.houses FOR UPDATE USING (auth.uid() = owner_id);

-- Bookings: user sees own bookings; owner sees bookings for their houses
CREATE POLICY "bookings_select_user"  ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bookings_insert_user"  ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookings_update_user"  ON public.bookings FOR UPDATE USING (auth.uid() = user_id);

-- Payments: user sees own payments
CREATE POLICY "payments_select_user" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payments_insert_user" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reviews: anyone reads; user writes own
CREATE POLICY "reviews_select_all"  ON public.reviews FOR SELECT USING (TRUE);
CREATE POLICY "reviews_insert_user" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update_user" ON public.reviews FOR UPDATE USING (auth.uid() = user_id);

-- Notifications: user sees own only
CREATE POLICY "notifs_select_user" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifs_update_user" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Attendees & allocations: via booking ownership
CREATE POLICY "attendees_select" ON public.attendees FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);
CREATE POLICY "attendees_insert" ON public.attendees FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);

CREATE POLICY "allocations_select" ON public.room_allocations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);
CREATE POLICY "allocations_insert" ON public.room_allocations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);

-- Points history: user sees own
CREATE POLICY "points_select_own" ON public.points_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "points_insert_own" ON public.points_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'individual'),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- SOLO TRANSIT & E-HAILING PLATFORM: MASTER PRODUCTION SCHEMA
-- Complete Unified Database Setup for Fresh & Existing Supabase Projects
-- Includes: Core E-Hailing, Minibus (15-Seater) Corridors, PostGIS, 
-- Stored Procedures, Realtime Replication, Storage Buckets, and Strict RLS.
-- ====================================================================
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/_/sql
-- 2. Paste this entire script into the SQL Editor (no text selected).
-- 3. Click "Run" (or Ctrl + Enter / Cmd + Enter).
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. EXTENSIONS
-- --------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- --------------------------------------------------------------------
-- 2. CUSTOM ENUMS & TYPES
-- --------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_type AS ENUM ('driver', 'rider', 'corp_admin', 'fleet_owner', 'admin');
EXCEPTION
  WHEN duplicate_object THEN 
    ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'fleet_owner';
    ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'admin';
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'expired', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN
    ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'past_due';
    ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'cancelled';
END $$;

DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM ('requested', 'accepted', 'arrived', 'in_progress', 'payment_pending', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN
    ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'arrived';
    ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'payment_pending';
END $$;

DO $$ BEGIN
  CREATE TYPE document_type AS ENUM ('license_front', 'license_back', 'prdp', 'roadworthy', 'vehicle_photo');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- --------------------------------------------------------------------
-- 3. CORE E-HAILING TABLES
-- --------------------------------------------------------------------

-- A. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'User',
    phone TEXT,
    avatar_url TEXT,
    user_type user_type NOT NULL DEFAULT 'rider',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- B. DRIVER PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.driver_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_year INT,
    vehicle_color TEXT,
    license_plate TEXT,
    prdp_number TEXT,
    has_license BOOLEAN DEFAULT FALSE,
    has_prdp BOOLEAN DEFAULT FALSE,
    has_roadworthy BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_online BOOLEAN DEFAULT FALSE,
    current_lat FLOAT8,
    current_lng FLOAT8,
    location_geo geography(Point, 4326),
    subscription_active BOOLEAN DEFAULT TRUE,
    subscription_status subscription_status DEFAULT 'trial',
    subscription_plan TEXT DEFAULT 'trial',
    subscription_expires_at TIMESTAMPTZ,
    trial_started_at TIMESTAMPTZ DEFAULT NOW(),
    rating_avg NUMERIC(3, 2) DEFAULT 5.00,
    rating_count INT DEFAULT 0,
    verification_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- C. DRIVER DOCUMENTS TABLE (KYC)
CREATE TABLE IF NOT EXISTS public.driver_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
    doc_type document_type NOT NULL,
    file_path TEXT NOT NULL,
    status document_status DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(driver_id, doc_type)
);

-- D. CORPORATE ACCOUNTS
CREATE TABLE IF NOT EXISTS public.corporate_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    wallet_balance NUMERIC(10, 2) DEFAULT 0.00,
    management_fee_rate NUMERIC(3, 2) DEFAULT 0.05,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- E. ON-DEMAND E-HAILING TRIPS
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.driver_profiles(id) ON DELETE SET NULL,
    corp_account_id UUID REFERENCES public.corporate_accounts(id) ON DELETE SET NULL,
    pickup_location TEXT NOT NULL,
    pickup_lat FLOAT8 NOT NULL,
    pickup_lng FLOAT8 NOT NULL,
    pickup_geo geography(Point, 4326),
    dropoff_location TEXT NOT NULL,
    dropoff_lat FLOAT8 NOT NULL,
    dropoff_lng FLOAT8 NOT NULL,
    dropoff_geo geography(Point, 4326),
    fare_amount NUMERIC(10, 2) NOT NULL,
    base_agreed_fare NUMERIC(10, 2),
    stops_fare_adjustment NUMERIC(10, 2) DEFAULT 0,
    waiting_fee_amount NUMERIC(10, 2) DEFAULT 0,
    stops JSONB DEFAULT '[]'::jsonb,
    arrived_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'arrived', 'in_progress', 'payment_pending', 'completed', 'cancelled')),
    trip_type TEXT DEFAULT 'standard',
    verification_pin VARCHAR(4) DEFAULT LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
    scheduled_time TIMESTAMPTZ,
    payment_method TEXT DEFAULT 'in_app' CHECK (payment_method IN ('cash', 'card', 'in_app')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
    cancelled_by UUID,
    cancellation_reason TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- F. IN-APP CHAT MESSAGES
CREATE TABLE IF NOT EXISTS public.trip_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('rider', 'driver')),
    content TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- G. TRIP RATINGS & REVIEWS
CREATE TABLE IF NOT EXISTS public.trip_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL UNIQUE REFERENCES public.trips(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
    tags TEXT[] DEFAULT '{}',
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- H. DRIVER BANK DETAILS
CREATE TABLE IF NOT EXISTS public.driver_bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL UNIQUE REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    account_number TEXT NOT NULL,
    branch_code TEXT NOT NULL,
    account_type TEXT DEFAULT 'cheque',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- I. HIGH-CONCURRENCY DISPATCH TELEMETRY & BIDS
CREATE TABLE IF NOT EXISTS public.driver_locations (
    driver_id UUID PRIMARY KEY REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    heading REAL NOT NULL DEFAULT 0,
    speed_kmh REAL NOT NULL DEFAULT 0,
    geohash_6 TEXT NOT NULL DEFAULT '',
    is_online BOOLEAN NOT NULL DEFAULT false,
    is_available BOOLEAN NOT NULL DEFAULT true,
    vehicle_type TEXT NOT NULL DEFAULT 'standard',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_stress_test BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.ride_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
    proposed_fare NUMERIC(10, 2) NOT NULL CHECK (proposed_fare > 0),
    eta_minutes INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (trip_id, driver_id)
);

-- J. SAFETY & SOS INCIDENTS
CREATE TABLE IF NOT EXISTS public.safety_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('rider', 'driver')),
    incident_type TEXT NOT NULL DEFAULT 'sos_panic',
    lat FLOAT8,
    lng FLOAT8,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dispatched', 'resolved', 'false_alarm')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- K. WEB PUSH SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_role TEXT DEFAULT 'driver',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 4. MINIBUS FLEET & RANK MANIFEST MODULE (15-SEATER CORRIDORS)
-- --------------------------------------------------------------------

-- A. TAXI ASSOCIATIONS (e.g. CODETA, CATA, SANTACO Kimberley)
CREATE TABLE IF NOT EXISTS public.associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    short_code VARCHAR(30) UNIQUE,
    contact_person VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    operating_city VARCHAR(100) DEFAULT 'Kimberley',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- B. VEHICLES (Minibus Fleet)
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    association_id UUID REFERENCES public.associations(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    registration_plate VARCHAR(20) UNIQUE NOT NULL,
    vin_number VARCHAR(50),
    make VARCHAR(50) DEFAULT 'Toyota',
    model VARCHAR(50) DEFAULT 'Quantum',
    capacity INT DEFAULT 15 CHECK (capacity > 0 AND capacity <= 60),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- C. CORRIDORS & ROUTES (Rank to Rank)
CREATE TABLE IF NOT EXISTS public.corridors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_rank VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    standard_fare DECIMAL(10,2) NOT NULL CHECK (standard_fare >= 0),
    distance_km DECIMAL(6,2),
    estimated_duration_minutes INT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- D. MINIBUS JOURNEY MANIFESTS (Per Trip)
CREATE TABLE IF NOT EXISTS public.minibus_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE RESTRICT,
    corridor_id UUID REFERENCES public.corridors(id) ON DELETE RESTRICT,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    marshal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'boarding' CHECK (status IN ('boarding', 'in_transit', 'completed', 'cancelled')),
    total_seats INT DEFAULT 15 CHECK (total_seats > 0),
    digital_seats_filled INT DEFAULT 0 CHECK (digital_seats_filled >= 0),
    cash_seats_filled INT DEFAULT 0 CHECK (cash_seats_filled >= 0),
    total_revenue_zar DECIMAL(10,2) DEFAULT 0.00 CHECK (total_revenue_zar >= 0),
    dispatched_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- E. PASSENGER BOARDING / SEAT LEDGER
CREATE TABLE IF NOT EXISTS public.seat_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.minibus_trips(id) ON DELETE CASCADE,
    seat_number INT NOT NULL CHECK (seat_number BETWEEN 1 AND 15),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('digital_paystack', 'cash', 'qr_wallet')),
    fare_amount DECIMAL(10,2) NOT NULL CHECK (fare_amount >= 0),
    passenger_phone VARCHAR(20),
    passenger_name VARCHAR(100),
    logged_by VARCHAR(20) NOT NULL CHECK (logged_by IN ('commuter_scan', 'conductor_manual', 'marshal_manual')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Prevent double booking of identical seat on the same journey
    CONSTRAINT unique_minibus_seat_reservation UNIQUE (trip_id, seat_number)
);

-- --------------------------------------------------------------------
-- 5. REALTIME AUTOMATION TRIGGERS
-- --------------------------------------------------------------------

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trigger_driver_profiles_updated_at
    BEFORE UPDATE ON public.driver_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trigger_trips_updated_at
    BEFORE UPDATE ON public.trips
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trigger_minibus_trips_updated_at
    BEFORE UPDATE ON public.minibus_trips
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-sync PostGIS geography column on driver location update
CREATE OR REPLACE FUNCTION public.sync_driver_location_geo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_lat IS NOT NULL AND NEW.current_lng IS NOT NULL THEN
        NEW.location_geo = ST_SetSRID(ST_MakePoint(NEW.current_lng, NEW.current_lat), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_sync_driver_location_geo
    BEFORE INSERT OR UPDATE ON public.driver_profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_driver_location_geo();

-- Auto-sync Minibus seat counts and total revenue from seat_ledger
CREATE OR REPLACE FUNCTION public.sync_minibus_trip_seats_and_revenue()
RETURNS TRIGGER AS $$
DECLARE
    target_trip_id UUID;
BEGIN
    target_trip_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.trip_id ELSE NEW.trip_id END;

    UPDATE public.minibus_trips
    SET 
        digital_seats_filled = COALESCE((
            SELECT COUNT(*) FROM public.seat_ledger 
            WHERE trip_id = target_trip_id AND payment_method IN ('digital_paystack', 'qr_wallet')
        ), 0),
        cash_seats_filled = COALESCE((
            SELECT COUNT(*) FROM public.seat_ledger 
            WHERE trip_id = target_trip_id AND payment_method = 'cash'
        ), 0),
        total_revenue_zar = COALESCE((
            SELECT SUM(fare_amount) FROM public.seat_ledger 
            WHERE trip_id = target_trip_id
        ), 0.00),
        updated_at = NOW()
    WHERE id = target_trip_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_minibus_trip_ledger ON public.seat_ledger;
CREATE TRIGGER trigger_sync_minibus_trip_ledger
    AFTER INSERT OR UPDATE OR DELETE ON public.seat_ledger
    FOR EACH ROW EXECUTE FUNCTION public.sync_minibus_trip_seats_and_revenue();

-- Automatically create a profile when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, user_type)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
        NEW.raw_user_meta_data->>'phone',
        COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'rider')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = COALESCE(EXCLUDED.phone, profiles.phone);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------
-- 6. STORED PROCEDURES & SPATIAL RPC FUNCTIONS
-- --------------------------------------------------------------------

-- Spatial Query: Find nearby online drivers within radius (Kimberley, Cape Town, etc.)
CREATE OR REPLACE FUNCTION public.get_nearby_drivers(
    p_lat FLOAT8,
    p_lng FLOAT8,
    p_radius_meters FLOAT8 DEFAULT 15000
)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    vehicle_make TEXT,
    vehicle_model TEXT,
    license_plate TEXT,
    current_lat FLOAT8,
    current_lng FLOAT8,
    rating_avg NUMERIC,
    rating_count INT,
    distance_km FLOAT8
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        COALESCE(p.full_name, d.full_name) AS full_name,
        d.vehicle_make,
        d.vehicle_model,
        d.license_plate,
        d.current_lat,
        d.current_lng,
        d.rating_avg,
        d.rating_count,
        ROUND((ST_Distance(d.location_geo, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000.0)::numeric, 2)::float8 AS distance_km
    FROM public.driver_profiles d
    LEFT JOIN public.profiles p ON p.id = d.id
    WHERE d.is_online = true
      AND d.location_geo IS NOT NULL
      AND ST_DWithin(d.location_geo, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_meters)
    ORDER BY d.location_geo <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Spatial Query: Find nearby requested trips waiting for a driver
CREATE OR REPLACE FUNCTION public.get_nearby_requested_trips(
    p_lat FLOAT8,
    p_lng FLOAT8,
    p_radius_meters FLOAT8 DEFAULT 25000
)
RETURNS TABLE (
    id UUID,
    rider_id UUID,
    rider_name TEXT,
    pickup_location TEXT,
    pickup_lat FLOAT8,
    pickup_lng FLOAT8,
    dropoff_location TEXT,
    dropoff_lat FLOAT8,
    dropoff_lng FLOAT8,
    fare_amount NUMERIC,
    status TEXT,
    scheduled_time TIMESTAMPTZ,
    distance_km FLOAT8,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.rider_id,
        COALESCE(p.full_name, 'Rider') AS rider_name,
        t.pickup_location,
        t.pickup_lat,
        t.pickup_lng,
        t.dropoff_location,
        t.dropoff_lat,
        t.dropoff_lng,
        t.fare_amount,
        t.status,
        t.scheduled_time,
        ROUND((ST_Distance(
            ST_SetSRID(ST_MakePoint(t.pickup_lng, t.pickup_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        ) / 1000.0)::numeric, 2)::float8 AS distance_km,
        t.created_at
    FROM public.trips t
    LEFT JOIN public.profiles p ON p.id = t.rider_id
    WHERE t.status = 'requested'
      AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(t.pickup_lng, t.pickup_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          p_radius_meters
      )
    ORDER BY t.created_at DESC
    LIMIT 25;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Accept Trip RPC (Concurrency-safe)
CREATE OR REPLACE FUNCTION public.accept_trip(p_trip_id UUID)
RETURNS JSON AS $$
DECLARE
    v_driver_id UUID := auth.uid();
    v_trip RECORD;
BEGIN
    SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Trip not found');
    END IF;

    IF v_trip.status != 'requested' THEN
        RETURN json_build_object('success', false, 'error', 'Trip is already taken or cancelled');
    END IF;

    UPDATE public.trips
    SET 
        driver_id = v_driver_id,
        status = 'accepted',
        updated_at = NOW()
    WHERE id = p_trip_id;

    RETURN json_build_object('success', true, 'trip_id', p_trip_id, 'status', 'accepted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Start Trip with PIN Verification RPC
CREATE OR REPLACE FUNCTION public.start_trip(p_trip_id UUID, p_pin VARCHAR)
RETURNS JSON AS $$
DECLARE
    v_trip RECORD;
BEGIN
    SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Trip not found');
    END IF;

    IF v_trip.verification_pin != p_pin THEN
        RETURN json_build_object('success', false, 'error', 'Invalid 4-digit verification PIN');
    END IF;

    UPDATE public.trips
    SET status = 'in_progress', updated_at = NOW()
    WHERE id = p_trip_id;

    RETURN json_build_object('success', true, 'status', 'in_progress');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete Trip RPC
CREATE OR REPLACE FUNCTION public.complete_trip(p_trip_id UUID, p_payment_method TEXT DEFAULT 'in_app')
RETURNS JSON AS $$
BEGIN
    UPDATE public.trips
    SET 
        status = 'completed',
        completed_at = NOW(),
        payment_method = p_payment_method,
        payment_status = 'paid',
        updated_at = NOW()
    WHERE id = p_trip_id;

    RETURN json_build_object('success', true, 'status', 'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_driver_profiles_location_geo ON public.driver_profiles USING GIST(location_geo);
CREATE INDEX IF NOT EXISTS idx_driver_locations_spatial ON public.driver_locations USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON public.trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_rider_id ON public.trips(rider_id);
CREATE INDEX IF NOT EXISTS idx_trips_pickup_coords ON public.trips(pickup_lat, pickup_lng);
CREATE INDEX IF NOT EXISTS idx_minibus_trips_corridor ON public.minibus_trips(corridor_id);
CREATE INDEX IF NOT EXISTS idx_minibus_trips_vehicle ON public.minibus_trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_minibus_trips_status ON public.minibus_trips(status);
CREATE INDEX IF NOT EXISTS idx_seat_ledger_trip ON public.seat_ledger(trip_id);
CREATE INDEX IF NOT EXISTS idx_seat_ledger_passenger_phone ON public.seat_ledger(passenger_phone);

-- --------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES (Supabase Advisor Compliant)
-- --------------------------------------------------------------------
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
    END LOOP;
END $$;

-- Profiles: Public read, user write
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Driver Profiles: Public read, driver update own
CREATE POLICY "driver_profiles_select_all" ON public.driver_profiles FOR SELECT USING (true);
CREATE POLICY "driver_profiles_update_own" ON public.driver_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "driver_profiles_insert_own" ON public.driver_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Driver Documents: Driver manages own docs, admin can review
CREATE POLICY "driver_docs_select_own" ON public.driver_documents FOR SELECT USING (driver_id = auth.uid());
CREATE POLICY "driver_docs_insert_own" ON public.driver_documents FOR INSERT WITH CHECK (driver_id = auth.uid());
CREATE POLICY "driver_docs_update_own" ON public.driver_documents FOR UPDATE USING (driver_id = auth.uid());

-- Trips: Public readable for dispatch, rider/driver editable
CREATE POLICY "trips_select_all" ON public.trips FOR SELECT USING (true);
CREATE POLICY "trips_insert_rider" ON public.trips FOR INSERT WITH CHECK (auth.uid() = rider_id);
CREATE POLICY "trips_update_participants" ON public.trips FOR UPDATE USING (
    auth.uid() = rider_id OR auth.uid() = driver_id OR driver_id IS NULL
);

-- Trip Messages & Ratings
CREATE POLICY "trip_messages_select" ON public.trip_messages FOR SELECT USING (true);
CREATE POLICY "trip_messages_insert" ON public.trip_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "trip_ratings_select" ON public.trip_ratings FOR SELECT USING (true);
CREATE POLICY "trip_ratings_insert" ON public.trip_ratings FOR INSERT WITH CHECK (auth.uid() = rider_id);

-- Minibus Suite Policies
CREATE POLICY "associations_select" ON public.associations FOR SELECT USING (true);
CREATE POLICY "vehicles_select" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "vehicles_owner_manage" ON public.vehicles FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "corridors_select" ON public.corridors FOR SELECT USING (true);
CREATE POLICY "minibus_trips_select" ON public.minibus_trips FOR SELECT USING (true);
CREATE POLICY "minibus_trips_update" ON public.minibus_trips FOR UPDATE USING (true);
CREATE POLICY "seat_ledger_select" ON public.seat_ledger FOR SELECT USING (true);
CREATE POLICY "seat_ledger_insert" ON public.seat_ledger FOR INSERT WITH CHECK (true);

-- Driver Locations & Bids
CREATE POLICY "driver_locations_select" ON public.driver_locations FOR SELECT USING (true);
CREATE POLICY "driver_locations_all" ON public.driver_locations FOR ALL USING (driver_id = auth.uid());
CREATE POLICY "ride_bids_select" ON public.ride_bids FOR SELECT USING (true);
CREATE POLICY "ride_bids_manage" ON public.ride_bids FOR ALL USING (driver_id = auth.uid());

-- Bank Details & Safety
CREATE POLICY "bank_details_manage" ON public.driver_bank_details FOR ALL USING (driver_id = auth.uid());
CREATE POLICY "safety_incidents_all" ON public.safety_incidents FOR ALL USING (true);
CREATE POLICY "web_push_manage" ON public.web_push_subscriptions FOR ALL USING (user_id = auth.uid());

-- --------------------------------------------------------------------
-- 9. SUPABASE REALTIME REPLICATION
-- --------------------------------------------------------------------
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.minibus_trips;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seat_ledger;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_profiles;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_bids;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- --------------------------------------------------------------------
-- 10. STORAGE BUCKETS (Driver Documents & Avatars)
-- --------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "driver_docs_select_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'driver-documents' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "driver_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'driver-documents' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_select_public" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- --------------------------------------------------------------------
-- 11. STARTER SEED DATA (Associations & Minibus Corridors)
-- --------------------------------------------------------------------
INSERT INTO public.associations (id, name, short_code, region, contact_phone, contact_email, operating_city)
VALUES 
    ('assoc-santaco-kby', 'SANTACO Kimberley Local Taxi Association', 'KLTA-SANTACO', 'Northern Cape', '+27 53 831 2400', 'admin@kimberleytaxis.co.za', 'Kimberley'),
    ('assoc-codeta-wc', 'CODETA Cape Town Regional Association', 'CODETA', 'Western Cape', '+27 21 386 1100', 'dispatch@codeta.co.za', 'Cape Town'),
    ('assoc-santaco-gp', 'Bree Street United Taxi Association', 'BUTA-SANTACO', 'Gauteng', '+27 11 333 4500', 'ops@breetaxis.co.za', 'Johannesburg')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.corridors (id, origin_rank, destination, standard_fare, distance_km, estimated_duration_minutes)
VALUES
    ('corr-kby-galeshewe', 'Kimberley CBD Main Rank (Old Market)', 'Galeshewe Zone 4 / Circle', 16.00, 8.5, 18),
    ('corr-kby-roodepan', 'Kimberley CBD Main Rank (Old Market)', 'Roodepan Terminus via Barkly Rd', 18.00, 12.0, 24),
    ('corr-kby-greenpoint', 'Kimberley CBD Main Rank (Old Market)', 'Greenpoint Primary & Diamond Park', 17.00, 9.2, 20),
    ('corr-cpt-khayelitsha', 'Cape Town Station Deck Rank', 'Khayelitsha Site C via N2 Express', 28.00, 32.0, 45),
    ('corr-jhb-soweto', 'Johannesburg Bree Street Taxi Rank', 'Soweto Baragwanath Hospital Hub', 22.00, 16.5, 30)
ON CONFLICT (id) DO NOTHING;

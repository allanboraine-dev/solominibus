-- ====================================================================
-- SOLO PLATFORM: MIGRATION 0015
-- MINIBUS FLEET, CORRIDORS, MANIFESTS & SEAT LEDGER MODULE
-- ====================================================================
-- Safe, Non-Breaking Extension for SOLO Taxi Fleet & Rank Operations
-- Preserves existing e-hailing 'trips' table while introducing
-- Minibus Associations, 15-Seater Fleet, Corridors, and Seat Manifests.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. ASSOCIATIONS TABLE (Dependency for Vehicles)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    short_code VARCHAR(30) UNIQUE, -- e.g., 'CODETA', 'CATA', 'SANTACO_KBY'
    contact_person VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    operating_city VARCHAR(100) DEFAULT 'Kimberley',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure RLS is enabled
ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 2. VEHICLES (Minibus Fleet)
-- --------------------------------------------------------------------
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 3. CORRIDORS & ROUTES (Rank to Rank)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.corridors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_rank VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    standard_fare DECIMAL(10,2) NOT NULL CHECK (standard_fare >= 0),
    distance_km DECIMAL(6,2),
    estimated_duration_minutes INT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.corridors ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 4. MINIBUS FLEET TRIPS (Non-Breaking Manifest Architecture)
-- Note: 'minibus_trips' prevents catastrophic collision with SOLO's
-- existing 1-on-1 e-hailing 'trips' table while matching exact fields.
-- --------------------------------------------------------------------
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
    dispatched_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.minibus_trips ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 5. PASSENGER BOARDING / SEAT LEDGER
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seat_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.minibus_trips(id) ON DELETE CASCADE,
    seat_number INT NOT NULL CHECK (seat_number BETWEEN 1 AND 15),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('digital_paystack', 'cash', 'qr_wallet')),
    fare_amount DECIMAL(10,2) NOT NULL CHECK (fare_amount >= 0),
    passenger_phone VARCHAR(20),
    passenger_name VARCHAR(100),
    logged_by VARCHAR(20) NOT NULL CHECK (logged_by IN ('commuter_scan', 'conductor_manual', 'marshal_manual')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Prevent double booking of the exact same seat on the same journey
    CONSTRAINT unique_trip_seat_reservation UNIQUE (trip_id, seat_number)
);

ALTER TABLE public.seat_ledger ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 6. REALTIME AUTOMATION TRIGGER: AUTO-SYNC TRIP SEAT TALLIES & REVENUE
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_minibus_trip_seats_and_revenue()
RETURNS TRIGGER AS $$
DECLARE
    target_trip_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_trip_id := OLD.trip_id;
    ELSE
        target_trip_id := NEW.trip_id;
    END IF;

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

-- --------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vehicles_association ON public.vehicles(association_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON public.vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON public.vehicles(registration_plate);
CREATE INDEX IF NOT EXISTS idx_minibus_trips_corridor ON public.minibus_trips(corridor_id);
CREATE INDEX IF NOT EXISTS idx_minibus_trips_vehicle ON public.minibus_trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_minibus_trips_status ON public.minibus_trips(status);
CREATE INDEX IF NOT EXISTS idx_seat_ledger_trip ON public.seat_ledger(trip_id);
CREATE INDEX IF NOT EXISTS idx_seat_ledger_passenger_phone ON public.seat_ledger(passenger_phone);

-- --------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------------------
-- Associations: Viewable by authenticated users, editable by admins
CREATE POLICY "associations_select" ON public.associations FOR SELECT USING (true);
CREATE POLICY "associations_admin_all" ON public.associations FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
);

-- Vehicles: Viewable by everyone; managed by vehicle owner or admins
CREATE POLICY "vehicles_select" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "vehicles_owner_manage" ON public.vehicles FOR ALL USING (
    owner_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
);

-- Corridors: Publicly readable by all riders and operators
CREATE POLICY "corridors_select" ON public.corridors FOR SELECT USING (true);
CREATE POLICY "corridors_admin_manage" ON public.corridors FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
);

-- Minibus Trips: Viewable by commuters, drivers, marshals, and admins
CREATE POLICY "minibus_trips_select" ON public.minibus_trips FOR SELECT USING (true);
CREATE POLICY "minibus_trips_driver_marshal_update" ON public.minibus_trips FOR UPDATE USING (
    driver_id = auth.uid() OR marshal_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
);
CREATE POLICY "minibus_trips_insert" ON public.minibus_trips FOR INSERT WITH CHECK (
    driver_id = auth.uid() OR marshal_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
);

-- Seat Ledger:
CREATE POLICY "seat_ledger_select" ON public.seat_ledger FOR SELECT USING (true);
CREATE POLICY "seat_ledger_insert" ON public.seat_ledger FOR INSERT WITH CHECK (true);
CREATE POLICY "seat_ledger_update" ON public.seat_ledger FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('driver', 'admin'))
);

-- Enable Realtime for Minibus Trips and Seat Ledger
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.minibus_trips;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seat_ledger;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- PHASE 2: DINESCAN MULTI-TENANT SCHEMA, RLS & REALTIME CONFIGURATION
-- ==============================================================================

-- 1. EXTENSIONS & HELPER FUNCTIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. CORE MULTI-TENANT HIERARCHY
-- ==============================================================================

-- Organizations (e.g., Restaurant Group / Enterprise)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Properties (Individual restaurant locations/branches under an organization)
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, slug)
);

-- Locations (Specific tables, rooms, booths, cabanas, or bar stations)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Table 12", "Room 402", "Patio 3"
    qr_code_identifier TEXT NOT NULL, -- Unique token/slug embedded in physical QR
    location_type TEXT NOT NULL DEFAULT 'table', -- 'table', 'room', 'bar', 'pickup'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (property_id, qr_code_identifier)
);

-- Staff Members (Maps auth.users to properties with role permissions)
CREATE TABLE IF NOT EXISTS property_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'staff', -- 'owner', 'manager', 'staff', 'kitchen'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, property_id)
);

-- ==============================================================================
-- 3. DINING, GUEST SESSIONS & ORDERING ENGINE
-- ==============================================================================

-- Guest Sessions (The continuous open tab created when scanning the QR code)
CREATE TABLE IF NOT EXISTS guest_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    session_token UUID NOT NULL DEFAULT gen_random_uuid(), -- Guest client token
    guest_name TEXT,
    guest_phone TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'closed', 'paid', 'abandoned'
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- e.g. "Starters", "Mains", "Drinks", "Desserts"
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    dietary_tags TEXT[] DEFAULT '{}', -- ['vegan', 'gluten-free', 'spicy']
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders (Each round of items sent to kitchen within an open guest tab)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_session_id UUID NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'preparing', 'ready', 'served', 'cancelled'
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    special_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order Items (Specific dishes/quantities in an order)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(10, 2) NOT NULL,
    notes TEXT, -- e.g. "No onions, extra spicy"
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'cooking', 'ready', 'served'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. AUTO-UPDATE TRIGGERS & INDEXES
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_organizations_updated_at') THEN
        CREATE TRIGGER tr_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_properties_updated_at') THEN
        CREATE TRIGGER tr_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_locations_updated_at') THEN
        CREATE TRIGGER tr_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_menu_items_updated_at') THEN
        CREATE TRIGGER tr_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_orders_updated_at') THEN
        CREATE TRIGGER tr_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_locations_qr ON locations(qr_code_identifier);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_active ON guest_sessions(property_id, location_id, status);
CREATE INDEX IF NOT EXISTS idx_menu_items_property ON menu_items(property_id, is_available);
CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_property_status ON orders(property_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check if authenticated user is staff for a given property
CREATE OR REPLACE FUNCTION is_property_staff(p_property_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM property_staff
        WHERE user_id = auth.uid()
          AND property_id = p_property_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- Organizations & Properties Policies ---
DROP POLICY IF EXISTS "Public read for active properties" ON properties;
CREATE POLICY "Public read for active properties"
    ON properties FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Staff read properties" ON properties;
CREATE POLICY "Staff read properties"
    ON properties FOR ALL
    USING (is_property_staff(id));

DROP POLICY IF EXISTS "Staff read organizations" ON organizations;
CREATE POLICY "Staff read organizations"
    ON organizations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM properties p
            WHERE p.organization_id = organizations.id
              AND is_property_staff(p.id)
        )
    );

-- --- Locations Policies ---
DROP POLICY IF EXISTS "Public read for active locations" ON locations;
CREATE POLICY "Public read for active locations"
    ON locations FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Staff full access to locations" ON locations;
CREATE POLICY "Staff full access to locations"
    ON locations FOR ALL
    USING (is_property_staff(property_id));

-- --- Menu Items Policies ---
DROP POLICY IF EXISTS "Public can view available menu items" ON menu_items;
CREATE POLICY "Public can view available menu items"
    ON menu_items FOR SELECT
    USING (is_available = TRUE);

DROP POLICY IF EXISTS "Staff full access to menu items" ON menu_items;
CREATE POLICY "Staff full access to menu items"
    ON menu_items FOR ALL
    USING (is_property_staff(property_id));

-- --- Guest Sessions Policies ---
DROP POLICY IF EXISTS "Guests can insert session" ON guest_sessions;
CREATE POLICY "Guests can insert session"
    ON guest_sessions FOR INSERT
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Guests and staff can view guest session" ON guest_sessions;
CREATE POLICY "Guests and staff can view guest session"
    ON guest_sessions FOR SELECT
    USING (
        is_property_staff(property_id) OR
        session_token::text = coalesce(current_setting('request.headers', true)::json->>'x-session-token', session_token::text)
    );

-- --- Orders Policies ---
DROP POLICY IF EXISTS "Guests can create orders for active session" ON orders;
CREATE POLICY "Guests can create orders for active session"
    ON orders FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM guest_sessions gs
            WHERE gs.id = guest_session_id
              AND gs.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Guests and staff can view orders" ON orders;
CREATE POLICY "Guests and staff can view orders"
    ON orders FOR SELECT
    USING (
        is_property_staff(property_id) OR
        EXISTS (
            SELECT 1 FROM guest_sessions gs
            WHERE gs.id = orders.guest_session_id
        )
    );

DROP POLICY IF EXISTS "Staff can update orders" ON orders;
CREATE POLICY "Staff can update orders"
    ON orders FOR UPDATE
    USING (is_property_staff(property_id));

-- --- Order Items Policies ---
DROP POLICY IF EXISTS "Guests can insert order items" ON order_items;
CREATE POLICY "Guests can insert order items"
    ON order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN guest_sessions gs ON gs.id = o.guest_session_id
            WHERE o.id = order_items.order_id
              AND gs.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Guests and staff can view order items" ON order_items;
CREATE POLICY "Guests and staff can view order items"
    ON order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id
              AND (
                  is_property_staff(o.property_id) OR
                  EXISTS (
                      SELECT 1 FROM guest_sessions gs
                      WHERE gs.id = o.guest_session_id
                  )
              )
        )
    );

DROP POLICY IF EXISTS "Staff can update order items" ON order_items;
CREATE POLICY "Staff can update order items"
    ON order_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id
              AND is_property_staff(o.property_id)
        )
    );

-- ==============================================================================
-- 6. REALTIME REPLICATION ENABLEMENT
-- ==============================================================================

-- Enable full replica identity
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE guest_sessions REPLICA IDENTITY FULL;

-- Add tables to the Supabase Realtime publication
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE guest_sessions;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

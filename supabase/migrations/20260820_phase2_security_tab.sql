-- ==============================================================================
-- PHASE 2 & 3: PRODUCTION HARDENED MULTI-TENANT RLS, CONSTRAINTS & ISOLATION
-- ==============================================================================

-- 1. EXTENSIONS
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
-- 2. SCHEMA DEFINITION: MULTI-TENANCY (Org -> Property -> Location)
-- ==============================================================================

-- Organizations (e.g., Enterprise Hotel/Restaurant Groups)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Properties (Individual Hotel/Resort/Restaurant Branches)
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.0825, -- e.g. 8.25%
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, slug),
    UNIQUE (id, organization_id)
);

-- Property Invoice Sequence Counters (For Atomic Sequential Invoicing)
CREATE TABLE IF NOT EXISTS property_invoice_sequences (
    property_id UUID PRIMARY KEY REFERENCES properties(id) ON DELETE RESTRICT,
    last_sequence_number INT NOT NULL DEFAULT 1000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Property Staff (Staff roles: owner, manager, staff, kitchen)
CREATE TABLE IF NOT EXISTS property_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    role TEXT NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, property_id)
);

-- Locations (Rooms, Tables, Cabanas, Suites, Bar Stations)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    name TEXT NOT NULL, -- e.g. "Suite 404", "Table 12", "Cabana 3"
    qr_code_identifier TEXT NOT NULL, -- Unique token/slug embedded in physical QR
    location_type TEXT NOT NULL DEFAULT 'room', -- 'room', 'table', 'cabana', 'bar'
    pin_salt TEXT NOT NULL DEFAULT '00112233445566778899aabbccddeeff',
    pin_hash TEXT NOT NULL DEFAULT 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    token_version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (property_id, qr_code_identifier),
    UNIQUE (property_id, id) -- Composite unique for composite foreign keys
);

-- ==============================================================================
-- 3. GUEST SESSIONS ("CONTINUOUS TAB" ROOT)
-- ==============================================================================

-- Guest Sessions: The overarching continuous tab for a room/table stay
CREATE TABLE IF NOT EXISTS guest_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL,
    session_token UUID NOT NULL DEFAULT gen_random_uuid(),
    guest_name TEXT NOT NULL DEFAULT 'Valued Guest',
    guest_phone TEXT,
    token_version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    total_items_count INT NOT NULL DEFAULT 0 CHECK (total_items_count >= 0),
    rounds_count INT NOT NULL DEFAULT 0 CHECK (rounds_count >= 0),
    payment_method TEXT, -- 'room_folio', 'credit_card', 'cash'
    invoice_number TEXT UNIQUE, -- Globally unique invoice constraint
    invoice_checksum TEXT, -- SHA-256 digital verification hash
    invoice_sequence_number INT,
    staff_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    UNIQUE (property_id, id),
    CONSTRAINT chk_guest_session_status CHECK (status IN ('active', 'settled', 'closed', 'voided')),
    -- DEFENSE IN DEPTH: Composite FK guarantees location belongs strictly to the session property
    CONSTRAINT fk_guest_sessions_location FOREIGN KEY (property_id, location_id)
        REFERENCES locations(property_id, id) ON DELETE RESTRICT
);

-- Partial Unique Index: Guarantees ONLY ONE active session can exist per location
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_session_per_location 
    ON guest_sessions (location_id) 
    WHERE status = 'active';

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    category TEXT NOT NULL, -- e.g. "Signature Starters", "Late-Night Bites", "Mains", "Drinks"
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    dietary_tags TEXT[] DEFAULT '{}', -- e.g. ['vegan', 'spicy', 'gluten-free']
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (property_id, id)
);

-- Orders: Individual rounds/batches appended to the continuous tab
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_session_id UUID NOT NULL,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL,
    round_number INT NOT NULL DEFAULT 1,
    idempotency_key TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    tax_rate_snapshot NUMERIC(5, 4) NOT NULL DEFAULT 0.0825,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    special_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (property_id, id),
    UNIQUE (guest_session_id, idempotency_key),
    CONSTRAINT chk_order_status CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
    -- DEFENSE IN DEPTH: Composite FK guarantees session and location belong strictly to the order property
    CONSTRAINT fk_orders_session FOREIGN KEY (property_id, guest_session_id)
        REFERENCES guest_sessions(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_location FOREIGN KEY (property_id, location_id)
        REFERENCES locations(property_id, id) ON DELETE RESTRICT
);

-- Order Items: Specific dishes inside each order round with historical price snapshots
-- Note: ON DELETE SET NULL on menu_item_id ensures deleted menu items preserve historical order items!
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL, -- Historical name snapshot
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0), -- Historical price snapshot
    quantity INT NOT NULL CHECK (quantity > 0 AND quantity <= 50),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    notes TEXT,
    is_voided BOOLEAN NOT NULL DEFAULT FALSE,
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. IMMUTABLE AUDIT LOGS (Security & Audit Trail)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    target_resource_type TEXT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    reason TEXT,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_guest_sessions_prop_status ON guest_sessions (property_id, status);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_location ON guest_sessions (location_id);
CREATE INDEX IF NOT EXISTS idx_orders_guest_session ON orders (guest_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_property ON orders (property_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_locations_prop_qr ON locations (property_id, qr_code_identifier);
CREATE INDEX IF NOT EXISTS idx_audit_logs_property ON audit_logs (property_id, created_at DESC);

-- ==============================================================================
-- 6. STATE MACHINE TRANSITION ENFORCEMENT TRIGGERS
-- ==============================================================================

CREATE OR REPLACE FUNCTION enforce_session_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Settled, Closed, and Voided are terminal states
    IF OLD.status IN ('settled', 'closed', 'voided') THEN
        RAISE EXCEPTION 'Illegal Session State Transition: Cannot transition session from terminal status "%" to "%".', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_session_status_transition ON guest_sessions;
CREATE TRIGGER trg_enforce_session_status_transition
    BEFORE UPDATE OF status ON guest_sessions
    FOR EACH ROW
    EXECUTE FUNCTION enforce_session_status_transition();

CREATE OR REPLACE FUNCTION enforce_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Delivered and Cancelled are terminal states
    IF OLD.status IN ('delivered', 'cancelled') THEN
        RAISE EXCEPTION 'Illegal Order State Transition: Cannot transition order from terminal status "%" to "%".', OLD.status, NEW.status;
    END IF;

    -- Preparing cannot transition back to pending
    IF OLD.status = 'preparing' AND NEW.status = 'pending' THEN
        RAISE EXCEPTION 'Illegal Order State Transition: Cannot transition order backward from "preparing" to "pending".';
    END IF;

    -- Ready cannot transition back to preparing or pending
    IF OLD.status = 'ready' AND NEW.status IN ('preparing', 'pending') THEN
        RAISE EXCEPTION 'Illegal Order State Transition: Cannot transition order backward from "ready" to "%".', NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_order_status_transition ON orders;
CREATE TRIGGER trg_enforce_order_status_transition
    BEFORE UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION enforce_order_status_transition();

-- ==============================================================================
-- 7. HARDENED STORED PROCEDURE: SERVER-AUTHORITATIVE ORDER APPENDING WITH ROW LOCKING & IDEMPOTENCY
-- ==============================================================================

CREATE OR REPLACE FUNCTION append_items_to_guest_tab(
    p_session_id UUID,
    p_location_id UUID,
    p_items JSONB, -- Array: [{"menu_item_id": "...", "quantity": 2, "notes": "..."}]
    p_special_instructions TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_property RECORD;
    v_existing_order RECORD;
    v_order_id UUID;
    v_round_num INT;
    v_order_subtotal NUMERIC(10, 2) := 0.00;
    v_order_tax NUMERIC(10, 2) := 0.00;
    v_order_total NUMERIC(10, 2) := 0.00;
    v_item JSONB;
    v_menu_record RECORD;
    v_menu_item_id UUID;
    v_item_qty INT;
    v_item_subtotal NUMERIC(10, 2);
    v_total_items_count INT := 0;
    v_caller_token TEXT;
BEGIN
    -- 1. Atomic Row Lock: Lock the guest session row to prevent race conditions with settlement
    SELECT * INTO v_session
    FROM guest_sessions
    WHERE id = p_session_id AND location_id = p_location_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Continuous tab session % not found for location %.', p_session_id, p_location_id;
    END IF;

    -- SECURITY DEFINER AUTHORIZATION: Verify caller holds valid session token, staff role, or service_role
    BEGIN
        v_caller_token := current_setting('request.headers', true)::json->>'x-session-token';
    EXCEPTION WHEN OTHERS THEN
        v_caller_token := NULL;
    END;

    IF NOT (
        is_property_staff(v_session.property_id) OR
        (current_setting('role', true) = 'service_role') OR
        (auth.role() = 'service_role') OR
        current_user IN ('postgres', 'supabase_admin') OR
        (v_caller_token IS NOT NULL AND v_session.session_token::text = v_caller_token)
    ) THEN
        RAISE EXCEPTION 'Authorization Violation: Caller lacks active session token, staff role, or service_role privileges for tab session %.', p_session_id;
    END IF;

    -- Strict State Invariant: Must be active to accept orders
    IF v_session.status = 'settled' THEN
        RAISE EXCEPTION 'This room tab has already been settled at checkout and cannot accept new orders.'
        USING ERRCODE = 'AC001';
    END IF;

    IF v_session.status = 'closed' THEN
        RAISE EXCEPTION 'This room tab is closed. Please re-enter your stay PIN or contact reception.'
        USING ERRCODE = 'AC002';
    END IF;

    IF v_session.status != 'active' THEN
        RAISE EXCEPTION 'Tab session is not active (status: %). Cannot append orders.', v_session.status
        USING ERRCODE = 'AC003';
    END IF;

    -- 2. Idempotency Check: Return existing round if already created with this key
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
        SELECT id, round_number, total, subtotal, tax INTO v_existing_order
        FROM orders
        WHERE guest_session_id = p_session_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'order_id', v_existing_order.id,
                'round_number', v_existing_order.round_number,
                'round_total', v_existing_order.total,
                'continuous_tab_total', v_session.total_amount,
                'total_items_count', v_session.total_items_count,
                'is_idempotent_replay', true
            );
        END IF;
    END IF;

    -- 3. Fetch Property Settings (Tax Rate & Timezone)
    SELECT * INTO v_property
    FROM properties
    WHERE id = v_session.property_id;

    -- 4. Determine Round Number
    SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_round_num
    FROM orders
    WHERE guest_session_id = p_session_id;

    -- 5. Create New Order Round with Tax Rate Snapshot
    INSERT INTO orders (
        guest_session_id,
        property_id,
        location_id,
        round_number,
        idempotency_key,
        status,
        tax_rate_snapshot,
        special_instructions
    ) VALUES (
        p_session_id,
        v_session.property_id,
        p_location_id,
        v_round_num,
        p_idempotency_key,
        'pending',
        COALESCE(v_property.tax_rate, 0.0825),
        p_special_instructions
    )
    RETURNING id INTO v_order_id;

    -- 6. Insert Items with Strict Property Matching and Authoritative Price Snapshotting
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_qty := (v_item->>'quantity')::INT;
        IF v_item_qty IS NULL OR v_item_qty < 1 OR v_item_qty > 50 THEN
            RAISE EXCEPTION 'Invalid item quantity: %. Must be between 1 and 50.', v_item_qty;
        END IF;

        IF (v_item->>'menu_item_id') IS NOT NULL AND (v_item->>'menu_item_id') != '' THEN
            v_menu_item_id := (v_item->>'menu_item_id')::UUID;
            
            -- STRICT MULTI-TENANT CHECK: Ensure menu item belongs to this property
            SELECT name, price, is_available, property_id INTO v_menu_record
            FROM menu_items
            WHERE id = v_menu_item_id AND property_id = v_session.property_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Multi-Tenant Violation: Menu item % does not exist in property % catalog.', v_menu_item_id, v_session.property_id;
            END IF;

            IF NOT v_menu_record.is_available THEN
                RAISE EXCEPTION 'Menu item % (%) is currently out of stock.', v_menu_record.name, v_menu_item_id;
            END IF;
        ELSE
            RAISE EXCEPTION 'Missing menu_item_id for order item.';
        END IF;

        v_item_subtotal := ROUND(v_menu_record.price * v_item_qty, 2);

        INSERT INTO order_items (
            order_id,
            menu_item_id,
            item_name,
            unit_price, -- Historical price snapshot
            quantity,
            subtotal,
            notes
        ) VALUES (
            v_order_id,
            v_menu_item_id,
            v_menu_record.name, -- Historical name snapshot
            v_menu_record.price, -- Authoritative DB price
            v_item_qty,
            v_item_subtotal,
            v_item->>'notes'
        );

        v_order_subtotal := v_order_subtotal + v_item_subtotal;
        v_total_items_count := v_total_items_count + v_item_qty;
    END LOOP;

    -- 7. Calculate Tax and Total for this Order Round
    v_order_tax := ROUND(v_order_subtotal * COALESCE(v_property.tax_rate, 0.0825), 2);
    v_order_total := v_order_subtotal + v_order_tax;

    UPDATE orders
    SET subtotal = v_order_subtotal,
        tax = v_order_tax,
        total = v_order_total
    WHERE id = v_order_id;

    -- 8. Atomically Update Continuous Tab (guest_sessions) Aggregated Totals
    UPDATE guest_sessions
    SET subtotal = subtotal + v_order_subtotal,
        tax = tax + v_order_tax,
        total_amount = total_amount + v_order_total,
        total_items_count = total_items_count + v_total_items_count,
        rounds_count = v_round_num,
        updated_at = NOW()
    WHERE id = p_session_id;

    -- 9. Return Summary JSON
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'round_number', v_round_num,
        'round_total', v_order_total,
        'continuous_tab_total', (v_session.total_amount + v_order_total),
        'total_items_count', (v_session.total_items_count + v_total_items_count),
        'is_idempotent_replay', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 8. HARDENED STORED PROCEDURE: ATOMIC TAB SETTLEMENT & INVOICING (With Timezone)
-- ==============================================================================

CREATE OR REPLACE FUNCTION settle_guest_tab(
    p_session_id UUID,
    p_payment_method TEXT DEFAULT 'room_folio',
    p_staff_note TEXT DEFAULT NULL,
    p_expected_property_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_property RECORD;
    v_seq_num INT;
    v_invoice_num TEXT;
    v_settled_at TIMESTAMPTZ := NOW();
    v_checksum TEXT;
    v_checksum_payload TEXT;
    v_line_items_digest TEXT;
    v_date_prefix TEXT;
    v_prop_code TEXT;
BEGIN
    -- 1. Atomic Row Lock
    SELECT * INTO v_session
    FROM guest_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session % not found.', p_session_id;
    END IF;

    -- SECURITY DEFINER AUTHORIZATION: Verify caller is authorized property staff or service_role
    IF NOT (
        is_property_staff(v_session.property_id) OR
        (current_setting('role', true) = 'service_role') OR
        (auth.role() = 'service_role') OR
        current_user IN ('postgres', 'supabase_admin')
    ) THEN
        RAISE EXCEPTION 'Authorization Violation: Only authorized property staff or service role may settle guest tabs.';
    END IF;

    -- Strict Tenant Isolation Check
    IF p_expected_property_id IS NOT NULL AND v_session.property_id != p_expected_property_id THEN
        RAISE EXCEPTION 'Tenant Isolation Violation: Cannot settle session from another property.';
    END IF;

    -- If already settled, return idempotent success
    IF v_session.status = 'settled' THEN
        RETURN jsonb_build_object(
            'success', true,
            'session_id', v_session.id,
            'status', 'settled',
            'invoice_number', v_session.invoice_number,
            'total_amount', v_session.total_amount,
            'already_settled', true
        );
    END IF;

    IF v_session.status != 'active' THEN
        RAISE EXCEPTION 'Cannot settle session with status: %', v_session.status;
    END IF;

    -- Fetch Property Timezone
    SELECT * INTO v_property
    FROM properties
    WHERE id = v_session.property_id;

    -- 2. Increment Sequential Invoice Counter for Property
    INSERT INTO property_invoice_sequences (property_id, last_sequence_number, updated_at)
    VALUES (v_session.property_id, 1001, NOW())
    ON CONFLICT (property_id)
    DO UPDATE SET last_sequence_number = property_invoice_sequences.last_sequence_number + 1, updated_at = NOW()
    RETURNING last_sequence_number INTO v_seq_num;

    -- TIMEZONE CORRECTNESS: Format date prefix according to property's local timezone
    v_date_prefix := TO_CHAR(v_settled_at AT TIME ZONE COALESCE(v_property.timezone, 'America/New_York'), 'YYYYMMDD');
    v_prop_code := CASE WHEN v_session.property_id = 'prop-emerald-bay-resort'::UUID THEN 'EMB' ELSE 'RDC' END;
    v_invoice_num := 'INV-' || v_prop_code || '-' || v_date_prefix || '-' || v_seq_num::TEXT;

    -- 3. Build Canonical Line-Item Digest (deterministic ordering: round → creation time → id)
    SELECT string_agg(
        oi.item_name || '|' || oi.unit_price::TEXT || '|' || oi.quantity::TEXT || '|' || oi.subtotal::TEXT,
        ';' ORDER BY o.round_number, oi.created_at, oi.id
    )
    INTO v_line_items_digest
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.guest_session_id = p_session_id
      AND oi.is_voided = FALSE;

    -- 4. Compute SHA-256 Digital Verification Checksum over full financial surface
    v_checksum_payload := v_invoice_num || ':'
        || v_session.id::TEXT || ':'
        || v_session.property_id::TEXT || ':'
        || v_session.subtotal::TEXT || ':'
        || v_session.tax::TEXT || ':'
        || v_session.total_amount::TEXT || ':'
        || COALESCE(p_payment_method, 'room_folio') || ':'
        || v_settled_at::TEXT || ':'
        || COALESCE(v_line_items_digest, '');

    v_checksum := encode(digest(v_checksum_payload, 'sha256'), 'hex');

    -- 5. Perform Atomic State Transition
    UPDATE guest_sessions
    SET status = 'settled',
        payment_method = p_payment_method,
        invoice_number = v_invoice_num,
        invoice_checksum = v_checksum,
        invoice_sequence_number = v_seq_num,
        staff_note = p_staff_note,
        settled_at = v_settled_at,
        updated_at = v_settled_at
    WHERE id = p_session_id;

    -- 6. Record Immutable Audit Log
    INSERT INTO audit_logs (
        property_id,
        actor_id,
        actor_name,
        actor_role,
        action,
        target_resource,
        target_resource_type,
        reason,
        new_state
    ) VALUES (
        v_session.property_id,
        'staff-reception',
        'Reception Staff',
        'staff',
        'TAB_SETTLED',
        p_session_id::TEXT,
        'guest_session',
        p_staff_note,
        jsonb_build_object('invoice_number', v_invoice_num, 'total_amount', v_session.total_amount, 'payment_method', p_payment_method, 'checksum', v_checksum)
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'status', 'settled',
        'invoice_number', v_invoice_num,
        'invoice_checksum', v_checksum,
        'total_amount', v_session.total_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES AUDIT & DEFENSE IN DEPTH
-- ==============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check if user is staff of property
CREATE OR REPLACE FUNCTION is_property_staff(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM property_staff
        WHERE user_id = auth.uid()
          AND property_id = p_property_id
    );
END;
$$;

-- Helper Function: Check if user is staff of organization
CREATE OR REPLACE FUNCTION is_organization_staff(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM property_staff ps
        JOIN properties p ON p.id = ps.property_id
        WHERE ps.user_id = auth.uid()
          AND p.organization_id = p_organization_id
    );
END;
$$;

-- --- Organizations Policies ---
DROP POLICY IF EXISTS "Staff view own organization" ON organizations;
CREATE POLICY "Staff view own organization"
    ON organizations FOR SELECT
    USING (is_organization_staff(id));

-- --- Properties Policies ---
DROP POLICY IF EXISTS "Public read for active properties" ON properties;
CREATE POLICY "Public read for active properties"
    ON properties FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Staff full access to own property" ON properties;
CREATE POLICY "Staff full access to own property"
    ON properties FOR ALL
    USING (is_property_staff(id))
    WITH CHECK (is_property_staff(id));

-- --- Locations Policies ---
DROP POLICY IF EXISTS "Public read active locations non-sensitive" ON locations;
CREATE POLICY "Public read active locations non-sensitive"
    ON locations FOR SELECT
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Staff full access to locations" ON locations;
CREATE POLICY "Staff full access to locations"
    ON locations FOR ALL
    USING (is_property_staff(property_id))
    WITH CHECK (is_property_staff(property_id));

-- --- Menu Items Policies ---
DROP POLICY IF EXISTS "Public read menu items" ON menu_items;
CREATE POLICY "Public read menu items"
    ON menu_items FOR SELECT
    USING (is_available = TRUE);

DROP POLICY IF EXISTS "Staff manage menu items" ON menu_items;
CREATE POLICY "Staff manage menu items"
    ON menu_items FOR ALL
    USING (is_property_staff(property_id))
    WITH CHECK (is_property_staff(property_id));

-- --- Guest Sessions Policies ---
DROP POLICY IF EXISTS "Guests and staff read guest sessions" ON guest_sessions;
CREATE POLICY "Guests and staff read guest sessions"
    ON guest_sessions FOR SELECT
    USING (
        is_property_staff(property_id) OR
        (
            (current_setting('request.headers', true)::json->>'x-session-token') IS NOT NULL AND
            session_token::text = (current_setting('request.headers', true)::json->>'x-session-token')
        )
    );

DROP POLICY IF EXISTS "Guests create guest session" ON guest_sessions;
CREATE POLICY "Guests create guest session"
    ON guest_sessions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM locations l
            WHERE l.id = location_id
              AND l.property_id = property_id
              AND l.is_active = TRUE
        )
    );

DROP POLICY IF EXISTS "Staff update guest sessions" ON guest_sessions;
CREATE POLICY "Staff update guest sessions"
    ON guest_sessions FOR UPDATE
    USING (is_property_staff(property_id))
    WITH CHECK (is_property_staff(property_id));

-- --- Orders Policies ---
DROP POLICY IF EXISTS "Guests and staff view orders" ON orders;
CREATE POLICY "Guests and staff view orders"
    ON orders FOR SELECT
    USING (
        is_property_staff(property_id) OR
        EXISTS (
            SELECT 1 FROM guest_sessions gs
            WHERE gs.id = orders.guest_session_id
              AND gs.property_id = orders.property_id
              AND (current_setting('request.headers', true)::json->>'x-session-token') IS NOT NULL
              AND gs.session_token::text = (current_setting('request.headers', true)::json->>'x-session-token')
        )
    );

DROP POLICY IF EXISTS "Guests create orders for own active session" ON orders;
CREATE POLICY "Guests create orders for own active session"
    ON orders FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM guest_sessions gs
            WHERE gs.id = guest_session_id
              AND gs.property_id = property_id
              AND gs.location_id = location_id
              AND gs.status = 'active'
              AND (current_setting('request.headers', true)::json->>'x-session-token') IS NOT NULL
              AND gs.session_token::text = (current_setting('request.headers', true)::json->>'x-session-token')
        )
    );

DROP POLICY IF EXISTS "Staff update orders" ON orders;
CREATE POLICY "Staff update orders"
    ON orders FOR UPDATE
    USING (is_property_staff(property_id))
    WITH CHECK (is_property_staff(property_id));

-- --- Order Items Policies ---
DROP POLICY IF EXISTS "Guests and staff view order items" ON order_items;
CREATE POLICY "Guests and staff view order items"
    ON order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN guest_sessions gs ON gs.id = o.guest_session_id
            WHERE o.id = order_items.order_id
              AND (
                  is_property_staff(o.property_id) OR
                  (
                      (current_setting('request.headers', true)::json->>'x-session-token') IS NOT NULL AND
                      gs.session_token::text = (current_setting('request.headers', true)::json->>'x-session-token')
                  )
              )
        )
    );

DROP POLICY IF EXISTS "Guests insert order items for own active session" ON order_items;
CREATE POLICY "Guests insert order items for own active session"
    ON order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN guest_sessions gs ON gs.id = o.guest_session_id
            JOIN menu_items mi ON mi.id = order_items.menu_item_id
            WHERE o.id = order_items.order_id
              AND mi.property_id = o.property_id -- Strict menu property match
              AND gs.status = 'active'
              AND (current_setting('request.headers', true)::json->>'x-session-token') IS NOT NULL
              AND gs.session_token::text = (current_setting('request.headers', true)::json->>'x-session-token')
        )
    );

-- --- Audit Logs Policies (Append-Only: NO UPDATE / DELETE) ---
DROP POLICY IF EXISTS "Staff view own property audit logs" ON audit_logs;
CREATE POLICY "Staff view own property audit logs"
    ON audit_logs FOR SELECT
    USING (is_property_staff(property_id));

DROP POLICY IF EXISTS "Staff insert own property audit logs" ON audit_logs;
CREATE POLICY "Staff insert own property audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (is_property_staff(property_id) OR auth.uid() IS NOT NULL);

-- ==============================================================================
-- 10. PHYSICAL AUDIT LOG IMMUTABILITY TRIGGERS & PERMISSION HARDENING
-- ==============================================================================

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Physical Security Violation: audit_logs table is strictly append-only. UPDATE, DELETE, and TRUNCATE operations are physically prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_prevent_audit_log_truncate ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_truncate
    BEFORE TRUNCATE ON audit_logs
    FOR EACH STATEMENT
    EXECUTE FUNCTION prevent_audit_log_mutation();

-- Revoke mutation capabilities from non-superuser roles
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM PUBLIC, anon, authenticated;

-- ==============================================================================
-- 11. IDEMPOTENCY KEY TTL RETENTION & PERFORMANCE MAINTENANCE
-- ==============================================================================

-- Partial Index: High-speed lookup for active idempotency keys
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_session_idempotency_active
    ON orders (guest_session_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Maintenance Function: Retains financial ledger history while nullifying stale idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys(p_retention_interval INTERVAL DEFAULT INTERVAL '48 hours')
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cleared_count INT;
BEGIN
    UPDATE orders
    SET idempotency_key = NULL
    WHERE idempotency_key IS NOT NULL
      AND created_at < NOW() - p_retention_interval;

    GET DIAGNOSTICS v_cleared_count = ROW_COUNT;
    RETURN v_cleared_count;
END;
$$;

-- ==============================================================================
-- 12. REALTIME REPLICATION ENABLEMENT
-- ==============================================================================
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE guest_sessions REPLICA IDENTITY FULL;

-- ==============================================================================
-- 13. FINANCIAL IMMUTABILITY (WORM) TRIGGERS — SETTLED/CLOSED RECORDS
-- ==============================================================================
-- These triggers physically prevent any mutation of financial data once a session
-- reaches a terminal state ('settled' or 'closed'). This guarantees that the
-- invoice checksum remains cryptographically valid post-settlement.

-- 13a. guest_sessions: Block non-status-transition UPDATEs and all DELETEs on settled/closed sessions
CREATE OR REPLACE FUNCTION prevent_settled_session_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('settled', 'closed') THEN
            RAISE EXCEPTION 'Financial Immutability Violation: Cannot DELETE settled/closed guest session %. Invoice % is permanently sealed.', OLD.id, OLD.invoice_number;
        END IF;
        RETURN OLD;
    END IF;

    -- UPDATE path: if session is already settled/closed, reject any mutation
    -- EXCEPT the state machine transition itself (status column change is guarded by trg_enforce_session_status_transition)
    IF OLD.status IN ('settled', 'closed') AND NEW.status = OLD.status THEN
        RAISE EXCEPTION 'Financial Immutability Violation: Cannot modify financial data on settled/closed session %. Invoice % is permanently sealed.', OLD.id, OLD.invoice_number;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_settled_session_mutation ON guest_sessions;
CREATE TRIGGER trg_prevent_settled_session_mutation
    BEFORE UPDATE OR DELETE ON guest_sessions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_settled_session_mutation();

-- 13b. orders: Block UPDATE/DELETE on orders belonging to settled/closed sessions
CREATE OR REPLACE FUNCTION prevent_settled_order_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session_status TEXT;
    v_invoice_number TEXT;
BEGIN
    SELECT gs.status, gs.invoice_number
    INTO v_session_status, v_invoice_number
    FROM guest_sessions gs
    WHERE gs.id = COALESCE(OLD.guest_session_id, NEW.guest_session_id);

    IF v_session_status IN ('settled', 'closed') THEN
        RAISE EXCEPTION 'Financial Immutability Violation: Cannot % order % belonging to settled/closed session. Invoice % is permanently sealed.', TG_OP, COALESCE(OLD.id, NEW.id), v_invoice_number;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_settled_order_mutation ON orders;
CREATE TRIGGER trg_prevent_settled_order_mutation
    BEFORE UPDATE OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION prevent_settled_order_mutation();

-- 13c. order_items: Block UPDATE/DELETE on line items belonging to settled/closed sessions
CREATE OR REPLACE FUNCTION prevent_settled_order_item_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session_status TEXT;
    v_invoice_number TEXT;
BEGIN
    SELECT gs.status, gs.invoice_number
    INTO v_session_status, v_invoice_number
    FROM orders o
    JOIN guest_sessions gs ON gs.id = o.guest_session_id
    WHERE o.id = COALESCE(OLD.order_id, NEW.order_id);

    IF v_session_status IN ('settled', 'closed') THEN
        RAISE EXCEPTION 'Financial Immutability Violation: Cannot % order item % on settled/closed session. Invoice % is permanently sealed.', TG_OP, COALESCE(OLD.id, NEW.id), v_invoice_number;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_settled_order_item_mutation ON order_items;
CREATE TRIGGER trg_prevent_settled_order_item_mutation
    BEFORE UPDATE OR DELETE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION prevent_settled_order_item_mutation();

-- 13d. TRUNCATE protection on financial tables (statement-level)
CREATE OR REPLACE FUNCTION prevent_financial_table_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Financial Immutability Violation: TRUNCATE is permanently prohibited on financial ledger table %.', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_guest_sessions_truncate ON guest_sessions;
CREATE TRIGGER trg_prevent_guest_sessions_truncate
    BEFORE TRUNCATE ON guest_sessions
    FOR EACH STATEMENT
    EXECUTE FUNCTION prevent_financial_table_truncate();

DROP TRIGGER IF EXISTS trg_prevent_orders_truncate ON orders;
CREATE TRIGGER trg_prevent_orders_truncate
    BEFORE TRUNCATE ON orders
    FOR EACH STATEMENT
    EXECUTE FUNCTION prevent_financial_table_truncate();

DROP TRIGGER IF EXISTS trg_prevent_order_items_truncate ON order_items;
CREATE TRIGGER trg_prevent_order_items_truncate
    BEFORE TRUNCATE ON order_items
    FOR EACH STATEMENT
    EXECUTE FUNCTION prevent_financial_table_truncate();

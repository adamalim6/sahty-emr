--
-- PostgreSQL database dump
--

-- baseline generated from tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895 (2026-04-13)

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: sahty
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO sahty;

--
-- Name: auth_sync; Type: SCHEMA; Schema: -; Owner: sahty
--

CREATE SCHEMA auth_sync;


ALTER SCHEMA auth_sync OWNER TO sahty;

--
-- Name: identity_sync; Type: SCHEMA; Schema: -; Owner: sahty
--

CREATE SCHEMA identity_sync;


ALTER SCHEMA identity_sync OWNER TO sahty;

--
-- Name: reference; Type: SCHEMA; Schema: -; Owner: sahty
--

CREATE SCHEMA reference;


ALTER SCHEMA reference OWNER TO sahty;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: bed_status; Type: TYPE; Schema: public; Owner: sahty
--

CREATE TYPE public.bed_status AS ENUM (
    'AVAILABLE',
    'OCCUPIED',
    'MAINTENANCE'
);


ALTER TYPE public.bed_status OWNER TO sahty;

--
-- Name: emit_outbox_event(); Type: FUNCTION; Schema: auth_sync; Owner: sahty
--

CREATE FUNCTION auth_sync.emit_outbox_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_entity_type TEXT;
    v_entity_id   TEXT;
    v_operation   TEXT;
    v_payload     JSONB;
BEGIN
    -- Skip if we are applying incoming sync events (prevent echo loops)
    IF current_setting('auth_sync.applying', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Determine entity type from table name
    v_entity_type := TG_TABLE_NAME;

    -- Build event based on operation
    IF TG_OP = 'DELETE' THEN
        v_operation := 'DELETE';
        v_payload   := to_jsonb(OLD);

        -- Entity-specific PK extraction
        CASE TG_TABLE_NAME
            WHEN 'users' THEN
                v_entity_id := OLD.user_id::text;
            WHEN 'credentials' THEN
                v_entity_id := OLD.credential_id::text;
            WHEN 'user_tenants' THEN
                -- Composite PK: encode as "user_id::tenant_id"
                v_entity_id := OLD.user_id::text || '::' || OLD.tenant_id::text;
        END CASE;
    ELSE
        -- INSERT or UPDATE
        v_operation := 'UPSERT';
        v_payload   := to_jsonb(NEW);

        CASE TG_TABLE_NAME
            WHEN 'users' THEN
                v_entity_id := NEW.user_id::text;
            WHEN 'credentials' THEN
                v_entity_id := NEW.credential_id::text;
            WHEN 'user_tenants' THEN
                v_entity_id := NEW.user_id::text || '::' || NEW.tenant_id::text;
        END CASE;
    END IF;

    -- Emit to outbox (same transaction = atomic)
    INSERT INTO auth_sync.outbox_events (entity_type, entity_id, operation, payload)
    VALUES (v_entity_type, v_entity_id, v_operation, v_payload);

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION auth_sync.emit_outbox_event() OWNER TO sahty;

--
-- Name: fn_audit_no_update(); Type: FUNCTION; Schema: public; Owner: sahty
--

CREATE FUNCTION public.fn_audit_no_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries cannot be updated or deleted';
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.fn_audit_no_update() OWNER TO sahty;

--
-- Name: fn_generic_audit(); Type: FUNCTION; Schema: public; Owner: sahty
--

CREATE FUNCTION public.fn_generic_audit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_record_id UUID;
    v_user_id UUID;
BEGIN
    -- 1. Extract Record ID (Handle logic for different PKs)
    IF (TG_OP = 'DELETE') THEN
        IF (TG_TABLE_NAME = 'patients_tenant') THEN
            v_record_id := OLD.tenant_patient_id;
        ELSIF (TG_TABLE_NAME = 'identity_ids') THEN
            v_record_id := OLD.identity_id;
        ELSIF (TG_TABLE_NAME = 'patient_relationship_links') THEN
            v_record_id := OLD.relationship_id;
        ELSIF (TG_TABLE_NAME = 'patient_coverages') THEN
            v_record_id := OLD.patient_coverage_id;
        ELSIF (TG_TABLE_NAME = 'coverages') THEN
            v_record_id := OLD.coverage_id;
        ELSE
            -- Default to 'id' if possible
            BEGIN
                v_record_id := OLD.id;
            EXCEPTION WHEN OTHERS THEN
                v_record_id := NULL; -- Or raise warning
            END;
        END IF;
        v_old_data := to_jsonb(OLD);
    ELSE
        IF (TG_TABLE_NAME = 'patients_tenant') THEN
            v_record_id := NEW.tenant_patient_id;
        ELSIF (TG_TABLE_NAME = 'identity_ids') THEN
            v_record_id := NEW.identity_id;
        ELSIF (TG_TABLE_NAME = 'patient_relationship_links') THEN
            v_record_id := NEW.relationship_id;
        ELSIF (TG_TABLE_NAME = 'patient_coverages') THEN
            v_record_id := NEW.patient_coverage_id;
        ELSIF (TG_TABLE_NAME = 'coverages') THEN
            v_record_id := NEW.coverage_id;
        ELSE
            BEGIN
                v_record_id := NEW.id;
            EXCEPTION WHEN OTHERS THEN
                 v_record_id := NULL;
            END;
        END IF;
        v_new_data := to_jsonb(NEW);
        
        IF (TG_OP = 'UPDATE') THEN
            v_old_data := to_jsonb(OLD);
        END IF;
    END IF;

    -- 2. Extract User ID from session (if available)
    BEGIN
        v_user_id := current_setting('sahty.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- 3. Insert Audit Log (Targeting public.audit_log)
    INSERT INTO public.audit_log (
        tenant_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by,
        changed_at,
        operation_txid
    ) VALUES (
        CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END,
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        v_old_data,
        v_new_data,
        v_user_id,
        NOW(),
        txid_current()
    );

    RETURN NULL; -- trigger is AFTER, return is ignored
END;
$$;


ALTER FUNCTION public.fn_generic_audit() OWNER TO sahty;

--
-- Name: fn_prevent_system_location_deactivate(); Type: FUNCTION; Schema: public; Owner: sahty
--

CREATE FUNCTION public.fn_prevent_system_location_deactivate() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.scope = 'SYSTEM' AND NEW.status = 'INACTIVE' THEN
        RAISE EXCEPTION 'Cannot deactivate system location %', OLD.name;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_prevent_system_location_deactivate() OWNER TO sahty;

--
-- Name: recompute_blood_bag_status(uuid); Type: FUNCTION; Schema: public; Owner: sahty
--

CREATE FUNCTION public.recompute_blood_bag_status(p_bag_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    start_exists BOOLEAN;
    end_exists BOOLEAN;
BEGIN

IF (SELECT status FROM public.transfusion_blood_bags WHERE id = p_bag_id) = 'DISCARDED' THEN
    RETURN;
END IF;

SELECT EXISTS (
    SELECT 1
    FROM public.administration_events ae
    JOIN public.administration_event_blood_bags aebb
        ON ae.id = aebb.administration_event_id
    WHERE aebb.blood_bag_id = p_bag_id
    AND ae.status = 'ACTIVE'
    AND ae.action_type = 'started'
) INTO start_exists;

SELECT EXISTS (
    SELECT 1
    FROM public.administration_events ae
    JOIN public.administration_event_blood_bags aebb
        ON ae.id = aebb.administration_event_id
    WHERE aebb.blood_bag_id = p_bag_id
    AND ae.status = 'ACTIVE'
    AND ae.action_type = 'ended'
) INTO end_exists;

IF start_exists = FALSE THEN
    UPDATE public.transfusion_blood_bags
    SET status = 'RECEIVED',
        assigned_prescription_event_id = NULL
    WHERE id = p_bag_id;

ELSIF start_exists = TRUE AND end_exists = FALSE THEN
    UPDATE public.transfusion_blood_bags
    SET status = 'IN_USE'
    WHERE id = p_bag_id;

ELSIF start_exists = TRUE AND end_exists = TRUE THEN
    UPDATE public.transfusion_blood_bags
    SET status = 'USED'
    WHERE id = p_bag_id;

END IF;

END;
$$;


ALTER FUNCTION public.recompute_blood_bag_status(p_bag_id uuid) OWNER TO sahty;

--
-- Name: trigger_recompute_bag_status(); Type: FUNCTION; Schema: public; Owner: sahty
--

CREATE FUNCTION public.trigger_recompute_bag_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    bag_id UUID;
    v_event_id UUID;
BEGIN

-- Determine the event_id depending on operation
IF TG_OP = 'DELETE' THEN
    v_event_id := OLD.id;
ELSE
    v_event_id := NEW.id;
END IF;

FOR bag_id IN
    SELECT blood_bag_id
    FROM public.administration_event_blood_bags
    WHERE administration_event_id = v_event_id
LOOP
    PERFORM public.recompute_blood_bag_status(bag_id);
END LOOP;

IF TG_OP = 'DELETE' THEN
    RETURN OLD;
ELSE
    RETURN NEW;
END IF;

END;
$$;


ALTER FUNCTION public.trigger_recompute_bag_status() OWNER TO sahty;

--
-- Name: trigger_recompute_bag_status_assoc(); Type: FUNCTION; Schema: public; Owner: sahty
--

CREATE FUNCTION public.trigger_recompute_bag_status_assoc() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.recompute_blood_bag_status(OLD.blood_bag_id);
        RETURN OLD;
    ELSE
        PERFORM public.recompute_blood_bag_status(NEW.blood_bag_id);
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION public.trigger_recompute_bag_status_assoc() OWNER TO sahty;

--
-- Name: update_surveillance_hour_bucket(); Type: FUNCTION; Schema: public; Owner: sahty
--

CREATE FUNCTION public.update_surveillance_hour_bucket() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    event_value JSONB;
BEGIN

    IF NEW.value_numeric IS NULL AND NEW.value_text IS NULL AND NEW.value_boolean IS NULL THEN
        -- Handle Deletion: Remove key from the JSON object
        INSERT INTO surveillance_hour_buckets (
            id, tenant_id, tenant_patient_id, bucket_start, values
        ) VALUES (
            gen_random_uuid(), NEW.tenant_id, NEW.tenant_patient_id, NEW.bucket_start, '{}'::jsonb
        )
        ON CONFLICT (tenant_id, tenant_patient_id, bucket_start)
        DO UPDATE SET values = surveillance_hour_buckets.values - NEW.parameter_code;
    ELSE
        -- Handle Insertion
        IF NEW.value_numeric IS NOT NULL THEN event_value := to_jsonb(NEW.value_numeric);
        ELSIF NEW.value_text IS NOT NULL THEN event_value := to_jsonb(NEW.value_text);
        ELSE event_value := to_jsonb(NEW.value_boolean);
        END IF;

        INSERT INTO surveillance_hour_buckets (
            id, tenant_id, tenant_patient_id, bucket_start, values
        ) VALUES (
            gen_random_uuid(), NEW.tenant_id, NEW.tenant_patient_id, NEW.bucket_start, jsonb_build_object(NEW.parameter_code, event_value)
        )
        ON CONFLICT (tenant_id, tenant_patient_id, bucket_start)
        DO UPDATE SET values = surveillance_hour_buckets.values || jsonb_build_object(NEW.parameter_code, event_value);
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_surveillance_hour_bucket() OWNER TO sahty;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: sahty
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO sahty;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: auth; Owner: sahty
--

CREATE TABLE auth.audit_log (
    audit_id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid,
    action text NOT NULL,
    target_user_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE auth.audit_log OWNER TO sahty;

--
-- Name: credentials; Type: TABLE; Schema: auth; Owner: sahty
--

CREATE TABLE auth.credentials (
    credential_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    password_hash text NOT NULL,
    password_algo text DEFAULT 'bcrypt'::text NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE auth.credentials OWNER TO sahty;

--
-- Name: user_tenants; Type: TABLE; Schema: auth; Owner: sahty
--

CREATE TABLE auth.user_tenants (
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE auth.user_tenants OWNER TO sahty;

--
-- Name: users; Type: TABLE; Schema: auth; Owner: sahty
--

CREATE TABLE auth.users (
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    display_name text NOT NULL,
    inpe text,
    is_active boolean DEFAULT true NOT NULL,
    master_patient_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE auth.users OWNER TO sahty;

--
-- Name: inbox_events; Type: TABLE; Schema: auth_sync; Owner: sahty
--

CREATE TABLE auth_sync.inbox_events (
    event_id uuid NOT NULL,
    source_tenant_id uuid,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    operation text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_at timestamp with time zone
);


ALTER TABLE auth_sync.inbox_events OWNER TO sahty;

--
-- Name: outbox_events; Type: TABLE; Schema: auth_sync; Owner: sahty
--

CREATE TABLE auth_sync.outbox_events (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    operation text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


ALTER TABLE auth_sync.outbox_events OWNER TO sahty;

--
-- Name: sync_state; Type: TABLE; Schema: auth_sync; Owner: sahty
--

CREATE TABLE auth_sync.sync_state (
    id integer DEFAULT 1 NOT NULL,
    last_group_outbox_seq bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sync_state_id_check CHECK ((id = 1))
);


ALTER TABLE auth_sync.sync_state OWNER TO sahty;

--
-- Name: inbox_events; Type: TABLE; Schema: identity_sync; Owner: sahty
--

CREATE TABLE identity_sync.inbox_events (
    inbox_event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_at timestamp with time zone,
    status text DEFAULT 'RECEIVED'::text NOT NULL,
    dedupe_key text NOT NULL
);


ALTER TABLE identity_sync.inbox_events OWNER TO sahty;

--
-- Name: outbox_events; Type: TABLE; Schema: identity_sync; Owner: sahty
--

CREATE TABLE identity_sync.outbox_events (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    event_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone,
    last_error text,
    dedupe_key text NOT NULL
);


ALTER TABLE identity_sync.outbox_events OWNER TO sahty;

--
-- Name: _migration_issues; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public._migration_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_table text NOT NULL,
    source_id text,
    issue_type text NOT NULL,
    issue_description text,
    row_data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public._migration_issues OWNER TO sahty;

--
-- Name: actes; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.actes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    designation text NOT NULL,
    category text,
    price numeric,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.actes OWNER TO sahty;

--
-- Name: administration_event_blood_bags; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.administration_event_blood_bags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    administration_event_id uuid NOT NULL,
    blood_bag_id uuid NOT NULL,
    qty_bags numeric DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    volume_administered_ml numeric
);


ALTER TABLE public.administration_event_blood_bags OWNER TO sahty;

--
-- Name: administration_event_lab_collections; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.administration_event_lab_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    administration_event_id uuid NOT NULL,
    lab_collection_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.administration_event_lab_collections OWNER TO sahty;

--
-- Name: administration_event_pauses; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.administration_event_pauses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    administration_event_id uuid NOT NULL,
    paused_at timestamp with time zone NOT NULL,
    resumed_at timestamp with time zone,
    paused_by_user_id uuid,
    resumed_by_user_id uuid,
    pause_reason text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.administration_event_pauses OWNER TO sahty;

--
-- Name: administration_events; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.administration_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    prescription_event_id uuid NOT NULL,
    action_type text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actual_start_at timestamp with time zone,
    actual_end_at timestamp with time zone,
    performed_by_user_id uuid NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    cancellation_reason text,
    linked_event_id uuid,
    performed_by_first_name character varying,
    performed_by_last_name character varying,
    volume_administered_ml numeric(10,2),
    tenant_patient_id uuid,
    CONSTRAINT chk_administration_event_status CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'CANCELLED'::text])))
);


ALTER TABLE public.administration_events OWNER TO sahty;

--
-- Name: admission_acts; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.admission_acts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admission_id uuid NOT NULL,
    global_act_id uuid NOT NULL,
    lab_request_id uuid,
    quantity numeric DEFAULT 1 NOT NULL,
    entered_in_error_at timestamp without time zone,
    entered_in_error_by uuid,
    entered_in_error_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admission_acts OWNER TO sahty;

--
-- Name: admission_coverage_change_history; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.admission_coverage_change_history (
    change_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    admission_coverage_id uuid,
    admission_coverage_member_id uuid,
    change_type_code text NOT NULL,
    field_name text,
    old_value text,
    new_value text,
    change_source text NOT NULL,
    changed_by_user_id uuid,
    change_reason text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admission_coverage_change_history_check CHECK (((admission_coverage_id IS NOT NULL) OR (admission_coverage_member_id IS NOT NULL)))
);


ALTER TABLE public.admission_coverage_change_history OWNER TO sahty;

--
-- Name: admission_coverage_members; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.admission_coverage_members (
    admission_coverage_member_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_coverage_id uuid NOT NULL,
    tenant_patient_id uuid,
    member_first_name text,
    member_last_name text,
    relationship_to_subscriber_code text,
    member_identity_type text,
    member_identity_value text,
    member_issuing_country text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admission_coverage_members OWNER TO sahty;

--
-- Name: admission_coverages; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.admission_coverages (
    admission_coverage_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    coverage_id uuid NOT NULL,
    filing_order integer NOT NULL,
    organisme_id uuid NOT NULL,
    policy_number text,
    group_number text,
    plan_name text,
    coverage_type_code text,
    subscriber_first_name text,
    subscriber_last_name text,
    subscriber_identity_type text,
    subscriber_identity_value text,
    subscriber_issuing_country text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admission_coverages OWNER TO sahty;

--
-- Name: admission_number_seq; Type: SEQUENCE; Schema: public; Owner: sahty
--

CREATE SEQUENCE public.admission_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admission_number_seq OWNER TO sahty;

--
-- Name: admissions; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.admissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid,
    admission_number text,
    reason text,
    attending_physician_user_id uuid,
    admitting_service_id uuid,
    responsible_service_id uuid,
    current_service_id uuid,
    admission_type text,
    arrival_mode text,
    provenance text,
    admission_date timestamp with time zone NOT NULL,
    discharge_date timestamp with time zone,
    status text,
    currency text DEFAULT 'MAD'::text,
    created_at timestamp with time zone DEFAULT now(),
    auto_close_at timestamp with time zone
);


ALTER TABLE public.admissions OWNER TO sahty;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_id uuid,
    service_id uuid,
    date_time timestamp with time zone NOT NULL,
    reason text,
    doctor_name text,
    status text,
    created_at timestamp with time zone DEFAULT now(),
    tenant_patient_id uuid
);


ALTER TABLE public.appointments OWNER TO sahty;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.audit_log (
    audit_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid,
    operation_txid bigint
);


ALTER TABLE public.audit_log OWNER TO sahty;

--
-- Name: beds; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.beds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    label text NOT NULL,
    status public.bed_status DEFAULT 'AVAILABLE'::public.bed_status NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.beds OWNER TO sahty;

--
-- Name: clinical_exams; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.clinical_exams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    recorded_by_first_name text,
    recorded_by_last_name text,
    last_amended_at timestamp with time zone,
    last_amended_by uuid,
    last_amended_by_first_name text,
    last_amended_by_last_name text,
    status text DEFAULT 'active'::text NOT NULL,
    entered_in_error_at timestamp with time zone,
    entered_in_error_by uuid,
    entered_in_error_by_first_name text,
    entered_in_error_by_last_name text,
    entered_in_error_reason text,
    CONSTRAINT chk_clinical_exams_status CHECK ((status = ANY (ARRAY['active'::text, 'entered_in_error'::text])))
);


ALTER TABLE public.clinical_exams OWNER TO sahty;

--
-- Name: coverage_change_history; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.coverage_change_history (
    change_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    coverage_id uuid NOT NULL,
    coverage_member_id uuid,
    change_type_code text NOT NULL,
    field_name text,
    old_value text,
    new_value text,
    change_source text NOT NULL,
    changed_by_user_id uuid,
    change_reason text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.coverage_change_history OWNER TO sahty;

--
-- Name: coverage_members; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.coverage_members (
    coverage_member_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    coverage_id uuid NOT NULL,
    tenant_patient_id uuid,
    relationship_to_subscriber_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    member_first_name text,
    member_last_name text,
    member_identity_type text,
    member_identity_value text,
    member_issuing_country text
);


ALTER TABLE public.coverage_members OWNER TO sahty;

--
-- Name: coverages; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.coverages (
    coverage_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organisme_id uuid NOT NULL,
    policy_number text NOT NULL,
    group_number text,
    plan_name text,
    coverage_type_code text,
    effective_from date,
    effective_to date,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    subscriber_first_name text,
    subscriber_last_name text,
    subscriber_identity_type text,
    subscriber_identity_value text,
    subscriber_issuing_country text
);


ALTER TABLE public.coverages OWNER TO sahty;

--
-- Name: current_stock; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.current_stock (
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    lot text NOT NULL,
    expiry date NOT NULL,
    location_id uuid NOT NULL,
    qty_units integer NOT NULL,
    reserved_units integer DEFAULT 0 NOT NULL,
    pending_return_units integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.current_stock OWNER TO sahty;

--
-- Name: delivery_note_items; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.delivery_note_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    delivery_note_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty_pending integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.delivery_note_items OWNER TO sahty;

--
-- Name: delivery_note_layers; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.delivery_note_layers (
    delivery_note_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    lot text NOT NULL,
    expiry date NOT NULL,
    qty_received integer NOT NULL,
    qty_remaining integer NOT NULL,
    purchase_unit_cost numeric
);


ALTER TABLE public.delivery_note_layers OWNER TO sahty;

--
-- Name: delivery_notes; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.delivery_notes (
    delivery_note_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    supplier_id text NOT NULL,
    po_id uuid,
    received_at timestamp with time zone NOT NULL,
    status text DEFAULT 'PENDING'::text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    reference text,
    created_by_first_name text,
    created_by_last_name text
);


ALTER TABLE public.delivery_notes OWNER TO sahty;

--
-- Name: escarre_snapshots; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.escarre_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    escarre_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid,
    stage integer NOT NULL,
    length_mm numeric,
    width_mm numeric,
    depth_mm numeric,
    tissue_type text,
    exudate_amount text,
    odor text,
    pain_scale integer,
    infection_signs boolean,
    dressing text,
    notes text,
    photo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT escarre_snapshots_exudate_amount_check CHECK ((exudate_amount = ANY (ARRAY['none'::text, 'low'::text, 'moderate'::text, 'heavy'::text]))),
    CONSTRAINT escarre_snapshots_odor_check CHECK ((odor = ANY (ARRAY['none'::text, 'mild'::text, 'strong'::text]))),
    CONSTRAINT escarre_snapshots_pain_scale_check CHECK (((pain_scale >= 0) AND (pain_scale <= 10))),
    CONSTRAINT escarre_snapshots_stage_check CHECK ((stage = ANY (ARRAY[1, 2, 3, 4])))
);


ALTER TABLE public.escarre_snapshots OWNER TO sahty;

--
-- Name: escarres; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.escarres (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    pos_x double precision NOT NULL,
    pos_y double precision NOT NULL,
    pos_z double precision NOT NULL,
    body_side text,
    body_region text
);


ALTER TABLE public.escarres OWNER TO sahty;

--
-- Name: external_systems; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.external_systems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.external_systems OWNER TO sahty;

--
-- Name: global_act_external_codes; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.global_act_external_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    global_act_id uuid NOT NULL,
    external_system_id uuid NOT NULL,
    external_code text NOT NULL,
    is_active boolean DEFAULT true,
    valid_from timestamp without time zone,
    valid_to timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.global_act_external_codes OWNER TO sahty;

--
-- Name: identity_ids; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.identity_ids (
    identity_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    identity_type_code text NOT NULL,
    identity_value text NOT NULL,
    issuing_country_code text,
    is_primary boolean DEFAULT false NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.identity_ids OWNER TO sahty;

--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.inventory_movements (
    movement_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    lot text NOT NULL,
    expiry date NOT NULL,
    qty_units integer NOT NULL,
    from_location_id uuid,
    to_location_id uuid,
    document_type text NOT NULL,
    document_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.inventory_movements OWNER TO sahty;

--
-- Name: lab_analyte_external_codes; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.lab_analyte_external_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    analyte_id uuid NOT NULL,
    external_system_id uuid NOT NULL,
    external_code text NOT NULL,
    external_label text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lab_analyte_external_codes OWNER TO sahty;

--
-- Name: lab_collection_specimens; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.lab_collection_specimens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lab_collection_id uuid NOT NULL,
    specimen_id uuid NOT NULL
);


ALTER TABLE public.lab_collection_specimens OWNER TO sahty;

--
-- Name: lab_collections; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.lab_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_patient_id uuid NOT NULL,
    admission_id uuid,
    collected_by_user_id uuid NOT NULL,
    collected_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lab_collections OWNER TO sahty;

--
-- Name: lab_hprim_links; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.lab_hprim_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hprim_message_id uuid NOT NULL,
    lab_request_id uuid NOT NULL,
    lab_specimen_id uuid,
    hprim_order_id text NOT NULL,
    hprim_sample_id text,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lab_hprim_links OWNER TO sahty;

--
-- Name: lab_hprim_messages; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.lab_hprim_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    direction text NOT NULL,
    message_type text NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    ok_file_name text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    payload_text text,
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    max_retries integer DEFAULT 3 NOT NULL,
    next_retry_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    CONSTRAINT lab_hprim_messages_direction_check CHECK ((direction = ANY (ARRAY['OUTBOUND'::text, 'INBOUND'::text]))),
    CONSTRAINT lab_hprim_messages_message_type_check CHECK ((message_type = ANY (ARRAY['ORM'::text, 'ORU'::text]))),
    CONSTRAINT lab_hprim_messages_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'WRITTEN'::text, 'PROCESSED'::text, 'ERROR'::text])))
);


ALTER TABLE public.lab_hprim_messages OWNER TO sahty;

--
-- Name: lab_requests; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.lab_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_patient_id uuid NOT NULL,
    admission_id uuid NOT NULL,
    global_act_id uuid NOT NULL,
    prescription_event_id uuid,
    created_by_user_id uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lab_requests OWNER TO sahty;

--
-- Name: lab_specimen_requests; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.lab_specimen_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    specimen_id uuid NOT NULL,
    lab_request_id uuid NOT NULL
);


ALTER TABLE public.lab_specimen_requests OWNER TO sahty;

--
-- Name: lab_specimen_status_history; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.lab_specimen_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    specimen_id uuid NOT NULL,
    old_status text,
    new_status text NOT NULL,
    changed_at timestamp without time zone DEFAULT now() NOT NULL,
    changed_by_user_id uuid,
    reason text
);


ALTER TABLE public.lab_specimen_status_history OWNER TO sahty;

--
-- Name: lab_specimens; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.lab_specimens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lab_act_specimen_container_id uuid NOT NULL,
    barcode text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    status text DEFAULT 'COLLECTED'::text NOT NULL,
    rejected_reason text,
    received_at timestamp without time zone,
    received_by_user_id uuid,
    rejected_at timestamp without time zone,
    rejected_by_user_id uuid,
    last_status_changed_at timestamp without time zone,
    last_status_changed_by_user_id uuid,
    CONSTRAINT lab_specimens_status_check CHECK ((status = ANY (ARRAY['COLLECTED'::text, 'RECEIVED'::text, 'REJECTED'::text, 'INSUFFICIENT'::text])))
);


ALTER TABLE public.lab_specimens OWNER TO sahty;

--
-- Name: lab_unit_external_codes; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.lab_unit_external_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unit_id uuid NOT NULL,
    external_system_id uuid NOT NULL,
    external_code text NOT NULL,
    external_label text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lab_unit_external_codes OWNER TO sahty;

--
-- Name: lab_value_normalization; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.lab_value_normalization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    raw_value text NOT NULL,
    canonical_value_id uuid NOT NULL,
    analyzer_id uuid,
    analyte_id uuid,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lab_value_normalization OWNER TO sahty;

--
-- Name: locations; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.locations (
    location_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    type text,
    scope text,
    service_id uuid,
    status text DEFAULT 'ACTIVE'::text,
    created_at timestamp with time zone DEFAULT now(),
    location_class text DEFAULT 'COMMERCIAL'::text,
    valuation_policy text DEFAULT 'VALUABLE'::text NOT NULL
);


ALTER TABLE public.locations OWNER TO sahty;

--
-- Name: medication_dispense_events; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.medication_dispense_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    prescription_id uuid,
    admission_id uuid,
    product_id uuid NOT NULL,
    lot text,
    expiry date,
    qty_dispensed integer NOT NULL,
    dispensed_by text,
    dispensed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.medication_dispense_events OWNER TO sahty;

--
-- Name: patient_addiction_history; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_addiction_history (
    id uuid NOT NULL,
    addiction_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    field_name text NOT NULL,
    old_value_text text,
    new_value_text text,
    old_value_number numeric,
    new_value_number numeric,
    changed_by uuid NOT NULL,
    changed_at timestamp with time zone NOT NULL,
    changed_by_first_name text,
    changed_by_last_name text
);


ALTER TABLE public.patient_addiction_history OWNER TO sahty;

--
-- Name: patient_addictions; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_addictions (
    id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    addiction_type text NOT NULL,
    substance_label text,
    qty numeric,
    unit text,
    frequency text,
    status text NOT NULL,
    stop_motivation_score numeric,
    start_date date,
    last_use_date date,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.patient_addictions OWNER TO sahty;

--
-- Name: patient_addresses; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_addresses (
    address_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_patient_id uuid NOT NULL,
    address_line text,
    city text,
    country_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    address_line2 text,
    postal_code text,
    region text,
    country_code text,
    is_primary boolean DEFAULT false NOT NULL
);


ALTER TABLE public.patient_addresses OWNER TO sahty;

--
-- Name: patient_allergies; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_allergies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    allergen_dci_id uuid NOT NULL,
    allergen_name_snapshot text NOT NULL,
    allergy_type text NOT NULL,
    severity text NOT NULL,
    reaction_description text,
    declared_at date,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    created_by_first_name text,
    created_by_last_name text,
    CONSTRAINT chk_patient_allergies_status CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'RESOLVED'::text, 'ENTERED_IN_ERROR'::text])))
);


ALTER TABLE public.patient_allergies OWNER TO sahty;

--
-- Name: patient_allergy_history; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_allergy_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    patient_allergy_id uuid NOT NULL,
    event_type text NOT NULL,
    changed_field text,
    old_value text,
    new_value text,
    change_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    created_by_first_name text,
    created_by_last_name text,
    CONSTRAINT chk_patient_allergy_history_event_type CHECK ((event_type = ANY (ARRAY['CREATED'::text, 'DETAILS_UPDATED'::text, 'STATUS_CHANGED'::text])))
);


ALTER TABLE public.patient_allergy_history OWNER TO sahty;

--
-- Name: patient_allergy_manifestations; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_allergy_manifestations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    patient_allergy_id uuid NOT NULL,
    manifestation_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT chk_patient_allergy_manifestations_code CHECK ((manifestation_code = ANY (ARRAY['CUTANEE'::text, 'RESPIRATOIRE'::text, 'DIGESTIVE'::text, 'CARDIOVASCULAIRE'::text, 'NEUROLOGIQUE'::text])))
);


ALTER TABLE public.patient_allergy_manifestations OWNER TO sahty;

--
-- Name: patient_contacts; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_contacts (
    contact_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_patient_id uuid NOT NULL,
    phone text,
    email text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.patient_contacts OWNER TO sahty;

--
-- Name: patient_diagnoses; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_diagnoses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    clinician_user_id uuid,
    entered_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    voided_at timestamp with time zone,
    void_reason text,
    icd_linearization text DEFAULT 'mms'::text NOT NULL,
    icd_language text DEFAULT 'fr'::text NOT NULL,
    icd_code text,
    icd_title text,
    icd_selected_text text NOT NULL,
    icd_foundation_uri text NOT NULL,
    icd_linearization_uri text,
    icd_minor_version text,
    source_query text,
    ect_instance_no text,
    resolved_by_user_id uuid,
    resolution_note text,
    voided_by_user_id uuid,
    CONSTRAINT patient_diagnoses_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'RESOLVED'::text, 'VOIDED'::text])))
);


ALTER TABLE public.patient_diagnoses OWNER TO sahty;

--
-- Name: patient_documents; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    document_type text NOT NULL,
    original_filename text,
    stored_filename text,
    storage_path text,
    mime_type text,
    file_extension text,
    file_size_bytes bigint,
    checksum text,
    source_system text,
    extracted_text text,
    ai_processed boolean DEFAULT false NOT NULL,
    uploaded_by_user_id uuid,
    uploaded_at timestamp with time zone,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    original_mime_type text,
    CONSTRAINT chk_document_type CHECK ((document_type = ANY (ARRAY['LAB_REPORT'::text, 'RADIOLOGY'::text, 'GENERAL'::text, 'PRESCRIPTION'::text, 'OTHER'::text])))
);


ALTER TABLE public.patient_documents OWNER TO sahty;

--
-- Name: patient_ecg_records; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_ecg_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    linked_admission_id uuid,
    exam_date date NOT NULL,
    exam_time time without time zone NOT NULL,
    exam_type text DEFAULT 'Repos'::text NOT NULL,
    "position" text DEFAULT 'Decubitus'::text NOT NULL,
    speed_mm_s smallint DEFAULT 25 NOT NULL,
    quality text DEFAULT 'Bonne'::text NOT NULL,
    rhythm text DEFAULT 'Sinusal'::text NOT NULL,
    regularity text DEFAULT 'Regulier'::text NOT NULL,
    p_wave text DEFAULT 'Presentes'::text NOT NULL,
    rhythm_disorders text[] DEFAULT '{Aucun}'::text[] NOT NULL,
    conduction_disorders text[] DEFAULT '{Aucun}'::text[] NOT NULL,
    repolarization text DEFAULT 'Normal'::text NOT NULL,
    repolarization_details text[] DEFAULT '{}'::text[] NOT NULL,
    ischemia text DEFAULT 'Aucune'::text NOT NULL,
    ischemia_type text,
    ischemia_locations text[] DEFAULT '{}'::text[] NOT NULL,
    fc_bpm smallint,
    pr_ms smallint,
    qrs_ms smallint,
    qt_ms smallint,
    qtc_ms smallint,
    axis_p_deg smallint,
    axis_qrs_deg smallint,
    axis_t_deg smallint,
    other_anomalies text,
    conclusion_observation_id uuid,
    doctor text,
    has_attachment boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    entered_in_error_by uuid,
    entered_in_error_at timestamp with time zone,
    entered_in_error_reason text,
    created_by_first_name text,
    created_by_last_name text,
    CONSTRAINT patient_ecg_records_exam_type_check CHECK ((exam_type = ANY (ARRAY['Repos'::text, 'Controle'::text, 'Effort'::text]))),
    CONSTRAINT patient_ecg_records_ischemia_check CHECK ((ischemia = ANY (ARRAY['Aucune'::text, 'Presente'::text]))),
    CONSTRAINT patient_ecg_records_ischemia_type_check CHECK (((ischemia_type IS NULL) OR (ischemia_type = ANY (ARRAY['Ischémie'::text, 'SCA ST+'::text, 'SCA ST-'::text, 'Infarctus ancien'::text])))),
    CONSTRAINT patient_ecg_records_p_wave_check CHECK ((p_wave = ANY (ARRAY['Presentes'::text, 'Absentes'::text]))),
    CONSTRAINT patient_ecg_records_position_check CHECK (("position" = ANY (ARRAY['Decubitus'::text, 'Assis'::text]))),
    CONSTRAINT patient_ecg_records_quality_check CHECK ((quality = ANY (ARRAY['Bonne'::text, 'Artefacts'::text]))),
    CONSTRAINT patient_ecg_records_regularity_check CHECK ((regularity = ANY (ARRAY['Regulier'::text, 'Irregulier'::text]))),
    CONSTRAINT patient_ecg_records_repolarization_check CHECK ((repolarization = ANY (ARRAY['Normal'::text, 'Anomalie'::text]))),
    CONSTRAINT patient_ecg_records_rhythm_check CHECK ((rhythm = ANY (ARRAY['Sinusal'::text, 'Atrial'::text, 'Jonctionnel'::text, 'Ventriculaire'::text]))),
    CONSTRAINT patient_ecg_records_speed_mm_s_check CHECK ((speed_mm_s = ANY (ARRAY[25, 50]))),
    CONSTRAINT patient_ecg_records_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'VALIDATED'::text, 'ENTERED_IN_ERROR'::text])))
);


ALTER TABLE public.patient_ecg_records OWNER TO sahty;

--
-- Name: patient_echo_records; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_echo_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    linked_admission_id uuid,
    exam_date date NOT NULL,
    exam_time time without time zone NOT NULL,
    exam_type text DEFAULT 'ETT'::text NOT NULL,
    modalities text[] DEFAULT '{}'::text[] NOT NULL,
    fevg_pct numeric(5,2),
    gls_pct numeric(5,2),
    mapse_mm numeric(5,2),
    dtd_vg_mm numeric(5,2),
    dtd_index_mm_m2 numeric(5,2),
    siv_mm numeric(5,2),
    pp_mm numeric(5,2),
    hvg text DEFAULT 'Absente'::text NOT NULL,
    trouble_cinetique boolean DEFAULT false NOT NULL,
    segments_cinetique text[] DEFAULT '{}'::text[] NOT NULL,
    tapse_mm numeric(5,2),
    fonction_vd text DEFAULT 'Normale'::text NOT NULL,
    surface_vd_cm2 numeric(5,2),
    og_taille text DEFAULT 'Normale'::text NOT NULL,
    od_taille text DEFAULT 'Normale'::text NOT NULL,
    paps_mmhg numeric(5,1),
    vci text DEFAULT 'Normale'::text NOT NULL,
    valve_mitrale_status text DEFAULT 'Normale'::text NOT NULL,
    valve_mitrale_type text[] DEFAULT '{}'::text[] NOT NULL,
    valve_mitrale_severity text DEFAULT 'Minime'::text NOT NULL,
    valve_aortique_status text DEFAULT 'Normale'::text NOT NULL,
    valve_aortique_type text[] DEFAULT '{}'::text[] NOT NULL,
    valve_aortique_severity text DEFAULT 'Minime'::text NOT NULL,
    valve_tricuspide_status text DEFAULT 'Normale'::text NOT NULL,
    valve_tricuspide_type text[] DEFAULT '{}'::text[] NOT NULL,
    valve_tricuspide_severity text DEFAULT 'Minime'::text NOT NULL,
    valve_pulmonaire_status text DEFAULT 'Normale'::text NOT NULL,
    valve_pulmonaire_type text[] DEFAULT '{}'::text[] NOT NULL,
    valve_pulmonaire_severity text DEFAULT 'Minime'::text NOT NULL,
    pericarde text DEFAULT 'Sec'::text NOT NULL,
    thrombus boolean DEFAULT false NOT NULL,
    vegetation boolean DEFAULT false NOT NULL,
    autre_anomalie text,
    conclusion_observation_id uuid,
    doctor text,
    has_attachment boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    entered_in_error_by uuid,
    entered_in_error_at timestamp with time zone,
    entered_in_error_reason text,
    created_by_first_name text,
    created_by_last_name text,
    CONSTRAINT patient_echo_records_exam_type_check CHECK ((exam_type = ANY (ARRAY['ETT'::text, 'ETO'::text, 'Stress'::text, 'POCUS'::text]))),
    CONSTRAINT patient_echo_records_fonction_vd_check CHECK ((fonction_vd = ANY (ARRAY['Normale'::text, 'Altérée'::text]))),
    CONSTRAINT patient_echo_records_hvg_check CHECK ((hvg = ANY (ARRAY['Absente'::text, 'Modérée'::text, 'Sévère'::text]))),
    CONSTRAINT patient_echo_records_od_taille_check CHECK ((od_taille = ANY (ARRAY['Normale'::text, 'Dilatée'::text]))),
    CONSTRAINT patient_echo_records_og_taille_check CHECK ((og_taille = ANY (ARRAY['Normale'::text, 'Dilatée'::text]))),
    CONSTRAINT patient_echo_records_pericarde_check CHECK ((pericarde = ANY (ARRAY['Sec'::text, 'Epanchement Minime'::text, 'Epanchement Modéré'::text, 'Epanchement Abondant'::text]))),
    CONSTRAINT patient_echo_records_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'VALIDATED'::text, 'ENTERED_IN_ERROR'::text]))),
    CONSTRAINT patient_echo_records_valve_aortique_severity_check CHECK ((valve_aortique_severity = ANY (ARRAY['Minime'::text, 'Modérée'::text, 'Sévère'::text]))),
    CONSTRAINT patient_echo_records_valve_aortique_status_check CHECK ((valve_aortique_status = ANY (ARRAY['Normale'::text, 'Pathologique'::text]))),
    CONSTRAINT patient_echo_records_valve_mitrale_severity_check CHECK ((valve_mitrale_severity = ANY (ARRAY['Minime'::text, 'Modérée'::text, 'Sévère'::text]))),
    CONSTRAINT patient_echo_records_valve_mitrale_status_check CHECK ((valve_mitrale_status = ANY (ARRAY['Normale'::text, 'Pathologique'::text]))),
    CONSTRAINT patient_echo_records_valve_pulmonaire_severity_check CHECK ((valve_pulmonaire_severity = ANY (ARRAY['Minime'::text, 'Modérée'::text, 'Sévère'::text]))),
    CONSTRAINT patient_echo_records_valve_pulmonaire_status_check CHECK ((valve_pulmonaire_status = ANY (ARRAY['Normale'::text, 'Pathologique'::text]))),
    CONSTRAINT patient_echo_records_valve_tricuspide_severity_check CHECK ((valve_tricuspide_severity = ANY (ARRAY['Minime'::text, 'Modérée'::text, 'Sévère'::text]))),
    CONSTRAINT patient_echo_records_valve_tricuspide_status_check CHECK ((valve_tricuspide_status = ANY (ARRAY['Normale'::text, 'Pathologique'::text]))),
    CONSTRAINT patient_echo_records_vci_check CHECK ((vci = ANY (ARRAY['Normale'::text, 'Dilatée'::text, 'Peu Collabable'::text])))
);


ALTER TABLE public.patient_echo_records OWNER TO sahty;

--
-- Name: patient_identity_change; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_identity_change (
    change_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by_user_id uuid,
    change_source text NOT NULL,
    field_path text NOT NULL,
    old_value text,
    new_value text,
    reason text
);


ALTER TABLE public.patient_identity_change OWNER TO sahty;

--
-- Name: patient_lab_extraction_sessions; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_lab_extraction_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_lab_report_id uuid NOT NULL,
    source_document_id uuid,
    engine_name text,
    engine_version text,
    status text NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    raw_output_json jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patient_lab_extraction_sessions_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'SUCCEEDED'::text, 'FAILED'::text, 'ABANDONED'::text])))
);


ALTER TABLE public.patient_lab_extraction_sessions OWNER TO sahty;

--
-- Name: patient_lab_report_documents; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_lab_report_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_lab_report_id uuid NOT NULL,
    document_id uuid NOT NULL,
    sort_order integer,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    derivation_type text DEFAULT 'ORIGINAL'::text NOT NULL,
    CONSTRAINT check_derivation_type_enum CHECK ((derivation_type = ANY (ARRAY['ORIGINAL'::text, 'MERGED'::text]))),
    CONSTRAINT check_sort_order_derivation CHECK ((((derivation_type = 'MERGED'::text) AND (sort_order IS NULL)) OR (derivation_type = 'ORIGINAL'::text)))
);


ALTER TABLE public.patient_lab_report_documents OWNER TO sahty;

--
-- Name: patient_lab_report_tests; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_lab_report_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_lab_report_id uuid NOT NULL,
    global_act_id uuid,
    panel_id uuid,
    raw_test_label text,
    display_order integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.patient_lab_report_tests OWNER TO sahty;

--
-- Name: patient_lab_reports; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_lab_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_patient_id uuid NOT NULL,
    admission_id uuid,
    source_type text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    structuring_status text DEFAULT 'DOCUMENT_ONLY'::text NOT NULL,
    report_title text,
    source_lab_name text,
    source_lab_report_number text,
    report_date date,
    collected_at timestamp with time zone,
    received_at timestamp with time zone,
    used_ai_assistance boolean DEFAULT false NOT NULL,
    uploaded_by_user_id uuid NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    structured_by_user_id uuid,
    structured_at timestamp with time zone,
    entered_in_error_by_user_id uuid,
    entered_in_error_at timestamp with time zone,
    entered_in_error_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    interpretation_text text,
    CONSTRAINT patient_lab_reports_source_type_check CHECK ((source_type = ANY (ARRAY['EXTERNAL_REPORT'::text, 'INTERNAL_LIMS'::text, 'EXTERNAL_INTERFACE'::text, 'LEGACY_MIGRATION'::text]))),
    CONSTRAINT patient_lab_reports_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'ENTERED_IN_ERROR'::text, 'DRAFT'::text, 'VALIDATED'::text, 'AMENDED'::text]))),
    CONSTRAINT patient_lab_reports_structuring_status_check CHECK ((structuring_status = ANY (ARRAY['DOCUMENT_ONLY'::text, 'STRUCTURED'::text])))
);


ALTER TABLE public.patient_lab_reports OWNER TO sahty;

--
-- Name: patient_lab_results; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_lab_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_lab_report_id uuid NOT NULL,
    patient_lab_report_test_id uuid,
    analyte_id uuid,
    raw_analyte_label text,
    value_type text NOT NULL,
    numeric_value numeric(18,6),
    text_value text,
    boolean_value boolean,
    choice_value text,
    unit_id uuid,
    raw_unit_text text,
    reference_range_text text,
    reference_low_numeric numeric(18,6),
    reference_high_numeric numeric(18,6),
    raw_abnormal_flag_text text,
    abnormal_flag text,
    observed_at timestamp with time zone,
    method_id uuid,
    specimen_type_id uuid,
    source_line_reference text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    entered_in_error_by_user_id uuid,
    entered_in_error_at timestamp with time zone,
    entered_in_error_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lab_analyte_context_id uuid,
    raw_method_text text,
    raw_specimen_type_text text,
    interpretation character varying,
    CONSTRAINT chk_lab_result_mode CHECK ((((lab_analyte_context_id IS NULL) AND (raw_analyte_label IS NOT NULL)) OR (lab_analyte_context_id IS NOT NULL))),
    CONSTRAINT chk_patient_lab_results_identity CHECK (((lab_analyte_context_id IS NOT NULL) OR (raw_analyte_label IS NOT NULL))),
    CONSTRAINT patient_lab_results_abnormal_flag_check CHECK ((abnormal_flag = ANY (ARRAY['LOW'::text, 'HIGH'::text, 'CRITICAL_LOW'::text, 'CRITICAL_HIGH'::text, 'ABNORMAL'::text, 'NORMAL'::text]))),
    CONSTRAINT patient_lab_results_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'ENTERED_IN_ERROR'::text]))),
    CONSTRAINT patient_lab_results_value_type_check CHECK ((value_type = ANY (ARRAY['NUMERIC'::text, 'TEXT'::text, 'BOOLEAN'::text, 'CHOICE'::text])))
);


ALTER TABLE public.patient_lab_results OWNER TO sahty;

--
-- Name: patient_observations; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_observations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_patient_id uuid NOT NULL,
    created_by uuid NOT NULL,
    author_role text NOT NULL,
    note_type text NOT NULL,
    privacy_level text DEFAULT 'NORMAL'::text NOT NULL,
    status text NOT NULL,
    declared_time timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    signed_at timestamp with time zone,
    signed_by uuid,
    parent_observation_id uuid,
    linked_admission_id uuid,
    linked_allergy_id uuid,
    linked_addiction_id uuid,
    body_html text NOT NULL,
    body_plain text NOT NULL,
    author_first_name text NOT NULL,
    author_last_name text NOT NULL,
    entered_in_error_by uuid,
    entered_in_error_at timestamp with time zone,
    entered_in_error_reason text,
    CONSTRAINT chk_no_self_parent CHECK (((parent_observation_id IS NULL) OR (parent_observation_id <> id))),
    CONSTRAINT patient_observations_author_role_check CHECK ((author_role = ANY (ARRAY['DOCTOR'::text, 'NURSE'::text]))),
    CONSTRAINT patient_observations_body_html_check CHECK ((length(body_html) < 200000)),
    CONSTRAINT patient_observations_note_type_check CHECK ((note_type = ANY (ARRAY['ADMISSION'::text, 'PROGRESS'::text, 'DISCHARGE'::text, 'CONSULT'::text, 'GENERAL'::text, 'INTERP_ECG'::text, 'INTERP_ECHO'::text]))),
    CONSTRAINT patient_observations_privacy_level_check CHECK ((privacy_level = ANY (ARRAY['NORMAL'::text, 'SENSITIVE'::text, 'RESTRICTED'::text]))),
    CONSTRAINT patient_observations_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'SIGNED'::text, 'ENTERED_IN_ERROR'::text])))
);


ALTER TABLE public.patient_observations OWNER TO sahty;

--
-- Name: patient_relationship_links; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_relationship_links (
    relationship_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    subject_tenant_patient_id uuid NOT NULL,
    related_tenant_patient_id uuid,
    related_first_name text,
    related_last_name text,
    related_identity_type_code text,
    related_identity_value text,
    related_issuing_country_code text,
    relationship_type_code text NOT NULL,
    is_legal_guardian boolean DEFAULT false NOT NULL,
    is_decision_maker boolean DEFAULT false NOT NULL,
    is_emergency_contact boolean DEFAULT false NOT NULL,
    priority integer,
    is_primary boolean DEFAULT false NOT NULL,
    valid_from date,
    valid_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    related_phone text
);


ALTER TABLE public.patient_relationship_links OWNER TO sahty;

--
-- Name: patient_stays; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_stays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admission_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    bed_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.patient_stays OWNER TO sahty;

--
-- Name: patient_tenant_merge_events; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patient_tenant_merge_events (
    merge_event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_tenant_patient_id uuid NOT NULL,
    target_tenant_patient_id uuid NOT NULL,
    reason text,
    merged_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.patient_tenant_merge_events OWNER TO sahty;

--
-- Name: patients_tenant; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.patients_tenant (
    tenant_patient_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    lifecycle_status text DEFAULT 'ACTIVE'::text NOT NULL,
    identity_status text DEFAULT 'PROVISIONAL'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    first_name text,
    last_name text,
    dob date,
    sex text,
    merged_into_tenant_patient_id uuid,
    CONSTRAINT patients_tenant_identity_status_check CHECK ((identity_status = ANY (ARRAY['UNKNOWN'::text, 'PROVISIONAL'::text, 'VERIFIED'::text]))),
    CONSTRAINT patients_tenant_lifecycle_status_check CHECK ((lifecycle_status = ANY (ARRAY['ACTIVE'::text, 'MERGED'::text, 'INACTIVE'::text])))
);


ALTER TABLE public.patients_tenant OWNER TO sahty;

--
-- Name: po_items; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.po_items (
    po_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty_ordered integer NOT NULL,
    qty_delivered integer DEFAULT 0,
    qty_to_be_delivered integer DEFAULT 0,
    unit_price numeric
);


ALTER TABLE public.po_items OWNER TO sahty;

--
-- Name: prescription_events; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.prescription_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    prescription_id uuid NOT NULL,
    admission_id uuid,
    scheduled_at timestamp with time zone NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    duration integer,
    requires_fluid_info boolean DEFAULT false NOT NULL,
    requires_end_event boolean DEFAULT false NOT NULL,
    tenant_patient_id uuid,
    CONSTRAINT prescription_events_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'SKIPPED'::text])))
);


ALTER TABLE public.prescription_events OWNER TO sahty;

--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.prescriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    admission_id uuid,
    status text DEFAULT 'ACTIVE'::text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    tenant_patient_id uuid,
    prescription_type text DEFAULT 'medication'::text NOT NULL,
    condition_comment text,
    created_by_first_name text,
    created_by_last_name text,
    paused_at timestamp with time zone,
    paused_by uuid,
    stopped_at timestamp with time zone,
    stopped_by uuid,
    stopped_reason text,
    requires_fluid_info boolean DEFAULT false NOT NULL,
    qty numeric,
    molecule_id uuid,
    molecule_name text,
    product_id uuid,
    product_name text,
    acte_id uuid,
    libelle_sih text,
    blood_product_type text,
    unit_id uuid,
    unit_label text,
    route_id uuid,
    route_label text,
    substitutable boolean,
    dilution_required boolean,
    solvent_qty numeric,
    solvent_unit_id uuid,
    solvent_unit_label text,
    solvent_molecule_id uuid,
    solvent_molecule_name text,
    solvent_product_id uuid,
    solvent_product_name text,
    schedule_mode text,
    schedule_type text,
    "interval" integer,
    simple_count integer,
    duration_unit text,
    duration_value integer,
    simple_period text,
    daily_schedule text,
    selected_days jsonb,
    specific_times jsonb,
    start_datetime timestamp without time zone,
    interval_duration integer,
    is_custom_interval boolean,
    admin_mode text,
    admin_duration_mins integer,
    skipped_events jsonb,
    manually_adjusted_events jsonb,
    database_mode text
);


ALTER TABLE public.prescriptions OWNER TO sahty;

--
-- Name: product_configs; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.product_configs (
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    is_enabled boolean DEFAULT true,
    min_stock integer,
    max_stock integer,
    security_stock integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.product_configs OWNER TO sahty;

--
-- Name: product_price_versions; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.product_price_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    product_supplier_id uuid NOT NULL,
    purchase_price numeric NOT NULL,
    margin numeric DEFAULT 0,
    vat numeric DEFAULT 0,
    sale_price_ht numeric,
    sale_price_ttc numeric,
    unit_sale_price numeric,
    valid_from timestamp with time zone DEFAULT now(),
    valid_to timestamp with time zone,
    created_by text,
    change_reason text,
    status text DEFAULT 'ACTIVE'::text
);


ALTER TABLE public.product_price_versions OWNER TO sahty;

--
-- Name: product_suppliers; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.product_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    supplier_type text DEFAULT 'GLOBAL'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.product_suppliers OWNER TO sahty;

--
-- Name: product_wac; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.product_wac (
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    wac numeric NOT NULL,
    last_updated timestamp with time zone DEFAULT now()
);


ALTER TABLE public.product_wac OWNER TO sahty;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.purchase_orders (
    po_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    status text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reference text,
    created_by_first_name text,
    created_by_last_name text
);


ALTER TABLE public.purchase_orders OWNER TO sahty;

--
-- Name: reference_schema_version; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.reference_schema_version (
    id integer NOT NULL,
    current_version integer NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reference_schema_version_id_check CHECK ((id = 1))
);


ALTER TABLE public.reference_schema_version OWNER TO sahty;

--
-- Name: return_decision_lines; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.return_decision_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    decision_id uuid NOT NULL,
    return_line_id uuid NOT NULL,
    qty_units integer NOT NULL,
    outcome text NOT NULL,
    destination_location_id uuid
);


ALTER TABLE public.return_decision_lines OWNER TO sahty;

--
-- Name: return_decisions; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.return_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reception_id uuid NOT NULL,
    decided_by uuid NOT NULL,
    decided_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.return_decisions OWNER TO sahty;

--
-- Name: return_reception_lines; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.return_reception_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reception_id uuid NOT NULL,
    return_line_id uuid NOT NULL,
    qty_received_units integer NOT NULL
);


ALTER TABLE public.return_reception_lines OWNER TO sahty;

--
-- Name: return_receptions; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.return_receptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    return_id uuid NOT NULL,
    received_by uuid NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    reception_reference text,
    status text DEFAULT 'OPEN'::text NOT NULL
);


ALTER TABLE public.return_receptions OWNER TO sahty;

--
-- Name: room_types; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.room_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    unit_category text DEFAULT 'CHAMBRE'::text NOT NULL,
    number_of_beds integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.room_types OWNER TO sahty;

--
-- Name: rooms; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    room_type_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.rooms OWNER TO sahty;

--
-- Name: service_units; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.service_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    name text NOT NULL,
    type text,
    capacity integer DEFAULT 0
);


ALTER TABLE public.service_units OWNER TO sahty;

--
-- Name: services; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    description text
);


ALTER TABLE public.services OWNER TO sahty;

--
-- Name: smart_phrases; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.smart_phrases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trigger text NOT NULL,
    trigger_search text NOT NULL,
    label text,
    description text,
    body_html text NOT NULL,
    scope text NOT NULL,
    tenant_id uuid,
    user_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_smart_phrases_scope_refs CHECK ((((scope = 'system'::text) AND (user_id IS NULL)) OR ((scope = 'tenant'::text) AND (tenant_id IS NOT NULL) AND (user_id IS NULL)) OR ((scope = 'user'::text) AND (tenant_id IS NOT NULL) AND (user_id IS NOT NULL)))),
    CONSTRAINT smart_phrases_scope_check CHECK ((scope = ANY (ARRAY['system'::text, 'tenant'::text, 'user'::text])))
);


ALTER TABLE public.smart_phrases OWNER TO sahty;

--
-- Name: stock_demand_lines; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.stock_demand_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    demand_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty_requested integer NOT NULL,
    qty_allocated integer DEFAULT 0,
    qty_transferred integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    target_stock_location_id uuid
);


ALTER TABLE public.stock_demand_lines OWNER TO sahty;

--
-- Name: stock_demands; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.stock_demands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    service_id uuid NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    priority text DEFAULT 'ROUTINE'::text,
    requested_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    demand_ref text,
    requested_by_first_name text,
    requested_by_last_name text,
    processing_status text DEFAULT 'OPEN'::text,
    assigned_user_id uuid,
    claimed_at timestamp with time zone
);


ALTER TABLE public.stock_demands OWNER TO sahty;

--
-- Name: stock_reservation_lines; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.stock_reservation_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    stock_demand_line_id uuid,
    product_id uuid NOT NULL,
    lot text NOT NULL,
    expiry date NOT NULL,
    source_location_id uuid NOT NULL,
    destination_location_id uuid,
    qty_units integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.stock_reservation_lines OWNER TO sahty;

--
-- Name: stock_reservations; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.stock_reservations (
    reservation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    stock_demand_id uuid,
    status text DEFAULT 'ACTIVE'::text,
    reserved_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    released_at timestamp with time zone,
    committed_at timestamp with time zone
);


ALTER TABLE public.stock_reservations OWNER TO sahty;

--
-- Name: stock_return_lines; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.stock_return_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    return_id uuid NOT NULL,
    product_id uuid NOT NULL,
    lot text NOT NULL,
    expiry date NOT NULL,
    source_location_id uuid NOT NULL,
    qty_declared_units integer NOT NULL,
    original_dispense_event_id uuid,
    stock_reservation_line_id uuid
);


ALTER TABLE public.stock_return_lines OWNER TO sahty;

--
-- Name: stock_returns; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.stock_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    source_type text NOT NULL,
    source_service_id uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    stock_reservation_id uuid,
    return_reference text
);


ALTER TABLE public.stock_returns OWNER TO sahty;

--
-- Name: stock_transfer_lines; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.stock_transfer_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transfer_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    product_id uuid NOT NULL,
    lot text NOT NULL,
    expiry date NOT NULL,
    qty_transferred integer NOT NULL,
    demand_line_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    source_location_id uuid,
    destination_location_id uuid,
    reservation_line_id uuid
);


ALTER TABLE public.stock_transfer_lines OWNER TO sahty;

--
-- Name: stock_transfers; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.stock_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    demand_id uuid,
    status text DEFAULT 'PENDING'::text NOT NULL,
    validated_at timestamp with time zone,
    validated_by text,
    created_at timestamp with time zone DEFAULT now(),
    client_request_id text,
    stock_reservation_id uuid
);


ALTER TABLE public.stock_transfers OWNER TO sahty;

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.suppliers (
    supplier_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    address text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.suppliers OWNER TO sahty;

--
-- Name: surveillance_hour_buckets; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.surveillance_hour_buckets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    bucket_start timestamp with time zone NOT NULL,
    "values" jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.surveillance_hour_buckets OWNER TO sahty;

--
-- Name: surveillance_values_events; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.surveillance_values_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    parameter_id uuid NOT NULL,
    parameter_code text NOT NULL,
    bucket_start timestamp with time zone NOT NULL,
    value_numeric numeric,
    value_text text,
    value_boolean boolean,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    context_id uuid,
    source_context text NOT NULL,
    recorded_by_first_name text,
    recorded_by_last_name text,
    CONSTRAINT chk_exactly_one_value_type CHECK ((((((value_numeric IS NOT NULL))::integer + ((value_text IS NOT NULL))::integer) + ((value_boolean IS NOT NULL))::integer) <= 1)),
    CONSTRAINT chk_surveillance_source_context CHECK ((source_context = ANY (ARRAY['flowsheet'::text, 'clinical_exam'::text, 'hydric_engine'::text, 'monitor'::text, 'pump'::text, 'integration'::text, 'system'::text])))
);


ALTER TABLE public.surveillance_values_events OWNER TO sahty;

--
-- Name: transfusion_blood_bags; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.transfusion_blood_bags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tenant_patient_id uuid NOT NULL,
    admission_id uuid,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    received_by_user_id uuid NOT NULL,
    received_by_user_first_name character varying(255),
    received_by_user_last_name character varying(255),
    blood_product_code text NOT NULL,
    bag_number text NOT NULL,
    abo_group text NOT NULL,
    rhesus text NOT NULL,
    volume_ml numeric,
    expiry_at timestamp with time zone,
    status text DEFAULT 'RECEIVED'::text NOT NULL,
    notes text,
    billed_at timestamp with time zone,
    billing_status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_prescription_event_id uuid,
    CONSTRAINT chk_transfusion_bag_status CHECK ((status = ANY (ARRAY['RECEIVED'::text, 'ISSUED'::text, 'ADMINISTERED'::text, 'CANCELLED'::text, 'WASTED'::text, 'IN_USE'::text, 'USED'::text, 'DISCARDED'::text])))
);


ALTER TABLE public.transfusion_blood_bags OWNER TO sahty;

--
-- Name: transfusion_checks; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.transfusion_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    administration_event_id uuid NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    checked_by_user_id uuid NOT NULL,
    identity_check_done boolean DEFAULT false NOT NULL,
    compatibility_check_done boolean DEFAULT false NOT NULL,
    bedside_double_check_done boolean DEFAULT false NOT NULL,
    vitals_baseline_done boolean DEFAULT false NOT NULL,
    notes text
);


ALTER TABLE public.transfusion_checks OWNER TO sahty;

--
-- Name: transfusion_reactions; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.transfusion_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    administration_event_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by_user_id uuid NOT NULL,
    reaction_type text NOT NULL,
    severity text,
    description text,
    actions_taken text
);


ALTER TABLE public.transfusion_reactions OWNER TO sahty;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_roles OWNER TO sahty;

--
-- Name: user_services; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.user_services (
    user_id uuid NOT NULL,
    service_id uuid NOT NULL
);


ALTER TABLE public.user_services OWNER TO sahty;

--
-- Name: care_categories; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.care_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE reference.care_categories OWNER TO sahty;

--
-- Name: countries; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.countries (
    country_id uuid NOT NULL,
    iso_code text,
    name text NOT NULL
);


ALTER TABLE reference.countries OWNER TO sahty;

--
-- Name: dci_synonyms; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.dci_synonyms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dci_id uuid NOT NULL,
    synonym text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE reference.dci_synonyms OWNER TO sahty;

--
-- Name: flowsheet_groups; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.flowsheet_groups (
    flowsheet_id uuid NOT NULL,
    group_id uuid NOT NULL,
    sort_order integer DEFAULT 0
);


ALTER TABLE reference.flowsheet_groups OWNER TO sahty;

--
-- Name: global_actes; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.global_actes (
    code_sih text NOT NULL,
    libelle_sih text NOT NULL,
    code_ngap text,
    libelle_ngap text,
    cotation_ngap text,
    code_ccam text,
    libelle_ccam text,
    type_acte text,
    duree_moyenne integer,
    actif boolean DEFAULT true,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    catalog_version integer DEFAULT 1 NOT NULL,
    famille_id uuid,
    sous_famille_id uuid,
    bio_grise boolean,
    bio_grise_prescription boolean,
    bio_delai_resultats_heures integer,
    bio_cle_facturation text,
    bio_nombre_b integer,
    bio_nombre_b1 integer,
    bio_nombre_b2 integer,
    bio_nombre_b3 integer,
    bio_nombre_b4 integer,
    bio_instructions_prelevement text,
    bio_commentaire text,
    bio_commentaire_prescription text,
    is_lims_enabled boolean DEFAULT false,
    lab_section_id uuid,
    lab_sub_section_id uuid,
    is_panel boolean DEFAULT false NOT NULL,
    billing_mode text DEFAULT 'DECOMPOSED'::text NOT NULL,
    CONSTRAINT chk_ref_global_actes_billing_mode CHECK ((billing_mode = ANY (ARRAY['PANEL'::text, 'DECOMPOSED'::text]))),
    CONSTRAINT chk_ref_global_actes_lab_section_hierarchy CHECK (((lab_sub_section_id IS NULL) OR (lab_section_id IS NOT NULL)))
);


ALTER TABLE reference.global_actes OWNER TO sahty;

--
-- Name: global_atc; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.global_atc (
    code text NOT NULL,
    label_fr text,
    label_en text,
    level integer,
    parent text
);


ALTER TABLE reference.global_atc OWNER TO sahty;

--
-- Name: global_dci; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.global_dci (
    id uuid NOT NULL,
    name text NOT NULL,
    atc_code text,
    therapeutic_class text,
    created_at timestamp with time zone,
    care_category_id uuid
);


ALTER TABLE reference.global_dci OWNER TO sahty;

--
-- Name: global_emdn; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.global_emdn (
    code text NOT NULL,
    label_fr text,
    label_en text,
    level integer,
    parent text
);


ALTER TABLE reference.global_emdn OWNER TO sahty;

--
-- Name: global_product_price_history; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.global_product_price_history (
    id uuid NOT NULL,
    product_id uuid NOT NULL,
    ppv numeric,
    ph numeric,
    pfht numeric,
    valid_from timestamp with time zone,
    valid_to timestamp with time zone,
    created_at timestamp with time zone
);


ALTER TABLE reference.global_product_price_history OWNER TO sahty;

--
-- Name: global_products; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.global_products (
    id uuid NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    form text,
    dci_composition jsonb,
    presentation text,
    manufacturer text,
    ppv numeric,
    ph numeric,
    pfht numeric,
    class_therapeutique text,
    sahty_code text,
    code text,
    units_per_pack integer DEFAULT 1,
    default_presc_unit uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    default_presc_route uuid,
    care_category_id uuid
);


ALTER TABLE reference.global_products OWNER TO sahty;

--
-- Name: global_roles; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.global_roles (
    id uuid NOT NULL,
    code text,
    name text NOT NULL,
    description text,
    permissions jsonb,
    modules jsonb,
    assignable_by text,
    created_at timestamp with time zone
);


ALTER TABLE reference.global_roles OWNER TO sahty;

--
-- Name: global_suppliers; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.global_suppliers (
    id uuid NOT NULL,
    name text NOT NULL,
    tax_id text,
    address text,
    contact_info jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone
);


ALTER TABLE reference.global_suppliers OWNER TO sahty;

--
-- Name: group_parameters; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.group_parameters (
    group_id uuid NOT NULL,
    parameter_id uuid NOT NULL,
    sort_order integer DEFAULT 0
);


ALTER TABLE reference.group_parameters OWNER TO sahty;

--
-- Name: identity_document_types; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.identity_document_types (
    code text NOT NULL,
    label text NOT NULL,
    validation_regex text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE reference.identity_document_types OWNER TO sahty;

--
-- Name: lab_act_analyte_context; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_act_analyte_context (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    global_act_id uuid NOT NULL,
    analyte_context_id uuid NOT NULL,
    is_default boolean DEFAULT false,
    actif boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lab_act_analyte_context OWNER TO sahty;

--
-- Name: lab_act_analytes; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_act_analytes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    global_act_id uuid NOT NULL,
    analyte_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    display_group text,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);


ALTER TABLE public.lab_act_analytes OWNER TO sahty;

--
-- Name: lab_act_contexts; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_act_contexts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    global_act_id uuid NOT NULL,
    analyte_context_id uuid NOT NULL,
    sort_order integer,
    is_required boolean DEFAULT true,
    is_default boolean DEFAULT false,
    display_group text,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lab_act_contexts OWNER TO sahty;

--
-- Name: lab_act_methods; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_act_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    global_act_id uuid NOT NULL,
    method_id uuid NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lab_act_methods OWNER TO sahty;

--
-- Name: lab_act_specimen_containers; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_act_specimen_containers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    global_act_id uuid NOT NULL,
    specimen_type_id uuid NOT NULL,
    container_type_id uuid NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    min_volume numeric,
    volume_unit_id uuid,
    volume_unit_label text,
    collection_instructions text,
    sort_order integer DEFAULT 0 NOT NULL,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lab_act_specimen_containers OWNER TO sahty;

--
-- Name: lab_act_specimen_types; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_act_specimen_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    global_act_id uuid NOT NULL,
    specimen_type_id uuid NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    collection_instructions text,
    min_volume numeric(12,3),
    volume_unit text,
    transport_conditions text,
    stability_notes text,
    actif boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lab_act_specimen_types OWNER TO sahty;

--
-- Name: lab_act_taxonomy; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_act_taxonomy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    act_id uuid NOT NULL,
    sous_famille_id uuid NOT NULL,
    section_id uuid NOT NULL,
    sub_section_id uuid,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lab_act_taxonomy OWNER TO sahty;

--
-- Name: lab_analyte_aliases; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_analyte_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    analyte_id uuid NOT NULL,
    alias_text text NOT NULL,
    alias_type text DEFAULT 'DISPLAY'::text NOT NULL,
    language_code text,
    source_system text,
    is_preferred boolean DEFAULT false NOT NULL,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lab_analyte_aliases_alias_type_check CHECK ((alias_type = ANY (ARRAY['DISPLAY'::text, 'OCR'::text, 'EXTERNAL'::text, 'SHORT'::text, 'ABBREVIATION'::text])))
);


ALTER TABLE public.lab_analyte_aliases OWNER TO sahty;

--
-- Name: lab_analyte_contexts; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_analyte_contexts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    analyte_id uuid NOT NULL,
    specimen_type_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    method_id uuid,
    analyte_label text NOT NULL,
    specimen_label text NOT NULL,
    unit_label text NOT NULL,
    method_label text,
    is_default boolean DEFAULT false,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cached_value_type text
);


ALTER TABLE public.lab_analyte_contexts OWNER TO sahty;

--
-- Name: lab_analyte_reference_ranges; Type: TABLE; Schema: public; Owner: sahty
--

CREATE TABLE public.lab_analyte_reference_ranges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    analyte_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    method_id uuid,
    specimen_type_id uuid,
    sex text,
    age_min_days integer,
    age_max_days integer,
    lower_numeric numeric(18,6),
    upper_numeric numeric(18,6),
    lower_text text,
    upper_text text,
    reference_text text,
    critical_low_numeric numeric(18,6),
    critical_high_numeric numeric(18,6),
    actif boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lab_analyte_reference_ranges_sex_check CHECK ((sex = ANY (ARRAY['MALE'::text, 'FEMALE'::text, 'OTHER'::text, 'UNKNOWN'::text, 'ANY'::text])))
);


ALTER TABLE public.lab_analyte_reference_ranges OWNER TO sahty;

--
-- Name: lab_analyte_units; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_analyte_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    analyte_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_canonical boolean DEFAULT false NOT NULL,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    conversion_factor numeric DEFAULT 1 NOT NULL,
    conversion_offset numeric DEFAULT 0 NOT NULL
);


ALTER TABLE public.lab_analyte_units OWNER TO sahty;

--
-- Name: lab_analytes; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.lab_analytes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    libelle text NOT NULL,
    short_label text,
    description text,
    value_type text NOT NULL,
    is_calculated boolean DEFAULT false NOT NULL,
    actif boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lab_analytes_value_type_check CHECK ((value_type = ANY (ARRAY['NUMERIC'::text, 'TEXT'::text, 'BOOLEAN'::text, 'CHOICE'::text])))
);


ALTER TABLE reference.lab_analytes OWNER TO sahty;

--
-- Name: lab_canonical_allowed_values; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.lab_canonical_allowed_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    value_domain text,
    ordinal_rank integer,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT no_interpretation_values CHECK ((code <> ALL (ARRAY['NORMAL'::text, 'ABNORMAL'::text, 'ABNORMAL_LOW'::text, 'ABNORMAL_HIGH'::text, 'CAUTION'::text, 'CAUTION_LOW'::text, 'CAUTION_HIGH'::text])))
);


ALTER TABLE reference.lab_canonical_allowed_values OWNER TO sahty;

--
-- Name: lab_container_types; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.lab_container_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    libelle text NOT NULL,
    description text,
    additive_type text,
    tube_color text,
    actif boolean DEFAULT true NOT NULL,
    sort_order integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE reference.lab_container_types OWNER TO sahty;

--
-- Name: lab_methods; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.lab_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    libelle text NOT NULL,
    description text,
    actif boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE reference.lab_methods OWNER TO sahty;

--
-- Name: lab_panel_items; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_panel_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    panel_id uuid NOT NULL,
    item_type text NOT NULL,
    child_panel_id uuid,
    child_global_act_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    quantity numeric(12,3),
    notes text,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_lab_panel_child_exclusive CHECK ((((item_type = 'ACT'::text) AND (child_global_act_id IS NOT NULL) AND (child_panel_id IS NULL)) OR ((item_type = 'PANEL'::text) AND (child_panel_id IS NOT NULL) AND (child_global_act_id IS NULL)))),
    CONSTRAINT chk_lab_panel_no_self_ref CHECK ((panel_id <> child_panel_id)),
    CONSTRAINT chk_ref_lab_panel_items_type CHECK ((item_type = ANY (ARRAY['ACT'::text, 'PANEL'::text]))),
    CONSTRAINT lab_panel_items_item_type_check CHECK ((item_type = ANY (ARRAY['PANEL'::text, 'ACT'::text])))
);


ALTER TABLE public.lab_panel_items OWNER TO sahty;

--
-- Name: lab_panels; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_panels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sous_famille_id uuid NOT NULL,
    section_id uuid,
    sub_section_id uuid,
    code text NOT NULL,
    libelle text NOT NULL,
    description text,
    actif boolean DEFAULT true NOT NULL,
    is_prescribable boolean DEFAULT true NOT NULL,
    expand_to_child_tests boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    global_act_id uuid NOT NULL
);


ALTER TABLE public.lab_panels OWNER TO sahty;

--
-- Name: lab_reference_profiles; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_reference_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    analyte_context_id uuid NOT NULL,
    sex text,
    age_min_days integer,
    age_max_days integer,
    is_default boolean DEFAULT false NOT NULL,
    actif boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    source text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lab_reference_profiles_sex_check CHECK ((sex = ANY (ARRAY['M'::text, 'F'::text, 'U'::text])))
);


ALTER TABLE public.lab_reference_profiles OWNER TO sahty;

--
-- Name: lab_reference_rules; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_reference_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    interpretation text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    lower_numeric numeric(18,6),
    upper_numeric numeric(18,6),
    lower_inclusive boolean DEFAULT true NOT NULL,
    upper_inclusive boolean DEFAULT true NOT NULL,
    canonical_value_id uuid,
    canonical_value_min_id uuid,
    canonical_value_max_id uuid,
    display_text text,
    reference_text text,
    rule_type text DEFAULT 'RANGE'::text,
    actif boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lab_reference_rules_interpretation_check CHECK ((interpretation = ANY (ARRAY['NORMAL'::text, 'ABNORMAL HIGH'::text, 'ABNORMAL LOW'::text, 'CAUTION HIGH'::text, 'CAUTION LOW'::text, 'CAUTION'::text, 'ABNORMAL'::text])))
);


ALTER TABLE public.lab_reference_rules OWNER TO sahty;

--
-- Name: lab_section_tree; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_section_tree (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id uuid NOT NULL,
    sous_famille_id uuid NOT NULL,
    actif boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lab_section_tree OWNER TO sahty;

--
-- Name: lab_sections; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.lab_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    libelle text NOT NULL,
    description text,
    actif boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE reference.lab_sections OWNER TO sahty;

--
-- Name: lab_specimen_types; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.lab_specimen_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    libelle text NOT NULL,
    description text,
    actif boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    base_specimen text NOT NULL,
    matrix_type text NOT NULL
);


ALTER TABLE reference.lab_specimen_types OWNER TO sahty;

--
-- Name: lab_sub_section_tree; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE public.lab_sub_section_tree (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sub_section_id uuid NOT NULL,
    section_id uuid NOT NULL,
    actif boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lab_sub_section_tree OWNER TO sahty;

--
-- Name: lab_sub_sections; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.lab_sub_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    libelle text NOT NULL,
    description text,
    actif boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE reference.lab_sub_sections OWNER TO sahty;

--
-- Name: observation_flowsheets; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.observation_flowsheets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE reference.observation_flowsheets OWNER TO sahty;

--
-- Name: observation_groups; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.observation_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE reference.observation_groups OWNER TO sahty;

--
-- Name: observation_parameters; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.observation_parameters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    unit text,
    value_type text NOT NULL,
    normal_min numeric,
    normal_max numeric,
    warning_min numeric,
    warning_max numeric,
    hard_min numeric,
    hard_max numeric,
    is_hydric_input boolean DEFAULT false,
    is_hydric_output boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    unit_id uuid,
    source text DEFAULT 'manual'::text NOT NULL,
    CONSTRAINT chk_observation_source CHECK ((source = ANY (ARRAY['manual'::text, 'calculated'::text])))
);


ALTER TABLE reference.observation_parameters OWNER TO sahty;

--
-- Name: organismes; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.organismes (
    id uuid NOT NULL,
    designation text NOT NULL,
    category text NOT NULL,
    sub_type text,
    active boolean DEFAULT true,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE reference.organismes OWNER TO sahty;

--
-- Name: routes; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    requires_fluid_info boolean DEFAULT false NOT NULL
);


ALTER TABLE reference.routes OWNER TO sahty;

--
-- Name: sih_familles; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.sih_familles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    libelle text NOT NULL,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE reference.sih_familles OWNER TO sahty;

--
-- Name: sih_sous_familles; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.sih_sous_familles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    famille_id uuid NOT NULL,
    code text NOT NULL,
    libelle text NOT NULL,
    actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE reference.sih_sous_familles OWNER TO sahty;

--
-- Name: units; Type: TABLE; Schema: reference; Owner: sahty
--

CREATE TABLE reference.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    display text NOT NULL,
    is_ucum boolean DEFAULT false,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    requires_fluid_info boolean DEFAULT false NOT NULL
);


ALTER TABLE reference.units OWNER TO sahty;

--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: auth; Owner: sahty
--

ALTER TABLE ONLY auth.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (audit_id);


--
-- Name: credentials credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: sahty
--

ALTER TABLE ONLY auth.credentials
    ADD CONSTRAINT credentials_pkey PRIMARY KEY (credential_id);


--
-- Name: credentials credentials_user_id_key; Type: CONSTRAINT; Schema: auth; Owner: sahty
--

ALTER TABLE ONLY auth.credentials
    ADD CONSTRAINT credentials_user_id_key UNIQUE (user_id);


--
-- Name: user_tenants user_tenants_pkey; Type: CONSTRAINT; Schema: auth; Owner: sahty
--

ALTER TABLE ONLY auth.user_tenants
    ADD CONSTRAINT user_tenants_pkey PRIMARY KEY (user_id, tenant_id);


--
-- Name: users users_inpe_key; Type: CONSTRAINT; Schema: auth; Owner: sahty
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_inpe_key UNIQUE (inpe);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: sahty
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: auth; Owner: sahty
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: inbox_events inbox_events_pkey; Type: CONSTRAINT; Schema: auth_sync; Owner: sahty
--

ALTER TABLE ONLY auth_sync.inbox_events
    ADD CONSTRAINT inbox_events_pkey PRIMARY KEY (event_id);


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: auth_sync; Owner: sahty
--

ALTER TABLE ONLY auth_sync.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (event_id);


--
-- Name: sync_state sync_state_pkey; Type: CONSTRAINT; Schema: auth_sync; Owner: sahty
--

ALTER TABLE ONLY auth_sync.sync_state
    ADD CONSTRAINT sync_state_pkey PRIMARY KEY (id);


--
-- Name: inbox_events inbox_events_pkey; Type: CONSTRAINT; Schema: identity_sync; Owner: sahty
--

ALTER TABLE ONLY identity_sync.inbox_events
    ADD CONSTRAINT inbox_events_pkey PRIMARY KEY (inbox_event_id);


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: identity_sync; Owner: sahty
--

ALTER TABLE ONLY identity_sync.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (event_id);


--
-- Name: _migration_issues _migration_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public._migration_issues
    ADD CONSTRAINT _migration_issues_pkey PRIMARY KEY (id);


--
-- Name: actes actes_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.actes
    ADD CONSTRAINT actes_pkey PRIMARY KEY (id);


--
-- Name: administration_event_blood_bags administration_event_blood_bags_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.administration_event_blood_bags
    ADD CONSTRAINT administration_event_blood_bags_pkey PRIMARY KEY (id);


--
-- Name: administration_event_lab_collections administration_event_lab_coll_administration_event_id_lab_c_key; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.administration_event_lab_collections
    ADD CONSTRAINT administration_event_lab_coll_administration_event_id_lab_c_key UNIQUE (administration_event_id, lab_collection_id);


--
-- Name: administration_event_lab_collections administration_event_lab_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.administration_event_lab_collections
    ADD CONSTRAINT administration_event_lab_collections_pkey PRIMARY KEY (id);


--
-- Name: administration_event_pauses administration_event_pauses_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.administration_event_pauses
    ADD CONSTRAINT administration_event_pauses_pkey PRIMARY KEY (id);


--
-- Name: administration_events administration_events_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.administration_events
    ADD CONSTRAINT administration_events_pkey PRIMARY KEY (id);


--
-- Name: admission_acts admission_acts_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admission_acts
    ADD CONSTRAINT admission_acts_pkey PRIMARY KEY (id);


--
-- Name: admission_coverage_change_history admission_coverage_change_history_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admission_coverage_change_history
    ADD CONSTRAINT admission_coverage_change_history_pkey PRIMARY KEY (change_id);


--
-- Name: admission_coverage_members admission_coverage_members_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admission_coverage_members
    ADD CONSTRAINT admission_coverage_members_pkey PRIMARY KEY (admission_coverage_member_id);


--
-- Name: admission_coverages admission_coverages_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admission_coverages
    ADD CONSTRAINT admission_coverages_pkey PRIMARY KEY (admission_coverage_id);


--
-- Name: admissions admissions_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (audit_id);


--
-- Name: beds beds_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_pkey PRIMARY KEY (id);


--
-- Name: beds beds_room_id_label_key; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_room_id_label_key UNIQUE (room_id, label);


--
-- Name: clinical_exams clinical_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.clinical_exams
    ADD CONSTRAINT clinical_exams_pkey PRIMARY KEY (id);


--
-- Name: coverage_change_history coverage_change_history_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.coverage_change_history
    ADD CONSTRAINT coverage_change_history_pkey PRIMARY KEY (change_id);


--
-- Name: coverage_members coverage_members_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.coverage_members
    ADD CONSTRAINT coverage_members_pkey PRIMARY KEY (coverage_member_id);


--
-- Name: coverages coverages_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.coverages
    ADD CONSTRAINT coverages_pkey PRIMARY KEY (coverage_id);


--
-- Name: delivery_note_items delivery_note_items_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.delivery_note_items
    ADD CONSTRAINT delivery_note_items_pkey PRIMARY KEY (id);


--
-- Name: delivery_notes delivery_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_pkey PRIMARY KEY (delivery_note_id);


--
-- Name: escarre_snapshots escarre_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.escarre_snapshots
    ADD CONSTRAINT escarre_snapshots_pkey PRIMARY KEY (id);


--
-- Name: escarres escarres_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.escarres
    ADD CONSTRAINT escarres_pkey PRIMARY KEY (id);


--
-- Name: external_systems external_systems_code_key; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.external_systems
    ADD CONSTRAINT external_systems_code_key UNIQUE (code);


--
-- Name: external_systems external_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.external_systems
    ADD CONSTRAINT external_systems_pkey PRIMARY KEY (id);


--
-- Name: global_act_external_codes global_act_external_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.global_act_external_codes
    ADD CONSTRAINT global_act_external_codes_pkey PRIMARY KEY (id);


--
-- Name: identity_ids identity_ids_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.identity_ids
    ADD CONSTRAINT identity_ids_pkey PRIMARY KEY (identity_id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (movement_id);


--
-- Name: lab_analyte_external_codes lab_analyte_external_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_external_codes
    ADD CONSTRAINT lab_analyte_external_codes_pkey PRIMARY KEY (id);


--
-- Name: lab_collection_specimens lab_collection_specimens_lab_collection_id_specimen_id_key; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_collection_specimens
    ADD CONSTRAINT lab_collection_specimens_lab_collection_id_specimen_id_key UNIQUE (lab_collection_id, specimen_id);


--
-- Name: lab_collection_specimens lab_collection_specimens_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_collection_specimens
    ADD CONSTRAINT lab_collection_specimens_pkey PRIMARY KEY (id);


--
-- Name: lab_collections lab_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_collections
    ADD CONSTRAINT lab_collections_pkey PRIMARY KEY (id);


--
-- Name: lab_hprim_links lab_hprim_links_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_hprim_links
    ADD CONSTRAINT lab_hprim_links_pkey PRIMARY KEY (id);


--
-- Name: lab_hprim_messages lab_hprim_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_hprim_messages
    ADD CONSTRAINT lab_hprim_messages_pkey PRIMARY KEY (id);


--
-- Name: lab_requests lab_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_requests
    ADD CONSTRAINT lab_requests_pkey PRIMARY KEY (id);


--
-- Name: lab_specimen_requests lab_specimen_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_specimen_requests
    ADD CONSTRAINT lab_specimen_requests_pkey PRIMARY KEY (id);


--
-- Name: lab_specimen_requests lab_specimen_requests_specimen_id_lab_request_id_key; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_specimen_requests
    ADD CONSTRAINT lab_specimen_requests_specimen_id_lab_request_id_key UNIQUE (specimen_id, lab_request_id);


--
-- Name: lab_specimen_status_history lab_specimen_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_specimen_status_history
    ADD CONSTRAINT lab_specimen_status_history_pkey PRIMARY KEY (id);


--
-- Name: lab_specimens lab_specimens_barcode_key; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_specimens
    ADD CONSTRAINT lab_specimens_barcode_key UNIQUE (barcode);


--
-- Name: lab_specimens lab_specimens_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_specimens
    ADD CONSTRAINT lab_specimens_pkey PRIMARY KEY (id);


--
-- Name: lab_unit_external_codes lab_unit_external_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_unit_external_codes
    ADD CONSTRAINT lab_unit_external_codes_pkey PRIMARY KEY (id);


--
-- Name: lab_value_normalization lab_value_normalization_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_value_normalization
    ADD CONSTRAINT lab_value_normalization_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (location_id);


--
-- Name: medication_dispense_events medication_dispense_events_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.medication_dispense_events
    ADD CONSTRAINT medication_dispense_events_pkey PRIMARY KEY (id);


--
-- Name: patient_addiction_history patient_addiction_history_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_addiction_history
    ADD CONSTRAINT patient_addiction_history_pkey PRIMARY KEY (id);


--
-- Name: patient_addictions patient_addictions_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_addictions
    ADD CONSTRAINT patient_addictions_pkey PRIMARY KEY (id);


--
-- Name: patient_addresses patient_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_addresses
    ADD CONSTRAINT patient_addresses_pkey PRIMARY KEY (address_id);


--
-- Name: patient_allergies patient_allergies_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_pkey PRIMARY KEY (id);


--
-- Name: patient_allergy_history patient_allergy_history_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_allergy_history
    ADD CONSTRAINT patient_allergy_history_pkey PRIMARY KEY (id);


--
-- Name: patient_allergy_manifestations patient_allergy_manifestation_patient_allergy_id_manifestat_key; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_allergy_manifestations
    ADD CONSTRAINT patient_allergy_manifestation_patient_allergy_id_manifestat_key UNIQUE (patient_allergy_id, manifestation_code);


--
-- Name: patient_allergy_manifestations patient_allergy_manifestations_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_allergy_manifestations
    ADD CONSTRAINT patient_allergy_manifestations_pkey PRIMARY KEY (id);


--
-- Name: patient_contacts patient_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_contacts
    ADD CONSTRAINT patient_contacts_pkey PRIMARY KEY (contact_id);


--
-- Name: patient_diagnoses patient_diagnoses_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_diagnoses
    ADD CONSTRAINT patient_diagnoses_pkey PRIMARY KEY (id);


--
-- Name: patient_documents patient_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_documents
    ADD CONSTRAINT patient_documents_pkey PRIMARY KEY (id);


--
-- Name: patient_ecg_records patient_ecg_records_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_ecg_records
    ADD CONSTRAINT patient_ecg_records_pkey PRIMARY KEY (id);


--
-- Name: patient_echo_records patient_echo_records_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_echo_records
    ADD CONSTRAINT patient_echo_records_pkey PRIMARY KEY (id);


--
-- Name: patient_identity_change patient_identity_change_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_identity_change
    ADD CONSTRAINT patient_identity_change_pkey PRIMARY KEY (change_id);


--
-- Name: patient_lab_extraction_sessions patient_lab_extraction_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_extraction_sessions
    ADD CONSTRAINT patient_lab_extraction_sessions_pkey PRIMARY KEY (id);


--
-- Name: patient_lab_report_documents patient_lab_report_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_report_documents
    ADD CONSTRAINT patient_lab_report_documents_pkey PRIMARY KEY (id);


--
-- Name: patient_lab_report_tests patient_lab_report_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_report_tests
    ADD CONSTRAINT patient_lab_report_tests_pkey PRIMARY KEY (id);


--
-- Name: patient_lab_reports patient_lab_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_reports
    ADD CONSTRAINT patient_lab_reports_pkey PRIMARY KEY (id);


--
-- Name: patient_lab_results patient_lab_results_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_results
    ADD CONSTRAINT patient_lab_results_pkey PRIMARY KEY (id);


--
-- Name: patient_observations patient_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_observations
    ADD CONSTRAINT patient_observations_pkey PRIMARY KEY (id);


--
-- Name: patient_relationship_links patient_relationship_links_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_relationship_links
    ADD CONSTRAINT patient_relationship_links_pkey PRIMARY KEY (relationship_id);


--
-- Name: patient_stays patient_stays_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_stays
    ADD CONSTRAINT patient_stays_pkey PRIMARY KEY (id);


--
-- Name: patient_tenant_merge_events patient_tenant_merge_events_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_tenant_merge_events
    ADD CONSTRAINT patient_tenant_merge_events_pkey PRIMARY KEY (merge_event_id);


--
-- Name: patients_tenant patients_tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patients_tenant
    ADD CONSTRAINT patients_tenant_pkey PRIMARY KEY (tenant_patient_id);


--
-- Name: po_items po_items_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.po_items
    ADD CONSTRAINT po_items_pkey PRIMARY KEY (po_id, product_id);


--
-- Name: prescription_events prescription_events_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.prescription_events
    ADD CONSTRAINT prescription_events_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: product_configs product_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.product_configs
    ADD CONSTRAINT product_configs_pkey PRIMARY KEY (tenant_id, product_id);


--
-- Name: product_price_versions product_price_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.product_price_versions
    ADD CONSTRAINT product_price_versions_pkey PRIMARY KEY (id);


--
-- Name: product_suppliers product_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_pkey PRIMARY KEY (id);


--
-- Name: product_suppliers product_suppliers_tenant_id_product_id_supplier_id_key; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.product_suppliers
    ADD CONSTRAINT product_suppliers_tenant_id_product_id_supplier_id_key UNIQUE (tenant_id, product_id, supplier_id);


--
-- Name: product_wac product_wac_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.product_wac
    ADD CONSTRAINT product_wac_pkey PRIMARY KEY (tenant_id, product_id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (po_id);


--
-- Name: reference_schema_version reference_schema_version_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.reference_schema_version
    ADD CONSTRAINT reference_schema_version_pkey PRIMARY KEY (id);


--
-- Name: return_decision_lines return_decision_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.return_decision_lines
    ADD CONSTRAINT return_decision_lines_pkey PRIMARY KEY (id);


--
-- Name: return_decisions return_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.return_decisions
    ADD CONSTRAINT return_decisions_pkey PRIMARY KEY (id);


--
-- Name: return_reception_lines return_reception_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.return_reception_lines
    ADD CONSTRAINT return_reception_lines_pkey PRIMARY KEY (id);


--
-- Name: return_receptions return_receptions_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.return_receptions
    ADD CONSTRAINT return_receptions_pkey PRIMARY KEY (id);


--
-- Name: room_types room_types_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.room_types
    ADD CONSTRAINT room_types_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: service_units service_units_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.service_units
    ADD CONSTRAINT service_units_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: smart_phrases smart_phrases_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.smart_phrases
    ADD CONSTRAINT smart_phrases_pkey PRIMARY KEY (id);


--
-- Name: stock_demand_lines stock_demand_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_demand_lines
    ADD CONSTRAINT stock_demand_lines_pkey PRIMARY KEY (id);


--
-- Name: stock_demands stock_demands_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_demands
    ADD CONSTRAINT stock_demands_pkey PRIMARY KEY (id);


--
-- Name: stock_reservation_lines stock_reservation_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_reservation_lines
    ADD CONSTRAINT stock_reservation_lines_pkey PRIMARY KEY (id);


--
-- Name: stock_reservations stock_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_pkey PRIMARY KEY (reservation_id);


--
-- Name: stock_return_lines stock_return_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_return_lines
    ADD CONSTRAINT stock_return_lines_pkey PRIMARY KEY (id);


--
-- Name: stock_returns stock_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_returns
    ADD CONSTRAINT stock_returns_pkey PRIMARY KEY (id);


--
-- Name: stock_transfer_lines stock_transfer_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_transfer_lines
    ADD CONSTRAINT stock_transfer_lines_pkey PRIMARY KEY (id);


--
-- Name: stock_transfers stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (supplier_id);


--
-- Name: surveillance_hour_buckets surveillance_hour_buckets_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.surveillance_hour_buckets
    ADD CONSTRAINT surveillance_hour_buckets_pkey PRIMARY KEY (id);


--
-- Name: surveillance_hour_buckets surveillance_hour_buckets_tenant_id_tenant_patient_id_bucke_key; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.surveillance_hour_buckets
    ADD CONSTRAINT surveillance_hour_buckets_tenant_id_tenant_patient_id_bucke_key UNIQUE (tenant_id, tenant_patient_id, bucket_start);


--
-- Name: surveillance_values_events surveillance_values_events_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.surveillance_values_events
    ADD CONSTRAINT surveillance_values_events_pkey PRIMARY KEY (id);


--
-- Name: transfusion_blood_bags transfusion_blood_bags_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.transfusion_blood_bags
    ADD CONSTRAINT transfusion_blood_bags_pkey PRIMARY KEY (id);


--
-- Name: transfusion_checks transfusion_checks_administration_event_id_key; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.transfusion_checks
    ADD CONSTRAINT transfusion_checks_administration_event_id_key UNIQUE (administration_event_id);


--
-- Name: transfusion_checks transfusion_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.transfusion_checks
    ADD CONSTRAINT transfusion_checks_pkey PRIMARY KEY (id);


--
-- Name: transfusion_reactions transfusion_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.transfusion_reactions
    ADD CONSTRAINT transfusion_reactions_pkey PRIMARY KEY (id);


--
-- Name: global_act_external_codes unique_mapping; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.global_act_external_codes
    ADD CONSTRAINT unique_mapping UNIQUE (global_act_id, external_system_id, external_code);


--
-- Name: current_stock uq_current_stock_natural_key; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.current_stock
    ADD CONSTRAINT uq_current_stock_natural_key UNIQUE (tenant_id, product_id, lot, expiry, location_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: user_services user_services_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.user_services
    ADD CONSTRAINT user_services_pkey PRIMARY KEY (user_id, service_id);


--
-- Name: care_categories care_categories_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.care_categories
    ADD CONSTRAINT care_categories_code_key UNIQUE (code);


--
-- Name: care_categories care_categories_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.care_categories
    ADD CONSTRAINT care_categories_pkey PRIMARY KEY (id);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (country_id);


--
-- Name: dci_synonyms dci_synonyms_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.dci_synonyms
    ADD CONSTRAINT dci_synonyms_pkey PRIMARY KEY (id);


--
-- Name: flowsheet_groups flowsheet_groups_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.flowsheet_groups
    ADD CONSTRAINT flowsheet_groups_pkey PRIMARY KEY (flowsheet_id, group_id);


--
-- Name: global_actes global_actes_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_actes
    ADD CONSTRAINT global_actes_pkey PRIMARY KEY (id);


--
-- Name: global_atc global_atc_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_atc
    ADD CONSTRAINT global_atc_pkey PRIMARY KEY (code);


--
-- Name: global_dci global_dci_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_dci
    ADD CONSTRAINT global_dci_pkey PRIMARY KEY (id);


--
-- Name: global_emdn global_emdn_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_emdn
    ADD CONSTRAINT global_emdn_pkey PRIMARY KEY (code);


--
-- Name: global_product_price_history global_product_price_history_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_product_price_history
    ADD CONSTRAINT global_product_price_history_pkey PRIMARY KEY (id);


--
-- Name: global_products global_products_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_products
    ADD CONSTRAINT global_products_pkey PRIMARY KEY (id);


--
-- Name: global_roles global_roles_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_roles
    ADD CONSTRAINT global_roles_pkey PRIMARY KEY (id);


--
-- Name: global_suppliers global_suppliers_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_suppliers
    ADD CONSTRAINT global_suppliers_pkey PRIMARY KEY (id);


--
-- Name: group_parameters group_parameters_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.group_parameters
    ADD CONSTRAINT group_parameters_pkey PRIMARY KEY (group_id, parameter_id);


--
-- Name: identity_document_types identity_document_types_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.identity_document_types
    ADD CONSTRAINT identity_document_types_pkey PRIMARY KEY (code);


--
-- Name: lab_act_analyte_context lab_act_analyte_context_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_analyte_context
    ADD CONSTRAINT lab_act_analyte_context_pkey PRIMARY KEY (id);


--
-- Name: lab_act_analytes lab_act_analytes_act_analyte_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_analytes
    ADD CONSTRAINT lab_act_analytes_act_analyte_key UNIQUE (global_act_id, analyte_id);


--
-- Name: lab_act_analytes lab_act_analytes_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_analytes
    ADD CONSTRAINT lab_act_analytes_pkey PRIMARY KEY (id);


--
-- Name: lab_act_contexts lab_act_contexts_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_contexts
    ADD CONSTRAINT lab_act_contexts_pkey PRIMARY KEY (id);


--
-- Name: lab_act_methods lab_act_methods_act_method_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_methods
    ADD CONSTRAINT lab_act_methods_act_method_key UNIQUE (global_act_id, method_id);


--
-- Name: lab_act_methods lab_act_methods_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_methods
    ADD CONSTRAINT lab_act_methods_pkey PRIMARY KEY (id);


--
-- Name: lab_act_specimen_containers lab_act_spec_cont_unique; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_specimen_containers
    ADD CONSTRAINT lab_act_spec_cont_unique UNIQUE (global_act_id, specimen_type_id, container_type_id);


--
-- Name: lab_act_specimen_containers lab_act_specimen_containers_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_specimen_containers
    ADD CONSTRAINT lab_act_specimen_containers_pkey PRIMARY KEY (id);


--
-- Name: lab_act_specimen_types lab_act_specimen_types_act_specimen_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_specimen_types
    ADD CONSTRAINT lab_act_specimen_types_act_specimen_key UNIQUE (global_act_id, specimen_type_id);


--
-- Name: lab_act_specimen_types lab_act_specimen_types_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_specimen_types
    ADD CONSTRAINT lab_act_specimen_types_pkey PRIMARY KEY (id);


--
-- Name: lab_act_taxonomy lab_act_taxonomy_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_taxonomy
    ADD CONSTRAINT lab_act_taxonomy_pkey PRIMARY KEY (id);


--
-- Name: lab_analyte_aliases lab_analyte_aliases_analyte_alias_type_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_aliases
    ADD CONSTRAINT lab_analyte_aliases_analyte_alias_type_key UNIQUE (analyte_id, alias_text, alias_type);


--
-- Name: lab_analyte_aliases lab_analyte_aliases_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_aliases
    ADD CONSTRAINT lab_analyte_aliases_pkey PRIMARY KEY (id);


--
-- Name: lab_analyte_contexts lab_analyte_contexts_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_contexts
    ADD CONSTRAINT lab_analyte_contexts_pkey PRIMARY KEY (id);


--
-- Name: lab_analyte_reference_ranges lab_analyte_reference_ranges_pkey; Type: CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_reference_ranges
    ADD CONSTRAINT lab_analyte_reference_ranges_pkey PRIMARY KEY (id);


--
-- Name: lab_analyte_units lab_analyte_units_analyte_unit_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_units
    ADD CONSTRAINT lab_analyte_units_analyte_unit_key UNIQUE (analyte_id, unit_id);


--
-- Name: lab_analyte_units lab_analyte_units_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_units
    ADD CONSTRAINT lab_analyte_units_pkey PRIMARY KEY (id);


--
-- Name: lab_analytes lab_analytes_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.lab_analytes
    ADD CONSTRAINT lab_analytes_code_key UNIQUE (code);


--
-- Name: lab_analytes lab_analytes_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.lab_analytes
    ADD CONSTRAINT lab_analytes_pkey PRIMARY KEY (id);


--
-- Name: lab_canonical_allowed_values lab_canonical_allowed_values_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.lab_canonical_allowed_values
    ADD CONSTRAINT lab_canonical_allowed_values_code_key UNIQUE (code);


--
-- Name: lab_canonical_allowed_values lab_canonical_allowed_values_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.lab_canonical_allowed_values
    ADD CONSTRAINT lab_canonical_allowed_values_pkey PRIMARY KEY (id);


--
-- Name: lab_container_types lab_container_types_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.lab_container_types
    ADD CONSTRAINT lab_container_types_code_key UNIQUE (code);


--
-- Name: lab_container_types lab_container_types_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.lab_container_types
    ADD CONSTRAINT lab_container_types_pkey PRIMARY KEY (id);


--
-- Name: lab_methods lab_methods_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.lab_methods
    ADD CONSTRAINT lab_methods_code_key UNIQUE (code);


--
-- Name: lab_methods lab_methods_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.lab_methods
    ADD CONSTRAINT lab_methods_pkey PRIMARY KEY (id);


--
-- Name: lab_panel_items lab_panel_items_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_panel_items
    ADD CONSTRAINT lab_panel_items_pkey PRIMARY KEY (id);


--
-- Name: lab_panels lab_panels_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_panels
    ADD CONSTRAINT lab_panels_code_key UNIQUE (code);


--
-- Name: lab_panels lab_panels_global_act_id_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_panels
    ADD CONSTRAINT lab_panels_global_act_id_key UNIQUE (global_act_id);


--
-- Name: lab_panels lab_panels_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_panels
    ADD CONSTRAINT lab_panels_pkey PRIMARY KEY (id);


--
-- Name: lab_reference_profiles lab_reference_profiles_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_reference_profiles
    ADD CONSTRAINT lab_reference_profiles_pkey PRIMARY KEY (id);


--
-- Name: lab_reference_rules lab_reference_rules_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_reference_rules
    ADD CONSTRAINT lab_reference_rules_pkey PRIMARY KEY (id);


--
-- Name: lab_section_tree lab_section_tree_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_section_tree
    ADD CONSTRAINT lab_section_tree_pkey PRIMARY KEY (id);


--
-- Name: lab_sections lab_sections_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.lab_sections
    ADD CONSTRAINT lab_sections_pkey PRIMARY KEY (id);


--
-- Name: lab_specimen_types lab_specimen_types_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.lab_specimen_types
    ADD CONSTRAINT lab_specimen_types_code_key UNIQUE (code);


--
-- Name: lab_specimen_types lab_specimen_types_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.lab_specimen_types
    ADD CONSTRAINT lab_specimen_types_pkey PRIMARY KEY (id);


--
-- Name: lab_sub_section_tree lab_sub_section_tree_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_sub_section_tree
    ADD CONSTRAINT lab_sub_section_tree_pkey PRIMARY KEY (id);


--
-- Name: lab_sub_sections lab_sub_sections_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.lab_sub_sections
    ADD CONSTRAINT lab_sub_sections_pkey PRIMARY KEY (id);


--
-- Name: observation_flowsheets observation_flowsheets_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.observation_flowsheets
    ADD CONSTRAINT observation_flowsheets_code_key UNIQUE (code);


--
-- Name: observation_flowsheets observation_flowsheets_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.observation_flowsheets
    ADD CONSTRAINT observation_flowsheets_pkey PRIMARY KEY (id);


--
-- Name: observation_groups observation_groups_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.observation_groups
    ADD CONSTRAINT observation_groups_code_key UNIQUE (code);


--
-- Name: observation_groups observation_groups_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.observation_groups
    ADD CONSTRAINT observation_groups_pkey PRIMARY KEY (id);


--
-- Name: observation_parameters observation_parameters_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.observation_parameters
    ADD CONSTRAINT observation_parameters_code_key UNIQUE (code);


--
-- Name: observation_parameters observation_parameters_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.observation_parameters
    ADD CONSTRAINT observation_parameters_pkey PRIMARY KEY (id);


--
-- Name: organismes organismes_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.organismes
    ADD CONSTRAINT organismes_pkey PRIMARY KEY (id);


--
-- Name: global_actes ref_global_actes_code_sih_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_actes
    ADD CONSTRAINT ref_global_actes_code_sih_key UNIQUE (code_sih);


--
-- Name: routes routes_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.routes
    ADD CONSTRAINT routes_code_key UNIQUE (code);


--
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


--
-- Name: sih_familles sih_familles_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.sih_familles
    ADD CONSTRAINT sih_familles_code_key UNIQUE (code);


--
-- Name: sih_familles sih_familles_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.sih_familles
    ADD CONSTRAINT sih_familles_pkey PRIMARY KEY (id);


--
-- Name: sih_sous_familles sih_sous_familles_famille_id_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.sih_sous_familles
    ADD CONSTRAINT sih_sous_familles_famille_id_code_key UNIQUE (famille_id, code);


--
-- Name: sih_sous_familles sih_sous_familles_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.sih_sous_familles
    ADD CONSTRAINT sih_sous_familles_pkey PRIMARY KEY (id);


-- lab_specimen_container_types removed


--
-- Name: units units_code_key; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.units
    ADD CONSTRAINT units_code_key UNIQUE (code);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: lab_act_analyte_context uq_act_analyte_ctx; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_analyte_context
    ADD CONSTRAINT uq_act_analyte_ctx UNIQUE (global_act_id, analyte_context_id);


--
-- Name: lab_act_taxonomy uq_act_id; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_taxonomy
    ADD CONSTRAINT uq_act_id UNIQUE (act_id);


--
-- Name: lab_section_tree uq_section_sous_famille; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_section_tree
    ADD CONSTRAINT uq_section_sous_famille UNIQUE (section_id, sous_famille_id);


--
-- Name: lab_sub_section_tree uq_sub_section_section; Type: CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_sub_section_tree
    ADD CONSTRAINT uq_sub_section_section UNIQUE (sub_section_id, section_id);


--
-- Name: idx_auth_inbox_unapplied; Type: INDEX; Schema: auth_sync; Owner: sahty
--

CREATE INDEX idx_auth_inbox_unapplied ON auth_sync.inbox_events USING btree (created_at) WHERE (applied_at IS NULL);


--
-- Name: idx_auth_outbox_unprocessed; Type: INDEX; Schema: auth_sync; Owner: sahty
--

CREATE INDEX idx_auth_outbox_unprocessed ON auth_sync.outbox_events USING btree (created_at) WHERE (processed_at IS NULL);


--
-- Name: idx_inbox_dedupe; Type: INDEX; Schema: identity_sync; Owner: sahty
--

CREATE UNIQUE INDEX idx_inbox_dedupe ON identity_sync.inbox_events USING btree (dedupe_key);


--
-- Name: idx_inbox_processing; Type: INDEX; Schema: identity_sync; Owner: sahty
--

CREATE INDEX idx_inbox_processing ON identity_sync.inbox_events USING btree (status);


--
-- Name: idx_outbox_dedupe; Type: INDEX; Schema: identity_sync; Owner: sahty
--

CREATE UNIQUE INDEX idx_outbox_dedupe ON identity_sync.outbox_events USING btree (dedupe_key);


--
-- Name: idx_outbox_processing; Type: INDEX; Schema: identity_sync; Owner: sahty
--

CREATE INDEX idx_outbox_processing ON identity_sync.outbox_events USING btree (status, next_attempt_at);


--
-- Name: idx_addiction_history_addiction; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_addiction_history_addiction ON public.patient_addiction_history USING btree (addiction_id);


--
-- Name: idx_addiction_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_addiction_patient ON public.patient_addictions USING btree (tenant_patient_id);


--
-- Name: idx_adm_cov_admission; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_adm_cov_admission ON public.admission_coverages USING btree (tenant_id, admission_id);


--
-- Name: idx_adm_cov_coverage; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_adm_cov_coverage ON public.admission_coverages USING btree (tenant_id, coverage_id);


--
-- Name: idx_adm_cov_order; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_adm_cov_order ON public.admission_coverages USING btree (tenant_id, admission_id, filing_order);


--
-- Name: idx_adm_hist_admission; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_adm_hist_admission ON public.admission_coverage_change_history USING btree (tenant_id, admission_id);


--
-- Name: idx_adm_hist_coverage; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_adm_hist_coverage ON public.admission_coverage_change_history USING btree (tenant_id, admission_coverage_id);


--
-- Name: idx_adm_hist_date; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_adm_hist_date ON public.admission_coverage_change_history USING btree (tenant_id, changed_at DESC);


--
-- Name: idx_adm_mem_coverage; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_adm_mem_coverage ON public.admission_coverage_members USING btree (tenant_id, admission_coverage_id);


--
-- Name: idx_adm_mem_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_adm_mem_patient ON public.admission_coverage_members USING btree (tenant_id, tenant_patient_id);


--
-- Name: idx_admin_event_action; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admin_event_action ON public.administration_events USING btree (action_type);


--
-- Name: idx_admin_event_blood_bags_bag; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admin_event_blood_bags_bag ON public.administration_event_blood_bags USING btree (tenant_id, blood_bag_id);


--
-- Name: idx_admin_event_blood_bags_event; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admin_event_blood_bags_event ON public.administration_event_blood_bags USING btree (tenant_id, administration_event_id);


--
-- Name: idx_admin_event_blood_bags_unique; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_admin_event_blood_bags_unique ON public.administration_event_blood_bags USING btree (tenant_id, administration_event_id, blood_bag_id);


--
-- Name: idx_admin_event_lab_collections_admin_event_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admin_event_lab_collections_admin_event_id ON public.administration_event_lab_collections USING btree (administration_event_id);


--
-- Name: idx_admin_event_lab_collections_collection_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admin_event_lab_collections_collection_id ON public.administration_event_lab_collections USING btree (lab_collection_id);


--
-- Name: idx_admin_event_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admin_event_status ON public.administration_events USING btree (status);


--
-- Name: idx_admin_events_by_presc_event_time; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admin_events_by_presc_event_time ON public.administration_events USING btree (tenant_id, prescription_event_id, occurred_at);


--
-- Name: idx_admin_events_fluid; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admin_events_fluid ON public.administration_events USING btree (tenant_patient_id, actual_end_at) WHERE (volume_administered_ml IS NOT NULL);


--
-- Name: idx_admin_events_patient_end; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admin_events_patient_end ON public.administration_events USING btree (tenant_patient_id, actual_end_at) WHERE (actual_end_at IS NOT NULL);


--
-- Name: idx_admin_events_patient_start; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admin_events_patient_start ON public.administration_events USING btree (tenant_patient_id, actual_start_at) WHERE (actual_start_at IS NOT NULL);


--
-- Name: idx_admission_acts_admission_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admission_acts_admission_id ON public.admission_acts USING btree (admission_id);


--
-- Name: idx_admission_acts_global_act_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admission_acts_global_act_id ON public.admission_acts USING btree (global_act_id);


--
-- Name: idx_admission_acts_lab_request_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admission_acts_lab_request_id ON public.admission_acts USING btree (lab_request_id);


--
-- Name: idx_admissions_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_admissions_tenant ON public.admissions USING btree (tenant_id);


--
-- Name: idx_aebb_blood_bag; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_aebb_blood_bag ON public.administration_event_blood_bags USING btree (blood_bag_id);


--
-- Name: idx_beds_room; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_beds_room ON public.beds USING btree (room_id);


--
-- Name: idx_beds_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_beds_status ON public.beds USING btree (status) WHERE (status = 'AVAILABLE'::public.bed_status);


--
-- Name: idx_clinical_exams_patient_status_date; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_clinical_exams_patient_status_date ON public.clinical_exams USING btree (tenant_patient_id, status, observed_at DESC);


--
-- Name: idx_config_enabled; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_config_enabled ON public.product_configs USING btree (tenant_id, is_enabled) WHERE (is_enabled = true);


--
-- Name: idx_coverage_history_coverage; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_coverage_history_coverage ON public.coverage_change_history USING btree (tenant_id, coverage_id);


--
-- Name: idx_coverage_history_date; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_coverage_history_date ON public.coverage_change_history USING btree (tenant_id, changed_at DESC);


--
-- Name: idx_coverage_history_member; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_coverage_history_member ON public.coverage_change_history USING btree (tenant_id, coverage_member_id);


--
-- Name: idx_coverages_lookup; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_coverages_lookup ON public.coverages USING btree (tenant_id, organisme_id, policy_number);


--
-- Name: idx_decision_lines_decision; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_decision_lines_decision ON public.return_decision_lines USING btree (decision_id);


--
-- Name: idx_decision_lines_return_line; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_decision_lines_return_line ON public.return_decision_lines USING btree (return_line_id);


--
-- Name: idx_decisions_reception; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_decisions_reception ON public.return_decisions USING btree (reception_id);


--
-- Name: idx_demand_line_demand; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_demand_line_demand ON public.stock_demand_lines USING btree (demand_id);


--
-- Name: idx_demand_ref; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_demand_ref ON public.stock_demands USING btree (demand_ref);


--
-- Name: idx_demand_service; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_demand_service ON public.stock_demands USING btree (service_id);


--
-- Name: idx_demand_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_demand_status ON public.stock_demands USING btree (status);


--
-- Name: idx_demand_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_demand_tenant ON public.stock_demands USING btree (tenant_id);


--
-- Name: idx_dn_supplier; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_dn_supplier ON public.delivery_notes USING btree (supplier_id);


--
-- Name: idx_dn_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_dn_tenant ON public.delivery_notes USING btree (tenant_id);


--
-- Name: idx_dni_dn; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_dni_dn ON public.delivery_note_items USING btree (delivery_note_id);


--
-- Name: idx_dnl_dn; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_dnl_dn ON public.delivery_note_layers USING btree (delivery_note_id);


--
-- Name: idx_dnl_product; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_dnl_product ON public.delivery_note_layers USING btree (product_id);


--
-- Name: idx_ecg_records_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_ecg_records_patient ON public.patient_ecg_records USING btree (tenant_patient_id, exam_date DESC, exam_time DESC);


--
-- Name: idx_ecg_records_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_ecg_records_tenant ON public.patient_ecg_records USING btree (tenant_id, tenant_patient_id);


--
-- Name: idx_echo_records_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_echo_records_patient ON public.patient_echo_records USING btree (tenant_patient_id, exam_date DESC, exam_time DESC);


--
-- Name: idx_echo_records_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_echo_records_tenant ON public.patient_echo_records USING btree (tenant_id, tenant_patient_id);


--
-- Name: idx_escarre_snapshots_lookup; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_escarre_snapshots_lookup ON public.escarre_snapshots USING btree (tenant_id, escarre_id, recorded_at DESC);


--
-- Name: idx_escarres_active; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_escarres_active ON public.escarres USING btree (tenant_id, tenant_patient_id, is_active);


--
-- Name: idx_escarres_created_at; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_escarres_created_at ON public.escarres USING btree (tenant_id, created_at);


--
-- Name: idx_escarres_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_escarres_patient ON public.escarres USING btree (tenant_id, tenant_patient_id);


--
-- Name: idx_gact_external_codes_act; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_gact_external_codes_act ON public.global_act_external_codes USING btree (global_act_id);


--
-- Name: idx_gact_external_codes_system; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_gact_external_codes_system ON public.global_act_external_codes USING btree (external_system_id);


--
-- Name: idx_identity_change_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_identity_change_patient ON public.patient_identity_change USING btree (tenant_id, tenant_patient_id);


--
-- Name: idx_identity_ids_lookup; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_identity_ids_lookup ON public.identity_ids USING btree (tenant_id, identity_type_code, identity_value);


--
-- Name: idx_identity_ids_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_identity_ids_patient ON public.identity_ids USING btree (tenant_id, tenant_patient_id);


--
-- Name: idx_inv_doc; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_inv_doc ON public.inventory_movements USING btree (document_type, document_id);


--
-- Name: idx_inv_product; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_inv_product ON public.inventory_movements USING btree (product_id);


--
-- Name: idx_inv_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_inv_tenant ON public.inventory_movements USING btree (tenant_id);


--
-- Name: idx_lab_analyte_ext_codes_code; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_analyte_ext_codes_code ON public.lab_analyte_external_codes USING btree (external_code, external_system_id);


--
-- Name: idx_lab_analyte_ext_codes_system; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_analyte_ext_codes_system ON public.lab_analyte_external_codes USING btree (external_system_id);


--
-- Name: idx_lab_analyte_ext_codes_unique; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_lab_analyte_ext_codes_unique ON public.lab_analyte_external_codes USING btree (analyte_id, external_system_id, external_code);


--
-- Name: idx_lab_collection_specimens_collection_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_collection_specimens_collection_id ON public.lab_collection_specimens USING btree (lab_collection_id);


--
-- Name: idx_lab_collection_specimens_specimen_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_collection_specimens_specimen_id ON public.lab_collection_specimens USING btree (specimen_id);


--
-- Name: idx_lab_collections_admission_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_collections_admission_id ON public.lab_collections USING btree (admission_id);


--
-- Name: idx_lab_collections_tenant_patient_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_collections_tenant_patient_id ON public.lab_collections USING btree (tenant_patient_id);


--
-- Name: idx_lab_doc_document; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_doc_document ON public.patient_lab_report_documents USING btree (document_id);


--
-- Name: idx_lab_doc_report; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_doc_report ON public.patient_lab_report_documents USING btree (patient_lab_report_id);


--
-- Name: idx_lab_hprim_links_message; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_hprim_links_message ON public.lab_hprim_links USING btree (hprim_message_id);


--
-- Name: idx_lab_hprim_links_order_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_lab_hprim_links_order_id ON public.lab_hprim_links USING btree (hprim_order_id);


--
-- Name: idx_lab_hprim_links_request; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_hprim_links_request ON public.lab_hprim_links USING btree (lab_request_id);


--
-- Name: idx_lab_hprim_messages_direction; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_hprim_messages_direction ON public.lab_hprim_messages USING btree (direction);


--
-- Name: idx_lab_hprim_messages_file_name; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_lab_hprim_messages_file_name ON public.lab_hprim_messages USING btree (file_name);


--
-- Name: idx_lab_hprim_messages_message_type; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_hprim_messages_message_type ON public.lab_hprim_messages USING btree (message_type);


--
-- Name: idx_lab_hprim_messages_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_hprim_messages_status ON public.lab_hprim_messages USING btree (status);


--
-- Name: idx_lab_requests_admission; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_requests_admission ON public.lab_requests USING btree (admission_id);


--
-- Name: idx_lab_requests_event; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_requests_event ON public.lab_requests USING btree (prescription_event_id);


--
-- Name: idx_lab_requests_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_requests_patient ON public.lab_requests USING btree (tenant_patient_id);


--
-- Name: idx_lab_specimen_requests_lab_request_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_specimen_requests_lab_request_id ON public.lab_specimen_requests USING btree (lab_request_id);


--
-- Name: idx_lab_specimen_requests_specimen_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_specimen_requests_specimen_id ON public.lab_specimen_requests USING btree (specimen_id);


--
-- Name: idx_lab_specimen_status_history_specimen_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_specimen_status_history_specimen_id ON public.lab_specimen_status_history USING btree (specimen_id);


--
-- Name: idx_lab_specimens_barcode_unique; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_lab_specimens_barcode_unique ON public.lab_specimens USING btree (barcode);


--
-- Name: idx_lab_unit_ext_codes_code; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_unit_ext_codes_code ON public.lab_unit_external_codes USING btree (external_code, external_system_id);


--
-- Name: idx_lab_unit_ext_codes_system; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_unit_ext_codes_system ON public.lab_unit_external_codes USING btree (external_system_id);


--
-- Name: idx_lab_unit_ext_codes_unique; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_lab_unit_ext_codes_unique ON public.lab_unit_external_codes USING btree (unit_id, external_system_id, external_code);


--
-- Name: idx_lab_value_normalization_lookup; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_lab_value_normalization_lookup ON public.lab_value_normalization USING btree (lower(raw_value));


--
-- Name: idx_locations_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_locations_tenant ON public.locations USING btree (tenant_id);


--
-- Name: idx_merge_events_source; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_merge_events_source ON public.patient_tenant_merge_events USING btree (source_tenant_patient_id);


--
-- Name: idx_merge_events_target; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_merge_events_target ON public.patient_tenant_merge_events USING btree (target_tenant_patient_id);


--
-- Name: idx_merge_events_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_merge_events_tenant ON public.patient_tenant_merge_events USING btree (tenant_id);


--
-- Name: idx_observations_addiction; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_observations_addiction ON public.patient_observations USING btree (linked_addiction_id);


--
-- Name: idx_patient_active_allergies; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_active_allergies ON public.patient_allergies USING btree (tenant_patient_id) WHERE (status = 'ACTIVE'::text);


--
-- Name: idx_patient_allergies_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_allergies_patient ON public.patient_allergies USING btree (tenant_patient_id, status);


--
-- Name: idx_patient_allergies_patient_dci; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_allergies_patient_dci ON public.patient_allergies USING btree (tenant_patient_id, allergen_dci_id);


--
-- Name: idx_patient_allergy_history_allergy; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_allergy_history_allergy ON public.patient_allergy_history USING btree (patient_allergy_id, created_at);


--
-- Name: idx_patient_diagnoses_active; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_diagnoses_active ON public.patient_diagnoses USING btree (patient_id) WHERE (status = 'ACTIVE'::text);


--
-- Name: idx_patient_diagnoses_foundation_uri; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_diagnoses_foundation_uri ON public.patient_diagnoses USING btree (icd_foundation_uri);


--
-- Name: idx_patient_diagnoses_patient_id_entered_at; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_diagnoses_patient_id_entered_at ON public.patient_diagnoses USING btree (patient_id, entered_at DESC);


--
-- Name: idx_patient_documents_checksum; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_documents_checksum ON public.patient_documents USING btree (checksum);


--
-- Name: idx_patient_documents_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_documents_patient ON public.patient_documents USING btree (tenant_patient_id);


--
-- Name: idx_patient_documents_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_documents_tenant ON public.patient_documents USING btree (tenant_id);


--
-- Name: idx_patient_documents_type; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_documents_type ON public.patient_documents USING btree (document_type);


--
-- Name: idx_patient_lab_extraction_doc; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_extraction_doc ON public.patient_lab_extraction_sessions USING btree (source_document_id);


--
-- Name: idx_patient_lab_extraction_report; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_extraction_report ON public.patient_lab_extraction_sessions USING btree (patient_lab_report_id);


--
-- Name: idx_patient_lab_extraction_started; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_extraction_started ON public.patient_lab_extraction_sessions USING btree (started_at);


--
-- Name: idx_patient_lab_extraction_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_extraction_status ON public.patient_lab_extraction_sessions USING btree (status);


--
-- Name: idx_patient_lab_report_tests_global_act; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_report_tests_global_act ON public.patient_lab_report_tests USING btree (global_act_id);


--
-- Name: idx_patient_lab_report_tests_panel; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_report_tests_panel ON public.patient_lab_report_tests USING btree (panel_id);


--
-- Name: idx_patient_lab_report_tests_report; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_report_tests_report ON public.patient_lab_report_tests USING btree (patient_lab_report_id);


--
-- Name: idx_patient_lab_reports_admission; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_reports_admission ON public.patient_lab_reports USING btree (admission_id);


--
-- Name: idx_patient_lab_reports_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_reports_patient ON public.patient_lab_reports USING btree (tenant_patient_id);


--
-- Name: idx_patient_lab_reports_report_date; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_reports_report_date ON public.patient_lab_reports USING btree (report_date);


--
-- Name: idx_patient_lab_reports_source_type; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_reports_source_type ON public.patient_lab_reports USING btree (source_type);


--
-- Name: idx_patient_lab_reports_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_reports_status ON public.patient_lab_reports USING btree (status);


--
-- Name: idx_patient_lab_reports_uploaded_at; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_reports_uploaded_at ON public.patient_lab_reports USING btree (uploaded_at);


--
-- Name: idx_patient_lab_results_analyte; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_results_analyte ON public.patient_lab_results USING btree (analyte_id);


--
-- Name: idx_patient_lab_results_analyte_ctx; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_results_analyte_ctx ON public.patient_lab_results USING btree (lab_analyte_context_id);


--
-- Name: idx_patient_lab_results_observed; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_results_observed ON public.patient_lab_results USING btree (observed_at);


--
-- Name: idx_patient_lab_results_report; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_results_report ON public.patient_lab_results USING btree (patient_lab_report_id);


--
-- Name: idx_patient_lab_results_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_results_status ON public.patient_lab_results USING btree (status);


--
-- Name: idx_patient_lab_results_test; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_results_test ON public.patient_lab_results USING btree (patient_lab_report_test_id);


--
-- Name: idx_patient_lab_results_unit; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_lab_results_unit ON public.patient_lab_results USING btree (unit_id);


--
-- Name: idx_patient_observations_linked_addiction; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_observations_linked_addiction ON public.patient_observations USING btree (linked_addiction_id) WHERE (linked_addiction_id IS NOT NULL);


--
-- Name: idx_patient_observations_linked_admission; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_observations_linked_admission ON public.patient_observations USING btree (linked_admission_id) WHERE (linked_admission_id IS NOT NULL);


--
-- Name: idx_patient_observations_linked_allergy; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_observations_linked_allergy ON public.patient_observations USING btree (linked_allergy_id) WHERE (linked_allergy_id IS NOT NULL);


--
-- Name: idx_patient_observations_parent; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_observations_parent ON public.patient_observations USING btree (parent_observation_id) WHERE (parent_observation_id IS NOT NULL);


--
-- Name: idx_patient_observations_parent_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_observations_parent_patient ON public.patient_observations USING btree (tenant_patient_id, parent_observation_id) WHERE (parent_observation_id IS NOT NULL);


--
-- Name: idx_patient_observations_role; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_observations_role ON public.patient_observations USING btree (tenant_patient_id, author_role, declared_time DESC);


--
-- Name: idx_patient_observations_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_observations_status ON public.patient_observations USING btree (tenant_patient_id, status, declared_time DESC);


--
-- Name: idx_patient_observations_timeline; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_observations_timeline ON public.patient_observations USING btree (tenant_patient_id, declared_time DESC, created_at DESC);


--
-- Name: idx_patient_stays_active; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_stays_active ON public.patient_stays USING btree (bed_id) WHERE (ended_at IS NULL);


--
-- Name: idx_patient_stays_admission; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_stays_admission ON public.patient_stays USING btree (admission_id);


--
-- Name: idx_patient_stays_bed; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patient_stays_bed ON public.patient_stays USING btree (bed_id);


--
-- Name: idx_patients_tenant_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_patients_tenant_tenant ON public.patients_tenant USING btree (tenant_id);


--
-- Name: idx_po_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_po_status ON public.purchase_orders USING btree (status);


--
-- Name: idx_po_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_po_tenant ON public.purchase_orders USING btree (tenant_id);


--
-- Name: idx_poi_po; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_poi_po ON public.po_items USING btree (po_id);


--
-- Name: idx_presc_events_by_admission_time; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_presc_events_by_admission_time ON public.prescription_events USING btree (tenant_id, admission_id, scheduled_at);


--
-- Name: idx_prescription_events_lookup; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_prescription_events_lookup ON public.prescription_events USING btree (tenant_id, prescription_id, scheduled_at);


--
-- Name: idx_prescription_events_patient_time; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_prescription_events_patient_time ON public.prescription_events USING btree (tenant_patient_id, scheduled_at);


--
-- Name: idx_prescription_events_time; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_prescription_events_time ON public.prescription_events USING btree (tenant_id, scheduled_at);


--
-- Name: idx_prescriptions_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_prescriptions_patient ON public.prescriptions USING btree (tenant_id, tenant_patient_id);


--
-- Name: idx_prescriptions_tenant_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_prescriptions_tenant_patient ON public.prescriptions USING btree (tenant_patient_id);


--
-- Name: idx_price_ver_active; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_price_ver_active ON public.product_price_versions USING btree (product_supplier_id) WHERE (valid_to IS NULL);


--
-- Name: idx_price_ver_supp; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_price_ver_supp ON public.product_price_versions USING btree (product_supplier_id);


--
-- Name: idx_ps_product; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_ps_product ON public.product_suppliers USING btree (product_id);


--
-- Name: idx_ps_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_ps_tenant ON public.product_suppliers USING btree (tenant_id);


--
-- Name: idx_reception_lines_reception; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_reception_lines_reception ON public.return_reception_lines USING btree (reception_id);


--
-- Name: idx_reception_lines_return_line; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_reception_lines_return_line ON public.return_reception_lines USING btree (return_line_id);


--
-- Name: idx_receptions_return; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_receptions_return ON public.return_receptions USING btree (return_id);


--
-- Name: idx_rel_links_related; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_rel_links_related ON public.patient_relationship_links USING btree (tenant_id, related_tenant_patient_id);


--
-- Name: idx_rel_links_subject; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_rel_links_subject ON public.patient_relationship_links USING btree (tenant_id, subject_tenant_patient_id);


--
-- Name: idx_res_cleanup; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_res_cleanup ON public.stock_reservations USING btree (expires_at) WHERE (status = 'ACTIVE'::text);


--
-- Name: idx_res_expires; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_res_expires ON public.stock_reservations USING btree (status, expires_at) WHERE (status = 'ACTIVE'::text);


--
-- Name: idx_res_session; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_res_session ON public.stock_reservations USING btree (tenant_id, session_id) WHERE (status = 'ACTIVE'::text);


--
-- Name: idx_res_session_active; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_res_session_active ON public.stock_reservations USING btree (tenant_id, session_id) WHERE (status = 'ACTIVE'::text);


--
-- Name: idx_resline_lookup; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_resline_lookup ON public.stock_reservation_lines USING btree (product_id, lot, expiry, source_location_id);


--
-- Name: idx_resline_reservation; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_resline_reservation ON public.stock_reservation_lines USING btree (reservation_id);


--
-- Name: idx_resline_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_resline_tenant ON public.stock_reservation_lines USING btree (tenant_id);


--
-- Name: idx_return_lines_product; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_return_lines_product ON public.stock_return_lines USING btree (product_id);


--
-- Name: idx_return_lines_return; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_return_lines_return ON public.stock_return_lines USING btree (return_id);


--
-- Name: idx_return_receptions_reference; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_return_receptions_reference ON public.return_receptions USING btree (reception_reference);


--
-- Name: idx_returns_service; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_returns_service ON public.stock_returns USING btree (source_service_id);


--
-- Name: idx_returns_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_returns_status ON public.stock_returns USING btree (tenant_id, status);


--
-- Name: idx_returns_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_returns_tenant ON public.stock_returns USING btree (tenant_id);


--
-- Name: idx_rooms_service; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_rooms_service ON public.rooms USING btree (service_id);


--
-- Name: idx_rx_admission; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_rx_admission ON public.prescriptions USING btree (admission_id);


--
-- Name: idx_rx_events_prescription; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_rx_events_prescription ON public.prescription_events USING btree (prescription_id);


--
-- Name: idx_rx_events_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_rx_events_status ON public.prescription_events USING btree (tenant_id, status);


--
-- Name: idx_rx_events_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_rx_events_tenant ON public.prescription_events USING btree (tenant_id);


--
-- Name: idx_rx_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_rx_status ON public.prescriptions USING btree (tenant_id, status);


--
-- Name: idx_rx_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_rx_tenant ON public.prescriptions USING btree (tenant_id);


--
-- Name: idx_services_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_services_tenant ON public.services USING btree (tenant_id);


--
-- Name: idx_smart_phrases_active_search; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_smart_phrases_active_search ON public.smart_phrases USING btree (trigger_search) WHERE (is_active = true);


--
-- Name: idx_smart_phrases_scope; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_smart_phrases_scope ON public.smart_phrases USING btree (scope, tenant_id, user_id);


--
-- Name: idx_smart_phrases_trigger; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_smart_phrases_trigger ON public.smart_phrases USING btree (trigger);


--
-- Name: idx_smart_phrases_trigger_search; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_smart_phrases_trigger_search ON public.smart_phrases USING btree (trigger_search);


--
-- Name: idx_stock_lookup; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_stock_lookup ON public.current_stock USING btree (tenant_id, product_id, lot, expiry, location_id);


--
-- Name: idx_stock_returns_reference; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_stock_returns_reference ON public.stock_returns USING btree (return_reference);


--
-- Name: idx_su_service; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_su_service ON public.service_units USING btree (service_id);


--
-- Name: idx_surv_buckets_tenant_patient_bucket; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_surv_buckets_tenant_patient_bucket ON public.surveillance_hour_buckets USING btree (tenant_id, tenant_patient_id, bucket_start DESC);


--
-- Name: idx_surv_events_context_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_surv_events_context_id ON public.surveillance_values_events USING btree (context_id) WHERE (context_id IS NOT NULL);


--
-- Name: idx_surv_events_context_param_latest; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_surv_events_context_param_latest ON public.surveillance_values_events USING btree (context_id, parameter_id, recorded_at DESC, id DESC) WHERE ((context_id IS NOT NULL) AND (source_context = 'clinical_exam'::text));


--
-- Name: idx_surv_events_parameter; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_surv_events_parameter ON public.surveillance_values_events USING btree (tenant_id, parameter_id, bucket_start DESC);


--
-- Name: idx_surv_events_tenant_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_surv_events_tenant_patient ON public.surveillance_values_events USING btree (tenant_id, tenant_patient_id, bucket_start DESC);


--
-- Name: idx_surv_events_tenant_patient_bucket; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_surv_events_tenant_patient_bucket ON public.surveillance_values_events USING btree (tenant_id, tenant_patient_id, bucket_start DESC);


--
-- Name: idx_surveillance_buckets_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_surveillance_buckets_patient ON public.surveillance_hour_buckets USING btree (tenant_id, tenant_patient_id, bucket_start);


--
-- Name: idx_surveillance_events_patient_time_param; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_surveillance_events_patient_time_param ON public.surveillance_values_events USING btree (tenant_patient_id, recorded_at, parameter_code);


--
-- Name: idx_transfer_demand; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfer_demand ON public.stock_transfers USING btree (demand_id);


--
-- Name: idx_transfer_idempotency; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfer_idempotency ON public.stock_transfers USING btree (tenant_id, client_request_id) WHERE (client_request_id IS NOT NULL);


--
-- Name: idx_transfer_line_transfer; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfer_line_transfer ON public.stock_transfer_lines USING btree (transfer_id);


--
-- Name: idx_transfer_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfer_tenant ON public.stock_transfers USING btree (tenant_id);


--
-- Name: idx_transfusion_bags_patient_date; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfusion_bags_patient_date ON public.transfusion_blood_bags USING btree (tenant_id, tenant_patient_id, received_at DESC);


--
-- Name: idx_transfusion_bags_product; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfusion_bags_product ON public.transfusion_blood_bags USING btree (tenant_id, blood_product_code);


--
-- Name: idx_transfusion_bags_status; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfusion_bags_status ON public.transfusion_blood_bags USING btree (tenant_id, status);


--
-- Name: idx_transfusion_bags_tenant_bag; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_transfusion_bags_tenant_bag ON public.transfusion_blood_bags USING btree (tenant_id, bag_number);


--
-- Name: idx_transfusion_checks_admin_event_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfusion_checks_admin_event_id ON public.transfusion_checks USING btree (administration_event_id);


--
-- Name: idx_transfusion_checks_date; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfusion_checks_date ON public.transfusion_checks USING btree (tenant_id, checked_at DESC);


--
-- Name: idx_transfusion_checks_event; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfusion_checks_event ON public.transfusion_checks USING btree (tenant_id, administration_event_id);


--
-- Name: idx_transfusion_reactions_admin_event_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfusion_reactions_admin_event_id ON public.transfusion_reactions USING btree (administration_event_id);


--
-- Name: idx_transfusion_reactions_date; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfusion_reactions_date ON public.transfusion_reactions USING btree (tenant_id, recorded_at DESC);


--
-- Name: idx_transfusion_reactions_event; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_transfusion_reactions_event ON public.transfusion_reactions USING btree (tenant_id, administration_event_id);


--
-- Name: idx_unique_active_admission_per_type; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_unique_active_admission_per_type ON public.admissions USING btree (tenant_patient_id, admission_type) WHERE (status = 'En cours'::text);


--
-- Name: idx_unique_coverage_member; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_unique_coverage_member ON public.coverage_members USING btree (coverage_id, tenant_patient_id);


--
-- Name: idx_unique_lab_request_per_event; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_unique_lab_request_per_event ON public.lab_requests USING btree (prescription_event_id) WHERE (prescription_event_id IS NOT NULL);


--
-- Name: idx_unique_mrn_per_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_unique_mrn_per_tenant ON public.identity_ids USING btree (tenant_id, identity_type_code, identity_value) WHERE ((identity_type_code = 'LOCAL_MRN'::text) AND (status = 'ACTIVE'::text));


--
-- Name: idx_unique_nid_per_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_unique_nid_per_tenant ON public.identity_ids USING btree (tenant_id, identity_type_code, identity_value, issuing_country_code) WHERE ((identity_type_code = ANY (ARRAY['NATIONAL_ID'::text, 'PASSPORT'::text, 'CIN'::text])) AND (status = 'ACTIVE'::text));


--
-- Name: idx_unique_rel_patient; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX idx_unique_rel_patient ON public.patient_relationship_links USING btree (tenant_id, subject_tenant_patient_id, related_tenant_patient_id, relationship_type_code) WHERE (related_tenant_patient_id IS NOT NULL);


--
-- Name: idx_user_roles_role_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_user_roles_role_id ON public.user_roles USING btree (role_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: idx_user_services_service_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_user_services_service_id ON public.user_services USING btree (service_id);


--
-- Name: idx_user_services_user_id; Type: INDEX; Schema: public; Owner: sahty
--

CREATE INDEX idx_user_services_user_id ON public.user_services USING btree (user_id);


--
-- Name: smart_phrases_trigger_unique_ci; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX smart_phrases_trigger_unique_ci ON public.smart_phrases USING btree (tenant_id, lower(trigger));


--
-- Name: uniq_admission_number_tenant; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX uniq_admission_number_tenant ON public.admissions USING btree (tenant_id, admission_number) WHERE (admission_number IS NOT NULL);


--
-- Name: uq_lab_report_document_link; Type: INDEX; Schema: public; Owner: sahty
--

CREATE UNIQUE INDEX uq_lab_report_document_link ON public.patient_lab_report_documents USING btree (patient_lab_report_id, document_id);


--
-- Name: idx_care_categories_active_order; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_care_categories_active_order ON reference.care_categories USING btree (is_active, sort_order);


--
-- Name: idx_flowsheets_sort_order; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_flowsheets_sort_order ON reference.observation_flowsheets USING btree (sort_order);


--
-- Name: idx_global_dci_care_category; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_global_dci_care_category ON reference.global_dci USING btree (care_category_id);


--
-- Name: idx_global_products_care_category; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_global_products_care_category ON reference.global_products USING btree (care_category_id);


--
-- Name: idx_groups_sort_order; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_groups_sort_order ON reference.observation_groups USING btree (sort_order);


--
-- Name: idx_lab_act_ctx_act; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_lab_act_ctx_act ON public.lab_act_analyte_context USING btree (global_act_id);


--
-- Name: idx_lab_act_ctx_ctx; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_lab_act_ctx_ctx ON public.lab_act_analyte_context USING btree (analyte_context_id);


--
-- Name: idx_lab_act_tax_act; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_lab_act_tax_act ON public.lab_act_taxonomy USING btree (act_id);


--
-- Name: idx_lab_act_tax_sec; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_lab_act_tax_sec ON public.lab_act_taxonomy USING btree (section_id);


--
-- Name: idx_lab_act_tax_sf; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_lab_act_tax_sf ON public.lab_act_taxonomy USING btree (sous_famille_id);


--
-- Name: idx_lab_section_tree_section; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_lab_section_tree_section ON public.lab_section_tree USING btree (section_id);


--
-- Name: idx_lab_section_tree_sous_famille; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_lab_section_tree_sous_famille ON public.lab_section_tree USING btree (sous_famille_id);


--
-- Name: idx_lab_sub_section_tree_section; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_lab_sub_section_tree_section ON public.lab_sub_section_tree USING btree (section_id);


--
-- Name: idx_lab_sub_section_tree_sub; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_lab_sub_section_tree_sub ON public.lab_sub_section_tree USING btree (sub_section_id);


--
-- Name: idx_ref_atc_level; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_atc_level ON reference.global_atc USING btree (level);


--
-- Name: idx_ref_atc_parent; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_atc_parent ON reference.global_atc USING btree (parent);


--
-- Name: idx_ref_dci_atc; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_dci_atc ON reference.global_dci USING btree (atc_code) WHERE (atc_code IS NOT NULL);


--
-- Name: idx_ref_dci_name; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_dci_name ON reference.global_dci USING btree (name);


--
-- Name: idx_ref_dci_synonyms_dci_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_dci_synonyms_dci_id ON reference.dci_synonyms USING btree (dci_id);


--
-- Name: idx_ref_emdn_parent; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_emdn_parent ON reference.global_emdn USING btree (parent);


--
-- Name: idx_ref_global_actes_lab_section_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_global_actes_lab_section_id ON reference.global_actes USING btree (lab_section_id);


--
-- Name: idx_ref_global_actes_lab_sub_section_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_global_actes_lab_sub_section_id ON reference.global_actes USING btree (lab_sub_section_id);


--
-- Name: idx_ref_lab_act_analytes_analyte_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_act_analytes_analyte_id ON public.lab_act_analytes USING btree (analyte_id);


--
-- Name: idx_ref_lab_act_analytes_global_act_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_act_analytes_global_act_id ON public.lab_act_analytes USING btree (global_act_id);


--
-- Name: idx_ref_lab_act_methods_default; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE UNIQUE INDEX idx_ref_lab_act_methods_default ON public.lab_act_methods USING btree (global_act_id) WHERE ((is_default = true) AND (actif = true));


--
-- Name: idx_ref_lab_act_spec_cont_container_type_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_act_spec_cont_container_type_id ON public.lab_act_specimen_containers USING btree (container_type_id);


--
-- Name: idx_ref_lab_act_spec_cont_global_act_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_act_spec_cont_global_act_id ON public.lab_act_specimen_containers USING btree (global_act_id);


--
-- Name: idx_ref_lab_act_spec_cont_specimen_type_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_act_spec_cont_specimen_type_id ON public.lab_act_specimen_containers USING btree (specimen_type_id);


--
-- Name: idx_ref_lab_analyte_aliases_alias_text_lower; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_analyte_aliases_alias_text_lower ON public.lab_analyte_aliases USING btree (lower(alias_text));


--
-- Name: idx_ref_lab_analyte_aliases_analyte_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_analyte_aliases_analyte_id ON public.lab_analyte_aliases USING btree (analyte_id);


--
-- Name: idx_ref_lab_analyte_units_analyte; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_analyte_units_analyte ON public.lab_analyte_units USING btree (analyte_id);


--
-- Name: idx_ref_lab_analyte_units_canonical; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE UNIQUE INDEX idx_ref_lab_analyte_units_canonical ON public.lab_analyte_units USING btree (analyte_id) WHERE ((is_canonical = true) AND (actif = true));


--
-- Name: idx_ref_lab_analyte_units_default; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE UNIQUE INDEX idx_ref_lab_analyte_units_default ON public.lab_analyte_units USING btree (analyte_id) WHERE ((is_default = true) AND (actif = true));


--
-- Name: idx_ref_lab_analytes_actif; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_analytes_actif ON reference.lab_analytes USING btree (actif);


--
-- Name: idx_ref_lab_analytes_value_type; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_analytes_value_type ON reference.lab_analytes USING btree (value_type);


--
-- Name: idx_ref_lab_panel_items_child_act_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_panel_items_child_act_id ON public.lab_panel_items USING btree (child_global_act_id);


--
-- Name: idx_ref_lab_panel_items_child_panel_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_panel_items_child_panel_id ON public.lab_panel_items USING btree (child_panel_id);


--
-- Name: idx_ref_lab_panel_items_panel_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_panel_items_panel_id ON public.lab_panel_items USING btree (panel_id);


--
-- Name: idx_ref_lab_panels_actif; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_panels_actif ON public.lab_panels USING btree (actif);


--
-- Name: idx_ref_lab_panels_section_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_panels_section_id ON public.lab_panels USING btree (section_id);


--
-- Name: idx_ref_lab_panels_sous_famille_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_panels_sous_famille_id ON public.lab_panels USING btree (sous_famille_id);


--
-- Name: idx_ref_lab_panels_sub_section_id; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_panels_sub_section_id ON public.lab_panels USING btree (sub_section_id);


--
-- Name: idx_ref_lab_sections_actif; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_sections_actif ON reference.lab_sections USING btree (actif);


--
-- Name: idx_ref_lab_sub_sections_actif; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_lab_sub_sections_actif ON reference.lab_sub_sections USING btree (actif);


--
-- Name: idx_ref_price_hist_dates; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_price_hist_dates ON reference.global_product_price_history USING btree (valid_from, valid_to);


--
-- Name: idx_ref_price_hist_product; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_price_hist_product ON reference.global_product_price_history USING btree (product_id);


--
-- Name: idx_ref_products_active; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_products_active ON reference.global_products USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_ref_products_name; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_products_name ON reference.global_products USING btree (name);


--
-- Name: idx_ref_products_sahty; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_products_sahty ON reference.global_products USING btree (sahty_code) WHERE (sahty_code IS NOT NULL);


--
-- Name: idx_ref_suppliers_active; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_ref_suppliers_active ON reference.global_suppliers USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_routes_active_order; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_routes_active_order ON reference.routes USING btree (is_active, sort_order);


--
-- Name: idx_routes_sort_order_unique; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE UNIQUE INDEX idx_routes_sort_order_unique ON reference.routes USING btree (sort_order);


--
-- Name: idx_specimen_base_tenant; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_specimen_base_tenant ON reference.lab_specimen_types USING btree (base_specimen);


--
-- Name: idx_tenant_global_products_default_presc_route; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE INDEX idx_tenant_global_products_default_presc_route ON reference.global_products USING btree (default_presc_route);


--
-- Name: uniq_default_container_per_specimen_tenant; Type: INDEX; Schema: reference; Owner: sahty
--

-- lab_specimen_container_types index removed


--
-- Name: uq_flowsheets_sort_order; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE UNIQUE INDEX uq_flowsheets_sort_order ON reference.observation_flowsheets USING btree (sort_order) WHERE (is_active = true);


--
-- Name: uq_group_parameters_sort_order; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE UNIQUE INDEX uq_group_parameters_sort_order ON reference.group_parameters USING btree (group_id, sort_order);


--
-- Name: uq_groups_sort_order; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE UNIQUE INDEX uq_groups_sort_order ON reference.observation_groups USING btree (sort_order);


--
-- Name: uq_lab_reference_profile_tenant; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE UNIQUE INDEX uq_lab_reference_profile_tenant ON public.lab_reference_profiles USING btree (analyte_context_id, COALESCE(sex, 'U'::text), COALESCE(age_min_days, '-1'::integer), COALESCE(age_max_days, '-1'::integer));


--
-- Name: uq_ref_act_context; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE UNIQUE INDEX uq_ref_act_context ON public.lab_act_contexts USING btree (global_act_id, analyte_context_id);


--
-- Name: uq_ref_act_default_context; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE UNIQUE INDEX uq_ref_act_default_context ON public.lab_act_contexts USING btree (global_act_id) WHERE (is_default = true);


--
-- Name: uq_ref_context_default; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE UNIQUE INDEX uq_ref_context_default ON public.lab_analyte_contexts USING btree (analyte_id, specimen_type_id) WHERE (is_default = true);


--
-- Name: uq_ref_lab_analyte_context; Type: INDEX; Schema: reference; Owner: sahty
--

CREATE UNIQUE INDEX uq_ref_lab_analyte_context ON public.lab_analyte_contexts USING btree (analyte_id, specimen_type_id, unit_id, COALESCE(method_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- Name: credentials trg_auth_sync_credentials_delete; Type: TRIGGER; Schema: auth; Owner: sahty
--

CREATE TRIGGER trg_auth_sync_credentials_delete AFTER DELETE ON auth.credentials FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();


--
-- Name: credentials trg_auth_sync_credentials_insert; Type: TRIGGER; Schema: auth; Owner: sahty
--

CREATE TRIGGER trg_auth_sync_credentials_insert AFTER INSERT ON auth.credentials FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();


--
-- Name: credentials trg_auth_sync_credentials_update; Type: TRIGGER; Schema: auth; Owner: sahty
--

CREATE TRIGGER trg_auth_sync_credentials_update AFTER UPDATE ON auth.credentials FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();


--
-- Name: user_tenants trg_auth_sync_user_tenants_delete; Type: TRIGGER; Schema: auth; Owner: sahty
--

CREATE TRIGGER trg_auth_sync_user_tenants_delete AFTER DELETE ON auth.user_tenants FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();


--
-- Name: user_tenants trg_auth_sync_user_tenants_insert; Type: TRIGGER; Schema: auth; Owner: sahty
--

CREATE TRIGGER trg_auth_sync_user_tenants_insert AFTER INSERT ON auth.user_tenants FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();


--
-- Name: user_tenants trg_auth_sync_user_tenants_update; Type: TRIGGER; Schema: auth; Owner: sahty
--

CREATE TRIGGER trg_auth_sync_user_tenants_update AFTER UPDATE ON auth.user_tenants FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();


--
-- Name: users trg_auth_sync_users_delete; Type: TRIGGER; Schema: auth; Owner: sahty
--

CREATE TRIGGER trg_auth_sync_users_delete AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();


--
-- Name: users trg_auth_sync_users_insert; Type: TRIGGER; Schema: auth; Owner: sahty
--

CREATE TRIGGER trg_auth_sync_users_insert AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();


--
-- Name: users trg_auth_sync_users_update; Type: TRIGGER; Schema: auth; Owner: sahty
--

CREATE TRIGGER trg_auth_sync_users_update AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION auth_sync.emit_outbox_event();


--
-- Name: administration_events audit_administration_events; Type: TRIGGER; Schema: public; Owner: sahty
--

CREATE TRIGGER audit_administration_events AFTER INSERT OR DELETE OR UPDATE ON public.administration_events FOR EACH ROW EXECUTE FUNCTION public.fn_generic_audit();


--
-- Name: audit_log audit_log_no_update; Type: TRIGGER; Schema: public; Owner: sahty
--

CREATE TRIGGER audit_log_no_update BEFORE DELETE OR UPDATE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.fn_audit_no_update();


--
-- Name: patients_tenant audit_patients_tenant; Type: TRIGGER; Schema: public; Owner: sahty
--

CREATE TRIGGER audit_patients_tenant AFTER INSERT OR DELETE OR UPDATE ON public.patients_tenant FOR EACH ROW EXECUTE FUNCTION public.fn_generic_audit();


--
-- Name: prescription_events audit_prescription_events; Type: TRIGGER; Schema: public; Owner: sahty
--

CREATE TRIGGER audit_prescription_events AFTER INSERT OR DELETE OR UPDATE ON public.prescription_events FOR EACH ROW EXECUTE FUNCTION public.fn_generic_audit();


--
-- Name: prescriptions audit_prescriptions; Type: TRIGGER; Schema: public; Owner: sahty
--

CREATE TRIGGER audit_prescriptions AFTER INSERT OR DELETE OR UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.fn_generic_audit();


--
-- Name: locations trg_prevent_system_location_deactivate; Type: TRIGGER; Schema: public; Owner: sahty
--

CREATE TRIGGER trg_prevent_system_location_deactivate BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_system_location_deactivate();


--
-- Name: administration_events trg_recompute_bag_status; Type: TRIGGER; Schema: public; Owner: sahty
--

CREATE TRIGGER trg_recompute_bag_status AFTER INSERT OR DELETE OR UPDATE OF status ON public.administration_events FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_bag_status();


--
-- Name: administration_event_blood_bags trg_recompute_bag_status_assoc; Type: TRIGGER; Schema: public; Owner: sahty
--

CREATE TRIGGER trg_recompute_bag_status_assoc AFTER INSERT OR DELETE OR UPDATE ON public.administration_event_blood_bags FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_bag_status_assoc();


--
-- Name: surveillance_values_events trg_surveillance_event_bucket; Type: TRIGGER; Schema: public; Owner: sahty
--

CREATE TRIGGER trg_surveillance_event_bucket AFTER INSERT ON public.surveillance_values_events FOR EACH ROW EXECUTE FUNCTION public.update_surveillance_hour_bucket();


--
-- Name: credentials credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: sahty
--

ALTER TABLE ONLY auth.credentials
    ADD CONSTRAINT credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(user_id) ON DELETE CASCADE;


--
-- Name: user_tenants user_tenants_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: sahty
--

ALTER TABLE ONLY auth.user_tenants
    ADD CONSTRAINT user_tenants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(user_id) ON DELETE CASCADE;


--
-- Name: administration_event_pauses administration_event_pauses_administration_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.administration_event_pauses
    ADD CONSTRAINT administration_event_pauses_administration_event_id_fkey FOREIGN KEY (administration_event_id) REFERENCES public.administration_events(id) ON DELETE CASCADE;


--
-- Name: administration_events administration_events_prescription_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.administration_events
    ADD CONSTRAINT administration_events_prescription_event_id_fkey FOREIGN KEY (prescription_event_id) REFERENCES public.prescription_events(id) ON DELETE CASCADE;


--
-- Name: admission_coverage_members admission_coverage_members_admission_coverage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admission_coverage_members
    ADD CONSTRAINT admission_coverage_members_admission_coverage_id_fkey FOREIGN KEY (admission_coverage_id) REFERENCES public.admission_coverages(admission_coverage_id) ON DELETE CASCADE;


--
-- Name: admission_coverages admission_coverages_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admission_coverages
    ADD CONSTRAINT admission_coverages_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: admissions admissions_admitting_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_admitting_service_id_fkey FOREIGN KEY (admitting_service_id) REFERENCES public.services(id);


--
-- Name: admissions admissions_attending_physician_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_attending_physician_user_id_fkey FOREIGN KEY (attending_physician_user_id) REFERENCES auth.users(user_id);


--
-- Name: admissions admissions_current_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_current_service_id_fkey FOREIGN KEY (current_service_id) REFERENCES public.services(id);


--
-- Name: admissions admissions_responsible_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_responsible_service_id_fkey FOREIGN KEY (responsible_service_id) REFERENCES public.services(id);


--
-- Name: admissions admissions_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT admissions_tenant_patient_id_fkey FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id);


--
-- Name: beds beds_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id);


--
-- Name: coverage_members coverage_members_coverage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.coverage_members
    ADD CONSTRAINT coverage_members_coverage_id_fkey FOREIGN KEY (coverage_id) REFERENCES public.coverages(coverage_id) ON DELETE CASCADE;


--
-- Name: coverage_members coverage_members_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.coverage_members
    ADD CONSTRAINT coverage_members_tenant_patient_id_fkey FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE CASCADE;


--
-- Name: coverages coverages_organisme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.coverages
    ADD CONSTRAINT coverages_organisme_id_fkey FOREIGN KEY (organisme_id) REFERENCES reference.organismes(id);


--
-- Name: escarre_snapshots escarre_snapshots_escarre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.escarre_snapshots
    ADD CONSTRAINT escarre_snapshots_escarre_id_fkey FOREIGN KEY (escarre_id) REFERENCES public.escarres(id) ON DELETE RESTRICT;


--
-- Name: escarres escarres_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.escarres
    ADD CONSTRAINT escarres_tenant_patient_id_fkey FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE CASCADE;


--
-- Name: administration_event_blood_bags fk_admin_event_blood_bags_bag; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.administration_event_blood_bags
    ADD CONSTRAINT fk_admin_event_blood_bags_bag FOREIGN KEY (blood_bag_id) REFERENCES public.transfusion_blood_bags(id) ON DELETE RESTRICT;


--
-- Name: administration_event_blood_bags fk_admin_event_blood_bags_event; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.administration_event_blood_bags
    ADD CONSTRAINT fk_admin_event_blood_bags_event FOREIGN KEY (administration_event_id) REFERENCES public.administration_events(id) ON DELETE CASCADE;


--
-- Name: administration_events fk_admin_event_user; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.administration_events
    ADD CONSTRAINT fk_admin_event_user FOREIGN KEY (performed_by_user_id) REFERENCES auth.users(user_id) ON DELETE RESTRICT;


--
-- Name: admission_acts fk_admission_acts_admission; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.admission_acts
    ADD CONSTRAINT fk_admission_acts_admission FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE CASCADE;


--
-- Name: administration_event_lab_collections fk_aelc_admin_event; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.administration_event_lab_collections
    ADD CONSTRAINT fk_aelc_admin_event FOREIGN KEY (administration_event_id) REFERENCES public.administration_events(id) ON DELETE CASCADE;


--
-- Name: administration_event_lab_collections fk_aelc_lab_collection; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.administration_event_lab_collections
    ADD CONSTRAINT fk_aelc_lab_collection FOREIGN KEY (lab_collection_id) REFERENCES public.lab_collections(id) ON DELETE CASCADE;


--
-- Name: clinical_exams fk_clinical_exams_patient; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.clinical_exams
    ADD CONSTRAINT fk_clinical_exams_patient FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE CASCADE;


--
-- Name: global_act_external_codes fk_external_system; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.global_act_external_codes
    ADD CONSTRAINT fk_external_system FOREIGN KEY (external_system_id) REFERENCES public.external_systems(id) ON DELETE CASCADE;


--
-- Name: patient_lab_extraction_sessions fk_extraction_document; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_extraction_sessions
    ADD CONSTRAINT fk_extraction_document FOREIGN KEY (source_document_id) REFERENCES public.patient_documents(id) ON DELETE CASCADE;


--
-- Name: global_act_external_codes fk_global_act; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.global_act_external_codes
    ADD CONSTRAINT fk_global_act FOREIGN KEY (global_act_id) REFERENCES reference.global_actes(id) ON DELETE CASCADE;


--
-- Name: patient_lab_report_documents fk_lab_doc_document; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_report_documents
    ADD CONSTRAINT fk_lab_doc_document FOREIGN KEY (document_id) REFERENCES public.patient_documents(id);


--
-- Name: patient_lab_report_documents fk_lab_doc_report; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_report_documents
    ADD CONSTRAINT fk_lab_doc_report FOREIGN KEY (patient_lab_report_id) REFERENCES public.patient_lab_reports(id);


--
-- Name: lab_requests fk_lab_requests_act; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_requests
    ADD CONSTRAINT fk_lab_requests_act FOREIGN KEY (global_act_id) REFERENCES reference.global_actes(id);


--
-- Name: lab_requests fk_lab_requests_admission; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_requests
    ADD CONSTRAINT fk_lab_requests_admission FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE CASCADE;


--
-- Name: lab_requests fk_lab_requests_patient; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_requests
    ADD CONSTRAINT fk_lab_requests_patient FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE CASCADE;


--
-- Name: lab_requests fk_lab_requests_prescription_event; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_requests
    ADD CONSTRAINT fk_lab_requests_prescription_event FOREIGN KEY (prescription_event_id) REFERENCES public.prescription_events(id) ON DELETE CASCADE;


--
-- Name: lab_specimen_status_history fk_lab_specimen_status_history_specimen; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_specimen_status_history
    ADD CONSTRAINT fk_lab_specimen_status_history_specimen FOREIGN KEY (specimen_id) REFERENCES public.lab_specimens(id) ON DELETE CASCADE;


--
-- Name: lab_collection_specimens fk_lcs_collection; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_collection_specimens
    ADD CONSTRAINT fk_lcs_collection FOREIGN KEY (lab_collection_id) REFERENCES public.lab_collections(id) ON DELETE CASCADE;


--
-- Name: lab_collection_specimens fk_lcs_specimen; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_collection_specimens
    ADD CONSTRAINT fk_lcs_specimen FOREIGN KEY (specimen_id) REFERENCES public.lab_specimens(id) ON DELETE CASCADE;


--
-- Name: lab_specimen_requests fk_lsr_specimen; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_specimen_requests
    ADD CONSTRAINT fk_lsr_specimen FOREIGN KEY (specimen_id) REFERENCES public.lab_specimens(id) ON DELETE CASCADE;


--
-- Name: surveillance_values_events fk_surv_events_parameter; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.surveillance_values_events
    ADD CONSTRAINT fk_surv_events_parameter FOREIGN KEY (parameter_id) REFERENCES reference.observation_parameters(id) ON DELETE CASCADE;


--
-- Name: transfusion_blood_bags fk_transfusion_blood_bags_user; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.transfusion_blood_bags
    ADD CONSTRAINT fk_transfusion_blood_bags_user FOREIGN KEY (received_by_user_id) REFERENCES auth.users(user_id);


--
-- Name: transfusion_checks fk_transfusion_checks_event; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.transfusion_checks
    ADD CONSTRAINT fk_transfusion_checks_event FOREIGN KEY (administration_event_id) REFERENCES public.administration_events(id) ON DELETE CASCADE;


--
-- Name: transfusion_checks fk_transfusion_checks_user; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.transfusion_checks
    ADD CONSTRAINT fk_transfusion_checks_user FOREIGN KEY (checked_by_user_id) REFERENCES auth.users(user_id);


--
-- Name: transfusion_reactions fk_transfusion_reactions_event; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.transfusion_reactions
    ADD CONSTRAINT fk_transfusion_reactions_event FOREIGN KEY (administration_event_id) REFERENCES public.administration_events(id) ON DELETE CASCADE;


--
-- Name: transfusion_reactions fk_transfusion_reactions_user; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.transfusion_reactions
    ADD CONSTRAINT fk_transfusion_reactions_user FOREIGN KEY (recorded_by_user_id) REFERENCES auth.users(user_id);


--
-- Name: identity_ids identity_ids_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.identity_ids
    ADD CONSTRAINT identity_ids_tenant_patient_id_fkey FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE CASCADE;


--
-- Name: lab_analyte_external_codes lab_analyte_external_codes_external_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_external_codes
    ADD CONSTRAINT lab_analyte_external_codes_external_system_id_fkey FOREIGN KEY (external_system_id) REFERENCES public.external_systems(id);


--
-- Name: lab_hprim_links lab_hprim_links_hprim_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_hprim_links
    ADD CONSTRAINT lab_hprim_links_hprim_message_id_fkey FOREIGN KEY (hprim_message_id) REFERENCES public.lab_hprim_messages(id);


--
-- Name: lab_hprim_links lab_hprim_links_lab_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_hprim_links
    ADD CONSTRAINT lab_hprim_links_lab_request_id_fkey FOREIGN KEY (lab_request_id) REFERENCES public.lab_requests(id);


--
-- Name: lab_hprim_links lab_hprim_links_lab_specimen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_hprim_links
    ADD CONSTRAINT lab_hprim_links_lab_specimen_id_fkey FOREIGN KEY (lab_specimen_id) REFERENCES public.lab_specimens(id);


--
-- Name: lab_unit_external_codes lab_unit_external_codes_external_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_unit_external_codes
    ADD CONSTRAINT lab_unit_external_codes_external_system_id_fkey FOREIGN KEY (external_system_id) REFERENCES public.external_systems(id);


--
-- Name: lab_value_normalization lab_value_normalization_canonical_value_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_value_normalization
    ADD CONSTRAINT lab_value_normalization_canonical_value_id_fkey FOREIGN KEY (canonical_value_id) REFERENCES reference.lab_canonical_allowed_values(id);


--
-- Name: patient_addiction_history patient_addiction_history_addiction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_addiction_history
    ADD CONSTRAINT patient_addiction_history_addiction_id_fkey FOREIGN KEY (addiction_id) REFERENCES public.patient_addictions(id) ON DELETE CASCADE;


--
-- Name: patient_allergies patient_allergies_allergen_dci_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_allergen_dci_id_fkey FOREIGN KEY (allergen_dci_id) REFERENCES reference.global_dci(id);


--
-- Name: patient_allergies patient_allergies_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_tenant_patient_id_fkey FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id);


--
-- Name: patient_allergy_history patient_allergy_history_patient_allergy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_allergy_history
    ADD CONSTRAINT patient_allergy_history_patient_allergy_id_fkey FOREIGN KEY (patient_allergy_id) REFERENCES public.patient_allergies(id) ON DELETE CASCADE;


--
-- Name: patient_allergy_history patient_allergy_history_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_allergy_history
    ADD CONSTRAINT patient_allergy_history_tenant_patient_id_fkey FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id);


--
-- Name: patient_allergy_manifestations patient_allergy_manifestations_patient_allergy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_allergy_manifestations
    ADD CONSTRAINT patient_allergy_manifestations_patient_allergy_id_fkey FOREIGN KEY (patient_allergy_id) REFERENCES public.patient_allergies(id) ON DELETE CASCADE;


--
-- Name: patient_diagnoses patient_diagnoses_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_diagnoses
    ADD CONSTRAINT patient_diagnoses_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE CASCADE;


--
-- Name: patient_identity_change patient_identity_change_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_identity_change
    ADD CONSTRAINT patient_identity_change_tenant_patient_id_fkey FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE CASCADE;


--
-- Name: patient_lab_extraction_sessions patient_lab_extraction_sessions_patient_lab_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_extraction_sessions
    ADD CONSTRAINT patient_lab_extraction_sessions_patient_lab_report_id_fkey FOREIGN KEY (patient_lab_report_id) REFERENCES public.patient_lab_reports(id) ON DELETE CASCADE;


--
-- Name: patient_lab_report_tests patient_lab_report_tests_global_act_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_report_tests
    ADD CONSTRAINT patient_lab_report_tests_global_act_id_fkey FOREIGN KEY (global_act_id) REFERENCES reference.global_actes(id);


--
-- Name: patient_lab_report_tests patient_lab_report_tests_panel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_report_tests
    ADD CONSTRAINT patient_lab_report_tests_panel_id_fkey FOREIGN KEY (panel_id) REFERENCES public.lab_panels(id);


--
-- Name: patient_lab_report_tests patient_lab_report_tests_patient_lab_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_report_tests
    ADD CONSTRAINT patient_lab_report_tests_patient_lab_report_id_fkey FOREIGN KEY (patient_lab_report_id) REFERENCES public.patient_lab_reports(id) ON DELETE CASCADE;


--
-- Name: patient_lab_reports patient_lab_reports_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_reports
    ADD CONSTRAINT patient_lab_reports_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: patient_lab_reports patient_lab_reports_entered_in_error_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_reports
    ADD CONSTRAINT patient_lab_reports_entered_in_error_by_user_id_fkey FOREIGN KEY (entered_in_error_by_user_id) REFERENCES auth.users(user_id);


--
-- Name: patient_lab_reports patient_lab_reports_structured_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_reports
    ADD CONSTRAINT patient_lab_reports_structured_by_user_id_fkey FOREIGN KEY (structured_by_user_id) REFERENCES auth.users(user_id);


--
-- Name: patient_lab_reports patient_lab_reports_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_reports
    ADD CONSTRAINT patient_lab_reports_tenant_patient_id_fkey FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id);


--
-- Name: patient_lab_reports patient_lab_reports_uploaded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_reports
    ADD CONSTRAINT patient_lab_reports_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES auth.users(user_id);


--
-- Name: patient_lab_results patient_lab_results_analyte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_results
    ADD CONSTRAINT patient_lab_results_analyte_id_fkey FOREIGN KEY (analyte_id) REFERENCES reference.lab_analytes(id);


--
-- Name: patient_lab_results patient_lab_results_entered_in_error_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_results
    ADD CONSTRAINT patient_lab_results_entered_in_error_by_user_id_fkey FOREIGN KEY (entered_in_error_by_user_id) REFERENCES auth.users(user_id);


--
-- Name: patient_lab_results patient_lab_results_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_results
    ADD CONSTRAINT patient_lab_results_method_id_fkey FOREIGN KEY (method_id) REFERENCES reference.lab_methods(id);


--
-- Name: patient_lab_results patient_lab_results_patient_lab_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_results
    ADD CONSTRAINT patient_lab_results_patient_lab_report_id_fkey FOREIGN KEY (patient_lab_report_id) REFERENCES public.patient_lab_reports(id) ON DELETE CASCADE;


--
-- Name: patient_lab_results patient_lab_results_patient_lab_report_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_results
    ADD CONSTRAINT patient_lab_results_patient_lab_report_test_id_fkey FOREIGN KEY (patient_lab_report_test_id) REFERENCES public.patient_lab_report_tests(id) ON DELETE SET NULL;


--
-- Name: patient_lab_results patient_lab_results_specimen_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_results
    ADD CONSTRAINT patient_lab_results_specimen_type_id_fkey FOREIGN KEY (specimen_type_id) REFERENCES reference.lab_specimen_types(id);


--
-- Name: patient_lab_results patient_lab_results_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_lab_results
    ADD CONSTRAINT patient_lab_results_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES reference.units(id);


--
-- Name: patient_observations patient_observations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_observations
    ADD CONSTRAINT patient_observations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(user_id);


--
-- Name: patient_observations patient_observations_parent_observation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_observations
    ADD CONSTRAINT patient_observations_parent_observation_id_fkey FOREIGN KEY (parent_observation_id) REFERENCES public.patient_observations(id);


--
-- Name: patient_observations patient_observations_signed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_observations
    ADD CONSTRAINT patient_observations_signed_by_fkey FOREIGN KEY (signed_by) REFERENCES auth.users(user_id);


--
-- Name: patient_observations patient_observations_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_observations
    ADD CONSTRAINT patient_observations_tenant_patient_id_fkey FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id);


--
-- Name: patient_relationship_links patient_relationship_links_related_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_relationship_links
    ADD CONSTRAINT patient_relationship_links_related_tenant_patient_id_fkey FOREIGN KEY (related_tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE SET NULL;


--
-- Name: patient_relationship_links patient_relationship_links_subject_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_relationship_links
    ADD CONSTRAINT patient_relationship_links_subject_tenant_patient_id_fkey FOREIGN KEY (subject_tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE CASCADE;


--
-- Name: patient_stays patient_stays_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_stays
    ADD CONSTRAINT patient_stays_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: patient_stays patient_stays_bed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_stays
    ADD CONSTRAINT patient_stays_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.beds(id);


--
-- Name: patient_stays patient_stays_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_stays
    ADD CONSTRAINT patient_stays_tenant_patient_id_fkey FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id);


--
-- Name: patient_tenant_merge_events patient_tenant_merge_events_source_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_tenant_merge_events
    ADD CONSTRAINT patient_tenant_merge_events_source_tenant_patient_id_fkey FOREIGN KEY (source_tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id);


--
-- Name: patient_tenant_merge_events patient_tenant_merge_events_target_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patient_tenant_merge_events
    ADD CONSTRAINT patient_tenant_merge_events_target_tenant_patient_id_fkey FOREIGN KEY (target_tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id);


--
-- Name: patients_tenant patients_tenant_merged_into_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.patients_tenant
    ADD CONSTRAINT patients_tenant_merged_into_tenant_patient_id_fkey FOREIGN KEY (merged_into_tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id);


--
-- Name: po_items po_items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.po_items
    ADD CONSTRAINT po_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(po_id) ON DELETE CASCADE;


--
-- Name: prescription_events prescription_events_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.prescription_events
    ADD CONSTRAINT prescription_events_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);


--
-- Name: prescriptions prescriptions_tenant_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_tenant_patient_id_fkey FOREIGN KEY (tenant_patient_id) REFERENCES public.patients_tenant(tenant_patient_id);


--
-- Name: product_price_versions product_price_versions_product_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.product_price_versions
    ADD CONSTRAINT product_price_versions_product_supplier_id_fkey FOREIGN KEY (product_supplier_id) REFERENCES public.product_suppliers(id) ON DELETE CASCADE;


--
-- Name: return_decision_lines return_decision_lines_decision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.return_decision_lines
    ADD CONSTRAINT return_decision_lines_decision_id_fkey FOREIGN KEY (decision_id) REFERENCES public.return_decisions(id) ON DELETE CASCADE;


--
-- Name: return_decision_lines return_decision_lines_destination_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.return_decision_lines
    ADD CONSTRAINT return_decision_lines_destination_location_id_fkey FOREIGN KEY (destination_location_id) REFERENCES public.locations(location_id);


--
-- Name: return_decision_lines return_decision_lines_return_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.return_decision_lines
    ADD CONSTRAINT return_decision_lines_return_line_id_fkey FOREIGN KEY (return_line_id) REFERENCES public.stock_return_lines(id);


--
-- Name: return_decisions return_decisions_reception_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.return_decisions
    ADD CONSTRAINT return_decisions_reception_id_fkey FOREIGN KEY (reception_id) REFERENCES public.return_receptions(id) ON DELETE CASCADE;


--
-- Name: return_reception_lines return_reception_lines_reception_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.return_reception_lines
    ADD CONSTRAINT return_reception_lines_reception_id_fkey FOREIGN KEY (reception_id) REFERENCES public.return_receptions(id) ON DELETE CASCADE;


--
-- Name: return_reception_lines return_reception_lines_return_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.return_reception_lines
    ADD CONSTRAINT return_reception_lines_return_line_id_fkey FOREIGN KEY (return_line_id) REFERENCES public.stock_return_lines(id);


--
-- Name: return_receptions return_receptions_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.return_receptions
    ADD CONSTRAINT return_receptions_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.stock_returns(id) ON DELETE CASCADE;


--
-- Name: rooms rooms_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id);


--
-- Name: rooms rooms_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: service_units service_units_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.service_units
    ADD CONSTRAINT service_units_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: smart_phrases smart_phrases_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.smart_phrases
    ADD CONSTRAINT smart_phrases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(user_id);


--
-- Name: smart_phrases smart_phrases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.smart_phrases
    ADD CONSTRAINT smart_phrases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(user_id);


--
-- Name: stock_demand_lines stock_demand_lines_demand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_demand_lines
    ADD CONSTRAINT stock_demand_lines_demand_id_fkey FOREIGN KEY (demand_id) REFERENCES public.stock_demands(id) ON DELETE CASCADE;


--
-- Name: stock_reservation_lines stock_reservation_lines_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_reservation_lines
    ADD CONSTRAINT stock_reservation_lines_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.stock_reservations(reservation_id);


--
-- Name: stock_return_lines stock_return_lines_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_return_lines
    ADD CONSTRAINT stock_return_lines_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.stock_returns(id) ON DELETE CASCADE;


--
-- Name: stock_return_lines stock_return_lines_stock_reservation_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_return_lines
    ADD CONSTRAINT stock_return_lines_stock_reservation_line_id_fkey FOREIGN KEY (stock_reservation_line_id) REFERENCES public.stock_reservation_lines(id);


--
-- Name: stock_returns stock_returns_stock_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_returns
    ADD CONSTRAINT stock_returns_stock_reservation_id_fkey FOREIGN KEY (stock_reservation_id) REFERENCES public.stock_reservations(reservation_id);


--
-- Name: stock_transfer_lines stock_transfer_lines_demand_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_transfer_lines
    ADD CONSTRAINT stock_transfer_lines_demand_line_id_fkey FOREIGN KEY (demand_line_id) REFERENCES public.stock_demand_lines(id);


--
-- Name: stock_transfer_lines stock_transfer_lines_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_transfer_lines
    ADD CONSTRAINT stock_transfer_lines_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.stock_transfers(id) ON DELETE CASCADE;


--
-- Name: stock_transfers stock_transfers_demand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_demand_id_fkey FOREIGN KEY (demand_id) REFERENCES public.stock_demands(id);


--
-- Name: user_services user_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.user_services
    ADD CONSTRAINT user_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: user_services user_services_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.user_services
    ADD CONSTRAINT user_services_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(user_id) ON DELETE CASCADE;


--
-- Name: dci_synonyms dci_synonyms_dci_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.dci_synonyms
    ADD CONSTRAINT dci_synonyms_dci_id_fkey FOREIGN KEY (dci_id) REFERENCES reference.global_dci(id) ON DELETE CASCADE;


-- lab_specimen_container_types fk_container removed


--
-- Name: global_dci fk_global_dci_care_category; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_dci
    ADD CONSTRAINT fk_global_dci_care_category FOREIGN KEY (care_category_id) REFERENCES reference.care_categories(id);


--
-- Name: global_products fk_global_products_care_category; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_products
    ADD CONSTRAINT fk_global_products_care_category FOREIGN KEY (care_category_id) REFERENCES reference.care_categories(id);


--
-- Name: lab_act_specimen_containers fk_lab_act_spec_cont_act; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_specimen_containers
    ADD CONSTRAINT fk_lab_act_spec_cont_act FOREIGN KEY (global_act_id) REFERENCES reference.global_actes(id) ON DELETE CASCADE;


--
-- Name: lab_act_specimen_containers fk_lab_act_spec_cont_container; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_specimen_containers
    ADD CONSTRAINT fk_lab_act_spec_cont_container FOREIGN KEY (container_type_id) REFERENCES reference.lab_container_types(id) ON DELETE CASCADE;


--
-- Name: lab_act_specimen_containers fk_lab_act_spec_cont_specimen; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_specimen_containers
    ADD CONSTRAINT fk_lab_act_spec_cont_specimen FOREIGN KEY (specimen_type_id) REFERENCES reference.lab_specimen_types(id) ON DELETE CASCADE;


--
-- Name: lab_act_specimen_containers fk_lab_act_spec_cont_unit; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_specimen_containers
    ADD CONSTRAINT fk_lab_act_spec_cont_unit FOREIGN KEY (volume_unit_id) REFERENCES reference.units(id) ON DELETE SET NULL;


--
-- Name: lab_panels fk_ref_lab_panels_global_act; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_panels
    ADD CONSTRAINT fk_ref_lab_panels_global_act FOREIGN KEY (global_act_id) REFERENCES reference.global_actes(id) ON DELETE RESTRICT;


-- lab_specimen_container_types fk_specimen removed


--
-- Name: global_products fk_tenant_global_products_presc_route; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_products
    ADD CONSTRAINT fk_tenant_global_products_presc_route FOREIGN KEY (default_presc_route) REFERENCES reference.routes(id) ON DELETE SET NULL;


--
-- Name: flowsheet_groups flowsheet_groups_flowsheet_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.flowsheet_groups
    ADD CONSTRAINT flowsheet_groups_flowsheet_id_fkey FOREIGN KEY (flowsheet_id) REFERENCES reference.observation_flowsheets(id) ON DELETE CASCADE;


--
-- Name: flowsheet_groups flowsheet_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.flowsheet_groups
    ADD CONSTRAINT flowsheet_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES reference.observation_groups(id) ON DELETE CASCADE;


--
-- Name: global_actes global_actes_famille_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_actes
    ADD CONSTRAINT global_actes_famille_id_fkey FOREIGN KEY (famille_id) REFERENCES reference.sih_familles(id) ON DELETE SET NULL;


--
-- Name: global_actes global_actes_lab_section_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_actes
    ADD CONSTRAINT global_actes_lab_section_id_fkey FOREIGN KEY (lab_section_id) REFERENCES reference.lab_sections(id);


--
-- Name: global_actes global_actes_lab_sub_section_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_actes
    ADD CONSTRAINT global_actes_lab_sub_section_id_fkey FOREIGN KEY (lab_sub_section_id) REFERENCES reference.lab_sub_sections(id);


--
-- Name: global_actes global_actes_sous_famille_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_actes
    ADD CONSTRAINT global_actes_sous_famille_id_fkey FOREIGN KEY (sous_famille_id) REFERENCES reference.sih_sous_familles(id) ON DELETE SET NULL;


--
-- Name: global_product_price_history global_product_price_history_product_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.global_product_price_history
    ADD CONSTRAINT global_product_price_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES reference.global_products(id) ON DELETE CASCADE;


--
-- Name: group_parameters group_parameters_group_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.group_parameters
    ADD CONSTRAINT group_parameters_group_id_fkey FOREIGN KEY (group_id) REFERENCES reference.observation_groups(id) ON DELETE CASCADE;


--
-- Name: group_parameters group_parameters_parameter_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.group_parameters
    ADD CONSTRAINT group_parameters_parameter_id_fkey FOREIGN KEY (parameter_id) REFERENCES reference.observation_parameters(id) ON DELETE CASCADE;


--
-- Name: lab_act_analytes lab_act_analytes_analyte_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_analytes
    ADD CONSTRAINT lab_act_analytes_analyte_id_fkey FOREIGN KEY (analyte_id) REFERENCES reference.lab_analytes(id);


--
-- Name: lab_act_analytes lab_act_analytes_global_act_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_analytes
    ADD CONSTRAINT lab_act_analytes_global_act_id_fkey FOREIGN KEY (global_act_id) REFERENCES reference.global_actes(id);


--
-- Name: lab_act_contexts lab_act_contexts_analyte_context_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_contexts
    ADD CONSTRAINT lab_act_contexts_analyte_context_id_fkey FOREIGN KEY (analyte_context_id) REFERENCES public.lab_analyte_contexts(id);


--
-- Name: lab_act_contexts lab_act_contexts_global_act_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_contexts
    ADD CONSTRAINT lab_act_contexts_global_act_id_fkey FOREIGN KEY (global_act_id) REFERENCES reference.global_actes(id);


--
-- Name: lab_act_methods lab_act_methods_global_act_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_methods
    ADD CONSTRAINT lab_act_methods_global_act_id_fkey FOREIGN KEY (global_act_id) REFERENCES reference.global_actes(id);


--
-- Name: lab_act_methods lab_act_methods_method_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_methods
    ADD CONSTRAINT lab_act_methods_method_id_fkey FOREIGN KEY (method_id) REFERENCES reference.lab_methods(id);


--
-- Name: lab_act_specimen_types lab_act_specimen_types_global_act_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_specimen_types
    ADD CONSTRAINT lab_act_specimen_types_global_act_id_fkey FOREIGN KEY (global_act_id) REFERENCES reference.global_actes(id);


--
-- Name: lab_act_specimen_types lab_act_specimen_types_specimen_type_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_act_specimen_types
    ADD CONSTRAINT lab_act_specimen_types_specimen_type_id_fkey FOREIGN KEY (specimen_type_id) REFERENCES reference.lab_specimen_types(id);


--
-- Name: lab_analyte_aliases lab_analyte_aliases_analyte_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_aliases
    ADD CONSTRAINT lab_analyte_aliases_analyte_id_fkey FOREIGN KEY (analyte_id) REFERENCES reference.lab_analytes(id);


--
-- Name: lab_analyte_contexts lab_analyte_contexts_analyte_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_contexts
    ADD CONSTRAINT lab_analyte_contexts_analyte_id_fkey FOREIGN KEY (analyte_id) REFERENCES reference.lab_analytes(id);


--
-- Name: lab_analyte_contexts lab_analyte_contexts_method_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_contexts
    ADD CONSTRAINT lab_analyte_contexts_method_id_fkey FOREIGN KEY (method_id) REFERENCES reference.lab_methods(id);


--
-- Name: lab_analyte_contexts lab_analyte_contexts_specimen_type_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_contexts
    ADD CONSTRAINT lab_analyte_contexts_specimen_type_id_fkey FOREIGN KEY (specimen_type_id) REFERENCES reference.lab_specimen_types(id);


--
-- Name: lab_analyte_contexts lab_analyte_contexts_unit_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_contexts
    ADD CONSTRAINT lab_analyte_contexts_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES reference.units(id);


--
-- Name: lab_analyte_reference_ranges lab_analyte_reference_ranges_analyte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_reference_ranges
    ADD CONSTRAINT lab_analyte_reference_ranges_analyte_id_fkey FOREIGN KEY (analyte_id) REFERENCES reference.lab_analytes(id);


--
-- Name: lab_analyte_reference_ranges lab_analyte_reference_ranges_method_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_reference_ranges
    ADD CONSTRAINT lab_analyte_reference_ranges_method_id_fkey FOREIGN KEY (method_id) REFERENCES reference.lab_methods(id);


--
-- Name: lab_analyte_reference_ranges lab_analyte_reference_ranges_specimen_type_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_reference_ranges
    ADD CONSTRAINT lab_analyte_reference_ranges_specimen_type_id_fkey FOREIGN KEY (specimen_type_id) REFERENCES reference.lab_specimen_types(id);


--
-- Name: lab_analyte_reference_ranges lab_analyte_reference_ranges_unit_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_reference_ranges
    ADD CONSTRAINT lab_analyte_reference_ranges_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES reference.units(id);


--
-- Name: lab_analyte_units lab_analyte_units_analyte_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_units
    ADD CONSTRAINT lab_analyte_units_analyte_id_fkey FOREIGN KEY (analyte_id) REFERENCES reference.lab_analytes(id);


--
-- Name: lab_analyte_units lab_analyte_units_unit_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_analyte_units
    ADD CONSTRAINT lab_analyte_units_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES reference.units(id);


--
-- Name: lab_panel_items lab_panel_items_child_global_act_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_panel_items
    ADD CONSTRAINT lab_panel_items_child_global_act_id_fkey FOREIGN KEY (child_global_act_id) REFERENCES reference.global_actes(id);


--
-- Name: lab_panel_items lab_panel_items_child_panel_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_panel_items
    ADD CONSTRAINT lab_panel_items_child_panel_id_fkey FOREIGN KEY (child_panel_id) REFERENCES public.lab_panels(id);


--
-- Name: lab_panel_items lab_panel_items_panel_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_panel_items
    ADD CONSTRAINT lab_panel_items_panel_id_fkey FOREIGN KEY (panel_id) REFERENCES public.lab_panels(id);


--
-- Name: lab_panels lab_panels_section_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_panels
    ADD CONSTRAINT lab_panels_section_id_fkey FOREIGN KEY (section_id) REFERENCES reference.lab_sections(id);


--
-- Name: lab_panels lab_panels_sous_famille_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_panels
    ADD CONSTRAINT lab_panels_sous_famille_id_fkey FOREIGN KEY (sous_famille_id) REFERENCES reference.sih_sous_familles(id);


--
-- Name: lab_panels lab_panels_sub_section_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_panels
    ADD CONSTRAINT lab_panels_sub_section_id_fkey FOREIGN KEY (sub_section_id) REFERENCES reference.lab_sub_sections(id);


--
-- Name: lab_reference_profiles lab_reference_profiles_analyte_context_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_reference_profiles
    ADD CONSTRAINT lab_reference_profiles_analyte_context_id_fkey FOREIGN KEY (analyte_context_id) REFERENCES public.lab_analyte_contexts(id);


--
-- Name: lab_reference_rules lab_reference_rules_canonical_value_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_reference_rules
    ADD CONSTRAINT lab_reference_rules_canonical_value_id_fkey FOREIGN KEY (canonical_value_id) REFERENCES reference.lab_canonical_allowed_values(id);


--
-- Name: lab_reference_rules lab_reference_rules_canonical_value_max_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_reference_rules
    ADD CONSTRAINT lab_reference_rules_canonical_value_max_id_fkey FOREIGN KEY (canonical_value_max_id) REFERENCES reference.lab_canonical_allowed_values(id);


--
-- Name: lab_reference_rules lab_reference_rules_canonical_value_min_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_reference_rules
    ADD CONSTRAINT lab_reference_rules_canonical_value_min_id_fkey FOREIGN KEY (canonical_value_min_id) REFERENCES reference.lab_canonical_allowed_values(id);


--
-- Name: lab_reference_rules lab_reference_rules_profile_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY public.lab_reference_rules
    ADD CONSTRAINT lab_reference_rules_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.lab_reference_profiles(id) ON DELETE CASCADE;


--
-- Name: observation_parameters observation_parameters_unit_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.observation_parameters
    ADD CONSTRAINT observation_parameters_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES reference.units(id) ON DELETE SET NULL;


--
-- Name: sih_sous_familles sih_sous_familles_famille_id_fkey; Type: FK CONSTRAINT; Schema: reference; Owner: sahty
--

ALTER TABLE ONLY reference.sih_sous_familles
    ADD CONSTRAINT sih_sous_familles_famille_id_fkey FOREIGN KEY (famille_id) REFERENCES reference.sih_familles(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

-- Restore search_path for subsequent provisioning queries
SET search_path = public, reference, auth, auth_sync, identity_sync;

-- end of baseline


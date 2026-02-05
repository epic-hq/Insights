-- Billing Schema - Part 2: Types
CREATE TYPE billing.credit_event_type AS ENUM (
    'grant',
    'purchase',
    'spend',
    'expire',
    'refund'
);

CREATE TYPE billing.credit_source AS ENUM (
    'plan',
    'purchase',
    'promo',
    'manual'
);

CREATE TYPE billing.entitlement_source AS ENUM (
    'plan',
    'addon',
    'promo',
    'override'
);

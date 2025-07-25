/**
      ____                 _
     |  _ \               (_)
     | |_) | __ _ ___  ___ _ _   _ _ __ ___  _ __
     |  _ < / _` / __|/ _ \ | | | | '_ ` _ \| '_ \
     | |_) | (_| \__ \  __/ | |_| | | | | | | |_) |
     |____/ \__,_|___/\___| |\__,_|_| |_| |_| .__/
                         _/ |               | |
                        |__/                |_|

     accounts is a starter kit for building SaaS products on top of Supabase.
     Learn more at https://useaccounts.com
 */


/**
  * -------------------------------------------------------
  * Section - accounts schema setup and utility functions
  * -------------------------------------------------------
 */

-- revoke execution by default from public
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA PUBLIC REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Create accounts schema
CREATE SCHEMA IF NOT EXISTS accounts;
GRANT USAGE ON SCHEMA accounts to authenticated;
GRANT USAGE ON SCHEMA accounts to service_role;

/**
  * -------------------------------------------------------
  * Section - Enums
  * -------------------------------------------------------
 */

/**
 * Invitation types are either email or link. Email invitations are sent to
 * a single user and can only be claimed once.  Link invitations can be used multiple times
 * Both expire after 24 hours
 */
DO
$$
    BEGIN
        -- check it account_role already exists on accounts schema
        IF NOT EXISTS(SELECT 1
                      FROM pg_type t
                               JOIN pg_namespace n ON n.oid = t.typnamespace
                      WHERE t.typname = 'invitation_type'
                        AND n.nspname = 'accounts') THEN
            CREATE TYPE accounts.invitation_type AS ENUM ('one_time', '24_hour');
        end if;
    end;
$$;

/**
  accounts.generate_token(length)
  Generates a secure token - used internally for invitation tokens
  but could be used elsewhere.  Check out the invitations table for more info on
  how it's used
 */
CREATE OR REPLACE FUNCTION accounts.generate_token(length int)
    RETURNS text AS
$$
select regexp_replace(replace(
                              replace(replace(replace(encode(gen_random_bytes(length)::bytea, 'base64'), '/', ''), '+',
                                              ''), '\\', ''),
                              '=',
                              ''), E'[\\n\\r]+', '', 'g');
$$ LANGUAGE sql;

grant execute on function accounts.generate_token(int) to authenticated;

/**
  * -------------------------------------------------------
  * Section - accounts settings
  * -------------------------------------------------------
 */

CREATE TABLE IF NOT EXISTS accounts.config
(
    enable_team_accounts            boolean default true,
    enable_personal_account_billing boolean default true,
    enable_team_account_billing     boolean default true,
    billing_provider                text    default 'stripe'
);

-- create config row
INSERT INTO accounts.config (enable_team_accounts, enable_personal_account_billing, enable_team_account_billing)
VALUES (true, true, true);

-- enable select on the config table
GRANT SELECT ON accounts.config TO authenticated, service_role;

-- enable RLS on config
ALTER TABLE accounts.config
    ENABLE ROW LEVEL SECURITY;

create policy "accounts settings can be read by authenticated users" on accounts.config
    for select
    to authenticated
    using (
    true
    );

/**
  * -------------------------------------------------------
  * Section - accounts utility functions
  * -------------------------------------------------------
 */

/**
  accounts.get_config()
  Get the full config object to check accounts settings
  This is not accessible from the outside, so can only be used inside postgres functions
 */
CREATE OR REPLACE FUNCTION accounts.get_config()
    RETURNS json AS
$$
DECLARE
    result RECORD;
BEGIN
    SELECT * from accounts.config limit 1 into result;
    return row_to_json(result);
END;
$$ LANGUAGE plpgsql;

grant execute on function accounts.get_config() to authenticated, service_role;


/**
  accounts.is_set("field_name")
  Check a specific boolean config value
 */
CREATE OR REPLACE FUNCTION accounts.is_set(field_name text)
    RETURNS boolean AS
$$
DECLARE
    result BOOLEAN;
BEGIN
    execute format('select %I from accounts.config limit 1', field_name) into result;
    return result;
END;
$$ LANGUAGE plpgsql;

grant execute on function accounts.is_set(text) to authenticated;


/**
  * Automatic handling for maintaining created_at and updated_at timestamps
  * on tables
 */
CREATE OR REPLACE FUNCTION accounts.trigger_set_timestamps()
    RETURNS TRIGGER AS
$$
BEGIN
    if TG_OP = 'INSERT' then
        NEW.created_at = now();
        NEW.updated_at = now();
    else
        NEW.updated_at = now();
        NEW.created_at = OLD.created_at;
    end if;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;


/**
  * Automatic handling for maintaining created_by and updated_by timestamps
  * on tables
 */
CREATE OR REPLACE FUNCTION accounts.trigger_set_user_tracking()
    RETURNS TRIGGER AS
$$
DECLARE
    has_created_by boolean;
    has_updated_by boolean;
BEGIN
    -- Skip auth.users table entirely
    IF TG_TABLE_SCHEMA = 'auth' AND TG_TABLE_NAME = 'users' THEN
        RETURN NEW;
    END IF;
    
    -- Check if the table has the required columns
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = TG_TABLE_SCHEMA 
        AND table_name = TG_TABLE_NAME 
        AND column_name = 'created_by'
    ) INTO has_created_by;
    
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = TG_TABLE_SCHEMA 
        AND table_name = TG_TABLE_NAME 
        AND column_name = 'updated_by'
    ) INTO has_updated_by;

    -- Only set the fields if they exist
    IF TG_OP = 'INSERT' THEN
        IF has_created_by THEN
            NEW.created_by = auth.uid();
        END IF;
        IF has_updated_by THEN
            NEW.updated_by = auth.uid();
        END IF;
    ELSE
        IF has_updated_by THEN
            NEW.updated_by = auth.uid();
        END IF;
        IF has_created_by THEN
            NEW.created_by = OLD.created_by;
        END IF;
    END IF;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;
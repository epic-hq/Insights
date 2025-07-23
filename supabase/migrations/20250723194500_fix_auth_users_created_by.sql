-- Fix the trigger_set_user_tracking function to handle auth.users table safely
-- This resolves the "record new has no field created_by" error

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

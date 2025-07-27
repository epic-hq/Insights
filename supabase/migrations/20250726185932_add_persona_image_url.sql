-- Add imageUrl field to personas table
ALTER TABLE personas ADD COLUMN image_url TEXT;

-- Add comment for the new column
COMMENT ON COLUMN personas.image_url IS 'URL to persona avatar/profile image';
-- Add request_letter_no field to qmrl table
-- This stores the external/physical request letter reference number

ALTER TABLE qmrl ADD COLUMN request_letter_no TEXT;

-- Add comment for documentation
COMMENT ON COLUMN qmrl.request_letter_no IS 'External request letter reference number';

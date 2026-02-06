-- Add lineage column to stock_returns
ALTER TABLE stock_returns
ADD COLUMN IF NOT EXISTS stock_reservation_id UUID REFERENCES stock_reservations(reservation_id);

-- Add lineage column to stock_return_lines
ALTER TABLE stock_return_lines
ADD COLUMN IF NOT EXISTS stock_reservation_line_id UUID;

-- We can add a FK constraint if we want strict integrity, though stock_reservation_lines are sometimes transient/archived?
-- But the user requested "stock_return_lines MUST reference stock_reservation_lines.id".
-- Assuming stock_reservation_lines 'id' column exists (it's UUID).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_return_line_reservation'
    ) THEN
        ALTER TABLE stock_return_lines
        ADD CONSTRAINT fk_return_line_reservation
        FOREIGN KEY (stock_reservation_line_id)
        REFERENCES stock_reservation_lines(id);
    END IF;
END $$;

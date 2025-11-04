-- Adds cancel deadline columns for reservation slots (SQLite)
BEGIN TRANSACTION;
ALTER TABLE reservation_slots ADD COLUMN cancel_deadline_date_local TEXT NULL;
ALTER TABLE reservation_slots ADD COLUMN cancel_deadline_minute_of_day INTEGER NULL;
COMMIT;

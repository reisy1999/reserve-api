-- Adds cancel deadline columns for reservation slots (MySQL / MariaDB)
ALTER TABLE `reservation_slots`
  ADD COLUMN IF NOT EXISTS `cancel_deadline_date_local` DATE NULL AFTER `notes`,
  ADD COLUMN IF NOT EXISTS `cancel_deadline_minute_of_day` INT NULL AFTER `cancel_deadline_date_local`;

SET NAMES utf8mb4;
SET time_zone = '+07:00';

USE spc_skillcert_online;

ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS signature_url VARCHAR(500) NULL AFTER bio;

-- Add last_seen_badges_count and last_seen_xp to profiles for cross-device gamification tracking

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_seen_badges_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_seen_xp INT DEFAULT 0;

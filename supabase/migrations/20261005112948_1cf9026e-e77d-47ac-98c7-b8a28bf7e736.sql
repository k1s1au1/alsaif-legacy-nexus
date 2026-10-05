ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS occasions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS trips boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS finance boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS community boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requests boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS admin boolean NOT NULL DEFAULT true;
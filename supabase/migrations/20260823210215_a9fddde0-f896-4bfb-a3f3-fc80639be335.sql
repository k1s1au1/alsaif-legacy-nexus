-- Add theme_color column used by the app shell theme sync
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_color text;

-- Restore member read access on NON-SENSITIVE profile columns only.
-- phone & fcm_token stay restricted (accessible via security-definer RPCs for admins/chairman/self).
GRANT SELECT (id, full_name, arabic_name, avatar_url, is_active, created_at, updated_at, first_name, father_name, grandfather_name, parent_id, terms_accepted_at, bottom_nav_prefs, allowed_sections, theme_color) ON public.profiles TO authenticated;

-- Vault metadata must be visible to owners only (remove member-wide read)
DROP POLICY IF EXISTS "All members view vault" ON public.secure_vault;
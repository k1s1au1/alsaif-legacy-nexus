REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, arabic_name, avatar_url, is_active, created_at, updated_at, first_name, father_name, grandfather_name, parent_id, terms_accepted_at, bottom_nav_prefs, allowed_sections, theme_color) ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
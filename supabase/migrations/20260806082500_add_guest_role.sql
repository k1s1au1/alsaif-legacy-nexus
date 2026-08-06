-- 1. Add 'guest' to app_role enum
-- Note: PostgreSQL doesn't allow ALTER TYPE ... ADD VALUE inside a transaction block easily in some versions,
-- but for Supabase it usually works.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guest';

-- 2. Update RLS policies to restrict guest access
-- We want guests to ONLY see: profiles (basic), events, majlis_posts, family_tree_extras, trips.
-- We want to BLOCK them from: messages, finance, vault, tasks, bug_reports.

-- [MESSAGES]
-- Most policies use "authenticated", so we need to refine them to exclude guest.
-- Instead of modifying every policy, we can add a check in a helper or update specific ones.
-- However, since most policies rely on being a "participant", if we ensure guests are never participants,
-- they won't see messages. But a more robust way is updating the base grants or policies.

-- Create a helper function to check if a user is a guest
CREATE OR REPLACE FUNCTION public.is_guest(_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'guest'
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- [RESTRICT CONVERSATIONS]
-- Guests should not be able to see or join any conversation.
-- We'll add a condition to existing policies or create a restrictive one.
-- Assuming most policies check 'authenticated'.

-- [RESTRICT FINANCE]
DROP POLICY IF EXISTS "All members view transfers" ON public.bank_transfers;
CREATE POLICY "All members view transfers" ON public.bank_transfers
FOR SELECT TO authenticated USING (NOT public.is_guest(auth.uid()));

DROP POLICY IF EXISTS "All members view transactions" ON public.fund_transactions;
CREATE POLICY "All members view transactions" ON public.fund_transactions
FOR SELECT TO authenticated USING (NOT public.is_guest(auth.uid()));

-- [RESTRICT VAULT]
DROP POLICY IF EXISTS "All members view vault" ON public.secure_vault;
CREATE POLICY "All members view vault" ON public.secure_vault
FOR SELECT TO authenticated USING (NOT public.is_guest(auth.uid()));

-- [RESTRICT TASKS]
DROP POLICY IF EXISTS "Read All Tasks" ON public.tasks;
CREATE POLICY "Read All Tasks" ON public.tasks
FOR SELECT TO authenticated USING (NOT public.is_guest(auth.uid()));

-- [RESTRICT ANONYMOUS SUGGESTIONS]
-- (Only author or admin usually, so guest is naturally restricted if not an admin)

-- [RESTRICT BUG REPORTS]
DROP POLICY IF EXISTS "Users view own reports" ON public.bug_reports;
CREATE POLICY "Users view own reports" ON public.bug_reports
FOR SELECT TO authenticated USING (auth.uid() = reporter_id AND NOT public.is_guest(auth.uid()));

-- [RESTRICT MAJLIS COMMENTS]
-- Guests can read posts but maybe shouldn't comment?
-- Let's allow reading posts/comments but block writing for now.
DROP POLICY IF EXISTS "Members can comment" ON public.majlis_comments;
CREATE POLICY "Members can comment" ON public.majlis_comments
FOR INSERT TO authenticated WITH CHECK (NOT public.is_guest(auth.uid()));

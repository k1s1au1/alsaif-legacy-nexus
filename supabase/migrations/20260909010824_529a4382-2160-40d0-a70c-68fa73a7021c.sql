ALTER TABLE public.section_heads DROP CONSTRAINT IF EXISTS section_heads_section_check;

UPDATE public.section_heads
SET section = public.normalize_section(section)
WHERE section <> public.normalize_section(section);

DELETE FROM public.section_heads a
USING public.section_heads b
WHERE a.user_id = b.user_id
  AND a.section = b.section
  AND a.ctid > b.ctid;

DELETE FROM public.section_heads
WHERE section NOT IN ('meetings','trips','occasions','tasks','news','community','faith','heritage','finance');

ALTER TABLE public.section_heads
  ADD CONSTRAINT section_heads_section_check
  CHECK (section IN ('meetings','trips','occasions','tasks','news','community','faith','heritage','finance'));
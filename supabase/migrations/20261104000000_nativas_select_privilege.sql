-- RLS controls which ficha rows are visible; authenticated still needs the
-- table-level SELECT privilege for those policies to be evaluated.
grant select on table public.nativas to authenticated;

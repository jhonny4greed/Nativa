-- Painel administrativo: papel de administrador em profiles e allowlist de
-- geração de imagens gerenciável via Edge Function com chave de serviço.

alter table public.profiles
  add column role text not null default 'player' check (role in ('player', 'admin'));

create table public.image_generation_allowlist (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.image_generation_allowlist enable row level security;
revoke all on table public.image_generation_allowlist from public, anon, authenticated;

-- Helper security definer: políticas não podem consultar a própria tabela
-- profiles sem recursão infinita.
create or replace function nativa_private.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin')
$$;
revoke all on function nativa_private.is_admin(uuid) from public, anon, authenticated;

-- Administradores leem todos os perfis; a política anterior continua valendo
-- para o próprio usuário e pares de sala.
create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (nativa_private.is_admin(auth.uid()));

-- Conta de administração criada para o projeto.
update public.profiles
  set role = 'admin'
  where id in (select id from auth.users where email = 'teste@gmail.com');

-- A medias · esquema de base de datos
-- Ejecutar una sola vez en Supabase > SQL Editor.

-- 1. Gastos
create table if not exists public.gastos (
  id          uuid primary key default gen_random_uuid(),
  amount_cents integer not null check (amount_cents > 0),
  payer       text not null check (payer in ('elena', 'nacho')),
  category    text not null default 'otros'
              check (category in ('super', 'fuera', 'ocio', 'casa', 'transporte', 'otros')),
  spent_at    timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists gastos_spent_at_idx on public.gastos (spent_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists gastos_touch on public.gastos;
create trigger gastos_touch before update on public.gastos
  for each row execute function public.touch_updated_at();

-- 2. Lista de emails con acceso
create table if not exists public.miembros (
  email text primary key
);
alter table public.miembros enable row level security;
-- Sin políticas: nadie puede leer ni tocar esta tabla desde la web.

create or replace function public.es_miembro()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.miembros
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

grant execute on function public.es_miembro() to authenticated;

-- 3. Seguridad: solo los miembros leen y escriben gastos
alter table public.gastos enable row level security;

drop policy if exists "miembros leen" on public.gastos;
drop policy if exists "miembros crean" on public.gastos;
drop policy if exists "miembros editan" on public.gastos;
drop policy if exists "miembros borran" on public.gastos;

create policy "miembros leen"   on public.gastos for select to authenticated using (public.es_miembro());
create policy "miembros crean"  on public.gastos for insert to authenticated with check (public.es_miembro());
create policy "miembros editan" on public.gastos for update to authenticated using (public.es_miembro()) with check (public.es_miembro());
create policy "miembros borran" on public.gastos for delete to authenticated using (public.es_miembro());

-- 4. Tiempo real: lo que apunta uno aparece al momento en la pantalla del otro
do $$
begin
  alter publication supabase_realtime add table public.gastos;
exception when duplicate_object then null;
end $$;

-- 5. Añadid vuestros emails. NO subáis este paso con emails reales al repo:
--    ejecutadlo solo en el SQL Editor, cambiando los valores.
-- insert into public.miembros (email) values ('email-de-elena@ejemplo.com'), ('email-de-nacho@ejemplo.com');

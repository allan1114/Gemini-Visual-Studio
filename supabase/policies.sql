-- Recommended Row Level Security (RLS) policies for Gemini Visual Studio.
--
-- This file is documentation / a migration template. Review against your actual
-- schema (e.g. via the Supabase dashboard or `list_tables`) before applying.
-- Apply manually in the Supabase SQL editor or via the CLI; it is intentionally
-- NOT auto-run by the app.
--
-- Threat model: the client ships only the anon (public) key, so the database
-- must enforce per-user isolation. Every table keyed by a user must restrict
-- rows to `auth.uid()`.

-- =====================================================================
-- studio_entries: generation history (one row per generated image)
-- =====================================================================
alter table public.studio_entries enable row level security;

create policy "studio_entries_select_own"
  on public.studio_entries for select
  using (auth.uid() = user_id);

create policy "studio_entries_insert_own"
  on public.studio_entries for insert
  with check (auth.uid() = user_id);

create policy "studio_entries_update_own"
  on public.studio_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "studio_entries_delete_own"
  on public.studio_entries for delete
  using (auth.uid() = user_id);

-- =====================================================================
-- presets: saved generation presets
-- =====================================================================
alter table public.presets enable row level security;

create policy "presets_select_own"
  on public.presets for select
  using (auth.uid() = user_id);

create policy "presets_insert_own"
  on public.presets for insert
  with check (auth.uid() = user_id);

create policy "presets_update_own"
  on public.presets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "presets_delete_own"
  on public.presets for delete
  using (auth.uid() = user_id);

-- =====================================================================
-- profiles: user profile + is_admin flag
-- A user may read/update their own profile, but MUST NOT be able to grant
-- themselves admin. Keep is_admin writable only by the service role.
-- =====================================================================
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own_non_admin"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Prevent privilege escalation: block any change to is_admin from the client.
-- (Requires is_admin to be altered only via the service role / a SECURITY
-- DEFINER function. This trigger rejects client-side changes to the flag.)
create or replace function public.prevent_is_admin_change()
  returns trigger
  language plpgsql
  security definer
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin can only be modified by an administrator';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_is_admin_change on public.profiles;
create trigger trg_prevent_is_admin_change
  before update on public.profiles
  for each row execute function public.prevent_is_admin_change();

-- =====================================================================
-- Storage bucket: images (objects stored at `${user_id}/${entry_id}.webp`)
-- The first path segment must match the authenticated user's id.
-- =====================================================================
create policy "images_select_own"
  on storage.objects for select
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "images_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "images_delete_own"
  on storage.objects for delete
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

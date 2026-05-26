create table public.features (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  constraint features_project_name_unique unique (project_id, name)
);

alter table public.features enable row level security;

create policy "users see own features"
  on public.features for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = features.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users insert own features"
  on public.features for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = features.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users update own features"
  on public.features for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = features.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "users delete own features"
  on public.features for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = features.project_id
        and projects.user_id = auth.uid()
    )
  );

create index features_project_id_idx on public.features(project_id);

alter table public.tasks
  add column feature_id uuid references public.features(id) on delete set null;

create index tasks_feature_id_idx on public.tasks(feature_id);

-- Video Studio Foundation V1: additive, private, server-only persistence.
create table if not exists public.video_production_projects (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
  version integer not null default 1 check (version > 0), name text not null,
  status text not null check (status in ('DRAFT','READY','RUNNING','REVIEW','COMPLETE','ARCHIVED')),
  current_snapshot jsonb, created_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id,id)
);
create index if not exists idx_video_projects_workspace_updated on public.video_production_projects(workspace_id,updated_at desc);

create table if not exists public.video_generation_jobs (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
  project_id uuid not null,
  created_by uuid not null, input_snapshot jsonb not null, input_fingerprint text not null check(input_fingerprint ~ '^[a-f0-9]{64}$'),
  estimate jsonb not null, status text not null check(status in ('awaiting_confirmation','confirmed','running','succeeded','failed','unknown_outcome','cancelled')),
  confirmation_expires_at timestamptz not null, confirmed_by uuid, confirmed_at timestamptz,
  attempt_count integer not null default 0 check(attempt_count >= 0), provider_request_id text,
  result_asset_id uuid, failure_code text, failure_message text, safe_retry_allowed boolean not null default false,
  unknown_outcome_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id,input_fingerprint), unique(workspace_id,id),
  foreign key(workspace_id,project_id) references public.video_production_projects(workspace_id,id) on delete restrict
);
create index if not exists idx_video_jobs_workspace_updated on public.video_generation_jobs(workspace_id,updated_at desc);
create index if not exists idx_video_jobs_project on public.video_generation_jobs(workspace_id,project_id,created_at desc);

create table if not exists public.video_production_assets (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
  project_id uuid not null,
  job_id uuid not null unique,
  input_fingerprint text not null check(input_fingerprint ~ '^[a-f0-9]{64}$'), storage_path text not null,
  checksum text not null check(checksum ~ '^[a-f0-9]{64}$'), mime_type text not null,
  provider text not null, model text not null, provider_request_id text not null,
  source_image_asset_id uuid not null references public.image_production_assets(id) on delete restrict,
  duration_seconds numeric not null check(duration_seconds > 0), aspect_ratio text not null check(aspect_ratio in ('9:16','4:5','1:1','16:9')),
  width integer, height integer, codec text, container text, provenance jsonb not null,
  review_status text not null default 'REVIEW_REQUIRED' check(review_status in ('REVIEW_REQUIRED','APPROVED','REJECTED')),
  review_checklist jsonb, reviewed_by uuid, reviewed_at timestamptz, review_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id,storage_path), unique(workspace_id,id),
  foreign key(workspace_id,project_id) references public.video_production_projects(workspace_id,id) on delete restrict,
  foreign key(workspace_id,job_id) references public.video_generation_jobs(workspace_id,id) on delete restrict
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'video_generation_jobs_result_asset_fk') then
    alter table public.video_generation_jobs add constraint video_generation_jobs_result_asset_fk foreign key(workspace_id,result_asset_id) references public.video_production_assets(workspace_id,id) on delete restrict;
  end if;
end $$;
create index if not exists idx_video_assets_workspace_review on public.video_production_assets(workspace_id,review_status,created_at desc);
create or replace function public.enforce_video_source_workspace() returns trigger language plpgsql set search_path=public as $$
begin
  if not exists (select 1 from public.image_production_assets i where i.id=new.source_image_asset_id and i.workspace_id=new.workspace_id and i.review_status='APPROVED') then
    raise exception 'Video source image must be APPROVED and belong to the same workspace';
  end if;
  return new;
end $$;
create or replace trigger trg_video_source_workspace before insert or update of source_image_asset_id,workspace_id on public.video_production_assets for each row execute function public.enforce_video_source_workspace();


create or replace function public.claim_video_generation_job(p_job_id uuid,p_workspace_id uuid,p_fingerprint text,p_now timestamptz)
returns setof public.video_generation_jobs language plpgsql security definer set search_path=public as $$
begin
  return query update public.video_generation_jobs
  set status='running',attempt_count=attempt_count+1,updated_at=p_now
  where id=p_job_id and workspace_id=p_workspace_id and input_fingerprint=p_fingerprint
    and status='confirmed' and confirmed_at is not null and confirmation_expires_at > p_now
  returning *;
end $$;

alter table public.video_production_projects enable row level security;
alter table public.video_generation_jobs enable row level security;
alter table public.video_production_assets enable row level security;
revoke all on public.video_production_projects,public.video_generation_jobs,public.video_production_assets from public,anon,authenticated;
grant all on public.video_production_projects,public.video_generation_jobs,public.video_production_assets to service_role;
revoke all on function public.claim_video_generation_job(uuid,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_video_generation_job(uuid,uuid,text,timestamptz) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('video-production-assets','video-production-assets',false,524288000,array['video/mp4','video/webm','application/vnd.nexhq.fake-video+json'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

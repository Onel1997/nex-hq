-- Owner-facing Artwork display name is metadata only.
-- Does not change Artwork ID, design ID, version, checksum, storage path, or approval status.
-- Additive only. Intentionally unapplied until a separate controlled preflight.

alter table public.design_master_artworks
  add column if not exists display_name text
    check (
      display_name is null
      or (
        char_length(btrim(display_name)) between 1 and 120
        and display_name = btrim(display_name)
      )
    ),
  add column if not exists original_file_name text
    check (
      original_file_name is null
      or (
        char_length(btrim(original_file_name)) between 1 and 255
        and original_file_name = btrim(original_file_name)
      )
    );

grant update (display_name) on public.design_master_artworks to service_role;

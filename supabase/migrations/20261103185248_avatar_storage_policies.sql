-- Profile pictures live at avatars/{user_id}/{file}. Members may write only
-- inside their own folder; admins may remove anyone's (moderation). Reads go
-- through the bucket's public URLs, so SELECT here only serves upsert/listing.
-- Before this, the bucket had no policies, so every avatar upload was refused.

create policy "Members can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (public.is_approved() or public.is_admin())
  );

create policy "Members can replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Members see their own avatars, admins see all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "Members delete their own avatars, admins delete any"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

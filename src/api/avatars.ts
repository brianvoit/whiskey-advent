import { supabase } from "../supabaseClient";
import { compressImage } from "../utils/compressImage";
import type { SquareCrop } from "../utils/squareCrop";

const BUCKET = "avatars";

/**
 * Crops the photo to a 512px WebP square (JPEG on Safari) and uploads it to Supabase
 * Storage under avatars/{userId}/{timestamp}.{ext},
 * and updates the user's profile row with the new public URL.
 *
 * Requires a Supabase Storage bucket named "avatars" with:
 *   - Public read access
 *   - RLS policy: authenticated users can INSERT/UPDATE paths starting with their user_id
 *
 * @returns The new public avatar URL
 */
export async function uploadAvatar(
  userId: string,
  file: File,
  crop: SquareCrop | "center" = "center"
): Promise<string> {
  const { blob, ext } = await compressImage(file, { maxSide: 512, crop });
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  // Persist the URL to the profiles table
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", userId);

  if (updateError) throw updateError;

  // Tidy up earlier uploads so a replaced photo doesn't linger in storage.
  // The new photo is already saved, so a failure here isn't worth an error.
  await removeStoredAvatars(userId, path).catch((err) =>
    console.warn("Couldn't remove old avatar files", err)
  );

  return publicUrl;
}

const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

/** True for a picture someone uploaded here, as opposed to their Google photo. */
export function isUploadedAvatar(url: string | null | undefined): boolean {
  return Boolean(url && url.includes(PUBLIC_PREFIX));
}

/** Deletes every stored file in the person's avatar folder except `keep`. */
async function removeStoredAvatars(userId: string, keep?: string): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).list(userId);
  if (error) throw error;
  const paths = (data ?? [])
    .map((f) => `${userId}/${f.name}`)
    .filter((p) => p !== keep);
  if (paths.length === 0) return;
  const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
  if (removeError) throw removeError;
}

/**
 * Admin moderation: deletes someone's uploaded profile picture and clears it
 * from their profile. People who sign in with Google get their Google photo
 * back the next time they sign in; everyone else shows their initials.
 */
export async function removeAvatar(userId: string): Promise<void> {
  await removeStoredAvatars(userId);
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", userId);
  if (error) throw error;
}

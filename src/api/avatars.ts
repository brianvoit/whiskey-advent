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

  return publicUrl;
}

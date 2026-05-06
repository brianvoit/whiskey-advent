import { supabase } from "../supabaseClient";

const BUCKET = "avatars";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Uploads an image file to Supabase Storage under avatars/{userId}/{timestamp}.{ext}
 * and updates the user's profile row with the new public URL.
 *
 * Requires a Supabase Storage bucket named "avatars" with:
 *   - Public read access
 *   - RLS policy: authenticated users can INSERT/UPDATE paths starting with their user_id
 *
 * @returns The new public avatar URL
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("Image must be smaller than 5 MB.");
  }

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!
    : "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

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

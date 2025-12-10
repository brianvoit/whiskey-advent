

import { supabase } from "../supabaseClient";

export type ReactionType = "thumbs_up" | "cheers" | "idea" | "laugh";

export type Comment = {
  id: string;
  season_id: number;
  whiskey_day_id: number;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export type CommentAuthor = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export type CommentWithMeta = Comment & {
  author?: CommentAuthor;
  reactions: {
    thumbs_up: number;
    cheers: number;
    idea: number;
    laugh: number;
  };
  userReactions: ReactionType[];
};

/**
 * Fetch all comments for a given season + whiskey day, with:
 * - author info (from profiles)
 * - aggregated reaction counts
 * - which reactions the current user has made on each comment
 */
export async function getCommentsForDay(
  seasonId: number,
  whiskeyDayId: number,
  currentUserId?: string
): Promise<CommentWithMeta[]> {
  // 1. Load comments for this day
  const { data: commentRows, error: commentsError } = await supabase
    .from("comments")
    .select("*")
    .eq("season_id", seasonId)
    .eq("whiskey_day_id", whiskeyDayId)
    .order("created_at", { ascending: true });

  if (commentsError) {
    console.error("Error loading comments", commentsError);
    throw commentsError;
  }

  if (!commentRows || commentRows.length === 0) {
    return [];
  }

  const comments = commentRows as Comment[];

  const commentIds = comments.map((c) => c.id);
  const authorIds = Array.from(
    new Set(comments.map((c) => c.user_id).filter(Boolean))
  );

  // 2. Load reactions for these comments
  const { data: reactionRows, error: reactionsError } = await supabase
    .from("comment_reactions")
    .select("*")
    .in("comment_id", commentIds);

  if (reactionsError) {
    console.error("Error loading comment reactions", reactionsError);
    throw reactionsError;
  }

  // Build reaction aggregates
  const reactionCounts = new Map<
    string,
    {
      thumbs_up: number;
      cheers: number;
      idea: number;
      laugh: number;
    }
  >();

  const userReactions = new Map<string, Set<ReactionType>>();

  (reactionRows ?? []).forEach((row: any) => {
    const commentId: string = row.comment_id;
    const type: ReactionType = row.reaction_type;

    if (!reactionCounts.has(commentId)) {
      reactionCounts.set(commentId, {
        thumbs_up: 0,
        cheers: 0,
        idea: 0,
        laugh: 0,
      });
    }

    const counts = reactionCounts.get(commentId)!;
    if (type === "thumbs_up") counts.thumbs_up += 1;
    if (type === "cheers") counts.cheers += 1;
    if (type === "idea") counts.idea += 1;
    if (type === "laugh") counts.laugh += 1;

    if (currentUserId && row.user_id === currentUserId) {
      if (!userReactions.has(commentId)) {
        userReactions.set(commentId, new Set<ReactionType>());
      }
      userReactions.get(commentId)!.add(type);
    }
  });

  // 3. Load author profile info
  const { data: authorRows, error: authorsError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", authorIds);

  if (authorsError) {
    console.error("Error loading comment authors", authorsError);
    throw authorsError;
  }

  const authorMap = new Map<string, CommentAuthor>();
  (authorRows ?? []).forEach((row: any) => {
    authorMap.set(row.id, {
      id: row.id,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      avatar_url: row.avatar_url ?? null,
    });
  });

  // 4. Compose final results
  const withMeta: CommentWithMeta[] = comments.map((c) => {
    const counts =
      reactionCounts.get(c.id) ?? {
        thumbs_up: 0,
        cheers: 0,
        idea: 0,
        laugh: 0,
      };

    const userSet = userReactions.get(c.id) ?? new Set<ReactionType>();

    return {
      ...c,
      author: authorMap.get(c.user_id),
      reactions: counts,
      userReactions: Array.from(userSet),
    };
  });

  return withMeta;
}

type PostCommentInput = {
  seasonId: number;
  whiskeyDayId: number;
  userId: string;
  body: string;
  parentCommentId?: string | null;
};

/**
 * Create a new comment or reply.
 * Returns the raw comment row; caller may choose to re-fetch the full list.
 */
export async function postComment(
  input: PostCommentInput
): Promise<Comment> {
  const { seasonId, whiskeyDayId, userId, body, parentCommentId } = input;

  const { data, error } = await supabase
    .from("comments")
    .insert({
      season_id: seasonId,
      whiskey_day_id: whiskeyDayId,
      user_id: userId,
      body,
      parent_comment_id: parentCommentId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error posting comment", error);
    throw error;
  }

  return data as Comment;
}

type ToggleReactionInput = {
  commentId: string;
  userId: string;
  reactionType: ReactionType;
};

/**
 * Toggle a reaction for the current user on a given comment.
 * - If the reaction exists, it is removed.
 * - If it does not exist, it is created.
 */
export async function toggleReaction(
  input: ToggleReactionInput
): Promise<void> {
  const { commentId, userId, reactionType } = input;

  // Check if reaction already exists
  const { data: existingRows, error: existingError } = await supabase
    .from("comment_reactions")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .eq("reaction_type", reactionType);

  if (existingError) {
    console.error("Error checking existing reaction", existingError);
    throw existingError;
  }

  if (existingRows && existingRows.length > 0) {
    // Remove the existing reaction (toggle off)
    const { error: deleteError } = await supabase
      .from("comment_reactions")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .eq("reaction_type", reactionType);

    if (deleteError) {
      console.error("Error removing reaction", deleteError);
      throw deleteError;
    }

    return;
  }

  // Add a new reaction
  const { error: insertError } = await supabase
    .from("comment_reactions")
    .insert({
      comment_id: commentId,
      user_id: userId,
      reaction_type: reactionType,
    });

  if (insertError) {
    console.error("Error adding reaction", insertError);
    throw insertError;
  }
}

/**
 * Delete a comment and its replies + reactions.
 * This relies on ON DELETE CASCADE in the database schema:
 * - comment_reactions.comment_id -> comments.id
 * - comments.parent_comment_id -> comments.id
 */
export async function deleteCommentThread(commentId: string): Promise<void> {
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("Error deleting comment thread", error);
    throw error;
  }
}
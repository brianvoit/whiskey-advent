import { useEffect, useState } from "react";
import { useTheme } from "@mui/material/styles";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import CommentsSection from "./components/CommentsSection";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined"; // cheers
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import EmojiEmotionsOutlinedIcon from "@mui/icons-material/EmojiEmotionsOutlined";

import {
  getCommentsForDay,
  postComment,
  toggleReaction,
  deleteCommentThread,
  type CommentWithMeta,
  type ReactionType,
} from "../api/comments";

type CommentsSectionProps = {
  seasonId: number;
  whiskeyDayId: number;
  userId: string;
  isAdmin: boolean;
};

function formatDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string {
  const first = firstName ?? "";
  const last = lastName ?? "";
  const combined = `${first} ${last}`.trim();
  return combined || "Anonymous";
}

function getInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string {
  const firstInitial = (firstName ?? "").trim().charAt(0).toUpperCase();
  const lastInitial = (lastName ?? "").trim().charAt(0).toUpperCase();
  const joined = `${firstInitial}${lastInitial}`.trim();
  return joined || "?";
}

const reactionOrder: ReactionType[] = [
  "thumbs_up",
  "cheers",
  "idea",
  "laugh",
];

const reactionIcons: Record<ReactionType, JSX.Element> = {
  thumbs_up: <ThumbUpOffAltIcon fontSize="small" />, // will recolor when active
  cheers: <EmojiEventsOutlinedIcon fontSize="small" />,
  idea: <LightbulbOutlinedIcon fontSize="small" />,
  laugh: <EmojiEmotionsOutlinedIcon fontSize="small" />,
};

export default function CommentsSection({
  seasonId,
  whiskeyDayId,
  userId,
  isAdmin,
}: CommentsSectionProps) {
  const theme = useTheme();

  const [comments, setComments] = useState<CommentWithMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [newBody, setNewBody] = useState<string>("");
  const [posting, setPosting] = useState<boolean>(false);

  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyToName, setReplyToName] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCommentsForDay(seasonId, whiskeyDayId, userId);
        if (!isMounted) return;
        setComments(data);
      } catch (err: any) {
        console.error("Error loading comments", err);
        if (!isMounted) return;
        setError("Error loading comments");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [seasonId, whiskeyDayId, userId]);

  const refreshComments = async () => {
    try {
      const data = await getCommentsForDay(seasonId, whiskeyDayId, userId);
      setComments(data);
    } catch (err: any) {
      console.error("Error refreshing comments", err);
      setError("Error loading comments");
    }
  };

  const handleSend = async () => {
    const trimmed = newBody.trim();
    if (!trimmed) return;

    setPosting(true);
    setError(null);
    try {
      await postComment({
        seasonId,
        whiskeyDayId,
        userId,
        body: trimmed,
        parentCommentId: replyToId ?? null,
      });

      setNewBody("");
      setReplyToId(null);
      setReplyToName(null);
      await refreshComments();
    } catch (err: any) {
      console.error("Error posting comment", err);
      setError("Error posting comment");
    } finally {
      setPosting(false);
    }
  };

  const handleToggleReaction = async (
    commentId: string,
    reactionType: ReactionType
  ) => {
    try {
      await toggleReaction({ commentId, userId, reactionType });
      await refreshComments();
    } catch (err: any) {
      console.error("Error toggling reaction", err);
      setError("Error updating reaction");
    }
  };

  const handleDelete = async (commentId: string) => {
    const confirmed = window.confirm(
      "Delete this comment and its replies? This cannot be undone."
    );
    if (!confirmed) return;

    try {
      await deleteCommentThread(commentId);
      await refreshComments();
    } catch (err: any) {
      console.error("Error deleting comment", err);
      setError("Error deleting comment");
    }
  };

  const rootComments = comments.filter((c) => !c.parent_comment_id);
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parent_comment_id === parentId);

  const isSendDisabled = posting || newBody.trim().length === 0;

  const composerBorder = `1px solid ${theme.palette.divider}`;

  return (
    <div
      style={{
        marginTop: 32,
        marginBottom: 32,
        maxWidth: 640,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      <Divider style={{ marginBottom: 16 }} />

      <Typography
        variant="h6"
        component="h2"
        style={{
          marginBottom: 12,
          fontWeight: 600,
        }}
      >
        Comments
      </Typography>

      {/* Error message */}
      {error && (
        <Typography
          variant="body2"
          color="error"
          style={{ marginBottom: 8 }}
        >
          {error}
        </Typography>
      )}

      {/* Composer */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: 12,
          borderRadius: theme.shape.borderRadius,
          border: composerBorder,
          backgroundColor: theme.palette.background.paper,
          marginBottom: 16,
        }}
      >
        {/* We don’t have the current user profile here, so we just use a generic avatar. */}
        <Avatar
          sx={{
            width: 36,
            height: 36,
            fontSize: 14,
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
          }}
        >
          {/* Could be improved later by passing profile initials in props */}
          •
        </Avatar>

        <div style={{ flex: 1 }}>
          {replyToId && replyToName && (
            <Typography
              variant="caption"
              color="text.secondary"
              style={{ marginBottom: 4, display: "block" }}
            >
              Replying to {replyToName}
            </Typography>
          )}

          <TextField
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder={replyToId ? "Write a reply…" : "Add a comment…"}
            multiline
            minRows={2}
            maxRows={6}
            fullWidth
            variant="outlined"
            size="small"
          />

          <div
            style={{
              marginTop: 8,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            {replyToId && (
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setReplyToId(null);
                  setReplyToName(null);
                }}
              >
                Cancel reply
              </Button>
            )}

            <Button
              size="small"
              variant="contained"
              onClick={handleSend}
              disabled={isSendDisabled}
            >
              {posting ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <CircularProgress size={20} />
        </div>
      )}

      {/* Empty state */}
      {!loading && rootComments.length === 0 && (
        <Typography
          variant="body2"
          color="text.secondary"
          style={{ fontStyle: "italic" }}
        >
          No comments yet.
        </Typography>
      )}

      {/* Comments list */}
      {!loading && rootComments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rootComments.map((comment) => {
            const replies = getReplies(comment.id);
            const author = comment.author;
            const displayName = formatDisplayName(
              author?.first_name,
              author?.last_name
            );
            const initials = getInitials(
              author?.first_name,
              author?.last_name
            );

            const created = new Date(comment.created_at);
            const createdLabel = created.toLocaleString();

            const userReactionSet = new Set(comment.userReactions);

            return (
              <div
                key={comment.id}
                style={{
                  padding: 12,
                  borderRadius: theme.shape.borderRadius,
                  border: `1px solid ${theme.palette.divider}`,
                  backgroundColor: theme.palette.background.paper,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <Avatar
                    src={author?.avatar_url ?? undefined}
                    sx={{
                      width: 32,
                      height: 32,
                      fontSize: 13,
                      backgroundColor: theme.palette.secondary.main,
                      color: theme.palette.secondary.contrastText,
                    }}
                  >
                    {initials}
                  </Avatar>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <Typography
                        variant="body2"
                        style={{ fontWeight: 600 }}
                      >
                        {displayName}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {createdLabel}
                      </Typography>
                    </div>

                    <Typography
                      variant="body2"
                      style={{ marginTop: 4, whiteSpace: "pre-wrap" }}
                    >
                      {comment.body}
                    </Typography>

                    {/* Reactions row */}
                    <div
                      style={{
                        marginTop: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {reactionOrder.map((type) => {
                        const count = comment.reactions[type];
                        const isActive = userReactionSet.has(type);

                        return (
                          <div
                            key={type}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            <IconButton
                              size="small"
                              onClick={() =>
                                handleToggleReaction(comment.id, type)
                              }
                              style={{
                                padding: 2,
                                opacity: count === 0 && !isActive ? 0.5 : 1,
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: isActive
                                    ? theme.palette.primary.main
                                    : theme.palette.text.secondary,
                                }}
                              >
                                {reactionIcons[type]}
                              </span>
                            </IconButton>
                            {count > 0 && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {count}
                              </Typography>
                            )}
                          </div>
                        );
                      })}

                      {/* Reply + Delete actions */}
                      <div style={{ flexGrow: 1 }} />

                      <Button
                        size="small"
                        variant="text"
                        onClick={() => {
                          setReplyToId(comment.id);
                          setReplyToName(displayName);
                        }}
                      >
                        Reply
                      </Button>

                      {isAdmin && (
                        <Button
                          size="small"
                          variant="text"
                          color="error"
                          onClick={() => handleDelete(comment.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>

                    {/* Replies */}
                    {replies.length > 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          paddingLeft: 32,
                          borderLeft: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        {replies.map((reply) => {
                          const replyAuthor = reply.author;
                          const replyName = formatDisplayName(
                            replyAuthor?.first_name,
                            replyAuthor?.last_name
                          );
                          const replyInitials = getInitials(
                            replyAuthor?.first_name,
                            replyAuthor?.last_name
                          );
                          const replyCreated = new Date(reply.created_at);
                          const replyCreatedLabel =
                            replyCreated.toLocaleString();

                          const replyUserReactionSet = new Set(
                            reply.userReactions
                          );

                          return (
                            <div
                              key={reply.id}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 8,
                              }}
                            >
                              <Avatar
                                src={replyAuthor?.avatar_url ?? undefined}
                                sx={{
                                  width: 28,
                                  height: 28,
                                  fontSize: 12,
                                  backgroundColor: theme.palette.secondary.main,
                                  color:
                                    theme.palette.secondary.contrastText,
                                }}
                              >
                                {replyInitials}
                              </Avatar>

                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "baseline",
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    style={{ fontWeight: 600 }}
                                  >
                                    {replyName}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {replyCreatedLabel}
                                  </Typography>
                                </div>

                                <Typography
                                  variant="body2"
                                  style={{
                                    marginTop: 4,
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {reply.body}
                                </Typography>

                                <div
                                  style={{
                                    marginTop: 6,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {reactionOrder.map((type) => {
                                    const count = reply.reactions[type];
                                    const isActive =
                                      replyUserReactionSet.has(type);

                                    return (
                                      <div
                                        key={type}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 2,
                                        }}
                                      >
                                        <IconButton
                                          size="small"
                                          onClick={() =>
                                            handleToggleReaction(
                                              reply.id,
                                              type
                                            )
                                          }
                                          style={{
                                            padding: 2,
                                            opacity:
                                              count === 0 && !isActive
                                                ? 0.5
                                                : 1,
                                          }}
                                        >
                                          <span
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              color: isActive
                                                ? theme.palette.primary.main
                                                : theme.palette.text
                                                    .secondary,
                                            }}
                                          >
                                            {reactionIcons[type]}
                                          </span>
                                        </IconButton>
                                        {count > 0 && (
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                          >
                                            {count}
                                          </Typography>
                                        )}
                                      </div>
                                    );
                                  })}

                                  <div style={{ flexGrow: 1 }} />

                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => {
                                      setReplyToId(reply.id);
                                      setReplyToName(replyName);
                                    }}
                                  >
                                    Reply
                                  </Button>

                                  {isAdmin && (
                                    <Button
                                      size="small"
                                      variant="text"
                                      color="error"
                                      onClick={() =>
                                        handleDelete(reply.id)
                                      }
                                    >
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

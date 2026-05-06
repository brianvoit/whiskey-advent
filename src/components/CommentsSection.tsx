import { useEffect, useState, type JSX } from "react";
import { useTheme } from "@mui/material/styles";
import UserAvatar from "./UserAvatar";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
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
  currentUser?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
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


function formatDateTimeLabel(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}

const reactionOrder: ReactionType[] = ["thumbs_up", "cheers", "idea", "laugh"];

const reactionIcons: Record<ReactionType, JSX.Element> = {
  thumbs_up: <ThumbUpOffAltIcon fontSize="small" />, // will recolor when active
  cheers: <EmojiEventsOutlinedIcon fontSize="small" />,
  idea: <LightbulbOutlinedIcon fontSize="small" />,
  laugh: <EmojiEmotionsOutlinedIcon fontSize="small" />,
};

type CommentComposerProps = {
  value: string;
  posting: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  currentUser?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
};

function CommentComposer({
  value,
  posting,
  onChange,
  onSend,
  currentUser,
}: CommentComposerProps) {
  const theme = useTheme();
  const isSendDisabled = posting || value.trim().length === 0;
  const composerBorder = `1px solid ${theme.palette.divider}`;

  return (
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
      <UserAvatar
        size="md"
        firstName={currentUser?.first_name ?? null}
        lastName={currentUser?.last_name ?? null}
        avatarUrl={currentUser?.avatar_url ?? null}
        ariaLabel="Your profile"
      />

      <div style={{ flex: 1 }}>
        <TextField
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Add a comment…"
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
          <Button
            size="small"
            variant="contained"
            onClick={onSend}
            disabled={isSendDisabled}
          >
            {posting ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type InlineReplyComposerProps = {
  active: boolean;
  value: string;
  posting: boolean;
  indent?: number;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSend: () => void;
};

function InlineReplyComposer({
  active,
  value,
  posting,
  indent = 40,
  onChange,
  onCancel,
  onSend,
}: InlineReplyComposerProps) {
  if (!active) return null;

  return (
    <div
      style={{
        marginTop: 8,
        paddingLeft: indent,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write a reply…"
        multiline
        minRows={1}
        maxRows={4}
        fullWidth
        variant="outlined"
        size="small"
      />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <Button size="small" variant="text" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={onSend}
          disabled={posting || value.trim().length === 0}
        >
          {posting ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

type CommentThreadProps = {
  comment: CommentWithMeta;
  replies: CommentWithMeta[];
  isAdmin: boolean;
  replyForId: string | null;
  replyBody: string;
  posting: boolean;
  onToggleReply: (commentId: string) => void;
  onReplyBodyChange: (value: string) => void;
  onSendReply: (parentId: string) => void;
  onToggleReaction: (commentId: string, type: ReactionType) => void;
  onDelete: (commentId: string) => void;
};

function CommentThread({
  comment,
  replies,
  isAdmin,
  replyForId,
  replyBody,
  posting,
  onToggleReply,
  onReplyBodyChange,
  onSendReply,
  onToggleReaction,
  onDelete,
}: CommentThreadProps) {
  const theme = useTheme();

  const author = comment.author;
  const displayName = formatDisplayName(author?.first_name, author?.last_name);
  const createdLabel = formatDateTimeLabel(comment.created_at);

  const userReactionSet = new Set(comment.userReactions);
  const rootIsActiveReply = replyForId === comment.id;
  const hasReplies = replies.length > 0;

  const handleRootReplyClick = () => {
    onToggleReply(comment.id);
  };

  const handleRootSendReply = () => {
    onSendReply(comment.id);
  };

  return (
    <div
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
        <UserAvatar
          size="sm"
          firstName={author?.first_name ?? null}
          lastName={author?.last_name ?? null}
          avatarUrl={author?.avatar_url ?? null}
          ariaLabel={`${displayName} profile`}
        />

        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <Typography variant="body2" style={{ fontWeight: 600 }}>
              {displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {createdLabel}
            </Typography>
          </div>

          <Typography
            variant="body2"
            style={{ marginTop: 4, whiteSpace: "pre-wrap" }}
          >
            {comment.body}
          </Typography>

          {/* Reactions + actions */}
          <div style={{ marginTop: 6 }}>
            {/* Reaction icons row */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {reactionOrder.map((type) => {
                const count = comment.reactions[type];
                const isActive = userReactionSet.has(type);
                return (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <IconButton
                      size="small"
                      onClick={() => onToggleReaction(comment.id, type)}
                      style={{ padding: 4, opacity: count === 0 && !isActive ? 0.4 : 1 }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: isActive ? theme.palette.primary.main : theme.palette.text.secondary }}>
                        {reactionIcons[type]}
                      </span>
                    </IconButton>
                    {count > 0 && (
                      <Typography variant="caption" color="text.secondary">{count}</Typography>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Reply / Delete row */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Button size="small" variant="text" onClick={handleRootReplyClick}>Reply</Button>
              {isAdmin && (
                <Button size="small" variant="text" color="error" onClick={() => onDelete(comment.id)}>Delete</Button>
              )}
            </div>
          </div>

          {/* Inline reply under root comment */}
          <InlineReplyComposer
            active={rootIsActiveReply}
            value={replyBody}
            posting={posting}
            indent={40}
            onChange={onReplyBodyChange}
            onCancel={() => {
              onToggleReply(comment.id);
              onReplyBodyChange("");
            }}
            onSend={handleRootSendReply}
          />

          {/* Replies */}
          {hasReplies && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                paddingLeft: 16,
                borderLeft: `2px solid ${theme.palette.divider}`,
              }}
            >
              {replies.map((reply) => {
                const replyAuthor = reply.author;
                const replyName = formatDisplayName(
                  replyAuthor?.first_name,
                  replyAuthor?.last_name
                );
                const replyCreatedLabel = formatDateTimeLabel(reply.created_at);

                const replyUserReactionSet = new Set(reply.userReactions);
                const replyIsActive = replyForId === reply.id;

                const handleReplyClick = () => {
                  onToggleReply(reply.id);
                };

                const handleReplySend = () => {
                  onSendReply(reply.id);
                };

                return (
                  <div
                    key={reply.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <UserAvatar
                      size="xs"
                      firstName={replyAuthor?.first_name ?? null}
                      lastName={replyAuthor?.last_name ?? null}
                      avatarUrl={replyAuthor?.avatar_url ?? null}
                      ariaLabel={`${replyName} profile`}
                    />

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
                        <Typography variant="caption" color="text.secondary">
                          {replyCreatedLabel}
                        </Typography>
                      </div>

                      <Typography
                        variant="body2"
                        style={{ marginTop: 4, whiteSpace: "pre-wrap" }}
                      >
                        {reply.body}
                      </Typography>

                      {/* Reactions + actions */}
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {reactionOrder.map((type) => {
                            const count = reply.reactions[type];
                            const isActive = replyUserReactionSet.has(type);
                            return (
                              <div key={type} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => onToggleReaction(reply.id, type)}
                                  style={{ padding: 4, opacity: count === 0 && !isActive ? 0.4 : 1 }}
                                >
                                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: isActive ? theme.palette.primary.main : theme.palette.text.secondary }}>
                                    {reactionIcons[type]}
                                  </span>
                                </IconButton>
                                {count > 0 && (
                                  <Typography variant="caption" color="text.secondary">{count}</Typography>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <Button size="small" variant="text" onClick={handleReplyClick}>Reply</Button>
                          {isAdmin && (
                            <Button size="small" variant="text" color="error" onClick={() => onDelete(reply.id)}>Delete</Button>
                          )}
                        </div>
                      </div>

                      <InlineReplyComposer
                        active={replyIsActive}
                        value={replyBody}
                        posting={posting}
                        indent={0}
                        onChange={onReplyBodyChange}
                        onCancel={() => {
                          onToggleReply(reply.id);
                          onReplyBodyChange("");
                        }}
                        onSend={handleReplySend}
                      />
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
}

export default function CommentsSection({
  seasonId,
  whiskeyDayId,
  userId,
  isAdmin,
  currentUser,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<CommentWithMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [newBody, setNewBody] = useState<string>("");
  const [posting, setPosting] = useState<boolean>(false);

  const [replyForId, setReplyForId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState<string>("");

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
        parentCommentId: null,
      });

      setNewBody("");
      await refreshComments();
    } catch (err: any) {
      console.error("Error posting comment", err);
      setError("Error posting comment");
    } finally {
      setPosting(false);
    }
  };

  const handleSendReply = async (parentId: string) => {
    const trimmed = replyBody.trim();
    if (!trimmed) return;

    setPosting(true);
    setError(null);
    try {
      await postComment({
        seasonId,
        whiskeyDayId,
        userId,
        body: trimmed,
        parentCommentId: parentId,
      });

      setReplyBody("");
      setReplyForId(null);
      await refreshComments();
    } catch (err: any) {
      console.error("Error posting reply", err);
      setError("Error posting reply");
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

  return (
    <div
      style={{
        marginTop: 32,
        marginBottom: 32,
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

      {error && (
        <Typography
          variant="body2"
          color="error"
          style={{ marginBottom: 8 }}
        >
          {error}
        </Typography>
      )}

      <CommentComposer
        value={newBody}
        posting={posting}
        onChange={setNewBody}
        onSend={handleSend}
        currentUser={currentUser}
      />

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

      {!loading && rootComments.length === 0 && (
        <Typography
          variant="body2"
          color="text.secondary"
          style={{ fontStyle: "italic" }}
        >
          No comments yet.
        </Typography>
      )}

      {!loading && rootComments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rootComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              replies={getReplies(comment.id)}
              isAdmin={isAdmin}
              replyForId={replyForId}
              replyBody={replyBody}
              posting={posting}
              onToggleReply={(id) => {
                setReplyForId((current) => (current === id ? null : id));
              }}
              onReplyBodyChange={setReplyBody}
              onSendReply={handleSendReply}
              onToggleReaction={handleToggleReaction}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
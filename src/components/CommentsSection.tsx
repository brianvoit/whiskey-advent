import { useEffect, useMemo, useState, type JSX } from "react";
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
import { trackPostComment, trackReaction } from "../gtag";

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
  /** GA4 context — passed from the parent (WhiskeyDetail). */
  whiskeyName?: string;
  dayNumber?: number;
  seasonYear?: number;
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
};

function CommentComposer({
  value,
  posting,
  onChange,
  onSend,
}: CommentComposerProps) {
  const theme = useTheme();
  const hasText = value.trim().length > 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Join the conversation"
        multiline
        minRows={2}
        maxRows={6}
        fullWidth
        variant="outlined"
        size="small"
        sx={{ "& .MuiOutlinedInput-root": { backgroundColor: theme.palette.background.paper } }}
      />

      {hasText && (
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
            variant="text"
            onClick={() => onChange("")}
            disabled={posting}
            sx={{ textTransform: "uppercase" }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={onSend}
            disabled={posting}
            sx={{ textTransform: "uppercase" }}
          >
            {posting ? "Posting…" : "Comment"}
          </Button>
        </div>
      )}
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
        <Button size="small" variant="text" onClick={onCancel} sx={{ textTransform: "uppercase" }}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={onSend}
          disabled={posting || value.trim().length === 0}
          sx={{ textTransform: "uppercase" }}
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
  allComments: CommentWithMeta[];
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
  allComments,
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

  function renderReplyNode(
    reply: CommentWithMeta,
    isLast: boolean,
    connectorLeft: number,
    connectorWidth: number,
  ): JSX.Element {
    const subReplies = allComments.filter(c => c.parent_comment_id === reply.id);
    const hasSubReplies = subReplies.length > 0;

    const replyAuthor = reply.author;
    const replyName = formatDisplayName(replyAuthor?.first_name, replyAuthor?.last_name);
    const replyCreatedLabel = formatDateTimeLabel(reply.created_at);
    const replyUserReactionSet = new Set(reply.userReactions);
    const replyIsActive = replyForId === reply.id;

    return (
      <div
        key={reply.id}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          position: "relative",
        }}
      >
        {/* L-shaped connector from parent thread line to this reply */}
        <div style={{
          position: "absolute",
          left: connectorLeft,
          top: 0,
          width: connectorWidth,
          height: 12,
          borderLeft: `2px solid ${theme.palette.divider}`,
          borderBottom: `2px solid ${theme.palette.divider}`,
          borderBottomLeftRadius: 6,
          boxSizing: "border-box",
        }} />
        {/* Mask: hides the parent thread line below where the curve has fully swept away (last reply only) */}
        {isLast && (
          <div style={{
            position: "absolute",
            left: connectorLeft,
            top: 10,
            bottom: 0,
            width: 2,
            backgroundColor: theme.palette.background.paper,
          }} />
        )}
        {/* Thread line downward to own sub-replies */}
        {hasSubReplies && (
          <div style={{
            position: "absolute",
            left: 11,
            top: 28,
            bottom: 0,
            width: 2,
            backgroundColor: theme.palette.divider,
          }} />
        )}

        <UserAvatar
          size="xs"
          firstName={replyAuthor?.first_name ?? null}
          lastName={replyAuthor?.last_name ?? null}
          avatarUrl={replyAuthor?.avatar_url ?? null}
          ariaLabel={`${replyName} profile`}
        />

        <div style={{ flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", columnGap: 8 }}>
            <Typography variant="body2" style={{ fontWeight: 600, alignSelf: "center" }}>
              {replyName}
            </Typography>
            <Typography variant="caption" color="text.secondary" style={{ whiteSpace: "nowrap", alignSelf: "center", paddingRight: 6 }}>
              {replyCreatedLabel}
            </Typography>
            <Typography
              variant="body2"
              style={{ gridColumn: "1 / -1", marginTop: 4, whiteSpace: "pre-wrap" }}
            >
              {reply.body}
            </Typography>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Button
                size="small"
                variant="text"
                onClick={() => onToggleReply(reply.id)}
                sx={{ pl: 0, textTransform: "uppercase", color: "text.secondary", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", minWidth: 0 }}
              >
                Reply
              </Button>
              {isAdmin && (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => onDelete(reply.id)}
                  sx={{ textTransform: "uppercase", color: "text.secondary", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", minWidth: 0 }}
                >
                  Delete
                </Button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
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
            onSend={() => onSendReply(reply.id)}
          />

          {/* Recursive sub-replies */}
          {hasSubReplies && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {subReplies.map((sub, idx) =>
                renderReplyNode(sub, idx === subReplies.length - 1, -21, 21)
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 12,
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          position: "relative",
        }}
      >
        <UserAvatar
          size="sm"
          firstName={author?.first_name ?? null}
          lastName={author?.last_name ?? null}
          avatarUrl={author?.avatar_url ?? null}
          ariaLabel={`${displayName} profile`}
        />

        {/* Vertical connector: abs-positioned from below avatar to bottom of thread */}
        {hasReplies && (
          <div style={{
            position: "absolute",
            left: 15,
            top: 36,
            bottom: 0,
            width: 2,
            backgroundColor: theme.palette.divider,
          }} />
        )}

        <div style={{ flex: 1 }}>
          {/* Grid: col 1 = content, col 2 = timestamp/reactions. Body spans both so it fills full width. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", columnGap: 8 }}>
            {/* Row 1: Name | Timestamp */}
            <Typography variant="body2" style={{ fontWeight: 600, alignSelf: "center" }}>
              {displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" style={{ whiteSpace: "nowrap", alignSelf: "center", paddingRight: 6 }}>
              {createdLabel}
            </Typography>

            {/* Row 2: Body — spans full width */}
            <Typography
              variant="body2"
              style={{ gridColumn: "1 / -1", marginTop: 4, whiteSpace: "pre-wrap" }}
            >
              {comment.body}
            </Typography>

            {/* Row 3: REPLY/DELETE | Reactions */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Button
                size="small"
                variant="text"
                onClick={handleRootReplyClick}
                sx={{ pl: 0, textTransform: "uppercase", color: "text.secondary", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", minWidth: 0 }}
              >
                Reply
              </Button>
              {isAdmin && (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => onDelete(comment.id)}
                  sx={{ textTransform: "uppercase", color: "text.secondary", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", minWidth: 0 }}
                >
                  Delete
                </Button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
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

          {/* Replies — rendered recursively via renderReplyNode */}
          {hasReplies && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {replies.map((reply, idx) =>
                renderReplyNode(reply, idx === replies.length - 1, -25, 25)
              )}
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
  whiskeyName,
  dayNumber,
  seasonYear,
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

      if (whiskeyName && dayNumber != null && seasonYear != null) {
        trackPostComment({ whiskey_name: whiskeyName, day_number: dayNumber, season_year: seasonYear, is_reply: false, comment_length: trimmed.length });
      }

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

      if (whiskeyName && dayNumber != null && seasonYear != null) {
        trackPostComment({ whiskey_name: whiskeyName, day_number: dayNumber, season_year: seasonYear, is_reply: true, comment_length: trimmed.length });
      }

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
      if (whiskeyName && dayNumber != null && seasonYear != null) {
        trackReaction({ reaction_type: reactionType, whiskey_name: whiskeyName, day_number: dayNumber, season_year: seasonYear });
      }
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

  // Enrich the current user's own comments with the OAuth-resolved avatar URL when
  // profiles.avatar_url is null (e.g. Google OAuth users who haven't uploaded a photo).
  const enrichedComments = useMemo(() => {
    const resolvedUrl = currentUser?.avatar_url ?? null;
    if (!resolvedUrl) return comments;
    return comments.map(c =>
      c.user_id === userId && c.author && !c.author.avatar_url
        ? { ...c, author: { ...c.author, avatar_url: resolvedUrl } }
        : c
    );
  }, [comments, userId, currentUser?.avatar_url]);

  const rootComments = enrichedComments.filter((c) => !c.parent_comment_id);
  const getReplies = (parentId: string) =>
    enrichedComments.filter((c) => c.parent_comment_id === parentId);

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
        Conversation
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
              allComments={enrichedComments}
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
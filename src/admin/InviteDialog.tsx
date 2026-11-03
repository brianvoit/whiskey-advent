import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { createInvite, type Invite } from "../api/invites";
import { inviteHref, inviteLink, inviteMessage, isValidContact } from "../utils/invite";

type InviteDialogProps = {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  /** Inviting a previous user: they're linked to this profile when they accept. */
  previousProfile?: { id: string; first_name: string | null; last_name: string | null } | null;
  /** Resending: skip straight to sending this existing invite. */
  existingInvite?: Invite | null;
  onCreated: (invite: Invite) => void;
};

/**
 * Creates an invite and hands it to the admin's own Messages or Mail app.
 * Nothing is sent from the server: there's no SMS service, and Supabase's
 * built-in email is limited to a couple of messages an hour.
 */
export default function InviteDialog({
  open, onClose, currentUserId, previousProfile, existingInvite, onCreated,
}: InviteDialogProps) {
  const [contactType, setContactType] = useState<"email" | "phone">("phone");
  const [contact, setContact] = useState("");
  const [firstName, setFirstName] = useState(previousProfile?.first_name ?? "");
  const [lastName, setLastName] = useState(previousProfile?.last_name ?? "");
  const [invite, setInvite] = useState<Invite | null>(existingInvite ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  const returning = Boolean(previousProfile || invite?.legacy_profile_id);
  const valid = isValidContact(contactType, contact);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createInvite({
        contactType,
        contact,
        firstName,
        lastName,
        legacyProfileId: previousProfile?.id ?? null,
        invitedBy: currentUserId,
      });
      setInvite(created);
      onCreated(created);
    } catch (e) {
      setError((e as Error).message ?? "Couldn't create the invite.");
    } finally {
      setBusy(false);
    }
  };

  // Always invite people to the real address, even from the old pages.dev
  // install; the dev server keeps its own origin so links can be tested.
  const siteOrigin = window.location.hostname === "localhost" ? window.location.origin : "https://whiskey-advent.com";
  const link = invite ? inviteLink(siteOrigin, invite.token) : "";
  const message = invite ? inviteMessage(link, invite.first_name ?? previousProfile?.first_name ?? null, returning) : "";

  const copy = async (what: "link" | "message") => {
    try {
      await navigator.clipboard.writeText(what === "link" ? link : message);
      setCopied(what);
    } catch {
      setError("Couldn't copy. Select the text and copy it instead.");
    }
  };

  const nameLabel = [previousProfile?.first_name, previousProfile?.last_name].filter(Boolean).join(" ");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {invite ? "Send the invite" : previousProfile ? `Invite ${nameLabel || "previous user"} back` : "Invite someone"}
      </DialogTitle>

      {!invite ? (
        <>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {previousProfile && (
                <Typography variant="body2" color="text.secondary">
                  When they accept, they'll be linked to their past profile and keep their ratings.
                </Typography>
              )}
              <Stack direction="row" spacing={1}>
                <TextField label="First name" size="small" value={firstName} onChange={(e) => setFirstName(e.target.value)} fullWidth />
                <TextField label="Last name" size="small" value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth />
              </Stack>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={contactType}
                onChange={(_, v) => v && setContactType(v)}
                aria-label="Send invite by"
              >
                <ToggleButton value="phone">Text message</ToggleButton>
                <ToggleButton value="email">Email</ToggleButton>
              </ToggleButtonGroup>
              <TextField
                label={contactType === "phone" ? "Phone number" : "Email address"}
                type={contactType === "phone" ? "tel" : "email"}
                size="small"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                error={contact.length > 0 && !valid}
                helperText={
                  contactType === "email"
                    ? "Signing up with this address also accepts the invite, even without the link."
                    : "Include the area code."
                }
                fullWidth
                autoFocus
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" disabled={!valid || busy} onClick={() => void handleCreate()}>
              {busy ? "Creating…" : "Create invite"}
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                To {invite.contact}. The link works once: whoever signs in with it joins
                {returning ? " and is linked to their past profile" : " the current season"}.
              </Typography>
              <TextField label="Message" value={message} multiline minRows={5} fullWidth InputProps={{ readOnly: true }} />
              <Button
                variant="contained"
                component="a"
                href={inviteHref(invite.contact_type, invite.contact, message)}
              >
                {invite.contact_type === "phone" ? "Open Messages" : "Open Mail"}
              </Button>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" fullWidth onClick={() => void copy("link")}>
                  {copied === "link" ? "Link copied" : "Copy link"}
                </Button>
                <Button variant="outlined" fullWidth onClick={() => void copy("message")}>
                  {copied === "message" ? "Message copied" : "Copy message"}
                </Button>
              </Stack>
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Done</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

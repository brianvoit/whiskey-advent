import type { ReactNode } from "react";
import { useTheme } from "@mui/material/styles";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import UserAvatar from "./UserAvatar";

type BottomNavProps = {
  currentPath: string;
  onNavigate: (path: string) => void;
  avatarFirstName?: string;
  avatarLastName?: string;
  avatarUrl?: string | null;
  avatarEmail?: string | null;
  isAdmin?: boolean;
};

type NavItemProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  avatarFirstName?: string;
  avatarLastName?: string;
  avatarUrl?: string | null;
  avatarEmail?: string | null;
  icon?: ReactNode;
};

function NavItem({ label, active, onClick, avatarFirstName, avatarLastName, avatarUrl, avatarEmail, icon }: NavItemProps) {
  const theme = useTheme();
  const activeColor = theme.palette.primary.main;
  const inactiveColor = theme.palette.text.secondary;

  const initialsFromEmail = (email?: string | null) => {
    if (!email) return "";
    const local = email.split("@")[0] || "";
    const letters = local.replace(/[^a-zA-Z]/g, "");
    if (letters.length >= 2) return (letters[0] + letters[1]).toUpperCase();
    if (letters.length === 1) return letters[0].toUpperCase();
    return "";
  };

  const initialsOverride =
    !avatarFirstName && !avatarLastName ? initialsFromEmail(avatarEmail) : "";

  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        background: "transparent",
        padding: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontSize: "0.8rem",
        color: active ? activeColor : inactiveColor,
        cursor: "pointer",
      }}
    >
      {label === "Profile" ? (
        <UserAvatar
          size="sm"
          firstName={avatarFirstName}
          lastName={avatarLastName}
          avatarUrl={avatarUrl}
          ariaLabel="Your profile"
          tooltip="Profile"
          initialsOverride={initialsOverride}
        />
      ) : icon ? (
        <span
          style={{
            fontSize: 18,
            lineHeight: 1,
            marginBottom: 2,
          }}
        >
          {icon}
        </span>
      ) : (
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "999px",
            marginBottom: 2,
            border: active
              ? `4px solid ${activeColor}`
              : `4px solid ${theme.palette.divider}`,
          }}
        />
      )}
      <span>{label}</span>
    </button>
  );
}

function BottomNav({ currentPath, onNavigate, avatarFirstName, avatarLastName, avatarUrl, avatarEmail, isAdmin }: BottomNavProps) {
  const theme = useTheme();

  const goTo = (path: string) => {
    if (currentPath !== path) {
      onNavigate(path);
    }
  };

  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        borderTop: `1px solid ${theme.palette.divider}`,
        background: theme.palette.background.paper,
        paddingTop: 6,
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
      }}
    >
      <NavItem
        label="Home"
        icon={<HomeRoundedIcon fontSize="small" />}
        active={currentPath === "/"}
        onClick={() => goTo("/")}
      />
      <NavItem
        label="Stats"
        icon={<QueryStatsRoundedIcon fontSize="small" />}
        active={currentPath === "/stats"}
        onClick={() => goTo("/stats")}
      />
      {isAdmin && (
        <NavItem
          label="Admin"
          icon={<AdminPanelSettingsRoundedIcon fontSize="small" />}
          active={currentPath === "/admin"}
          onClick={() => goTo("/admin")}
        />
      )}
      <NavItem
        label="Profile"
        active={currentPath === "/profile"}
        onClick={() => goTo("/profile")}
        avatarFirstName={avatarFirstName}
        avatarLastName={avatarLastName}
        avatarUrl={avatarUrl}
        avatarEmail={avatarEmail}
      />
    </nav>
  );
}

export default BottomNav;
import type { ReactNode } from "react";
import { useTheme } from "@mui/material/styles";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import QueryStatsRoundedIcon from "@mui/icons-material/QueryStatsRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";

type BottomNavProps = {
  currentPath: string;
  onNavigate: (path: string) => void;
  avatarUrl?: string;
};

type NavItemProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  avatarUrl?: string;
  icon?: ReactNode;
};

function NavItem({ label, active, onClick, avatarUrl, icon }: NavItemProps) {
  const theme = useTheme();
  const activeColor = theme.palette.primary.main;
  const inactiveColor = theme.palette.text.secondary;

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
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={label}
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            marginBottom: 2,
          }}
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

function BottomNav({ currentPath, onNavigate, avatarUrl }: BottomNavProps) {
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
        padding: "6px 16px 10px",
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
      <NavItem
        label="Profile"
        active={currentPath === "/profile"}
        onClick={() => goTo("/profile")}
        avatarUrl={avatarUrl}
        icon={!avatarUrl ? <AccountCircleRoundedIcon fontSize="small" /> : undefined}
      />
    </nav>
  );
}

export default BottomNav;
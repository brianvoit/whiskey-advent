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
  icon?: string;
};

function NavItem({ label, active, onClick, avatarUrl, icon }: NavItemProps) {
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
        color: active ? "#2563eb" : "#444",
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
            border: active ? "4px solid #2563eb" : "4px solid #aaa",
          }}
        />
      )}
      <span>{label}</span>
    </button>
  );
}

function BottomNav({ currentPath, onNavigate, avatarUrl }: BottomNavProps) {
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
        borderTop: "1px solid #ddd",
        background: "#fff",
        padding: "6px 16px 10px",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
      }}
    >
      <NavItem
        label="Home"
        icon="🏠"
        active={currentPath === "/"}
        onClick={() => goTo("/")}
      />
      <NavItem
        label="Stats"
        icon="📊"
        active={currentPath === "/stats"}
        onClick={() => goTo("/stats")}
      />
      <NavItem
        label="Profile"
        active={currentPath === "/profile"}
        onClick={() => goTo("/profile")}
        avatarUrl={avatarUrl}
      />
    </nav>
  );
}

export default BottomNav;
import { useEffect, useRef, useState } from "react";

// Onglets toujours visibles
const MAIN_TABS = [
  { key: "add",      label: "Ajouter" },
  { key: "list",     label: "Historique" },
  { key: "stats",    label: "Stats" },
];

// Onglets dans le menu "Plus"
const MORE_TABS = [
  { key: "cats",      label: "Catégories" },
  { key: "forecast",  label: "Prévisionnel" },
  { key: "debts",     label: "Dettes" },
  { key: "recurring", label: "Récurrent" },
];

export default function TopBar({ tab, setTab }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Fermer le menu si clic en dehors
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [menuOpen]);

  const isMoreActive = MORE_TABS.some(t => t.key === tab);

  function handleSelect(key) {
    setTab(key);
    setMenuOpen(false);
  }

  return (
    <div style={styles.bar}>
      {/* Onglets principaux */}
      {MAIN_TABS.map(t => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          style={{
            ...styles.tab,
            ...(tab === t.key ? styles.tabActive : null)
          }}
        >
          {t.label}
        </button>
      ))}

      {/* Bouton "Plus" avec dropdown */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{
            ...styles.tab,
            ...(isMoreActive ? styles.tabActive : null),
            width: "100%",
          }}
        >
          {isMoreActive
            ? MORE_TABS.find(t => t.key === tab)?.label
            : "Plus"} ▾
        </button>

        {menuOpen && (
          <div style={styles.dropdown}>
            {MORE_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => handleSelect(t.key)}
                style={{
                  ...styles.dropdownItem,
                  ...(tab === t.key ? styles.dropdownItemActive : null)
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bouton Paramètres — icône uniquement */}
      <button
        onClick={() => setTab("settings")}
        title="Paramètres"
        style={{
          ...styles.tab,
          ...(tab === "settings" ? styles.tabActive : null),
          padding: "6px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src="/icons/icone_parametre.png"
          alt="Paramètres"
          style={{
            width: 22,
            height: 22,
            objectFit: "contain",
            // Inverser la couleur quand actif (icône sombre sur fond sombre)
            filter: tab === "settings" ? "invert(1)" : "none",
          }}
        />
      </button>
    </div>
  );
}

const styles = {
  bar: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr) 1fr auto",
    gap: 6,
    padding: "10px 10px",
    position: "sticky",
    top: 0,
    background: "white",
    borderBottom: "1px solid #e5e7eb",
    zIndex: 10,
    alignItems: "center",
  },
  tab: {
    padding: "10px 6px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  tabActive: {
    background: "#111827",
    color: "white",
    borderColor: "#111827",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    minWidth: 160,
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    zIndex: 100,
    overflow: "hidden",
    display: "grid",
  },
  dropdownItem: {
    padding: "12px 16px",
    border: "none",
    background: "transparent",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    textAlign: "left",
    borderBottom: "1px solid #f3f4f6",
  },
  dropdownItemActive: {
    background: "#f0f9ff",
    color: "#2563eb",
  },
};

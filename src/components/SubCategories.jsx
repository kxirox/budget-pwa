import React, { useEffect, useMemo, useState } from "react";

/**
 * Gestion des sous-categories (onglet Parametres).
 * Stockage: { [categoryName]: string[] }
 */
export default function SubCategories({
  categories = [],
  subcategoriesMap = {},
  setSubcategoriesMap,
}) {
  const safeCategories = useMemo(() => {
    const list = Array.isArray(categories) ? categories : [];
    const uniq = Array.from(new Set(list.map((c) => String(c || "").trim()).filter(Boolean)));
    return uniq.length ? uniq : ["Autres"];
  }, [categories]);

  const [selectedCategory, setSelectedCategory] = useState(safeCategories[0] || "Autres");
  const [newSubcat, setNewSubcat] = useState("");

  // Keep selected category valid
  useEffect(() => {
    if (!safeCategories.includes(selectedCategory)) {
      setSelectedCategory(safeCategories[0] || "Autres");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeCategories.join("|")]);

  const currentList = useMemo(() => {
    const arr = subcategoriesMap?.[selectedCategory];
    return Array.isArray(arr) ? arr : [];
  }, [subcategoriesMap, selectedCategory]);

  function addSubcategory() {
    const name = String(newSubcat || "").trim();
    if (!name) return;

    setSubcategoriesMap((prev) => {
      const base = prev && typeof prev === "object" ? prev : {};
      const existing = Array.isArray(base[selectedCategory]) ? base[selectedCategory] : [];
      const nextList = Array.from(new Set([...existing, name]));
      return { ...base, [selectedCategory]: nextList };
    });
    setNewSubcat("");
  }

  function deleteSubcategory(name) {
    if (!confirm(`Supprimer la sous-categorie "${name}" ?`)) return;

    setSubcategoriesMap((prev) => {
      const base = prev && typeof prev === "object" ? prev : {};
      const existing = Array.isArray(base[selectedCategory]) ? base[selectedCategory] : [];
      const nextList = existing.filter((s) => s !== name);
      return { ...base, [selectedCategory]: nextList };
    });
  }

  function renameSubcategory(oldName) {
    const nextName = prompt("Nouveau nom de la sous-categorie :", oldName);
    const clean = String(nextName || "").trim();
    if (!clean || clean === oldName) return;

    setSubcategoriesMap((prev) => {
      const base = prev && typeof prev === "object" ? prev : {};
      const existing = Array.isArray(base[selectedCategory]) ? base[selectedCategory] : [];
      const nextList = existing.map((s) => (s === oldName ? clean : s));
      return { ...base, [selectedCategory]: Array.from(new Set(nextList)) };
    });
  }

  return (
    <div style={styles.card}>
      <div style={styles.headRow}>
        <div>
          <div style={styles.title}>Sous-categories</div>
          <div style={styles.subtitle}>
            Optionnel : tu peux garder une operation sans sous-categorie.
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        <label style={styles.label}>
          Categorie
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={styles.input}
          >
            {safeCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Ajouter une sous-categorie
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newSubcat}
              onChange={(e) => setNewSubcat(e.target.value)}
              placeholder="ex: Train"
              style={{ ...styles.input, flex: 1 }}
            />
            <button type="button" onClick={addSubcategory} style={styles.btn}>
              Ajouter
            </button>
          </div>
        </label>
      </div>

      <div style={{ marginTop: 10 }}>
        {currentList.length === 0 ? (
          <div style={styles.empty}>Aucune sous-categorie pour "{selectedCategory}".</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {currentList.map((s) => (
              <div key={s} style={styles.row}>
                <div style={{ fontWeight: 700 }}>{s}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => renameSubcategory(s)}
                    style={styles.btnSecondary}
                  >
                    Renommer
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSubcategory(s)}
                    style={styles.btnDanger}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.note}>
        Note : renommer/supprimer ici ne modifie pas automatiquement l'historique existant.
        Tu pourras toujours filtrer et corriger tes operations via l'onglet Historique.
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 12,
  },
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 16, fontWeight: 900 },
  subtitle: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  grid: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  label: { display: "grid", gap: 6, fontSize: 13, fontWeight: 700 },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    outline: "none",
  },
  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnSecondary: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnDanger: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 900,
    cursor: "pointer",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
  },
  empty: { color: "#6b7280", fontSize: 13, padding: 8 },
  note: { marginTop: 10, fontSize: 12, color: "#6b7280" },
};

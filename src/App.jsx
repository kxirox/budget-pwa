import React, { useEffect, useMemo, useState } from "react";
import TopBar from "./components/TopBar.jsx";
import AddExpense from "./components/AddExpense.jsx";
import ExpenseList from "./components/ExpenseList.jsx";
import Stats from "./components/Stats.jsx";
import Categories from "./components/Categories.jsx";
import {
  loadCategories,
  loadExpenses,
  saveCategories,
  saveExpenses,
  uid,
  DEFAULT_BANKS,
  DEFAULT_ACCOUNT_TYPES,
  loadCategoryColors,
  saveCategoryColors
} from "./storage.js";
import { loadRecurring, saveRecurring } from "./storage.js";
import { applyRecurring } from "./recurring.js";
import Recurring from "./components/Recurring.jsx";







export default function App() {
  const [tab, setTab] = useState("add");
  const [categories, setCategories] = useState(() => loadCategories());
  const [expenses, setExpenses] = useState(() => loadExpenses());
  const [categoryColors, setCategoryColors] = useState(() => loadCategoryColors());
  const [recurring, setRecurring] = useState(() => loadRecurring());


  // wipe data modal pour supprimer toutes les donnees d'un coup 
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeText, setWipeText] = useState("");




  // Persistance
  useEffect(() => saveRecurring(recurring), [recurring]);

  useEffect(() => {
    const { nextExpenses, nextRules, addedCount } = applyRecurring(recurring, expenses);

    // éviter boucle infinie : ne set que si changement
    if (addedCount > 0) setExpenses(nextExpenses);

    // si nextDate a changé sur des règles, on les sauvegarde
    const changed = JSON.stringify(nextRules) !== JSON.stringify(recurring);
    if (changed) setRecurring(nextRules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // au premier chargement uniquement


  useEffect(() => saveCategories(categories), [categories]);
  useEffect(() => saveExpenses(expenses), [expenses]);
  useEffect(() => saveCategoryColors(categoryColors), [categoryColors]);





  const safeCategories = useMemo(() => {
    const unique = Array.from(new Set(categories.map(c => String(c).trim()).filter(Boolean)));
    return unique.length ? unique : ["Autres"];
  }, [categories]);




 //choix des couleurs des category dans les graphiques
  useEffect(() => {
    const palette = [
      // actuelles
      "#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2",
      "#db2777", "#4b5563", "#65a30d", "#ea580c", "#0f766e", "#9333ea",

      // nouvelles (ajoutées)
      "#06b6d4", "#f43f5e", "#84cc16", "#22c55e", "#eab308", "#3b82f6",
      "#a855f7", "#14b8a6", "#fb7185", "#facc15", "#4ade80", "#38bdf8",
      "#c084fc", "#2dd4bf", "#fde047", "#86efac", "#7dd3fc", "#ddd6fe"
    ];



    function hashToIndex(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
      return h % palette.length;
    }

    setCategoryColors(prev => {
      const next = { ...(prev || {}) };
      let changed = false;

      // 1) Remplir les catégories manquantes (sans collision)
      const used = new Set(Object.values(next));
      for (const c of safeCategories) {
        const key = String(c).trim();
        if (!key) continue;

        if (!next[key]) {
          let idx = hashToIndex(key);
          let tries = 0;
          while (used.has(palette[idx]) && tries < palette.length) {
            idx = (idx + 1) % palette.length;
            tries++;
          }
          next[key] = palette[idx];
          used.add(next[key]);
          changed = true;
        }
      }

      // 2) Nettoyer les doublons existants (Divers/Transport par ex.)
      const seen = new Map(); // color -> categoryKey
      for (const key of Object.keys(next)) {
        const color = next[key];
        if (!color) continue;

        if (seen.has(color)) {
          // doublon => réassigner celui-ci à une couleur libre
          const baseIdx = hashToIndex(key);
          let idx = baseIdx;
          let tries = 0;

          // couleur déjà utilisée => on cherche une couleur libre
          const usedNow = new Set(Object.values(next));
          while (usedNow.has(palette[idx]) && tries < palette.length) {
            idx = (idx + 1) % palette.length;
            tries++;
          }

          if (palette[idx] !== color) {
            next[key] = palette[idx];
            changed = true;
          }
        } else {
          seen.set(color, key);
        }
      }

      return changed ? next : prev;
    });
  }, [safeCategories]);




  function wipeHistory() {
    // 1) reset state
    setExpenses([]);
    // si tu as setIncomes séparé, décommente :
    // setIncomes([]);

    // 2) reset storage
    localStorage.removeItem("budget_pwa_expenses_v1");
    // si tu as une clé incomes, décommente :
    // localStorage.removeItem("budget_pwa_incomes_v1");

    // optionnel : on remet le texte et on ferme
    setWipeText("");
    setShowWipeModal(false);
  }






  function addExpense(payload) {
    const e = {
      id: uid(),
      kind: payload.kind ?? "expense",
      amount: Math.abs(payload.amount),
      category: payload.category,
      bank: payload.bank,
      accountType: payload.accountType,
      date: payload.date,
      note: payload.note ?? "",
      linkedExpenseId: payload.linkedExpenseId || undefined
    };

    setExpenses(prev => [e, ...prev]);
    setTab("list");
  }

  
function createReimbursement({ linkedExpenseId, amount, date, bank, accountType, note }) {
  const e = {
    id: uid(),
    kind: "reimbursement",
    linkedExpenseId,
    amount: Math.abs(amount),
    category: "Autres",
    bank: bank ?? "Physique",
    accountType: accountType ?? "Compte courant",
    date,
    note: note ?? ""
  };
  setExpenses(prev => [e, ...prev]);
  setTab("list");
}

function deleteExpense(id) {
    if (!confirm("Supprimer cette dépense ?")) return;
    setExpenses(prev => prev.filter(e => e.id !== id));
  }

function updateExpense(id, patch) {
  setExpenses(prev =>
    prev.map(e => (e.id === id ? { ...e, ...patch, amount: Math.abs(patch.amount ?? e.amount) } : e))
  );
}



  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.title}>STATERA</div>
        <div style={styles.subtitle}>Offline • Données sur ton téléphone • Export CSV</div>
      </div>

      <TopBar tab={tab} setTab={setTab} />

      {tab === "add" && (
        <AddExpense
          categories={safeCategories}
          banks={DEFAULT_BANKS}
          accountTypes={DEFAULT_ACCOUNT_TYPES}
          expenses={expenses}
          onAdd={addExpense}
        />
      )}


      {tab === "list" && (
        <ExpenseList
          expenses={expenses}
          categories={safeCategories}
          banks={DEFAULT_BANKS}
          accountTypes={DEFAULT_ACCOUNT_TYPES}
          onDelete={deleteExpense}
          onUpdate={updateExpense}
          onImport={(rows) => setExpenses(prev => [...rows, ...prev])}
          onCreateReimbursement={createReimbursement}
          onOpenWipeModal={() => setShowWipeModal(true)}
        />
      )}

      {tab === "stats" && (
        <Stats
          expenses={expenses}
          categories={safeCategories}
          banks={DEFAULT_BANKS}
          accountTypes={DEFAULT_ACCOUNT_TYPES}
          categoryColors={categoryColors}
          filters={{ bank: "ALL", accountType: "ALL", category: "ALL" }}
        />
      )}

      {tab === "cats" && (
        <Categories categories={safeCategories} onSetCategories={setCategories} />

        
      )}

      {tab === "recurring" && (
        <Recurring
          recurring={recurring}
          setRecurring={setRecurring}
          categories={safeCategories}
          banks={DEFAULT_BANKS}
          accountTypes={DEFAULT_ACCOUNT_TYPES}
        />
      )}






        {showWipeModal && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
            zIndex: 9999
          }}>
            <div style={{
              width: "100%",
              maxWidth: 520,
              background: "white",
              borderRadius: 18,
              border: "1px solid #e5e7eb",
              padding: 16,
              maxHeight: "90vh",
              overflowY: "auto"
            }}>
              <h3 style={{ marginTop: 0 }}>Supprimer tout l’historique</h3>
              <p style={{ color: "#6b7280", marginTop: 6 }}>
                Cette action supprime <b>toutes tes opérations</b> (dépenses/revenus) et ne peut pas être annulée.
              </p>

              <p style={{ marginBottom: 6 }}>
                Tape <b>SUPPRIMER</b> pour confirmer :
              </p>

              <input
                value={wipeText}
                onChange={(e) => setWipeText(e.target.value)}
                placeholder="SUPPRIMER"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                  marginBottom: 12
                }}
              />

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => { setShowWipeModal(false); setWipeText(""); }}
                  style={{
                    background: "#f3f4f6",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Annuler
                </button>

                <button
                  onClick={wipeHistory}
                  disabled={wipeText.trim().toUpperCase() !== "SUPPRIMER"}
                  style={{
                    background: wipeText.trim().toUpperCase() === "SUPPRIMER" ? "#dc2626" : "#fca5a5",
                    color: "white",
                    border: "none",
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontWeight: 800,
                    cursor: wipeText.trim().toUpperCase() === "SUPPRIMER" ? "pointer" : "not-allowed",
                  }}
                >
                  Supprimer définitivement
                </button>
              </div>
            </div>
          </div>
        )}





      <div style={{ height: 30 }} />
    </div>
  );
}
//fin default function





const styles = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    fontFamily:
      'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"'
  },
  header: { padding: "14px 14px 6px 14px" },
  title: { fontSize: 22, fontWeight: 950, color: "#111827" },
  subtitle: { color: "#6b7280", fontSize: 12, marginTop: 2 }
};

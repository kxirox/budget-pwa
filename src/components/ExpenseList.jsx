import React, { useMemo, useState } from "react";
import { currentMonthKey, formatEUR, monthLabelFR, toCSV } from "../utils";
import { parseExpensesCSV } from "../importCsv";



export default function ExpenseList({ expenses, categories, banks, accountTypes, onDelete, onUpdate, onImport, onOpenWipeModal }) {
  const [month, setMonth] = useState("ALL");
  const [cat, setCat] = useState("Toutes");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("month"); // "month" | "range"
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Helper pour ajuster la taille de l'application a un mobile
  const isMobile = typeof window !== "undefined" && window.innerWidth < 700;

  const months = useMemo(() => {
    const set = new Set(expenses.map(e => currentMonthKey(e.date)));
    const arr = Array.from(set);
    arr.sort((a, b) => b.localeCompare(a));
    if (arr.length === 0) return ["ALL"];
    return ["ALL", ...arr];
  }, [expenses]);



  const filtered = useMemo(() => {
    return expenses
      .filter(e => {
        const d = String(e.date || "").trim();

        if (mode === "range") {
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        }

        // mode month
        if (month === "ALL") return true;
        return currentMonthKey(d) === month;
      })
      .filter(e => (cat === "Toutes" ? true : e.category === cat))
      .filter(e => {
        if (!q.trim()) return true;
        const s = q.trim().toLowerCase();
        return (
          String(e.note ?? "").toLowerCase().includes(s) ||
          String(e.category ?? "").toLowerCase().includes(s) ||
          String(e.bank ?? "").toLowerCase().includes(s) ||
          String(e.accountType ?? "").toLowerCase().includes(s)
        );
      })
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, month, mode, from, to, cat, q]);


  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const e of filtered) {
      const a = Number(e.amount || 0);
      if (e.kind === "income") income += a;
      else expense += a;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  function exportCSV() {
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `depenses_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCSVFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const { rows, errors } = parseExpensesCSV(text);

      if (errors.length) {
        alert("Erreurs dans le CSV :\n\n" + errors.slice(0, 12).join("\n") + (errors.length > 12 ? "\n..." : ""));
        return;
      }
      if (rows.length === 0) {
        alert("Aucune dépense importée.");
        return;
      }

      const ok = confirm(`Importer ${rows.length} dépense(s) ? (elles seront ajoutées à l'historique)`);
      if (!ok) return;

    // Ajoute au début
    // IMPORTANT: onUpdate ne sert pas ici, on a besoin d’un setter => on passe par un callback onImport
    // => on va ajouter une prop onImport ci-dessous.
      onImport(rows);
      console.log("IMPORT pushed rows:", rows.length, rows[0]);
      alert("Import terminé ✅");
    };
    reader.readAsText(file, "utf-8");
  }



  // ---- EDIT MODE ----
  const [editingId, setEditingId] = useState(null);
  const editing = useMemo(() => filtered.find(e => e.id === editingId) ?? null, [filtered, editingId]);
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState(categories[0] ?? "Autres");
  const [editKind, setEditKind] = useState("expense");
  const [editBank, setEditBank] = useState(banks?.[0] ?? "Physique");
  const [editAccountType, setEditAccountType] = useState(accountTypes?.[0] ?? "Compte courant");
  const [editDate, setEditDate] = useState(new Date().toISOString().slice(0, 10));
  const [editNote, setEditNote] = useState("");




  function openEdit(e) {
    setEditingId(e.id);
    setEditAmount(String(e.amount ?? ""));
    setEditCategory(e.category ?? (categories[0] ?? "Autres"));
    setEditBank(e.bank ?? (banks?.[0] ?? "Physique"));
    setEditAccountType(e.accountType ?? (accountTypes?.[0] ?? "Compte courant"));
    setEditDate(e.date ?? new Date().toISOString().slice(0, 10));
    setEditNote(e.note ?? "");
    setEditKind(e.kind ?? "expense");

  }

  function closeEdit() {
    setEditingId(null);
  }

  function saveEdit() {
    const a = Number(String(editAmount).replace(",", "."));
    if (!Number.isFinite(a) || a <= 0) {
      alert("Montant invalide.");
      return;
    }    
    onUpdate(editingId, {
      kind: editKind,
      amount: Math.round(a * 100) / 100,
      category: editCategory,
      bank: editBank,
      accountType: editAccountType,
      date: editDate,
      note: editNote.trim()
    });
    closeEdit();
  }

  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>
      <div style={styles.card}>
        <div style={{ display: "grid", gap: 10 }}>
         <div
            style={{
              ...styles.row2,
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr"
            }}
          >
            <label style={styles.label}>
              Catégorie
              <select value={cat} onChange={(e) => setCat(e.target.value)} style={styles.input}>
                <option value="Toutes">Toutes</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label style={styles.label}>
              Filtre
              <select value={mode} onChange={(e) => setMode(e.target.value)} style={styles.input}>
                <option value="month">Par mois</option>
                <option value="range">Par période</option>
              </select>
            </label>

            {mode === "month" ? (
              <label style={styles.label}>
                Mois
                <select value={month} onChange={(e) => setMonth(e.target.value)} style={styles.input}>
                  <option value="ALL">Tous les mois</option>
                  {months.filter(m => m !== "ALL").map(m => (
                    <option key={m} value={m}>{monthLabelFR(m)}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label style={styles.label}>
                  Du
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={styles.input} />
                </label>

                <label style={styles.label}>
                  Au
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={styles.input} />
                </label>
              </>
            )}
          </div>

          <label style={styles.label}>
            Recherche (note / catégorie / banque / type)
            <input value={q} onChange={(e) => setQ(e.target.value)} style={styles.input} placeholder="ex: Uber, Revolut..." />
          </label>

          <div style={styles.summary}>
            <div>
              <div style={styles.muted}>Dépenses : {formatEUR(totals.expense)}</div>
              <div style={styles.muted}>Revenus : {formatEUR(totals.income)}</div>
              <div style={styles.total}>Solde : {formatEUR(totals.net)}</div>
            </div>

          
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>

            <button onClick={exportCSV} style={styles.btnSecondary}>Exporter CSV</button>

            <label style={styles.btnSecondary}>
                Importer CSV
                <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importCSVFile(f);
                    e.target.value = "";
                }}
                />
            </label>
            </div>

          
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.empty}>Aucune dépense pour ce filtre.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map(e => (
            <div key={e.id} style={styles.item}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{formatEUR(e.amount)}</div>
                <div style={styles.muted}>
                   {e.date} • {e.kind === "income" ? "Revenu" : "Dépense"} • {e.category} • {e.bank ?? "Physique"} • {e.accountType ?? "Compte courant"}
                   {e.note ? ` • ${e.note}` : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openEdit(e)} style={styles.btnEdit}>Éditer</button>
                <button onClick={() => onDelete(e.id)} style={styles.btnDanger}>Suppr.</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal édition */}
      {editing && (
        <div style={styles.modalBackdrop} onClick={closeEdit}>
          <div style={styles.modal} onClick={(ev) => ev.stopPropagation()}>
 
            <label style={styles.label}>
              Type
              <select value={editKind} onChange={(e) => setEditKind(e.target.value)} style={styles.input}>
                <option value="expense">Dépense</option>
                <option value="income">Revenu</option>
              </select>
            </label>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Modifier la dépense</h3>
              <button onClick={closeEdit} style={styles.btnX}>✕</button>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label style={styles.label}>
                Montant (€)
                <input
                  inputMode="decimal"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Catégorie
                <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={styles.input}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>

              <label style={styles.label}>
                Banque
                <select value={editBank} onChange={(e) => setEditBank(e.target.value)} style={styles.input}>
                  {(banks ?? ["Physique"]).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>

              <label style={styles.label}>
                Type de compte
                <select value={editAccountType} onChange={(e) => setEditAccountType(e.target.value)} style={styles.input}>
                  {(accountTypes ?? ["Compte courant"]).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <label style={styles.label}>
                Date
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={styles.input} />
              </label>

              <label style={styles.label}>
                Note
                <input value={editNote} onChange={(e) => setEditNote(e.target.value)} style={styles.input} />
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={closeEdit} style={styles.btnSecondary}>Annuler</button>
                <button onClick={saveEdit} style={styles.btnPrimary}>Enregistrer</button>
              </div>

              <div style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.4 }}>
                Astuce : tu peux corriger les anciennes dépenses en changeant Banque/Type ici.
              </div>
            </div>
          </div>
        </div>
      )}

        <div style={{ marginTop: 16 }}>
          <button
            type = "button"
            onClick={onOpenWipeModal}
            style={{
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
            }}
          >
            Supprimer tout l’historique
          </button>
        </div>





    </div>
  );
}

const styles = {
  card: {
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "white",
  },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
  label: { display: "grid", gap: 6, fontWeight: 700, fontSize: 12, color: "#111827" },
  input: { padding: "12px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 15 },
  summary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 4,
  },
  total: { fontSize: 20, fontWeight: 900 },
  muted: { color: "#6b7280", fontSize: 12 },
  btnSecondary: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "white",
    fontWeight: 800,
  },
  item: {
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  btnEdit: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 900,
  },
  btnDanger: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #ef4444",
    background: "#ef4444",
    color: "white",
    fontWeight: 900,
  },
  empty: { color: "#6b7280", textAlign: "center", padding: 24 },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    zIndex: 50,
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    background: "white",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    padding: 14,
  },
  btnPrimary: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 900,
  },
  btnX: {
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 12,
    padding: "6px 10px",
    fontWeight: 900,
  },
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { currentMonthKey, formatEUR, monthLabelFR } from "../utils";
import { saveFilters, loadFilters } from "../filterStorage";

// A SUPPRIMER SI PAS DE BUG LORS DU RUN
// import ImportCreditMutuel from "./ImportCreditMutuel";


export default function ExpenseList({ expenses, categories, subcategoriesMap = {}, categoryColors = {}, banks, accountTypes, people = [], onDelete, onUpdate, onImport, onCreateReimbursement, onOpenWipeModal }) {
  // Filtres par défaut
  const defaultFilters = {
    month: "ALL",
    cat: "Toutes",
    bankFilter: "Toutes",
    accountTypeFilter: "Toutes",
    q: "",
    mode: "month",
    from: "",
    to: "",
    selectedTypes: ["expense", "income", "reimbursement", "transfer_in", "transfer_out"]
  };

  // Charger les filtres sauvegardés (même pattern que Stats.jsx)
  const savedFilters = loadFilters("history", defaultFilters);

  // États pour les filtres — initialisés directement avec les valeurs sauvegardées
  const [month, setMonth] = useState(savedFilters.month);
  const [cat, setCat] = useState(savedFilters.cat);
  const [bankFilter, setBankFilter] = useState(savedFilters.bankFilter);
  const [accountTypeFilter, setAccountTypeFilter] = useState(savedFilters.accountTypeFilter);
  const [q, setQ] = useState(savedFilters.q);
  const [mode, setMode] = useState(savedFilters.mode);
  const [from, setFrom] = useState(savedFilters.from);
  const [to, setTo] = useState(savedFilters.to);
  const [selectedTypes, setSelectedTypes] = useState(savedFilters.selectedTypes);

  // Sauvegarder les filtres à chaque changement
  useEffect(() => {
    const currentFilters = {
      month,
      cat,
      bankFilter,
      accountTypeFilter,
      q,
      mode,
      from,
      to,
      selectedTypes
    };
    saveFilters("history", currentFilters);
  }, [month, cat, bankFilter, accountTypeFilter, q, mode, from, to, selectedTypes]);

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
        if (bankFilter === "Toutes") return true;
        const b = String(e.bank ?? "Physique");
        return b === bankFilter;
      })
      .filter(e => {
        if (accountTypeFilter === "Toutes") return true;
        const a = String(e.accountType ?? "Compte courant");
        return a === accountTypeFilter;
      })
      .filter(e => {
        // Filtre par type d'opération
        if (selectedTypes.length === 0) return true; // Si aucun type sélectionné, tout afficher
        return selectedTypes.includes(e.kind);
      })
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
  }, [expenses, month, mode, from, to, cat, bankFilter, accountTypeFilter, selectedTypes, q]);

const reimburseByExpenseId = useMemo(() => {
  const map = new Map(); // expenseId -> sum
  for (const e of expenses) {
    if (e.kind !== "reimbursement") continue;
    const id = e.linkedExpenseId;
    if (!id) continue;
    map.set(id, (map.get(id) || 0) + Number(e.amount || 0));
  }
  return map;
}, [expenses]);




const totals = useMemo(() => {
  let income = 0;
  let reimbursements = 0;
  let transfersIn = 0;
  let transfersOut = 0;

  // ✅ "Comptable" : on rattache les remboursements à la dépense d'origine.
  // Donc les dépenses du filtre sont neutralisées même si le remboursement est hors période.
  for (const e of filtered) {
    const a = Number(e.amount || 0);
    if (e.kind === "income") income += a;
    if (e.kind === "reimbursement") reimbursements += a; // total cash dans la période
    if (e.kind === "transfer_in") transfersIn += a;
    if (e.kind === "transfer_out") transfersOut += a;
  }

  let expenseGross = 0;
  let expenseNet = 0;

  for (const e of filtered) {
    if (e.kind !== "expense") continue;
    const a = Number(e.amount || 0);
    expenseGross += a;
    const reimb = reimburseByExpenseId.get(e.id) || 0;
    const net = Math.max(0, a - reimb);
    expenseNet += net;
  }

  return {
    income,
    reimbursements,
    expenseGross,
    expenseNet,
    // Solde bancaire (cash) pour la période : revenus + remboursements + virements entrants - dépenses brutes - virements sortants
    net: income + reimbursements + transfersIn - expenseGross - transfersOut
  };
}, [filtered, reimburseByExpenseId]);

  // ---- EDIT MODE ----
  const [editingId, setEditingId] = useState(null);
  const editing = useMemo(() => filtered.find(e => e.id === editingId) ?? null, [filtered, editingId]);
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState(categories[0] ?? "Autres");
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editKind, setEditKind] = useState("expense");
  const [editLinkedExpenseId, setEditLinkedExpenseId] = useState("");
  const [editBank, setEditBank] = useState(banks?.[0] ?? "Physique");
  
  // Pour gerer la modification des virements internes
  const [editOriginal, setEditOriginal] = useState(null);
  const [editDestBank, setEditDestBank] = useState(banks?.[0] ?? "Physique");
  const [editDestAccountType, setEditDestAccountType] = useState(accountTypes?.[0] ?? "Compte courant");
  

  const [editAccountType, setEditAccountType] = useState(accountTypes?.[0] ?? "Compte courant");
  const [editDate, setEditDate] = useState(new Date().toISOString().slice(0, 10));
  const [editNote, setEditNote] = useState("");
  const [editPerson, setEditPerson] = useState("");




  function openEdit(e) {
    setEditingId(e.id);
    setEditAmount(String(e.amount ?? ""));
    setEditCategory(e.category ?? (categories[0] ?? "Autres"));
    setEditSubcategory(e.subcategory ?? "");
    setEditBank(e.bank ?? (banks?.[0] ?? "Physique"));
    setEditAccountType(e.accountType ?? (accountTypes?.[0] ?? "Compte courant"));
    setEditDate(e.date ?? new Date().toISOString().slice(0, 10));
    setEditNote(e.note ?? "");
    setEditPerson(e.person ?? "");
    setEditKind(e.kind ?? "expense");
    setEditLinkedExpenseId(e.linkedExpenseId ?? "");
    setEditOriginal(e);

    // gestion de l'édition des virements internes
    // Destination par défaut : si possible différent du compte source
    setEditDestBank(
      (banks || []).find((b) => b !== (e.bank ?? banks?.[0])) ?? (banks?.[0] ?? "Physique")
    );
    setEditDestAccountType(
      (accountTypes || []).find((t) => t !== (e.accountType ?? accountTypes?.[0])) ?? (accountTypes?.[0] ?? "Compte courant")
    );


  }

  function closeEdit() {
    setEditingId(null);
  }

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

  function saveEdit() {
  const a = Number(String(editAmount).replace(",", "."));
  if (!Number.isFinite(a) || a <= 0) {
    alert("Montant invalide.");
    return;
  }

  const updated = {
    kind: editKind,
    linkedExpenseId: editKind === "reimbursement" ? (editLinkedExpenseId || undefined) : undefined,
    amount: Math.round(a * 100) / 100,
    category: editCategory,
    subcategory: String(editSubcategory || "").trim(),
    bank: editBank,
    accountType: editAccountType,
    date: editDate,
    note: editNote.trim(),
    person: String(editPerson || "").trim()
  };

  // ✅ V2: conversion en virement interne => création automatique de l'opération miroir
  const wasTransfer =
    editOriginal && (editOriginal.kind === "transfer_in" || editOriginal.kind === "transfer_out");
  const becomesTransferOut = editKind === "transfer_out";

  if (becomesTransferOut && !wasTransfer) {
    // Empêche "destination = source"
    if (editDestBank === editBank && editDestAccountType === editAccountType) {
      alert("Le compte destination doit être différent du compte source.");
      return;
    }

    const transferId = makeId();

    // 1) Update la ligne actuelle en transfer_out
    onUpdate(editingId, {
      ...updated,
      kind: "transfer_out",
      transferId
    });

    // 2) Crée la ligne miroir transfer_in sur le compte destination
    const mirror = {
      id: makeId(),
      kind: "transfer_in",
      transferId,
      amount: updated.amount,
      category: updated.category, // tu peux aussi mettre "Virement" si tu préfères
      subcategory: updated.subcategory || "",
      bank: editDestBank,
      accountType: editDestAccountType,
      date: updated.date,
      note: updated.note ? `Virement interne: ${updated.note}` : "Virement interne",
      person: updated.person
    };

    // onImport accepte déjà un tableau de lignes dans ton composant (utilisé pour les imports CSV/CM)
    onImport([mirror]);

    closeEdit();
    return;
  }

  // Comportement normal (pas conversion en virement interne)
  onUpdate(editingId, updated);
  closeEdit();
}

  // Gestion du filtre par type d'opération
  const toggleType = (type) => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const setRealExpensesOnly = () => {
    // Afficher uniquement les dépenses réelles (exclut virements, remboursements, épargne, investissements)
    setSelectedTypes(["expense"]);
  };

  const resetTypeFilter = () => {
    // Réinitialiser pour afficher tous les types
    setSelectedTypes(["expense", "income", "reimbursement", "transfer_in", "transfer_out"]);
  };

  const resetAllFilters = () => {
    // Réinitialiser tous les filtres de l'historique
    setMonth("ALL");
    setCat("Toutes");
    setBankFilter("Toutes");
    setAccountTypeFilter("Toutes");
    setQ("");
    setMode("month");
    setFrom("");
    setTo("");
    setSelectedTypes(["expense", "income", "reimbursement", "transfer_in", "transfer_out"]);
  };
  





//fonction remplacant ce qu'il y a dans le filtrered.map
const renderItem = useCallback((e) => {
  // ── Couleur de la bande gauche (catégorie) ──
  const catColor = categoryColors[e.category] || "#e5e7eb";

  // ── Couleur et badge selon le type d'opération ──
  let amountColor, kindBadge;
  if (e.kind === "income") {
    amountColor = "#16a34a";
    kindBadge = { label: "Revenu", bg: "#dcfce7", color: "#16a34a" };
  } else if (e.kind === "reimbursement") {
    amountColor = "#16a34a";
    kindBadge = { label: "↩ Remb.", bg: "#dcfce7", color: "#16a34a" };
  } else if (e.kind === "transfer_in") {
    amountColor = "#2563eb";
    kindBadge = { label: "⇄ Virement", bg: "#dbeafe", color: "#2563eb" };
  } else if (e.kind === "transfer_out") {
    amountColor = "#6b7280";
    kindBadge = { label: "⇄ Virement", bg: "#f3f4f6", color: "#6b7280" };
  } else {
    // expense
    amountColor = "#dc2626";
    kindBadge = null;
  }

  return (
    <div style={{ ...styles.item, borderLeft: `4px solid ${catColor}`, paddingLeft: 12 }}>
      <div style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
        {/* Ligne 1 : montant + badge type */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: amountColor }}>
            {formatEUR(
              (e.kind === "expense" || e.kind === "transfer_out")
                ? -Number(e.amount || 0)
                : Number(e.amount || 0)
            )}
          </span>
          {kindBadge && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: kindBadge.bg, color: kindBadge.color,
              padding: "2px 7px", borderRadius: 999,
            }}>
              {kindBadge.label}
            </span>
          )}
        </div>

        {e.kind === "expense" && (() => {
          const reimb = reimburseByExpenseId.get(e.id) || 0;
          if (reimb <= 0) return null;
          const remaining = Math.max(0, Number(e.amount || 0) - reimb);
          return (
            <div style={{ color: "#6b7280", fontSize: 12 }}>
              Remboursé: {formatEUR(reimb)} • Reste: {formatEUR(remaining)}
            </div>
          );
        })()}

        {/* Ligne 2 : infos secondaires */}
        <div style={styles.muted}>
          {e.date} • <span style={{ fontWeight: 600, color: catColor !== "#e5e7eb" ? catColor : "#374151" }}>{e.category}</span>
          {" "}• {e.bank ?? "Physique"}
          • {e.accountType ?? "Compte courant"}
          {e.person ? ` • ${e.person}` : ""}
          {e.note ? ` • ${e.note}` : ""}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={() => openEdit(e)} style={styles.btnEdit}>Éditer</button>
        <button onClick={() => onDelete(e.id)} style={styles.btnDanger}>Suppr.</button>
      </div>
    </div>
  );
}, [categoryColors, formatEUR, reimburseByExpenseId, openEdit, onDelete]);
//fonction remplacant ce qu'il y a dans le filtrered.map



  // Virtualisation (hauteurs variables) via @tanstack/react-virtual
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 110, // estimation, les hauteurs réelles sont mesurées automatiquement
    overscan: 10,
  });


  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>
      <div style={styles.card}>
        <div style={{ display: "grid", gap: 10 }}>
         <div
            style={{
              ...styles.row2,
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(190px, 1fr))"
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
              Banque
              <select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} style={styles.input}>
                <option value="Toutes">Toutes</option>
                {(banks || ["Physique"]).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Type de compte
              <select value={accountTypeFilter} onChange={(e) => setAccountTypeFilter(e.target.value)} style={styles.input}>
                <option value="Toutes">Toutes</option>
                {(accountTypes || ["Compte courant"]).map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
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

          {/* Bouton de réinitialisation des filtres */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4 }}>
            <button
              onClick={resetAllFilters}
              style={{
                ...styles.btnSecondary,
                fontSize: 12,
                padding: "8px 12px",
                background: "#f3f4f6",
                border: "1px solid #d1d5db"
              }}
              title="Réinitialiser tous les filtres aux valeurs par défaut"
            >
              🔄 Réinitialiser les filtres
            </button>
          </div>

          {/* Filtre par type d'opération */}
          <div style={{ 
            padding: 14, 
            borderRadius: 12, 
            border: "1px solid #e5e7eb", 
            background: "#f9fafb",
            marginTop: 4
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#111827", marginBottom: 10 }}>
              Type d'opération
            </div>
            
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 8,
              marginBottom: 10
            }}>
              <label style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 8, 
                cursor: "pointer",
                fontSize: 14
              }}>
                <input
                  type="checkbox"
                  checked={selectedTypes.includes("expense")}
                  onChange={() => toggleType("expense")}
                  style={{ cursor: "pointer" }}
                />
                <span>Dépenses</span>
              </label>

              <label style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 8, 
                cursor: "pointer",
                fontSize: 14
              }}>
                <input
                  type="checkbox"
                  checked={selectedTypes.includes("income")}
                  onChange={() => toggleType("income")}
                  style={{ cursor: "pointer" }}
                />
                <span>Revenus</span>
              </label>

              <label style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 8, 
                cursor: "pointer",
                fontSize: 14
              }}>
                <input
                  type="checkbox"
                  checked={selectedTypes.includes("reimbursement")}
                  onChange={() => toggleType("reimbursement")}
                  style={{ cursor: "pointer" }}
                />
                <span>Remboursements</span>
              </label>

              <label style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 8, 
                cursor: "pointer",
                fontSize: 14
              }}>
                <input
                  type="checkbox"
                  checked={selectedTypes.includes("transfer_in") || selectedTypes.includes("transfer_out")}
                  onChange={() => {
                    const hasTransfers = selectedTypes.includes("transfer_in") || selectedTypes.includes("transfer_out");
                    if (hasTransfers) {
                      // Désactiver les deux types de virement
                      setSelectedTypes(prev => prev.filter(t => t !== "transfer_in" && t !== "transfer_out"));
                    } else {
                      // Activer les deux types de virement
                      setSelectedTypes(prev => [...prev, "transfer_in", "transfer_out"]);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                />
                <span>Virements</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button 
                onClick={setRealExpensesOnly}
                style={{
                  ...styles.btnSecondary,
                  fontSize: 12,
                  padding: "8px 12px",
                  background: selectedTypes.length === 1 && selectedTypes[0] === "expense" ? "#111827" : "white",
                  color: selectedTypes.length === 1 && selectedTypes[0] === "expense" ? "white" : "#111827",
                }}
              >
                💰 Mes dépenses réelles
              </button>
              
              <button 
                onClick={resetTypeFilter}
                style={{
                  ...styles.btnSecondary,
                  fontSize: 12,
                  padding: "8px 12px"
                }}
              >
                Tout afficher
              </button>
            </div>

            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
              Astuce : "Mes dépenses réelles" exclut virements, remboursements et épargne pour analyser le vrai coût de vie.
            </div>
          </div>

          <div style={styles.summary}>
            <div>
              <div style={styles.muted}>Dépenses : {formatEUR(totals.expenseNet)} (brut {formatEUR(totals.expenseGross)})</div>
              <div style={styles.muted}>Revenus : {formatEUR(totals.income)}</div>
              <div style={styles.muted}>Remboursements : {formatEUR(totals.reimbursements)}</div>
              <div style={styles.total}>Solde : {formatEUR(totals.net)}</div>
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.empty}>Aucune dépense pour ce filtre.</div>
      ) : (
        <div
          ref={parentRef}
          style={{
            height: "70vh",
            overflow: "auto",
            width: "100%",
            minHeight: 300,
            position: "relative",
          }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const e = filtered[virtualRow.index];
              if (!e) return null;

              return (
                <div
                  key={e.id ?? virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    boxSizing: "border-box",
                    paddingBottom: 10,
                  }}
                >
                  {renderItem(e)}
                </div>
              );
            })}
          </div>
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
              <option value="reimbursement">Remboursement</option>
              <option value="transfer_out">Virement interne</option>
            </select>
          </label>

{editKind === "transfer_out" && (
  <>
    <label style={styles.label}>
      Compte destination (Banque)
      <select value={editDestBank} onChange={(e) => setEditDestBank(e.target.value)} style={styles.input}>
        {(banks || []).map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    </label>

    <label style={styles.label}>
      Compte destination (Type)
      <select value={editDestAccountType} onChange={(e) => setEditDestAccountType(e.target.value)} style={styles.input}>
        {(accountTypes || []).map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </label>

    <div style={{ fontSize: 12, opacity: 0.8, marginTop: -6 }}>
      L’opération miroir (entrée) sera créée automatiquement sur le compte destination.
    </div>
  </>
)}





{editKind === "reimbursement" && (() => {
  const expenseChoices = expenses
    .filter((x) => x.kind === "expense")
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 80);

  const linked = expenseChoices.find((x) => x.id === editLinkedExpenseId)
    || expenses.find((x) => x.id === editLinkedExpenseId);

  return (
    <label style={{ ...styles.label, ...styles.wrapField }}>
      Dépense remboursée
      <select
        value={editLinkedExpenseId}
        onChange={(e) => setEditLinkedExpenseId(e.target.value)}
        style={{ ...styles.input, width: "100%", minWidth: 0 }}
      >
        {expenseChoices.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.date} • {ex.category} • {Number(ex.amount || 0).toFixed(2)}€
          </option>
        ))}
      </select>

      {linked && (
        <div style={{ ...styles.muted, ...styles.wrapText }}>
          {linked.note ? `Note : ${linked.note}` : "Note : (aucune)"}
        </div>
      )}
    </label>
  );
})()}

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
                Sous-catégorie (optionnel)
                <select
                  value={editSubcategory}
                  onChange={(e) => setEditSubcategory(e.target.value)}
                  style={styles.input}
                >
                  <option value="">—</option>
                  {((subcategoriesMap && subcategoriesMap[editCategory]) || []).map((sc) => (
                    <option key={sc} value={sc}>
                      {sc}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Personne (optionnel)
                <input
                  list="people-list"
                  value={editPerson}
                  onChange={(e) => setEditPerson(e.target.value)}
                  placeholder="ex: Julie"
                  style={styles.input}
                />
                <datalist id="people-list">
                  {(Array.isArray(people) ? people : []).map(p => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
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

  wrapField: { minWidth: 0 },
  wrapText: { whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" },


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
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    overflow: "hidden",
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
    maxHeight: "90vh",       // 👈 ne dépasse jamais l’écran
    overflowY: "auto",    // 👈 scroll interne si trop grand
    overflowX: "hidden",

  },
  modal: {
    width: "100%",
    maxWidth: 520,
    background: "white",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    padding: 14,
    maxHeight: "90vh",       // 👈 ne dépasse jamais l’écran
    overflowY: "auto",      // 👈 scroll interne si trop grand
    overflowX: "hidden",

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
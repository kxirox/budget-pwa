import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { currentMonthKey, formatEUR, monthLabelFR, toISODate } from "../utils";
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
    selectedTypes: ["expense", "income", "reimbursement", "transfer_in", "transfer_out"],
    amountMin: "",
    amountMax: "",
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
  const [amountMin, setAmountMin] = useState(savedFilters.amountMin ?? "");
  const [amountMax, setAmountMax] = useState(savedFilters.amountMax ?? "");

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
      selectedTypes,
      amountMin,
      amountMax,
    };
    saveFilters("history", currentFilters);
  }, [month, cat, bankFilter, accountTypeFilter, q, mode, from, to, selectedTypes, amountMin, amountMax]);

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
      .filter(e => {
        const abs = Math.abs(Number(e.amount || 0));
        if (amountMin !== "" && !isNaN(+amountMin) && abs < +amountMin) return false;
        if (amountMax !== "" && !isNaN(+amountMax) && abs > +amountMax) return false;
        return true;
      })
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, month, mode, from, to, cat, bankFilter, accountTypeFilter, selectedTypes, q, amountMin, amountMax]);

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

  // ---- SELECTION MODE (appui long) ----
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [quickSelectOpen, setQuickSelectOpen] = useState(false);
  const longPressTimer = useRef(null);
  const longPressMoved = useRef(false);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setQuickSelectOpen(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      // Quitte le mode si on décoche la dernière
      if (next.size === 0) {
        setSelectionMode(false);
        setQuickSelectOpen(false);
      }
      return next;
    });
  };

  const handlePointerDown = (e, id) => {
    longPressMoved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!longPressMoved.current) {
        // Vibration retour haptique sur mobile
        if (navigator.vibrate) navigator.vibrate(40);
        setSelectionMode(true);
        setSelectedIds(new Set([id]));
      }
    }, 500);
  };

  const handlePointerMove = () => {
    longPressMoved.current = true;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Sélections rapides
  const selectAll = () => {
    setSelectedIds(new Set(filtered.map(e => e.id)));
    setQuickSelectOpen(false);
  };

  const selectCurrentMonth = () => {
    const key = month !== "ALL" ? month : currentMonthKey(new Date().toISOString().slice(0, 10));
    setSelectedIds(new Set(filtered.filter(e => currentMonthKey(e.date) === key).map(e => e.id)));
    setQuickSelectOpen(false);
  };

  const selectCurrentFilter = () => {
    setSelectedIds(new Set(filtered.map(e => e.id)));
    setQuickSelectOpen(false);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
    setQuickSelectOpen(false);
  };

  // Suppression multiple
  const handleBulkDelete = () => {
    const n = selectedIds.size;
    if (!window.confirm(`Tu vas supprimer définitivement ${n} opération${n > 1 ? "s" : ""}. Cette action est irréversible.`)) return;
    selectedIds.forEach(id => onDelete(id));
    exitSelectionMode();
  };

  // ---- UNDO SNACKBAR ----
  const [snackbar, setSnackbar] = useState(null); // { message, snapshot: [{id, ...fields}] }
  const snackbarTimer = useRef(null);
  const [snackbarCountdown, setSnackbarCountdown] = useState(5);
  const snackbarCountdownRef = useRef(null);

  const showSnackbar = (message, snapshot) => {
    // Annuler un éventuel timer précédent
    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    if (snackbarCountdownRef.current) clearInterval(snackbarCountdownRef.current);

    setSnackbar({ message, snapshot });
    setSnackbarCountdown(5);

    // Countdown 1s
    snackbarCountdownRef.current = setInterval(() => {
      setSnackbarCountdown(prev => {
        if (prev <= 1) {
          clearInterval(snackbarCountdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Disparaît après 5s
    snackbarTimer.current = setTimeout(() => {
      setSnackbar(null);
      setSnackbarCountdown(5);
    }, 5000);
  };

  const handleUndo = () => {
    if (!snackbar?.snapshot) return;
    // Restaurer chaque opération à son état d'avant
    for (const old of snackbar.snapshot) {
      const { id, ...fields } = old;
      onUpdate(id, fields);
    }
    clearTimeout(snackbarTimer.current);
    clearInterval(snackbarCountdownRef.current);
    setSnackbar(null);
    setSnackbarCountdown(5);
  };

  // ---- BULK EDIT ----
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  // Chaque champ a un état "touched" (modifié par l'utilisateur) + "value"
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkCategoryTouched, setBulkCategoryTouched] = useState(false);
  const [bulkSubcategory, setBulkSubcategory] = useState("");
  const [bulkSubcategoryTouched, setBulkSubcategoryTouched] = useState(false);
  const [bulkBank, setBulkBank] = useState("");
  const [bulkBankTouched, setBulkBankTouched] = useState(false);
  const [bulkAccountType, setBulkAccountType] = useState("");
  const [bulkAccountTypeTouched, setBulkAccountTypeTouched] = useState(false);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkDateTouched, setBulkDateTouched] = useState(false);
  const [bulkNote, setBulkNote] = useState("");
  const [bulkNoteTouched, setBulkNoteTouched] = useState(false);
  const [bulkPerson, setBulkPerson] = useState("");
  const [bulkPersonTouched, setBulkPersonTouched] = useState(false);
  const [bulkContributor, setBulkContributor] = useState("");
  const [bulkContributorTouched, setBulkContributorTouched] = useState(false);

  // Calcule la valeur commune d'un champ parmi les lignes sélectionnées
  const commonValue = (field) => {
    const items = expenses.filter(e => selectedIds.has(e.id));
    if (items.length === 0) return "";
    const vals = new Set(items.map(e => String(e[field] ?? "")));
    return vals.size === 1 ? [...vals][0] : null; // null = valeurs différentes
  };

  const openBulkEdit = () => {
    // Pré-remplir avec les valeurs communes
    const cv = (f) => commonValue(f) ?? "";
    setBulkCategory(cv("category"));
    setBulkCategoryTouched(false);
    setBulkSubcategory(cv("subcategory"));
    setBulkSubcategoryTouched(false);
    setBulkBank(cv("bank"));
    setBulkBankTouched(false);
    setBulkAccountType(cv("accountType"));
    setBulkAccountTypeTouched(false);
    setBulkDate(cv("date"));
    setBulkDateTouched(false);
    setBulkNote(cv("note"));
    setBulkNoteTouched(false);
    setBulkPerson(cv("person"));
    setBulkPersonTouched(false);
    setBulkContributor("");
    setBulkContributorTouched(false);
    setBulkEditOpen(true);
  };

  const closeBulkEdit = () => setBulkEditOpen(false);

  const applyBulkEdit = () => {
    const n = selectedIds.size;
    // Compter les champs réellement modifiés
    const changes = [];
    if (bulkCategoryTouched && bulkCategory) changes.push("catégorie");
    if (bulkSubcategoryTouched) changes.push("sous-catégorie");
    if (bulkBankTouched && bulkBank) changes.push("banque");
    if (bulkAccountTypeTouched && bulkAccountType) changes.push("type de compte");
    if (bulkDateTouched && bulkDate) changes.push("date");
    if (bulkNoteTouched) changes.push("note");
    if (bulkPersonTouched) changes.push("personne");
    if (bulkContributorTouched && bulkContributor) changes.push("contributeur");

    if (changes.length === 0) {
      alert("Aucun champ modifié. Modifie au moins un champ pour appliquer.");
      return;
    }

    if (n >= 3) {
      const ok = window.confirm(
        `Tu vas modifier ${n} opération${n > 1 ? "s" : ""} (${changes.join(", ")}).\n\nContinuer ?`
      );
      if (!ok) return;
    }

    // Sauvegarder le snapshot AVANT modification (pour undo)
    const items = expenses.filter(e => selectedIds.has(e.id));
    const snapshot = items.map(e => ({ ...e }));

    // Appliquer les changements
    for (const e of items) {
      const patch = {};

      if (bulkCategoryTouched && bulkCategory) {
        patch.category = bulkCategory;
        // Si catégorie change et sous-catégorie n'est PAS touchée manuellement → reset sous-cat
        if (!bulkSubcategoryTouched) patch.subcategory = "";
      }
      if (bulkSubcategoryTouched) patch.subcategory = bulkSubcategory;
      if (bulkBankTouched && bulkBank) patch.bank = bulkBank;
      if (bulkAccountTypeTouched && bulkAccountType) patch.accountType = bulkAccountType;
      if (bulkDateTouched && bulkDate) patch.date = bulkDate;
      if (bulkNoteTouched) patch.note = bulkNote.trim();
      if (bulkPersonTouched) patch.person = bulkPerson.trim();
      // Contributeur : pour les revenus ET virements entrants du compte commun
      if (bulkContributorTouched && bulkContributor && (e.kind === "income" || e.kind === "transfer_in") && e.accountType === "Compte commun") {
        patch.contributor = bulkContributor;
      }

      if (Object.keys(patch).length > 0) {
        onUpdate(e.id, patch);
      }
    }

    // Snackbar undo
    showSnackbar(`✅ ${n} opération${n > 1 ? "s" : ""} modifiée${n > 1 ? "s" : ""}`, snapshot);

    closeBulkEdit();
    exitSelectionMode();
  };

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
  const [editContributor, setEditContributor] = useState("external");

  // ── Modal remboursement rapide ──
  const [reimbModalExpense, setReimbModalExpense] = useState(null);
  const [reimbAmount, setReimbAmount] = useState("");
  const [reimbDate, setReimbDate] = useState("");




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
    setEditContributor(["me", "partner", "external"].includes(e.contributor) ? e.contributor : "external");
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

  function openReimbModal(expense) {
    setReimbModalExpense(expense);
    setReimbAmount(String(expense.amount));
    setReimbDate(toISODate(new Date()));
  }

  function closeReimbModal() {
    setReimbModalExpense(null);
    setReimbAmount("");
    setReimbDate("");
  }

  function submitReimb() {
    const a = Number(String(reimbAmount).replace(",", "."));
    if (!Number.isFinite(a) || a <= 0) {
      alert("Montant invalide.");
      return;
    }
    onCreateReimbursement({
      linkedExpenseId: reimbModalExpense.id,
      amount: a,
      date: reimbDate,
      bank: reimbModalExpense.bank,
      accountType: reimbModalExpense.accountType,
      note: "",
      person: reimbModalExpense.person ?? "",
    });
    closeReimbModal();
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
    person: String(editPerson || "").trim(),
    contributor: ((editKind === "income" || editKind === "transfer_in") && editAccountType === "Compte commun") ? editContributor : "external",
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
    setAmountMin("");
    setAmountMax("");
  };
  





//fonction remplacant ce qu'il y a dans le filtrered.map
const renderItem = useCallback((e) => {
  // ── Couleur de la bande gauche (catégorie) ──
  const catColor = categoryColors[e.category] || "#e5e7eb";
  const isSelected = selectedIds.has(e.id);

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
    amountColor = "#dc2626";
    kindBadge = null;
  }

  return (
    <div
      onPointerDown={(ev) => handlePointerDown(ev, e.id)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={() => {
        if (selectionMode) {
          toggleSelect(e.id);
        }
      }}
      style={{
        ...styles.item,
        borderLeft: `4px solid ${catColor}`,
        paddingLeft: 12,
        background: isSelected ? "#f0e9d8" : "#fdfaf5",
        outline: isSelected ? "2px solid #c9a84c" : "none",
        userSelect: "none",
        cursor: selectionMode ? "pointer" : "default",
        transition: "background 0.15s, outline 0.15s",
      }}
    >
      {/* Case à cocher en mode sélection */}
      {selectionMode && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%",
            border: `2px solid ${isSelected ? "#c9a84c" : "#d4c9ae"}`,
            background: isSelected ? "#c9a84c" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}>
            {isSelected && <span style={{ color: "white", fontSize: 13, fontWeight: 900, lineHeight: 1 }}>✓</span>}
          </div>
        </div>
      )}

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
          {(e.kind === "income" || e.kind === "transfer_in") && e.accountType === "Compte commun" && e.contributor && e.contributor !== "external" && (
            <span style={{
              display: "inline-block",
              background: e.contributor === "me" ? "#dcfce7" : "#dbeafe",
              color: e.contributor === "me" ? "#166534" : "#1e40af",
              padding: "1px 6px",
              borderRadius: 8,
              fontSize: 11,
              marginLeft: 4,
              verticalAlign: "middle"
            }}>
              {e.contributor === "me" ? "Moi" : "Conjoint"}
            </span>
          )}
        </div>
      </div>

      {/* Boutons éditer/supprimer — masqués en mode sélection */}
      {!selectionMode && (
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {e.kind === "expense" && (
            <button
              onClick={() => openReimbModal(e)}
              style={styles.btnReimb}
              title="Ajouter un remboursement"
            >
              ↩
            </button>
          )}
          <button onClick={() => openEdit(e)} style={styles.btnEdit}>Éditer</button>
          <button onClick={() => onDelete(e.id)} style={styles.btnDanger}>Suppr.</button>
        </div>
      )}
    </div>
  );
}, [categoryColors, formatEUR, reimburseByExpenseId, openEdit, onDelete, selectionMode, selectedIds, handlePointerDown, handlePointerMove, handlePointerUp, toggleSelect, openReimbModal]);
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

          {/* Filtre montant min / max */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={styles.label}>
              Montant min (€)
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  style={{ ...styles.input, width: "100%", paddingRight: amountMin ? 28 : 12 }}
                  placeholder="0"
                />
                {amountMin !== "" && (
                  <button
                    onClick={() => setAmountMin("")}
                    style={styles.clearBtn}
                    title="Effacer"
                  >✕</button>
                )}
              </div>
            </label>
            <label style={styles.label}>
              Montant max (€)
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  style={{ ...styles.input, width: "100%", paddingRight: amountMax ? 28 : 12 }}
                  placeholder="∞"
                />
                {amountMax !== "" && (
                  <button
                    onClick={() => setAmountMax("")}
                    style={styles.clearBtn}
                    title="Effacer"
                  >✕</button>
                )}
              </div>
            </label>
          </div>
          {(amountMin !== "" || amountMax !== "") && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: -4 }}>
              💰 Filtre actif : {amountMin !== "" ? `≥ ${amountMin}€` : ""}{amountMin !== "" && amountMax !== "" ? " et " : ""}{amountMax !== "" ? `≤ ${amountMax}€` : ""}
            </div>
          )}

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

      {/* ── Barre d'action mode sélection ── */}
      {selectionMode && (
        <div style={styles.selectionBar}>
          {/* Bouton Annuler */}
          <button onClick={exitSelectionMode} style={styles.selBarBtn}>
            ✕ Annuler
          </button>

          {/* Compteur + dropdown sélection rapide */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setQuickSelectOpen(o => !o)}
              style={{ ...styles.selBarBtn, background: "#3d3728", color: "#fdfaf5", fontWeight: 800 }}
            >
              {selectedIds.size} sélectionnée{selectedIds.size > 1 ? "s" : ""} ▾
            </button>
            {quickSelectOpen && (
              <div style={styles.quickSelectMenu}>
                <button style={styles.quickSelectItem} onClick={selectAll}>✅ Tout sélectionner</button>
                <button style={styles.quickSelectItem} onClick={selectCurrentFilter}>🔍 Sélection filtre actif</button>
                <button style={styles.quickSelectItem} onClick={selectCurrentMonth}>📅 Sélectionner ce mois</button>
                <button style={styles.quickSelectItem} onClick={deselectAll}>☐ Tout désélectionner</button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button
              onClick={openBulkEdit}
              style={{ ...styles.selBarBtn, background: "#111827", color: "white", border: "none" }}
              title="Éditer la sélection"
            >
              ✏️ Éditer
            </button>
            <button
              onClick={handleBulkDelete}
              style={{ ...styles.selBarBtn, background: "#ef4444", color: "white", border: "none" }}
              title="Supprimer la sélection"
            >
              🗑️ Supprimer
            </button>
          </div>
        </div>
      )}

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

              {(editKind === "income" || editKind === "transfer_in") && editAccountType === "Compte commun" && (
                <label style={styles.label}>
                  Contributeur
                  <select value={editContributor} onChange={(e) => setEditContributor(e.target.value)} style={styles.input}>
                    <option value="external">Externe</option>
                    <option value="me">Moi</option>
                    <option value="partner">Conjoint</option>
                  </select>
                </label>
              )}

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

      {/* ── Modal édition multiple ── */}
      {bulkEditOpen && (
        <div style={styles.modalBackdrop} onClick={closeBulkEdit}>
          <div style={styles.modal} onClick={(ev) => ev.stopPropagation()}>

            {/* En-tête */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>✏️ Modifier {selectedIds.size} opération{selectedIds.size > 1 ? "s" : ""}</h3>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                  Seuls les champs modifiés seront appliqués.
                </div>
              </div>
              <button onClick={closeBulkEdit} style={styles.btnX}>✕</button>
            </div>

            {/* Avertissement montant désactivé */}
            <div style={{ fontSize: 12, color: "#b45309", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
              ⚠️ Le montant et le type d'opération ne sont pas modifiables en édition multiple.
            </div>

            <div style={{ display: "grid", gap: 12 }}>

              {/* Catégorie */}
              {(() => {
                const cv = commonValue("category");
                return (
                  <div style={styles.bulkField}>
                    <div style={styles.bulkFieldHeader}>
                      <span style={styles.label}>Catégorie</span>
                      {bulkCategoryTouched && (
                        <span style={styles.bulkModifiedBadge}>● modifié</span>
                      )}
                    </div>
                    <select
                      value={bulkCategory}
                      onChange={(e) => { setBulkCategory(e.target.value); setBulkCategoryTouched(true); setBulkSubcategoryTouched(false); setBulkSubcategory(""); }}
                      style={{ ...styles.input, borderColor: bulkCategoryTouched ? "#c9a84c" : "#d4c9ae" }}
                    >
                      {!bulkCategoryTouched && cv === null && <option value="">— Valeurs différentes —</option>}
                      {!bulkCategoryTouched && cv !== null && <option value={cv}>{cv} (valeur commune)</option>}
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                );
              })()}

              {/* Sous-catégorie */}
              {(() => {
                const cv = commonValue("subcategory");
                const catForSub = bulkCategoryTouched ? bulkCategory : (commonValue("category") ?? "");
                const subOptions = (subcategoriesMap && subcategoriesMap[catForSub]) || [];
                return (
                  <div style={styles.bulkField}>
                    <div style={styles.bulkFieldHeader}>
                      <span style={styles.label}>Sous-catégorie</span>
                      {bulkSubcategoryTouched && (
                        <span style={styles.bulkModifiedBadge}>● modifié</span>
                      )}
                    </div>
                    <select
                      value={bulkSubcategory}
                      onChange={(e) => { setBulkSubcategory(e.target.value); setBulkSubcategoryTouched(true); }}
                      style={{ ...styles.input, borderColor: bulkSubcategoryTouched ? "#c9a84c" : "#d4c9ae" }}
                    >
                      {!bulkSubcategoryTouched && cv === null && <option value="">— Valeurs différentes —</option>}
                      <option value="">— Aucune —</option>
                      {subOptions.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                    </select>
                  </div>
                );
              })()}

              {/* Banque */}
              {(() => {
                const cv = commonValue("bank");
                return (
                  <div style={styles.bulkField}>
                    <div style={styles.bulkFieldHeader}>
                      <span style={styles.label}>Banque</span>
                      {bulkBankTouched && <span style={styles.bulkModifiedBadge}>● modifié</span>}
                    </div>
                    <select
                      value={bulkBank}
                      onChange={(e) => { setBulkBank(e.target.value); setBulkBankTouched(true); }}
                      style={{ ...styles.input, borderColor: bulkBankTouched ? "#c9a84c" : "#d4c9ae" }}
                    >
                      {!bulkBankTouched && cv === null && <option value="">— Valeurs différentes —</option>}
                      {(banks || ["Physique"]).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                );
              })()}

              {/* Type de compte */}
              {(() => {
                const cv = commonValue("accountType");
                return (
                  <div style={styles.bulkField}>
                    <div style={styles.bulkFieldHeader}>
                      <span style={styles.label}>Type de compte</span>
                      {bulkAccountTypeTouched && <span style={styles.bulkModifiedBadge}>● modifié</span>}
                    </div>
                    <select
                      value={bulkAccountType}
                      onChange={(e) => { setBulkAccountType(e.target.value); setBulkAccountTypeTouched(true); }}
                      style={{ ...styles.input, borderColor: bulkAccountTypeTouched ? "#c9a84c" : "#d4c9ae" }}
                    >
                      {!bulkAccountTypeTouched && cv === null && <option value="">— Valeurs différentes —</option>}
                      {(accountTypes || ["Compte courant"]).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                );
              })()}

              {/* Date */}
              {(() => {
                const cv = commonValue("date");
                return (
                  <div style={styles.bulkField}>
                    <div style={styles.bulkFieldHeader}>
                      <span style={styles.label}>Date</span>
                      {bulkDateTouched && <span style={styles.bulkModifiedBadge}>● modifié</span>}
                      {!bulkDateTouched && cv === null && <span style={{ fontSize: 11, color: "#6b7280" }}>valeurs différentes</span>}
                    </div>
                    <input
                      type="date"
                      value={bulkDate}
                      onChange={(e) => { setBulkDate(e.target.value); setBulkDateTouched(true); }}
                      style={{ ...styles.input, borderColor: bulkDateTouched ? "#c9a84c" : "#d4c9ae" }}
                    />
                  </div>
                );
              })()}

              {/* Note */}
              {(() => {
                const cv = commonValue("note");
                return (
                  <div style={styles.bulkField}>
                    <div style={styles.bulkFieldHeader}>
                      <span style={styles.label}>Note</span>
                      {bulkNoteTouched && <span style={styles.bulkModifiedBadge}>● modifié</span>}
                    </div>
                    <input
                      type="text"
                      value={bulkNote}
                      onChange={(e) => { setBulkNote(e.target.value); setBulkNoteTouched(true); }}
                      placeholder={cv === null ? "— Valeurs différentes —" : (cv || "Ajouter une note…")}
                      style={{ ...styles.input, borderColor: bulkNoteTouched ? "#c9a84c" : "#d4c9ae" }}
                    />
                  </div>
                );
              })()}

              {/* Personne */}
              {(() => {
                const cv = commonValue("person");
                return (
                  <div style={styles.bulkField}>
                    <div style={styles.bulkFieldHeader}>
                      <span style={styles.label}>Personne</span>
                      {bulkPersonTouched && <span style={styles.bulkModifiedBadge}>● modifié</span>}
                    </div>
                    <input
                      list="bulk-people-list"
                      value={bulkPerson}
                      onChange={(e) => { setBulkPerson(e.target.value); setBulkPersonTouched(true); }}
                      placeholder={cv === null ? "— Valeurs différentes —" : (cv || "ex: Julie")}
                      style={{ ...styles.input, borderColor: bulkPersonTouched ? "#c9a84c" : "#d4c9ae" }}
                    />
                    <datalist id="bulk-people-list">
                      {(Array.isArray(people) ? people : []).map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                );
              })()}

              {/* Contributeur — visible uniquement si la sélection contient des revenus Compte commun */}
              {expenses.some(e => selectedIds.has(e.id) && (e.kind === "income" || e.kind === "transfer_in") && e.accountType === "Compte commun") && (
                <div style={styles.bulkField}>
                  <div style={styles.bulkFieldHeader}>
                    <span style={styles.label}>Contributeur</span>
                    {bulkContributorTouched && <span style={styles.bulkModifiedBadge}>● modifié</span>}
                  </div>
                  <select
                    value={bulkContributor}
                    onChange={(e) => { setBulkContributor(e.target.value); setBulkContributorTouched(true); }}
                    style={{ ...styles.input, borderColor: bulkContributorTouched ? "#c9a84c" : "#d4c9ae" }}
                  >
                    {!bulkContributorTouched && <option value="">— Choisir —</option>}
                    <option value="external">Externe</option>
                    <option value="me">Moi</option>
                    <option value="partner">Conjoint</option>
                  </select>
                </div>
              )}

            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={closeBulkEdit} style={styles.btnSecondary}>Annuler</button>
              <button onClick={applyBulkEdit} style={styles.btnPrimary}>
                ✅ Appliquer à {selectedIds.size} opération{selectedIds.size > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal remboursement rapide ── */}
      {reimbModalExpense && (
        <div style={styles.modalBackdrop} onClick={closeReimbModal}>
          <div style={styles.modal} onClick={ev => ev.stopPropagation()}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>↩ Rembourser cette dépense</h3>
              <button onClick={closeReimbModal} style={styles.btnX}>✕</button>
            </div>

            {/* Rappel de la dépense d'origine */}
            <div style={{ background: "#f9fafb", borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: 13, color: "#374151" }}>
              <strong>{reimbModalExpense.category}</strong>
              {reimbModalExpense.note ? ` — ${reimbModalExpense.note}` : ""}
              <span style={{ float: "right", fontWeight: 700 }}>
                {formatEUR(reimbModalExpense.amount)}
              </span>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <label style={styles.label}>
                Montant remboursé (€)
                <input
                  inputMode="decimal"
                  value={reimbAmount}
                  onChange={e => setReimbAmount(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Date du remboursement
                <input
                  type="date"
                  value={reimbDate}
                  onChange={e => setReimbDate(e.target.value)}
                  style={styles.input}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={closeReimbModal} style={styles.btnSecondary}>Annuler</button>
              <button onClick={submitReimb} style={styles.btnPrimary}>✅ Créer le remboursement</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Snackbar undo ── */}
      {snackbar && (
        <div style={styles.snackbar}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{snackbar.message}</span>
          <button onClick={handleUndo} style={styles.snackbarBtn}>
            ↩ Annuler ({snackbarCountdown}s)
          </button>
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
    border: "1px solid #e8dfc8",
    background: "#fdfaf5",
  },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
  label: { display: "grid", gap: 6, fontWeight: 700, fontSize: 12, color: "#111827" },
  input: { padding: "12px", borderRadius: 12, border: "1px solid #d4c9ae", background: "#fdfaf5", fontSize: 15 },
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
    background: "#fdfaf5",
    fontWeight: 800,
  },
  item: {
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid #e8dfc8",
    background: "#fdfaf5",
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
  btnReimb: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#f0fdf4",
    color: "#16a34a",
    fontSize: 14,
    cursor: "pointer",
    fontWeight: 700,
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
    maxHeight: "90vh",
    overflowY: "auto",
    overflowX: "hidden",

  },
  modal: {
    width: "100%",
    maxWidth: 520,
    background: "#fdfaf5",
    borderRadius: 18,
    border: "1px solid #e8dfc8",
    padding: 14,
    maxHeight: "90vh",
    overflowY: "auto",
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
    border: "1px solid #e8dfc8",
    background: "#fdfaf5",
    borderRadius: 12,
    padding: "6px 10px",
    fontWeight: 900,
  },
  clearBtn: {
    position: "absolute",
    right: 6,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: 700,
    padding: "2px 4px",
    lineHeight: 1,
  },

  // ── Barre de sélection multiple ──
  selectionBar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    padding: "10px 12px",
    background: "#fdf6e3",
    border: "1px solid #c9a84c",
    borderRadius: 14,
    boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
  },
  selBarBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid #c9a84c",
    background: "#fdfaf5",
    color: "#3d3728",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  quickSelectMenu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    zIndex: 30,
    background: "#fdfaf5",
    border: "1px solid #e8dfc8",
    borderRadius: 12,
    boxShadow: "0 4px 16px rgba(0,0,0,0.14)",
    overflow: "hidden",
    minWidth: 210,
  },
  quickSelectItem: {
    display: "block",
    width: "100%",
    padding: "11px 16px",
    background: "none",
    border: "none",
    borderBottom: "1px solid #f0e9d8",
    textAlign: "left",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    color: "#3d3728",
  },

  // ── Bulk edit modal ──
  bulkField: {
    display: "grid",
    gap: 5,
  },
  bulkFieldHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  bulkModifiedBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: "#c9a84c",
    background: "#fef3c7",
    padding: "2px 7px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  },

  // ── Snackbar undo ──
  snackbar: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "#1f2937",
    color: "#f9fafb",
    padding: "12px 18px",
    borderRadius: 14,
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
    maxWidth: "90vw",
    whiteSpace: "nowrap",
  },
  snackbarBtn: {
    background: "#c9a84c",
    color: "#1f2937",
    border: "none",
    borderRadius: 8,
    padding: "6px 12px",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
import React, { useEffect, useMemo, useRef, useState } from "react";
import TopBar from "./components/TopBar.jsx";
import AddExpense from "./components/AddExpense.jsx";
import ExpenseList from "./components/ExpenseList.jsx";
import Stats from "./components/Stats.jsx";
import Categories from "./components/Categories.jsx";
import Debts from "./components/Debts.jsx";
import AutoCategorize from "./components/AutoCategorize.jsx";
import {
  loadCategories,
  loadExpenses,
  saveCategories,
  saveExpenses,
  uid,
  DEFAULT_BANKS,
  DEFAULT_ACCOUNT_TYPES,
  loadPeople,
  savePeople,
  loadCategoryColors,
  saveCategoryColors,
  loadAutoCatRules,
  saveAutoCatRules,
  loadForecastItems,
  saveForecastItems,
  loadForecastSettings,
  saveForecastSettings
} from "./storage.js";
import { loadRecurring, saveRecurring } from "./storage.js";
import { loadSubcategories, saveSubcategories } from "./storage.js";
import { applyRecurring } from "./recurring.js";
import Recurring from "./components/Recurring.jsx";
import Forecast from "./components/Forecast.jsx";
import ManageLists from "./components/ManageLists";
import SubCategories from "./components/SubCategories.jsx";
import ImportExport from "./components/ImportExport.jsx";
import { loadBanks, saveBanks, loadAccountTypes, saveAccountTypes } from "./storage";
import {
  initDriveAuth,
  isDriveConnected,
  requestDriveToken,
  requestDriveTokenSilent,
  uploadOrUpdateFile,
  downloadFileByName,
  getBackupMetadata,
} from "./drive";





function startOfDayTs(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

// Solde total "rejoué" jusqu'à une date (global tous comptes)
// - expense => -amount
// - income / reimbursement => +amount
// - transfer => 0 (ne doit pas impacter le total global)
function totalBalanceAt(expenses, dateLimit) {
  const limit = startOfDayTs(dateLimit);

  return expenses.reduce((sum, e) => {
    const t = startOfDayTs(e.date);
    if (t > limit) return sum;

    const amount = Number(e.amount || 0);
    const kind = e.kind;

    if (kind === "transfer") return sum;

    if (kind === "income" || kind === "reimbursement") return sum + amount;
    if (kind === "expense") return sum - amount;

    // si tu as d'autres kinds, on ne les compte pas par défaut
    return sum;
  }, 0);
}

function formatSignedEUR(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)} €`;
}

function formatSignedPct(value) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)} %`;
}







export default function App() {
  // Persister l'onglet actif
  const loadActiveTab = () => {
    try {
      const saved = localStorage.getItem("budget_active_tab");
      return saved || "add";
    } catch {
      return "add";
    }
  };

  const [tab, setTab] = useState(loadActiveTab);
  
  // Sauvegarder l'onglet actif à chaque changement
  useEffect(() => {
    try {
      localStorage.setItem("budget_active_tab", tab);
    } catch (err) {
      console.warn("Impossible de sauvegarder l'onglet actif:", err);
    }
  }, [tab]);

  const [categories, setCategories] = useState(() => loadCategories());
  const [expenses, setExpenses] = useState(() => loadExpenses());
  const [banks, setBanks] = useState(() => {
    const loaded = loadBanks(expenses);
    return loaded.length ? loaded : DEFAULT_BANKS;
  });

  const [accountTypes, setAccountTypes] = useState(() => {
    const loaded = loadAccountTypes(expenses);
    return loaded.length ? loaded : DEFAULT_ACCOUNT_TYPES;
  });

  // Google Drive status
  const [driveStatus, setDriveStatus] = useState("Drive : non connecté");
  // "idle" | "saving" | "saved" | "error"
  const [syncStatus, setSyncStatus] = useState("idle");
  // Modal de conflit local vs Drive
  const [conflictModal, setConflictModal] = useState(null); // null ou { drivePayload, driveDate, localDate }
  // Ref pour le timer debounce
  const debounceRef = useRef(null);
  // Flag pour ignorer le premier render (on ne sauvegarde pas au démarrage)
  const isFirstRender = useRef(true);
  // Afficher le modal de connexion Google (premier lancement ou session expirée)
  const [showDriveModal, setShowDriveModal] = useState(false);


  const [categoryColors, setCategoryColors] = useState(() => loadCategoryColors());
  const [subcategoriesMap, setSubcategoriesMap] = useState(() => loadSubcategories());
  const [recurring, setRecurring] = useState(() => loadRecurring());
  const [people, setPeople] = useState(() => loadPeople());

  const [autoCatRules, setAutoCatRules] = useState(() => loadAutoCatRules());


  const [forecastItems, setForecastItems] = useState(() => loadForecastItems());
  const [forecastSettings, setForecastSettings] = useState(() => loadForecastSettings());

  const [perfScope, setPerfScope] = useState("7d"); // "7d" | "1m" | "1y" | "all"


  // wipe data modal pour supprimer toutes les donnees d'un coup 
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeText, setWipeText] = useState("");


  const performance = useMemo(() => {
  const now = new Date();

  // date de début selon scope
  let start;
  if (perfScope === "7d") start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  else if (perfScope === "1m") start = addMonths(now, -1);
  else if (perfScope === "1y") start = addYears(now, -1);
  else start = null; // all time

  // all time => début = première opération
  let startDate = start;
  if (!startDate) {
    const dates = expenses.map(e => startOfDayTs(e.date)).filter(Boolean);
    const minTs = dates.length ? Math.min(...dates) : startOfDayTs(now);
    startDate = new Date(minTs);
  }

  const startBal = totalBalanceAt(expenses, startDate);
  const endBal = totalBalanceAt(expenses, now);
  const delta = endBal - startBal;

  const pct = startBal !== 0 ? (delta / startBal) * 100 : null;

  return { startBal, endBal, delta, pct, startDate };
}, [expenses, perfScope]);


// Google Drive backup initialisation + tentative de reconnexion silencieuse
  useEffect(() => {
    (async () => {
      try {
        await initDriveAuth({
          clientId: "13115896272-m2mmtrs46ogkacnn33jcnsju4qartabi.apps.googleusercontent.com",
          scope: "https://www.googleapis.com/auth/drive.file",
        });
        setDriveStatus("Drive : prêt (non connecté)");

        const driveEnabled = localStorage.getItem("budget_drive_enabled") === "true";

        if (driveEnabled) {
          // Déjà utilisé Drive → tentative silencieuse d'abord
          try {
            await requestDriveTokenSilent();
            // Succès silencieux → sync transparente, pas de popup
            await handlePostConnect();
            return;
          } catch {
            // Session expirée → afficher le modal de reconnexion
            setDriveStatus("Drive : reconnexion requise");
          }
        }

        // Premier lancement OU session expirée → afficher le modal de connexion
        setShowDriveModal(true);

      } catch (e) {
        console.error(e);
        setDriveStatus("Drive : script Google non chargé ❌");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sauvegarde automatique avec debounce ──────────────────────────────────
  // Se déclenche 4 secondes après la dernière modification des données,
  // uniquement si Drive est connecté. Ignore le premier render.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isDriveConnected()) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    setSyncStatus("saving");
    debounceRef.current = setTimeout(async () => {
      try {
        const payload = buildAutoBackupPayload();
        await uploadOrUpdateFile({
          name: "budget-pwa-backup.json",
          mimeType: "application/json",
          content: JSON.stringify(payload, null, 2),
        });
        localStorage.setItem("budget_last_save", new Date().toISOString());
        setSyncStatus("saved");
        // Repasser à "idle" après 3s pour ne pas afficher "sauvegardé" indéfiniment
        setTimeout(() => setSyncStatus("idle"), 3000);
      } catch (err) {
        console.error("Sauvegarde auto Drive échouée :", err);
        setSyncStatus("error");
      }
    }, 4000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // On écoute toutes les données qui doivent être sauvegardées
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, categories, banks, accountTypes, people, recurring,
      categoryColors, subcategoriesMap, autoCatRules, forecastItems, forecastSettings]);






  // Initialisation des banques et types de compte depuis l'historique si vide
  useEffect(() => {
  setBanks((prev) => (prev && prev.length ? prev : loadBanks(expenses)));
  setAccountTypes((prev) => (prev && prev.length ? prev : loadAccountTypes(expenses)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [expenses.length]);


// Persistance des banques et types de compte
  useEffect(() => saveBanks(banks), [banks]);
  useEffect(() => saveAccountTypes(accountTypes), [accountTypes]);



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
  useEffect(() => saveSubcategories(subcategoriesMap), [subcategoriesMap]);
  useEffect(() => savePeople(people), [people]);

  // Persistance du prévisionnel
  useEffect(() => saveForecastItems(forecastItems), [forecastItems]);
  useEffect(() => saveForecastSettings(forecastSettings), [forecastSettings]);





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
    // Virement interne = 2 écritures : sortie + entrée (ne compte ni comme dépense ni comme revenu)
    if (payload?.kind === "transfer") {
      const amount = Math.abs(payload.amount);
      const transferId = uid();

      const out = {
        id: uid(),
        kind: "transfer_out",
        transferId,
        amount,
        category: "Virement",
        subcategory: "",
        bank: payload.fromBank ?? payload.bank,
        accountType: payload.fromAccountType ?? payload.accountType,
        date: payload.date,
        note: payload.note ?? "",
        person: ""
      };

      const inn = {
        id: uid(),
        kind: "transfer_in",
        transferId,
        amount,
        category: "Virement",
        subcategory: "",
        bank: payload.toBank,
        accountType: payload.toAccountType,
        date: payload.date,
        note: payload.note ?? "",
        person: ""
      };

      setExpenses(prev => [inn, out, ...prev]);
      return;
    }

    const e = {
      id: uid(),
      kind: payload.kind ?? "expense",
      amount: Math.abs(payload.amount),
      category: payload.category,
      subcategory: (payload.subcategory ?? "").trim(),
      bank: payload.bank,
      accountType: payload.accountType,
      date: payload.date,
      note: payload.note ?? "",
      person: (payload.person ?? "").trim(),
      linkedExpenseId: payload.linkedExpenseId || undefined
    };

    setExpenses(prev => [e, ...prev]);
    
  }

  
function createReimbursement({ linkedExpenseId, amount, date, bank, accountType, note, person }) {
  const e = {
    id: uid(),
    kind: "reimbursement",
    linkedExpenseId,
    amount: Math.abs(amount),
    category: "Autres",
    subcategory: "",
    bank: bank ?? "Physique",
    accountType: accountType ?? "Compte courant",
    date,
    note: note ?? "",
    person: (person ?? "").trim()
  };
  setExpenses(prev => [e, ...prev]);
  setTab("list");
}

function deleteExpense(id) {
    const target = expenses.find(e => e.id === id);
    const isTransfer = target && (target.kind === "transfer_in" || target.kind === "transfer_out") && target.transferId;
    const msg = isTransfer ? "Supprimer ce virement (les 2 lignes) ?" : "Supprimer cette dépense ?";
    if (!confirm(msg)) return;

    if (isTransfer) {
      setExpenses(prev => prev.filter(e => e.transferId !== target.transferId));
    } else {
      setExpenses(prev => prev.filter(e => e.id !== id));
    }
  }

function updateExpense(id, patch) {
  setExpenses(prev =>
    prev.map(e => (e.id === id ? { ...e, ...patch, amount: Math.abs(patch.amount ?? e.amount) } : e))
  );
}

/** Construit le payload de backup avec toutes les données courantes */
  function buildAutoBackupPayload() {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        expenses,
        categories: safeCategories,
        banks,
        accountTypes,
        people,
        recurring,
        categoryColors,
        subcategories: subcategoriesMap,
        autoCatRules,
        forecastItems,
        forecastSettings,
      },
    };
  }

  /** Applique un payload Drive dans le state React */
  function applyDrivePayload(d) {
    if (Array.isArray(d.expenses))     setExpenses(d.expenses);
    if (Array.isArray(d.categories))   setCategories(d.categories);
    if (Array.isArray(d.banks))        setBanks(d.banks);
    if (Array.isArray(d.accountTypes)) setAccountTypes(d.accountTypes);
    if (Array.isArray(d.people))       setPeople(d.people);
    if (Array.isArray(d.recurring))    setRecurring(d.recurring);
    if (d.categoryColors && typeof d.categoryColors === "object") setCategoryColors(d.categoryColors);
    if (d.subcategories && typeof d.subcategories === "object")   setSubcategoriesMap(d.subcategories);
    if (d.autoCatRules && typeof d.autoCatRules === "object")     setAutoCatRules(d.autoCatRules);
    if (Array.isArray(d.forecastItems))                           setForecastItems(d.forecastItems);
    if (d.forecastSettings && typeof d.forecastSettings === "object") setForecastSettings(d.forecastSettings);
  }

  /**
   * Logique post-connexion partagée entre connectDrive() et la reconnexion silencieuse.
   * Appelée une fois le token obtenu.
   */
  async function handlePostConnect() {
    setDriveStatus("Drive : connecté ✅");
    setShowDriveModal(false);

    // 1) Chercher le fichier de backup sur Drive
    const meta = await getBackupMetadata("budget-pwa-backup.json");

    if (!meta) {
      // Aucun backup sur Drive → sauvegarder l'état local immédiatement
      setDriveStatus("Drive : connecté (aucun backup trouvé, sauvegarde en cours…)");
      const payload = buildAutoBackupPayload();
      await uploadOrUpdateFile({
        name: "budget-pwa-backup.json",
        mimeType: "application/json",
        content: JSON.stringify(payload, null, 2),
      });
      localStorage.setItem("budget_last_save", new Date().toISOString());
      setDriveStatus("Drive : connecté ✅ (backup créé)");
      return;
    }

    // 2) Comparer les dates : Drive vs local
    const driveDate = new Date(meta.modifiedTime);
    const localDate = new Date(localStorage.getItem("budget_last_save") || 0);
    const hasLocalData = expenses.length > 0 || categories.length > 0;

    if (!hasLocalData) {
      // Pas de données locales → restaurer Drive directement
      setDriveStatus("Drive : restauration en cours…");
      const json = await downloadFileByName("budget-pwa-backup.json");
      const parsed = JSON.parse(json);
      if (parsed?.data) applyDrivePayload(parsed.data);
      setDriveStatus("Drive : connecté ✅ (données restaurées)");
      return;
    }

    // 3) Données locales ET backup Drive → afficher le modal de choix
    const json = await downloadFileByName("budget-pwa-backup.json");
    const parsed = JSON.parse(json);
    if (!parsed?.data) {
      setDriveStatus("Drive : connecté ✅");
      return;
    }

    setConflictModal({
      drivePayload: parsed.data,
      driveDate,
      driveExportedAt: parsed.exportedAt,
      localDate,
    });
  }

  async function connectDrive() {
    try {
      setDriveStatus("Drive : connexion en cours…");
      setShowDriveModal(false);
      await requestDriveToken();

      // Mémoriser que l'utilisateur a activé Drive → reconnexion silencieuse au prochain démarrage
      localStorage.setItem("budget_drive_enabled", "true");

      await handlePostConnect();

    } catch (e) {
      console.error(e);
      setDriveStatus("Drive : échec de connexion ❌");
      alert("Connexion Google Drive échouée. Vérifie le Client ID OAuth et les domaines autorisés.");
    }
  }

  async function backupNow() {
    try {
      setDriveStatus("Drive : sauvegarde en cours…");
      setSyncStatus("saving");

      if (!isDriveConnected()) {
        await requestDriveToken();
      }

      const payload = buildAutoBackupPayload();
      await uploadOrUpdateFile({
        name: "budget-pwa-backup.json",
        mimeType: "application/json",
        content: JSON.stringify(payload, null, 2),
      });

      const now = new Date().toISOString();
      localStorage.setItem("budget_last_save", now);
      setDriveStatus("Drive : sauvegarde OK ✅");
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus("idle"), 3000);
      alert("Sauvegarde Google Drive OK ✅");
    } catch (e) {
      console.error(e);
      setDriveStatus("Drive : sauvegarde échouée ❌");
      setSyncStatus("error");
      alert("Sauvegarde échouée. Ouvre la console (F12) pour voir l'erreur.");
    }
  }


  async function restoreFromDrive() {
    try {
      setDriveStatus("Drive : restauration en cours…");

      if (!isDriveConnected()) {
        await requestDriveToken();
      }

      const json = await downloadFileByName("budget-pwa-backup.json");
      const parsed = JSON.parse(json);

      if (!parsed?.data) throw new Error("Format de sauvegarde invalide");

      applyDrivePayload(parsed.data);
      setDriveStatus("Drive : restauration OK ✅");
      alert("Restauration terminée !");
    } catch (e) {
      console.error(e);
      setDriveStatus("Drive : restauration échouée ❌");
      alert("Restauration échouée. Aucun backup trouvé ou format invalide.");
    }
  }











  return (
    <div style={styles.page}>
      <div style={styles.header}>
        {/* Ligne 1 : titre + statut Drive */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={styles.title}>STATERA</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {syncStatus === "saving" && <span style={{ color: "#6b7280" }}>🔄 Sync…</span>}
            {syncStatus === "saved"  && <span style={{ color: "#16a34a" }}>☁️ Sauvegardé</span>}
            {syncStatus === "error"  && <span style={{ color: "#dc2626" }}>⚠️ Erreur sync</span>}
            {syncStatus === "idle"   && isDriveConnected() && <span style={{ color: "#9ca3af" }}>☁️</span>}
          </div>
        </div>

        {/* Ligne 2 : solde ce mois + flèche colorée + % */}
        {(() => {
          const now = new Date();
          const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          let income = 0, expenseGross = 0, reimb = 0, tIn = 0, tOut = 0;
          for (const e of expenses) {
            if (!e.date?.startsWith(monthKey)) continue;
            const a = Number(e.amount || 0);
            if (e.kind === "income")         income += a;
            if (e.kind === "expense")        expenseGross += a;
            if (e.kind === "reimbursement")  reimb += a;
            if (e.kind === "transfer_in")    tIn += a;
            if (e.kind === "transfer_out")   tOut += a;
          }
          const solde = income + reimb + tIn - expenseGross - tOut;
          const isPositive = solde >= 0;
          const arrow = isPositive ? "↑" : "↓";
          const color = isPositive ? "#16a34a" : "#dc2626";
          const mois = now.toLocaleDateString("fr-FR", { month: "long" });

          return (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: "#9ca3af", textTransform: "capitalize" }}>{mois}</span>
              <span style={{ fontSize: 20, fontWeight: 900, color }}>
                {arrow} {Math.abs(solde).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
              {expenseGross > 0 && (
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  {expenseGross.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € dépensés
                </span>
              )}
            </div>
          );
        })()}
      </div>

      <TopBar tab={tab} setTab={setTab} />

      {/* ── Modal connexion Google Drive ── */}
      {showDriveModal && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16, zIndex: 9999
        }}>
          <div style={{
            width: "100%", maxWidth: 400,
            background: "white", borderRadius: 20,
            border: "1px solid #e5e7eb", padding: 24,
            display: "grid", gap: 16, textAlign: "center"
          }}>
            <div style={{ fontSize: 40 }}>☁️</div>

            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: 20 }}>
                {localStorage.getItem("budget_drive_enabled") === "true"
                  ? "Reconnecte-toi à Google"
                  : "Sauvegarde automatique"}
              </h3>
              <p style={{ margin: 0, color: "#6b7280", fontSize: 14, lineHeight: 1.5 }}>
                {localStorage.getItem("budget_drive_enabled") === "true"
                  ? "Ta session Google a expiré. Reconnecte-toi pour retrouver et synchroniser tes données."
                  : "Connecte ton compte Google pour sauvegarder tes données automatiquement et les retrouver sur tous tes appareils."}
              </p>
            </div>

            <button
              onClick={connectDrive}
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                border: "none",
                background: "#2563eb",
                color: "white",
                fontWeight: 800,
                fontSize: 16,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Se connecter avec Google
            </button>

            <button
              onClick={() => setShowDriveModal(false)}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "transparent",
                color: "#6b7280",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Plus tard
            </button>

            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              Sans connexion, tes données sont sauvegardées uniquement sur cet appareil.
            </div>
          </div>
        </div>
      )}


      {tab === "settings" && (
        <>
        <ManageLists
          banks={banks}
          setBanks={setBanks}
          accountTypes={accountTypes}
          setAccountTypes={setAccountTypes}
          expenses={expenses}
          onConnectDrive={connectDrive}
          onBackupNow={backupNow}
          onRestoreNow={restoreFromDrive}
          driveStatus={driveStatus}
          syncStatus={syncStatus}
          />

        <div style={{ height: 12 }} />

        <SubCategories
          categories={safeCategories}
          subcategoriesMap={subcategoriesMap}
          setSubcategoriesMap={setSubcategoriesMap}
        />

        <div style={{ height: 12 }} />

        <AutoCategorize
          expenses={expenses}
          setExpenses={setExpenses}
          categories={safeCategories}
          rules={autoCatRules}
          setRules={setAutoCatRules}
        />

        <div style={{ height: 12 }} />

        <ImportExport
          expenses={expenses}
          categories={safeCategories}
          banks={banks}
          accountTypes={accountTypes}
          onImport={(rows) => setExpenses(prev => [...rows, ...prev])}
        />
        </>
      )}
    




      {tab === "add" && (
        <AddExpense
          categories={safeCategories}
          subcategoriesMap={subcategoriesMap}
          people={people}
          expenses={expenses}
          onAdd={addExpense}
          banks={banks}
          accountTypes={accountTypes}
          onAddCategory={(name) => setCategories(prev => [...prev, name])}
          onAddBank={(name) => setBanks(prev => [...prev, name])}
          onAddAccountType={(name) => setAccountTypes(prev => [...prev, name])}
          onAddSubcategory={(cat, name) => setSubcategoriesMap(prev => ({
            ...prev,
            [cat]: [...(prev[cat] || []), name]
          }))}
        />
      )}



      {tab === "list" && (
        <ExpenseList
          expenses={expenses}
          categories={safeCategories}
          subcategoriesMap={subcategoriesMap}
          categoryColors={categoryColors}
          people={people}
          onDelete={deleteExpense}
          onUpdate={updateExpense}
          onImport={(rows) => setExpenses(prev => [...rows, ...prev])}
          onCreateReimbursement={createReimbursement}
          onOpenWipeModal={() => setShowWipeModal(true)}
          banks={banks}
          accountTypes={accountTypes}
        />
      )}

      {tab === "stats" && (
        <Stats
          expenses={expenses}
          categories={safeCategories}
          subcategoriesMap={subcategoriesMap}
          categoryColors={categoryColors}
          filters={{ bank: "ALL", accountType: "ALL", category: "ALL" }}
          banks={banks}
          accountTypes={accountTypes}
          performance={performance}
          perfScope={perfScope}
          setPerfScope={setPerfScope}
        />
      )}

      {tab === "forecast" && (
        <Forecast
          expenses={expenses}
          setExpenses={setExpenses}
          recurring={recurring}
          categories={safeCategories}
          banks={banks}
          accountTypes={accountTypes}
          forecastItems={forecastItems}
          setForecastItems={setForecastItems}
          forecastSettings={forecastSettings}
          setForecastSettings={setForecastSettings}
        />
      )}

      {tab === "debts" && (
        <Debts
          expenses={expenses}
          people={people}
          setPeople={setPeople}
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
          banks={banks}
          accountTypes={accountTypes}
        />
      )}






        {/* ── Modal conflit Drive vs Local ── */}
        {conflictModal && (
          <div style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, zIndex: 9999
          }}>
            <div style={{
              width: "100%", maxWidth: 480,
              background: "white", borderRadius: 18,
              border: "1px solid #e5e7eb", padding: 20,
              display: "grid", gap: 14
            }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>☁️ Données trouvées sur Drive</h3>

              <p style={{ margin: 0, color: "#374151", fontSize: 14 }}>
                Il y a des données à la fois <b>sur cet appareil</b> et <b>sur Google Drive</b>.
                Lesquelles veux-tu conserver ?
              </p>

              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                background: "#f9fafb", borderRadius: 12, padding: 12,
                fontSize: 13, color: "#6b7280"
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>📱 Cet appareil</div>
                  <div>{expenses.length} opération(s)</div>
                  <div style={{ marginTop: 4 }}>
                    {localStorage.getItem("budget_last_save")
                      ? `Dernière sauvegarde : ${new Date(localStorage.getItem("budget_last_save")).toLocaleString()}`
                      : "Date inconnue"}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>☁️ Google Drive</div>
                  <div>{conflictModal.drivePayload?.expenses?.length ?? "?"} opération(s)</div>
                  <div style={{ marginTop: 4 }}>
                    {conflictModal.driveExportedAt
                      ? `Sauvegardé le : ${new Date(conflictModal.driveExportedAt).toLocaleString()}`
                      : `Modifié le : ${conflictModal.driveDate.toLocaleString()}`}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <button
                  onClick={() => {
                    applyDrivePayload(conflictModal.drivePayload);
                    setDriveStatus("Drive : connecté ✅ (données Drive chargées)");
                    setConflictModal(null);
                  }}
                  style={{
                    padding: "12px 16px", borderRadius: 12,
                    border: "none", background: "#2563eb",
                    color: "white", fontWeight: 800, cursor: "pointer", fontSize: 15
                  }}
                >
                  ☁️ Utiliser les données Drive
                </button>

                <button
                  onClick={async () => {
                    setConflictModal(null);
                    setDriveStatus("Drive : sauvegarde locale en cours…");
                    try {
                      const payload = buildAutoBackupPayload();
                      await uploadOrUpdateFile({
                        name: "budget-pwa-backup.json",
                        mimeType: "application/json",
                        content: JSON.stringify(payload, null, 2),
                      });
                      localStorage.setItem("budget_last_save", new Date().toISOString());
                      setDriveStatus("Drive : connecté ✅ (données locales sauvegardées)");
                    } catch (err) {
                      console.error(err);
                      setDriveStatus("Drive : sauvegarde échouée ❌");
                    }
                  }}
                  style={{
                    padding: "12px 16px", borderRadius: 12,
                    border: "1px solid #111827", background: "white",
                    fontWeight: 800, cursor: "pointer", fontSize: 15
                  }}
                >
                  📱 Garder les données de cet appareil
                </button>
              </div>

              <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
                L'autre version sera écrasée et ne pourra pas être récupérée.
              </div>
            </div>
          </div>
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
    background: "#f5f0e8",
    fontFamily:
      'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"'
  },
  header: { padding: "14px 14px 6px 14px" },
  title: { fontSize: 22, fontWeight: 950, color: "#111827" },
};

import React, { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Cell, BarChart, Bar, Legend } from "recharts";
import { currentMonthKey, formatEUR, monthLabelFR } from "../utils";
import { saveFilters, loadFilters } from "../filterStorage";


export default function Stats({
  expenses = [],
  categories = [],
  subcategoriesMap = {},
  banks = [],
  accountTypes = [],
  categoryColors = {},
  filters = {},
  performance = null,
  perfScope = "7d",
  setPerfScope = () => {},
}) {
  // Filtres par défaut
  const defaultFilters = {
    mode: "month",
    month: "ALL",
    from: "",
    to: "",
    scope: "total",
    selectedBank: "ALL",
    selectedAccountType: "ALL",
    subcatCategory: (Array.isArray(categories) && categories[0]) ? categories[0] : "Autres"
  };

  // Charger les filtres sauvegardés
  const savedFilters = loadFilters("stats", defaultFilters);

  // UI filter
  const [mode, setMode] = useState(savedFilters.mode); // "month" | "range"
  const [month, setMonth] = useState(savedFilters.month); // "ALL" or "YYYY-MM"
  const [from, setFrom] = useState(savedFilters.from);
  const [to, setTo] = useState(savedFilters.to);
  const [scope, setScope] = useState(savedFilters.scope); // "total" | "bank" | "type"
  const [selectedBank, setSelectedBank] = useState(savedFilters.selectedBank ?? "ALL");
  const [selectedAccountType, setSelectedAccountType] = useState(savedFilters.selectedAccountType ?? "ALL");

  // Sous-categories : camembert par sous-categorie pour une categorie parente
  const [subcatCategory, setSubcatCategory] = useState(savedFilters.subcatCategory);

  // Sauvegarder les filtres à chaque changement
  useEffect(() => {
    const currentFilters = {
      mode,
      month,
      from,
      to,
      scope,
      selectedBank,
      selectedAccountType,
      subcatCategory
    };
    saveFilters("stats", currentFilters);
  }, [mode, month, from, to, scope, selectedBank, selectedAccountType, subcatCategory]);

  // Fonction pour réinitialiser tous les filtres
  const resetAllFilters = () => {
    setMode("month");
    setMonth("ALL");
    setFrom("");
    setTo("");
    setScope("total");
    setSelectedBank("ALL");
    setSelectedAccountType("ALL");
    setSubcatCategory((Array.isArray(categories) && categories[0]) ? categories[0] : "Autres");
  };




  const isMobile = typeof window !== "undefined" && window.innerWidth < 700;
  const MAX_ROWS = isMobile ? 8 : 12;

  // Couleurs fallback (si une catégorie n'a pas encore de couleur enregistrée)
  // Objectif: garder des couleurs lisibles au lieu de tout griser.
  const fallbackPalette = [
    "#2563eb", // bleu
    "#16a34a", // vert
    "#f97316", // orange
    "#a855f7", // violet
    "#06b6d4", // cyan
    "#e11d48", // rose/rouge
    "#84cc16", // lime
    "#f59e0b", // ambre
    "#0ea5e9", // bleu clair
    "#14b8a6"  // teal
  ];

  const stableColorFor = (name, index = 0) => {
    const n = String(name || "");
    // petit hash stable
    let h = 0;
    for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
    const idx = (h + index) % fallbackPalette.length;
    return fallbackPalette[idx];
  };

  const colorForCategory = (name, index = 0) => {
    const c = categoryColors?.[name];
    return c || stableColorFor(name, index);
  };

  // Légende détaillée sous le camembert
  function LegendList({ items }) {
    if (!items?.length) return null;

    return (
      <div
        style={{
          marginTop: 10,
          borderTop: "1px solid #e5e7eb",
          paddingTop: 10,
          maxHeight: isMobile ? 220 : 260,
          overflow: "auto"
        }}
      >
        {items.slice(0, MAX_ROWS).map((d, idx) => (
          <div key={d.name} style={styles.legendRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: colorForCategory(d.name, idx),
                  flex: "0 0 auto"
                }}
              />
              <div style={styles.legendName} title={d.name}>
                {d.name}
              </div>
            </div>

            <div style={styles.legendValue}>{formatEUR(d.value)}</div>
          </div>
        ))}


        {items.length > MAX_ROWS && (
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 12 }}>
            + {items.length - MAX_ROWS} autres catégories…
          </div>
        )}
      </div>
    );
  }




  const months = useMemo(() => {
    const set = new Set(expenses.map(e => currentMonthKey(String(e.date || "").trim())));
    const arr = Array.from(set);
    arr.sort((a, b) => b.localeCompare(a));
    if (arr.length === 0) return ["ALL"];
    return ["ALL", ...arr];
  }, [expenses]);


const safeBanks = Array.isArray(banks) ? banks : [];
const safeAccountTypes = Array.isArray(accountTypes) ? accountTypes : [];
const safeCategories = Array.isArray(categories) ? categories : [];
const safeExpenses = Array.isArray(expenses) ? expenses : [];

// Garde la categorie selectionnee pour les sous-categories valide
useEffect(() => {
  if (!safeCategories.length) return;
  if (!safeCategories.includes(subcatCategory)) setSubcatCategory(safeCategories[0]);
}, [safeCategories.join("|"), subcatCategory]);

  // ✅ Mode "comptable" : un remboursement est rattaché à la dépense d'origine
  // et doit neutraliser la dépense même si le remboursement est hors période.
  const reimburseByExpenseId = useMemo(() => {
    const map = new Map(); // expenseId -> sum(reimbursements)
    for (const e of safeExpenses) {
      if (e?.kind !== "reimbursement") continue;
      const id = e.linkedExpenseId;
      if (!id) continue;
      map.set(id, (map.get(id) || 0) + Number(e.amount || 0));
    }
    return map;
  }, [safeExpenses]);




  // Filtre date uniquement — pour les camemberts par banque/type (pas affecté par les filtres banque/type)
  const statsFilteredDateOnly = useMemo(() => {
    return safeExpenses.filter(e => {
      const d = String(e.date || "").trim();
      if (mode === "range") {
        if (from && d < from) return false;
        if (to && d > to) return false;
      } else {
        if (month !== "ALL" && currentMonthKey(d) !== month) return false;
      }
      return true;
    });
  }, [safeExpenses, mode, from, to, month]);

  // Filtre date + banque + type de compte — pour tous les autres graphiques
  const statsFiltered = useMemo(() => {
    return statsFilteredDateOnly.filter(e => {
      if (selectedBank !== "ALL" && String(e.bank || "") !== selectedBank) return false;
      if (selectedAccountType !== "ALL" && String(e.accountType || "") !== selectedAccountType) return false;
      return true;
    });
  }, [statsFilteredDateOnly, selectedBank, selectedAccountType]);








  // Balance timeline par groupe (bank / type) pour le graphique
  const balanceTimeline = useMemo(() => {
    const getGroupKey = (e) => {
      if (scope === "total") return "Total";
      if (scope === "bank") return String(e.bank || "Physique").trim() || "Physique";
      return String(e.accountType || "Compte courant").trim() || "Compte courant";
    };

    // delta par jour et par groupe
    const byDay = new Map(); // date -> Map(group -> delta)
    const groups = new Set();

    for (const e of statsFiltered) {
      const d = String(e.date || "").trim();
      if (!d) continue;

      const g = getGroupKey(e);

      const signed = (e.kind === "income" || e.kind === "reimbursement" || e.kind === "transfer_in")
        ? Number(e.amount || 0)
        : -Number(e.amount || 0);

      if (!byDay.has(d)) byDay.set(d, new Map());
      const m = byDay.get(d);

      m.set(g, (m.get(g) || 0) + signed);
      groups.add(g);
    }

    const days = Array.from(byDay.keys()).sort((a, b) => a.localeCompare(b));
    const groupList = Array.from(groups).sort((a, b) => a.localeCompare(b));

    // cumul
    const running = {};
    for (const g of groupList) running[g] = 0;

    const out = [];
    for (const day of days) {
      const m = byDay.get(day) || new Map();
      for (const g of groupList) {
        running[g] += m.get(g) || 0;
      }
      const row = { date: day };
      for (const g of groupList) row[g] = Math.round(running[g] * 100) / 100;
      out.push(row);
    }

    return { rows: out, keys: groupList };
  }, [statsFiltered, scope]);
  // fin balance timeline par groupe

  // ── Histogramme 12 mois par catégorie ──────────────────────────────────────
  const monthlyByCat = useMemo(() => {
    const now = new Date();
    // Générer les 12 derniers mois (YYYY-MM) du plus ancien au plus récent
    const monthKeys = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    // Catégories présentes dans les dépenses filtrées
    const catSet = new Set();
    for (const e of statsFiltered) {
      if (e.kind === "expense") catSet.add(e.category || "Autres");
    }
    const cats = Array.from(catSet).sort((a, b) => a.localeCompare(b));

    // Construire les rows
    const rows = monthKeys.map(mk => {
      const row = { month: mk, label: monthLabelFR(mk).slice(0, 3) };
      for (const c of cats) row[c] = 0;
      return row;
    });
    const rowByMonth = new Map(rows.map(r => [r.month, r]));

    for (const e of statsFiltered) {
      if (e.kind !== "expense") continue;
      const mk = String(e.date || "").slice(0, 7);
      const row = rowByMonth.get(mk);
      if (!row) continue;
      const cat = e.category || "Autres";
      row[cat] = Math.round(((row[cat] || 0) + Number(e.amount || 0)) * 100) / 100;
    }

    return { rows, cats };
  }, [statsFiltered]);














    // eslint-disable-next-line react-hooks/exhaustive-deps
  // fin options filtre











  /*// Solde dans le temps pour calcul du graphique
  const balanceTimeline = useMemo(() => {
    // regrouper par date (YYYY-MM-DD)
    const byDay = new Map();

    for (const e of statsFiltered) {
      const d = String(e.date || "").trim();
      if (!d) continue;

      const signed = (e.kind === "income" || e.kind === "reimbursement" || e.kind === "transfer_in")
        ? Number(e.amount || 0)
        : -Number(e.amount || 0);
      byDay.set(d, (byDay.get(d) || 0) + signed);
    }

    const days = Array.from(byDay.keys()).sort((a, b) => a.localeCompare(b));

    let running = 0;
    const out = [];
    for (const day of days) {
      running += byDay.get(day) || 0;
      out.push({
        date: day,
        solde: Math.round(running * 100) / 100
      });
    }
    return out;
  }, [statsFiltered]);
  // fin solde dans le temps*/





  
  // calcul des deux dataset
const expenseData = useMemo(() => {
  const map = new Map(safeCategories.map(c => [c, 0]));

  for (const e of statsFiltered) {
    if (e.kind !== "expense") continue;
    const cat = String(e.category || "Autres").trim() || "Autres";
    const gross = Number(e.amount || 0);
    // ✅ comptable : on neutralise avec tous les remboursements liés (même hors période)
    const reimb = reimburseByExpenseId.get(e.id) || 0;
    const net = Math.max(0, gross - reimb);
    map.set(cat, (map.get(cat) || 0) + net);
  }

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
}, [statsFiltered, safeCategories, reimburseByExpenseId]);

const incomeData = useMemo(() => {
  const map = new Map(safeCategories.map(c => [c, 0]));

  for (const e of statsFiltered) {
    if (e.kind !== "income") continue;
    const cat = String(e.category || "Autres").trim() || "Autres";
    map.set(cat, (map.get(cat) || 0) + Number(e.amount || 0));
  }

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
}, [statsFiltered, safeCategories]);

// Camembert des sous-categories pour la categorie selectionnee
const subcatData = useMemo(() => {
  const labelEmpty = "(Sans sous-categorie)";
  const map = new Map();

  for (const e of statsFiltered) {
    if (e.kind !== "expense") continue;
    const cat = String(e.category || "Autres").trim() || "Autres";
    if (cat !== subcatCategory) continue;
    const sub = String(e.subcategory || "").trim() || labelEmpty;

    const gross = Number(e.amount || 0);
    const reimb = reimburseByExpenseId.get(e.id) || 0;
    const net = Math.max(0, gross - reimb);
    if (net <= 0) continue;

    map.set(sub, (map.get(sub) || 0) + net);
  }

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}, [statsFiltered, subcatCategory, reimburseByExpenseId]);
  // fin des blocs de calcul  









  const expenseTotal = useMemo(() => expenseData.reduce((s, d) => s + d.value, 0), [expenseData]);
  const incomeTotal = useMemo(() => incomeData.reduce((s, d) => s + d.value, 0), [incomeData]);
  const reimbursementTotal = useMemo(() => {
    return statsFiltered
      .filter(e => e.kind === "reimbursement")
      .reduce((s, e) => s + Number(e.amount || 0), 0);
  }, [statsFiltered]);

  // ── Solde par banque et par type de compte ──────────────────────────────────
  // Utilise statsFilteredDateOnly (pas affecté par les filtres banque/type)
  const { soldeByBank, soldeByType } = useMemo(() => {
    const byBank = new Map();
    const byType = new Map();

    for (const e of statsFilteredDateOnly) {
      const amount = Number(e.amount || 0);
      const signed = (e.kind === "income" || e.kind === "reimbursement" || e.kind === "transfer_in")
        ? amount : -amount;

      const bankKey = String(e.bank || "Physique").trim() || "Physique";
      const typeKey = String(e.accountType || "Compte courant").trim() || "Compte courant";

      byBank.set(bankKey, (byBank.get(bankKey) || 0) + signed);
      byType.set(typeKey, (byType.get(typeKey) || 0) + signed);
    }

    // Palette fixe pour banques / types (indépendante de categoryColors)
    const palette = [
      "#2563eb", "#16a34a", "#f97316", "#a855f7",
      "#06b6d4", "#e11d48", "#84cc16", "#f59e0b",
      "#0ea5e9", "#14b8a6", "#ec4899", "#6366f1"
    ];

    // On garde tous les groupes (positifs et négatifs), valeur absolue pour le camembert
    const toSlices = (map) =>
      Array.from(map.entries())
        .map(([name, value], i) => ({
          name,
          value: Math.round(value * 100) / 100,
          absValue: Math.round(Math.abs(value) * 100) / 100,
          negative: value < 0,
          fill: palette[i % palette.length]
        }))
        .filter(d => d.absValue > 0)
        .sort((a, b) => b.absValue - a.absValue);

    return { soldeByBank: toSlices(byBank), soldeByType: toSlices(byType) };
  }, [statsFilteredDateOnly]);


  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>

      {/* ── Bloc performance ── */}
      {performance && (
        <div style={styles.card}>
          {/* Chips de période */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[
              { key: "7d",  label: "7 jours" },
              { key: "1m",  label: "1 mois" },
              { key: "1y",  label: "1 an" },
              { key: "all", label: "Tout" },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setPerfScope(s.key)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: perfScope === s.key ? "#111827" : "#f9fafb",
                  color: perfScope === s.key ? "white" : "#374151",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Delta et pourcentage */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{
              fontSize: 28,
              fontWeight: 900,
              color: performance.delta >= 0 ? "#16a34a" : "#dc2626",
            }}>
              {performance.delta >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(performance.delta).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
            {performance.pct !== null && (
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                color: performance.pct >= 0 ? "#16a34a" : "#dc2626",
              }}>
                ({performance.pct >= 0 ? "+" : ""}{performance.pct.toFixed(2)} %)
              </span>
            )}
          </div>

          {/* Solde de début et de fin */}
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              <span style={{ fontWeight: 600 }}>Début :</span>{" "}
              {performance.startBal.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              <span style={{ fontWeight: 600 }}>Fin :</span>{" "}
              {performance.endBal.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
          </div>
        </div>
      )}

      <div style={styles.card}>
        <div style={{ display: "grid", gap: 10 }}>
          {/* Filters - responsive */}
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr 1fr"
            }}
          >
            <label style={styles.label}>
              Filtre
              <select value={mode} onChange={(e) => setMode(e.target.value)} style={styles.input}>
                <option value="month">Par mois</option>
                <option value="range">Par période</option>
              </select>
            </label>

            <label style={styles.label}>
              Courbe
              <select value={scope} onChange={(e) => setScope(e.target.value)} style={styles.input}>
                <option value="total">Solde total</option>
                <option value="bank">Par banque</option>
                <option value="type">Par type de compte</option>
              </select>
            </label>

            <label style={styles.label}>
              Banque
              <select value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)} style={styles.input}>
                <option value="ALL">Toutes</option>
                {safeBanks.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Type de compte
              <select value={selectedAccountType} onChange={(e) => setSelectedAccountType(e.target.value)} style={styles.input}>
                <option value="ALL">Tous</option>
                {safeAccountTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
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
              <label style={styles.label}>
                Du
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={styles.input} />
              </label>
            )}

            {mode === "range" ? (
              <label style={styles.label}>
                Au
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={styles.input} />
              </label>
            ) : (
              <div />
            )}
          </div>

          {/* Bouton de réinitialisation des filtres */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4 }}>
            <button
              onClick={resetAllFilters}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                background: "#f3f4f6",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600
              }}
              title="Réinitialiser tous les filtres aux valeurs par défaut"
            >
              🔄 Réinitialiser les filtres
            </button>
          </div>



          <div style={styles.big}>
            Dépenses net (filtre): <span style={{ fontWeight: 900 }}>{formatEUR(expenseTotal)}</span>
          </div>
          <div style={styles.big}>
            Revenus (filtre): <span style={{ fontWeight: 900 }}>{formatEUR(incomeTotal)}</span>
          </div>
          <div style={styles.big}>
            Remboursements (filtre): <span style={{ fontWeight: 900 }}>{formatEUR(reimbursementTotal)}</span>
          </div>



        </div>
      </div>

      

      {/* ── Camemberts solde par banque + par type de compte ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>

        {/* Solde par banque */}
        <div style={styles.card}>
          <h3 style={{ margin: 0, marginBottom: 14, fontSize: 15 }}>Solde par banque</h3>
          {soldeByBank.length === 0 ? (
            <div style={{ color: "#6b7280", textAlign: "center", padding: 20, fontSize: 13 }}>Pas de données.</div>
          ) : (
            <>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie dataKey="absValue" data={soldeByBank} cx="50%" cy="50%" outerRadius={80} isAnimationActive={false}>
                      {soldeByBank.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v, name, props) => {
                        const item = props.payload;
                        const sign = item?.negative ? "−" : "+";
                        return [`${sign}${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, item?.name];
                      }}
                      contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 10px", marginTop: 8 }}>
                {soldeByBank.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: d.fill, flexShrink: 0 }} />
                    <span style={{ color: "#374151" }}>{d.name}</span>
                    <span style={{ color: d.negative ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                      {d.negative ? "−" : "+"}{Number(d.absValue).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Solde par type de compte */}
        <div style={styles.card}>
          <h3 style={{ margin: 0, marginBottom: 14, fontSize: 15 }}>Solde par type de compte</h3>
          {soldeByType.length === 0 ? (
            <div style={{ color: "#6b7280", textAlign: "center", padding: 20, fontSize: 13 }}>Pas de données.</div>
          ) : (
            <>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie dataKey="absValue" data={soldeByType} cx="50%" cy="50%" outerRadius={80} isAnimationActive={false}>
                      {soldeByType.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v, name, props) => {
                        const item = props.payload;
                        const sign = item?.negative ? "−" : "+";
                        return [`${sign}${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, item?.name];
                      }}
                      contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 10px", marginTop: 8 }}>
                {soldeByType.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: d.fill, flexShrink: 0 }} />
                    <span style={{ color: "#374151" }}>{d.name}</span>
                    <span style={{ color: d.negative ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                      {d.negative ? "−" : "+"}{Number(d.absValue).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Histogramme 12 mois par catégorie ── */}
      <div style={styles.card}>
        <h3 style={{ margin: 0, marginBottom: 14 }}>Dépenses par catégorie — 12 mois</h3>

        {monthlyByCat.rows.every(r => monthlyByCat.cats.every(c => !r[c])) ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: 24 }}>
            Pas de dépenses pour ce filtre.
          </div>
        ) : (
          <>
            <div style={{ width: "100%", height: isMobile ? 260 : 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyByCat.rows}
                  margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}€`}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value, name) => [`${Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, name]}
                    labelFormatter={(label) => {
                      const row = monthlyByCat.rows.find(r => r.label === label);
                      return row ? monthLabelFR(row.month) : label;
                    }}
                    contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  {monthlyByCat.cats.map((cat) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="a"
                      fill={categoryColors?.[cat] || "#9ca3af"}
                      radius={monthlyByCat.cats.indexOf(cat) === monthlyByCat.cats.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Légende catégories */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: "6px 12px",
              marginTop: 12, paddingTop: 10,
              borderTop: "1px solid #f3f4f6"
            }}>
              {monthlyByCat.cats.map(cat => (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: 3,
                    background: categoryColors?.[cat] || "#9ca3af",
                    flexShrink: 0
                  }} />
                  <span style={{ color: "#374151" }}>{cat}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={styles.card}>
        <h3 style={{ margin: 0, marginBottom: 10 }}>Répartition des dépenses</h3>


        {expenseData.length === 0 ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: 24 }}>
            Pas de dépenses pour ce filtre.
          </div>
        ) : (
          <div style={{ width: "100%" }}>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    dataKey="value"
                    data={expenseData}
                    label={!isMobile}
                    labelLine={!isMobile}
                    isAnimationActive={!isMobile}
                  >
                    {expenseData.map((entry, idx) => (
                      <Cell key={entry.name} fill={colorForCategory(entry.name, idx)} />
                    ))}
                  </Pie>

                  <Tooltip formatter={(v) => formatEUR(v)} />
                  {/* Légende Recharts masquée : liste détaillée ci-dessous */}
                </PieChart>
              </ResponsiveContainer>
            </div>

            <LegendList items={expenseData} />
          </div>
        )}
      </div>

      <div style={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Dépenses par sous-catégorie</h3>
          <label style={{ ...styles.label, minWidth: 220 }}>
            Catégorie
            <select value={subcatCategory} onChange={(e) => setSubcatCategory(e.target.value)} style={styles.input}>
              {safeCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        {subcatData.length === 0 ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 24 }}>
            Pas de dépenses (ou pas de sous-catégorie renseignée) pour ce filtre.
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie
                    dataKey='value'
                    data={subcatData}
                    label={!isMobile}
                    labelLine={!isMobile}
                    isAnimationActive={!isMobile}
                  >
                    {subcatData.map((entry, idx) => (
                      <Cell key={entry.name} fill={stableColorFor(entry.name, idx)} />
                    ))}
                  </Pie>

                  <Tooltip formatter={(v) => formatEUR(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <LegendList items={subcatData} />
          </div>
        )}
      </div>



      <div style={styles.card}>
        <h3 style={{ margin: 0, marginBottom: 10 }}>Répartition des revenus</h3>

        {incomeData.length === 0 ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: 24 }}>
            Pas de revenus pour ce filtre.
          </div>
        ) : (
          <div style={{ width: "100%" }}>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    dataKey="value"
                    data={incomeData}
                    label={!isMobile}
                    labelLine={!isMobile}
                    isAnimationActive={!isMobile}
                  >
                    {incomeData.map((entry, idx) => (
                      <Cell key={entry.name} fill={colorForCategory(entry.name, idx)} />
                    ))}
                  </Pie>

                  <Tooltip formatter={(v) => formatEUR(v)} />
                  {/* Légende Recharts masquée : liste détaillée ci-dessous */}
                </PieChart>
              </ResponsiveContainer>
            </div>

            <LegendList items={incomeData} />
          </div>
        )}
      </div>



      <div style={styles.card}>
        <h3 style={{ margin: 0, marginBottom: 10 }}>Évolution du solde</h3>

        {balanceTimeline.rows.length < 2 ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: 24 }}>
            Pas assez de données pour tracer une courbe.
          </div>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceTimeline.rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" hide={isMobile} />
                <YAxis tickFormatter={(v) => `${Math.round(v)}€`} />
                <Tooltip formatter={(v) => formatEUR(v)} labelFormatter={(l) => `Date: ${l}`} />

                {balanceTimeline.keys.map((k) => (
                  <Line key={k} type="monotone" dataKey={k} dot={false} isAnimationActive={!isMobile} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>



















      {expenseData.length > 0 && (
        <div style={styles.card}>
          <h3 style={{ margin: 0, marginBottom: 10 }}>Top catégories</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {expenseData.slice(0, 6).map(d => (
              <div key={d.name} style={styles.line}>
                <div style={{ fontWeight: 800 }}>{d.name}</div>
                <div style={{ fontWeight: 900 }}>{formatEUR(d.value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



const styles = {
  card: {
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e8dfc8",
    background: "#fdfaf5"
  },
  label: { display: "grid", gap: 6, fontWeight: 800, fontSize: 12, color: "#111827" },
  input: { padding: "12px 12px", borderRadius: 12, border: "1px solid #d4c9ae", background: "#fdfaf5", fontSize: 15 },
  big: { fontSize: 16 },
  line: { display: "flex", alignItems: "center", justifyContent: "space-between" },

  legendRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    padding: "8px 2px"
  },
  legendName: {
    fontWeight: 800,
    fontSize: 13,
    color: "#111827",
    // ⬇️ rend le nom lisible (surtout sur mobile) : 2 lignes max
    flex: "1 1 auto",
    minWidth: 0,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical"
  },
  legendValue: {
    fontWeight: 900,
    fontSize: 13,
    color: "#111827",
    whiteSpace: "nowrap",
    flex: "0 0 auto"
  },

};



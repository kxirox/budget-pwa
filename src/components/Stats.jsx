import React, { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { currentMonthKey, formatEUR, monthLabelFR } from "../utils";


export default function Stats({ 
  expenses = [],
  categories = [],
  banks = [],
  accountTypes = [],
  categoryColors = {},
  filters = {}
}) {
  // UI filter
  const [mode, setMode] = useState("month"); // "month" | "range"
  const [month, setMonth] = useState("ALL"); // "ALL" or "YYYY-MM"
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState("total"); // "total" | "bank" | "type"
  const [selectedKey, setSelectedKey] = useState("ALL"); // ALL ou une banque/un type




  const isMobile = typeof window !== "undefined" && window.innerWidth < 700;
  const MAX_ROWS = isMobile ? 8 : 12;

  // Legend component for PieChart
  function LegendList({ items, categoryColors }) {
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
        {items.slice(0, MAX_ROWS).map((d) => (
          <div key={d.name} style={styles.legendRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: categoryColors?.[d.name] || "#6b7280",
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




  // Filtered expenses for stats
 const statsFiltered = useMemo(() => {
  return safeExpenses.filter(e => {
    const d = String(e.date || "").trim();

    // Date
    if (mode === "range") {
      if (from && d < from) return false;
      if (to && d > to) return false;
    } else {
      if (month !== "ALL" && currentMonthKey(d) !== month) return false;
    }


          // Filtre "scope" (banque ou type de compte) via selectedKey
      if (scope === "bank" && selectedKey !== "ALL" && String(e.bank || "") !== selectedKey) return false;
      if (scope === "type" && selectedKey !== "ALL" && String(e.accountType || "") !== selectedKey) return false;

    return true;
  });
// mis en commentaire par lou en attendat resolution du pb de non filtrage par banque ou type de categorie  
//}, [safeExpenses, mode, from, to, month, selectedBank, selectedAccountType, selectedCategory]);
  }, [safeExpenses, mode, from, to, month, scope, selectedKey]);








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
      if (scope !== "total" && selectedKey !== "ALL" && g !== selectedKey) continue;

      const signed = e.kind === "income" ? Number(e.amount || 0) : -Number(e.amount || 0);

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
  }, [statsFiltered, scope, selectedKey]);
  // fin balance timeline par groupe














  // Options pour les filtres bank / type
  const bankOptions = useMemo(() => {
    const set = new Set(statsFiltered.map(e => String(e.bank || "Physique").trim() || "Physique"));
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [statsFiltered]);

  const typeOptions = useMemo(() => {
    const set = new Set(statsFiltered.map(e => String(e.accountType || "Compte courant").trim() || "Compte courant"));
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [statsFiltered]);

  // Quand tu changes de scope, on reset la sélection
  useEffect(() => setSelectedKey("ALL"), [scope]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  // fin options filtre











  /*// Solde dans le temps pour calcul du graphique
  const balanceTimeline = useMemo(() => {
    // regrouper par date (YYYY-MM-DD)
    const byDay = new Map();

    for (const e of statsFiltered) {
      const d = String(e.date || "").trim();
      if (!d) continue;

      const signed = e.kind === "income" ? Number(e.amount || 0) : -Number(e.amount || 0);
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
      map.set(cat, (map.get(cat) || 0) + Number(e.amount || 0));
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [statsFiltered, safeCategories]);

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
  // fin des blocs de calcul  








  const expenseTotal = useMemo(() => expenseData.reduce((s, d) => s + d.value, 0), [expenseData]);
  const incomeTotal = useMemo(() => incomeData.reduce((s, d) => s + d.value, 0), [incomeData]);




  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>
      <div style={styles.card}>
        <div style={{ display: "grid", gap: 10 }}>
          {/* Filters - responsive */}
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr 1fr"
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
                <option value="bank">Solde par banque</option>
                <option value="type">Solde par type de compte</option>
              </select>
            </label>


            {scope === "bank" && (
              <label style={styles.label}>
                Banque
                <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} style={styles.input}>
                  {bankOptions.map(b => (
                    <option key={b} value={b}>{b === "ALL" ? "Toutes" : b}</option>
                  ))}
                </select>
              </label>
            )}

            {scope === "type" && (
              <label style={styles.label}>
                Type de compte
                <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} style={styles.input}>
                  {typeOptions.map(t => (
                    <option key={t} value={t}>{t === "ALL" ? "Tous" : t}</option>
                  ))}
                </select>
              </label>
            )}




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



          <div style={styles.big}>
            Dépenses (filtre): <span style={{ fontWeight: 900 }}>{formatEUR(expenseTotal)}</span>
          </div>
          <div style={styles.big}>
            Revenus (filtre): <span style={{ fontWeight: 900 }}>{formatEUR(incomeTotal)}</span>
          </div>



        </div>
      </div>

      

      <div style={styles.card}>
        <h3 style={{ margin: 0, marginBottom: 10 }}>Répartition des dépenses</h3>


        {expenseData.length === 0 ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: 24 }}>
            Pas de dépenses pour ce filtre.
          </div>
        ) : (
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
                  {expenseData.map((entry) => (
                    <Cell key={entry.name} fill={categoryColors?.[entry.name] || "#6b7280"} />
                  ))}
                </Pie>

                <Tooltip formatter={(v) => formatEUR(v)} />
                {!isMobile && <Legend />}
              </PieChart>
            </ResponsiveContainer>
            {isMobile && <LegendList items={expenseData} categoryColors={categoryColors} />}

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
                  {incomeData.map((entry) => (
                    <Cell key={entry.name} fill={categoryColors?.[entry.name] || "#6b7280"} />
                  ))}
                </Pie>

                <Tooltip formatter={(v) => formatEUR(v)} />
                {!isMobile && <Legend />}
              </PieChart>
            </ResponsiveContainer>

            {isMobile && <LegendList items={incomeData} categoryColors={categoryColors} />}

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
    border: "1px solid #e5e7eb",
    background: "white"
  },
  label: { display: "grid", gap: 6, fontWeight: 800, fontSize: 12, color: "#111827" },
  input: { padding: "12px 12px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 15 },
  big: { fontSize: 16 },
  line: { display: "flex", alignItems: "center", justifyContent: "space-between" },

  legendRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "8px 2px"
  },
  legendName: {
    fontWeight: 800,
    fontSize: 13,
    color: "#111827",
    maxWidth: "70%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  legendValue: {
    fontWeight: 900,
    fontSize: 13,
    color: "#111827"
  },

};



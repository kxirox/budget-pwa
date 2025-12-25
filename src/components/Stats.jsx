import React, { useMemo, useState } from "react";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { currentMonthKey, formatEUR, monthLabelFR } from "../utils";

export default function Stats({ expenses, categories }) {
  // UI filter
  const [mode, setMode] = useState("month"); // "month" | "range"
  const [month, setMonth] = useState("ALL"); // "ALL" or "YYYY-MM"
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const isMobile = typeof window !== "undefined" && window.innerWidth < 700;

  const months = useMemo(() => {
    const set = new Set(expenses.map(e => currentMonthKey(String(e.date || "").trim())));
    const arr = Array.from(set);
    arr.sort((a, b) => b.localeCompare(a));
    if (arr.length === 0) return ["ALL"];
    return ["ALL", ...arr];
  }, [expenses]);

  // Filtered expenses for stats
  const statsFiltered = useMemo(() => {
    return expenses.filter(e => {
      const d = String(e.date || "").trim();

      if (mode === "range") {
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      }

      // mode month
      if (month === "ALL") return true;
      return currentMonthKey(d) === month;
    });
  }, [expenses, mode, from, to, month]);


  
  // calcul des deux dataset
  const expenseData = useMemo(() => {
    const map = new Map(categories.map(c => [c, 0]));

    for (const e of statsFiltered) {
      if (e.kind !== "expense") continue;
      const cat = String(e.category || "Autres").trim() || "Autres";
      map.set(cat, (map.get(cat) || 0) + Number(e.amount || 0));
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [statsFiltered, categories]);

  const incomeData = useMemo(() => {
    const map = new Map(categories.map(c => [c, 0]));

    for (const e of statsFiltered) {
      if (e.kind !== "income") continue;
      const cat = String(e.category || "Autres").trim() || "Autres";
      map.set(cat, (map.get(cat) || 0) + Number(e.amount || 0));
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [statsFiltered, categories]);
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
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr"
            }}
          >
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
                <Pie dataKey="value" data={expenseData} label />
                <Tooltip formatter={(v) => formatEUR(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
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
                <Pie dataKey="value" data={incomeData} label />
                <Tooltip formatter={(v) => formatEUR(v)} />
                <Legend />
              </PieChart>
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
  line: { display: "flex", alignItems: "center", justifyContent: "space-between" }
};

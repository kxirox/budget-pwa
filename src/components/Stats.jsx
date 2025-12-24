import React, { useMemo, useState } from "react";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { currentMonthKey, formatEUR, monthLabelFR } from "../utils";

export default function Stats({ expenses, categories }) {
  const [month, setMonth] = useState(currentMonthKey(new Date().toISOString().slice(0, 10)));

  const months = useMemo(() => {
    const set = new Set(expenses.map(e => currentMonthKey(e.date)));
    const arr = Array.from(set);
    arr.sort((a, b) => b.localeCompare(a));
    if (arr.length === 0) return [currentMonthKey(new Date().toISOString().slice(0, 10))];
    return arr;
  }, [expenses]);

  const data = useMemo(() => {
    const map = new Map(categories.map(c => [c, 0]));
    for (const e of expenses) {
      if (currentMonthKey(e.date) !== month) continue;
      map.set(e.category, (map.get(e.category) || 0) + Number(e.amount || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [expenses, categories, month]);

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>
      <div style={styles.card}>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={styles.label}>
            Mois
            <select value={month} onChange={(e) => setMonth(e.target.value)} style={styles.input}>
              {months.map(m => <option key={m} value={m}>{monthLabelFR(m)}</option>)}
            </select>
          </label>

          <div style={styles.big}>
            Total du mois: <span style={{ fontWeight: 900 }}>{formatEUR(total)}</span>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        {data.length === 0 ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: 24 }}>
            Pas de données pour ce mois.
          </div>
        ) : (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie dataKey="value" data={data} label />
                <Tooltip formatter={(v) => formatEUR(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {data.length > 0 && (
        <div style={styles.card}>
          <h3 style={{ margin: 0, marginBottom: 10 }}>Top catégories</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {data.slice(0, 6).map(d => (
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

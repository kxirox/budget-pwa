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
  DEFAULT_ACCOUNT_TYPES
} from "./storage.js";


export default function App() {
  const [tab, setTab] = useState("add");
  const [categories, setCategories] = useState(() => loadCategories());
  const [expenses, setExpenses] = useState(() => loadExpenses());

  // Persistance
  useEffect(() => saveCategories(categories), [categories]);
  useEffect(() => saveExpenses(expenses), [expenses]);

  const safeCategories = useMemo(() => {
    const unique = Array.from(new Set(categories.map(c => String(c).trim()).filter(Boolean)));
    return unique.length ? unique : ["Autres"];
  }, [categories]);

  function addExpense(payload) {
    const e = {
      id: uid(),
      kind: payload.kind ?? "expense",
      amount: Math.abs(payload.amount),
      category: payload.category,
      bank: payload.bank,
      accountType: payload.accountType,
      date: payload.date,
      note: payload.note ?? ""
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
        <div style={styles.title}>Budget Perso</div>
        <div style={styles.subtitle}>Offline • Données sur ton téléphone • Export CSV</div>
      </div>

      <TopBar tab={tab} setTab={setTab} />

      {tab === "add" && (
        <AddExpense
          categories={safeCategories}
          banks={DEFAULT_BANKS}
          accountTypes={DEFAULT_ACCOUNT_TYPES}
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
        />
      )}


      {tab === "stats" && (
        <Stats expenses={expenses} categories={safeCategories} />
      )}

      {tab === "cats" && (
        <Categories categories={safeCategories} onSetCategories={setCategories} />
      )}

      <div style={{ height: 30 }} />
    </div>
  );
}

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

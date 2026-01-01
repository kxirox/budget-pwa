import React, { useMemo, useState } from "react";
import { toISODate } from "../utils";

export default function AddExpense({ categories, banks, accountTypes, onAdd }) {
  const today = useMemo(() => toISODate(new Date()), []);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Autres");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [bank, setBank] = useState(banks[0] ?? "Physique");
  const [accountType, setAccountType] = useState(accountTypes[0] ?? "Compte courant");
  const [kind, setKind] = useState("expense");
 


  function submit(e) {
    e.preventDefault();
    const a = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(a) || a <= 0) {
      alert("Entre un montant valide (> 0).");
      return;
    }
    onAdd({
        kind,
        amount: Math.round(a * 100) / 100,
        category,
        bank,
        accountType,
        date,
        note: note.trim()
    });
    setAmount("");
    setNote("");
  }

  return (
    <div style={styles.card}>
      <h2 style={styles.h2}>Ajouter une dépense</h2>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <label style={styles.label}>
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={styles.input}>
            <option value="expense">Dépense</option>
            <option value="income">Revenu</option>
          </select>
        </label>

        <label style={styles.label}>
          Montant (€)
          <input
            inputMode="decimal"
            placeholder="ex: 12,50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Catégorie
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label style={styles.label}>
        Banque
        <select value={bank} onChange={(e) => setBank(e.target.value)} style={styles.input}>
            {banks.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>

        <label style={styles.label}>
        Type de compte
        <select value={accountType} onChange={(e) => setAccountType(e.target.value)} style={styles.input}>
            {accountTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>


        <label style={styles.label}>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
        </label>

        <label style={styles.label}>
          Note (optionnel)
          <input
            placeholder="ex: Carrefour"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={styles.input}
          />
        </label>

        <button type="submit" style={styles.btn}>Ajouter</button>
        <p style={styles.hint}>
          Astuce : une fois installée, l’app marche offline et garde tes données sur le téléphone.
        </p>













      </form>
    </div>
  );
}

const styles = {
  card: {
    margin: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "white"
  },
  h2: { margin: 0, marginBottom: 12, fontSize: 18 },
  label: { display: "grid", gap: 6, fontWeight: 600, fontSize: 13, color: "#111827" },
  input: {
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    fontSize: 16
  },
  btn: {
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontSize: 16,
    fontWeight: 700
  },
  hint: { margin: 0, color: "#6b7280", fontSize: 12, lineHeight: 1.4 }
};

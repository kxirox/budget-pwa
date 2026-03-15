import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { getAccountCurrency, toEUR, getContribRate } from "../storage";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fmtK(n) {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return (n / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " k€";
  return fmt(n);
}
function fmtPct(n) {
  if (!Number.isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + " %";
}

const PIE_COLORS = ["#2563eb","#16a34a","#dc2626","#d97706","#7c3aed","#0891b2","#be185d","#65a30d","#0f766e","#b45309"];

// Détection dynamique : livret = accountType contient "livret" (insensible à la casse)
function isLivret(accountType) {
  return String(accountType || "").toLowerCase().includes("livret");
}

function getSnapshotTotal(s) {
  if (!s) return null;
  if (s.mode === "global") return Number(s.value || 0);
  return Object.values(s.values || {}).reduce((sum, v) => sum + Number(v || 0), 0);
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
  },
  statBox: {
    background: "#f9f6f0",
    borderRadius: 10,
    padding: "10px 12px",
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 10,
  },
};

// ── Composant PieCard ─────────────────────────────────────────────────────────

function PieCard({ title, data }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={styles.card}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <div style={{ width: 160, height: 160, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} innerRadius={30}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "grid", gap: 5, flex: 1, minWidth: 130 }}>
          {data.map((d, i) => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
              <span style={{ flex: 1, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
              <span style={{ color: "#6b7280" }}>{total > 0 ? Math.round(d.value / total * 100) : 0} %</span>
              <span style={{ fontWeight: 700, minWidth: 70, textAlign: "right" }}>{fmtK(d.value)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #e8dfc8", paddingTop: 5, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "#6b7280" }}>Total</span>
            <span style={{ fontWeight: 800 }}>{fmt(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function Patrimoine({
  expenses = [],
  investments = { accounts: [], purchases: [], snapshots: [] },
  exchangeRates = {},
  accountCurrencies = {},
  accountContribRates = {},
}) {
  const { accounts = [], purchases = [], snapshots = [] } = investments;

  // ── 1. Soldes courants & livrets (depuis transactions) ──
  const { soldeCourants, soldeLivrets, soldeByBank, soldeByType } = useMemo(() => {
    const byBank = {};
    const byCourant  = { total: 0 };
    const byLivret   = { total: 0 };

    // Comptes investissement → remplacés par snapshot (ne pas comptabiliser les transactions)
    const investKeys = new Set(
      accounts.map(a => `${a.bank}||${a.accountType}`)
    );

    for (const e of expenses) {
      const acctKey = `${String(e.bank || "Physique").trim()}||${String(e.accountType || "Compte courant").trim()}`;
      if (investKeys.has(acctKey)) continue; // géré par snapshots

      const currency  = getAccountCurrency(accountCurrencies, e.bank, e.accountType);
      const amountEUR = toEUR(Number(e.amount || 0), currency, exchangeRates);
      const contrib   = getContribRate(accountContribRates, e.bank, e.accountType);

      // Inclure tous les comptes non-investissement (pas de filtre sur le type)
      const livret  = isLivret(e.accountType);
      const bankKey = String(e.bank || "Physique").trim();
      const sign = (e.kind === "income" || e.kind === "transfer_in") ? 1 : -1;
      const net = sign * amountEUR * contrib;

      byBank[bankKey]  = (byBank[bankKey]  || 0) + net;
      if (livret) byLivret.total  += net;
      else        byCourant.total += net;
    }

    // Ajouter les comptes investissement (derniers snapshots) à soldeByBank
    accounts.forEach(acc => {
      const latest = snapshots
        .filter(s => s.accountId === acc.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!latest) return;
      const val    = getSnapshotTotal(latest);
      const contrib = getContribRate(accountContribRates, acc.bank, acc.accountType);
      byBank[acc.bank] = (byBank[acc.bank] || 0) + val * contrib;
    });

    const toSlices = obj => Object.entries(obj)
      .filter(([, v]) => Math.abs(v) > 0.01)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);

    // soldeByType : Courants / Livrets / Investissements
    let soldeInvest = 0;
    accounts.forEach(acc => {
      const latest = snapshots
        .filter(s => s.accountId === acc.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (latest) {
        const contrib = getContribRate(accountContribRates, acc.bank, acc.accountType);
        soldeInvest += getSnapshotTotal(latest) * contrib;
      }
    });

    const typeMap = {};
    if (Math.abs(byCourant.total) > 0.01) typeMap["Comptes courants"] = Math.round(byCourant.total * 100) / 100;
    if (Math.abs(byLivret.total)  > 0.01) typeMap["Livrets (épargne)"] = Math.round(byLivret.total * 100) / 100;
    if (soldeInvest               > 0.01) typeMap["Investissements"]  = Math.round(soldeInvest     * 100) / 100;

    return {
      soldeCourants: byCourant.total,
      soldeLivrets:  byLivret.total,
      soldeByBank:   toSlices(byBank),
      soldeByType:   Object.entries(typeMap).map(([name, value]) => ({ name, value })),
    };
  }, [expenses, accounts, snapshots, accountCurrencies, exchangeRates, accountContribRates]);

  // ── 2. Valeur investissements (snapshots) ──
  const soldeInvestissements = useMemo(() => {
    let total = 0;
    accounts.forEach(acc => {
      const latest = snapshots
        .filter(s => s.accountId === acc.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (latest) {
        const contrib = getContribRate(accountContribRates, acc.bank, acc.accountType);
        total += getSnapshotTotal(latest) * contrib;
      }
    });
    return total;
  }, [accounts, snapshots, accountContribRates]);

  // ── 3. Fortune totale nette ──
  const fortuneTotale = soldeCourants + soldeLivrets + soldeInvestissements;

  // ── 4. Camembert investissements par ligne d'actif ──
  const investPieData = useMemo(() => {
    const byLine = {};
    accounts.forEach(acc => {
      const latestLines = snapshots
        .filter(s => s.accountId === acc.id && s.mode === "lines")
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const contrib = getContribRate(accountContribRates, acc.bank, acc.accountType);
      if (latestLines && acc.lines?.length > 0) {
        acc.lines.forEach(l => {
          const val = Number(latestLines.values?.[l.id] || 0) * contrib;
          if (val > 0) byLine[l.name] = (byLine[l.name] || 0) + val;
        });
      } else if (acc.lines?.length > 0) {
        // fallback : capital investi par ligne
        acc.lines.forEach(l => {
          const val = purchases
            .filter(p => p.lineId === l.id)
            .reduce((s, p) => s + Number(p.amount || 0), 0) * contrib;
          if (val > 0) byLine[l.name] = (byLine[l.name] || 0) + val;
        });
      }
    });
    return Object.entries(byLine)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [accounts, snapshots, purchases, accountContribRates]);

  // ── 5. Courbe d'évolution mensuelle ──
  const evolutionData = useMemo(() => {
    if (expenses.length === 0 && snapshots.length === 0) return [];

    // Bornes temporelles
    const allDates = [
      ...expenses.map(e => e.date),
      ...snapshots.map(s => s.date),
    ].filter(Boolean).sort();
    if (allDates.length === 0) return [];

    const firstDate = new Date(allDates[0]);
    const now = new Date();

    // Générer tous les mois entre firstDate et now
    const months = [];
    const cur = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
    while (cur <= now) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
      cur.setMonth(cur.getMonth() + 1);
    }

    // Investissement accounts keys
    const investKeys = new Set(accounts.map(a => `${a.bank}||${a.accountType}`));

    return months.map(month => {
      const dateLimit = `${month}-31`; // fin du mois

      // Courants + Livrets : cumul transactions jusqu'à ce mois
      let comptesBal = 0;
      for (const e of expenses) {
        if (!e.date || e.date.slice(0, 7) > month) continue;
        const acctKey = `${String(e.bank || "").trim()}||${String(e.accountType || "").trim()}`;
        if (investKeys.has(acctKey)) continue;
        // Inclure tous les comptes non-investissement
        const currency  = getAccountCurrency(accountCurrencies, e.bank, e.accountType);
        const amountEUR = toEUR(Number(e.amount || 0), currency, exchangeRates);
        const contrib   = getContribRate(accountContribRates, e.bank, e.accountType);
        const sign = (e.kind === "income" || e.kind === "transfer_in") ? 1 : -1;
        comptesBal += sign * amountEUR * contrib;
      }

      // Investissements : dernier snapshot connu ≤ fin du mois
      let investBal = 0;
      accounts.forEach(acc => {
        const latest = snapshots
          .filter(s => s.accountId === acc.id && s.date <= dateLimit)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        if (latest) {
          const contrib = getContribRate(accountContribRates, acc.bank, acc.accountType);
          investBal += getSnapshotTotal(latest) * contrib;
        }
      });

      const total = comptesBal + investBal;
      return {
        date: month.slice(0, 7),
        "Fortune totale": Math.round(total * 100) / 100,
        "dont Investissements": Math.round(investBal * 100) / 100,
      };
    });
  }, [expenses, accounts, snapshots, accountCurrencies, exchangeRates, accountContribRates]);

  // ── 6. Time Freedom ──
  const timeFreedom = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const limitStr = `${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;

    const depenses = expenses.filter(e =>
      e.kind === "depense" &&
      e.date >= limitStr
    );

    const totalDepenses = depenses.reduce((s, e) => {
      const currency  = getAccountCurrency(accountCurrencies, e.bank, e.accountType);
      const amountEUR = toEUR(Number(e.amount || 0), currency, exchangeRates);
      const contrib   = getContribRate(accountContribRates, e.bank, e.accountType);
      return s + amountEUR * contrib;
    }, 0);

    const avgMonthly = totalDepenses / 12;
    if (avgMonthly <= 0) return null;

    const months = fortuneTotale / avgMonthly;
    const years  = months / 12;

    return { avgMonthly, months, years };
  }, [expenses, fortuneTotale, accountCurrencies, exchangeRates, accountContribRates]);

  // ── Jauge Time Freedom ──
  function TimeFreedomGauge({ months }) {
    const PALIERS = [
      { label: "6 mois",  val: 6,   color: "#ef4444" },
      { label: "1 an",    val: 12,  color: "#f97316" },
      { label: "2 ans",   val: 24,  color: "#eab308" },
      { label: "5 ans",   val: 60,  color: "#22c55e" },
    ];
    const maxVal  = 120; // 10 ans = 100% de la jauge
    const pct     = Math.min(months / maxVal * 100, 100);
    const color   = months >= 60 ? "#22c55e"
                  : months >= 24 ? "#84cc16"
                  : months >= 12 ? "#eab308"
                  : months >= 6  ? "#f97316"
                  : "#ef4444";

    return (
      <div style={{ marginTop: 12 }}>
        {/* Barre */}
        <div style={{ background: "#e5e7eb", borderRadius: 99, height: 14, position: "relative", overflow: "visible" }}>
          <div style={{
            background: color,
            width: `${pct}%`,
            height: "100%",
            borderRadius: 99,
            transition: "width 0.5s",
            minWidth: pct > 0 ? 6 : 0,
          }} />
          {/* Marqueurs paliers */}
          {PALIERS.map(p => {
            const pos = Math.min(p.val / maxVal * 100, 100);
            return (
              <div key={p.val} style={{ position: "absolute", left: `${pos}%`, top: -4, transform: "translateX(-50%)" }}>
                <div style={{ width: 2, height: 22, background: "#9ca3af", margin: "0 auto" }} />
              </div>
            );
          })}
        </div>
        {/* Labels paliers */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, position: "relative" }}>
          {PALIERS.map(p => {
            const pos = Math.min(p.val / maxVal * 100, 100);
            return (
              <div key={p.val} style={{ position: "absolute", left: `${pos}%`, transform: "translateX(-50%)", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#9ca3af", whiteSpace: "nowrap" }}>{p.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ height: 20 }} />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>

      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>🏦 Patrimoine</h2>
      </div>

      {/* Fortune totale */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Fortune totale nette</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: fortuneTotale >= 0 ? "#16a34a" : "#ef4444", letterSpacing: -1 }}>
          {fmt(fortuneTotale)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginTop: 14 }}>
          <div style={styles.statBox}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Comptes courants</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: soldeCourants >= 0 ? "#374151" : "#ef4444" }}>
              {fmt(soldeCourants)}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>
              {fortuneTotale !== 0 ? Math.round(soldeCourants / fortuneTotale * 100) : 0} % du total
            </div>
          </div>
          <div style={styles.statBox}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Livrets</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: soldeLivrets >= 0 ? "#374151" : "#ef4444" }}>
              {fmt(soldeLivrets)}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>
              {fortuneTotale !== 0 ? Math.round(soldeLivrets / fortuneTotale * 100) : 0} % du total
            </div>
          </div>
          <div style={styles.statBox}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Investissements</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#2563eb" }}>
              {fmt(soldeInvestissements)}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>
              {fortuneTotale !== 0 ? Math.round(soldeInvestissements / fortuneTotale * 100) : 0} % du total
            </div>
          </div>
        </div>
      </div>

      {/* Time Freedom */}
      {timeFreedom && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>⏱ Time Freedom</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 8 }}>
            <div style={styles.statBox}>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Autonomie financière</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: timeFreedom.months >= 24 ? "#16a34a" : timeFreedom.months >= 12 ? "#eab308" : "#ef4444" }}>
                {timeFreedom.months >= 24
                  ? `${timeFreedom.years.toFixed(1)} ans`
                  : `${timeFreedom.months.toFixed(1)} mois`}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Dépenses moy./mois</div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{fmt(timeFreedom.avgMonthly)}</div>
              <div style={{ fontSize: 10, color: "#9ca3af" }}>12 derniers mois</div>
            </div>
            <div style={styles.statBox}>
              <div style={{ fontSize: 11, color: "#6b7280" }}>En années</div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{timeFreedom.years.toFixed(2)} ans</div>
            </div>
          </div>
          <TimeFreedomGauge months={timeFreedom.months} />
        </div>
      )}

      {/* Courbe d'évolution */}
      {evolutionData.length >= 2 && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>📈 Évolution du patrimoine</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0e9d8" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtK(v).replace(" €", "")} width={50} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Fortune totale" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="dont Investissements" stroke="#16a34a" strokeWidth={1} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Camemberts */}
      <PieCard title="🏦 Répartition par banque" data={soldeByBank} />
      <PieCard title="📂 Répartition par type" data={soldeByType} />
      {investPieData.length >= 2 && (
        <PieCard title="📊 Investissements par ligne d'actif" data={investPieData} />
      )}

    </div>
  );
}

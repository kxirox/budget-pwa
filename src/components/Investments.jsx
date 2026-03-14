import React, { useState, useMemo } from "react";
import { uid } from "../storage.js";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const LINE_TYPE_SUGGESTIONS = ["ETF", "Action", "Obligation", "SCPI", "Or", "Crypto", "Immobilier", "Autre"];

// Select avec liste + option "Personnalisé…" qui bascule sur un input libre
function TypeSelector({ value, onChange, inputStyle }) {
  const isCustom = value !== undefined && !LINE_TYPE_SUGGESTIONS.includes(value);
  const [customMode, setCustomMode] = React.useState(() => isCustom);

  if (customMode) {
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center", width: 110 }}>
        <input
          autoFocus
          placeholder="Type…"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
        />
        <button
          type="button"
          title="Retour à la liste"
          onClick={() => { setCustomMode(false); onChange(LINE_TYPE_SUGGESTIONS[0]); }}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#6b7280", padding: 0, flexShrink: 0 }}
        >↩</button>
      </div>
    );
  }

  return (
    <select
      value={LINE_TYPE_SUGGESTIONS.includes(value) ? value : LINE_TYPE_SUGGESTIONS[0]}
      onChange={e => {
        if (e.target.value === "__custom__") { setCustomMode(true); onChange(""); }
        else onChange(e.target.value);
      }}
      style={{ ...inputStyle, width: 110 }}
    >
      {LINE_TYPE_SUGGESTIONS.map(t => <option key={t} value={t}>{t}</option>)}
      <option value="__custom__">✏️ Personnalisé…</option>
    </select>
  );
}

function fmt(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtPct(n) {
  if (!Number.isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + " %";
}

function fmtDate(d) {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getSnapshotTotal(s) {
  if (!s) return null;
  if (s.mode === "global") return Number(s.value || 0);
  return Object.values(s.values || {}).reduce((sum, v) => sum + Number(v || 0), 0);
}

export default function Investments({ investments, onSave, banks = [], accountTypes = [] }) {
  const { accounts = [], purchases = [], snapshots = [] } = investments || {};

  // ── Modal states ──
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(null); // accountId
  const [showPurchaseModal, setShowPurchaseModal] = useState(null); // accountId
  const [showEditLinesModal, setShowEditLinesModal] = useState(null); // accountId
  const [editLinesState, setEditLinesState] = useState([]); // copie locale des lignes en cours d'édition
  const [expandedId, setExpandedId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type, id }

  // ── Account form ──
  const [formBank, setFormBank] = useState(banks[0] || "");
  const [formAccountType, setFormAccountType] = useState("CTO");
  const [formLines, setFormLines] = useState([]);
  const [formLineName, setFormLineName] = useState("");
  const [formLineType, setFormLineType] = useState("ETF");

  // ── Snapshot form ──
  const [snapDate, setSnapDate] = useState(new Date().toISOString().slice(0, 10));
  const [snapMode, setSnapMode] = useState("global");
  const [snapGlobalValue, setSnapGlobalValue] = useState("");
  const [snapLineValues, setSnapLineValues] = useState({});

  // ── Purchase form ──
  const [purLineId, setPurLineId] = useState("");
  const [purDate, setPurDate] = useState(new Date().toISOString().slice(0, 10));
  const [purAmount, setPurAmount] = useState("");
  const [purNote, setPurNote] = useState("");
  const [purFees, setPurFees] = useState("");
  const [purShares, setPurShares] = useState("");
  const [purPricePerShare, setPurPricePerShare] = useState("");
  const [purAnnualFeesPct, setPurAnnualFeesPct] = useState("");
  const [purShowDetails, setPurShowDetails] = useState(false);

  // ── Computed stats per account ──
  const accountStats = useMemo(() => {
    return accounts.map(acc => {
      const accSnapshots = snapshots
        .filter(s => s.accountId === acc.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const latest = accSnapshots[0] ?? null;
      const latestValue = getSnapshotTotal(latest);

      const accPurchases = purchases.filter(p => p.accountId === acc.id);
      const totalInvested = accPurchases.reduce((s, p) => s + Number(p.amount || 0), 0);

      const perf = (latestValue !== null && totalInvested > 0)
        ? { eur: latestValue - totalInvested, pct: ((latestValue - totalInvested) / totalInvested) * 100 }
        : null;

      // Chart: snapshots chronologiques avec capital investi cumulé
      const chartData = [...accSnapshots].reverse().map(s => {
        const val = getSnapshotTotal(s);
        const invested = accPurchases
          .filter(p => p.date <= s.date)
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        return {
          date: fmtDate(s.date),
          "Valeur marché": Math.round(val * 100) / 100,
          "Capital investi": Math.round(invested * 100) / 100,
        };
      });

      return { ...acc, latest, latestValue, totalInvested, perf, chartData, accSnapshots, accPurchases };
    });
  }, [accounts, purchases, snapshots]);

  // ── Handlers ──
  function openSnapshotModal(accountId) {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;
    setSnapDate(new Date().toISOString().slice(0, 10));
    setSnapMode(acc.lines?.length > 0 ? "lines" : "global");
    setSnapGlobalValue("");
    const initValues = {};
    (acc.lines || []).forEach(l => { initValues[l.id] = ""; });
    setSnapLineValues(initValues);
    setShowSnapshotModal(accountId);
  }

  function openPurchaseModal(accountId) {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;
    setPurLineId(acc.lines?.[0]?.id || "");
    setPurDate(new Date().toISOString().slice(0, 10));
    setPurAmount("");
    setPurNote("");
    setPurFees("");
    setPurShares("");
    setPurPricePerShare("");
    setPurAnnualFeesPct("");
    setPurShowDetails(false);
    setShowPurchaseModal(accountId);
  }

  function openAccountModal() {
    setFormBank(banks[0] || "");
    setFormAccountType(accountTypes.find(t => ["PEA", "CTO", "Compte titres"].includes(t)) || accountTypes[0] || "CTO");
    setFormLines([]);
    setFormLineName("");
    setFormLineType("ETF");
    setShowAccountModal(true);
  }

  function saveAccount() {
    if (!formBank || !formAccountType) return;
    const newAccount = { id: uid(), bank: formBank, accountType: formAccountType, lines: formLines };
    onSave({ ...investments, accounts: [...accounts, newAccount] });
    setShowAccountModal(false);
  }

  function saveSnapshot() {
    const acc = accounts.find(a => a.id === showSnapshotModal);
    if (!acc || !snapDate) return;
    let newSnapshot;
    if (snapMode === "global") {
      if (!snapGlobalValue) return;
      newSnapshot = { id: uid(), accountId: acc.id, date: snapDate, mode: "global", value: Number(snapGlobalValue) };
    } else {
      const values = {};
      (acc.lines || []).forEach(l => { values[l.id] = Number(snapLineValues[l.id] || 0); });
      newSnapshot = { id: uid(), accountId: acc.id, date: snapDate, mode: "lines", values };
    }
    onSave({ ...investments, snapshots: [...snapshots, newSnapshot] });
    setShowSnapshotModal(null);
  }

  function savePurchase() {
    if (!showPurchaseModal || !purDate || !purAmount) return;
    const newPurchase = {
      id: uid(),
      accountId: showPurchaseModal,
      lineId: purLineId || null,
      date: purDate,
      amount: Number(purAmount),
      note: purNote.trim(),
      ...(purFees          ? { fees: Number(purFees) }               : {}),
      ...(purShares        ? { shares: Number(purShares) }           : {}),
      ...(purPricePerShare ? { pricePerShare: Number(purPricePerShare) } : {}),
      ...(purAnnualFeesPct ? { annualFeesPct: Number(purAnnualFeesPct) } : {}),
    };
    onSave({ ...investments, purchases: [...purchases, newPurchase] });
    setShowPurchaseModal(null);
  }

  function addFormLine() {
    if (!formLineName.trim()) return;
    setFormLines(prev => [...prev, { id: uid(), name: formLineName.trim(), type: formLineType }]);
    setFormLineName("");
    setFormLineType("ETF");
  }

  function openEditLinesModal(accountId) {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;
    // Copie profonde pour édition locale
    setEditLinesState((acc.lines || []).map(l => ({ ...l })));
    setShowEditLinesModal(accountId);
  }

  function saveEditedLines() {
    const acc = accounts.find(a => a.id === showEditLinesModal);
    if (!acc) return;
    const cleaned = editLinesState
      .map(l => ({ ...l, name: l.name.trim(), type: l.type.trim() }))
      .filter(l => l.name);
    const updatedAccounts = accounts.map(a =>
      a.id === showEditLinesModal ? { ...a, lines: cleaned } : a
    );
    onSave({ ...investments, accounts: updatedAccounts });
    setShowEditLinesModal(null);
  }

  function deleteAccount(accountId) {
    onSave({
      accounts: accounts.filter(a => a.id !== accountId),
      purchases: purchases.filter(p => p.accountId !== accountId),
      snapshots: snapshots.filter(s => s.accountId !== accountId),
    });
    setDeleteConfirm(null);
    if (expandedId === accountId) setExpandedId(null);
  }

  function deleteSnapshot(id) {
    onSave({ ...investments, snapshots: snapshots.filter(s => s.id !== id) });
    setDeleteConfirm(null);
  }

  function deletePurchase(id) {
    onSave({ ...investments, purchases: purchases.filter(p => p.id !== id) });
    setDeleteConfirm(null);
  }

  // ── Render ──
  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>📈 Investissements</h2>
        <button onClick={openAccountModal} style={styles.btnPrimary}>+ Compte</button>
      </div>

      {/* Empty state */}
      {accounts.length === 0 && (
        <div style={{ ...styles.card, textAlign: "center", padding: 32, color: "#6b7280" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Aucun compte d'investissement</div>
          <div style={{ fontSize: 13 }}>Ajoutez un compte pour suivre votre portefeuille</div>
          <button onClick={openAccountModal} style={{ ...styles.btnPrimary, marginTop: 16 }}>
            + Ajouter un compte
          </button>
        </div>
      )}

      {/* ── Account cards ── */}
      {accountStats.map(acc => (
        <div key={acc.id} style={styles.card}>

          {/* En-tête carte */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{acc.bank} — {acc.accountType}</div>
              {acc.lines?.length > 0 && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {acc.lines.map(l => `${l.name} (${l.type})`).join(" · ")}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => openSnapshotModal(acc.id)} style={styles.btnSmall}>📸</button>
              <button onClick={() => openPurchaseModal(acc.id)} style={styles.btnSmall}>💶</button>
              <button onClick={() => openEditLinesModal(acc.id)} style={styles.btnSmall}>✏️</button>
              <button
                onClick={() => setDeleteConfirm({ type: "account", id: acc.id })}
                style={{ ...styles.btnSmall, color: "#ef4444" }}
              >✕</button>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
            <div style={styles.statBox}>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Valeur actuelle</div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {acc.latestValue !== null ? fmt(acc.latestValue) : "—"}
              </div>
              {acc.latest && (
                <div style={{ fontSize: 10, color: "#9ca3af" }}>{fmtDate(acc.latest.date)}</div>
              )}
            </div>
            <div style={styles.statBox}>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Capital investi</div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{fmt(acc.totalInvested)}</div>
              <div style={{ fontSize: 10, color: "#9ca3af" }}>
                {acc.accPurchases.length} achat{acc.accPurchases.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Performance</div>
              {acc.perf ? (
                <>
                  <div style={{ fontWeight: 800, fontSize: 14, color: acc.perf.eur >= 0 ? "#16a34a" : "#ef4444" }}>
                    {fmt(acc.perf.eur)}
                  </div>
                  <div style={{ fontSize: 10, color: acc.perf.pct >= 0 ? "#16a34a" : "#ef4444" }}>
                    {fmtPct(acc.perf.pct)}
                  </div>
                </>
              ) : (
                <div style={{ fontWeight: 800, fontSize: 14 }}>—</div>
              )}
            </div>
          </div>

          {/* Bouton expand */}
          <button
            onClick={() => setExpandedId(expandedId === acc.id ? null : acc.id)}
            style={{ ...styles.btnSecondary, marginTop: 10, width: "100%", fontSize: 12 }}
          >
            {expandedId === acc.id ? "▲ Réduire" : "▼ Historique & détails"}
          </button>

          {/* Contenu déplié */}
          {expandedId === acc.id && (
            <div style={{ marginTop: 12, display: "grid", gap: 14 }}>

              {/* Graphique */}
              {acc.chartData.length >= 2 && (
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={acc.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0e9d8" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v + "€"} />
                      <Tooltip formatter={v => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="Valeur marché" stroke="#2563eb" strokeWidth={2} dot />
                      <Line type="monotone" dataKey="Capital investi" stroke="#9ca3af" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Valorisations */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  Valorisations
                  <button onClick={() => openSnapshotModal(acc.id)} style={{ ...styles.btnSmall, marginLeft: 8 }}>+ Nouvelle</button>
                </div>
                {acc.accSnapshots.length === 0 ? (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>Aucune valorisation enregistrée.</div>
                ) : (
                  <div style={{ display: "grid", gap: 4 }}>
                    {acc.accSnapshots.slice(0, 15).map(s => {
                      const total = getSnapshotTotal(s);
                      return (
                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 10px", background: "#f9f6f0", borderRadius: 8, gap: 8 }}>
                          <span style={{ color: "#6b7280", flexShrink: 0 }}>{fmtDate(s.date)}</span>
                          {s.mode === "lines" && (
                            <span style={{ fontSize: 11, color: "#6b7280", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {Object.entries(s.values || {}).map(([lid, v]) => {
                                const line = acc.lines?.find(l => l.id === lid);
                                return `${line?.name || "?"}: ${fmt(Number(v))}`;
                              }).join(" · ")}
                            </span>
                          )}
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                            <span style={{ fontWeight: 700 }}>{fmt(total)}</span>
                            <button
                              onClick={() => setDeleteConfirm({ type: "snapshot", id: s.id })}
                              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, padding: 0 }}
                            >✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Achats */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  Achats
                  <button onClick={() => openPurchaseModal(acc.id)} style={{ ...styles.btnSmall, marginLeft: 8 }}>+ Nouveau</button>
                </div>
                {acc.accPurchases.length === 0 ? (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>Aucun achat enregistré.</div>
                ) : (
                  <div style={{ display: "grid", gap: 4 }}>
                    {[...acc.accPurchases]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, 20)
                      .map(p => {
                        const line = acc.lines?.find(l => l.id === p.lineId);
                        const hasDetails = p.shares || p.fees || p.annualFeesPct;
                        return (
                          <div key={p.id} style={{ fontSize: 13, padding: "6px 10px", background: "#f9f6f0", borderRadius: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                              <span style={{ color: "#6b7280", flexShrink: 0 }}>{fmtDate(p.date)}</span>
                              <span style={{ color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {line ? line.name : (p.note || "Achat général")}
                              </span>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                                <span style={{ fontWeight: 700 }}>{fmt(Number(p.amount))}</span>
                                <button
                                  onClick={() => setDeleteConfirm({ type: "purchase", id: p.id })}
                                  style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, padding: 0 }}
                                >✕</button>
                              </div>
                            </div>
                            {hasDetails && (
                              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                                {p.shares && p.pricePerShare ? `${p.shares} parts × ${fmt(p.pricePerShare)}` : ""}
                                {p.fees ? ` · Frais : ${fmt(p.fees)}` : ""}
                                {p.annualFeesPct ? ` · Gestion : ${p.annualFeesPct} %/an` : ""}
                                {p.note && line ? ` · ${p.note}` : ""}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── Modal : Ajouter un compte ── */}
      {showAccountModal && (
        <div style={styles.backdrop} onClick={() => setShowAccountModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Nouveau compte</h3>
              <button onClick={() => setShowAccountModal(false)} style={styles.btnX}>✕</button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={styles.label}>
                Banque / Courtier
                <select value={formBank} onChange={e => setFormBank(e.target.value)} style={styles.input}>
                  {banks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label style={styles.label}>
                Type de compte
                <select value={formAccountType} onChange={e => setFormAccountType(e.target.value)} style={styles.input}>
                  {accountTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              {/* Lignes / actifs */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  Lignes / Actifs <span style={{ fontWeight: 400, color: "#6b7280" }}>(optionnel)</span>
                </div>
                {formLines.map(l => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 8px", background: "#f0e9d8", borderRadius: 8, marginBottom: 4 }}>
                    <span>{l.name}</span>
                    <span style={{ color: "#6b7280" }}>{l.type}</span>
                    <button onClick={() => setFormLines(prev => prev.filter(x => x.id !== l.id))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0 }}>✕</button>
                  </div>
                ))}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6, marginTop: 4 }}>
                  <input
                    placeholder="ex: ETF MSCI World"
                    value={formLineName}
                    onChange={e => setFormLineName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFormLine(); } }}
                    style={{ ...styles.input, margin: 0 }}
                  />
                  <TypeSelector value={formLineType} onChange={setFormLineType} inputStyle={{ ...styles.input, margin: 0 }} />
                  <button onClick={addFormLine} style={styles.btnSmall}>+</button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowAccountModal(false)} style={styles.btnSecondary}>Annuler</button>
                <button onClick={saveAccount} disabled={!formBank || !formAccountType} style={{ ...styles.btnPrimary, opacity: (!formBank || !formAccountType) ? 0.5 : 1 }}>
                  Créer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : Nouvelle valorisation ── */}
      {showSnapshotModal && (() => {
        const acc = accounts.find(a => a.id === showSnapshotModal);
        if (!acc) return null;
        const hasLines = acc.lines?.length > 0;
        const canSave = snapDate && (
          snapMode === "global" ? !!snapGlobalValue : Object.values(snapLineValues).some(v => !!v)
        );
        return (
          <div style={styles.backdrop} onClick={() => setShowSnapshotModal(null)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h3 style={{ margin: 0 }}>📸 Valorisation</h3>
                <button onClick={() => setShowSnapshotModal(null)} style={styles.btnX}>✕</button>
              </div>
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>{acc.bank} — {acc.accountType}</div>
              <div style={{ display: "grid", gap: 10 }}>
                <label style={styles.label}>
                  Date
                  <input type="date" value={snapDate} onChange={e => setSnapDate(e.target.value)} style={styles.input} />
                </label>
                {hasLines && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {["global", "lines"].map(m => (
                      <button
                        key={m}
                        onClick={() => setSnapMode(m)}
                        style={{ ...styles.btnSmall, flex: 1, background: snapMode === m ? "#111827" : "#f0e9d8", color: snapMode === m ? "white" : "#374151" }}
                      >
                        {m === "global" ? "🔢 Valeur globale" : "📋 Par ligne"}
                      </button>
                    ))}
                  </div>
                )}
                {snapMode === "global" ? (
                  <label style={styles.label}>
                    Valeur totale du compte (€)
                    <input
                      type="number" inputMode="decimal" placeholder="ex: 467.20"
                      value={snapGlobalValue} onChange={e => setSnapGlobalValue(e.target.value)}
                      style={styles.input}
                    />
                  </label>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {(acc.lines || []).map(l => (
                      <label key={l.id} style={styles.label}>
                        {l.name} ({l.type})
                        <input
                          type="number" inputMode="decimal" placeholder="Valeur en €"
                          value={snapLineValues[l.id] || ""}
                          onChange={e => setSnapLineValues(prev => ({ ...prev, [l.id]: e.target.value }))}
                          style={styles.input}
                        />
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
                  <button onClick={() => setShowSnapshotModal(null)} style={styles.btnSecondary}>Annuler</button>
                  <button onClick={saveSnapshot} disabled={!canSave} style={{ ...styles.btnPrimary, opacity: canSave ? 1 : 0.5 }}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal : Nouvel achat ── */}
      {showPurchaseModal && (() => {
        const acc = accounts.find(a => a.id === showPurchaseModal);
        if (!acc) return null;
        const canSave = purDate && purAmount;
        return (
          <div style={styles.backdrop} onClick={() => setShowPurchaseModal(null)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h3 style={{ margin: 0 }}>💶 Nouvel achat</h3>
                <button onClick={() => setShowPurchaseModal(null)} style={styles.btnX}>✕</button>
              </div>
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>{acc.bank} — {acc.accountType}</div>
              <div style={{ display: "grid", gap: 10 }}>
                <label style={styles.label}>
                  Date
                  <input type="date" value={purDate} onChange={e => setPurDate(e.target.value)} style={styles.input} />
                </label>
                {acc.lines?.length > 0 && (
                  <label style={styles.label}>
                    Ligne / Actif
                    <select value={purLineId} onChange={e => setPurLineId(e.target.value)} style={{ ...styles.input, width: "100%", boxSizing: "border-box" }}>
                      <option value="">— Général (sans ligne) —</option>
                      {acc.lines.map(l => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
                    </select>
                  </label>
                )}
                <label style={styles.label}>
                  Montant total déboursé (€)
                  <input
                    type="number" inputMode="decimal" placeholder="ex: 217.80"
                    value={purAmount} onChange={e => setPurAmount(e.target.value)}
                    style={styles.input}
                  />
                </label>

                {/* Section détails repliable */}
                <button
                  type="button"
                  onClick={() => setPurShowDetails(v => !v)}
                  style={{ ...styles.btnSecondary, textAlign: "left", fontSize: 13, padding: "8px 12px" }}
                >
                  {purShowDetails ? "▲" : "▼"} Détails (nb parts, frais…)
                </button>

                {purShowDetails && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <label style={styles.label}>
                        Nb de parts
                        <input
                          type="number" inputMode="decimal" placeholder="ex: 3"
                          value={purShares}
                          onChange={e => {
                            setPurShares(e.target.value);
                            const s = Number(e.target.value);
                            const p = Number(purPricePerShare);
                            if (s > 0 && p > 0) setPurAmount(String(Math.round(s * p * 100) / 100));
                          }}
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.label}>
                        Prix / part (€)
                        <input
                          type="number" inputMode="decimal" placeholder="ex: 72.60"
                          value={purPricePerShare}
                          onChange={e => {
                            setPurPricePerShare(e.target.value);
                            const s = Number(purShares);
                            const p = Number(e.target.value);
                            if (s > 0 && p > 0) setPurAmount(String(Math.round(s * p * 100) / 100));
                          }}
                          style={styles.input}
                        />
                      </label>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <label style={styles.label}>
                        Frais d'achat (€)
                        <input
                          type="number" inputMode="decimal" placeholder="ex: 1.00"
                          value={purFees} onChange={e => setPurFees(e.target.value)}
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.label}>
                        Frais de gestion/an (%)
                        <input
                          type="number" inputMode="decimal" placeholder="ex: 0.20"
                          value={purAnnualFeesPct} onChange={e => setPurAnnualFeesPct(e.target.value)}
                          style={styles.input}
                        />
                      </label>
                    </div>
                  </>
                )}

                <label style={styles.label}>
                  Note (optionnel)
                  <input
                    placeholder="ex: DCA mensuel"
                    value={purNote} onChange={e => setPurNote(e.target.value)}
                    style={styles.input}
                  />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
                  <button onClick={() => setShowPurchaseModal(null)} style={styles.btnSecondary}>Annuler</button>
                  <button onClick={savePurchase} disabled={!canSave} style={{ ...styles.btnPrimary, opacity: canSave ? 1 : 0.5 }}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal : Édition des lignes ── */}
      {showEditLinesModal && (() => {
        const acc = accounts.find(a => a.id === showEditLinesModal);
        if (!acc) return null;
        return (
          <div style={styles.backdrop} onClick={() => setShowEditLinesModal(null)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h3 style={{ margin: 0 }}>✏️ Modifier les lignes</h3>
                <button onClick={() => setShowEditLinesModal(null)} style={styles.btnX}>✕</button>
              </div>
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 14 }}>{acc.bank} — {acc.accountType}</div>

              <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                {editLinesState.length === 0 && (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>Aucune ligne. Ajoutez-en une ci-dessous.</div>
                )}
                {editLinesState.map((l, i) => (
                  <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6, alignItems: "center" }}>
                    <input
                      value={l.name}
                      onChange={e => setEditLinesState(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      placeholder="Nom de la ligne"
                      style={{ ...styles.input, margin: 0 }}
                    />
                    <TypeSelector
                      key={l.id}
                      value={l.type}
                      onChange={v => setEditLinesState(prev => prev.map((x, j) => j === i ? { ...x, type: v } : x))}
                      inputStyle={{ ...styles.input, margin: 0 }}
                    />
                    <button
                      onClick={() => setEditLinesState(prev => prev.filter((_, j) => j !== i))}
                      style={{ ...styles.btnSmall, color: "#ef4444" }}
                    >✕</button>
                  </div>
                ))}
              </div>

              {/* Ajout d'une nouvelle ligne depuis cette modale */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6, marginBottom: 16, paddingTop: 10, borderTop: "1px solid #e8dfc8" }}>
                <input
                  placeholder="Nouvelle ligne…"
                  value={formLineName}
                  onChange={e => setFormLineName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && formLineName.trim()) {
                      e.preventDefault();
                      setEditLinesState(prev => [...prev, { id: uid(), name: formLineName.trim(), type: formLineType || "ETF" }]);
                      setFormLineName("");
                    }
                  }}
                  style={{ ...styles.input, margin: 0 }}
                />
                <TypeSelector value={formLineType} onChange={setFormLineType} inputStyle={{ ...styles.input, margin: 0 }} />
                <button
                  onClick={() => {
                    if (!formLineName.trim()) return;
                    setEditLinesState(prev => [...prev, { id: uid(), name: formLineName.trim(), type: formLineType || "ETF" }]);
                    setFormLineName("");
                  }}
                  style={styles.btnSmall}
                >+</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button onClick={() => setShowEditLinesModal(null)} style={styles.btnSecondary}>Annuler</button>
                <button onClick={saveEditedLines} style={styles.btnPrimary}>Enregistrer</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal : Confirmation suppression ── */}
      {deleteConfirm && (
        <div style={styles.backdrop} onClick={() => setDeleteConfirm(null)}>
          <div style={{ ...styles.modal, maxWidth: 320, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗑️</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Supprimer ?</div>
            <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
              {deleteConfirm.type === "account" && "Ce compte et toutes ses données (achats, valorisations) seront supprimés."}
              {deleteConfirm.type === "snapshot" && "Cette valorisation sera supprimée."}
              {deleteConfirm.type === "purchase" && "Cet achat sera supprimé."}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={styles.btnSecondary}>Annuler</button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === "account") deleteAccount(deleteConfirm.id);
                  if (deleteConfirm.type === "snapshot") deleteSnapshot(deleteConfirm.id);
                  if (deleteConfirm.type === "purchase") deletePurchase(deleteConfirm.id);
                }}
                style={{ ...styles.btnPrimary, background: "#ef4444", borderColor: "#ef4444" }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "#fdfaf5",
    border: "1px solid #e8dfc8",
    borderRadius: 16,
    padding: 16,
  },
  statBox: {
    background: "#f0e9d8",
    borderRadius: 10,
    padding: "8px 10px",
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    background: "#fdfaf5",
    border: "1px solid #e8dfc8",
    borderRadius: 18,
    padding: 20,
    maxHeight: "90vh",
    overflowY: "auto",
    overflowX: "hidden",
    boxSizing: "border-box",
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  },
  label: {
    display: "grid",
    gap: 4,
    fontWeight: 600,
    fontSize: 14,
    color: "#374151",
  },
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 15,
    outline: "none",
    background: "white",
    width: "100%",
    boxSizing: "border-box",
  },
  btnPrimary: {
    padding: "11px 16px",
    borderRadius: 12,
    border: "none",
    background: "#111827",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "11px 16px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  btnSmall: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #e8dfc8",
    background: "#f0e9d8",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnX: {
    padding: "4px 8px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "white",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
    lineHeight: 1,
  },
};

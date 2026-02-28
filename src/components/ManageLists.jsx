import { useMemo, useState } from "react";

const styles = {
  card: { padding: 14, borderRadius: 16, border: "1px solid #e8dfc8", background: "#fdfaf5" },
  h2: { fontSize: 16, fontWeight: 900, marginBottom: 10 },
  row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  input: { padding: "12px", borderRadius: 12, border: "1px solid #d4c9ae", background: "#fdfaf5", fontSize: 15, flex: "1 1 220px" },
  btn: { padding: "10px 12px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 900 },
  btnLight: { padding: "10px 12px", borderRadius: 12, border: "1px solid #d4c9ae", background: "#fdfaf5", fontWeight: 900 },
  item: { display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 14, border: "1px solid #e8dfc8", background: "#fdfaf5" },
  left: { display: "grid", gap: 6, flex: 1, minWidth: 0 },
  muted: { color: "#6b7280", fontSize: 12 },
};

function uniqClean(arr) {
  return Array.from(new Set((arr || []).map((s) => String(s || "").trim()).filter(Boolean)));
}

function ListEditor({ title, items, setItems, usedValues = [] }) {
  const [newItem, setNewItem] = useState("");
  const usedSet = useMemo(
    () => new Set(usedValues.map((x) => String(x || "").trim()).filter(Boolean)),
    [usedValues]
  );

  function add() {
    const v = String(newItem || "").trim();
    if (!v) return;
    setItems((prev) => uniqClean([...(prev || []), v]).sort((a, b) => a.localeCompare(b)));
    setNewItem("");
  }

  function rename(oldValue) {
    const next = prompt(`Renommer "${oldValue}" en :`, oldValue);
    const v = String(next || "").trim();
    if (!v || v === oldValue) return;
    setItems((prev) =>
      uniqClean((prev || []).map((x) => (x === oldValue ? v : x))).sort((a, b) => a.localeCompare(b))
    );
  }

  function remove(value) {
    if (usedSet.has(value)) {
      const ok = confirm(
        `"${value}" est utilisée dans l'historique.\n\nSi tu la supprimes de la liste, les anciennes opérations garderont la valeur, mais elle ne sera plus proposée.\n\nContinuer ?`
      );
      if (!ok) return;
    } else {
      const ok = confirm(`Supprimer "${value}" ?`);
      if (!ok) return;
    }
    setItems((prev) => (prev || []).filter((x) => x !== value));
  }

  return (
    <div style={styles.card}>
      <div style={styles.h2}>{title}</div>

      <div style={{ ...styles.row, marginBottom: 12 }}>
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          style={styles.input}
          placeholder={`Ajouter une valeur (ex: ${title === "Banques" ? "Revolut" : "Courant"})`}
        />
        <button style={styles.btn} onClick={add} type="button">
          Ajouter
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {(items || []).length === 0 ? (
          <div style={styles.muted}>Aucune valeur. Tu peux en ajouter ci-dessus.</div>
        ) : (
          (items || []).map((it) => (
            <div key={it} style={styles.item}>
              <div style={styles.left}>
                <div style={{ fontWeight: 900, wordBreak: "break-word" }}>{it}</div>
                {usedSet.has(it) && <div style={styles.muted}>Utilisé dans l’historique</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={styles.btnLight} type="button" onClick={() => rename(it)}>
                  Renommer
                </button>
                <button
                  style={{ ...styles.btnLight, borderColor: "#ef4444", color: "#ef4444" }}
                  type="button"
                  onClick={() => remove(it)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const SUPPORTED_CURRENCIES = ["EUR", "CHF", "USD", "GBP"];

export default function ManageLists({
  banks,
  setBanks,
  accountTypes,
  setAccountTypes,
  expenses,
  accountCurrencies,
  setAccountCurrencies,
  exchangeRates,
  setExchangeRates,
  accountContribRates,
  setAccountContribRates,
  onConnectDrive,
  onBackupNow,
  onRestoreNow,
  driveStatus,
  syncStatus,
}) {

  const usedBanks = (expenses || []).map((e) => e.bank);
  const usedTypes = (expenses || []).map((e) => e.accountType);

  // Combinaisons banque × type de compte présentes dans l'historique
  const usedCombinations = useMemo(() => {
    const set = new Set();
    for (const e of expenses || []) {
      const b = String(e.bank || "").trim();
      const t = String(e.accountType || "").trim();
      if (b && t) set.add(`${b}||${t}`);
    }
    // Ajouter aussi les combinaisons déjà configurées
    for (const key of Object.keys(accountCurrencies || {})) set.add(key);
    for (const key of Object.keys(accountContribRates || {})) set.add(key);
    return Array.from(set).sort();
  }, [expenses, accountCurrencies, accountContribRates]);

  function setCurrencyForAccount(bank, accountType, currency) {
    const key = `${bank}||${accountType}`;
    setAccountCurrencies(prev => ({ ...prev, [key]: currency }));
  }

  function setContribRateForAccount(bank, accountType, pct) {
    const n = Number(String(pct).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n > 100) return;
    const key = `${bank}||${accountType}`;
    const decimal = Math.round((n / 100) * 10000) / 10000;
    setAccountContribRates(prev => ({ ...prev, [key]: decimal }));
  }

  function updateRate(rateKey, value) {
    const num = parseFloat(String(value).replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) return;
    setExchangeRates(prev => ({ ...prev, [rateKey]: Math.round(num * 10000) / 10000 }));
  }

  function addManualRate() {
    const from = prompt("Devise source (ex: CHF, USD):", "CHF");
    if (!from) return;
    const to = "EUR";
    const rateStr = prompt(`Taux : 1 ${from.trim().toUpperCase()} = ? EUR`, "0.95");
    const num = parseFloat(String(rateStr || "").replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) return alert("Taux invalide.");
    const key = `${from.trim().toUpperCase()}_EUR`;
    setExchangeRates(prev => ({ ...prev, [key]: Math.round(num * 10000) / 10000 }));
  }

  const syncLabel = syncStatus === "saving"
    ? { icon: "🔄", text: "Synchronisation en cours…", color: "#6b7280" }
    : syncStatus === "saved"
    ? { icon: "☁️", text: "Sauvegarde automatique OK", color: "#16a34a" }
    : syncStatus === "error"
    ? { icon: "⚠️", text: "Erreur de synchronisation", color: "#dc2626" }
    : null;

  const lastSave = localStorage.getItem("budget_last_save");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ListEditor title="Banques" items={banks} setItems={setBanks} usedValues={usedBanks} />
      <ListEditor title="Types de compte" items={accountTypes} setItems={setAccountTypes} usedValues={usedTypes} />

      {/* Devises par compte */}
      <div style={styles.card}>
        <div style={styles.h2}>💱 Devises par compte</div>
        <div style={{ ...styles.muted, marginBottom: 10 }}>
          Par défaut tous les comptes sont en EUR. Modifie ici si un compte est en CHF ou autre devise.
        </div>
        {usedCombinations.length === 0 ? (
          <div style={styles.muted}>Aucune combinaison banque/type détectée. Ajoute des opérations d'abord.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {usedCombinations.map((key) => {
              const [bank, accountType] = key.split("||");
              const current = (accountCurrencies || {})[key] || "EUR";
              return (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{bank} — {accountType}</span>
                  <select
                    value={current}
                    onChange={(e) => setCurrencyForAccount(bank, accountType, e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #d4c9ae", background: "#fdfaf5", fontWeight: 700 }}
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Taux de contribution par compte */}
      <div style={styles.card}>
        <div style={styles.h2}>👥 Taux de contribution par compte</div>
        <div style={{ ...styles.muted, marginBottom: 10 }}>
          Définis ta part réelle des dépenses sur chaque compte partagé.<br />
          100% = dépenses intégrales. 50% = compte partagé 50/50.
          Ce taux s'applique dans les statistiques via le toggle "Ma part".
        </div>
        {usedCombinations.length === 0 ? (
          <div style={styles.muted}>Aucune combinaison banque/type détectée. Ajoute des opérations d'abord.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {usedCombinations.map((key) => {
              const [bank, accountType] = key.split("||");
              const storedRate = (accountContribRates || {})[key];
              const displayPct = storedRate !== undefined
                ? Math.round(Number(storedRate) * 100)
                : 100;
              return (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{bank} — {accountType}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="100"
                      value={displayPct}
                      onChange={(e) => setContribRateForAccount(bank, accountType, e.target.value)}
                      style={{ width: 70, padding: "8px 10px", borderRadius: 10, border: "1px solid #d4c9ae", background: "#fdfaf5", fontWeight: 700, textAlign: "right" }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Taux de change */}
      <div style={styles.card}>
        <div style={styles.h2}>📈 Taux de change (vers EUR)</div>
        <div style={{ ...styles.muted, marginBottom: 10 }}>
          Les taux sont mis à jour automatiquement lors de chaque virement cross-devise.
          Tu peux aussi les saisir manuellement.
        </div>
        {Object.keys(exchangeRates || {}).length === 0 ? (
          <div style={styles.muted}>Aucun taux enregistré. Fais un virement CHF→EUR pour le mémoriser automatiquement.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries(exchangeRates || {}).map(([key, rate]) => {
              const [from, to] = key.split("_");
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 60 }}>1 {from} =</span>
                  <input
                    inputMode="decimal"
                    value={rate}
                    onChange={(e) => updateRate(key, e.target.value)}
                    style={{ width: 90, padding: "8px 10px", borderRadius: 10, border: "1px solid #d4c9ae", background: "#fdfaf5", fontWeight: 700 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{to}</span>
                </div>
              );
            })}
          </div>
        )}
        <button style={{ ...styles.btnLight, marginTop: 10 }} onClick={addManualRate} type="button">
          ➕ Ajouter un taux manuellement
        </button>
      </div>

      <div style={styles.card}>
        <div style={styles.h2}>Sauvegarde Google Drive</div>

        {driveStatus ? <div style={{ ...styles.muted, marginBottom: 6 }}>{driveStatus}</div> : null}

        {syncLabel && (
          <div style={{ fontSize: 13, color: syncLabel.color, marginBottom: 6, fontWeight: 600 }}>
            {syncLabel.icon} {syncLabel.text}
          </div>
        )}

        {lastSave && (
          <div style={{ ...styles.muted, marginBottom: 10 }}>
            Dernière sauvegarde : {new Date(lastSave).toLocaleString()}
          </div>
        )}

        <div style={{ ...styles.muted, marginBottom: 12, fontSize: 12 }}>
          La sauvegarde automatique se déclenche 4 secondes après chaque modification, si Drive est connecté.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={styles.btn} onClick={onConnectDrive} type="button">
            Connecter Google Drive
          </button>

          <button style={styles.btnLight} onClick={onBackupNow} type="button">
            Sauvegarder maintenant
          </button>

          <button style={styles.btnLight} onClick={onRestoreNow} type="button">
            Restaurer depuis Drive
          </button>

        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { parseExpensesCSV } from "../importCsv";
import { parseCreditMutuelWorkbook } from "../importCreditMutuel";
import { toCSV } from "../utils";

export default function ImportExport({ expenses, categories, banks, accountTypes, onImport }) {
  const [csvBank, setCsvBank] = useState(() =>
    banks?.includes("Crédit Mutuel") ? "Crédit Mutuel" : (banks?.[0] ?? "Crédit Mutuel")
  );
  const [csvAccountType, setCsvAccountType] = useState(() => accountTypes?.[0] ?? "Compte courant");

  const [cmBank, setCmBank] = useState(() =>
    banks?.includes("Crédit Mutuel") ? "Crédit Mutuel" : (banks?.[0] ?? "Crédit Mutuel")
  );
  const [cmAccountType, setCmAccountType] = useState(() => accountTypes?.[0] ?? "Compte courant");
  const [cmDefaultCategory, setCmDefaultCategory] = useState(() =>
    categories?.includes("Autres") ? "Autres" : (categories?.[0] ?? "Autres")
  );
  const [cmLastInfo, setCmLastInfo] = useState("");

  function exportCSV() {
    const csv = toCSV(expenses);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `depenses_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCSVFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const { rows, errors } = parseExpensesCSV(text, {
        defaultBank: csvBank,
        defaultAccountType: csvAccountType,
      });

      if (errors.length) {
        alert("Erreurs dans le CSV :\n\n" + errors.slice(0, 12).join("\n") + (errors.length > 12 ? "\n..." : ""));
        return;
      }
      if (rows.length === 0) {
        alert("Aucune dépense importée.");
        return;
      }

      const ok = confirm(`Importer ${rows.length} dépense(s) ? (elles seront ajoutées à l'historique)`);
      if (!ok) return;

      onImport(rows);
      alert("Import terminé ✅");
    };
    reader.readAsText(file, "utf-8");
  }

  function signatureFor(e) {
    const date = String(e.date || "").trim();
    const kind = String(e.kind || "").trim();
    const amount = Number(e.amount || 0);
    const note = String(e.note || "").trim().toLowerCase();
    return `${date}|${kind}|${amount}|${note}`;
  }

  function importCreditMutuelFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buf = reader.result;
        const { rows, errors, meta } = parseCreditMutuelWorkbook(buf, {
          defaultBank: cmBank,
          defaultAccountType: cmAccountType,
          defaultCategory: cmDefaultCategory,
        });

        if (errors?.length) {
          alert(
            "Erreurs lors de la lecture Crédit Mutuel :\n\n" +
              errors.slice(0, 12).join("\n") +
              (errors.length > 12 ? "\n..." : "")
          );
          return;
        }
        if (!rows || rows.length === 0) {
          alert("Aucune transaction détectée dans ce fichier.");
          return;
        }

        const existing = new Set(expenses.map(signatureFor));
        const unique = [];
        let skipped = 0;
        for (const r of rows) {
          const sig = signatureFor(r);
          if (existing.has(sig)) {
            skipped++;
          } else {
            existing.add(sig);
            unique.push(r);
          }
        }

        setCmLastInfo(
          `Onglet détecté : ${meta?.sheetName || "?"} • ${rows.length} ligne(s) • ${unique.length} à importer • ${skipped} doublon(s)`
        );

        if (unique.length === 0) {
          alert("Toutes les transactions semblent déjà présentes (doublons). ✅");
          return;
        }

        const ok = confirm(
          `Crédit Mutuel : ${unique.length} transaction(s) à importer (doublons ignorés : ${skipped}).\n\nContinuer ?`
        );
        if (!ok) return;

        onImport(unique);
        alert("Import Crédit Mutuel terminé ✅");
      } catch (e) {
        console.error(e);
        alert("Erreur inattendue pendant l'import Crédit Mutuel.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Export CSV */}
      <div style={styles.card}>
        <div style={styles.h2}>Export</div>
        <button onClick={exportCSV} style={styles.btn} type="button">
          Exporter CSV (tout l'historique)
        </button>
        <div style={styles.hint}>Exporte toutes les opérations au format CSV.</div>
      </div>

      {/* Import CSV */}
      <div style={styles.card}>
        <div style={styles.h2}>Importer CSV</div>

        <div style={styles.selects}>
          <label style={styles.label}>
            Banque par défaut
            <select value={csvBank} onChange={(e) => setCsvBank(e.target.value)} style={styles.input}>
              {(banks || ["Physique"]).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Type de compte par défaut
            <select value={csvAccountType} onChange={(e) => setCsvAccountType(e.target.value)} style={styles.input}>
              {(accountTypes || ["Compte courant"]).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>

        <label style={styles.btnSecondary}>
          Importer CSV
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCSVFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <div style={styles.hint}>Importe un fichier CSV exporté depuis cette application.</div>
      </div>

      {/* Import Crédit Mutuel */}
      <div style={styles.card}>
        <div style={styles.h2}>Importer Crédit Mutuel (Excel)</div>

        <div style={styles.selects}>
          <label style={styles.label}>
            Banque (import)
            <select value={cmBank} onChange={(e) => setCmBank(e.target.value)} style={styles.input}>
              {(banks || ["Crédit Mutuel"]).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Type de compte (import)
            <select value={cmAccountType} onChange={(e) => setCmAccountType(e.target.value)} style={styles.input}>
              {(accountTypes || ["Compte courant"]).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Catégorie par défaut
            <select value={cmDefaultCategory} onChange={(e) => setCmDefaultCategory(e.target.value)} style={styles.input}>
              {(categories || ["Autres"]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        <label style={styles.btnSecondary}>
          Importer Crédit Mutuel (Excel)
          <input
            type="file"
            accept=".xls,.xlsx,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCreditMutuelFile(f);
              e.target.value = "";
            }}
          />
        </label>

        {cmLastInfo ? <div style={{ ...styles.hint, marginTop: 8 }}>{cmLastInfo}</div> : null}
      </div>
    </div>
  );
}

const styles = {
  card: {
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "white",
    display: "grid",
    gap: 12,
  },
  h2: { fontSize: 16, fontWeight: 900 },
  selects: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  label: { display: "grid", gap: 6, fontWeight: 700, fontSize: 12, color: "#111827" },
  input: { padding: "12px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 15 },
  btn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    width: "fit-content",
  },
  btnSecondary: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "white",
    fontWeight: 800,
    cursor: "pointer",
    width: "fit-content",
  },
  hint: { color: "#6b7280", fontSize: 12 },
};

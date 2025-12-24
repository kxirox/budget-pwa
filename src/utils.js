export function formatEUR(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0 €";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export function toISODate(d) {
  // d: Date
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function currentMonthKey(dateISO) {
  // "YYYY-MM"
  return String(dateISO).slice(0, 7);
}

export function monthLabelFR(monthKey) {
  // monthKey: YYYY-MM
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function escapeCSV(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(expenses) {
  const header = ["date", "montant", "categorie", "banque", "type_compte", "note"];
  const lines = [header.join(",")];
  for (const e of expenses) {
    lines.push([
      escapeCSV(e.date),
      escapeCSV(e.amount),
      escapeCSV(e.category),
      escapeCSV(e.bank ?? ""),
      escapeCSV(e.accountType ?? ""),
      escapeCSV(e.note ?? "")
    ].join(","));
}
  return lines.join("\n");
}

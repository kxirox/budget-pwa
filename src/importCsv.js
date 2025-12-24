import { uid, DEFAULT_BANKS, DEFAULT_ACCOUNT_TYPES } from "./storage";

/**
 * Parse CSV (simple) : séparateur virgule OU point-virgule.
 * Gère les valeurs entre guillemets.
 */
function splitLine(line, sep) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // double quote escape
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === sep) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function detectSeparator(text) {
  // heuristique : si la première ligne a plus de ; que de , => ;
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) ?? "";
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseAmount(v) {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  // accepte "12,50" ou "12.50"
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return n;
}

function pick(map, ...keys) {
  for (const k of keys) {
    if (k in map) return map[k];
  }
  return "";
}

export function parseExpensesCSV(text, { defaultBank, defaultAccountType } = {}) {
  const sep = detectSeparator(text);
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], errors: ["CSV vide ou incomplet."] };

  const headers = splitLine(lines[0], sep).map(normalizeHeader);
  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], sep);
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));

    const date = pick(obj, "date", "jour");
    const amountRaw = pick(obj, "montant", "amount", "prix", "valeur");
    const category = pick(obj, "categorie", "category", "cat");
    const note = pick(obj, "note", "libelle", "description");
    const bank = pick(obj, "banque", "bank") || defaultBank || "Physique";
    const accountType =
      pick(obj, "type_compte", "type_de_compte", "accounttype", "account_type") ||
      defaultAccountType ||
      "Compte courant";

    const raw = parseAmount(amountRaw); // peut être négatif
    const kind = raw >= 0 ? "income" : "expense";
    const amount = Math.abs(raw);





    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Ligne ${i + 1}: date invalide "${date}" (attendu YYYY-MM-DD).`);
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Ligne ${i + 1}: montant invalide "${amountRaw}".`);
      continue;
    }
    if (!category) {
      errors.push(`Ligne ${i + 1}: catégorie manquante.`);
      continue;
    }

    // on accepte les banques/types même si nouveaux, mais on garde des valeurs par défaut si vide
    const cleanBank = String(bank || "").trim() || "Physique";
    const cleanType = String(accountType || "").trim() || "Compte courant";

    rows.push({
      id: uid(),
      date,
      kind,
      amount: Math.round(amount * 100) / 100,
      category: String(category).trim(),
      bank: cleanBank,
      accountType: cleanType,
      note: String(note || "").trim()
    });

  }

  return { rows, errors };
}

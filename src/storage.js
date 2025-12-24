const EXPENSES_KEY = "budget_pwa_expenses_v1";
const CATEGORIES_KEY = "budget_pwa_categories_v1";

export const DEFAULT_CATEGORIES = [
  "Alimentation",
  "Transport",
  "Logement",
  "Loisirs",
  "Abonnements",
  "Santé",
  "Épargne",
  "Autres"
];

export const DEFAULT_BANKS = [
  "BCGE",
  "Crédit Mutuel",
  "Revolut",
  "Degiro",
  "Boursobank",
  "Physique"
];

export const DEFAULT_ACCOUNT_TYPES = [
  "Compte courant",
  "Compte commun",
  "PEA",
  "CTO",
  "Livret A",
  "Livret Orange"
];


function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadCategories() {
  const raw = localStorage.getItem(CATEGORIES_KEY);
  const cats = raw ? safeParse(raw, DEFAULT_CATEGORIES) : DEFAULT_CATEGORIES;
  if (!Array.isArray(cats) || cats.length === 0) return DEFAULT_CATEGORIES;
  return cats.map(String);
}

export function saveCategories(categories) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export function loadExpenses() {
  const raw = localStorage.getItem(EXPENSES_KEY);
  const expenses = raw ? safeParse(raw, []) : [];
  if (!Array.isArray(expenses)) return [];
  return expenses.map(e => {
    let amount = Number(e.amount || 0);
    let kind = e.kind;

    // Migration : si pas de "kind" (anciennes données)
    if (!kind) {
      kind = amount >= 0 ? "income" : "expense";
      amount = Math.abs(amount);
    } else {
      // On force le stockage interne en montant positif
      amount = Math.abs(amount);
    }

    return {
      ...e,
      kind,
      amount,
      bank: e.bank ?? "Physique",
      accountType: e.accountType ?? "Compte courant"
  };
});





}

export function saveExpenses(expenses) {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
}

export function uid() {
  // Simple id unique
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

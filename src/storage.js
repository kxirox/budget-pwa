const EXPENSES_KEY = "budget_pwa_expenses_v1";
const CATEGORIES_KEY = "budget_pwa_categories_v1";
const KEY_CATEGORY_COLORS = "budget.categoryColors.v1";
const KEY_PEOPLE = "budget.people.v1";
const KEY_AUTOCAT_RULES = "budget.autocatRules.v1";
// { [categoryName]: string[] }
// Exemple: { "Transport": ["Train", "Essence"] }
const KEY_SUBCATEGORIES = "budget.subcategories.v1";

const KEY_BANKS = "budgetpwa_banks";
const KEY_ACCOUNT_TYPES = "budgetpwa_account_types";
const KEY_ACCOUNT_CURRENCIES = "budget.accountCurrencies.v1";
const KEY_EXCHANGE_RATES = "budget.exchangeRates.v1";
const KEY_ACCOUNT_CONTRIB_RATES = "budget.accountContribRates.v1";

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadBanks(expenses = []) {
  const fromLS = safeParse(localStorage.getItem(KEY_BANKS), null);
  if (Array.isArray(fromLS) && fromLS.length) return fromLS;

  // fallback: déduire depuis l’historique (évite une liste vide)
  const derived = Array.from(
    new Set(expenses.map((e) => (e.bank || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return derived;
}

export function saveBanks(banks) {
  const cleaned = Array.from(
    new Set((banks || []).map((s) => String(s || "").trim()).filter(Boolean))
  );
  localStorage.setItem(KEY_BANKS, JSON.stringify(cleaned));
}

export function loadAccountTypes(expenses = []) {
  const fromLS = safeParse(localStorage.getItem(KEY_ACCOUNT_TYPES), null);
  if (Array.isArray(fromLS) && fromLS.length) return fromLS;

  const derived = Array.from(
    new Set(expenses.map((e) => (e.accountType || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return derived;
}

export function saveAccountTypes(types) {
  const cleaned = Array.from(
    new Set((types || []).map((s) => String(s || "").trim()).filter(Boolean))
  );
  localStorage.setItem(KEY_ACCOUNT_TYPES, JSON.stringify(cleaned));
}



export function loadCategoryColors() {
  try {
    const raw = localStorage.getItem(KEY_CATEGORY_COLORS);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export function saveCategoryColors(map) {
  try {
    localStorage.setItem(KEY_CATEGORY_COLORS, JSON.stringify(map || {}));
  } catch {}
}

// ---------------------------
// Devises par compte (banque + type de compte)
// Clé composite : "banque||typeCompte"
// Valeur : "EUR" | "CHF" | "USD" | ...
// Absent = EUR par défaut
// ---------------------------
export function loadAccountCurrencies() {
  try {
    const raw = localStorage.getItem(KEY_ACCOUNT_CURRENCIES);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export function saveAccountCurrencies(map) {
  try {
    localStorage.setItem(KEY_ACCOUNT_CURRENCIES, JSON.stringify(map || {}));
  } catch {}
}

/**
 * Retourne la devise d'un compte (banque + type).
 * "EUR" si la paire n'est pas configurée.
 */
export function getAccountCurrency(accountCurrencies, bank, accountType) {
  if (!accountCurrencies) return "EUR";
  const key = `${bank}||${accountType}`;
  return accountCurrencies[key] || "EUR";
}

// ---------------------------
// Taux de contribution par compte (banque + type de compte)
// Clé composite : "banque||typeCompte"
// Valeur : decimal entre 0 (exclu) et 1 (inclus) — ex: 0.5 = 50%
// Absent = 1.0 (100%) par défaut
// ---------------------------
export function loadAccountContribRates() {
  try {
    const raw = localStorage.getItem(KEY_ACCOUNT_CONTRIB_RATES);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export function saveAccountContribRates(map) {
  try {
    localStorage.setItem(KEY_ACCOUNT_CONTRIB_RATES, JSON.stringify(map || {}));
  } catch {}
}

/**
 * Retourne le taux de contribution pour un compte (banque + type).
 * Retourne 1.0 (100%) si la paire n'est pas configurée.
 * La valeur est un decimal : 0.5 = 50%, 1.0 = 100%.
 */
export function getContribRate(accountContribRates, bank, accountType) {
  if (!accountContribRates) return 1.0;
  const key = `${bank}||${accountType}`;
  const v = accountContribRates[key];
  if (v === undefined || v === null) return 1.0;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 1.0;
}

// ---------------------------
// Taux de change vers EUR
// Format : { "CHF_EUR": 0.9512, "EUR_CHF": 1.0512 }
// Convention : 1 unitéSource = X EUR
// ---------------------------
export function loadExchangeRates() {
  try {
    const raw = localStorage.getItem(KEY_EXCHANGE_RATES);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export function saveExchangeRates(rates) {
  try {
    localStorage.setItem(KEY_EXCHANGE_RATES, JSON.stringify(rates || {}));
  } catch {}
}

/**
 * Convertit un montant vers EUR.
 * Si la devise est EUR ou si le taux est inconnu → retourne le montant tel quel (fallback safe).
 */
export function toEUR(amount, currency, exchangeRates) {
  if (!currency || currency === "EUR") return amount;
  const rate = exchangeRates?.[`${currency}_EUR`];
  if (!rate || !Number.isFinite(rate)) return amount;
  return amount * rate;
}




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
      person: typeof e.person === "string" ? e.person : (e.person == null ? "" : String(e.person)),
      bank: e.bank ?? "Physique",
      accountType: e.accountType ?? "Compte courant",
      // Nouveau champ optionnel (rétro-compatible)
      subcategory: typeof e.subcategory === "string" ? e.subcategory : (e.subcategory == null ? "" : String(e.subcategory)),
      contributor: ["me", "partner", "external"].includes(e.contributor) ? e.contributor : "external",
  };
});





}

export function loadSubcategories() {
  try {
    const raw = localStorage.getItem(KEY_SUBCATEGORIES);
    const obj = raw ? JSON.parse(raw) : {};
    if (!obj || typeof obj !== "object") return {};

    const out = {};
    for (const [cat, arr] of Object.entries(obj)) {
      if (!Array.isArray(arr)) continue;
      const cleanCat = String(cat || "").trim();
      if (!cleanCat) continue;
      const cleanArr = Array.from(
        new Set(arr.map((s) => String(s || "").trim()).filter(Boolean))
      );
      out[cleanCat] = cleanArr;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveSubcategories(map) {
  try {
    const obj = map && typeof map === "object" ? map : {};
    localStorage.setItem(KEY_SUBCATEGORIES, JSON.stringify(obj));
  } catch {}
}

export function loadPeople() {
  try {
    const raw = localStorage.getItem(KEY_PEOPLE);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return Array.from(new Set(arr.map(p => String(p).trim()).filter(Boolean)));
  } catch {
    return [];
  }
}

export function savePeople(people) {
  try {
    const list = Array.isArray(people) ? people : [];
    const clean = Array.from(new Set(list.map(p => String(p).trim()).filter(Boolean)));
    localStorage.setItem(KEY_PEOPLE, JSON.stringify(clean));
  } catch {}
}


export function loadAutoCatRules() {
  try {
    const raw = localStorage.getItem(KEY_AUTOCAT_RULES);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    // Normalisation + validation légère
    return list
      .map((r) => ({
        id: String(r?.id || ""),
        keyword: String(r?.keyword || "").trim(),
        category: String(r?.category || "").trim(),
        enabled: r?.enabled !== false,
        matchMode: r?.matchMode === "word" ? "word" : "contains",
      }))
      .filter((r) => r.id && r.keyword && r.category);
  } catch {
    return [];
  }
}

export function saveAutoCatRules(rules) {
  try {
    const clean = Array.isArray(rules) ? rules : [];
    localStorage.setItem(KEY_AUTOCAT_RULES, JSON.stringify(clean));
  } catch {}
}


export function saveExpenses(expenses) {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
}

export function uid() {
  // Simple id unique
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}






const KEY_RECURRING = "budget.recurring.v1";

export function loadRecurring() {
  try {
    const raw = localStorage.getItem(KEY_RECURRING);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveRecurring(list) {
  try {
    localStorage.setItem(KEY_RECURRING, JSON.stringify(Array.isArray(list) ? list : []));
  } catch {}
}

// ---------------------------
// Prévisionnel (Budget forecast)
// ---------------------------
const KEY_FORECAST_ITEMS = "budget.forecast.items.v1";
const KEY_FORECAST_SETTINGS = "budget.forecast.settings.v1";

export function loadForecastItems() {
  try {
    const raw = localStorage.getItem(KEY_FORECAST_ITEMS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveForecastItems(list) {
  try {
    localStorage.setItem(KEY_FORECAST_ITEMS, JSON.stringify(Array.isArray(list) ? list : []));
  } catch {}
}

export function loadForecastSettings() {
  try {
    const raw = localStorage.getItem(KEY_FORECAST_SETTINGS);
    const obj = raw ? JSON.parse(raw) : null;
    if (!obj || typeof obj !== "object") return { alertThreshold: 0, includeCertainty: ["certain", "probable", "optional"] };
    const alertThreshold = Number(obj.alertThreshold ?? 0);
    const includeCertainty = Array.isArray(obj.includeCertainty) ? obj.includeCertainty : ["certain", "probable", "optional"];
    return { alertThreshold: Number.isFinite(alertThreshold) ? alertThreshold : 0, includeCertainty };
  } catch {
    return { alertThreshold: 0, includeCertainty: ["certain", "probable", "optional"] };
  }
}

export function saveForecastSettings(settings) {
  try {
    localStorage.setItem(KEY_FORECAST_SETTINGS, JSON.stringify(settings || {}));
  } catch {}
}


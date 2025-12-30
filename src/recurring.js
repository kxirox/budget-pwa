import { uid } from "./storage";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysInMonth(year, month1to12) {
  return new Date(year, month1to12, 0).getDate();
}

function addDays(dateISO, days) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function addMonthsKeepingDay(dateISO, monthsToAdd, dayOfMonth) {
  const [y, m] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  dt.setMonth(dt.getMonth() + monthsToAdd);

  const year = dt.getFullYear();
  const month1to12 = dt.getMonth() + 1;

  const dim = daysInMonth(year, month1to12);
  const day = Math.min(dayOfMonth, dim); // si 31 et mois à 30 jours => 30 ; si février => 28/29
  const out = new Date(year, month1to12 - 1, day);
  return out.toISOString().slice(0, 10);
}

function computeFirstMonthly(startDate, dayOfMonth) {
  const [y, m, d] = startDate.split("-").map(Number);
  const dim = daysInMonth(y, m);
  const day = Math.min(dayOfMonth, dim);
  const candidate = new Date(y, m - 1, day).toISOString().slice(0, 10);
  // si la date du mois courant est déjà passée, on passe au mois suivant
  return candidate >= startDate ? candidate : addMonthsKeepingDay(startDate, 1, dayOfMonth);
}

function computeFirstInterval(startDate, intervalDays) {
  // première occurrence = startDate (tu peux aussi choisir startDate+interval, mais ici c'est clair)
  return startDate;
}

/**
 * Applique les règles récurrentes:
 * - génère toutes les occurrences "due" jusqu'à aujourd'hui
 * - évite les doublons grâce à recurringId + date
 * Retourne { nextExpenses, nextRules, addedCount }
 */
export function applyRecurring(rules, expenses, nowISO = todayISO()) {
  let nextExpenses = expenses.slice();
  let nextRules = rules.map(r => ({ ...r }));
  let addedCount = 0;

  // index anti-doublon (recurringId|date)
  const seen = new Set(
    nextExpenses
      .filter(e => e.recurringId && e.date)
      .map(e => `${e.recurringId}|${e.date}`)
  );

  for (let i = 0; i < nextRules.length; i++) {
    const r = nextRules[i];
    if (!r.active) continue;

    // s'assurer que nextDate existe
    if (!r.nextDate) {
      if (r.schedule?.type === "monthly") {
        r.nextDate = computeFirstMonthly(r.startDate || nowISO, r.schedule.dayOfMonth || 1);
      } else if (r.schedule?.type === "interval") {
        r.nextDate = computeFirstInterval(r.startDate || nowISO, r.schedule.intervalDays || 14);
      } else {
        continue;
      }
    }

    let safety = 0;
    while (r.nextDate && r.nextDate <= nowISO && safety < 300) {
      safety++;

      const key = `${r.id}|${r.nextDate}`;
      if (!seen.has(key)) {
        const e = {
          id: uid(),
          recurringId: r.id,
          kind: r.kind || "expense",
          amount: Math.abs(Number(r.amount || 0)),
          category: String(r.category || "Autres").trim() || "Autres",
          bank: String(r.bank || "Physique").trim() || "Physique",
          accountType: String(r.accountType || "Compte courant").trim() || "Compte courant",
          date: r.nextDate,
          note: String(r.note || "").trim()
        };
        nextExpenses = [e, ...nextExpenses];
        seen.add(key);
        addedCount++;
      }

      // calcule la prochaine occurrence
      if (r.schedule.type === "monthly") {
        const day = Number(r.schedule.dayOfMonth || 1);
        const step = Number(r.schedule.intervalMonths || 1);
        r.nextDate = addMonthsKeepingDay(r.nextDate, step, day);
      } else if (r.schedule.type === "interval") {
        const step = Number(r.schedule.intervalDays || 14);
        r.nextDate = addDays(r.nextDate, step);
      } else {
        break;
      }
    }
  }

  return { nextExpenses, nextRules, addedCount };
}

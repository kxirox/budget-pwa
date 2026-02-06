/**
 * Système de persistance des filtres dans le localStorage
 * Permet de sauvegarder et restaurer l'état des filtres pour chaque composant
 */

const FILTER_PREFIX = "budget_filters_";

/**
 * Sauvegarde les filtres d'un composant dans le localStorage
 * @param {string} componentName - Nom du composant (ex: "history", "stats")
 * @param {object} filters - Objet contenant tous les filtres à sauvegarder
 */
export function saveFilters(componentName, filters) {
  try {
    const key = `${FILTER_PREFIX}${componentName}`;
    localStorage.setItem(key, JSON.stringify(filters));
  } catch (err) {
    console.warn(`Impossible de sauvegarder les filtres pour ${componentName}:`, err);
  }
}

/**
 * Charge les filtres d'un composant depuis le localStorage
 * @param {string} componentName - Nom du composant (ex: "history", "stats")
 * @param {object} defaultFilters - Filtres par défaut si rien n'est sauvegardé
 * @returns {object} Les filtres restaurés ou les filtres par défaut
 */
export function loadFilters(componentName, defaultFilters = {}) {
  try {
    const key = `${FILTER_PREFIX}${componentName}`;
    const saved = localStorage.getItem(key);
    
    if (!saved) {
      return defaultFilters;
    }
    
    const parsed = JSON.parse(saved);
    
    // Merge avec les defaults pour gérer les nouveaux champs ajoutés après coup
    return { ...defaultFilters, ...parsed };
  } catch (err) {
    console.warn(`Impossible de charger les filtres pour ${componentName}:`, err);
    return defaultFilters;
  }
}

/**
 * Réinitialise les filtres d'un composant
 * @param {string} componentName - Nom du composant (ex: "history", "stats")
 */
export function clearFilters(componentName) {
  try {
    const key = `${FILTER_PREFIX}${componentName}`;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`Impossible de supprimer les filtres pour ${componentName}:`, err);
  }
}

/**
 * Réinitialise tous les filtres de l'application
 */
export function clearAllFilters() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(FILTER_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.warn("Impossible de supprimer tous les filtres:", err);
  }
}

export function buildBackupPayload({
  expenses,
  categories,
  banks,
  accountTypes,
  people,
  recurring,
  categoryColors,
  subcategories,
  autoCatRules,
  forecastItems,
  forecastSettings,
}) {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    data: {
      expenses,
      categories,
      banks,
      accountTypes,
      people,
      recurring,
      categoryColors,
      subcategories,
      autoCatRules,
      forecastItems,
      forecastSettings,
    },
  };
}

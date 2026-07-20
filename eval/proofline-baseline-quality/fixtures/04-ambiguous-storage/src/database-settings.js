export function createDatabaseSettings(database) {
  return {
    async load(accountId) {
      return database.settings.findUnique({ where: { accountId } });
    },
    async save(accountId, settings) {
      return database.settings.upsert({
        where: { accountId },
        create: { accountId, value: settings },
        update: { value: settings },
      });
    },
  };
}

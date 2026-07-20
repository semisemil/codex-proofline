export function createLocalJsonSettings(fileSystem, path) {
  return {
    load() {
      return JSON.parse(fileSystem.readFileSync(path, 'utf8'));
    },
    save(settings) {
      fileSystem.writeFileSync(path, JSON.stringify(settings, null, 2));
    },
  };
}

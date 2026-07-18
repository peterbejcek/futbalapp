// Metro konfigurácia pre pnpm monorepo (Expo SDK 54 + expo-router).
// Bez nej Expo nevie nájsť expo-router/entry a spadne na expo/AppEntry.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. sleduj celý monorepo (kvôli @fkknv/shared)
config.watchFolders = [monorepoRoot];

// 2. hľadaj balíky v app aj v koreňovom node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. pnpm ukladá balíky do .pnpm cez symlinky — Metro ich musí nasledovať
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = false;

module.exports = config;

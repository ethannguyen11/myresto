const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

// Fix expo-router dans un monorepo npm workspaces
// Doit être défini AVANT getDefaultConfig (chemin relatif)
process.env.EXPO_ROUTER_APP_ROOT = './app';

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Surveiller tout le monorepo
config.watchFolders = [monorepoRoot];

// Résolution des modules : chercher d'abord dans apps/mobile, puis à la racine
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Désactiver la recherche hiérarchique pour éviter les doublons de packages
config.resolver.disableHierarchicalLookup = true;

// Déclarer explicitement les plateformes pour que Metro résolve les fichiers
// .web.js, .native.js, etc. correctement même dans le contexte monorepo.
config.resolver.platforms = ['ios', 'android', 'web', 'native'];

// react-native-reanimated et react-native-worklets ont des variantes .web.js pour leurs
// modules internes, mais Metro ne les résout pas automatiquement dans notre config monorepo.
// On force la résolution .web.js pour tout import relatif à l'intérieur de ces packages.
// Debug: logger tous les imports depuis reanimated/worklets
const _debugLog = fs.createWriteStream(path.join(projectRoot, '.metro-resolver-debug.txt'));
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath || '';
  if (
    platform === 'web' &&
    (origin.includes('react-native-reanimated') || origin.includes('react-native-worklets'))
  ) {
    _debugLog.write(`"${moduleName}" from ...${origin.split('react-native-re')[1] || origin.split('react-native-wo')[1]}\n`);
  }
  if (
    platform === 'web' &&
    (origin.includes('react-native-reanimated') || origin.includes('react-native-worklets')) &&
    (moduleName.startsWith('./') || moduleName.startsWith('../'))
  ) {
    const dir = path.dirname(origin);
    const nameNoExt = moduleName.replace(/\.(js|ts|jsx|tsx)$/, '');
    const webFilePath = path.resolve(dir, nameNoExt + '.web.js');
    if (fs.existsSync(webFilePath)) {
      _debugLog.write(`  → REDIRECTED to ${webFilePath.split('ReanimatedModule')[1] || webFilePath}\n`);
      return { type: 'sourceFile', filePath: webFilePath };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

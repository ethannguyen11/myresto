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

// Force react and react-dom to resolve from the same location so Metro never
// loads two different copies (which would trigger React's "two React copies" error).
const reactPath = fs.existsSync(path.resolve(projectRoot, 'node_modules/react'))
  ? path.resolve(projectRoot, 'node_modules/react')
  : path.resolve(monorepoRoot, 'node_modules/react');
const reactDomPath = fs.existsSync(path.resolve(projectRoot, 'node_modules/react-dom'))
  ? path.resolve(projectRoot, 'node_modules/react-dom')
  : path.resolve(monorepoRoot, 'node_modules/react-dom');

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react': reactPath,
  'react-dom': reactDomPath,
};

// Déclarer explicitement les plateformes pour que Metro résolve les fichiers
// .web.js, .native.js, etc. correctement même dans le contexte monorepo.
config.resolver.platforms = ['ios', 'android', 'web', 'native'];

// react-native-reanimated et react-native-worklets ont des variantes .web.js pour leurs
// modules internes, mais Metro ne les résout pas automatiquement dans notre config monorepo.
// On force la résolution .web.js pour tout import relatif à l'intérieur de ces packages.
// Debug: logger tous les imports depuis reanimated/worklets
const _debugLog = fs.createWriteStream(path.join(projectRoot, '.metro-resolver-debug.txt'));
// Stub path for native-only modules on web
const WEB_STUB = path.resolve(projectRoot, 'src/stubs/native-module-stub.js');

// pretty-format@30 ships both index.js (CJS/ESM hybrid) and index.mjs.
// Metro resolves to index.mjs on web, but the mjs wrapper does
// `var _default = cjsModule.default.default` — fn.default is undefined because
// index.js exports { __esModule:true, default:fn } (fn has no .default).
// The Metro HMR client then crashes with "Cannot read properties of undefined
// (reading 'default')".  Fix: always resolve pretty-format to index.js on web.
const PRETTY_FORMAT_CJS = path.resolve(monorepoRoot, 'node_modules/pretty-format/build/index.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Redirect pretty-format away from its broken .mjs wrapper
    if (moduleName === 'pretty-format') {
      return { type: 'sourceFile', filePath: PRETTY_FORMAT_CJS };
    }

    // Stub out native-only packages on web to prevent "undefined default" errors
    const nativeOnly = ['expo-camera', 'expo-image-picker', 'expo-haptics', 'expo-symbols'];
    if (nativeOnly.includes(moduleName)) {
      return { type: 'sourceFile', filePath: WEB_STUB };
    }

    // AsyncStorage: use localStorage-backed stub on web
    if (moduleName === '@react-native-async-storage/async-storage') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(projectRoot, 'src/stubs/async-storage-stub.js'),
      };
    }
  }

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

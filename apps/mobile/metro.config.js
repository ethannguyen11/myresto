const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

// Fix expo-router dans un monorepo npm workspaces
// Doit être défini AVANT getDefaultConfig (chemin relatif)
process.env.EXPO_ROUTER_APP_ROOT = './app';

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Surveiller tout le monorepo (étend les defaults au lieu de les remplacer)
config.watchFolders = [...(config.watchFolders ?? []), monorepoRoot];

// Résolution des modules : chercher d'abord dans apps/mobile, puis à la racine
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

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

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

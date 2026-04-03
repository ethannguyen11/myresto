const path = require('path');

const projectRoot = __dirname;
const appRoot = path.join(projectRoot, 'app');
const appRootPosix = appRoot.split(path.sep).join('/');

/**
 * Babel plugin that replaces expo-router env vars with literal values.
 * Needed in npm workspaces monorepos where Metro's caller mechanism doesn't
 * reliably pass routerRoot/asyncRoutes to babel-preset-expo.
 * Runs BEFORE babel-preset-expo to guarantee replacement.
 */
function expoRouterMonorepoFix({ types: t }) {
  return {
    name: 'expo-router-monorepo-fix',
    visitor: {
      MemberExpression(nodePath, state) {
        // Only match process.env.<KEY>
        if (
          !t.isMemberExpression(nodePath.node.object) ||
          !t.isIdentifier(nodePath.node.object.object, { name: 'process' }) ||
          !t.isIdentifier(nodePath.node.object.property, { name: 'env' })
        ) {
          return;
        }

        const prop = nodePath.node.property;
        if (!t.isIdentifier(prop)) return;
        const key = prop.name;

        if (key === 'EXPO_ROUTER_APP_ROOT') {
          const filename = state.file.opts.filename;
          if (filename) {
            const rel = path.relative(path.dirname(filename), appRoot);
            const posixRel = rel.split(path.sep).join('/');
            nodePath.replaceWith(t.stringLiteral(posixRel));
          }
        } else if (key === 'EXPO_ROUTER_ABS_APP_ROOT') {
          nodePath.replaceWith(t.stringLiteral(appRootPosix));
        } else if (key === 'EXPO_ROUTER_IMPORT_MODE') {
          // 'lazy' for async routes (web dev), 'sync' otherwise
          nodePath.replaceWith(t.stringLiteral('sync'));
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    plugins: [expoRouterMonorepoFix],
    presets: ['babel-preset-expo'],
  };
};

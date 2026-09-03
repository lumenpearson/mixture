// Metro for a pnpm workspace: the app imports `@mixture/protocol` and
// `@screenkit/core` straight from their TypeScript sources, so metro has to
// watch the repository root, look for modules in both node_modules trees and
// honour the packages' `exports` maps (that is where the `./library` and
// `./cloud` subpaths live).
const { getDefaultConfig } = require("expo/metro-config")
const path = require("node:path")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "../..")

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]
// `@mixture/protocol` publishes its bindings behind `exports` subpaths
// (./library, ./cloud); without this they do not resolve
config.resolver.unstable_enablePackageExports = true

// the workspace packages ship .ts/.tsx, not compiled js
for (const ext of ["ts", "tsx"]) {
  if (!config.resolver.sourceExts.includes(ext)) config.resolver.sourceExts.push(ext)
}

module.exports = config

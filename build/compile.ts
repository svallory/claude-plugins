/**
 * Compiles canonical plugin sources (src/plugins/<name>/, marketplace.yaml,
 * *.jig templates) into per-platform distributable trees.
 *
 *   bun run build           # regenerate every dist tree + the root catalog
 *   bun run build:check     # verify committed outputs are fresh (CI)
 *
 * For every platform in build/platforms/<id>.yaml the build owns
 * dist/<id>/ entirely: it is wiped and regenerated from src/, so no stale
 * output can survive. Each plugin lands at dist/<id>/plugins/<name>/ with its
 * *.jig files rendered (extension stripped, `{ platform, plugin }` scope) and
 * everything else copied verbatim, plus the platform's plugin manifest:
 *
 *   claude — .claude-plugin/plugin.json. The Claude catalog stays at the repo
 *            root (.claude-plugin/marketplace.json, a Claude requirement) and
 *            points local plugins at ./dist/claude/plugins/<name>.
 *   kimi   — kimi.plugin.json, plus a dist/kimi/marketplace.json catalog.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { parse as parseYaml } from 'yaml'
import edge from '@jig-lang/jig'

edge.registerFilter('json', (value: unknown) => JSON.stringify(value))

const ROOT = join(import.meta.dir, '..')
const BUILD = import.meta.dir
const SRC = join(ROOT, 'src', 'plugins')
const DIST = join(ROOT, 'dist')
const CHECK = process.argv.includes('--check')

edge.mount(join(BUILD, 'templates'))

const readYaml = (path: string) => parseYaml(readFileSync(path, 'utf8'))

const marketplace = readYaml(join(ROOT, 'marketplace.yaml'))
const platforms: Record<string, Record<string, any>> = {}
for (const file of readdirSync(join(BUILD, 'platforms')).sort()) {
  if (file.endsWith('.yaml')) {
    platforms[file.slice(0, -'.yaml'.length)] = readYaml(join(BUILD, 'platforms', file))
  }
}

const pluginNames = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(SRC, d.name, 'plugin.yaml')))
  .map((d) => d.name)
  .sort()
const plugins = Object.fromEntries(pluginNames.map((name) => [name, readYaml(join(SRC, name, 'plugin.yaml'))]))

const COMPONENT_DIRS = ['skills', 'agents', 'commands']
const componentsOf = (pluginDir: string) =>
  COMPONENT_DIRS.filter((c) => existsSync(join(pluginDir, c))).map((c) => ({
    key: c,
    value: `./${c}/`,
  }))

// Never shipped: the canonical metadata (compiled into manifests instead),
// dependency/VCS dirs, and local Python/OS junk that .gitignore already hides.
const SKIP_NAMES = new Set(['plugin.yaml', 'node_modules', '.git', '.venv', '__pycache__', '.DS_Store'])
const SKIP_EXTS = ['.pyc']

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP_NAMES.has(entry.name) || SKIP_EXTS.some((ext) => entry.name.endsWith(ext))) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (entry.isFile()) yield path
  }
}

// --- Render everything in memory: absolute path -> { content, mode } ---

type Output = { content: Buffer; mode: number }
const outputs = new Map<string, Output>()

function add(path: string, content: string | Buffer, { json = false, mode = 0o644 } = {}) {
  if (outputs.has(path)) {
    console.error(`two sources produce ${relative(ROOT, path)} (a file next to its own .jig template?)`)
    process.exit(1)
  }
  let data: Buffer
  if (typeof content === 'string') {
    let text = content.trimEnd() + '\n'
    if (json) {
      try {
        // Parse and re-print: templates control data, not whitespace.
        text = JSON.stringify(JSON.parse(content), null, 2) + '\n'
      } catch (error) {
        console.error(`INVALID JSON rendered for ${relative(ROOT, path)}: ${error}`)
        process.exit(1)
      }
    }
    data = Buffer.from(text)
  } else {
    data = content
  }
  outputs.set(path, { content: data, mode })
}

// Platform-specific plugin manifests and catalogs.
const MANIFESTS: Record<string, { path: string; template: string }> = {
  claude: { path: join('.claude-plugin', 'plugin.json'), template: 'claude-plugin.jig' },
  kimi: { path: 'kimi.plugin.json', template: 'kimi-plugin.jig' },
}
const CATALOGS: Record<string, string> = { kimi: 'kimi-marketplace.jig' }

for (const [platformId, platform] of Object.entries(platforms)) {
  const manifest = MANIFESTS[platformId]
  if (!manifest) {
    console.error(`no manifest defined for platform "${platformId}" in build/compile.ts`)
    process.exit(1)
  }

  for (const name of pluginNames) {
    const pluginDir = join(SRC, name)
    const plugin = plugins[name]
    const outDir = join(DIST, platformId, 'plugins', name)

    for (const file of walk(pluginDir)) {
      const rel = relative(pluginDir, file)
      if (file.endsWith('.jig')) {
        const rendered = edge.renderRawSync(readFileSync(file, 'utf8'), { platform, plugin }, file)
        add(join(outDir, rel.slice(0, -'.jig'.length)), rendered)
      } else {
        const executable = statSync(file).mode & 0o111
        add(join(outDir, rel), readFileSync(file), { mode: executable ? 0o755 : 0o644 })
      }
    }

    add(join(outDir, manifest.path), edge.renderSync(manifest.template, { plugin, components: componentsOf(pluginDir) }), {
      json: true,
    })
  }

  const catalog = CATALOGS[platformId]
  if (catalog) {
    add(join(DIST, platformId, 'marketplace.json'), edge.renderSync(catalog, { plugins: pluginNames.map((n) => plugins[n]) }), {
      json: true,
    })
  }
}

const marketplaceEntries = [
  ...pluginNames.map((n) => ({ name: plugins[n].name, description: plugins[n].description, external: false })),
  ...(marketplace.external ?? []).map((entry: Record<string, any>) => ({ ...entry, external: true })),
]
const ROOT_CATALOG = join(ROOT, '.claude-plugin', 'marketplace.json')
add(
  ROOT_CATALOG,
  edge.renderSync('marketplace.jig', { marketplace, plugins: marketplaceEntries, sourcePrefix: './dist/claude/plugins' }),
  { json: true },
)

// --- Check or write ---

const ownedDirs = Object.keys(platforms).map((id) => join(DIST, id))

function* filesUnder(dir: string): Generator<string> {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* filesUnder(path)
    else yield path
  }
}

if (CHECK) {
  const stale: string[] = []
  for (const [path, { content, mode }] of outputs) {
    const label = relative(ROOT, path)
    if (!existsSync(path)) stale.push(`missing     ${label}`)
    else if (!readFileSync(path).equals(content)) stale.push(`outdated    ${label}`)
    else if ((statSync(path).mode & 0o111) !== (mode & 0o111)) stale.push(`mode        ${label}`)
  }
  for (const dir of ownedDirs) {
    for (const path of filesUnder(dir)) {
      if (!outputs.has(path)) stale.push(`unexpected  ${relative(ROOT, path)}`)
    }
  }
  if (stale.length) {
    console.error(`stale generated files (run \`bun run build\`):\n  ${stale.sort().join('\n  ')}`)
    process.exit(1)
  }
  console.log(`all ${outputs.size} generated files up to date`)
} else {
  for (const dir of ownedDirs) rmSync(dir, { recursive: true, force: true })
  for (const [path, { content, mode }] of outputs) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content, { mode })
  }
  console.log(`${outputs.size} file(s) written to ${ownedDirs.map((d) => relative(ROOT, d)).join(', ')} and ${relative(ROOT, ROOT_CATALOG)}`)
}

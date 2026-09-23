/**
 * Compiles canonical plugin sources (plugin.yaml, marketplace.yaml, *.jig
 * templates) into per-platform distributable files.
 *
 *   bun run build           # render everything
 *   bun run build:check     # verify committed outputs are fresh (CI)
 *
 * Platforms (build/platforms/<id>.yaml):
 *   claude — renders in place: .claude-plugin/plugin.json, marketplace.json,
 *            and any *.jig content file to its stripped sibling. These outputs
 *            are committed; the repo itself is the Claude plugin source.
 *   kimi   — same manifests co-located (kimi.plugin.json), plus a full
 *            self-contained tree at dist/kimi/ (gitignored build artifact,
 *            suitable for zip release distribution).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { parse as parseYaml } from 'yaml'
import edge from '@jig-lang/jig'

edge.registerFilter('json', (value: unknown) => JSON.stringify(value))

const ROOT = join(import.meta.dir, '..')
const BUILD = import.meta.dir
const CHECK = process.argv.includes('--check')

edge.mount(join(BUILD, 'templates'))

const readYaml = (path: string) => parseYaml(readFileSync(path, 'utf8'))

const marketplace = readYaml(join(ROOT, 'marketplace.yaml'))
const platforms: Record<string, Record<string, any>> = {}
for (const file of readdirSync(join(BUILD, 'platforms'))) {
  if (file.endsWith('.yaml')) {
    platforms[file.slice(0, -'.yaml'.length)] = readYaml(join(BUILD, 'platforms', file))
  }
}

const pluginsRoot = join(ROOT, 'plugins')
const pluginNames = readdirSync(pluginsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(pluginsRoot, d.name, 'plugin.yaml')))
  .map((d) => d.name)
  .sort()

const COMPONENT_DIRS = ['skills', 'agents', 'commands']
const componentsOf = (pluginDir: string) =>
  COMPONENT_DIRS.filter((c) => existsSync(join(pluginDir, c))).map((c) => ({
    key: c,
    value: `./${c}/`,
  }))

const stale: string[] = []
let written = 0

function emit(path: string, content: string, { json = false } = {}) {
  let normalized = content.trimEnd() + '\n'
  if (json) {
    try {
      // Parse and re-print: templates control data, not whitespace.
      normalized = JSON.stringify(JSON.parse(content), null, 2) + '\n'
    } catch (error) {
      console.error(`INVALID JSON rendered for ${relative(ROOT, path)}: ${error}`)
      process.exit(1)
    }
  }
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : null
  const label = relative(ROOT, path)
  if (existing === normalized) return
  if (CHECK) {
    stale.push(label)
    return
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, normalized)
  console.log(`wrote  ${label}`)
  written++
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (entry.isFile()) yield path
  }
}

// --- Manifests (co-located, both platforms read from the same plugin dir) ---

const localEntries: Array<Record<string, any>> = []

for (const name of pluginNames) {
  const pluginDir = join(pluginsRoot, name)
  const plugin = readYaml(join(pluginDir, 'plugin.yaml'))
  const components = componentsOf(pluginDir)

  emit(
    join(pluginDir, '.claude-plugin', 'plugin.json'),
    edge.renderSync('claude-plugin.jig', { plugin }),
    { json: true },
  )
  emit(
    join(pluginDir, 'kimi.plugin.json'),
    edge.renderSync('kimi-plugin.jig', { plugin, components }),
    { json: true },
  )
  localEntries.push({ name: plugin.name, description: plugin.description, external: false })
}

const marketplaceEntries = [
  ...localEntries,
  ...(marketplace.external ?? []).map((entry: Record<string, any>) => ({ ...entry, external: true })),
]
emit(
  join(ROOT, '.claude-plugin', 'marketplace.json'),
  edge.renderSync('marketplace.jig', { marketplace, plugins: marketplaceEntries }),
  { json: true },
)

// --- Per-platform content ---

const GENERATED_RELS = new Set(['plugin.yaml', 'kimi.plugin.json'])

for (const [platformId, platform] of Object.entries(platforms)) {
  const inPlace = platformId === 'claude'
  if (CHECK && !inPlace) continue // dist trees are gitignored artifacts, not checked

  for (const name of pluginNames) {
    const pluginDir = join(pluginsRoot, name)
    const plugin = readYaml(join(pluginDir, 'plugin.yaml'))
    const distDir = join(ROOT, 'dist', platformId, 'plugins', name)

    for (const file of walk(pluginDir)) {
      const rel = relative(pluginDir, file)
      if (GENERATED_RELS.has(rel) || rel.startsWith('.claude-plugin')) continue

      if (file.endsWith('.jig')) {
        const rendered = edge.renderRawSync(readFileSync(file, 'utf8'), { platform, plugin }, file)
        emit(inPlace ? join(pluginDir, rel.slice(0, -'.jig'.length)) : join(distDir, rel.slice(0, -'.jig'.length)), rendered)
      } else if (!inPlace && !existsSync(`${file}.jig`)) {
        // Skip rendered outputs (a `X.jig` template owns path X) — copy everything else verbatim.
        const target = join(distDir, rel)
        mkdirSync(dirname(target), { recursive: true })
        copyFileSync(file, target)
      }
    }

    if (!inPlace) {
      emit(
        join(distDir, 'kimi.plugin.json'),
        edge.renderSync('kimi-plugin.jig', { plugin, components: componentsOf(pluginDir) }),
        { json: true },
      )
    }
  }

  if (!inPlace) {
    const catalogPlugins = pluginNames.map((name) => readYaml(join(pluginsRoot, name, 'plugin.yaml')))
    emit(
      join(ROOT, 'dist', platformId, 'marketplace.json'),
      edge.renderSync('kimi-marketplace.jig', { plugins: catalogPlugins }),
      { json: true },
    )
  }
}

if (CHECK) {
  if (stale.length) {
    console.error(`stale generated files (run \`bun run build\`):\n  ${stale.join('\n  ')}`)
    process.exit(1)
  }
  console.log('all generated files up to date')
} else {
  console.log(written ? `${written} file(s) written` : 'everything up to date')
}

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { join } from 'node:path'

const root = 'beta-assets'
const files = await readdir(root)
const builds = []
for (const name of files.filter(name => name.endsWith('-build.json')).sort()) {
  const build = JSON.parse(await readFile(join(root, name), 'utf8'))
  assert.equal(build.version, '3.6.8-beta3')
  assert.equal(build.commit, process.env.GITHUB_SHA)
  assert.equal(build.releaseChannel, 'beta')
  assert.equal(build.unsigned, true)
  const expectedCount = build.platform === 'win32' ? 3 : 1
  assert.equal(build.assets.length, expectedCount)
  for (const asset of build.assets) {
    assert.equal(asset.name, asset.name.split('/').at(-1))
    assert(!asset.name.includes('..'))
    const bytes = await readFile(join(root, asset.name))
    assert.equal(bytes.length, asset.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256)
  }
  builds.push(build)
}
assert.equal(builds.length, 6)
assert.deepEqual(
  builds.map(build => `${build.platform}-${build.arch}`).sort(),
  [
    'darwin-arm64',
    'darwin-x64',
    'linux-arm64',
    'linux-x64',
    'win32-arm64',
    'win32-x64',
  ]
)
assert.equal(
  new Set(builds.flatMap(build => build.assets.map(asset => asset.name))).size,
  10
)
await writeFile(
  join(root, 'build-manifest.json'),
  JSON.stringify(
    {
      version: '3.6.8-beta3',
      commit: process.env.GITHUB_SHA,
      upstreamDevelopment: process.env.UPSTREAM_BASELINE,
      builds,
    },
    null,
    2
  ) + '\n'
)
console.log(
  'Verified all 10 native assets across 6 platform/architecture builds'
)

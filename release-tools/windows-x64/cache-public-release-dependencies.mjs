import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const configPath = process.argv[2]
assert(configPath, 'Provide a temporary Yarn configuration path')
const cache = join(dirname(configPath), 'beta-public-npm-cache')
await mkdir(cache, { recursive: true })
const lock = await readFile('yarn.lock', 'utf8')
const entries = [
  ...lock.matchAll(/resolved "(https:\/\/ms-feed[^"#]+)#([a-f0-9]+)"/g),
]
for (const [, original, sha1] of entries) {
  const marker = '/npm/registry/'
  assert(original.includes(marker))
  const suffix = original.split(marker)[1]
  const name =
    (suffix.startsWith('@') ? `${suffix.split('/')[0]}-` : '') +
    suffix.split('/').at(-1)
  assert(!name.includes('..'))
  const response = await fetch(`https://registry.npmjs.org/${suffix}`)
  assert(response.ok, `npm download failed: ${suffix}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.equal(createHash('sha1').update(bytes).digest('hex'), sha1)
  await writeFile(join(cache, name), bytes)
}
await writeFile(configPath, `yarn-offline-mirror ${JSON.stringify(cache)}\n`)
console.log(
  `Cached ${entries.length} locked tarballs from the public npm registry, with verified hashes`
)

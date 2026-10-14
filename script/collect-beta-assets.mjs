import { mkdir, copyFile, readdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = process.cwd()
const { version, productName } = JSON.parse(
  await readFile('app/package.json', 'utf8')
)
const platform = process.platform
const arch = process.env.TARGET_ARCH ?? process.arch
const destination = join(root, 'beta-assets')
const dist = join(root, 'dist')
await mkdir(destination, { recursive: true })

if (platform === 'linux') {
  execFileSync('tar', [
    '-czf',
    join(destination, `GitHubDesktopWordWrap-${version}-linux-${arch}.tar.gz`),
    '-C',
    dist,
    `desktop-linux-${arch}`,
  ])
} else if (platform === 'darwin') {
  await copyFile(
    join(dist, `${productName}-${arch}.zip`),
    join(destination, `GitHubDesktopWordWrap-${version}-macos-${arch}.zip`)
  )
} else if (platform === 'win32') {
  const prefix = 'GitHubDesktopWordWrapBeta'
  for (const extension of ['exe', 'msi']) {
    await copyFile(
      join(dist, `${prefix}Setup-${arch}.${extension}`),
      join(destination, `${prefix}Setup-${version}-${arch}.${extension}`)
    )
  }
  await copyFile(
    join(dist, `${prefix}-${version}-${arch}-full.nupkg`),
    join(destination, `${prefix}-${version}-${arch}-full.nupkg`)
  )
} else {
  throw new Error(`Unsupported platform ${platform}`)
}

const assets = []
for (const name of (await readdir(destination)).sort()) {
  const bytes = await readFile(join(destination, name))
  assets.push({
    name,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  })
}
await writeFile(
  join(destination, `${platform}-${arch}-build.json`),
  JSON.stringify(
    {
      version,
      platform,
      arch,
      commit:
        process.env.GITHUB_SHA ??
        execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      releaseChannel: process.env.RELEASE_CHANNEL,
      unsigned: process.env.DESKTOP_UNSIGNED === '1',
      assets,
    },
    null,
    2
  ) + '\n'
)
console.log(`Collected ${assets.length} assets for ${platform}/${arch}`)

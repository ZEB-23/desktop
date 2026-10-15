const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const { join } = require('node:path')
const {
  readFile,
  readdir,
  mkdir,
  copyFile,
  writeFile,
} = require('node:fs/promises')
const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')

async function main() {
  assert.equal(process.platform, 'win32')
  assert.equal(process.arch, 'x64')
  const root = process.cwd()
  const appRequire = createRequire(join(root, 'package.json'))
  const { createWindowsInstaller } = appRequire('electron-winstaller')
  const pkg = JSON.parse(await readFile(join(root, 'app/package.json'), 'utf8'))
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  assert.equal(sourceCommit, process.env.SOURCE_COMMIT)
  assert.equal(pkg.productName, 'GitHub Desktop')
  assert.equal(pkg.bundleID, 'com.github.GitHubClient')
  assert.equal(pkg.version, '3.6.8-beta2')

  const appDirectory = join(root, 'dist/GitHubDesktop-win32-x64')
  const executable = await readFile(join(appDirectory, 'GitHubDesktop.exe'))
  const peOffset = executable.readUInt32LE(0x3c)
  assert.equal(executable.toString('ascii', peOffset, peOffset + 4), 'PE\0\0')
  assert.equal(
    executable.readUInt16LE(peOffset + 4),
    0x8664,
    'Application must be Windows x64'
  )
  const installedMetadata = JSON.parse(
    await readFile(join(appDirectory, 'resources/app/package.json'), 'utf8')
  )
  for (const key of ['productName', 'bundleID', 'version', 'companyName']) {
    assert.equal(installedMetadata[key], pkg[key])
  }
  assert(
    (await readFile(join(root, 'out/renderer.js'), 'utf8')).includes(
      sourceCommit
    )
  )

  const outputDirectory = join(root, 'dist/installer')
  const setupExe = 'GitHubDesktopSetup-x64.exe'
  // Use upstream's installer settings; omit MSI, deltas and trusted signing.
  // The full NuGet payload is an internal input embedded in the setup EXE.
  await createWindowsInstaller({
    name: 'GitHubDesktop',
    appDirectory,
    outputDirectory,
    authors: pkg.companyName,
    iconUrl: 'https://desktop.githubusercontent.com/app-icon.ico',
    setupIcon: join(root, 'app/static/logos/prod/icon-logo.ico'),
    loadingGif: join(root, 'app/static/logos/win32-installer-splash.gif'),
    exe: 'GitHubDesktop.exe',
    title: pkg.productName,
    setupExe,
    noMsi: true,
    noDelta: true,
  })
  const files = await readdir(outputDirectory)
  assert(!files.some(name => /\.msi$|delta\.nupkg$/i.test(name)))
  const bytes = await readFile(join(outputDirectory, setupExe))
  assert(
    bytes.length > 100 * 1024 * 1024,
    'Installer must include the complete application'
  )
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const releaseOutput = process.env.RELEASE_OUTPUT
  assert(releaseOutput)
  await mkdir(releaseOutput, { recursive: true })
  await copyFile(join(outputDirectory, setupExe), join(releaseOutput, setupExe))
  await writeFile(
    join(releaseOutput, 'build-manifest.json'),
    JSON.stringify(
      {
        sourceCommit,
        upstreamDevelopment: process.env.UPSTREAM_BASELINE,
        automationCommit: process.env.GITHUB_SHA,
        applicationVersion: pkg.version,
        productName: pkg.productName,
        bundleID: pkg.bundleID,
        platform: 'win32',
        arch: 'x64',
        releaseChannel: process.env.RELEASE_CHANNEL,
        remoteUpdates: false,
        unsigned: true,
        file: setupExe,
        bytes: bytes.length,
        sha256,
      },
      null,
      2
    ) + '\n'
  )
  console.log(`Built ${setupExe}: ${bytes.length} bytes; SHA256 ${sha256}`)
}
main().catch(error => {
  console.error(error)
  process.exit(1)
})

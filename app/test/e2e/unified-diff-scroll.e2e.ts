import { execFile } from 'child_process'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

import { test, expect, dismissMoveToApplicationsDialog } from './e2e-fixtures'

const execFileAsync = promisify(execFile)

test('unwrapped unified diffs scroll together and retain their width across virtualized rows', async ({
  mainWindow: page,
}) => {
  const repository = await mkdtemp(join(tmpdir(), 'desktop-diff-scroll-'))
  const original = [
    'Long words: ' + 'long words '.repeat(120),
    'Long token: ' + 'x'.repeat(1200),
    '\tindented\t' + 'tabbed content '.repeat(80),
    ...Array.from({ length: 200 }, (_, i) => `original row ${i}`),
  ]

  try {
    await execFileAsync('git', ['init', repository])
    await writeFile(join(repository, 'long.txt'), original.join('\n') + '\n')
    await execFileAsync('git', ['add', 'long.txt'], { cwd: repository })
    await execFileAsync(
      'git',
      [
        '-c',
        'user.name=Diff Scroll Test',
        '-c',
        'user.email=diff-scroll@example.com',
        'commit',
        '-m',
        'Baseline',
      ],
      { cwd: repository }
    )
    await writeFile(
      join(repository, 'long.txt'),
      original.map((_, i) => `updated short row ${i}`).join('\n') + '\n'
    )
    await writeFile(
      join(repository, 'short.txt'),
      [
        'short line',
        ...Array.from({ length: 200 }, (_, i) => `short row ${i}`),
      ].join('\n') + '\n'
    )

    await page.locator('a.skip-button').click()
    await page
      .locator('input[placeholder="Your Name"]')
      .fill('Diff Scroll Test')
    await page
      .locator('input[placeholder="your-email@example.com"]')
      .fill('diff-scroll@example.com')
    await page.getByRole('button', { name: 'Finish', exact: true }).click()
    await page.waitForSelector('#welcome', { state: 'hidden' })
    await dismissMoveToApplicationsDialog(page)
    await page.evaluate(() => {
      require('electron').ipcRenderer.emit(
        'menu-event',
        {},
        'add-local-repository'
      )
    })
    await page.locator('input[placeholder="repository path"]').fill(repository)
    await page.getByRole('button', { name: /^add repository$/i }).click()
    await page.getByText('long.txt', { exact: true }).first().click()

    const options = page.getByRole('button', {
      name: 'Diff Options',
      exact: true,
    })
    await options.click()
    await page.getByRole('radio', { name: 'Unified', exact: true }).click()
    const wrap = page.getByRole('checkbox', { name: 'Word wrap', exact: true })
    await wrap.uncheck()
    await options.click()

    const grid = page.locator('.unified-diff .ReactVirtualized__Grid')
    await expect
      .poll(() => grid.evaluate(el => el.scrollWidth))
      .toBeGreaterThan(4000)
    const width = await grid.evaluate(el => el.scrollWidth)
    const rows = grid.locator('[role=row][aria-rowindex]')
    const before = await rows.evaluateAll(elements =>
      elements.map(el => el.getBoundingClientRect().left)
    )
    expect(
      await rows.evaluateAll(elements =>
        elements.every(el => el.getBoundingClientRect().height === 20)
      )
    ).toBe(true)

    await grid.evaluate(el => {
      el.scrollLeft = 200
    })
    await expect
      .poll(() =>
        rows.evaluateAll(elements =>
          elements.map(el => el.getBoundingClientRect().left)
        )
      )
      .toEqual(before.map(left => left - 200))
    expect(
      await grid
        .locator('.content')
        .evaluateAll(elements =>
          elements.every(
            el =>
              getComputedStyle(el).overflow === 'visible' && el.scrollLeft === 0
          )
        )
    ).toBe(true)
    expect(
      await rows.evaluateAll(elements =>
        elements.map(el => el.getBoundingClientRect().width)
      )
    ).toEqual(before.map(() => width))

    await grid.evaluate(el => {
      el.scrollTop = el.scrollHeight
    })
    await expect(
      grid.getByText('updated short row 202', { exact: true })
    ).toBeVisible()
    expect(await grid.evaluate(el => el.scrollWidth)).toBe(width)
    expect(await grid.evaluate(el => el.scrollLeft)).toBe(200)

    await options.click()
    await wrap.check()
    await expect
      .poll(() => grid.evaluate(el => el.scrollWidth - el.clientWidth))
      .toBeLessThanOrEqual(1)
    expect(await grid.evaluate(el => el.scrollLeft)).toBe(0)
    await grid.evaluate(el => {
      el.scrollTop = 0
    })
    await expect
      .poll(() =>
        grid
          .getByText(/^Long words:/)
          .evaluate(el => el.getBoundingClientRect().height)
      )
      .toBeGreaterThan(20)
    await page.getByRole('radio', { name: 'Split', exact: true }).click()
    await expect(wrap).not.toBeVisible()
    await page.getByRole('radio', { name: 'Unified', exact: true }).click()
    await expect(wrap).toBeChecked()
    await wrap.uncheck()
    await options.click()
    await page.getByText('short.txt', { exact: true }).first().click()
    await expect(grid.getByText('short line', { exact: true })).toBeVisible()
    await expect
      .poll(() => grid.evaluate(el => el.scrollWidth - el.clientWidth))
      .toBeLessThanOrEqual(1)
    expect(await grid.evaluate(el => el.scrollLeft)).toBe(0)

    const pane = page.locator('.side-by-side-diff-container')
    await pane.evaluate(el => {
      el.style.width = '400px'
      el.style.maxWidth = '400px'
    })
    await expect
      .poll(() => grid.evaluate(el => el.clientWidth))
      .toBeLessThan(401)
    await expect
      .poll(() => grid.evaluate(el => el.scrollWidth - el.clientWidth))
      .toBeLessThanOrEqual(1)
  } finally {
    await rm(repository, { recursive: true, force: true })
  }
})

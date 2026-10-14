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
    ...Array.from({ length: 7192 }, (_, i) => `unchanged row ${i}`),
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
      original
        .map((line, i) => (i < 7192 ? line : `updated short row ${i}`))
        .join('\n') + '\n'
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
    // Compare both number columns against a context row, using coordinates
    // within the shared canvas so scrolling cannot hide a gutter offset.
    const gutterGeometry = () =>
      grid.evaluate(el => {
        const origin = el.getBoundingClientRect().left - el.scrollLeft
        return Array.from(el.querySelectorAll('.row .line-number')).map(
          gutter => ({
            kind: gutter.closest('.row')?.className,
            edges: [
              gutter.getBoundingClientRect().left - origin,
              gutter.getBoundingClientRect().right - origin,
              ...Array.from(
                gutter.querySelectorAll(':scope > label > span')
              ).flatMap(column => [
                column.getBoundingClientRect().left - origin,
                column.getBoundingClientRect().right - origin,
              ]),
            ],
          })
        )
      })
    const gutters = await gutterGeometry()
    let contextGutter = gutters.find(gutter => gutter.kind?.includes('context'))
    expect(contextGutter).toBeDefined()
    expect(gutters.some(gutter => gutter.kind?.includes('deleted'))).toBe(true)
    const assertGuttersAlign = async () => {
      const current = await gutterGeometry()
      expect(current.length).toBeGreaterThan(0)
      for (const gutter of current) {
        expect(gutter.edges).toEqual(contextGutter!.edges)
      }
    }
    await assertGuttersAlign()
    const changedGutter = grid.locator('.row.deleted .line-number').first()
    await changedGutter.locator('label').click()
    await expect(changedGutter).not.toHaveClass(/line-selected/)
    await assertGuttersAlign()
    await changedGutter.locator('label').click()
    await expect(changedGutter).toHaveClass(/line-selected/)
    await assertGuttersAlign()

    const width = await grid.evaluate(el => el.scrollWidth)
    const rows = grid.locator('[role=row][aria-rowindex]')
    const before = await rows.evaluateAll(elements =>
      elements.map(el => el.getBoundingClientRect().left)
    )
    expect(
      await grid
        .locator('.row:not(.hunk-info)')
        .evaluateAll(elements =>
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

    await assertGuttersAlign()
    await grid.evaluate(el => {
      el.scrollTop = el.scrollHeight
    })
    await expect(
      grid.getByText('updated short row 7394', { exact: true })
    ).toBeVisible()
    expect(
      (await gutterGeometry()).some(gutter => gutter.kind?.includes('added'))
    ).toBe(true)
    await assertGuttersAlign()
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
    for (const showCheckMarks of [false, true]) {
      await page.evaluate(value => {
        localStorage.setItem('diff-check-marks-visible', JSON.stringify(value))
      }, showCheckMarks)
      await page.reload()
      await page.waitForSelector('.unified-diff.no-word-wrap .row.context')
      await expect
        .poll(() => grid.evaluate(el => el.scrollWidth))
        .toBeGreaterThan(4000)
      contextGutter = (await gutterGeometry()).find(gutter =>
        gutter.kind?.includes('context')
      )
      expect(contextGutter).toBeDefined()
      expect((await grid.locator('.line-number-check').count()) > 0).toBe(
        showCheckMarks
      )
      await assertGuttersAlign()
      await grid.evaluate(el => {
        el.scrollLeft = 200
      })
      await expect.poll(() => grid.evaluate(el => el.scrollLeft)).toBe(200)
      await assertGuttersAlign()
    }

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

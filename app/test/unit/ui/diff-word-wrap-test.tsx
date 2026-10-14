import assert from 'node:assert'
import { beforeEach, describe, it } from 'node:test'
import * as React from 'react'

import { DiffOptions } from '../../../src/ui/diff/diff-options'
import { SideBySideDiff } from '../../../src/ui/diff/side-by-side-diff'
import {
  DiffSelection,
  DiffSelectionType,
  DiffType,
} from '../../../src/models/diff'
import {
  AppFileStatusKind,
  WorkingDirectoryFileChange,
} from '../../../src/models/status'
import { DiffParser } from '../../../src/lib/diff-parser'
import {
  getWrapUnifiedDiff,
  setWrapUnifiedDiff,
} from '../../../src/ui/lib/diff-mode'
import { fireEvent, render, screen } from '../../helpers/ui/render'

const diff = new DiffParser().parse(
  'diff --git a/example.txt b/example.txt\nindex 1234567..7654321 100644\n--- a/example.txt\n+++ b/example.txt\n@@ -1 +1 @@\n-before\n+after with a long line of words\n'
)
const file = new WorkingDirectoryFileChange(
  'example.txt',
  { kind: AppFileStatusKind.Modified },
  DiffSelection.fromInitialSelection(DiffSelectionType.All)
)

function WordWrapDiff() {
  const [wrapUnifiedDiff, setWrap] = React.useState(getWrapUnifiedDiff)
  const [showSideBySideDiff, setSplit] = React.useState(false)
  const onWrapChanged = (checked: boolean) => {
    setWrapUnifiedDiff(checked)
    setWrap(checked)
  }
  const onIgnoreWhitespaceChanged = () => {}
  const onDiffOptionsOpened = () => {}

  return (
    <>
      <DiffOptions
        isInteractiveDiff={true}
        hideWhitespaceChanges={false}
        onHideWhitespaceChangesChanged={onIgnoreWhitespaceChanged}
        showSideBySideDiff={showSideBySideDiff}
        onShowSideBySideDiffChanged={setSplit}
        wrapUnifiedDiff={wrapUnifiedDiff}
        onWrapUnifiedDiffChanged={onWrapChanged}
        onDiffOptionsOpened={onDiffOptionsOpened}
      />
      <SideBySideDiff
        file={file}
        diff={{ ...diff, text: diff.contents, kind: DiffType.Text }}
        fileContents={null}
        hideWhitespaceInDiff={false}
        showSideBySideDiff={showSideBySideDiff}
        wrapUnifiedDiff={wrapUnifiedDiff}
        showDiffCheckMarks={true}
        onHideWhitespaceInDiffChanged={onIgnoreWhitespaceChanged}
      />
    </>
  )
}

function getWordWrapCheckbox() {
  const checkbox = screen.getByRole('checkbox', { name: /word wrap/i })
  assert(checkbox instanceof HTMLInputElement)
  return checkbox
}

describe('unified diff word wrap', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the existing wrapped default', () => {
    const { container } = render(<WordWrapDiff />)
    fireEvent.click(
      screen.getByRole('button', { name: /diff options|diff settings/i })
    )

    assert.strictEqual(getWordWrapCheckbox().checked, true)
    assert(container.querySelector('.unified-diff'))
    assert.strictEqual(container.querySelector('.no-word-wrap'), null)
  })

  it('toggles the viewer immediately and remembers the setting after remounting', () => {
    const view = render(<WordWrapDiff />)
    fireEvent.click(
      screen.getByRole('button', { name: /diff options|diff settings/i })
    )
    fireEvent.click(getWordWrapCheckbox())

    assert.strictEqual(getWordWrapCheckbox().checked, false)
    assert(view.container.querySelector('.unified-diff.no-word-wrap'))
    assert.strictEqual(getWrapUnifiedDiff(), false)

    view.unmount()
    const remounted = render(<WordWrapDiff />)
    assert(remounted.container.querySelector('.unified-diff.no-word-wrap'))
    fireEvent.click(
      screen.getByRole('button', { name: /diff options|diff settings/i })
    )
    fireEvent.click(getWordWrapCheckbox())

    assert.strictEqual(getWordWrapCheckbox().checked, true)
    assert.strictEqual(remounted.container.querySelector('.no-word-wrap'), null)
    assert.strictEqual(getWrapUnifiedDiff(), true)
  })

  it('only offers wrapping in unified mode and restores it after switching back', () => {
    const { container } = render(<WordWrapDiff />)
    fireEvent.click(
      screen.getByRole('button', { name: /diff options|diff settings/i })
    )
    fireEvent.click(getWordWrapCheckbox())
    fireEvent.click(screen.getByRole('radio', { name: 'Split' }))

    assert.strictEqual(
      screen.queryByRole('checkbox', { name: /word wrap/i }),
      null
    )
    assert.strictEqual(container.querySelector('.no-word-wrap'), null)

    fireEvent.click(screen.getByRole('radio', { name: 'Unified' }))
    assert.strictEqual(getWordWrapCheckbox().checked, false)
    assert(container.querySelector('.unified-diff.no-word-wrap'))
  })
})

import { getBoolean, setBoolean } from '../../lib/local-storage'

export const ShowSideBySideDiffDefault = false
const showSideBySideDiffKey = 'show-side-by-side-diff'

/**
 * Gets a value indicating whether not to present diffs in a split view mode
 * as opposed to unified (the default).
 */
export function getShowSideBySideDiff(): boolean {
  return getBoolean(showSideBySideDiffKey, ShowSideBySideDiffDefault)
}

/**
 * Sets a local storage key indicating whether not to present diffs in a split
 * view mode as opposed to unified (the default).
 */
export function setShowSideBySideDiff(showSideBySideDiff: boolean) {
  setBoolean(showSideBySideDiffKey, showSideBySideDiff)
}

/** Preserve the existing wrapping behavior for unified diffs. */
export const WrapUnifiedDiffDefault = true
const wrapUnifiedDiffKey = 'wrap-unified-diff'

/** Gets the user's word-wrap preference for unified diffs. */
export function getWrapUnifiedDiff(): boolean {
  return getBoolean(wrapUnifiedDiffKey, WrapUnifiedDiffDefault)
}

/** Persists the user's word-wrap preference for unified diffs. */
export function setWrapUnifiedDiff(wrapUnifiedDiff: boolean) {
  setBoolean(wrapUnifiedDiffKey, wrapUnifiedDiff)
}

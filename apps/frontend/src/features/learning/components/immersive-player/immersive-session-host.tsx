import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLeanInsightPlaylist } from '@/features/practice/hooks/use-lean-insight-playlist'
import { ImmersivePlayerDialog } from './immersive-player-dialog'
import { createNotebookLeanPlaylistFetchers } from './immersive-notebook-playlist'
import { useImmersiveSessionStore } from './immersive-session.store'

/**
 * App-level Immersive owner: playlist + Dialog survive route changes.
 * Cleared only when the user closes Immersive (or sleep timer ends via Dialog).
 */
export function ImmersiveSessionHost() {
  const navigate = useNavigate()
  const location = useLocation()
  const active = useImmersiveSessionStore((s) => s.active)
  const uiOpen = useImmersiveSessionStore((s) => s.uiOpen)
  const notebookId = useImmersiveSessionStore((s) => s.notebookId)
  const libraryTab = useImmersiveSessionStore((s) => s.libraryTab)
  const reviewState = useImmersiveSessionStore((s) => s.reviewState)
  const search = useImmersiveSessionStore((s) => s.search)
  const sort = useImmersiveSessionStore((s) => s.sort)
  const openGeneration = useImmersiveSessionStore((s) => s.openGeneration)
  const setAbsoluteIndex = useImmersiveSessionStore((s) => s.setAbsoluteIndex)
  const setUiOpen = useImmersiveSessionStore((s) => s.setUiOpen)
  const clearSession = useImmersiveSessionStore((s) => s.clearSession)

  const [hydrated, setHydrated] = useState(() => useImmersiveSessionStore.persist.hasHydrated())
  const restoreNavDoneRef = useRef(false)
  const lastOpenedGenerationRef = useRef(-1)

  useEffect(() => {
    if (hydrated) return
    const unsub = useImmersiveSessionStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })
    if (useImmersiveSessionStore.persist.hasHydrated()) setHydrated(true)
    return unsub
  }, [hydrated])

  const filters = useMemo(
    () =>
      notebookId
        ? { notebookId, libraryTab, reviewState, search, sort }
        : null,
    [libraryTab, notebookId, reviewState, search, sort],
  )

  const fetchers = useMemo(
    () => (filters ? createNotebookLeanPlaylistFetchers(filters) : null),
    [filters],
  )

  const fetchPage = useCallback(
    async (input: { offset: number; limit: number }) => {
      if (!fetchers) return { items: [], total: 0 }
      return fetchers.fetchPage(input)
    },
    [fetchers],
  )

  const fetchDetail = useCallback(
    async (id: string) => {
      if (!fetchers) return null
      return fetchers.fetchDetail(id)
    },
    [fetchers],
  )

  const playlist = useLeanInsightPlaylist({ fetchPage, fetchDetail })
  const openAtRef = useRef(playlist.openAt)
  const setOpenRef = useRef(playlist.setOpen)
  const resetRef = useRef(playlist.reset)
  const handleIndexChangeRef = useRef(playlist.handleIndexChange)
  const loadMoreRef = useRef(playlist.loadMore)
  openAtRef.current = playlist.openAt
  setOpenRef.current = playlist.setOpen
  resetRef.current = playlist.reset
  handleIndexChangeRef.current = playlist.handleIndexChange
  loadMoreRef.current = playlist.loadMore

  // Cold start / rehydrate: land on the notebook detail route once.
  useEffect(() => {
    if (!hydrated || !active || !notebookId) {
      restoreNavDoneRef.current = false
      return
    }
    if (restoreNavDoneRef.current) return
    restoreNavDoneRef.current = true
    const target = `/expressions/${notebookId}`
    if (!location.pathname.startsWith(target)) {
      navigate(target, { replace: true })
    }
  }, [active, hydrated, location.pathname, navigate, notebookId])

  // Open / reopen playlist whenever startSession bumps openGeneration (incl. after hydrate).
  useEffect(() => {
    if (!hydrated || !active || !notebookId) return
    if (lastOpenedGenerationRef.current === openGeneration) return
    lastOpenedGenerationRef.current = openGeneration
    const index = Math.max(0, useImmersiveSessionStore.getState().absoluteIndex)
    void (async () => {
      await openAtRef.current(index)
      setUiOpen(true)
    })()
  }, [active, hydrated, notebookId, openGeneration, setUiOpen])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setUiOpen(true)
        setOpenRef.current(true)
        return
      }
      // Clear session first so uiOpen/active drop before playlist.reset; avoids
      // a render that re-opens Dialog while still "active".
      clearSession()
      resetRef.current()
    },
    [clearSession, setUiOpen],
  )

  const handleIndexChange = useCallback(
    (nextAbsolute: number) => {
      setAbsoluteIndex(nextAbsolute)
      void handleIndexChangeRef.current(nextAbsolute)
    },
    [setAbsoluteIndex],
  )

  if (!active || !notebookId) return null

  return (
    <ImmersivePlayerDialog
      items={playlist.immersiveItems}
      index={Math.min(playlist.index, Math.max(playlist.immersiveItems.length - 1, 0))}
      open={playlist.open && uiOpen}
      onOpenChange={handleOpenChange}
      onIndexChange={handleIndexChange}
      total={playlist.total}
      windowOffset={playlist.windowOffset}
      onLoadMore={() => {
        void loadMoreRef.current()
      }}
    />
  )
}

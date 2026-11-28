import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ImmersiveLibraryTab = 'words' | 'chunk' | 'pattern'
export type ImmersiveListSort = 'newest' | 'oldest'

export type ImmersiveSessionSnapshot = {
  active: boolean
  uiOpen: boolean
  notebookId: string | null
  absoluteIndex: number
  libraryTab: ImmersiveLibraryTab
  /** Match library filters so restore uses the same lean playlist. */
  reviewState: string | 'all'
  search: string
  sort: ImmersiveListSort
  /** Bumped on each startSession so Host re-runs openAt. */
  openGeneration: number
}

type ImmersiveSessionStore = ImmersiveSessionSnapshot & {
  startSession: (input: {
    notebookId: string
    absoluteIndex: number
    libraryTab?: ImmersiveLibraryTab
    reviewState?: string | 'all'
    search?: string
    sort?: ImmersiveListSort
  }) => void
  setAbsoluteIndex: (absoluteIndex: number) => void
  setUiOpen: (uiOpen: boolean) => void
  clearSession: () => void
}

const EMPTY_SESSION: ImmersiveSessionSnapshot = {
  active: false,
  uiOpen: false,
  notebookId: null,
  absoluteIndex: 0,
  libraryTab: 'words',
  reviewState: 'all',
  search: '',
  sort: 'newest',
  openGeneration: 0,
}

export const useImmersiveSessionStore = create<ImmersiveSessionStore>()(
  persist(
    (set) => ({
      ...EMPTY_SESSION,
      startSession: (input) =>
        set((state) => ({
          active: true,
          uiOpen: true,
          notebookId: input.notebookId,
          absoluteIndex: Math.max(0, input.absoluteIndex),
          libraryTab: input.libraryTab ?? 'words',
          reviewState: input.reviewState ?? 'all',
          search: input.search?.trim() ?? '',
          sort: input.sort ?? 'newest',
          openGeneration: state.openGeneration + 1,
        })),
      setAbsoluteIndex: (absoluteIndex) =>
        set((state) =>
          state.active ? { absoluteIndex: Math.max(0, absoluteIndex) } : state,
        ),
      setUiOpen: (uiOpen) =>
        set((state) => (state.active ? { uiOpen } : state)),
      clearSession: () => set((state) => ({ ...EMPTY_SESSION, openGeneration: state.openGeneration })),
    }),
    {
      name: 'manyu-immersive-session',
      version: 1,
      partialize: (state) => ({
        active: state.active,
        uiOpen: state.uiOpen,
        notebookId: state.notebookId,
        absoluteIndex: state.absoluteIndex,
        libraryTab: state.libraryTab,
        reviewState: state.reviewState,
        search: state.search,
        sort: state.sort,
        openGeneration: state.openGeneration,
      }),
    },
  ),
)

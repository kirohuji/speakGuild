import { create } from 'zustand'

export interface GlobalTask {
  id: string
  kind: 'script_video'
  title: string
  progress: number
  status: 'running' | 'done' | 'error'
  stepLabel: string
  error?: string
}

interface GlobalTaskStore {
  tasks: GlobalTask[]
  startTask: (task: Pick<GlobalTask, 'id' | 'kind' | 'title'>) => void
  updateTask: (id: string, patch: Partial<Omit<GlobalTask, 'id'>>) => void
  removeTask: (id: string) => void
}

export const useGlobalTaskStore = create<GlobalTaskStore>((set) => ({
  tasks: [],
  startTask: (task) => set((state) => ({
    tasks: [
      ...state.tasks.filter((item) => item.id !== task.id),
      { ...task, progress: 0, status: 'running', stepLabel: '准备视频素材' },
    ],
  })),
  updateTask: (id, patch) => set((state) => ({
    tasks: state.tasks.map((task) => task.id === id ? { ...task, ...patch } : task),
  })),
  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter((task) => task.id !== id),
  })),
}))

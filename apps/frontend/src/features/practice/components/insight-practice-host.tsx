import { createContext, useContext, type ReactNode } from 'react'

type InsightPracticeHost = {
  openPractice: (node: ReactNode) => void
  closePractice: () => void
}

const InsightPracticeHostContext = createContext<InsightPracticeHost | null>(null)

export function InsightPracticeHostProvider({
  value,
  children,
}: {
  value: InsightPracticeHost
  children: ReactNode
}) {
  return (
    <InsightPracticeHostContext.Provider value={value}>
      {children}
    </InsightPracticeHostContext.Provider>
  )
}

export function useInsightPracticeHost() {
  return useContext(InsightPracticeHostContext)
}

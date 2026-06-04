'use client'

import * as React from 'react'

const DataTableSortingContext = React.createContext(false)

export function DataTableSortingProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: React.ReactNode
}) {
  return <DataTableSortingContext.Provider value={enabled}>{children}</DataTableSortingContext.Provider>
}

export function useDataTableSortingEnabled() {
  return React.useContext(DataTableSortingContext)
}

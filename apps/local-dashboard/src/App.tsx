import { useMemo, useState } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Overview } from "@/pages/Overview"
import { SkillReport } from "@/pages/SkillReport"
import { useOverview } from "@/hooks/useOverview"
import type { SkillHealthStatus, SkillSummary } from "@/types"
import { deriveStatus, sortByPassRateAndChecks } from "@/utils"

function SkillReportWithHeader() {
  return (
    <>
      <SiteHeader />
      <SkillReport />
    </>
  )
}

function DashboardShell() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<SkillHealthStatus | "ALL">("ALL")
  const overviewResult = useOverview()
  const { data } = overviewResult

  const skillNavItems = useMemo(() => {
    if (!data) return []
    return sortByPassRateAndChecks(
      data.skills.map((s: SkillSummary) => ({
        name: s.skill_name,
        scope: s.skill_scope,
        status: deriveStatus(s.pass_rate, s.total_checks),
        passRate: s.total_checks > 0 ? s.pass_rate : null,
        checks: s.total_checks,
      }))
    )
  }, [data])

  const filteredNavItems = useMemo(() => {
    if (!search) return skillNavItems
    const q = search.toLowerCase()
    return skillNavItems.filter((s) => s.name.toLowerCase().includes(q))
  }, [skillNavItems, search])

  return (
    <SidebarProvider>
      <AppSidebar
        skills={filteredNavItems}
        search={search}
        onSearchChange={setSearch}
        version={data?.version}
      />
      <SidebarInset>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <SiteHeader />
                <Overview search={search} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} overviewResult={overviewResult} />
              </>
            }
          />
          <Route path="/skills/:name" element={<SkillReportWithHeader />} />
        </Routes>
      </SidebarInset>
    </SidebarProvider>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <DashboardShell />
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

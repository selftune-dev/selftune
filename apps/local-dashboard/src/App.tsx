import { Agentation } from "agentation";
import { TooltipProvider } from "@selftune/ui/primitives";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppSidebar } from "@/components/app-sidebar";
import { RuntimeFooter } from "@/components/runtime-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useOverview } from "@/hooks/useOverview";
import { useSSE } from "@/hooks/useSSE";
import { Overview } from "@/pages/Overview";
import { PerformanceAnalytics } from "@/pages/PerformanceAnalytics";
import { SkillReport } from "@/pages/SkillReport";

import { SkillsLibrary } from "@/pages/SkillsLibrary";
import { Status } from "@/pages/Status";
import type { SkillHealthStatus } from "@/types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      gcTime: 5 * 60 * 1000,
    },
  },
});

function DashboardShell() {
  useSSE();
  const [statusFilter, setStatusFilter] = useState<SkillHealthStatus | "ALL">("ALL");
  const overviewQuery = useOverview();
  const { data } = overviewQuery;

  return (
    <SidebarProvider>
      <AppSidebar version={data?.version} />
      <SidebarInset>
        <SiteHeader />
        <Routes>
          <Route
            path="/"
            element={
              <Overview
                search=""
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                overviewQuery={overviewQuery}
              />
            }
          />
          <Route
            path="/skills-library"
            element={<SkillsLibrary overviewQuery={overviewQuery} />}
          />
          <Route path="/analytics" element={<PerformanceAnalytics />} />
          <Route path="/skills/:name" element={<SkillReport />} />
          <Route path="/status" element={<Status />} />
        </Routes>
      </SidebarInset>
      <RuntimeFooter />
    </SidebarProvider>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <DashboardShell />
            {import.meta.env.DEV && <Agentation />}
          </TooltipProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

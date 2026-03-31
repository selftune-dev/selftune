import { describe, expect, it, vi } from "vitest";

// Mock heavy external dependencies to avoid import timeouts
vi.mock("@selftune/ui/primitives", () => ({
  Badge: () => null,
  Button: () => null,
  Card: () => null,
  CardAction: () => null,
  CardContent: () => null,
  CardDescription: () => null,
  CardHeader: () => null,
  CardTitle: () => null,
  Table: () => null,
  TableBody: () => null,
  TableCell: () => null,
  TableHead: () => null,
  TableHeader: () => null,
  TableRow: () => null,
  Tabs: ({ children }: { children: unknown }) => children,
  TabsList: () => null,
  TabsTrigger: () => null,
  TabsContent: () => null,
  Tooltip: () => null,
  TooltipContent: () => null,
  TooltipTrigger: () => null,
}));

vi.mock("@selftune/ui/components", () => ({
  ActivityPanel: () => null,
  EvolutionTimeline: () => null,
  EvidenceViewer: () => null,
  InfoTip: () => null,
  OrchestrateRunsPanel: () => null,
  SectionCards: () => null,
  SkillHealthGrid: () => null,
}));

vi.mock("@selftune/ui/lib", () => ({
  STATUS_CONFIG: { UNKNOWN: { variant: "secondary", label: "Unknown", icon: null } },
  deriveStatus: () => "UNKNOWN",
  formatRate: (v: number) => `${v}%`,
  timeAgo: () => "just now",
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => null,
}));

vi.mock("react-router-dom", () => ({
  Link: () => null,
  useNavigate: () => () => {},
  useParams: () => ({ name: "test-skill" }),
  useSearchParams: () => [new URLSearchParams(), () => {}],
}));

vi.mock("lucide-react", () => ({
  AlertCircleIcon: () => null,
  ActivityIcon: () => null,
  ArrowLeftIcon: () => null,
  ArrowRightIcon: () => null,
  BarChart3Icon: () => null,
  CheckCircleIcon: () => null,
  ChevronDownIcon: () => null,
  ChevronRightIcon: () => null,
  ClockIcon: () => null,
  CoinsIcon: () => null,
  DatabaseIcon: () => null,
  EyeIcon: () => null,
  FilterIcon: () => null,
  FlaskConicalIcon: () => null,
  FolderIcon: () => null,
  GaugeIcon: () => null,
  GitBranchIcon: () => null,
  LayersIcon: () => null,
  MessageSquareTextIcon: () => null,
  RefreshCwIcon: () => null,
  RocketIcon: () => null,
  SearchIcon: () => null,
  ServerIcon: () => null,
  ShieldAlertIcon: () => null,
  ShieldCheckIcon: () => null,
  ShieldIcon: () => null,
  ShieldQuestionIcon: () => null,
  SparklesIcon: () => null,
  TargetIcon: () => null,
  AlertTriangleIcon: () => null,
  TrendingDownIcon: () => null,
  TrendingUpIcon: () => null,
  AlertOctagonIcon: () => null,
  XIcon: () => null,
}));

vi.mock("../hooks/useSkillReport", () => ({
  useSkillReport: () => ({
    data: null,
    isPending: true,
    isError: false,
    error: null,
    refetch: () => {},
  }),
}));

describe("SkillReport", () => {
  it("module exports SkillReport component", async () => {
    const { SkillReport } = await import("./SkillReport");
    expect(SkillReport).toBeDefined();
    expect(typeof SkillReport).toBe("function");
  });
});

import type {
  AnalyticsModel,
  OverviewModel,
  RuntimeHealthModel,
  SkillsModel,
} from "../models/index";

export interface DashboardUser {
  id?: string;
  name: string;
  email?: string;
  subtitle?: string;
  image?: string | null;
}

export interface DashboardSessionState {
  status: "loading" | "authenticated" | "anonymous";
  user?: DashboardUser;
}

export interface DashboardHostLinks {
  upgrade: string;
  billing?: string;
  docs?: string;
  cloudDashboard?: string;
}

export interface DashboardHostActions {
  signOut?(): Promise<void>;
  openUpgrade(): void;
  getOverviewWatchlist?(): Promise<string[]>;
  updateOverviewWatchlist?(skills: string[]): Promise<string[]>;
}

export interface DashboardApiClient {
  fetchOverview(): Promise<OverviewModel>;
  fetchSkills(): Promise<SkillsModel>;
  fetchAnalytics(): Promise<AnalyticsModel>;
  fetchRuntimeHealth?(): Promise<RuntimeHealthModel>;
}

export interface DashboardHostAdapter {
  useSession(): DashboardSessionState;
  api: DashboardApiClient;
  links: DashboardHostLinks;
  actions: DashboardHostActions;
}

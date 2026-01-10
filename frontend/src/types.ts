export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  roleLabel: string;
  isGuest: boolean;
};

export type AppShell = {
  greeting: string;
  avatarUrl: string | null;
  roleLabel: string;
};

export type DashboardSummary = {
  cycleDay: number;
  currentPhase: string;
  phaseExplanation: string;
  nextPeriodDate: string;
  ovulationDate: string;
  fertileWindow: { start: string; end: string };
  quickStats: {
    averageCycleLength: number;
    averageSleepHours: number;
    moodPositivityPercent: number;
    symptomsLogged: number;
  };
  recentActivity: Array<{ type: string; label: string; at: string }>;
  communityTeaser: CommunityMessage[];
};

export type UserProfile = {
  user: {
    id: string;
    email: string;
    displayName: string;
    roleLabel: string;
    avatarUrl: string | null;
    isGuest: boolean;
  };
  profile: {
    dateOfBirth: string | null;
    age: number | null;
    location: string | null;
    timezone: string | null;
    avgCycleLength: number | null;
    notes: string | null;
  };
};

export type CalendarDay = {
  date: string;
  day: number;
  isPeriodDay: boolean;
  isOvulationDay: boolean;
  isFertileWindow: boolean;
  hasSymptoms: boolean;
  symptoms?: string[];
  moodLabel?: string | null;
  moodTone?: "energetic" | "neutral" | "low" | null;
};

export type CalendarPayload = {
  month: number;
  year: number;
  prediction: {
    nextPeriodDate: string;
    ovulationDate: string;
    fertileWindowStart: string;
    fertileWindowEnd: string;
  };
  stats: {
    lastCycleLength: number;
    averagePeriodLength: number;
  };
  days: CalendarDay[];
};

export type CommunityChannel = {
  id: string;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
};

export type CommunityMessage = {
  id: string;
  channelId: string;
  senderName: string;
  roleLabel: string;
  body: string;
  createdAt: string;
};

export type KnowledgeArticleSummary = {
  slug: string;
  category: string;
  title: string;
  summary: string;
};

export type KnowledgeTip = {
  id: string;
  articleId: string | null;
  title: string;
  body: string;
  theme: string;
  position: number;
};

export type KnowledgeArticleDetail = {
  slug: string;
  category: string;
  title: string;
  summary: string;
  content: Array<{ heading: string; body: string }>;
  tips: KnowledgeTip[];
};

export type KnowledgeAiAnswer = {
  answer: string;
  model: string;
  relatedArticles: Array<{ slug: string; title: string }>;
};

export type AdminOverview = {
  totalUsers: number;
  totalGuests: number;
  totalAdmins: number;
  totalMessages: number;
  totalChannels: number;
  totalArticles: number;
};

export type AdminCommunityMessage = {
  id: string;
  channelId: string;
  channelName: string;
  userId: string | null;
  senderName: string;
  roleLabel: string;
  body: string;
  createdAt: string;
};

export type AdminKnowledgeArticle = {
  id: string;
  slug: string;
  category: string;
  title: string;
  summary: string;
  content: Array<{ heading: string; body: string }>;
  updatedAt: string;
};

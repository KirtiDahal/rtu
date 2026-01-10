import type {
  AdminCommunityMessage,
  AdminKnowledgeArticle,
  AdminOverview,
  AppShell,
  AuthUser,
  CalendarPayload,
  CommunityChannel,
  CommunityMessage,
  DashboardSummary,
  UserProfile,
  KnowledgeArticleDetail,
  KnowledgeAiAnswer,
  KnowledgeArticleSummary
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type ApiError = {
  message: string;
};

type RequestOptions = RequestInit & {
  skipAuthRefresh?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshAuthSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include"
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { skipAuthRefresh, ...requestInit } = init ?? {};

  let response = await fetch(`${API_BASE}${path}`, {
    ...requestInit,
    headers: {
      "Content-Type": "application/json",
      ...(requestInit.headers ?? {})
    },
    credentials: "include"
  });

  if (response.status === 401 && !skipAuthRefresh) {
    const refreshed = await refreshAuthSession();
    if (refreshed) {
      response = await fetch(`${API_BASE}${path}`, {
        ...requestInit,
        headers: {
          "Content-Type": "application/json",
          ...(requestInit.headers ?? {})
        },
        credentials: "include"
      });
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Partial<ApiError>;
    throw new Error(body.message ?? `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export const api = {
  auth: {
    me: () => request<{ user: AuthUser; appShell: AppShell }>("/auth/me"),
    login: (email: string, password: string) =>
      request<{ user: AuthUser; appShell: AppShell }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuthRefresh: true
      }),
    register: (email: string, password: string, displayName: string) =>
      request<{ user: AuthUser; appShell: AppShell }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName }),
        skipAuthRefresh: true
      }),
    guest: () =>
      request<{ user: AuthUser; appShell: AppShell }>("/auth/guest", {
        method: "POST",
        skipAuthRefresh: true
      }),
    logout: () =>
      request<void>("/auth/logout", {
        method: "POST",
        skipAuthRefresh: true
      })
  },
  dashboard: {
    summary: () => request<DashboardSummary>("/dashboard/summary")
  },
  profile: {
    get: () => request<UserProfile>("/profile"),
    update: (payload: {
      displayName?: string;
      email?: string;
      avatarUrl?: string | null;
      dateOfBirth?: string | null;
      age?: number | null;
      location?: string | null;
      timezone?: string | null;
      avgCycleLength?: number | null;
      notes?: string | null;
    }) =>
      request<UserProfile>("/profile", {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    updatePassword: (payload: { currentPassword: string; newPassword: string }) =>
      request<void>("/profile/password", {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    delete: () =>
      request<void>("/profile", {
        method: "DELETE"
      })
  },
  calendar: {
    get: (month?: number, year?: number) =>
      request<CalendarPayload>(
        `/calendar${month && year ? `?month=${month}&year=${year}` : ""}`
      )
  },
  logs: {
    period: (payload: { startDate: string; endDate?: string; flow?: number; notes?: string }) =>
      request("/logs/period", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    mood: (payload: { date: string; mood: number; label: string; notes?: string }) =>
      request("/logs/mood", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    deleteMoodByDate: (date: string) =>
      request<void>(`/logs/mood?date=${encodeURIComponent(date)}`, {
        method: "DELETE"
      }),
    symptoms: (payload: { date: string; symptoms: string[]; notes?: string }) =>
      request("/logs/symptoms", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    deleteSymptomsByDate: (date: string) =>
      request<void>(`/logs/symptoms?date=${encodeURIComponent(date)}`, {
        method: "DELETE"
      }),
    sleep: (payload: { date: string; hours: number; quality: number }) =>
      request("/logs/sleep", {
        method: "POST",
        body: JSON.stringify(payload)
      })
  },
  community: {
    channels: () => request<CommunityChannel[]>("/community/channels"),
    messages: (channelId: string) =>
      request<CommunityMessage[]>(`/community/channels/${channelId}/messages`),
    postMessage: (channelId: string, body: string) =>
      request<CommunityMessage>(`/community/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body })
      })
  },
  knowledge: {
    list: (params?: { category?: string; search?: string }) => {
      const query = new URLSearchParams();
      if (params?.category) {
        query.set("category", params.category);
      }
      if (params?.search) {
        query.set("search", params.search);
      }
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return request<KnowledgeArticleSummary[]>(`/knowledge/articles${suffix}`);
    },
    detail: (slug: string) => request<KnowledgeArticleDetail>(`/knowledge/articles/${slug}`),
    ask: (query: string) =>
      request<KnowledgeAiAnswer>("/knowledge/ask", {
        method: "POST",
        body: JSON.stringify({ query })
      })
  },
  admin: {
    overview: () => request<AdminOverview>("/admin/overview"),
    messages: (limit = 50) => request<AdminCommunityMessage[]>(`/admin/community/messages?limit=${limit}`),
    deleteMessage: (id: string) =>
      request<void>(`/admin/community/messages/${id}`, {
        method: "DELETE"
      }),
    createChannel: (payload: { slug: string; name: string; description: string; memberCount?: number }) =>
      request<{ id: string; slug: string; name: string; description: string; memberCount: number }>(
        "/admin/community/channels",
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      ),
    knowledgeArticles: () => request<AdminKnowledgeArticle[]>("/admin/knowledge/articles"),
    createKnowledgeArticle: (payload: {
      slug: string;
      category: string;
      title: string;
      summary: string;
      content: Array<{ heading: string; body: string }>;
    }) =>
      request<AdminKnowledgeArticle>("/admin/knowledge/articles", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    updateKnowledgeArticle: (
      id: string,
      payload: Partial<{
        slug: string;
        category: string;
        title: string;
        summary: string;
        content: Array<{ heading: string; body: string }>;
      }>
    ) =>
      request<AdminKnowledgeArticle>(`/admin/knowledge/articles/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    deleteKnowledgeArticle: (id: string) =>
      request<void>(`/admin/knowledge/articles/${id}`, {
        method: "DELETE"
      })
  }
};

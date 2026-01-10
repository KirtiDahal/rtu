import { fireEvent, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppLayout } from "../components/AppLayout";
import { CalendarPage } from "../pages/CalendarPage";
import { CommunityPage } from "../pages/CommunityPage";
import { DashboardPage } from "../pages/DashboardPage";
import { KnowledgePage } from "../pages/KnowledgePage";

const { postMessageMock } = vi.hoisted(() => ({
  postMessageMock: vi.fn().mockResolvedValue({
    id: "m2",
    channelId: "c1",
    senderName: "Sarah M.",
    roleLabel: "Member",
    body: "Happy path",
    createdAt: new Date().toISOString()
  })
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "sarah@example.com",
      displayName: "Sarah M.",
      avatarUrl: null,
      roleLabel: "Member",
      isGuest: false
    },
    appShell: null,
    loading: false,
    logout: vi.fn()
  })
}));

vi.mock("../lib/socket", () => ({
  socket: {
    connect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}));

vi.mock("../lib/api", () => ({
  api: {
    dashboard: {
      summary: vi.fn().mockResolvedValue({
        cycleDay: 12,
        currentPhase: "follicular",
        phaseExplanation: "Energy and focus are rising.",
        nextPeriodDate: "2026-03-30",
        ovulationDate: "2026-03-18",
        fertileWindow: { start: "2026-03-14", end: "2026-03-19" },
        quickStats: { averageCycleLength: 28, averageSleepHours: 7.4, moodPositivityPercent: 85, symptomsLogged: 2 },
        recentActivity: [],
        communityTeaser: []
      })
    },
    calendar: {
      get: vi.fn().mockResolvedValue({
        month: 3,
        year: 2026,
        prediction: {
          nextPeriodDate: "2026-03-30",
          ovulationDate: "2026-03-18",
          fertileWindowStart: "2026-03-14",
          fertileWindowEnd: "2026-03-19"
        },
        stats: { lastCycleLength: 28, averagePeriodLength: 5 },
        days: Array.from({ length: 31 }, (_, index) => ({
          date: `2026-03-${String(index + 1).padStart(2, "0")}`,
          day: index + 1,
          isPeriodDay: false,
          isOvulationDay: false,
          isFertileWindow: false,
          hasSymptoms: false
        }))
      })
    },
    community: {
      channels: vi.fn().mockResolvedValue([
        { id: "c1", slug: "general", name: "General Support", description: "", memberCount: 100 }
      ]),
      messages: vi.fn().mockResolvedValue([]),
      postMessage: postMessageMock
    },
    knowledge: {
      list: vi.fn().mockResolvedValue([
        { slug: "menstrual-cycle-101", category: "Basics", title: "Menstrual Cycle 101", summary: "Basics" }
      ]),
      detail: vi.fn().mockResolvedValue({
        slug: "menstrual-cycle-101",
        category: "Basics",
        title: "Menstrual Cycle 101",
        summary: "Basics",
        content: [{ heading: "Normal length", body: "21-35 days." }],
        tips: []
      }),
      ask: vi.fn().mockResolvedValue({
        answer: "AI fallback answer",
        model: "nvidia/nemotron-3-super-120b-a12b:free",
        relatedArticles: []
      })
    }
  }
}));

describe("happy path flow", () => {
  it("navigates dashboard to calendar to community to knowledge", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const ui = (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/community" element={<CommunityPage />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const { container } = await import("@testing-library/react").then(({ render }) => render(ui));

    expect(await screen.findByText(/Good morning, Sarah/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Calendar/i }));
    expect(await screen.findByText("Your Cycle Calendar")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Community/i }));
    fireEvent.change(await screen.findByPlaceholderText("Type a message..."), {
      target: { value: "Happy path" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(postMessageMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("link", { name: /Knowledge/i }));
    expect(await screen.findByText("How can we help you today?")).toBeInTheDocument();
    expect(container).toBeTruthy();
  });
});

import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarPage } from "../pages/CalendarPage";
import { renderWithProviders } from "./render";

vi.mock("../lib/api", () => ({
  api: {
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
          isPeriodDay: index < 4,
          isOvulationDay: index === 17,
          isFertileWindow: index > 13 && index < 20,
          hasSymptoms: index === 9
        }))
      })
    }
  }
}));

describe("CalendarPage", () => {
  it("renders calendar grid data", async () => {
    renderWithProviders(<CalendarPage />);
    expect(await screen.findByText("Your Cycle Calendar")).toBeInTheDocument();
    expect(await screen.findByText("31")).toBeInTheDocument();
  });
});

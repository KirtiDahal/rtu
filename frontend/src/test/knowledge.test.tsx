import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgePage } from "../pages/KnowledgePage";
import { renderWithProviders } from "./render";

const { askMock } = vi.hoisted(() => ({
  askMock: vi.fn().mockResolvedValue({
    answer: "AI fallback answer",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    relatedArticles: []
  })
}));

vi.mock("../lib/api", () => ({
  api: {
    knowledge: {
      list: vi.fn().mockResolvedValue([
        {
          slug: "menstrual-cycle-101",
          category: "Basics",
          title: "Menstrual Cycle 101",
          summary: "Foundational guide"
        },
        {
          slug: "fueling-your-cycle",
          category: "Nutrition",
          title: "Fueling Your Cycle",
          summary: "Food and hormones"
        }
      ]),
      detail: vi.fn().mockResolvedValue({
        slug: "menstrual-cycle-101",
        category: "Basics",
        title: "Menstrual Cycle 101",
        summary: "Foundational guide",
        content: [{ heading: "What is normal?", body: "A healthy range is often 21-35 days." }],
        tips: []
      }),
      ask: askMock
    }
  }
}));

describe("KnowledgePage", () => {
  beforeEach(() => {
    askMock.mockClear();
  });

  it("filters articles by search text", async () => {
    renderWithProviders(<KnowledgePage />);
    expect(await screen.findByText("Menstrual Cycle 101")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Search for luteal phase/i), {
      target: { value: "Fueling" }
    });
    expect(await screen.findByText("Fueling Your Cycle")).toBeInTheDocument();
  });

  it("falls back to AI answer when no FAQ matches search", async () => {
    renderWithProviders(<KnowledgePage />);
    fireEvent.change(await screen.findByPlaceholderText(/Search for luteal phase/i), {
      target: { value: "unlisted query" }
    });
    expect(askMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Ask AI/i }));

    expect(await screen.findByText("Kuromi Companion")).toBeInTheDocument();
    expect(await screen.findByText("AI fallback answer")).toBeInTheDocument();
    expect(askMock).toHaveBeenCalledWith("unlisted query");
  });

  it("asks AI even when FAQ matches exist", async () => {
    renderWithProviders(<KnowledgePage />);
    fireEvent.change(await screen.findByPlaceholderText(/Search for luteal phase/i), {
      target: { value: "menstrual" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Ask AI/i }));

    expect(await screen.findByText("AI fallback answer")).toBeInTheDocument();
    expect(askMock).toHaveBeenCalledWith("menstrual");
  });
});

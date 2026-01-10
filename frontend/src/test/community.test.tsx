import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommunityPage } from "../pages/CommunityPage";
import { renderWithProviders } from "./render";

const { postMessageMock } = vi.hoisted(() => ({
  postMessageMock: vi.fn().mockResolvedValue({
    id: "m-2",
    channelId: "c-1",
    senderName: "Sarah",
    roleLabel: "Member",
    body: "Hello group",
    createdAt: new Date().toISOString()
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
    community: {
      channels: vi.fn().mockResolvedValue([
        { id: "c-1", slug: "general", name: "General Support", description: "desc", memberCount: 10 }
      ]),
      messages: vi.fn().mockResolvedValue([
        {
          id: "m-1",
          channelId: "c-1",
          senderName: "Elena",
          roleLabel: "Member",
          body: "Welcome",
          createdAt: new Date().toISOString()
        }
      ]),
      postMessage: postMessageMock
    }
  }
}));

describe("CommunityPage", () => {
  it("posts message from composer", async () => {
    renderWithProviders(<CommunityPage />);
    expect(await screen.findByText("General Support")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Type a message..."), {
      target: { value: "Hello group" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => {
      expect(postMessageMock).toHaveBeenCalledWith("c-1", "Hello group");
    });
  });
});

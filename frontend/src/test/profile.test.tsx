import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfilePage } from "../pages/ProfilePage";
import { renderWithProviders } from "./render";

const { updateMock, updatePasswordMock, deleteProfileMock } = vi.hoisted(() => ({
  updateMock: vi.fn().mockResolvedValue({
    user: {
      id: "u1",
      email: "sarah@example.com",
      displayName: "Sarah M.",
      roleLabel: "Member",
      avatarUrl: null,
      isGuest: false
    },
    profile: {
      dateOfBirth: "2000-01-01",
      age: 26,
      location: "Kathmandu",
      timezone: "Asia/Kathmandu",
      avgCycleLength: 28,
      notes: "Updated notes"
    }
  }),
  updatePasswordMock: vi.fn().mockResolvedValue(undefined),
  deleteProfileMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    refreshSession: vi.fn().mockResolvedValue(undefined)
  })
}));

vi.mock("../lib/api", () => ({
  api: {
    profile: {
      get: vi.fn().mockResolvedValue({
        user: {
          id: "u1",
          email: "sarah@example.com",
          displayName: "Sarah M.",
          roleLabel: "Member",
          avatarUrl: null,
          isGuest: false
        },
        profile: {
          dateOfBirth: "2000-01-01",
          age: 24,
          location: "Kathmandu",
          timezone: "Asia/Kathmandu",
          avgCycleLength: 28,
          notes: "Initial note"
        }
      }),
      update: updateMock,
      updatePassword: updatePasswordMock,
      delete: deleteProfileMock
    }
  }
}));

describe("ProfilePage", () => {
  it("renders profile and saves updates", async () => {
    renderWithProviders(<ProfilePage />);
    expect(await screen.findByText("Your Profile")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Age$/i), { target: { value: "26" } });
    fireEvent.change(screen.getByLabelText(/Notes/i), { target: { value: "Updated notes" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Profile/i }));

    await vi.waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(await screen.findByText("Profile updated successfully.")).toBeInTheDocument();
  });
});

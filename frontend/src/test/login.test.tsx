import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "../pages/LoginPage";
import { renderWithProviders } from "./render";

const navigateMock = vi.fn();
const loginMock = vi.fn().mockResolvedValue(undefined);
const registerMock = vi.fn().mockResolvedValue(undefined);
const guestMock = vi.fn().mockResolvedValue(undefined);

vi.mock("react-router-dom", async (importOriginal) => {
  const module = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...module,
    useNavigate: () => navigateMock
  };
});

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    login: loginMock,
    register: registerMock,
    continueAsGuest: guestMock
  })
}));

describe("LoginPage", () => {
  it("submits login form", async () => {
    renderWithProviders(<LoginPage />);
    const submit = document.querySelector('button[type="submit"]');
    if (!submit) {
      throw new Error("Submit button not found");
    }
    fireEvent.click(submit);
    await vi.waitFor(() => {
      expect(loginMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});

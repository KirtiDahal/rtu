import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../components/RouteGuards";
import { renderWithProviders } from "./render";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    loading: false
  })
}));

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to login", () => {
    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      "/dashboard"
    );
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });
});

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isAdminRole } from "../lib/roles";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="screen-center">Loading your wellness space...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="screen-center">Loading...</div>;
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

export function AdminRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="screen-center">Loading admin workspace...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdminRole(user.roleLabel)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

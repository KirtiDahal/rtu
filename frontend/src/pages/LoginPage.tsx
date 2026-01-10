import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register, continueAsGuest } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("Sarah M.");
  const [email, setEmail] = useState("sarah@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (tab === "register") {
        await register(email, password, displayName);
      } else {
        await login(email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <section className="login-hero">
          <p className="hero-mini">End-to-End Encrypted Data</p>
          <h1>
            Understand your
            <br />
            body&apos;s <span>natural rhythm.</span>
          </h1>
          <p>
            Join over 20,000 users who trust Rtu for period predictions, symptom logging, and
            anonymous support.
          </p>
          <ul>
            <li>
              <strong>Mood Tracking</strong>
              <span>Log daily emotions effortlessly.</span>
            </li>
            <li>
              <strong>Smart Predictions</strong>
              <span>AI-inspired cycle forecasting.</span>
            </li>
          </ul>
        </section>

        <section className="login-form-wrap">
          <div className="tab-pill">
            <button
              className={tab === "login" ? "active" : ""}
              type="button"
              onClick={() => setTab("login")}
            >
              Log In
            </button>
            <button
              className={tab === "register" ? "active" : ""}
              type="button"
              onClick={() => setTab("register")}
            >
              Register
            </button>
          </div>
          <h2>Welcome back</h2>
          <p>Enter your credentials to access your dashboard.</p>
          <form onSubmit={onSubmit} className="auth-form">
            {tab === "register" && (
              <label>
                Display Name
                <input
                  placeholder="Sarah M."
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
            )}
            <label>
              Email Address
              <input
                placeholder="sarah@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                placeholder="********"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="primary-btn" disabled={pending}>
              {pending ? "Logging in..." : tab === "login" ? "Log In" : "Create Account"}
            </button>
          </form>
          <div className="or-divider">OR</div>
          <button
            className="secondary-btn"
            type="button"
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await continueAsGuest();
                navigate("/dashboard");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setPending(false);
              }
            }}
            disabled={pending}
          >
            {pending ? "Loading..." : "Continue as Anonymous Guest"}
          </button>
        </section>
      </div>
      <footer className="login-footer">(c) 2026 Rtu - Safety Center - Privacy First</footer>
    </div>
  );
}

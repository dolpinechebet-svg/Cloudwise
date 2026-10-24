import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Cloud, Eye, EyeOff, LoaderCircle, Mail } from "lucide-react";
import { Button } from "../components/ui/button";

export type AuthMode = "signin" | "signup";
export type AuthResult = { ok: true; message?: string } | { ok: false; message: string };

interface AuthPageProps {
  configured: boolean;
  busy: boolean;
  onSubmit: (mode: AuthMode, email: string, password: string, displayName: string) => Promise<AuthResult>;
  onForgotPassword: (email: string) => Promise<AuthResult>;
}

export default function AuthPage({ configured, busy, onSubmit, onForgotPassword }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(() => window.location.search.includes("mode=signup") ? "signup" : "signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }
    if (mode === "signup" && !displayName.trim()) {
      setError("Enter your display name.");
      return;
    }

    const result = await onSubmit(mode, normalizedEmail, password, displayName.trim());
    if (result.ok) setMessage(result.message ?? "");
    else setError(result.message);
  }

  async function forgotPassword() {
    setError("");
    setMessage("");
    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address first.");
      return;
    }
    setRecoveryBusy(true);
    const result = await onForgotPassword(normalizedEmail);
    if (result.ok) setMessage(result.message ?? "");
    else setError(result.message);
    setRecoveryBusy(false);
  }

  return (
    <main className="welcome-page auth-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Cloudwise home">
          <span className="brand-icon"><Cloud size={21} strokeWidth={2.5} /></span>
          <span>cloudwise<span className="brand-period">.</span></span>
        </a>
        <a className="back-link" href="/"><ArrowLeft size={16} />{"Home"}</a>
      </header>

      <section className="auth-page-content">
        <div className="auth-page-intro">
          <div className="eyebrow"><span className="eyebrow-dot" />{"YOUR CLOUD JOURNEY, MADE CLEAR"}</div>
          <h1>{"A little progress, whenever you're ready."}</h1>
          <p>{"Sign in to continue your AZ-900 study journey, or create an account to save your progress."}</p>
        </div>

        <section className="auth-card auth-route-card" aria-labelledby="auth-title">
          <div className="auth-card-heading">
            <div>
              <span className="card-kicker">{"CLOUDWISE ACCOUNT"}</span>
              <h2 id="auth-title">{mode === "signup" ? "Create account" : "Log in"}</h2>
            </div>
            <div className="auth-mark"><Cloud size={22} /></div>
          </div>

          <div className="auth-tabs" role="tablist" aria-label={"Account access"}>
            <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "auth-tab active" : "auth-tab"} onClick={() => changeMode("signin")}>{"Log in"}</button>
            <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "auth-tab active" : "auth-tab"} onClick={() => changeMode("signup")}>{"Create account"}</button>
          </div>

          {!configured ? (
            <div className="setup-notice" role="status">
              <span className="notice-icon"><Cloud size={19} /></span>
              <p>{"Online sign-in is ready to connect. Add your Supabase URL and anon key to .env.local to enable accounts."}</p>
            </div>
          ) : (
            <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
              {mode === "signup" && (
                <>
                  <label htmlFor="display-name">{"Display name"}</label>
                  <input id="display-name" name="name" type="text" autoComplete="name" maxLength={80} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </>
              )}
              <label htmlFor="auth-email">{"Email address"}</label>
              <input id="auth-email" name="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              <label htmlFor="auth-password">{"Password"}</label>
              <div className="password-field">
                <input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
                <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {mode === "signin" && (
                <button className="text-button forgot-password" type="button" onClick={() => void forgotPassword()} disabled={busy || recoveryBusy}>
                  {recoveryBusy ? <LoaderCircle size={14} className="spin" /> : <Mail size={14} />}
                  {"Forgot password?"}
                </button>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
              {message && <p className="form-success" role="status">{message}</p>}
              <Button className="auth-submit" type="submit" size="large" disabled={busy || recoveryBusy}>
                {busy ? <><LoaderCircle size={18} className="spin" />{"Please wait…"}</> : <>{mode === "signup" ? "Create account" : "Log in"}<ArrowRight size={18} /></>}
              </Button>
            </form>
          )}
        </section>
      </section>

      <footer className="site-footer auth-page-footer">
        <span>cloudwise<span className="brand-period">.</span></span>
        <span className="footer-disclaimer">{"Unofficial AZ-900 study tool. Not affiliated with or endorsed by Microsoft."}</span>
      </footer>
    </main>
  );
}

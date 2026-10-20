import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpenCheck, Cloud, LoaderCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "../components/ui/button";
import { isSupabaseConfigured } from "../lib/supabase";

export interface WelcomeProps {
  onAuth: (mode: "signin" | "signup", email: string, password: string) => Promise<boolean>;
  onGoogle: () => Promise<void>;
  onDemo: () => void;
  error: string;
  busy: boolean;
  clearError: () => void;
}

export default function Welcome({
  onAuth, onGoogle, onDemo, error, busy, clearError
}: WelcomeProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    setMessage("");
    const succeeded = await onAuth(mode, email, password);
    if (mode === "signup" && succeeded) {
      setMessage("If email confirmation is enabled, check your inbox to finish creating your account.");
    }
  }

  return (
    <main className="welcome-page">
      <header className="topbar">
        <a className="brand" href="#welcome" aria-label="Cloudwise home">
          <span className="brand-icon"><Cloud size={21} strokeWidth={2.5} /></span>
          <span>cloudwise<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-actions">
          <span className="topbar-caption">{"Your learning journey, at your pace."}</span>
        </div>
      </header>

      <section className="welcome-grid" id="welcome">
        <div className="welcome-copy">
          <div className="eyebrow"><span className="eyebrow-dot" />{"YOUR CLOUD JOURNEY, MADE CLEAR"}</div>
          <h1>{"Big cloud ideas. Made wonderfully simple."}</h1>
          <p className="hero-description">{"A friendly study companion to help you feel ready for Azure Fundamentals, one small win at a time."}</p>

          <div className="welcome-benefits">
            <div className="benefit">
              <span className="benefit-icon"><BookOpenCheck size={19} /></span>
              <span>{"15 thoughtful questions"}</span>
            </div>
            <div className="benefit">
              <span className="benefit-icon"><ShieldCheck size={19} /></span>
              <span>{"A calm, no-pressure pace"}</span>
            </div>
            <div className="benefit">
              <span className="benefit-icon"><Zap size={19} /></span>
              <span>{"Built for curious beginners"}</span>
            </div>
          </div>

          <div className="hero-note">
            <span className="note-sparkle"><Sparkles size={17} /></span>
            <span>{"Small steps count. Start wherever you are."}</span>
          </div>
        </div>

        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card-heading">
            <div>
              <span className="card-kicker">{mode === "signup" ? "YOUR NEXT CHAPTER" : "WELCOME BACK"}</span>
              <h2 id="auth-title">{mode === "signup" ? "Start learning" : "Sign in"}</h2>
            </div>
            <div className="auth-mark"><Cloud size={22} /></div>
          </div>

          {isSupabaseConfigured ? (
            <>
              <Button className="google-button" type="button" variant="secondary" size="large" disabled={busy} onClick={() => void onGoogle()}>
                <GoogleMark />
                {"Continue with Google"}
              </Button>
              <div className="divider"><span>{"or continue with email"}</span></div>
              <form className="auth-form" onSubmit={(event) => void submit(event)}>
                <label htmlFor="email">{"Email address"}</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <label htmlFor="password">{"Password"}</label>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={6}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Button className="auth-submit" type="submit" size="large" disabled={busy}>
                  {busy ? <LoaderCircle size={18} className="spin" /> : <>{mode === "signup" ? "Create account" : "Sign in"}<ArrowRight size={18} /></>}
                </Button>
              </form>
              <button
                className="text-button auth-switch"
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  clearError();
                  setMessage("");
                }}
              >
                {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
              </button>
            </>
          ) : (
            <div className="setup-notice" role="status">
              <span className="notice-icon"><Cloud size={19} /></span>
              <p>{"Online sign-in is ready to connect. Add your Supabase URL and anon key to .env.local to enable accounts."}</p>
            </div>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}

          <div className="auth-bottom">
            <span className="auth-bottom-line" />
            <span>{"or"}</span>
            <span className="auth-bottom-line" />
          </div>
          <Button className="demo-button" type="button" variant="quiet" size="large" onClick={onDemo}>
            {"Explore a demo"} <ArrowRight size={17} />
          </Button>
          <p className="demo-note">{"No account needed · Your demo progress stays on this device"}</p>
        </section>
      </section>

      <footer className="site-footer">
        <span>{"Made for curious minds, wherever you are."}</span>
        <span className="footer-disclaimer">{"Unofficial AZ-900 study tool. Not affiliated with or endorsed by Microsoft."}</span>
      </footer>
    </main>
  );
}

function GoogleMark() {
  return <span className="google-mark" aria-hidden="true">G</span>;
}

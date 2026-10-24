import { ArrowRight, BookOpenCheck, Cloud, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "../components/ui/button";
import { isSupabaseConfigured } from "../lib/supabase";

interface WelcomeProps {
  onDemo: () => void;
}

export default function Welcome({ onDemo }: WelcomeProps) {
  return (
    <main className="welcome-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Cloudwise home">
          <span className="brand-icon"><Cloud size={21} strokeWidth={2.5} /></span>
          <span>cloudwise<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-actions">
          <span className="topbar-caption">{"Your learning journey, at your pace."}</span>
          <a className="button button-secondary button-default landing-login" href="/auth">{"Log in"}</a>
        </div>
      </header>

      <section className="welcome-grid" id="welcome">
        <div className="welcome-copy">
          <div className="eyebrow"><span className="eyebrow-dot" />{"YOUR CLOUD JOURNEY, MADE CLEAR"}</div>
          <h1>{"Big cloud ideas. Made wonderfully simple."}</h1>
          <p className="hero-description">{"A friendly study companion to help you feel ready for Azure Fundamentals, one small win at a time."}</p>

          <div className="welcome-benefits">
            <div className="benefit"><span className="benefit-icon"><BookOpenCheck size={19} /></span><span>{"Practice questions across the AZ-900 domains"}</span></div>
            <div className="benefit"><span className="benefit-icon"><ShieldCheck size={19} /></span><span>{"A calm, no-pressure pace"}</span></div>
            <div className="benefit"><span className="benefit-icon"><Zap size={19} /></span><span>{"Built for curious beginners"}</span></div>
          </div>

          <div className="hero-note">
            <span className="note-sparkle"><Sparkles size={17} /></span>
            <span>{"Small steps count. Start wherever you are."}</span>
          </div>
        </div>

        <section className="auth-card landing-card" aria-labelledby="welcome-title">
          <div className="auth-card-heading">
            <div>
              <span className="card-kicker">{"YOUR NEXT CHAPTER"}</span>
              <h2 id="welcome-title">{"Ready when you are."}</h2>
            </div>
            <div className="auth-mark"><Cloud size={22} /></div>
          </div>
          <p className="landing-card-copy">{"Create an account to keep your study progress, or sign in and pick up where you left off."}</p>
          <a className="button button-primary button-large landing-primary" href="/auth?mode=signup">
            {"Create account"}<ArrowRight size={18} />
          </a>
          {!isSupabaseConfigured && (
            <div className="setup-notice landing-setup" role="status">
              <span className="notice-icon"><Cloud size={19} /></span>
              <p>{"Online sign-in is ready to connect. Add your Supabase URL and anon key to .env.local to enable accounts."}</p>
            </div>
          )}
          <div className="auth-bottom"><span className="auth-bottom-line" /><span>{"or"}</span><span className="auth-bottom-line" /></div>
          <Button className="demo-button" type="button" variant="quiet" size="large" onClick={onDemo}>
            {"Explore a demo"}<ArrowRight size={17} />
          </Button>
          <p className="demo-note">{"No account needed · Demo progress stays on this device"}</p>
        </section>
      </section>

      <footer className="site-footer">
        <span>{"Made for curious minds, wherever you are."}</span>
        <span className="footer-disclaimer">{"Unofficial AZ-900 study tool. Not affiliated with or endorsed by Microsoft."}</span>
      </footer>
    </main>
  );
}

import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { Button } from "../components/ui/button";
import type { Profile } from "../types";

interface OnboardingProps {
  initialName: string;
  onSubmit: (profile: Profile) => Promise<void>;
  onBack: () => void;
  busy: boolean;
  error: string;
}

export default function Onboarding({ initialName, onSubmit, onBack, busy, error }: OnboardingProps) {
  const [examDate, setExamDate] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState(4);
  const today = new Date();
  const minExamDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      display_name: initialName || "Learner",
      exam_date: examDate,
      hours_per_week: hoursPerWeek
    });
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-top">
        <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={17} /> {"Back"}</button>
        <span className="step-indicator"><span className="step-active" /> <span /></span>
        <span className="step-label">01 / 02</span>
      </div>

      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <div className="onboarding-art" aria-hidden="true">
          <div className="sun-circle" />
          <div className="cloud-shape"><span /><span /><span /></div>
          <div className="art-line art-line-one" />
          <div className="art-line art-line-two" />
          <div className="art-caption">{"YOUR JOURNEY, YOUR PACE"}</div>
        </div>

        <div className="onboarding-form-wrap">
          <span className="card-kicker">{"A GOOD PLACE TO BEGIN"}</span>
          <h1 id="onboarding-title">{"Make a little room for learning."}</h1>
          <p className="onboarding-intro">{"A few details help us shape a study routine that fits your life."}</p>

          <form className="onboarding-form" onSubmit={(event) => void submit(event)}>
            <label htmlFor="exam-date"><CalendarDays size={17} />{"When are you hoping to sit your exam?"}</label>
            <input id="exam-date" type="date" min={minExamDate} required value={examDate} onChange={(event) => setExamDate(event.target.value)} />

            <label htmlFor="hours"><Clock3 size={17} />{"Study hours each week"}</label>
            <div className="hours-control">
              <input id="hours" type="range" min="1" max="20" value={hoursPerWeek} onChange={(event) => setHoursPerWeek(Number(event.target.value))} />
              <output htmlFor="hours"><strong>{hoursPerWeek}</strong><span>{"hrs"}</span></output>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" className="onboarding-submit" size="large" disabled={busy}>
              {busy ? "Getting things ready…" : "Continue"} <ArrowRight size={18} />
            </Button>
          </form>
        </div>
      </section>
      <footer className="site-footer onboarding-footer">
        <span>cloudwise<span className="brand-period">.</span></span>
        <span className="footer-disclaimer">{"Unofficial AZ-900 study tool. Not affiliated with or endorsed by Microsoft."}</span>
      </footer>
    </main>
  );
}

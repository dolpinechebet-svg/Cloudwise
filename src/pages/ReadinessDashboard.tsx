import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, BookOpenCheck, ChartNoAxesColumn, CircleHelp, RotateCcw } from "lucide-react";
import { Button } from "../components/ui/button";
import type { ReadinessSummary } from "../types";

interface ReadinessDashboardProps {
  summary: ReadinessSummary;
  busy: boolean;
  onRefresh: () => void;
  onPracticeTopic: (topic: string) => void;
  onFlashcards: () => void;
  onDiagnostic: () => void;
}

export default function ReadinessDashboard({
  summary, busy, onRefresh, onPracticeTopic, onFlashcards, onDiagnostic
}: ReadinessDashboardProps) {
  const score = summary.score ?? 0;
  const ready = summary.score !== null && score >= 80 && summary.totalAttempts >= 25;
  const level = ready ? "Exam ready" : score >= 60 ? "Almost there" : "Not yet";
  const totalDomainWeight = summary.domains.reduce((total, domain) => total + domain.weight, 0) || 1;
  const chartData = summary.topics.map((item) => ({
    ...item,
    label: item.topic.length > 22 ? `${item.topic.slice(0, 20)}…` : item.topic
  }));

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" />{"YOUR LEARNING, AT A GLANCE"}</div>
          <h1>{"Your readiness, taking shape."}</h1>
          <p>{"Every attempt is a useful signal. Here’s what yours are telling us so far."}</p>
        </div>
        <Button variant="secondary" onClick={onRefresh} disabled={busy}>
          <RotateCcw size={16} />{"Refresh"}
        </Button>
      </section>

      {busy && <p className="dashboard-loading" role="status">{"Getting things ready…"}</p>}

      {busy && summary.totalAttempts === 0 ? (
        <DashboardSkeleton label={"Getting things ready…"} />
      ) : <section className="readiness-overview" aria-label={"Readiness overview"}>
        <div className="readiness-ring-card">
          <div
            className="readiness-ring"
            role="progressbar"
            aria-label={"Readiness score"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.score ?? 0}
            style={{ "--readiness-progress": `${score * 3.6}deg` } as React.CSSProperties}
          >
            <div className="readiness-ring-inner">
              <strong>{summary.score === null ? "—" : `${score}%`}</strong>
              <span>{"Readiness score"}</span>
            </div>
          </div>
          <div className="readiness-copy">
            <span className={`readiness-label ${ready ? "level-ready" : score >= 60 ? "level-almost" : "level-not-yet"}`}>{level}</span>
            <p>{summary.totalAttempts} {"questions attempted"}</p>
            {summary.totalAttempts < 25 && (
              <span className="confidence-note"><CircleHelp size={15} />{`A confidence estimate improves after ${25 - summary.totalAttempts} more questions.`}</span>
            )}
          </div>
        </div>

        <div className="domain-score-list">
          {summary.domains.map((item) => (
            <article className="domain-score-card" key={item.domain}>
              <div className="domain-score-title">
                <span className="domain-mark" />
                <strong>{item.domain}</strong>
              </div>
              <div className="domain-score-value">{item.accuracy === null ? "—" : `${item.accuracy}%`}</div>
              <div className="domain-score-track" aria-hidden="true">
                <span style={{ width: `${item.accuracy ?? 0}%` }} />
              </div>
              <span className="domain-weight-note">{`${Math.round((item.weight / totalDomainWeight) * 100)}% domain weight`}</span>
            </article>
          ))}
        </div>
      </section>}

      <section className="dashboard-section" aria-labelledby="topic-chart-title">
        <div className="section-heading">
          <div>
            <span className="card-kicker">{"YOUR PROGRESS SO FAR"}</span>
            <h2 id="topic-chart-title">{"Accuracy by topic"}</h2>
          </div>
          <span className="chart-caption">{"Recent attempts · last 10 per topic"}</span>
        </div>
        {busy && !chartData.length ? (
          <div className="skeleton-chart" role="status" aria-label={"Getting things ready…"}>
            <span className="skeleton-line skeleton-wide" />
            <span className="skeleton-line" />
            <span className="skeleton-line skeleton-medium" />
          </div>
        ) : chartData.length ? (
          <div className="topic-chart" role="img" aria-label={"Accuracy for your recent attempts by topic"}>
            <ResponsiveContainer width="100%" height={Math.max(230, chartData.length * 54)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 32, left: 4, bottom: 4 }} barCategoryGap={16}>
                <CartesianGrid horizontal={false} stroke="var(--chart-grid)" strokeDasharray="4 5" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} stroke="var(--chart-axis)" fontSize={10} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={155}
                  stroke="var(--chart-axis)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--chart-hover)" }}
                  contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", background: "var(--paper-raised)", color: "var(--ink)" }}
                  formatter={(value, _name, item) => [`${value}% · ${item.payload.attempts} ${"attempts"}`, "accuracy"]}
                  labelFormatter={(_label, items) => items[0]?.payload.topic ?? ""}
                />
                <Bar dataKey="accuracy" fill="#0e7668" radius={[0, 7, 7, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-state-icon"><ChartNoAxesColumn size={21} /></span>
            <h3>{"Your progress starts with one question."}</h3>
            <p>{"Try the diagnostic to build your first readiness snapshot."}</p>
            <Button onClick={onDiagnostic}>{"Start diagnostic"}<ArrowRight size={16} /></Button>
          </div>
        )}
      </section>

      <section className="dashboard-section weak-section" aria-labelledby="weak-topics-title">
        <div className="section-heading">
          <div>
            <span className="card-kicker">{"A GOOD NEXT STEP"}</span>
            <h2 id="weak-topics-title">{"Topics to revisit"}</h2>
          </div>
          <Button variant="quiet" onClick={onFlashcards}><BookOpenCheck size={16} />{"Review flashcards"}</Button>
        </div>
        {busy && !summary.weakTopics.length ? (
          <div className="skeleton-list" role="status" aria-label={"Getting things ready…"}>
            <span /><span /><span />
          </div>
        ) : summary.weakTopics.length ? (
          <div className="weak-topic-list">
            {summary.weakTopics.map((item, index) => (
              <article className="weak-topic-card" key={`${item.domain}-${item.topic}`}>
                <span className="weak-topic-rank">0{index + 1}</span>
                <div className="weak-topic-info">
                  <strong>{item.topic}</strong>
                  <span>{item.domain} · {item.accuracy}% {"accuracy"} · {item.attempts} {"attempts"}</span>
                </div>
                <Button variant="secondary" onClick={() => onPracticeTopic(item.topic)}>
                  {"Practise now"}<ArrowRight size={15} />
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state empty-state-compact">
            <span className="empty-state-icon"><BookOpenCheck size={20} /></span>
            <p>{"Your topic insights will appear after your first attempts."}</p>
            <Button onClick={onDiagnostic}>{"Start diagnostic"}<ArrowRight size={16} /></Button>
          </div>
        )}
      </section>
    </main>
  );
}

function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="dashboard-skeleton" role="status" aria-label={label}>
      <div className="skeleton-ring-card"><span className="skeleton-ring" /><span className="skeleton-copy"><i /><i /><i /></span></div>
      <div className="skeleton-domain-list"><span /><span /><span /></div>
    </div>
  );
}

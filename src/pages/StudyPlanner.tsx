import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CalendarDays, CheckCircle2, Clock3, ListChecks, RotateCcw, Sparkles, Target } from "lucide-react";
import { Button } from "../components/ui/button";
import type { Profile, ReadinessSummary, StudyPlan, StudyTask } from "../types";

interface StudyPlannerProps {
  profile: Profile;
  summary: ReadinessSummary;
  plan: StudyPlan | null;
  busy: boolean;
  onGenerate: (examDate: string, hoursPerWeek: number) => Promise<boolean>;
  onToggleTask: (taskId: string, completed: boolean) => Promise<boolean>;
}

export default function StudyPlanner({
  profile, summary, plan, busy, onGenerate, onToggleTask
}: StudyPlannerProps) {
  const [examDate, setExamDate] = useState(profile.exam_date);
  const [hoursPerWeek, setHoursPerWeek] = useState(profile.hours_per_week);
  const [planError, setPlanError] = useState("");
  const [savingTask, setSavingTask] = useState("");

  useEffect(() => {
    setExamDate(profile.exam_date);
    setHoursPerWeek(profile.hours_per_week);
  }, [profile.exam_date, profile.hours_per_week]);

  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);
  const completedTasks = plan?.weeks.flatMap((week) => week.days).flatMap((day) => day.tasks).filter((task) => task.completed).length ?? 0;
  const totalTasks = plan?.weeks.flatMap((week) => week.days).flatMap((day) => day.tasks).length ?? 0;
  const weakTopics = summary.weakTopics;

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPlanError("");
    if (examDate < today) {
      setPlanError("Choose today or a future exam date to build your plan.");
      return;
    }
    await onGenerate(examDate, hoursPerWeek);
  }

  async function toggle(task: StudyTask) {
    setSavingTask(task.id);
    setPlanError("");
    try {
      await onToggleTask(task.id, !task.completed);
    } finally {
      setSavingTask("");
    }
  }

  function taskText(task: StudyTask): string {
    if (task.type === "study") return `Study ${task.topic ?? task.title}`;
    if (task.type === "practice") return `Practice ${task.topic ?? ""}`;
    if (task.type === "flashcards") return "Review due flashcards";
    return "Take a mock exam";
  }

  return (
    <main className="study-planner-page">
      <section className="dashboard-hero">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" />{"A PLAN THAT FITS YOUR RUNWAY"}</div>
          <h1>{"A steady path to exam day."}</h1>
          <p>{"Your schedule adapts to the time you have, your weekly study hours, and the topics that need another look."}</p>
        </div>
        {plan && (
          <div className="planner-progress" aria-label={`${completedTasks} of ${totalTasks} study tasks completed`}>
            <span className="planner-progress-icon"><CheckCircle2 size={18} /></span>
            <span><strong>{completedTasks}/{totalTasks}</strong><small>{"tasks done"}</small></span>
          </div>
        )}
      </section>

      <section className="planner-controls" aria-labelledby="planner-settings-title">
        <div className="planner-controls-heading">
          <span className="planner-icon"><Target size={20} /></span>
          <div><span className="card-kicker">{"MADE FOR YOUR ROUTINE"}</span><h2 id="planner-settings-title">{"Shape your study plan"}</h2></div>
        </div>
        <form className="planner-form" onSubmit={(event) => void generate(event)}>
          <label>
            <span><CalendarDays size={15} />{"When are you hoping to sit your exam?"}</span>
            <input type="date" min={today} value={examDate} onChange={(event) => setExamDate(event.target.value)} required />
          </label>
          <label>
            <span><Clock3 size={15} />{"Study hours each week"}</span>
            <div className="planner-hours-input">
              <input type="number" min={1} max={20} step={1} value={hoursPerWeek} onChange={(event) => setHoursPerWeek(Number(event.target.value))} required />
              <span>{"hours / week"}</span>
            </div>
          </label>
          <Button type="submit" disabled={busy || hoursPerWeek < 1 || hoursPerWeek > 20}>
            {plan ? <RotateCcw size={16} /> : <Sparkles size={16} />}{busy ? "Getting things ready…" : "Build my plan"}
          </Button>
        </form>
        <p className="planner-weak-summary">
          <ListChecks size={15} />
          {weakTopics.length
            ? `More practice goes to your weaker topics: ${weakTopics.map((item) => item.topic).join(", ")}.`
            : "No quiz results yet, so your plan starts with topics from all three AZ-900 domains."}
        </p>
        {planError && <p className="form-error" role="alert">{planError}</p>}
      </section>

      {plan?.compressed && (
        <aside className="short-prep-notice" role="status">
          <span className="short-prep-icon"><Sparkles size={18} /></span>
          <div>
            <strong>{plan.daysUntilExam === 0 ? "Your exam is today." : `Your exam is in ${plan.daysUntilExam} days — here’s a focused plan.`}</strong>
            <p>{plan.daysUntilExam === 0
              ? "Use this short checklist for a calm final review. We’ve left out a mock exam today; focus on the key ideas and give yourself time to rest."
              : `Your exam is less than a week away. We’ve compressed the plan into ${plan.weeks.flatMap((week) => week.days).length} daily sessions and scaled each session to your ${plan.hoursPerWeek} weekly study hours. Prioritise the listed topics and take the mock exam before exam day.`}</p>
          </div>
        </aside>
      )}

      {busy && !plan ? (
        <section className="planner-skeleton" role="status" aria-label={"Getting things ready…"}>
          <div className="skeleton-line skeleton-medium" />
          <div className="planner-skeleton-days">{Array.from({ length: 3 }, (_, index) => <span key={index} />)}</div>
        </section>
      ) : plan ? (
        <div className="planner-weeks">
          {plan.weeks.map((week) => (
            <section className="planner-week" key={week.week} aria-labelledby={`planner-week-${week.week}`}>
              <div className="planner-week-heading">
                <div><span className="card-kicker">{`WEEK ${week.week}`}</span><h2 id={`planner-week-${week.week}`}>{formatDateRange(week.startDate, week.endDate)}</h2></div>
                <span className="week-task-count">{week.days.reduce((count, day) => count + day.tasks.filter((task) => task.completed).length, 0)}/{week.days.reduce((count, day) => count + day.tasks.length, 0)} {"tasks done"}</span>
              </div>
              <div className="planner-days">
                {week.days.map((day) => (
                  <article className="planner-day" key={day.date}>
                    <div className="planner-day-heading">
                      <h3>{formatDay(day.date)}</h3>
                      {day.date === plan.examDate && <span className="exam-day-tag">{"Exam day"}</span>}
                    </div>
                    <ul className="planner-task-list">
                      {day.tasks.map((task) => (
                        <li className={task.completed ? "planner-task completed" : "planner-task"} key={task.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={task.completed}
                              disabled={busy || savingTask !== ""}
                              onChange={() => void toggle(task)}
                              aria-label={`Mark ${taskText(task)} complete`}
                            />
                            <span className="planner-task-copy"><strong>{taskText(task)}</strong><small>{task.minutes} {"min"}</small></span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="empty-state planner-empty">
          <span className="empty-state-icon"><CalendarDays size={22} /></span>
          <h2>{"Your personalised plan starts here."}</h2>
          <p>{"Set your exam date and weekly study hours, and we’ll turn your weak topics into daily steps."}</p>
        </section>
      )}
    </main>
  );
}

function formatDateRange(start: string, end: string): string {
  const locale = "en-KE";
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  const startText = startDate.toLocaleDateString(locale, { day: "numeric", month: "short" });
  const endText = endDate.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  return start === end ? endText : `${startText} – ${endText}`;
}

function formatDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-KE", {
    weekday: "long", day: "numeric", month: "long"
  });
}

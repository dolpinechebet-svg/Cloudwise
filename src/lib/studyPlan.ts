import { DOMAIN_WEIGHTS } from "../config/readiness";
import type { Domain, Profile, Question, ReadinessSummary, StudyPlan, StudyPlanDay, StudyPlanWeek, StudyTask } from "../types";

interface TopicCandidate {
  topic: string;
  domain: Domain;
  priority: number;
}

export function createStudyPlan(
  profile: Pick<Profile, "exam_date" | "hours_per_week">,
  readiness: ReadinessSummary,
  questions: Question[],
  now = new Date()
): StudyPlan {
  const today = localDateString(now);
  const daysUntilExam = dateDifference(today, profile.exam_date);
  if (daysUntilExam < 0) throw new Error("exam-date-in-past");

  const totalDays = daysUntilExam + 1;
  const compressed = daysUntilExam < 7;
  const candidates = createTopicCandidates(readiness, questions);
  const selectedCounts = new Map<string, number>();
  const totalMinutes = Math.round(profile.hours_per_week * 60 * totalDays / 7);
  const dailyMinutes = Math.max(1, Math.floor(totalMinutes / totalDays));
  const extraMinutes = totalMinutes - dailyMinutes * totalDays;
  const mockDate = daysUntilExam > 0 ? addDays(profile.exam_date, -1) : "";
  const weeks: StudyPlanWeek[] = [];
  const firstWeekLength = totalDays > 7 && totalDays % 7 !== 0 ? totalDays % 7 : Math.min(totalDays, 7);

  for (let start = 0; start < totalDays;) {
    const dayCount = Math.min(start === 0 ? firstWeekLength : 7, totalDays - start);
    const days: StudyPlanDay[] = [];
    for (let offset = 0; offset < dayCount; offset += 1) {
      const date = addDays(today, start + offset);
      const hasMock = date === mockDate;
      const dayIndex = start + offset;
      const minutes = dailyMinutes + (dayIndex < extraMinutes ? 1 : 0);
      const studyMinutes = Math.max(1, Math.round(minutes * (hasMock ? 0.4 : 0.5)));
      const cardMinutes = Math.max(1, Math.round(minutes * 0.2));
      const mockMinutes = hasMock ? Math.max(1, Math.round(minutes * 0.2)) : 0;
      const practiceMinutes = Math.max(1, minutes - studyMinutes - cardMinutes - mockMinutes);
      const topic = chooseTopic(candidates, selectedCounts);
      const tasks: StudyTask[] = [
        {
          id: `${date}-study`,
          type: "study",
          title: topic,
          topic,
          minutes: studyMinutes,
          completed: false
        },
        {
          id: `${date}-flashcards`,
          type: "flashcards",
          title: "Review flashcards",
          minutes: cardMinutes,
          completed: false
        },
        {
          id: `${date}-practice`,
          type: "practice",
          title: "Take a short practice quiz",
          topic,
          minutes: practiceMinutes,
          completed: false
        }
      ];
      if (hasMock) {
        tasks.push({
          id: `${date}-mock`,
          type: "mock",
          title: "Complete a mock exam",
          minutes: mockMinutes,
          completed: false
        });
      }
      days.push({ date, tasks });
    }
    weeks.push({
      week: weeks.length + 1,
      startDate: days[0].date,
      endDate: days[days.length - 1].date,
      days
    });
    start += dayCount;
  }

  return {
    examDate: profile.exam_date,
    hoursPerWeek: profile.hours_per_week,
    generatedAt: now.toISOString(),
    daysUntilExam,
    compressed,
    weeks
  };
}

export function isStudyPlan(value: unknown): value is StudyPlan {
  if (!isRecord(value)) return false;
  const plan = value as Record<string, unknown>;
  return isDateString(plan.examDate) &&
    typeof plan.hoursPerWeek === "number" && Number.isFinite(plan.hoursPerWeek) &&
    plan.hoursPerWeek >= 1 && plan.hoursPerWeek <= 20 &&
    typeof plan.generatedAt === "string" &&
    Number.isFinite(Date.parse(plan.generatedAt)) &&
    typeof plan.daysUntilExam === "number" && Number.isInteger(plan.daysUntilExam) && plan.daysUntilExam >= 0 &&
    typeof plan.compressed === "boolean" &&
    Array.isArray(plan.weeks) &&
    plan.weeks.length > 0 &&
    plan.weeks.every((week, index) => isRecord(week) &&
      week.week === index + 1 &&
      isDateString(week.startDate) &&
      isDateString(week.endDate) &&
      Array.isArray(week.days) &&
      week.days.length > 0 &&
      week.days.every((day) => isRecord(day) &&
        isDateString(day.date) &&
        Array.isArray(day.tasks) &&
        day.tasks.length > 0 &&
        day.tasks.every(isStudyTask)
      )
    );
}

function isStudyTask(value: unknown): value is StudyTask {
  if (!isRecord(value)) return false;
  const types: readonly string[] = ["study", "flashcards", "practice", "mock"];
  return typeof value.id === "string" &&
    typeof value.type === "string" && types.includes(value.type) &&
    typeof value.title === "string" &&
    (value.topic === undefined || typeof value.topic === "string") &&
    typeof value.minutes === "number" && Number.isInteger(value.minutes) && value.minutes > 0 &&
    typeof value.completed === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

function createTopicCandidates(readiness: ReadinessSummary, questions: Question[]): TopicCandidate[] {
  const available = new Map<string, Domain>();
  for (const question of questions) available.set(`${question.domain}\u0000${question.topic}`, question.domain);
  const observed = new Map(readiness.topics.map((item) => [`${item.domain}\u0000${item.topic}`, item.accuracy]));
  const domainWeightTotal = Object.values(DOMAIN_WEIGHTS).reduce((total, weight) => total + weight, 0) || 1;
  return [...available.entries()].map(([key, domain]) => {
    const topic = key.slice(key.indexOf("\u0000") + 1);
    const accuracy = observed.get(key);
    const weakness = accuracy === undefined ? 50 : 100 - accuracy;
    const domainWeight = DOMAIN_WEIGHTS[domain] / domainWeightTotal;
    return { topic, domain, priority: (20 + weakness) * domainWeight };
  }).sort((left, right) => right.priority - left.priority);
}

function chooseTopic(candidates: TopicCandidate[], selectedCounts: Map<string, number>): string {
  if (candidates.length === 0) return "Review your AZ-900 notes";
  const selected = [...candidates].sort((left, right) =>
    right.priority / Math.sqrt((selectedCounts.get(right.topic) ?? 0) + 1) -
    left.priority / Math.sqrt((selectedCounts.get(left.topic) ?? 0) + 1)
  )[0];
  selectedCounts.set(selected.topic, (selectedCounts.get(selected.topic) ?? 0) + 1);
  return selected.topic;
}

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateDifference(start: string, end: string): number {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
}

function addDays(date: string, days: number): string {
  const result = parseDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("invalid-exam-date");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== value) throw new Error("invalid-exam-date");
  return date;
}

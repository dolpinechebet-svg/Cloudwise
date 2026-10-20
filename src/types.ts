export type Domain =
  | "Cloud concepts"
  | "Azure architecture and services"
  | "Azure management and governance";

export interface Question {
  id: string;
  domain: Domain;
  topic: string;
  difficulty: 1 | 2 | 3;
  question_text: string;
  options: [string, string, string, string];
  correct_index: number;
  base_explanation: string;
  created_at?: string;
}

export interface Profile {
  display_name: string;
  exam_date: string;
  hours_per_week: number;
}

export interface AnswerExplanation {
  verdict: "correct" | "incorrect";
  why_correct: string;
  why_chosen_wrong: string | null;
  analogy: string;
  one_line_takeaway: string;
  flashcard: {
    front: string;
    back: string;
  };
}

export interface ExplainAnswerResponse {
  content: AnswerExplanation;
  source: "cache" | "ai" | "fallback";
}

export interface LearningAttempt {
  id: string;
  question_id: string;
  domain: Domain;
  topic: string;
  is_correct: boolean;
  time_taken_sec: number;
  created_at: string;
}

export interface Flashcard {
  id: string;
  user_id: string;
  question_id: string;
  front: string;
  back: string;
  box: number;
  next_review_at: string;
  times_wrong: number;
  created_at: string;
}

export interface TopicReadiness {
  topic: string;
  domain: Domain;
  accuracy: number;
  attempts: number;
}

export interface ReadinessSummary {
  score: number | null;
  totalAttempts: number;
  topics: TopicReadiness[];
  domains: { domain: Domain; accuracy: number | null; weight: number }[];
  weakTopics: TopicReadiness[];
}

export type StudyTaskType = "study" | "flashcards" | "practice" | "mock";

export interface StudyTask {
  id: string;
  type: StudyTaskType;
  title: string;
  topic?: string;
  minutes: number;
  completed: boolean;
}

export interface StudyPlanDay {
  date: string;
  tasks: StudyTask[];
}

export interface StudyPlanWeek {
  week: number;
  startDate: string;
  endDate: string;
  days: StudyPlanDay[];
}

export interface StudyPlan {
  examDate: string;
  hoursPerWeek: number;
  generatedAt: string;
  daysUntilExam: number;
  compressed: boolean;
  weeks: StudyPlanWeek[];
}

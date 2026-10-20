import type { AnswerExplanation, Question } from "../types";

export function createBaseExplanation(question: Question, selectedIndex: number): AnswerExplanation {
  const isCorrect = selectedIndex === question.correct_index;
  const correctAnswer = question.options[question.correct_index];
  const selectedAnswer = question.options[selectedIndex];

  return {
    verdict: isCorrect ? "correct" : "incorrect",
    why_correct: question.base_explanation,
    why_chosen_wrong: isCorrect
      ? null
      : `You chose "${selectedAnswer}". The best answer is "${correctAnswer}".`,
    analogy: "",
    one_line_takeaway: `The best answer is "${correctAnswer}".`,
    flashcard: {
      front: question.topic,
      back: question.base_explanation
    }
  };
}

export function isAnswerExplanation(value: unknown): value is AnswerExplanation {
  if (!value || typeof value !== "object") return false;
  const explanation = value as Record<string, unknown>;
  if (explanation.verdict !== "correct" && explanation.verdict !== "incorrect") return false;
  if (typeof explanation.why_correct !== "string" || typeof explanation.analogy !== "string") return false;
  if (typeof explanation.one_line_takeaway !== "string") return false;
  if (explanation.why_chosen_wrong !== null && typeof explanation.why_chosen_wrong !== "string") return false;
  if (!explanation.flashcard || typeof explanation.flashcard !== "object") return false;
  const flashcard = explanation.flashcard as Record<string, unknown>;
  if (typeof flashcard.front !== "string" || typeof flashcard.back !== "string") return false;
  if (countWords(value) >= 120) return false;
  return true;
}

function countWords(value: unknown): number {
  if (typeof value === "string") return value.trim() ? value.trim().split(/\s+/).length : 0;
  if (Array.isArray(value)) return value.reduce((total, item) => total + countWords(item), 0);
  if (value && typeof value === "object") {
    return Object.values(value).reduce((total, item) => total + countWords(item), 0);
  }
  return 0;
}

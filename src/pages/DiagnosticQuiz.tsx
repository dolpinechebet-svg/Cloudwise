import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, CircleHelp, LoaderCircle, RotateCcw, X, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { createBaseExplanation, isAnswerExplanation } from "../lib/explanations";
import type { AnswerExplanation, Question } from "../types";

interface DiagnosticQuizProps {
  questions: Question[];
  displayName: string;
  practiceTopic?: string | null;
  onAnswer: (question: Question, selectedIndex: number, elapsedSeconds: number) => Promise<"online" | "device" | false>;
  onExplain: (question: Question, selectedIndex: number) => Promise<{ content: AnswerExplanation; source: "cache" | "ai" | "fallback" }>;
  onWrongAnswer: (question: Question, flashcard: AnswerExplanation["flashcard"]) => Promise<boolean>;
  onExit: () => void;
}

export default function DiagnosticQuiz({ questions, displayName, practiceTopic, onAnswer, onExplain, onWrongAnswer, onExit }: DiagnosticQuizProps) {
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<AnswerExplanation | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationFallback, setExplanationFallback] = useState(false);
  const [flashcardCreated, setFlashcardCreated] = useState(false);
  const [flashcardSaveFailed, setFlashcardSaveFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [saveLocation, setSaveLocation] = useState<"online" | "device">("device");
  const [answers, setAnswers] = useState<boolean[]>([]);
  const questionStartedAt = useRef(Date.now());
  const explanationRequest = useRef(0);
  const question = questions[index];
  const complete = index >= questions.length;

  useEffect(() => {
    questionStartedAt.current = Date.now();
  }, [index]);

  function requestExplanation(answerIndex = selectedIndex, createFlashcard = false) {
    if (!question || answerIndex === null) return;

    const requestId = ++explanationRequest.current;
    setExplanation(null);
    setExplanationLoading(true);
    setExplanationFallback(false);
    if (createFlashcard) {
      setFlashcardCreated(false);
      setFlashcardSaveFailed(false);
    }

    void onExplain(question, answerIndex)
      .then(async (result) => {
        if (!isAnswerExplanation(result.content) || result.content.verdict !== (answerIndex === question.correct_index ? "correct" : "incorrect")) {
          throw new Error("The explanation response was not valid.");
        }
        if (createFlashcard && answerIndex !== question.correct_index) {
          let saved = false;
          try {
            saved = await onWrongAnswer(question, result.content.flashcard);
          } catch {
            saved = false;
          }
          if (requestId === explanationRequest.current) {
            setFlashcardCreated(saved);
            setFlashcardSaveFailed(!saved);
          }
        }
        if (requestId !== explanationRequest.current) return;
        setExplanation(result.content);
        setExplanationFallback(result.source === "fallback");
      })
      .catch(async () => {
        const fallback = createBaseExplanation(question, answerIndex);
        if (createFlashcard && answerIndex !== question.correct_index) {
          let saved = false;
          try {
            saved = await onWrongAnswer(question, fallback.flashcard);
          } catch {
            saved = false;
          }
          if (requestId === explanationRequest.current) {
            setFlashcardCreated(saved);
            setFlashcardSaveFailed(!saved);
          }
        }
        if (requestId !== explanationRequest.current) return;
        setExplanation(fallback);
        setExplanationFallback(true);
      })
      .finally(() => {
        if (requestId === explanationRequest.current) setExplanationLoading(false);
      });
  }

  async function chooseAnswer(optionIndex: number) {
    if (selectedIndex !== null || !question) return;

    setSelectedIndex(optionIndex);
    const correct = optionIndex === question.correct_index;
    setAnswers((current) => [...current, correct]);
    requestExplanation(optionIndex, !correct);
    setSavePending(true);
    setSaveFailed(false);
    try {
      const saved = await onAnswer(question, optionIndex, Math.max(0, Math.round((Date.now() - questionStartedAt.current) / 1000)));
      setSaveFailed(saved === false);
      if (saved) setSaveLocation(saved);
    } catch {
      setSaveFailed(true);
    } finally {
      setSavePending(false);
    }
  }

  function nextQuestion() {
    explanationRequest.current += 1;
    setIndex((current) => current + 1);
    setSelectedIndex(null);
    setExplanation(null);
    setExplanationLoading(false);
    setExplanationFallback(false);
    setFlashcardCreated(false);
    setFlashcardSaveFailed(false);
    setSaveFailed(false);
  }

  function restart() {
    explanationRequest.current += 1;
    setIndex(0);
    setSelectedIndex(null);
    setExplanation(null);
    setExplanationLoading(false);
    setExplanationFallback(false);
    setFlashcardCreated(false);
    setFlashcardSaveFailed(false);
    setAnswers([]);
    setSaveFailed(false);
  }

  if (!questions.length) {
    return (
      <section className="quiz-loading" aria-live="polite">
        <span className="loader-orbit" />
        <p>{"Getting things ready…"}</p>
      </section>
    );
  }

  if (complete) {
    const score = answers.filter(Boolean).length;
    return (
      <section className="quiz-complete" aria-labelledby="complete-title">
        <div className="complete-confetti" aria-hidden="true"><span /><span /><span /><span /><span /></div>
        <div className="complete-icon"><CheckCircle2 size={34} /></div>
        <span className="card-kicker">{"YOUR STARTING POINT"}</span>
        <h1 id="complete-title">{displayName ? `A lovely first step, ${displayName}.` : "A lovely first step."}</h1>
        <p className="complete-score">{`You got ${score} out of ${questions.length} right.`}</p>
        <p className="complete-description">{"Your answers are saved as a starting point. Keep going at your own pace."}</p>
        <div className="complete-progress" aria-label={`${score} of ${questions.length} answers correct`}>
          {questions.map((item, itemIndex) => (
            <span key={item.id} className={answers[itemIndex] ? "result-dot result-correct" : "result-dot result-incorrect"} />
          ))}
        </div>
        <div className="complete-actions">
          <Button onClick={restart} size="large"><RotateCcw size={17} />{"Try the diagnostic again"}</Button>
          <Button variant="secondary" size="large" onClick={onExit}>{"Back to readiness"}</Button>
        </div>
        <p className="results-disclaimer">{"This is a learning check, not an official exam score."}</p>
      </section>
    );
  }

  const answered = selectedIndex !== null;
  const isCorrect = answered && selectedIndex === question.correct_index;

  return (
    <section className="quiz-wrap" aria-labelledby="quiz-title">
      <div className="quiz-intro">
        <div className="eyebrow"><span className="eyebrow-dot" />{"YOUR STARTING POINT"}</div>
        <h1 id="quiz-title">{practiceTopic ? `A quick revisit: ${practiceTopic}.` : "Let's see what you already know."}</h1>
        <p>{practiceTopic ? "One focused question to help this idea stick." : `${questions.length} questions, one at a time. This is just a starting point—not a test.`}</p>
      </div>

      <div className="quiz-progress-row">
        <span className="progress-label"><span>{"Question"} {index + 1}</span> {"of"} {questions.length}</span>
        <span className="progress-percent">{Math.round((index / questions.length) * 100)}%</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`${"Question"} ${index + 1} ${"of"} ${questions.length}`}
        aria-valuenow={index}
        aria-valuemin={0}
        aria-valuemax={questions.length}
      >
        <span style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>

      <article className="question-card" aria-live="polite">
        <div className="question-meta">
          <span className="domain-tag"><span className="domain-mark" />{question.domain}</span>
          <span className="topic-tag">{question.topic}</span>
        </div>
        <div className="question-number">{String(index + 1).padStart(2, "0")}</div>
        <h2>{question.question_text}</h2>
        <p className="choose-hint"><CircleHelp size={15} />{"Choose the best answer"}</p>

        <div className="answer-options" role="group" aria-label={"Choose the best answer"}>
          {question.options.map((option, optionIndex) => {
            const isSelected = selectedIndex === optionIndex;
            const isRightAnswer = answered && optionIndex === question.correct_index;
            const isWrongSelection = isSelected && !isCorrect;
            let stateClass = "";
            if (isRightAnswer) stateClass = "option-correct";
            else if (isWrongSelection) stateClass = "option-incorrect";
            else if (isSelected) stateClass = "option-selected";

            return (
              <button
                type="button"
                key={option}
                className={`answer-option ${stateClass}`}
                disabled={answered}
                onClick={() => void chooseAnswer(optionIndex)}
                aria-pressed={isSelected}
              >
                <span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                <span className="option-copy">{option}</span>
                {isRightAnswer && <Check size={19} className="option-status-icon" aria-label={"That's right!"} />}
                {isWrongSelection && <X size={19} className="option-status-icon" aria-label={"Not quite—and that's okay."} />}
              </button>
            );
          })}
        </div>

        {answered && (
          <section className={isCorrect ? "feedback-card feedback-correct" : "feedback-card feedback-incorrect"} aria-live="polite" aria-labelledby="feedback-title">
            {isCorrect && (
              <div className="answer-confetti" aria-hidden="true">
                {Array.from({ length: 14 }, (_, piece) => {
                  const direction = piece % 2 === 0 ? -1 : 1;
                  return (
                    <span
                      key={piece}
                      style={{
                        "--confetti-delay": `${piece * 12}ms`,
                        "--confetti-x": `${direction * (22 + (piece % 5) * 9)}px`,
                        "--confetti-y": `${32 + (piece % 4) * 12}px`,
                        "--confetti-rotation": `${(piece % 2 === 0 ? -1 : 1) * (45 + piece * 12)}deg`
                      } as React.CSSProperties}
                    />
                  );
                })}
              </div>
            )}
            <div className="feedback-heading">
              <span className="feedback-icon">{isCorrect ? <CheckCircle2 size={21} /> : <XCircle size={21} />}</span>
              <div>
                <span className="feedback-kicker">{isCorrect ? "That's right!" : "Not quite—and that's okay."}</span>
                <h3 id="feedback-title">{"A little more context"}</h3>
              </div>
            </div>
            {!isCorrect && (
              <div className="answer-reveal">
                <span>{"The best answer"}</span>
                <strong>{question.options[question.correct_index]}</strong>
              </div>
            )}
            {explanationLoading ? (
              <div className="explanation-skeleton" role="status" aria-label={"Preparing your explanation…"}>
                <LoaderCircle size={17} className="spin" />
                <span>{"Preparing your explanation…"}</span>
              </div>
            ) : explanation ? (
              <div className="explanation-content">
                {explanationFallback && <p className="fallback-note">{"Showing the question's trusted reference explanation."}</p>}
                <p>{explanation.why_correct}</p>
                {explanation.why_chosen_wrong && <p>{explanation.why_chosen_wrong}</p>}
                {explanation.analogy && <p><strong>{"Everyday analogy"}: </strong>{explanation.analogy}</p>}
                {explanation.one_line_takeaway && <p className="takeaway"><strong>{"Keep in mind"}: </strong>{explanation.one_line_takeaway}</p>}
              </div>
            ) : null}
            {saveFailed && <p className="save-warning" role="status">{"Your answer is on screen, but we couldn't save it online. Please try again later."}</p>}
            {flashcardSaveFailed && <p className="save-warning" role="status">{"Your mistake was saved, but its flashcard could not be created. Please try again later."}</p>}
            {flashcardCreated && !isCorrect && <p className="flashcard-created-note" role="status">{"A flashcard from this mistake is ready to review."}</p>}
            <div className="feedback-actions">
              <span className="saved-status">{savePending ? "Getting things ready…" : saveFailed ? "" : (saveLocation === "online" ? "Saved to your account" : "Saved on this device")}</span>
              <Button onClick={nextQuestion} size="large">
                {index === questions.length - 1 ? "See my results" : "Next question"} <ArrowRight size={18} />
              </Button>
            </div>
          </section>
        )}
      </article>

      <p className="quiz-reassurance">{"A wrong answer is just a clue about what to explore next."}</p>
    </section>
  );
}

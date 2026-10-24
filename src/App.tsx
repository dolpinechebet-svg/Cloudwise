import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BookOpenCheck, CalendarDays, ChartNoAxesColumn, Cloud, LoaderCircle, LogOut, MessageCircle, X } from "lucide-react";
import ProtectedRoute from "./components/ProtectedRoute";
import type { AuthMode, AuthResult } from "./pages/AuthPage";
import { domains, sampleQuestions } from "./data/questions";
import { nextReviewDate } from "./lib/readiness";
import { calculateReadiness } from "./lib/readiness";
import { createStudyPlan, isStudyPlan } from "./lib/studyPlan";
import { createBaseExplanation, isAnswerExplanation } from "./lib/explanations";
import { supabase } from "./lib/supabase";
import type { ChatMessage } from "./pages/StudyBuddyChat";
import type {
  AnswerExplanation, Domain, ExplainAnswerResponse, Flashcard, LearningAttempt, Profile, Question, StudyPlan
} from "./types";

const Welcome = lazy(() => import("./pages/Welcome"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const DiagnosticQuiz = lazy(() => import("./pages/DiagnosticQuiz"));
const ReadinessDashboard = lazy(() => import("./pages/ReadinessDashboard"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const StudyPlanner = lazy(() => import("./pages/StudyPlanner"));
const StudyBuddyChat = lazy(() => import("./pages/StudyBuddyChat"));

type Screen = "welcome" | "onboarding" | "quiz" | "dashboard" | "flashcards" | "planner" | "chat";
interface SavedAttempt {
  id?: string;
  question_id: string;
  selected_index: number;
  is_correct: boolean;
  time_taken_sec: number;
  created_at: string;
}

const LOCAL_PROFILE_KEY = "cloudwise-profile";
const LOCAL_ATTEMPTS_KEY = "cloudwise-attempts";
const LOCAL_FLASHCARDS_KEY = "cloudwise-flashcards";
const LOCAL_STUDY_PLAN_KEY = "cloudwise-study-plan";

function screenForPath(path: string): Screen | null {
  const routes: Record<string, Screen> = {
    "/onboarding": "onboarding",
    "/quiz": "quiz",
    "/dashboard": "dashboard",
    "/flashcards": "flashcards",
    "/planner": "planner",
    "/chat": "chat"
  };
  return routes[path] ?? null;
}

function pathForScreen(screen: Screen): string {
  const routes: Record<Screen, string> = {
    welcome: "/",
    onboarding: "/onboarding",
    quiz: "/quiz",
    dashboard: "/dashboard",
    flashcards: "/flashcards",
    planner: "/planner",
    chat: "/chat"
  };
  return routes[screen];
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [screen, setScreen] = useState<Screen>(() => screenForPath(window.location.pathname) ?? "welcome");
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [onlineQuestionIds, setOnlineQuestionIds] = useState<Set<string>>(new Set());
  const [appNotice, setAppNotice] = useState("");
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [attempts, setAttempts] = useState<LearningAttempt[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [learningLoading, setLearningLoading] = useState(false);
  const [learningError, setLearningError] = useState("");
  const [errorToast, setErrorToast] = useState("");
  const [learningRefresh, setLearningRefresh] = useState(0);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [studyPlanId, setStudyPlanId] = useState<string | null>(null);
  const [studyPlanLoading, setStudyPlanLoading] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [practiceTopic, setPracticeTopic] = useState<string | null>(null);
  const readiness = useMemo(() => calculateReadiness(attempts), [attempts]);
  const toastError = screen === "onboarding" ? "" : pageError || learningError;

  const navigate = useCallback((path: string, replace = false) => {
    if (window.location.pathname !== path) {
      if (replace) window.history.replaceState(null, "", path);
      else window.history.pushState(null, "", path);
    }
    setPathname(path);
  }, []);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const target = pathForScreen(screen);
    if (screen !== "welcome" && window.location.pathname !== target) navigate(target);
  }, [navigate, screen]);

  useEffect(() => {
    if (!authReady) return;
    if (pathname === "/" || pathname === "/auth") {
      if (pathname === "/auth" && session && !demo) {
        navigate(pathForScreen(screen === "welcome" ? "quiz" : screen), true);
      }
      return;
    }
    const targetScreen = screenForPath(pathname);
    if (!session && !demo) {
      navigate("/auth", true);
      return;
    }
    if (targetScreen) setScreen(targetScreen);
    else navigate("/auth", true);
  }, [authReady, demo, navigate, pathname, screen, session]);

  useEffect(() => {
    if (!toastError) {
      setErrorToast("");
      return;
    }
    setErrorToast(toastError);
    const timeout = window.setTimeout(() => {
      setErrorToast((current) => current === toastError ? "" : current);
      setPageError((current) => current === toastError ? "" : current);
      setLearningError((current) => current === toastError ? "" : current);
    }, 6500);
    return () => window.clearTimeout(timeout);
  }, [toastError]);

  const openForSession = useCallback(async (activeSession: Session) => {
    setSession(activeSession);
    setDemo(false);
    setAttempts([]);
    setFlashcards([]);
    if (!supabase) {
      setScreen("onboarding");
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, exam_date, hours_per_week, onboarding_completed")
      .eq("id", activeSession.user.id)
      .maybeSingle();
    if (error) {
      setPageError(`We couldn't load your profile: ${error.message}`);
      setScreen("onboarding");
      return;
    }
    if (data?.onboarding_completed) {
      const nextProfile: Profile = {
        display_name: data.display_name,
        exam_date: data.exam_date,
        hours_per_week: data.hours_per_week
      };
      setProfile(nextProfile);
      setScreen("quiz");
    } else {
      setProfile(null);
      setScreen("onboarding");
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!supabase) {
        setAuthReady(true);
        return;
      }
      const subscription = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        if (nextSession && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
          void openForSession(nextSession);
        }
        if (event === "SIGNED_OUT") {
          setProfile(null);
          setDemo(false);
          setAttempts([]);
          setFlashcards([]);
          setStudyPlan(null);
          setStudyPlanId(null);
          setScreen("welcome");
          navigate("/auth", true);
        }
      }).data.subscription;
      const { data, error } = await supabase.auth.getSession();
      if (!active) {
        subscription.unsubscribe();
        return;
      }
      if (error) {
        setPageError("We couldn't restore your sign-in. Please log in again.");
      } else if (data.session) {
        setSession(data.session);
        await openForSession(data.session);
      }
      setAuthReady(true);
      return () => subscription.unsubscribe();
    }

    let unsubscribe: (() => void) | undefined;
    void restoreSession().then((cleanup) => { unsubscribe = cleanup; });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [navigate, openForSession]);

  useEffect(() => {
    if (screen !== "quiz") return;
    let active = true;
    setQuestionsLoading(true);
    setAppNotice("");

    async function loadQuestions() {
      if (supabase && session) {
        const { data, error } = await supabase
          .from("questions")
          .select("id, domain, topic, difficulty, question_text, options, correct_index, base_explanation, created_at")
          .order("created_at", { ascending: true });
        if (error) {
          setAppNotice(`The question bank could not be loaded (${error.message}). Showing the included sample questions instead.`);
        } else if (data) {
          const remoteQuestions = data as Question[];
          const balanced = domains.flatMap((domain) => {
            const remoteForDomain = remoteQuestions.filter((item) => item.domain === domain);
            const remoteText = new Set(remoteForDomain.map((item) => item.question_text.trim().toLowerCase()));
            const localForDomain = sampleQuestions.filter((item) =>
              item.domain === domain && !remoteText.has(item.question_text.trim().toLowerCase())
            );
            return [...remoteForDomain, ...localForDomain].slice(0, 8);
          });
          if (balanced.length === 24) {
            if (active) {
              setQuestions(balanced);
              setOnlineQuestionIds(new Set(remoteQuestions.map((item) => item.id)));
              if (remoteQuestions.length === 0) {
                setAppNotice("The Supabase question bank is empty. Using the included original sample questions; answers are saved on this device.");
              } else if (remoteQuestions.length < 24) {
                setAppNotice("Your Supabase questions are included. A few original starter questions fill out this balanced 24-question diagnostic.");
              }
              setQuestionsLoading(false);
            }
            return;
          }
          setAppNotice("Your question bank is missing one or more AZ-900 domains. Showing the included sample set for this diagnostic.");
        }
      }
      if (active) {
        setQuestions(sampleQuestions);
        setOnlineQuestionIds(new Set());
        setQuestionsLoading(false);
      }
    }

    void loadQuestions();
    return () => { active = false; };
  }, [screen, session]);

  useEffect(() => {
    if (screen !== "dashboard" && screen !== "flashcards" && screen !== "planner") return;
    let active = true;
    setLearningLoading(true);
    setLearningError("");

    async function loadLearningData() {
      if (session && supabase) {
        const [attemptResult, flashcardResult] = await Promise.all([
          supabase
            .from("attempts")
            .select("id, question_id, is_correct, time_taken_sec, created_at, question:questions(domain, topic)")
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("flashcards")
            .select("id, user_id, question_id, front, back, box, next_review_at, times_wrong, created_at")
            .eq("user_id", session.user.id)
            .order("next_review_at", { ascending: true })
        ]);
        if (attemptResult.error || flashcardResult.error) {
          throw new Error(attemptResult.error?.message ?? flashcardResult.error?.message ?? "Unable to load learning progress.");
        }

        const loadedAttempts = (attemptResult.data ?? []).flatMap((row) => {
          const question = row.question as { domain?: Domain; topic?: string } | null;
          if (!question?.domain || !question.topic) return [];
          return [{
            id: row.id,
            question_id: row.question_id,
            domain: question.domain,
            topic: question.topic,
            is_correct: row.is_correct,
            time_taken_sec: row.time_taken_sec,
            created_at: row.created_at
          }];
        });
        if (active) {
          setAttempts(loadedAttempts);
          setFlashcards((flashcardResult.data ?? []) as Flashcard[]);
        }
      } else {
        const questionById = new Map(questions.map((question) => [question.id, question]));
        const savedAttempts = window.localStorage.getItem(LOCAL_ATTEMPTS_KEY);
        const localAttempts = savedAttempts ? JSON.parse(savedAttempts) as SavedAttempt[] : [];
        const loadedAttempts = localAttempts.flatMap((attempt, index) => {
          const question = questionById.get(attempt.question_id);
          if (!question) return [];
          return [{
            id: attempt.id ?? `${attempt.question_id}-${attempt.created_at}-${index}`,
            question_id: attempt.question_id,
            domain: question.domain,
            topic: question.topic,
            is_correct: attempt.is_correct,
            time_taken_sec: attempt.time_taken_sec,
            created_at: attempt.created_at
          }];
        });
        const savedFlashcards = window.localStorage.getItem(LOCAL_FLASHCARDS_KEY);
        const localFlashcards = savedFlashcards ? JSON.parse(savedFlashcards) as Flashcard[] : [];
        if (active) {
          setAttempts(loadedAttempts);
          setFlashcards(localFlashcards);
        }
      }
    }

    void loadLearningData()
      .catch((error: unknown) => {
        if (active) setLearningError(error instanceof Error ? error.message : "We couldn't load your learning progress.");
      })
      .finally(() => {
        if (active) setLearningLoading(false);
      });

    return () => { active = false; };
  }, [screen, session, questions, learningRefresh]);

  useEffect(() => {
    if (screen !== "planner") return;
    let active = true;
    setStudyPlanLoading(true);

    async function loadStudyPlan() {
      if (session && supabase) {
        const { data, error } = await supabase
          .from("study_plans")
          .select("id, plan")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (data && !isStudyPlan(data.plan)) throw new Error("Your saved study plan could not be read.");
        if (active) {
          setStudyPlan(data ? data.plan as StudyPlan : null);
          setStudyPlanId(data?.id ?? null);
        }
      } else {
        const saved = window.localStorage.getItem(LOCAL_STUDY_PLAN_KEY);
        const parsed: unknown = saved ? JSON.parse(saved) : null;
        if (parsed !== null && !isStudyPlan(parsed)) throw new Error("Your saved study plan could not be read.");
        if (active) {
          setStudyPlan(parsed as StudyPlan | null);
          setStudyPlanId(null);
        }
      }
    }

    void loadStudyPlan().catch((error: unknown) => {
      if (active) setLearningError(error instanceof Error ? error.message : "Your saved study plan could not be read.");
    }).finally(() => {
      if (active) setStudyPlanLoading(false);
    });
    return () => { active = false; };
  }, [screen, session]);

  async function authenticate(mode: AuthMode, email: string, password: string, displayName: string): Promise<AuthResult> {
    if (!supabase) {
      return { ok: false, message: "Online sign-in is not configured. Add your Supabase URL and anon key to .env.local." };
    }
    setBusy(true);
    try {
      const result = mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName } }
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        const message = result.error.message.toLowerCase();
        if (mode === "signin") return { ok: false, message: "Wrong email or password." };
        if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
          return { ok: false, message: "That email is already registered." };
        }
        if (message.includes("password")) return { ok: false, message: "Your password must be at least 8 characters." };
        if (message.includes("email")) return { ok: false, message: "Enter a valid email address." };
        return { ok: false, message: "We couldn't create your account right now. Please try again." };
      }
      if (!result.data.session) return { ok: true, message: "Check your email to confirm your account." };

      const today = new Date();
      const examDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: result.data.session.user.id,
        display_name: displayName,
        exam_date: examDate,
        hours_per_week: 5,
        onboarding_completed: false
      }, { onConflict: "id" });
      if (profileError && profileError.code !== "42P01" && profileError.code !== "PGRST205") {
        return { ok: false, message: "Your account was created, but we couldn't save your display name. Please try again." };
      }
      await openForSession(result.data.session);
      return { ok: true };
    } catch {
      return {
        ok: false,
        message: mode === "signin" ? "We couldn't log you in right now. Please try again." : "We couldn't create your account right now. Please try again."
      };
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset(email: string): Promise<AuthResult> {
    if (!supabase) {
      return { ok: false, message: "Online sign-in is not configured. Add your Supabase URL and anon key to .env.local." };
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`
      });
      if (error) return { ok: false, message: "We couldn't send a reset email right now. Please try again." };
      return { ok: true, message: "If an account uses that email, a password reset link is on its way." };
    } catch {
      return { ok: false, message: "We couldn't send a reset email right now. Please try again." };
    }
  }

  function beginDemo() {
    setSession(null);
    setProfile(null);
    setAttempts([]);
    setFlashcards([]);
    setStudyPlan(null);
    setStudyPlanId(null);
    setDemo(true);
    setPageError("");
    setScreen("onboarding");
  }

  async function saveProfile(nextProfile: Profile) {
    setBusy(true);
    setPageError("");
    try {
      if (session && supabase) {
        const { error } = await supabase.from("profiles").upsert(
          { id: session.user.id, ...nextProfile, onboarding_completed: true },
          { onConflict: "id" }
        );
        if (error) {
          setPageError(`Your profile could not be saved: ${error.message}`);
          return;
        }
      } else {
        window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(nextProfile));
        setDemo(true);
      }
      setProfile(nextProfile);
      setScreen("quiz");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Your profile could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function explainAnswer(
    question: Question,
    selectedIndex: number
  ): Promise<ExplainAnswerResponse> {
    const fallback: AnswerExplanation = createBaseExplanation(question, selectedIndex);
    if (!supabase || !session || !onlineQuestionIds.has(question.id)) {
      return { content: fallback, source: "fallback" };
    }

    try {
      const { data, error } = await supabase.functions.invoke<ExplainAnswerResponse>("explain-answer", {
        body: { question_id: question.id, selected_index: selectedIndex }
      });
      if (error) throw error;
      if (
        !data ||
        !isAnswerExplanation(data.content) ||
        data.content.verdict !== (selectedIndex === question.correct_index ? "correct" : "incorrect") ||
        !["cache", "ai", "fallback"].includes(data.source)
      ) {
        throw new Error("The explanation service returned an invalid response.");
      }
      return data;
    } catch {
      return { content: fallback, source: "fallback" };
    }
  }

  async function saveAnswer(question: Question, selectedIndex: number, elapsedSeconds: number): Promise<"online" | "device" | false> {
    const correct = selectedIndex === question.correct_index;
    if (session && supabase && onlineQuestionIds.has(question.id)) {
      const { data, error } = await supabase.from("attempts").insert({
        user_id: session.user.id,
        question_id: question.id,
        selected_index: selectedIndex,
        is_correct: correct,
        time_taken_sec: elapsedSeconds
      }).select("id, created_at").single();
      if (!error) {
        setAttempts((current) => [...current, {
          id: data.id,
          question_id: question.id,
          domain: question.domain,
          topic: question.topic,
          is_correct: correct,
          time_taken_sec: elapsedSeconds,
          created_at: data.created_at
        }]);
        return "online";
      }
      setAppNotice(`This answer could not be saved to your account: ${error.message}`);
      return false;
    }

    try {
      const saved = window.localStorage.getItem(LOCAL_ATTEMPTS_KEY);
      const attempts = saved ? JSON.parse(saved) as SavedAttempt[] : [];
      const createdAt = new Date().toISOString();
      const id = crypto.randomUUID();
      attempts.push({
        id,
        question_id: question.id,
        selected_index: selectedIndex,
        is_correct: correct,
        time_taken_sec: elapsedSeconds,
        created_at: createdAt
      });
      window.localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify(attempts));
      setAttempts((current) => [...current, {
        id,
        question_id: question.id,
        domain: question.domain,
        topic: question.topic,
        is_correct: correct,
        time_taken_sec: elapsedSeconds,
        created_at: createdAt
      }]);
      return "device";
    } catch (error) {
      setAppNotice(error instanceof Error ? error.message : "Your answer could not be saved on this device.");
      return false;
    }
  }

  async function saveWrongAnswer(question: Question, content: AnswerExplanation["flashcard"]): Promise<boolean> {
    const now = new Date().toISOString();
    if (session && supabase && onlineQuestionIds.has(question.id)) {
      const { data: existing, error: lookupError } = await supabase
        .from("flashcards")
        .select("id, times_wrong, created_at")
        .eq("user_id", session.user.id)
        .eq("question_id", question.id)
        .maybeSingle();
      if (lookupError) {
        setLearningError("Your mistake was saved, but its flashcard could not be created. Please try again later.");
        return false;
      }
      const card = {
        user_id: session.user.id,
        question_id: question.id,
        front: content.front,
        back: content.back,
        box: 1,
        next_review_at: now,
        times_wrong: (existing?.times_wrong ?? 0) + 1,
        ...(existing ? { id: existing.id, created_at: existing.created_at } : {})
      };
      const { data, error } = await supabase
        .from("flashcards")
        .upsert(card, { onConflict: "user_id,question_id" })
        .select("id, user_id, question_id, front, back, box, next_review_at, times_wrong, created_at")
        .single();
      if (error) {
        setLearningError("Your mistake was saved, but its flashcard could not be created. Please try again later.");
        return false;
      }
      setLearningError("");
      setFlashcards((current) => [
        ...current.filter((item) => item.question_id !== question.id),
        data as Flashcard
      ]);
      return true;
    }

    try {
      const saved = window.localStorage.getItem(LOCAL_FLASHCARDS_KEY);
      const existingCards = saved ? JSON.parse(saved) as Flashcard[] : [];
      const existing = existingCards.find((item) => item.question_id === question.id);
      const next: Flashcard = {
        id: existing?.id ?? crypto.randomUUID(),
        user_id: "local",
        question_id: question.id,
        front: content.front,
        back: content.back,
        box: 1,
        next_review_at: now,
        times_wrong: (existing?.times_wrong ?? 0) + 1,
        created_at: existing?.created_at ?? now
      };
      const nextCards = [...existingCards.filter((item) => item.question_id !== question.id), next];
      window.localStorage.setItem(LOCAL_FLASHCARDS_KEY, JSON.stringify(nextCards));
      setLearningError("");
      setFlashcards(nextCards);
      return true;
    } catch {
      setLearningError("Your mistake was saved, but its flashcard could not be created. Please try again later.");
      return false;
    }
  }

  async function reviewFlashcard(card: Flashcard, result: "got-it" | "missed"): Promise<boolean> {
    const nextBox = result === "missed" ? 1 : Math.min(5, card.box + 1);
    const updated = {
      box: nextBox,
      next_review_at: nextReviewDate(nextBox),
      times_wrong: card.times_wrong + (result === "missed" ? 1 : 0)
    };

    if (session && supabase && card.user_id !== "local") {
      const { data, error } = await supabase
        .from("flashcards")
        .update(updated)
        .eq("id", card.id)
        .eq("user_id", session.user.id)
        .select("id, user_id, question_id, front, back, box, next_review_at, times_wrong, created_at")
        .maybeSingle();
      if (error || !data) {
        setLearningError(error?.message ?? "This review could not be saved. Please try again.");
        return false;
      }
      setFlashcards((current) => current.map((item) => item.id === card.id ? data as Flashcard : item));
      setLearningError("");
      return true;
    }

    try {
      const nextCards = flashcards.map((item) => item.id === card.id ? { ...item, ...updated } : item);
      window.localStorage.setItem(LOCAL_FLASHCARDS_KEY, JSON.stringify(nextCards));
      setFlashcards(nextCards);
      setLearningError("");
      return true;
    } catch {
      setLearningError("This review could not be saved. Please try again.");
      return false;
    }
  }

  async function generateStudyPlan(examDate: string, hoursPerWeek: number): Promise<boolean> {
    if (!profile) return false;
    setPlanBusy(true);
    setLearningError("");
    const nextProfile = { ...profile, exam_date: examDate, hours_per_week: hoursPerWeek };
    try {
      const generated = createStudyPlan(nextProfile, readiness, questions);
      if (session && supabase) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ exam_date: examDate, hours_per_week: hoursPerWeek })
          .eq("id", session.user.id);
        if (profileError) throw new Error(profileError.message);
        const { data, error } = await supabase
          .from("study_plans")
          .insert({ user_id: session.user.id, plan: generated })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        setStudyPlanId(data.id);
      } else {
        window.localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(nextProfile));
        window.localStorage.setItem(LOCAL_STUDY_PLAN_KEY, JSON.stringify(generated));
        setStudyPlanId(null);
      }
      setProfile(nextProfile);
      setStudyPlan(generated);
      setLearningError("");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setLearningError(
        message === "exam-date-in-past" || message === "invalid-exam-date"
          ? "Choose today or a future exam date to build your plan."
          : `Your plan could not be saved: ${message}`
      );
      return false;
    } finally {
      setPlanBusy(false);
    }
  }

  async function toggleStudyTask(taskId: string, completed: boolean): Promise<boolean> {
    if (!studyPlan) return false;
    const updated: StudyPlan = {
      ...studyPlan,
      weeks: studyPlan.weeks.map((week) => ({
        ...week,
        days: week.days.map((day) => ({
          ...day,
          tasks: day.tasks.map((task) => task.id === taskId ? { ...task, completed } : task)
        }))
      }))
    };
    try {
      if (session && supabase) {
        if (!studyPlanId) throw new Error("The saved plan is unavailable.");
        const { data, error } = await supabase
          .from("study_plans")
          .update({ plan: updated })
          .eq("id", studyPlanId)
          .eq("user_id", session.user.id)
          .select("id")
          .maybeSingle();
        if (error || !data) throw new Error(error?.message ?? "The saved plan could not be updated.");
      } else {
        window.localStorage.setItem(LOCAL_STUDY_PLAN_KEY, JSON.stringify(updated));
      }
      setStudyPlan(updated);
      setLearningError("");
      return true;
    } catch (error) {
      setLearningError(error instanceof Error ? error.message : "We couldn't save that task update. Please try again.");
      return false;
    }
  }

  async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
    if (!session || !supabase) throw new Error("Study Buddy Chat needs a signed-in account and the deployed Supabase chat function. Demo mode does not send messages to an AI service.");
    setChatBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ reply: string }>("study-buddy-chat", {
        body: { messages }
      });
      if (error) throw new Error(error.message);
      if (!data || typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("The chat service returned an invalid response. Please try again.");
      }
      return data.reply.trim();
    } catch (error) {
      throw new Error(error instanceof Error && error.message ? error.message : "Your message could not be sent. Please try again.");
    } finally {
      setChatBusy(false);
    }
  }

  async function signOut() {
    if (supabase && session) {
      const { error } = await supabase.auth.signOut();
      if (error) setPageError("We couldn't log you out right now. Please try again.");
      return;
    }
    window.localStorage.removeItem(LOCAL_PROFILE_KEY);
    window.localStorage.removeItem(LOCAL_ATTEMPTS_KEY);
    window.localStorage.removeItem(LOCAL_FLASHCARDS_KEY);
    window.localStorage.removeItem(LOCAL_STUDY_PLAN_KEY);
    setProfile(null);
    setDemo(false);
    setAttempts([]);
    setFlashcards([]);
    setStudyPlan(null);
    setStudyPlanId(null);
    setScreen("welcome");
    navigate("/", true);
  }

  if (pathname === "/auth") {
    return (
      <Suspense fallback={<LoadingPage showDisclaimer />}>
        <AuthPage
          configured={Boolean(supabase)}
          busy={busy}
          onSubmit={authenticate}
          onForgotPassword={sendPasswordReset}
        />
      </Suspense>
    );
  }

  if (pathname === "/" && screen === "welcome") {
    return (
      <Suspense fallback={<LoadingPage showDisclaimer />}>
        <Welcome onDemo={beginDemo} />
      </Suspense>
    );
  }

  return (
    <ProtectedRoute
      loading={!authReady}
      authenticated={Boolean(session) || demo}
      onUnauthenticated={() => navigate("/auth", true)}
    >
    <div className="app-shell">
      {screen !== "onboarding" && <header className="app-header">
        <a className="brand" href="/quiz" onClick={(event) => { event.preventDefault(); setScreen("quiz"); }} aria-label="Cloudwise">
          <span className="brand-icon"><Cloud size={20} strokeWidth={2.5} /></span>
          <span>cloudwise<span className="brand-period">.</span></span>
        </a>
        <nav className="study-nav" aria-label={"Study navigation"}>
          <button
            type="button"
            className={screen === "dashboard" ? "study-nav-button active" : "study-nav-button"}
            aria-label={"Open readiness dashboard"}
            aria-current={screen === "dashboard" ? "page" : undefined}
            onClick={() => { setPracticeTopic(null); setScreen("dashboard"); }}
          >
            <ChartNoAxesColumn size={17} /><span>{"Readiness"}</span>
          </button>
          <button
            type="button"
            className={screen === "flashcards" ? "study-nav-button active" : "study-nav-button"}
            aria-label={"Open flashcards"}
            aria-current={screen === "flashcards" ? "page" : undefined}
            onClick={() => setScreen("flashcards")}
          >
            <BookOpenCheck size={17} /><span>{"Flashcards"}</span>
            {flashcards.length > 0 && <span className="nav-count">{flashcards.length}</span>}
          </button>
          <button
            type="button"
            className={screen === "planner" ? "study-nav-button active" : "study-nav-button"}
            aria-label={"Open your study planner"}
            aria-current={screen === "planner" ? "page" : undefined}
            onClick={() => setScreen("planner")}
          >
            <CalendarDays size={17} /><span>{"Study plan"}</span>
          </button>
          <button
            type="button"
            className={screen === "chat" ? "study-nav-button active" : "study-nav-button"}
            aria-label={"Open the study buddy chat"}
            aria-current={screen === "chat" ? "page" : undefined}
            onClick={() => setScreen("chat")}
          >
            <MessageCircle size={17} /><span>{"Study chat"}</span>
          </button>
          <button
            type="button"
            className={screen === "quiz" ? "study-nav-button active" : "study-nav-button"}
            aria-label={"Open diagnostic quiz"}
            aria-current={screen === "quiz" ? "page" : undefined}
            onClick={() => { setPracticeTopic(null); setScreen("quiz"); }}
          >
            <span>{"Quiz"}</span>
          </button>
        </nav>
        <div className="app-header-actions">
          {demo && <span className="demo-badge">{"You're exploring in demo mode."}</span>}
          {session && <button className="icon-text-button" type="button" onClick={() => void signOut()} aria-label={"Log out"}>
            <LogOut size={16} /><span>{"Log out"}</span>
          </button>}
          {demo && <button className="icon-text-button" type="button" onClick={() => void signOut()} aria-label={"Exit demo"}>{"Exit demo"}</button>}
        </div>
      </header>}

      {appNotice && screen === "quiz" && <p className="app-notice" role="status">{appNotice}</p>}
      {errorToast && (
        <div className="toast-region" aria-live="assertive" aria-atomic="true">
          <div className="error-toast" role="alert">
            <span>{errorToast}</span>
            <button
              type="button"
              onClick={() => {
                setErrorToast("");
                setPageError((current) => current === errorToast ? "" : current);
                setLearningError((current) => current === errorToast ? "" : current);
              }}
              aria-label={"Dismiss error message"}
            >
              <X size={17} />
            </button>
          </div>
        </div>
      )}

      {screen === "onboarding" && (
        <Suspense fallback={<LoadingPage showDisclaimer />}>
          <Onboarding
            initialName={session?.user.user_metadata.display_name ?? session?.user.user_metadata.full_name ?? session?.user.email?.split("@")[0] ?? "Learner"}
            onSubmit={saveProfile}
            onBack={() => setScreen(session ? "quiz" : "welcome")}
            busy={busy}
            error={pageError}
          />
        </Suspense>
      )}

      {screen === "quiz" && (
        <Suspense fallback={<LoadingPage />}>
          {questionsLoading ? (
            <LoadingPage />
          ) : (
            <DiagnosticQuiz
              questions={practiceTopic ? questions.filter((question) => question.topic === practiceTopic) : questions}
              displayName={profile?.display_name ?? ""}
              practiceTopic={practiceTopic}
              onAnswer={saveAnswer}
              onExplain={explainAnswer}
              onWrongAnswer={saveWrongAnswer}
              onExit={() => { setPracticeTopic(null); setScreen("dashboard"); }}
            />
          )}
        </Suspense>
      )}
      {screen === "dashboard" && (
        <Suspense fallback={<LoadingPage />}>
          <ReadinessDashboard
            summary={readiness}
            busy={learningLoading}
            onRefresh={() => setLearningRefresh((current) => current + 1)}
            onPracticeTopic={(topic) => {
              if (!questions.some((question) => question.topic === topic)) {
                setAppNotice("That older topic isn’t in the current question set. Try the diagnostic for available practice.");
                setPracticeTopic(null);
              } else {
                setAppNotice("");
                setPracticeTopic(topic);
              }
              setScreen("quiz");
            }}
            onFlashcards={() => setScreen("flashcards")}
            onDiagnostic={() => { setPracticeTopic(null); setScreen("quiz"); }}
          />
        </Suspense>
      )}
      {screen === "flashcards" && (
        <Suspense fallback={<LoadingPage />}>
          <Flashcards
            cards={flashcards}
            busy={learningLoading}
            onReview={reviewFlashcard}
            onRefresh={() => setLearningRefresh((current) => current + 1)}
          />
        </Suspense>
      )}
      {screen === "planner" && profile && (
        <Suspense fallback={<LoadingPage />}>
          <StudyPlanner
            profile={profile}
            summary={readiness}
            plan={studyPlan}
            busy={learningLoading || studyPlanLoading || planBusy}
            onGenerate={generateStudyPlan}
            onToggleTask={toggleStudyTask}
          />
        </Suspense>
      )}
      {screen === "chat" && (
        <Suspense fallback={<LoadingPage />}>
          <StudyBuddyChat
            busy={chatBusy}
            error=""
            onSend={sendChatMessage}
          />
        </Suspense>
      )}
      {screen !== "onboarding" && (
        <footer className="quiz-footer">
          <span>cloudwise<span className="brand-period">.</span></span>
          <span className="footer-disclaimer">{"Unofficial AZ-900 study tool. Not affiliated with or endorsed by Microsoft."}</span>
        </footer>
      )}
    </div>
    </ProtectedRoute>
  );
}

function LoadingPage({ showDisclaimer = false }: { showDisclaimer?: boolean }) {
  return (
    <div className="loading-page-wrap">
      <div className="loading-page" role="status"><LoaderCircle size={26} className="spin" /><span>{"Getting things ready…"}</span></div>
      {showDisclaimer && <footer className="loading-footer"><span className="footer-disclaimer">{"Unofficial AZ-900 study tool. Not affiliated with or endorsed by Microsoft."}</span></footer>}
    </div>
  );
}

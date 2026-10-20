import { createClient } from "npm:@supabase/supabase-js@2";

type Domain =
  | "Cloud concepts"
  | "Azure architecture and services"
  | "Azure management and governance";

interface Question {
  id: string;
  domain: Domain;
  topic: string;
  difficulty: number;
  question_text: string;
  options: [string, string, string, string];
  correct_index: number;
  base_explanation: string;
}

interface AnswerExplanation {
  verdict: "correct" | "incorrect";
  why_correct: string;
  why_chosen_wrong: string | null;
  analogy: string;
  one_line_takeaway: string;
  flashcard: { front: string; back: string };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const systemPrompt = `You are a friendly AZ-900 (Azure Fundamentals) tutor for beginners in Africa.
You will be given a question, its options, the correct answer, the learner's chosen answer, and a trusted reference explanation.

Rules:
1. Base every factual claim ONLY on the question, options and reference explanation provided. Do not add Azure facts that are not supported by them. If you are unsure, say so.
2. Write at beginner level. Define any technical term the first time you use it.
3. Include exactly ONE real-life analogy from everyday African life (for example matatus, M-Pesa agents, kiosks, airtime bundles, landlords and tenants, national ID cards, county by-laws). The analogy must map accurately to the Azure concept. Do not force an analogy if it would mislead; use a simpler plain-language comparison instead.
4. Total length under 120 words.
5. Be encouraging, never condescending.
6. Respond with ONLY valid JSON, no markdown fences, no preamble.
7. Write in clear, simple English suitable for a beginner.

JSON schema:
{
  "verdict": "correct" | "incorrect",
  "why_correct": string,
  "why_chosen_wrong": string | null,
  "analogy": string,
  "one_line_takeaway": string,
  "flashcard": { "front": string, "back": string }
}`;

const requiredKeys = [
  "analogy",
  "flashcard",
  "one_line_takeaway",
  "verdict",
  "why_chosen_wrong",
  "why_correct"
].sort();

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "Authentication required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("explain-answer is missing required server configuration.");
    return jsonResponse({ error: "Explanation service is not configured." }, 503);
  }

  const bearerToken = authorization.slice("Bearer ".length);
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(bearerToken);
  if (userError || !userData.user) return jsonResponse({ error: "Authentication required." }, 401);

  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > 10_000) return jsonResponse({ error: "Request is too large." }, 413);
  let input: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 10_000) {
      return jsonResponse({ error: "Request is too large." }, 413);
    }
    input = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  if (!isInput(input)) return jsonResponse({ error: "Invalid explanation request." }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: cached, error: cacheError } = await admin
    .from("ai_explanations")
    .select("content")
    .eq("question_id", input.question_id)
    .eq("selected_index", input.selected_index)
    .maybeSingle();

  if (cacheError) {
    console.error("Explanation cache lookup failed:", cacheError.message);
    return jsonResponse({ error: "Explanation cache is unavailable." }, 503);
  }
  if (cached && isAnswerExplanation(cached.content)) {
    return jsonResponse({ content: cached.content, source: "cache" });
  }

  const { data: question, error: questionError } = await admin
    .from("questions")
    .select("id, domain, topic, difficulty, question_text, options, correct_index, base_explanation")
    .eq("id", input.question_id)
    .maybeSingle();

  if (questionError) {
    console.error("Question lookup failed:", questionError.message);
    return jsonResponse({ error: "Question could not be loaded." }, 503);
  }
  if (!question || !isQuestion(question)) return jsonResponse({ error: "Question not found." }, 404);

  const isCorrect = input.selected_index === question.correct_index;
  if (!anthropicApiKey) {
    console.error("ANTHROPIC_API_KEY is not configured; using the trusted reference explanation.");
    return jsonResponse({
      content: createFallback(question, input.selected_index),
      source: "fallback"
    });
  }

  const { data: withinLimit, error: rateLimitError } = await admin.rpc("consume_ai_explanation_rate_limit", {
    p_user_id: userData.user.id,
    p_limit: 30,
    p_window_seconds: 60
  });
  if (rateLimitError) {
    console.error("Explanation rate limit check failed:", rateLimitError.message);
    return jsonResponse({ error: "Explanation service is temporarily unavailable." }, 503);
  }
  if (withinLimit !== true) {
    return jsonResponse({ error: "Too many explanation requests. Please try again shortly." }, 429);
  }

  const chosenAnswer = question.options[input.selected_index];
  const correctAnswer = question.options[question.correct_index];
  const userPrompt = JSON.stringify({
    question: question.question_text,
    options: question.options,
    correct_answer: correctAnswer,
    learner_chosen_answer: chosenAnswer,
    reference_explanation: question.base_explanation,
    expected_verdict: isCorrect ? "correct" : "incorrect"
  });

  let generated: AnswerExplanation;
  try {
    generated = await requestExplanation(anthropicApiKey, userPrompt, isCorrect ? "correct" : "incorrect");
  } catch (error) {
    console.error("Claude explanation request failed:", error instanceof Error ? error.message : "Unknown error.");
    return jsonResponse({
      content: createFallback(question, input.selected_index),
      source: "fallback"
    });
  }

  const { error: cacheWriteError } = await admin
    .from("ai_explanations")
    .upsert(
      {
        question_id: question.id,
        selected_index: input.selected_index,
        content: generated
      },
      { onConflict: "question_id,selected_index" }
    );

  if (cacheWriteError) {
    console.error("Explanation cache write failed:", cacheWriteError.message);
    return jsonResponse({ content: generated, source: "ai" });
  }

  return jsonResponse({ content: generated, source: "ai" });
});

async function requestExplanation(
  apiKey: string,
  userPrompt: string,
  expectedVerdict: AnswerExplanation["verdict"]
): Promise<AnswerExplanation> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 450,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Claude API returned HTTP ${response.status}.`);
    }

    const responseBody: unknown = await response.json();
    const text = getAnthropicText(responseBody);
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("Claude returned invalid JSON.");
    }

    if (!isAnswerExplanation(result, expectedVerdict)) {
      throw new Error("Claude returned an explanation that did not match the required schema.");
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

function getAnthropicText(value: unknown): string {
  if (!value || typeof value !== "object") throw new Error("Claude returned an invalid response.");
  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) throw new Error("Claude returned an invalid response.");
  const textBlock = content.find((block) =>
    Boolean(block && typeof block === "object" && (block as { type?: unknown }).type === "text")
  ) as { text?: unknown } | undefined;
  if (!textBlock || typeof textBlock.text !== "string") throw new Error("Claude returned no explanation.");
  return textBlock.text;
}

function isInput(value: unknown): value is { question_id: string; selected_index: number } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.question_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.question_id) &&
    Number.isInteger(input.selected_index) &&
    (input.selected_index as number) >= 0 &&
    (input.selected_index as number) <= 3;
}

function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== "object") return false;
  const question = value as Record<string, unknown>;
  return typeof question.id === "string" &&
    typeof question.domain === "string" &&
    typeof question.topic === "string" &&
    typeof question.question_text === "string" &&
    typeof question.base_explanation === "string" &&
    Number.isInteger(question.correct_index) &&
    (question.correct_index as number) >= 0 &&
    (question.correct_index as number) <= 3 &&
    Array.isArray(question.options) &&
    question.options.length === 4 &&
    question.options.every((option) => typeof option === "string");
}

function isAnswerExplanation(value: unknown, expectedVerdict?: AnswerExplanation["verdict"]): value is AnswerExplanation {
  if (!value || typeof value !== "object") return false;
  const explanation = value as Record<string, unknown>;
  if (Object.keys(explanation).sort().join(",") !== requiredKeys.join(",")) return false;
  if (explanation.verdict !== "correct" && explanation.verdict !== "incorrect") return false;
  if (expectedVerdict && explanation.verdict !== expectedVerdict) return false;
  if (typeof explanation.why_correct !== "string" || !explanation.why_correct.trim()) return false;
  if (explanation.why_chosen_wrong !== null && typeof explanation.why_chosen_wrong !== "string") return false;
  if (explanation.verdict === "correct" && explanation.why_chosen_wrong !== null) return false;
  if (explanation.verdict === "incorrect" && !explanation.why_chosen_wrong?.trim()) return false;
  if (typeof explanation.analogy !== "string" || !explanation.analogy.trim()) return false;
  if (typeof explanation.one_line_takeaway !== "string" || !explanation.one_line_takeaway.trim()) return false;
  if (!explanation.flashcard || typeof explanation.flashcard !== "object") return false;
  const flashcard = explanation.flashcard as Record<string, unknown>;
  if (Object.keys(flashcard).sort().join(",") !== "back,front") return false;
  if (typeof flashcard.front !== "string" || !flashcard.front.trim()) return false;
  if (typeof flashcard.back !== "string" || !flashcard.back.trim()) return false;
  return countWords(value) < 120;
}

function countWords(value: unknown): number {
  if (typeof value === "string") return value.trim() ? value.trim().split(/\s+/).length : 0;
  if (Array.isArray(value)) return value.reduce((total, item) => total + countWords(item), 0);
  if (value && typeof value === "object") {
    return Object.values(value).reduce((total, item) => total + countWords(item), 0);
  }
  return 0;
}

function createFallback(question: Question, selectedIndex: number): AnswerExplanation {
  const correct = selectedIndex === question.correct_index;
  const correctAnswer = question.options[question.correct_index];
  return {
    verdict: correct ? "correct" : "incorrect",
    why_correct: question.base_explanation,
    why_chosen_wrong: correct
      ? null
      : `You chose "${question.options[selectedIndex]}". The best answer is "${correctAnswer}".`,
    analogy: "",
    one_line_takeaway: `The best answer is "${correctAnswer}".`,
    flashcard: { front: question.topic, back: question.base_explanation }
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

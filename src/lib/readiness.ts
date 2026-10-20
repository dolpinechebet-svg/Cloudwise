import { DOMAIN_WEIGHTS, LEITNER_INTERVAL_DAYS } from "../config/readiness";
import { domains } from "../data/questions";
import type { Domain, LearningAttempt, ReadinessSummary, TopicReadiness } from "../types";

export function calculateReadiness(attempts: LearningAttempt[]): ReadinessSummary {
  const grouped = new Map<string, LearningAttempt[]>();
  for (const attempt of attempts) {
    const key = `${attempt.domain}\u0000${attempt.topic}`;
    const topicAttempts = grouped.get(key) ?? [];
    topicAttempts.push(attempt);
    grouped.set(key, topicAttempts);
  }

  const topics: TopicReadiness[] = [...grouped.entries()].map(([key, topicAttempts]) => {
    const [domain, topic] = key.split("\u0000") as [Domain, string];
    const recent = [...topicAttempts]
      .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
      .slice(-10);
    const weighted = recent.reduce((result, attempt, index) => {
      const weight = 1 + index * 0.05;
      return {
        correct: result.correct + (attempt.is_correct ? weight : 0),
        total: result.total + weight
      };
    }, { correct: 0, total: 0 });
    return {
      topic,
      domain,
      accuracy: weighted.total ? Math.round((weighted.correct / weighted.total) * 100) : 0,
      attempts: recent.length
    };
  }).sort((left, right) => domains.indexOf(left.domain) - domains.indexOf(right.domain) || left.topic.localeCompare(right.topic));

  const domainScores = domains.map((domain) => {
    const domainTopics = topics.filter((topic) => topic.domain === domain);
    const topicAttemptCount = domainTopics.reduce((sum, topic) => sum + topic.attempts, 0);
    const accuracy = topicAttemptCount
      ? Math.round(domainTopics.reduce((sum, topic) => sum + topic.accuracy * topic.attempts, 0) / topicAttemptCount)
      : null;
    return { domain, accuracy, weight: DOMAIN_WEIGHTS[domain] };
  });

  const scoredDomains = domainScores.filter((item) => item.accuracy !== null && item.weight > 0);
  const totalWeight = scoredDomains.reduce((sum, item) => sum + item.weight, 0);
  const score = totalWeight
    ? Math.round(scoredDomains.reduce((sum, item) => sum + item.accuracy! * item.weight, 0) / totalWeight)
    : null;

  return {
    score,
    totalAttempts: attempts.length,
    topics,
    domains: domainScores,
    weakTopics: [...topics].sort((left, right) => left.accuracy - right.accuracy || right.attempts - left.attempts).slice(0, 3)
  };
}

export function nextReviewDate(box: number, now = new Date()): string {
  const days = LEITNER_INTERVAL_DAYS[Math.min(Math.max(box, 1), 5) - 1];
  const next = new Date(now);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

export function isDueToday(nextReviewAt: string, now = new Date()): boolean {
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Date.parse(nextReviewAt) < endOfToday.getTime();
}

import type { AttemptRow, QuestionRow, QuestionMetadata } from '../types/index.ts';

export interface ScoreDistribution {
  excellent: number;    // 90–100%
  good: number;         // 75–89%
  satisfactory: number; // 50–74%
  poor: number;         // 0–49%
}

export interface OptionFrequency {
  option: string;
  count: number;
  percentage: number;
  isCorrect: boolean;
}

export interface QuestionAnalytics {
  questionId: string;
  text: string;
  totalAnswers: number;
  correctCount: number;  // score >= 0.999
  partialCount: number;  // 0 < score < 0.999
  wrongCount: number;    // score === 0 (with choice)
  skippedCount: number;  // empty selection
  averageScorePercent: number; // 0-100%
  errorRatePercent: number;    // 100 - averageScorePercent
  optionsFrequency: OptionFrequency[];
  topDistractor: string | null;
  metadata?: QuestionMetadata;
}

export interface TopicAnalytics {
  topic: string;
  questionCount: number;
  totalAttempts: number;
  averageScorePercent: number;
  masteryLevel: 'high' | 'medium' | 'low'; // >= 80% high, 60-79% medium, < 60% low
}

export interface QuizAnalyticsSummary {
  quizId: string;
  totalAttempts: number;
  uniqueStudents: number;
  averageScore: number;
  medianScore: number;
  distribution: ScoreDistribution;
  hardestQuestions: QuestionAnalytics[]; // sorted by errorRate descending
  questions: QuestionAnalytics[];
  topics: TopicAnalytics[];
  dataQuality: {
    hasSufficientData: boolean;
    sampleSize: number;
    notice?: string;
  };
}

export const ANALYTICS_THRESHOLDS = {
  MIN_FOR_AI_ANALYSIS: 3,
  MIN_FOR_FULL_CONFIDENCE: 10,
} as const;

export const analyticsService = {
  /**
   * Pure calculation engine that processes raw attempts and questions.
   * Completely deterministic, runs in plain TypeScript without external dependencies.
   */
  calculateAnalytics(
    quizId: string,
    questions: QuestionRow[],
    rawAttempts: AttemptRow[]
  ): QuizAnalyticsSummary {
    // 1. Filter out corrupt or incomplete attempts
    const validAttempts = (rawAttempts || []).filter(
      (a) => a && typeof a.score === 'number' && !isNaN(a.score) && a.score >= 0 && a.score <= 100
    );

    const totalAttempts = validAttempts.length;

    // 2. Count unique students
    const uniqueStudentsSet = new Set<string>();
    validAttempts.forEach((a) => {
      if (a.user_id) uniqueStudentsSet.add(a.user_id);
    });
    const uniqueStudents = uniqueStudentsSet.size;

    // 3. Score metrics: average and median
    const scores = validAttempts.map((a) => a.score);
    const averageScore = totalAttempts > 0 ? Number((scores.reduce((sum, s) => sum + s, 0) / totalAttempts).toFixed(1)) : 0;
    const medianScore = this.calculateMedian(scores);

    // 4. Score distribution
    const distribution: ScoreDistribution = {
      excellent: 0,
      good: 0,
      satisfactory: 0,
      poor: 0,
    };

    scores.forEach((s) => {
      if (s >= 90) distribution.excellent++;
      else if (s >= 75) distribution.good++;
      else if (s >= 50) distribution.satisfactory++;
      else distribution.poor++;
    });

    // 5. Per-question analytics
    const questionsAnalytics: QuestionAnalytics[] = (questions || []).map((q) =>
      this.calculateQuestionStats(q, validAttempts)
    );

    // Hardest questions: sorted by errorRate descending
    const hardestQuestions = [...questionsAnalytics].sort(
      (a, b) => b.errorRatePercent - a.errorRatePercent
    );

    // 6. Topics analytics
    const topics = this.calculateTopicStats(questions, questionsAnalytics, totalAttempts);

    // 7. Data quality assessment
    let notice: string | undefined;
    if (totalAttempts < ANALYTICS_THRESHOLDS.MIN_FOR_AI_ANALYSIS) {
      notice = `Недостаточно данных для глубокой аналитики (менее ${ANALYTICS_THRESHOLDS.MIN_FOR_AI_ANALYSIS} попыток). Статистика носит предварительный характер.`;
    } else if (totalAttempts < ANALYTICS_THRESHOLDS.MIN_FOR_FULL_CONFIDENCE) {
      notice = `Небольшая выборка (менее ${ANALYTICS_THRESHOLDS.MIN_FOR_FULL_CONFIDENCE} попыток). При большем количестве прохождений результаты могут скорректироваться.`;
    }

    return {
      quizId,
      totalAttempts,
      uniqueStudents,
      averageScore,
      medianScore,
      distribution,
      hardestQuestions,
      questions: questionsAnalytics,
      topics,
      dataQuality: {
        hasSufficientData: totalAttempts >= ANALYTICS_THRESHOLDS.MIN_FOR_AI_ANALYSIS,
        sampleSize: totalAttempts,
        notice,
      },
    };
  },

  calculateMedian(numbers: number[]): number {
    if (!numbers || numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
    }
    return Number(sorted[mid].toFixed(1));
  },

  calculateQuestionStats(question: QuestionRow, attempts: AttemptRow[]): QuestionAnalytics {
    const totalAttempts = attempts.length;
    let correctCount = 0;
    let partialCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    let totalScoreSum = 0;

    const optionCounts: Record<string, number> = {};
    (question.options || []).forEach((opt) => {
      optionCounts[opt] = 0;
    });

    attempts.forEach((att) => {
      const selected = att.answers?.[question.id];

      // If user did not answer or answered empty array
      if (!selected || !Array.isArray(selected) || selected.length === 0) {
        skippedCount++;
        return;
      }

      // Track chosen options
      selected.forEach((opt) => {
        if (typeof optionCounts[opt] === 'number') {
          optionCounts[opt]++;
        }
      });

      // Calculate score for this question using official AliTester proportional formula
      const correctAnswers = question.correct_answers || [];
      const numCorrect = correctAnswers.length;

      let qScore = 0;
      if (numCorrect > 0) {
        const pointPerAnswer = 1 / numCorrect;
        selected.forEach((ans) => {
          if (correctAnswers.includes(ans)) {
            qScore += pointPerAnswer;
          } else {
            qScore -= pointPerAnswer;
          }
        });
      }

      // Clamped [0, 1]
      qScore = Math.max(0, Math.min(1, qScore));
      totalScoreSum += qScore;

      if (qScore >= 0.999) {
        correctCount++;
      } else if (qScore > 0) {
        partialCount++;
      } else {
        wrongCount++;
      }
    });

    const averageScorePercent =
      totalAttempts > 0 ? Number(((totalScoreSum / totalAttempts) * 100).toFixed(1)) : 0;
    const errorRatePercent = Number(Math.max(0, 100 - averageScorePercent).toFixed(1));

    // Option frequency breakdown
    const optionsFrequency: OptionFrequency[] = (question.options || []).map((opt) => {
      const count = optionCounts[opt] || 0;
      const percentage = totalAttempts > 0 ? Number(((count / totalAttempts) * 100).toFixed(1)) : 0;
      const isCorrect = (question.correct_answers || []).includes(opt);
      return {
        option: opt,
        count,
        percentage,
        isCorrect,
      };
    });

    // Determine top distractor (most frequently chosen incorrect option)
    let topDistractor: string | null = null;
    let highestWrongCount = 0;

    optionsFrequency.forEach((of) => {
      if (!of.isCorrect && of.count > highestWrongCount) {
        highestWrongCount = of.count;
        topDistractor = of.option;
      }
    });

    return {
      questionId: question.id,
      text: question.text,
      totalAnswers: totalAttempts - skippedCount,
      correctCount,
      partialCount,
      wrongCount,
      skippedCount,
      averageScorePercent,
      errorRatePercent,
      optionsFrequency,
      topDistractor,
      metadata: question.metadata,
    };
  },

  calculateTopicStats(
    questions: QuestionRow[],
    questionStats: QuestionAnalytics[],
    totalAttempts: number
  ): TopicAnalytics[] {
    const topicMap = new Map<string, { questions: QuestionAnalytics[] }>();

    questionStats.forEach((qs) => {
      const topicName = qs.metadata?.topic?.trim();
      if (topicName) {
        const existing = topicMap.get(topicName) || { questions: [] };
        existing.questions.push(qs);
        topicMap.set(topicName, existing);
      }
    });

    const result: TopicAnalytics[] = [];

    topicMap.forEach((data, topic) => {
      const qCount = data.questions.length;
      if (qCount === 0) return;

      const avgScore = Number(
        (data.questions.reduce((sum, q) => sum + q.averageScorePercent, 0) / qCount).toFixed(1)
      );

      let masteryLevel: 'high' | 'medium' | 'low' = 'low';
      if (avgScore >= 80) masteryLevel = 'high';
      else if (avgScore >= 60) masteryLevel = 'medium';

      result.push({
        topic,
        questionCount: qCount,
        totalAttempts,
        averageScorePercent: avgScore,
        masteryLevel,
      });
    });

    return result.sort((a, b) => a.averageScorePercent - b.averageScorePercent);
  },
};

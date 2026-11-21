import { describe, it } from 'node:test';
import assert from 'node:assert';
import { analyticsService } from '../src/services/analytics.service.ts';
import type { AttemptRow, QuestionRow } from '../src/types/index.ts';

describe('analyticsService', () => {
  const dummyQuestions: QuestionRow[] = [
    {
      id: 'q1',
      quiz_id: 'quiz1',
      text: 'Столица Казахстана?',
      options: ['Алматы', 'Астана', 'Шымкент', 'Караганда'],
      correct_answers: ['Астана'],
      order: 0,
      explanation: null,
      metadata: { topic: 'География' },
    },
    {
      id: 'q2',
      quiz_id: 'quiz1',
      text: 'Какие города являются миллионниками в РК? (2 правильных)',
      options: ['Алматы', 'Астана', 'Кокшетау', 'Тараз'],
      correct_answers: ['Алматы', 'Астана'],
      order: 1,
      explanation: null,
      metadata: { topic: 'География' },
    },
    {
      id: 'q3',
      quiz_id: 'quiz1',
      text: 'Вопрос по программированию?',
      options: ['A', 'B', 'C', 'D'],
      correct_answers: ['A'],
      order: 2,
      explanation: null,
      metadata: { topic: 'IT' },
    },
  ];

  it('should handle zero attempts safely without NaN or crash', () => {
    const res = analyticsService.calculateAnalytics('quiz1', dummyQuestions, []);
    assert.strictEqual(res.totalAttempts, 0);
    assert.strictEqual(res.averageScore, 0);
    assert.strictEqual(res.medianScore, 0);
    assert.strictEqual(res.dataQuality.hasSufficientData, false);
    assert.strictEqual(res.distribution.excellent, 0);
    assert.strictEqual(res.questions[0].totalAnswers, 0);
    assert.strictEqual(res.questions[0].errorRatePercent, 100);
  });

  it('should calculate median correctly for odd and even lengths', () => {
    assert.strictEqual(analyticsService.calculateMedian([50, 70, 90]), 70);
    assert.strictEqual(analyticsService.calculateMedian([50, 60, 80, 100]), 70); // (60 + 80) / 2
    assert.strictEqual(analyticsService.calculateMedian([100]), 100);
    assert.strictEqual(analyticsService.calculateMedian([]), 0);
  });

  it('should accurately calculate single and multiple choice scoring with penalties', () => {
    const attempts: AttemptRow[] = [
      // Student 1: 100% on everything
      {
        id: 'att1',
        user_id: 'u1',
        quiz_id: 'quiz1',
        score: 100,
        wrong_questions: [],
        answers: {
          q1: ['Астана'],
          q2: ['Алматы', 'Астана'],
          q3: ['A'],
        },
        completed_at: new Date().toISOString(),
      },
      // Student 2: Q1 correct, Q2 partial (only 1 of 2), Q3 wrong
      {
        id: 'att2',
        user_id: 'u2',
        quiz_id: 'quiz1',
        score: 50,
        wrong_questions: ['q2', 'q3'],
        answers: {
          q1: ['Астана'],
          q2: ['Алматы'], // 0.5 points
          q3: ['B'],      // wrong
        },
        completed_at: new Date().toISOString(),
      },
      // Student 3: Q1 wrong (chose Алматы), Q2 chose all (penalty: 0.5+0.5 - 0.5-0.5 = 0), Q3 skipped
      {
        id: 'att3',
        user_id: 'u3',
        quiz_id: 'quiz1',
        score: 0,
        wrong_questions: ['q1', 'q2', 'q3'],
        answers: {
          q1: ['Алматы'],
          q2: ['Алматы', 'Астана', 'Кокшетау', 'Тараз'], // all options -> 0 points!
          q3: [], // skipped
        },
        completed_at: new Date().toISOString(),
      },
    ];

    const res = analyticsService.calculateAnalytics('quiz1', dummyQuestions, attempts);

    assert.strictEqual(res.totalAttempts, 3);
    assert.strictEqual(res.uniqueStudents, 3);
    assert.strictEqual(res.averageScore, 50); // (100 + 50 + 0) / 3 = 50.0
    assert.strictEqual(res.medianScore, 50);

    // Question 1 analysis
    const q1Stats = res.questions.find((q) => q.questionId === 'q1')!;
    assert.strictEqual(q1Stats.correctCount, 2);
    assert.strictEqual(q1Stats.wrongCount, 1);
    assert.strictEqual(q1Stats.topDistractor, 'Алматы');

    // Question 2 (multiple choice) analysis
    const q2Stats = res.questions.find((q) => q.questionId === 'q2')!;
    assert.strictEqual(q2Stats.correctCount, 1); // att1 got 1.0
    assert.strictEqual(q2Stats.partialCount, 1); // att2 got 0.5
    assert.strictEqual(q2Stats.wrongCount, 1);   // att3 got 0.0

    // Question 3 analysis (skipped check)
    const q3Stats = res.questions.find((q) => q.questionId === 'q3')!;
    assert.strictEqual(q3Stats.skippedCount, 1); // att3 skipped
  });

  it('should aggregate topics analytics properly', () => {
    const attempts: AttemptRow[] = [
      {
        id: 'att1',
        user_id: 'u1',
        quiz_id: 'quiz1',
        score: 80,
        wrong_questions: [],
        answers: {
          q1: ['Астана'],
          q2: ['Алматы', 'Астана'],
          q3: ['B'],
        },
        completed_at: new Date().toISOString(),
      },
    ];

    const res = analyticsService.calculateAnalytics('quiz1', dummyQuestions, attempts);
    const geoTopic = res.topics.find((t) => t.topic === 'География');
    const itTopic = res.topics.find((t) => t.topic === 'IT');

    assert.ok(geoTopic);
    assert.strictEqual(geoTopic?.questionCount, 2);
    assert.strictEqual(geoTopic?.averageScorePercent, 100);
    assert.strictEqual(geoTopic?.masteryLevel, 'high');

    assert.ok(itTopic);
    assert.strictEqual(itTopic?.questionCount, 1);
    assert.strictEqual(itTopic?.averageScorePercent, 0);
    assert.strictEqual(itTopic?.masteryLevel, 'low');
  });
});

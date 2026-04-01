export interface ReviewRecord {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
}

export interface ReviewResult extends ReviewRecord {
  nextReviewAt: Date;
}

export type Rating = 0 | 2 | 3 | 4 | 5;

export function calculateNextReview(record: ReviewRecord, rating: Rating): ReviewResult {
  let { repetitions, easeFactor, intervalDays } = record;

  if (rating < 3) {
    repetitions = 0;
    intervalDays = rating === 0 ? 0 : 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions += 1;
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)),
  );

  const nextReviewAt = new Date();
  if (rating === 0) {
    nextReviewAt.setMinutes(nextReviewAt.getMinutes() + 10);
  } else {
    nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);
  }

  return { repetitions, easeFactor, intervalDays, nextReviewAt };
}

export function intervalLabel(rating: Rating, record: ReviewRecord): string {
  const result = calculateNextReview(record, rating);
  const mins = Math.round((result.nextReviewAt.getTime() - Date.now()) / 60000);

  if (mins < 60) {
    return `< ${Math.max(1, mins)} min`;
  }

  if (result.intervalDays === 1) {
    return "1 day";
  }

  return `${result.intervalDays} days`;
}

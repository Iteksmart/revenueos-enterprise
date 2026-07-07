import { z } from "zod";

export const leadScoreInputSchema = z.object({
  industryMatch: z.number().min(0).max(100),
  employeeFit: z.number().min(0).max(100),
  openedEmailCount: z.number().int().min(0).default(0),
  clickedEmailCount: z.number().int().min(0).default(0),
  proposalViews: z.number().int().min(0).default(0),
  estimatedBudget: z.number().min(0).default(0),
  authorityLevel: z.number().min(0).max(100),
  daysUntilDecision: z.number().int().min(0).max(365),
});

export type LeadScoreInput = z.infer<typeof leadScoreInputSchema>;

export function calculateLeadScore(input: LeadScoreInput) {
  const fitScore = Math.round((input.industryMatch * 0.55) + (input.employeeFit * 0.45));
  const intentScore = cap((input.clickedEmailCount * 18) + (input.proposalViews * 24) + (input.openedEmailCount * 6));
  const behaviorScore = cap((input.openedEmailCount * 8) + (input.clickedEmailCount * 16) + (input.proposalViews * 20));
  const budgetScore = cap(input.estimatedBudget >= 50000 ? 92 : input.estimatedBudget >= 20000 ? 74 : input.estimatedBudget >= 5000 ? 52 : 24);
  const authorityScore = Math.round(input.authorityLevel);
  const urgencyScore = cap(input.daysUntilDecision <= 14 ? 94 : input.daysUntilDecision <= 30 ? 78 : input.daysUntilDecision <= 60 ? 59 : 34);
  const overallScore = Math.round(
    fitScore * 0.22 +
    intentScore * 0.18 +
    behaviorScore * 0.14 +
    budgetScore * 0.16 +
    authorityScore * 0.16 +
    urgencyScore * 0.14,
  );

  return {
    fitScore,
    intentScore,
    behaviorScore,
    budgetScore,
    authorityScore,
    urgencyScore,
    overallScore,
    explanation: `Overall ${overallScore}: fit ${fitScore}, intent ${intentScore}, behavior ${behaviorScore}, budget ${budgetScore}, authority ${authorityScore}, urgency ${urgencyScore}.`,
  };
}

function cap(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

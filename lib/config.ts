export const CATEGORIES = [
  "Construcción", "Carga y descarga", "Mudanzas", "Limpieza", "Eventos",
  "Mesero", "Almacén", "Inventarios", "Campo", "Pintura", "Jardinería",
  "Ayudante general", "Otro",
] as const;

export const MUNICIPALITIES = [
  "Aguascalientes", "Asientos", "Calvillo", "Cosío", "El Llano", "Jesús María",
  "Pabellón de Arteaga", "Rincón de Romos", "San Francisco de los Romo",
  "San José de Gracia", "Tepezalá",
] as const;

export const APP_RULES = {
  freePosts: 2,
  paidPostPrice: Number(process.env.NEXT_PUBLIC_POST_PRICE_MXN ?? 50),
  maxActiveApplications: 3,
  candidateCaps: { one: 5, two: 6, three: 8, smallMultiplier: 2, mediumMultiplier: 1.75, largeMultiplier: 1.5 },
  score: {
    base: 50, neverCompleted: 20, inactiveReturn: 12, daysWithoutJobDivisor: 14,
    maxDaysBonus: 20, recentRejectionsEach: 3, maxRejectionBonus: 12,
    attendanceBonus: 10, goodRating: 8, recentCompletedEach: -6,
    activeApplicationEach: -4, noShowEach: -15, conflictingSelection: -20,
  },
} as const;

export function candidateLimit(workersNeeded: number) {
  const n = Math.max(1, Math.floor(workersNeeded));
  const c = APP_RULES.candidateCaps;
  if (n === 1) return c.one;
  if (n === 2) return c.two;
  if (n === 3) return c.three;
  if (n <= 5) return Math.ceil(n * c.smallMultiplier);
  if (n <= 10) return Math.ceil(n * c.mediumMultiplier);
  return Math.ceil(n * c.largeMultiplier);
}

export type OpportunityInputs = {
  completedTotal: number; daysSinceCompleted: number | null; recentRejections: number;
  attendanceRate: number | null; rating: number | null; recentCompleted: number;
  activeApplications: number; noShows: number; conflictingSelection: boolean;
  daysSinceActivity: number;
};

export function opportunityScore(input: OpportunityInputs) {
  const s = APP_RULES.score;
  let score = s.base;
  if (input.completedTotal === 0) score += s.neverCompleted;
  if (input.daysSinceActivity >= 60) score += s.inactiveReturn;
  score += Math.min(s.maxDaysBonus, Math.floor((input.daysSinceCompleted ?? 90) / s.daysWithoutJobDivisor));
  score += Math.min(s.maxRejectionBonus, input.recentRejections * s.recentRejectionsEach);
  if ((input.attendanceRate ?? 0) >= 90) score += s.attendanceBonus;
  if ((input.rating ?? 0) >= 4.5) score += s.goodRating;
  score += input.recentCompleted * s.recentCompletedEach;
  score += input.activeApplications * s.activeApplicationEach;
  score += input.noShows * s.noShowEach;
  if (input.conflictingSelection) score += s.conflictingSelection;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function money(value: number | string) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}

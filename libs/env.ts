// Plan definitions (shared between frontend and backend)

export const PLANS = {
  starter: {
    name: 'Starter',
    monthlyPrice: 20,
    credits: 400,
  },
  pro: {
    name: 'Pro',
    monthlyPrice: 35,
    credits: 1200,
  },
  optimum: {
    name: 'Optimum',
    monthlyPrice: 58,
    credits: 3000,
  },
} as const;

export type PlanId = keyof typeof PLANS;

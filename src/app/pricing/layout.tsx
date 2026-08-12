import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Buy DreamUtopia credits for AI image and video. No subscriptions — packs from Starter to Premium. Stripe checkout when configured; otherwise nothing is charged.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

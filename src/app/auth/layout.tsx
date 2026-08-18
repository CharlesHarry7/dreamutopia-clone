import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Log in or create a free DreamUtopia account. New accounts get 10 credits — no card required.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}

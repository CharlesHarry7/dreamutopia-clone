import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Set a new DreamUtopia password using the link from your email.",
  robots: { index: false, follow: false },
};

export default function ResetLayout({ children }: { children: React.ReactNode }) {
  return children;
}

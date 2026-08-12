import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace",
  description:
    "Generate AI video and images in the DreamUtopia workspace. Guests get 2 free Lite image-to-video tries.",
  robots: { index: false, follow: true },
};

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}

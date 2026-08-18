import { SeoLanding } from "@/components/seo-landing";

export const metadata = {
  title: "Free AI Video",
  description:
    "Generate free AI videos from images — 2 Lite tries per device, no signup or credit card.",
  openGraph: {
    title: "Free AI Video · DreamUtopia",
    description: "2 free Lite image-to-video generations per device. Sign up for 10 credits.",
  },
};

export default function FreeAiVideoPage() {
  return (
    <SeoLanding
      title="Free AI Video"
      lead="2 free Lite image-to-video generations per device — no signup. Create an account for 10 credits."
      primary={{ href: "/workspace", label: "Try free" }}
      secondary={{ href: "/auth?mode=register", label: "Sign up" }}
    />
  );
}

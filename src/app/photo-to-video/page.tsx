import { SeoLanding } from "@/components/seo-landing";

export const metadata = {
  title: "Photo to Video",
  description:
    "Animate still photos into short AI video clips with DreamUtopia. Start free — 2 Lite tries.",
  openGraph: {
    title: "Photo to Video · DreamUtopia",
    description: "Same pipeline as image-to-video — animate photos into short clips.",
  },
};

export default function PhotoToVideoPage() {
  return (
    <SeoLanding
      title="Photo to"
      titleAccent="Video"
      lead="Same pipeline as image-to-video — animate still photos into short clips."
      primary={{ href: "/workspace", label: "Try free" }}
      secondary={{ href: "/auth?mode=register", label: "Sign up" }}
    />
  );
}

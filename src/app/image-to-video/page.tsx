import { SeoLanding } from "@/components/seo-landing";

export const metadata = {
  title: "Image to Video",
  description:
    "Turn any photo into an AI video with DreamUtopia. 2 free Lite tries per device — no signup.",
  openGraph: {
    title: "Image to Video · DreamUtopia",
    description: "Animate a start frame into a short AI video. Start free in the workspace.",
  },
};

export default function ImageToVideoPage() {
  return (
    <SeoLanding
      title="Image to"
      titleAccent="Video"
      lead="Upload a start frame, describe the motion, and generate with Lite / Medium / Pro models. Guests get 2 free Lite tries."
      primary={{ href: "/workspace", label: "Try free" }}
      secondary={{ href: "/auth?mode=register", label: "Sign up" }}
    />
  );
}

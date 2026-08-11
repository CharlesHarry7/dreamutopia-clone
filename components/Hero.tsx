import { Play, Volume2, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute inset-0 radial-glow" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-600/20 blur-[120px] rounded-full" />

      <div className="container-max relative z-10">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span className="text-sm text-brand-300">AI-powered YouTube automation</span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-center text-5xl md:text-7xl font-bold tracking-tight mb-6">
          <span className="text-white">YouTube Automation</span>
          <br />
          <span className="gradient-text">for Faceless Channels</span>
        </h1>

        {/* Subtitle */}
        <p className="text-center text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-8">
          Build monetisable long-form YouTube videos and schedule faceless reels for
          TikTok, Instagram Reels and YouTube Shorts.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/signup" className="btn-primary text-base">
            <Play className="w-5 h-5 fill-white" />
            Start an Episode
          </Link>
          <Link href="#how-it-works" className="btn-secondary text-base">
            Create a Free Video
          </Link>
        </div>

        {/* Video Preview */}
        <div className="relative max-w-4xl mx-auto">
          <div className="relative aspect-video rounded-2xl overflow-hidden glass-card glow">
            {/* Video placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-900/40 via-[#12121a] to-[#0a0a0f]" />

            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="group relative">
                <div className="absolute inset-0 bg-brand-500/30 blur-2xl rounded-full group-hover:bg-brand-500/40 transition-all" />
                <div className="relative w-20 h-20 rounded-full bg-brand-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 text-white fill-white ml-1" />
                </div>
              </button>
            </div>

            {/* Unmute button */}
            <div className="absolute bottom-4 right-4">
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm hover:bg-black/70 transition-colors">
                <Volume2 className="w-4 h-4" />
                Unmute preview
              </button>
            </div>

            {/* Video info bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
              <div className="h-full w-1/3 bg-brand-500 rounded-r-full" />
            </div>
          </div>

          {/* Floating format tabs */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-2 flex-wrap justify-center">
            {['Episodes', 'Reddit Story', 'Zack D Films', 'True Crime', 'POV Shorts'].map((tab, i) => (
              <span
                key={tab}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  i === 0
                    ? 'bg-brand-500 text-white'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                {tab}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

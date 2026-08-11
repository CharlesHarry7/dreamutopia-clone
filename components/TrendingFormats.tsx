import { TrendingUp, MessageSquare, Film3, Ghost, Skull, Sparkles, Clock, Palette, ArrowRight } from 'lucide-react';

export default function TrendingFormats() {
  const formats = [
    {
      icon: MessageSquare,
      name: 'Reddit Story Videos',
      description: 'Binge-friendly story structure. Long-form reddit drives fast monetisation.',
      badge: 'Long-form',
      color: 'text-orange-400',
    },
    {
      icon: Film3,
      name: 'Zack D Films 3D Shorts',
      description: 'Cinematic quality at scale. The most-copied short format on YouTube right now.',
      badge: 'Shorts',
      color: 'text-blue-400',
    },
    {
      icon: Ghost,
      name: '4chan Greentext',
      description: 'Cult following, low competition, strong retention.',
      badge: 'Shorts',
      color: 'text-green-400',
    },
    {
      icon: Skull,
      name: 'True Crime Shorts',
      description: 'Consistently high RPM. Story-driven with broad appeal.',
      badge: 'Shorts',
      color: 'text-red-400',
    },
    {
      icon: Sparkles,
      name: 'AI Shorts',
      description: 'Fully generative. Zero source material needed.',
      badge: 'Shorts',
      color: 'text-purple-400',
    },
    {
      icon: Clock,
      name: 'Timelapse AI Shorts',
      description: 'Construction, renovation, epoxy — the satisfying video category growing 3x.',
      badge: 'Shorts',
      color: 'text-yellow-400',
    },
    {
      icon: Palette,
      name: 'Horror Story',
      description: 'Seasonal spikes, year-round demand. High share rate.',
      badge: 'Soon',
      color: 'text-pink-400',
    },
    {
      icon: TrendingUp,
      name: 'Paint Explainer',
      description: 'Monetisable long-form explainers with segment-by-segment control. Built for watch time.',
      badge: 'Long-form',
      color: 'text-teal-400',
    },
  ];

  return (
    <section id="formats" className="section">
      <div className="container-max">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-brand-400" />
          <span className="text-sm font-medium text-brand-400 uppercase tracking-wide">Trending Formats</span>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          We add formats when they're trending. <br />
          <span className="gradient-text">Not six months later.</span>
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mb-12">
          TaleTok tracks faceless formats that are actually getting views right now and builds them
          before your competitors find them and the algorithm moves on.
        </p>

        {/* Format grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {formats.map((format) => (
            <div
              key={format.name}
              className="glass-card rounded-2xl p-5 group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <format.icon className={`w-5 h-5 ${format.color}`} />
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  format.badge === 'Soon'
                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    : format.badge === 'Long-form'
                    ? 'bg-brand-500/10 text-brand-300 border border-brand-500/20'
                    : 'bg-white/5 text-gray-400 border border-white/10'
                }`}>
                  {format.badge}
                </span>
              </div>
              <h3 className="font-semibold mb-1 group-hover:text-brand-300 transition-colors">
                {format.name}
              </h3>
              <p className="text-sm text-gray-400">{format.description}</p>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 p-6 glass-card rounded-2xl">
          <p className="text-gray-400 text-sm">
            New formats ship based on what the algorithm is rewarding now.
          </p>
          <a href="#pricing" className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300 text-sm font-medium">
            Suggest a format
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

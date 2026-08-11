import { Film, Sliders, DollarSign, Clock, Monitor } from 'lucide-react';

export default function LongFormEpisodes() {
  const features = [
    {
      icon: Film,
      title: '2D stickman explainers',
      description: 'High-retention educational entertainment with realistic narration and engaging flat visuals.',
    },
    {
      icon: Sliders,
      title: 'You control every segment',
      description: 'Review the outline, approve frames, and lock each ~60s segment before stitching the full episode.',
    },
    {
      icon: DollarSign,
      title: 'Built to monetise',
      description: 'Longer watch time and ad-friendly structure for channels scaling past shorts-only growth.',
    },
  ];

  return (
    <section id="episodes" className="section">
      <div className="container-max">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <Film className="w-5 h-5 text-brand-400" />
          <span className="text-sm font-medium text-brand-400 uppercase tracking-wide">Long-form</span>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Long-form videos that <span className="gradient-text">earn watch time</span>
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mb-12">
          Build monetisable episodes up to 10 minutes with 2D stickman explainers. Review every
          segment before you publish — then scale your faceless channel beyond shorts.
        </p>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-3 mb-12">
          {['Up to 10 minutes', 'Segment-by-segment review', 'Higher watch time', '16:9 export'].map((badge) => (
            <span
              key={badge}
              className="px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm"
            >
              {badge}
            </span>
          ))}
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="glass-card rounded-2xl p-6">
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-brand-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Video preview strip */}
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {[
            { title: '2D Stickman', time: '4:32', icon: Film },
            { title: 'Reddit Story', time: '8:15', icon: Clock },
            { title: '16:9 Export', time: '10:00', icon: Monitor },
          ].map((item) => (
            <div key={item.title} className="glass-card rounded-xl p-4 flex items-center gap-3">
              <item.icon className="w-5 h-5 text-brand-400" />
              <div>
                <div className="text-sm font-medium">{item.title}</div>
                <div className="text-xs text-gray-500">{item.time} duration</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

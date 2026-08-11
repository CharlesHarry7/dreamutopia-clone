import { Rocket, Handshake, TrendingUp, Link, Tv, DollarSign } from 'lucide-react';

export default function Monetisation() {
  const methods = [
    {
      icon: DollarSign,
      title: 'YouTube Adsense',
      description: "Long-form videos above 8 minutes qualify for mid-roll ads. TaleTok's long-form Reddit format is built for this.",
      emoji: '🚀',
    },
    {
      icon: Handshake,
      title: 'Platform Partnerships',
      description: 'YouTube Shorts Fund, TikTok Creator Fund, and Instagram monetisation reward consistent posting. Autoposting handles the consistency.',
      emoji: '💰',
    },
    {
      icon: TrendingUp,
      title: 'Flip Viral Accounts',
      description: 'Build channels to a meaningful follower count and sell. A niche channel with 10k engaged subscribers has real market value.',
      emoji: '📈',
    },
    {
      icon: Link,
      title: 'Affiliate Marketing',
      description: 'Add affiliate links to video descriptions. Story and review-adjacent niches convert well.',
      emoji: '🔗',
    },
    {
      icon: Tv,
      title: 'Brand Partnerships',
      description: 'Channels with consistent output and defined niches attract outreach. You don\'t need millions of subscribers to get brand deals.',
      emoji: '📺',
    },
  ];

  return (
    <section className="section">
      <div className="container-max">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <Rocket className="w-5 h-5 text-brand-400" />
          <span className="text-sm font-medium text-brand-400 uppercase tracking-wide">Results</span>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="gradient-text">Monetisation</span> Methods
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mb-12">
          Long-form watch time and consistent shorts output — two paths to earning with your faceless channel.
        </p>

        {/* Methods grid */}
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
          {methods.map((method) => (
            <div key={method.title} className="glass-card rounded-2xl p-5 text-center">
              <div className="text-3xl mb-3">{method.emoji}</div>
              <h3 className="font-semibold mb-2">{method.title}</h3>
              <p className="text-xs text-gray-400">{method.description}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <a href="#pricing" className="btn-primary text-base">
            Start Earning Today →
          </a>
        </div>
      </div>
    </section>
  );
}

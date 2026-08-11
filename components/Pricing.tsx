import { Check, Star, Sparkles } from 'lucide-react';

export default function Pricing() {
  const plans = [
    {
      name: 'Starter',
      tagline: 'Easy content creation for enthusiasts',
      monthly: 20,
      yearly: 243,
      yearlySave: 81,
      popular: false,
      features: [
        'Credits roll over — up to 2 months',
        'Priority rendering',
        'Monthly personalised channel audit',
        '400 credits',
        'Channel analytics tracking',
        'Custom branded watermark',
        'YouTube autopost 2x per week',
        'Edit scheduled posts up to 5 days ahead',
        'Long-form reddit',
        'All content formats',
        'Realistic voices',
        'HD download',
        'Live chat support',
      ],
    },
    {
      name: 'Pro',
      tagline: 'Focused monetisable faceless channel growth',
      monthly: 35,
      yearly: 423,
      yearlySave: 141,
      popular: true,
      features: [
        'Credits roll over — up to 2 months',
        'Priority rendering',
        'Monthly personalised channel audit',
        '1,200 credits',
        'Channel analytics tracking',
        'Custom branded watermark',
        'YouTube autopost daily',
        'Edit scheduled posts up to 5 days ahead',
        'Long-form reddit',
        'All content formats',
        'Realistic voices',
        'HD download',
        'Experimental features early access',
        'Priority support',
      ],
    },
    {
      name: 'Optimum',
      tagline: 'Maximum scale and automation',
      monthly: 58,
      yearly: 693,
      yearlySave: 231,
      popular: false,
      features: [
        'Credits roll over — up to 2 months',
        'Priority rendering',
        'Monthly personalised channel audit',
        '3,000 credits',
        'Channel analytics tracking',
        'Custom branded watermark',
        'YouTube autopost daily across multiple channels',
        'Edit scheduled posts up to 5 days ahead',
        'Long-form reddit',
        'All content formats',
        'Realistic voices',
        'HD download',
        'Experimental features early access',
        'Priority support',
      ],
    },
  ];

  return (
    <section id="pricing" className="section bg-[#0c0c14] border-y border-white/5">
      <div className="container-max">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-brand-400" />
          <span className="text-sm font-medium text-brand-400 uppercase tracking-wide">Pricing</span>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          YouTube Automation <span className="gradient-text">Pricing</span>
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mb-4">
          Guided growth for committed creators. Lock in one price and monetise your channel within 12 months.
        </p>
        <p className="text-sm text-gray-500 mb-12">
          From $27/mo — $47/mo — $77/mo per month
        </p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className="text-sm text-gray-400">Monthly</span>
          <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
            <span className="px-3 py-1 rounded-full bg-brand-500 text-white text-xs font-medium">Monthly</span>
            <span className="px-3 py-1 rounded-full text-gray-400 text-xs cursor-pointer">Yearly (3 months free)</span>
          </div>
          <span className="text-sm text-gray-400">Yearly</span>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 ${
                plan.popular
                  ? 'glass-card glow border-brand-500/30'
                  : 'glass-card'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-4 py-1 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 text-white text-xs font-semibold">
                    <Star className="w-3 h-3 fill-white" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6 pt-2">
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-400">{plan.tagline}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">${plan.monthly}</span>
                  <span className="text-gray-400">USD/mo</span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  ${plan.yearly} USD/year · Save ${plan.yearlySave} USD/year
                </div>
              </div>

              <button
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  plan.popular
                    ? 'btn-primary justify-center'
                    : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                Subscribe
              </button>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-sm text-gray-500 mt-8">
          Not sure which plan is right for you?{' '}
          <a href="/signup" className="text-brand-400 hover:text-brand-300 font-medium">
            Create Free Taster Video
          </a>
        </p>
      </div>
    </section>
  );
}

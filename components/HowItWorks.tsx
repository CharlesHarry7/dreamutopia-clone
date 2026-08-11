import { Link2, Layout, Send, Youtube, Calendar, Settings } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
    {
      number: '1',
      icon: Link2,
      title: 'Connect your channel',
      description: 'Link your YouTube channel to TaleTok in three clicks. No API keys. No technical setup.',
      detail: 'OAuth 2.0 secure connection',
    },
    {
      number: '2',
      icon: Layout,
      title: 'Pick your format',
      description: "Choose Episodes for monetisable long-form explainers, or series formats like reddit story videos, Zack D Films 3D shorts, and timelapse AI. TaleTok generates a new video for each scheduled post.",
      detail: '8+ trending formats',
    },
    {
      number: '3',
      icon: Send,
      title: 'Post automatically',
      description: 'TaleTok publishes at your chosen times. Edit, reschedule or swap any upcoming post up to five days ahead from your dashboard.',
      detail: 'Auto-scheduling included',
    },
  ];

  return (
    <section id="how-it-works" className="section bg-[#0c0c14] border-y border-white/5">
      <div className="container-max">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-brand-400" />
          <span className="text-sm font-medium text-brand-400 uppercase tracking-wide">How It Works</span>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          How YouTube Automation Works <br /> with <span className="gradient-text">TaleTok</span>
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mb-16">
          Three steps from signup to a channel publishing long-form episodes and scheduled shorts.
        </p>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              {/* Number badge */}
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-lg z-10">
                {step.number}
              </div>

              {/* Card */}
              <div className="glass-card rounded-2xl p-6 pt-8 h-full">
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4">
                  <step.icon className="w-6 h-6 text-brand-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-gray-400 text-sm mb-4">{step.description}</p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-xs text-gray-400">
                  <Youtube className="w-3 h-3" />
                  {step.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dashboard preview */}
        <div className="mt-16">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold">Your command center</h3>
              <p className="text-gray-400 text-sm">Run series from one dashboard, track momentum, and keep output consistent without manual uploads.</p>
            </div>
            <Calendar className="w-6 h-6 text-brand-400 hidden md:block" />
          </div>
          <div className="glass-card rounded-2xl p-6">
            {/* Mock dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Scheduled Posts', value: '12', change: '+3 this week' },
                { label: 'Published', value: '47', change: '+8 this week' },
                { label: 'Total Views', value: '2.4M', change: '+340K' },
                { label: 'Watch Time', value: '18.2K hrs', change: '+2.1K hrs' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/5 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-green-400 mt-1">{stat.change}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

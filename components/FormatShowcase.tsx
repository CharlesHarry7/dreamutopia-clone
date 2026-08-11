'use client';

import { useState } from 'react';
import { Film, Play, Clock, Star } from 'lucide-react';

export default function FormatShowcase() {
  const [activeTab, setActiveTab] = useState('Stickman');

  const tabs = ['Stickman', 'Zack D Films', 'Reddit', 'AI Shorts', 'Timelapse'];

  return (
    <section className="section">
      <div className="container-max">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <Film className="w-5 h-5 text-brand-400" />
          <span className="text-sm font-medium text-brand-400 uppercase tracking-wide">Format Showcase</span>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Create trending <span className="gradient-text">Stickman</span> episodes
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mb-8">
          Monetisable long-form explainers up to 10 minutes. 2D stickman visuals, realistic narration,
          and segment-by-segment review before you publish.
        </p>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-brand-500 text-white'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-3 mb-8">
          {['Up to 10 minutes', 'Segment review', 'Higher watch time'].map((badge) => (
            <span
              key={badge}
              className="px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs"
            >
              {badge}
            </span>
          ))}
        </div>

        {/* Video showcase area */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Video preview */}
            <div className="relative aspect-video md:aspect-auto bg-gradient-to-br from-brand-900/30 to-[#0a0a0f] flex items-center justify-center p-8">
              <button className="group relative">
                <div className="absolute inset-0 bg-brand-500/30 blur-2xl rounded-full group-hover:bg-brand-500/40 transition-all" />
                <div className="relative w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                </div>
              </button>
              <div className="absolute top-4 left-4">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs">
                  <Clock className="w-3 h-3" />
                  6:42 preview
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="p-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-300 text-xs">{activeTab}</span>
                <span className="text-xs text-gray-500">Episode #1</span>
              </div>
              <h3 className="text-2xl font-bold mb-3">
                How AI is Changing Education
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                A 2D stickman explainer covering the impact of AI on modern education. Includes
                realistic narration, engaging visuals, and ad-friendly structure for monetisation.
              </p>

              {/* Segment progress */}
              <div className="space-y-2 mb-6">
                {[
                  { label: 'Segment 1 — Introduction', status: 'approved' },
                  { label: 'Segment 2 — Current State', status: 'approved' },
                  { label: 'Segment 3 — Future Impact', status: 'reviewing' },
                  { label: 'Segment 4 — Conclusion', status: 'pending' },
                ].map((seg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      seg.status === 'approved' ? 'bg-green-400' :
                      seg.status === 'reviewing' ? 'bg-yellow-400' :
                      'bg-gray-600'
                    }`} />
                    <span className="text-xs text-gray-400">{seg.label}</span>
                    <span className={`text-xs ml-auto ${
                      seg.status === 'approved' ? 'text-green-400' :
                      seg.status === 'reviewing' ? 'text-yellow-400' :
                      'text-gray-600'
                    }`}>
                      {seg.status}
                    </span>
                  </div>
                ))}
              </div>

              <button className="btn-primary text-sm">
                <Play className="w-4 h-4 fill-white" />
                Start creating {activeTab} episodes
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

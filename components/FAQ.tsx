'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'What is TaleTok and how does it work?',
      answer: 'TaleTok is an AI-powered YouTube automation platform for faceless channels. Connect your YouTube channel, pick a trending format (reddit stories, stickman explainers, true crime shorts, and more), and TaleTok automatically generates and publishes videos on your chosen schedule. You can review and edit each video before it goes live.',
    },
    {
      question: 'Do credits rollover?',
      answer: "Yes. Unused credits carry forward for up to 2 months. This means if you don't use all your credits one month, they roll over to the next — giving you flexibility without losing what you've paid for.",
    },
    {
      question: 'What are AI Shorts videos?',
      answer: 'AI Shorts are fully generative short-form videos created from scratch — no source material needed. TaleTok\'s AI writes the script, generates visuals, adds narration, and produces a complete short ready for TikTok, Instagram Reels, or YouTube Shorts.',
    },
    {
      question: 'What platforms does TaleTok post to?',
      answer: 'TaleTok primarily posts to YouTube (both long-form and Shorts). Autoposting is available on all paid plans, with the Starter plan posting 2x per week and Pro/Optimum plans posting daily. You can edit, reschedule, or swap any upcoming post up to 5 days ahead.',
    },
    {
      question: 'Can I review videos before they are published?',
      answer: 'Yes. For long-form episodes, you can review the outline, approve individual frames, and lock each ~60 second segment before the full episode is stitched together. For shorts, you get a preview before publishing and can swap or reschedule any post up to 5 days ahead.',
    },
    {
      question: 'Do I need any technical skills to use TaleTok?',
      answer: 'No. TaleTok is designed for creators, not developers. Connect your channel in 3 clicks, pick a format, and the AI handles script writing, voice generation, visual creation, editing, and publishing. No API keys, no video editing software, no technical setup required.',
    },
  ];

  return (
    <section id="faq" className="section">
      <div className="container-max">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-brand-400" />
          <span className="text-sm font-medium text-brand-400 uppercase tracking-wide">FAQ</span>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Frequently Asked <span className="gradient-text">Questions</span>
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mb-12">
          Everything you need to know about TaleTok.
        </p>

        {/* FAQ accordion */}
        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="glass-card rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-5 text-left"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-medium text-white pr-4">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-brand-400 flex-shrink-0 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === index && (
                <div className="px-5 pb-5 text-gray-400 text-sm animate-fade-in">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

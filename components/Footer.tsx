import { Play, Youtube, Twitter, Github, Mail } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  const footerLinks = {
    Product: [
      { label: 'Episodes', href: '#episodes' },
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Formats', href: '#formats' },
      { label: 'Pricing', href: '#pricing' },
    ],
    Formats: [
      { label: 'Reddit Story', href: '#' },
      { label: 'Zack D Films', href: '#' },
      { label: 'True Crime', href: '#' },
      { label: 'Timelapse AI', href: '#' },
    ],
    Company: [
      { label: 'About', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Roadmap', href: '#' },
      { label: 'Contact', href: '#' },
    ],
    Legal: [
      { label: 'Terms of Service', href: '#' },
      { label: 'Privacy Policy', href: '#' },
      { label: 'Refund Policy', href: '#' },
    ],
  };

  return (
    <footer className="border-t border-white/5 bg-[#08080d]">
      <div className="container-max py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Logo + description */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <Play className="w-4 h-4 text-white fill-white" />
              </div>
              <span className="text-xl font-bold text-white">TaleTok</span>
            </Link>
            <p className="text-sm text-gray-400 max-w-xs mb-4">
              YouTube Automation AI for Faceless Channels. Build monetisable long-form videos and
              schedule faceless reels automatically.
            </p>
            <div className="flex gap-3">
              {[
                { icon: Youtube, href: '#' },
                { icon: Twitter, href: '#' },
                { icon: Github, href: '#' },
                { icon: Mail, href: '#' },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Footer links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-white mb-3">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 hover:text-brand-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © 2026 TaleTok. All rights reserved. Built with Next.js + Tailwind + Stripe.
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Play } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { label: 'Episodes', href: '#episodes' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Formats', href: '#formats' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
      <div className="container-max flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-xl font-bold text-white">TaleTok</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/signup" className="btn-primary text-sm">
            Create a Free Video
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden border-t border-white/5 bg-[#0a0a0f] px-4 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="block text-sm text-gray-400 hover:text-white transition-colors"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/signup" className="btn-primary text-sm w-full justify-center">
            Create a Free Video
          </Link>
        </div>
      )}
    </nav>
  );
}

import { Film, Globe } from 'lucide-react';

export default function GlobalReach() {
  const languages = [
    { code: 'EN', name: 'English', flag: '🇬🇧' },
    { code: 'FR', name: 'French', flag: '🇫🇷' },
    { code: 'ES', name: 'Spanish', flag: '🇪🇸' },
    { code: 'HI', name: 'Hindi', flag: '🇮🇳' },
    { code: 'ZH', name: 'Mandarin', flag: '🇨🇳' },
    { code: 'PT', name: 'Portuguese', flag: '🇧🇷' },
    { code: 'JA', name: 'Japanese', flag: '🇯🇵' },
    { code: 'DE', name: 'German', flag: '🇩🇪' },
    { code: 'AR', name: 'Arabic', flag: '🇸🇦' },
    { code: 'KO', name: 'Korean', flag: '🇰🇷' },
  ];

  return (
    <section className="section bg-[#0c0c14] border-y border-white/5">
      <div className="container-max">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-brand-400" />
          <span className="text-sm font-medium text-brand-400 uppercase tracking-wide">Global Reach</span>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Content in <span className="gradient-text">many languages</span>
        </h2>
        <p className="text-lg text-gray-400 max-w-2xl mb-12">
          Same trending formats, narrated in the language your audience speaks. Pick a voice,
          write or generate your script, and publish without re-editing from scratch.
        </p>

        {/* Language grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {languages.map((lang) => (
            <div
              key={lang.code}
              className="glass-card rounded-xl p-4 text-center group cursor-pointer"
            >
              <div className="text-3xl mb-2">{lang.flag}</div>
              <div className="text-sm font-medium group-hover:text-brand-300 transition-colors">
                {lang.name}
              </div>
              <div className="text-xs text-gray-500">{lang.code}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

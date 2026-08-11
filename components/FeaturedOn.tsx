import { Film } from 'lucide-react';

export default function FeaturedOn() {
  const features = [
    { name: 'AI Video Tools Pro', url: 'https://www.aivideotoolspro.com' },
    { name: 'Toolify', url: 'https://www.toolify.com' },
    { name: 'TAAFT', url: 'https://www.taaft.com' },
  ];

  return (
    <section className="py-12 border-b border-white/5">
      <div className="container-max">
        <div className="flex flex-col items-center gap-6">
          <p className="text-sm text-gray-500 uppercase tracking-wider">Featured On</p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {features.map((feature) => (
              <div
                key={feature.name}
                className="text-xl font-semibold text-gray-500 hover:text-gray-300 transition-colors"
              >
                {feature.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import LongFormEpisodes from '@/components/LongFormEpisodes';
import HowItWorks from '@/components/HowItWorks';
import TrendingFormats from '@/components/TrendingFormats';
import FormatShowcase from '@/components/FormatShowcase';
import GlobalReach from '@/components/GlobalReach';
import FeaturedOn from '@/components/FeaturedOn';
import Monetisation from '@/components/Monetisation';
import Pricing from '@/components/Pricing';
import FAQ from '@/components/FAQ';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <LongFormEpisodes />
        <HowItWorks />
        <TrendingFormats />
        <FormatShowcase />
        <GlobalReach />
        <FeaturedOn />
        <Monetisation />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}

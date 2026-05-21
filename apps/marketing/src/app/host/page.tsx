import Link from 'next/link'
import { ArrowRight, CheckCircle2, Music, Users, Smartphone, Zap } from 'lucide-react'
import { Button } from '@singr/ui'

export const metadata = {
  title: 'Singr Karaoke — For Hosts & KJs',
  description:
    'Run your karaoke night with a modern dashboard, real-time requests from singers, and a direct OpenKJ bridge.',
}

const features = [
  {
    name: 'Real-time Requests',
    description: 'Singers send requests straight from their phone to your dashboard. No more slips of paper or illegible handwriting.',
    icon: Smartphone,
  },
  {
    name: 'OpenKJ Bridge',
    description: 'Sync your entire OpenKJ catalog to Singr instantly. Requests flow right into your existing rotation management.',
    icon: Zap,
  },
  {
    name: 'Multi-Venue Ready',
    description: 'Manage multiple venues, different show nights, and varying song books all from one centralized dashboard.',
    icon: Users,
  },
  {
    name: 'Custom Branding',
    description: 'Upload your logo and create a custom branded portal for your singers to interact with your show.',
    icon: Music,
  },
]

export default function HostLandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 h-[30rem] w-[30rem] -translate-y-1/2 translate-x-1/2 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[30rem] w-[30rem] translate-y-1/2 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/singr-logo-color.png"
            alt="Singr Karaoke"
            className="h-9 w-auto"
          />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="hidden text-sm font-medium text-slate-600 transition hover:text-slate-900 sm:inline-flex"
          >
            Back to home
          </Link>
          <Button asChild size="sm" className="bg-gradient-to-tr from-[#EF3B30] to-[#FBB03B] text-white hover:opacity-90 border-0 shadow-sm">
            <a href="https://host.singrkaraoke.com/auth/signin">Sign In</a>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-8 sm:px-8 sm:pt-16">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-20">
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-black sm:text-5xl md:text-6xl">
            Take the hassle out of hosting.
          </h1>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-slate-600 sm:text-xl max-w-2xl">
            Singr is the modern bridge between your karaoke setup and your singers. Ditch the paper slips and step into the future of karaoke management.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-tr from-[#EF3B30] to-[#FBB03B] text-white hover:opacity-90 border-0 shadow-md h-14 px-8 text-lg"
            >
              <a href="https://host.singrkaraoke.com/auth/signup">
                Start your free trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 h-14 px-8 text-lg shadow-sm"
            >
              <a href="#features">Learn more</a>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div id="features" className="py-12">
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature) => (
              <div key={feature.name} className="flex gap-4 p-6 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition">
                <div className="flex-shrink-0">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#EF3B30]/10 to-[#FBB03B]/10 text-primary">
                    <feature.icon className="h-6 w-6" />
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.name}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Section */}
        <div className="py-20 mt-12 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#EF3B30] to-[#FBB03B]" />
          <div className="px-6 py-12 sm:p-16 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Simple, transparent pricing</h2>
            <p className="mt-4 text-lg text-slate-600">Everything you need to run your shows, at one flat rate.</p>
            
            <div className="mt-12 p-8 rounded-2xl border border-slate-200 bg-slate-50 relative">
              <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2">
                <span className="inline-flex rounded-full bg-primary/10 px-4 py-1 text-sm font-semibold tracking-wide text-primary">
                  Pro Host
                </span>
              </div>
              <div className="mt-4 flex items-baseline justify-center gap-x-2">
                <span className="text-5xl font-bold tracking-tight text-slate-900">$29</span>
                <span className="text-base font-semibold leading-7 text-slate-600">/month</span>
              </div>
              <ul className="mt-8 space-y-3 text-sm leading-6 text-slate-600 text-left max-w-xs mx-auto">
                <li className="flex gap-x-3">
                  <CheckCircle2 className="h-6 w-5 flex-none text-primary" />
                  Unlimited Singers & Requests
                </li>
                <li className="flex gap-x-3">
                  <CheckCircle2 className="h-6 w-5 flex-none text-primary" />
                  Full OpenKJ Sync
                </li>
                <li className="flex gap-x-3">
                  <CheckCircle2 className="h-6 w-5 flex-none text-primary" />
                  Multi-Venue Support
                </li>
                <li className="flex gap-x-3">
                  <CheckCircle2 className="h-6 w-5 flex-none text-primary" />
                  7-Day Free Trial
                </li>
              </ul>
              <Button
                asChild
                className="mt-8 w-full bg-slate-900 text-white hover:bg-slate-800 shadow-md h-12 text-base"
              >
                <a href="https://host.singrkaraoke.com/auth/signup">Get started today</a>
              </Button>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:px-8">
          <p>
            &copy; {new Date().getFullYear()} KirkNetworks, LLC. All rights
            reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link
              href="/legal/privacy"
              className="transition hover:text-slate-900"
            >
              Privacy Policy
            </Link>
            <Link
              href="/legal/terms"
              className="transition hover:text-slate-900"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

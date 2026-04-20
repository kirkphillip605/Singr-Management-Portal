import Link from 'next/link'
import { headers } from 'next/headers'
import { ArrowRight, Headphones, Mic2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { siblingSurfaceUrl } from '@/lib/portal-links'

export const metadata = {
  title: 'Singr Karaoke — Choose your experience',
  description:
    'Singr Karaoke connects singers and karaoke hosts with a modern, real-time request platform. Choose your experience to get started.',
}

const choices = [
  {
    role: 'Singer' as const,
    href: 'https://app.singrkaraoke.com',
    icon: Mic2,
    tagline: 'For karaoke fans',
    description:
      'Find the karaoke night you\u2019re at, browse the song book, and send your request to the KJ from your phone.',
    bullets: [
      'Auto-check-in at participating venues',
      'Lightning-fast song search & favorites',
      'See where you are in the rotation',
    ],
    cta: 'I\u2019m here to sing',
  },
  {
    role: 'Karaoke Host' as const,
    href: 'https://host.singrkaraoke.com',
    icon: Headphones,
    tagline: 'For KJs & venue owners',
    description:
      'Run your karaoke night with a modern dashboard, real-time requests from singers, and a direct OpenKJ bridge.',
    bullets: [
      'Drop-in OpenKJ integration',
      'Multi-venue management',
      'Custom branding for your show',
    ],
    cta: 'I\u2019m running the show',
  },
]

export default async function LandingPage() {
  const hdrs = await headers()
  const adminSignInHref = siblingSurfaceUrl(hdrs.get('host'), 'admin', '/auth/signin')
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/singr-icon.png"
            alt="Singr Karaoke"
            className="h-9 w-9"
          />
          <span className="text-base font-semibold tracking-tight">
            Singr Karaoke
          </span>
        </Link>
        <a
          href="https://host.singrkaraoke.com"
          className="hidden text-sm font-medium text-slate-300 transition hover:text-white sm:inline-flex"
        >
          Host sign in
          <ArrowRight className="ml-1 h-4 w-4" />
        </a>
      </header>

      <main className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 pb-24 pt-8 sm:px-8 sm:pt-16">
        <div className="mb-12 max-w-3xl text-center sm:mb-16">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-300 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />
            Karaoke, reimagined
          </span>
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            One stage. Two ways in.
          </h1>
          <p className="mt-5 text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
            Singr Karaoke brings singers and hosts together with a modern,
            real-time request platform. Pick the door that&rsquo;s yours.
          </p>
        </div>

        <div className="grid w-full gap-6 sm:gap-8 md:grid-cols-2">
          {choices.map((choice) => (
            <a
              key={choice.role}
              href={choice.href}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:p-9"
            >
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition group-hover:opacity-100" />
              <div className="mb-6 flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-indigo-500/30 text-fuchsia-100 ring-1 ring-inset ring-white/10">
                  <choice.icon className="h-6 w-6" />
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  {choice.tagline}
                </span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {choice.role}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                {choice.description}
              </p>
              <ul className="mt-6 space-y-2 text-sm text-slate-300">
                {choice.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-fuchsia-300" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex-1" />
              <Button
                asChild
                size="lg"
                className="mt-2 w-full justify-between bg-white text-slate-900 hover:bg-slate-100"
              >
                <span>
                  {choice.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              </Button>
              <div className="mt-3 text-xs text-slate-500">
                {choice.href.replace('https://', '')}
              </div>
            </a>
          ))}
        </div>

        <p className="mt-12 max-w-xl text-center text-xs text-slate-500 sm:mt-16">
          Not sure which one is for you? If you&rsquo;re running the
          karaoke night, you&rsquo;re a Host. If you want to sing,
          you&rsquo;re a Singer.
        </p>
      </main>

      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:px-8">
          <p>
            &copy; {new Date().getFullYear()} KirkNetworks, LLC. All rights
            reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link
              href="/legal/privacy"
              className="transition hover:text-slate-300"
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              className="transition hover:text-slate-300"
            >
              Terms
            </Link>
            <a
              href={adminSignInHref}
              className="transition hover:text-slate-300"
            >
              Support login
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

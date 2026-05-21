import Link from 'next/link'
import { LEGAL_LAST_UPDATED, POLICIES, COMPANY } from '@/lib/legal-content'

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/singr-icon.png"
              alt="Singr Karaoke"
              className="h-8 w-8"
            />
            <span className="text-lg font-semibold text-gray-900">
              {COMPANY.brand}
            </span>
          </Link>
          <div className="flex gap-4 text-sm">
            <Link
              href={POLICIES.privacy.href}
              className="text-gray-600 hover:text-primary"
            >
              Privacy
            </Link>
            <Link
              href={POLICIES.terms.href}
              className="text-gray-600 hover:text-primary"
            >
              Terms
            </Link>
            <Link
              href={POLICIES.refund.href}
              className="text-gray-600 hover:text-primary"
            >
              Refund
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </article>
        <p className="mt-6 text-center text-xs text-gray-500">
          Last updated {LEGAL_LAST_UPDATED}
        </p>
      </main>
    </div>
  )
}

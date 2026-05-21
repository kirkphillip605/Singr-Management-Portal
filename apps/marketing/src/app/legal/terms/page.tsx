import { POLICIES, PolicyContent } from '@/lib/legal-content'

export const metadata = { title: POLICIES.terms.title }

export default function TermsPage() {
  return (
    <>
      <h1 className="mb-4 text-3xl font-bold text-gray-900">
        {POLICIES.terms.title}
      </h1>
      <PolicyContent policy="terms" />
    </>
  )
}

import { POLICIES, PolicyContent } from '@/lib/legal-content'

export const metadata = { title: POLICIES.privacy.title }

export default function PrivacyPage() {
  return (
    <>
      <h1 className="mb-4 text-3xl font-bold text-gray-900">
        {POLICIES.privacy.title}
      </h1>
      <PolicyContent policy="privacy" />
    </>
  )
}

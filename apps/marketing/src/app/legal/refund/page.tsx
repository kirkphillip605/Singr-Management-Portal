import { POLICIES, PolicyContent } from '@/lib/legal-content'

export const metadata = { title: POLICIES.refund.title }

export default function RefundPage() {
  return (
    <>
      <h1 className="mb-4 text-3xl font-bold text-gray-900">
        {POLICIES.refund.title}
      </h1>
      <PolicyContent policy="refund" />
    </>
  )
}

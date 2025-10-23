import { Session } from 'next-auth'

/**
 * Check if the user has the required role for the billing portal
 * @param session - The NextAuth session
 * @returns true if the user has the customer_owner role
 */
export function hasCustomerOwnerRole(session: Session | null): boolean {
  if (!session?.user) {
    return false
  }

  const requiredRole = process.env.FUSIONAUTH_REQUIRED_ROLE || 'customer_owner'
  const userRoles = session.user.roles || []

  return userRoles.includes(requiredRole)
}

/**
 * Check if the user has access to the billing portal
 * This checks both for the customer_owner role and customer account type
 * @param session - The NextAuth session
 * @returns true if the user has access to the billing portal
 */
export function hasBillingPortalAccess(session: Session | null): boolean {
  if (!session?.user) {
    return false
  }

  // Check if user is a customer (not admin)
  const isCustomer = session.user.accountType === 'customer'

  // Check if user has the required role from FusionAuth
  const hasRequiredRole = hasCustomerOwnerRole(session)

  return isCustomer && hasRequiredRole
}

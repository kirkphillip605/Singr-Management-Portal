'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  User,
  Shield,
  CreditCard,
  Phone,
  KeyRound,
  Link2,
  Mail,
  Lock,
  Building2,
} from 'lucide-react'
import {
  authClient,
  changePassword,
  phoneNumber as phoneClient,
  twoFactor as twoFactorClient,
  linkSocial,
  unlinkAccount,
} from '@/lib/auth-client'
import { IconInput } from '@/components/ui/icon-input'
import { PhoneInput, toE164US } from '@/components/phone-input'
import { OtpInput } from '@/components/otp-input'
import { PolicyDialog } from '@/components/legal-policy-dialog'

interface UserProps {
  id: string
  name: string
  email: string
  businessName: string
  phoneNumber: string
  phoneNumberVerified: boolean
  twoFactorEnabled: boolean
  accounts: { id: string; providerId: string }[]
}

interface Props {
  user: UserProps
  activeSubscription: { status: string; currentPeriodEnd: string } | null
}

export function SettingsClient({ user, activeSubscription }: Props) {
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [businessName, setBusinessName] = useState(user.businessName)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)

  const [newEmail, setNewEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)

  const [phoneInput, setPhoneInput] = useState(user.phoneNumber ?? '')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [phoneStage, setPhoneStage] = useState<'idle' | 'sent'>('idle')
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null)
  const [phoneConsent, setPhoneConsent] = useState(false)

  const [twoFaPassword, setTwoFaPassword] = useState('')
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [twoFaMsg, setTwoFaMsg] = useState<string | null>(null)

  const hasGoogle = user.accounts.some((a) => a.providerId === 'google')
  const hasCredential = user.accounts.some((a) => a.providerId === 'credential')

  const handleChangeEmail = async () => {
    setEmailMsg(null)
    // Better Auth's change-email flow sends a confirmation link to the new
    // address; the actual change only takes effect once the user clicks it.
    const { error } = await authClient.$fetch('/change-email', {
      method: 'POST',
      body: {
        newEmail,
        callbackURL: '/dashboard/settings',
      },
    })
    if (error) {
      setEmailMsg(error.message || 'Could not request email change')
      return
    }
    setEmailMsg(
      `We sent a confirmation link to ${newEmail}. Click it to finish the change.`
    )
    setNewEmail('')
  }

  const handleSaveProfile = async () => {
    setProfileMsg(null)
    // Better Auth's update-user endpoint accepts the additional fields we
    // declared on the server (`businessName`). Calling the raw endpoint via
    // $fetch avoids fighting the generated client typings, which narrow to
    // the built-in fields only.
    const { error } = await authClient.$fetch('/update-user', {
      method: 'POST',
      body: { name, businessName },
    })
    setProfileMsg(error ? error.message || 'Failed to save' : 'Saved')
    router.refresh()
  }

  const handleChangePassword = async () => {
    setPwMsg(null)
    const { error } = await changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    if (error) {
      setPwMsg(error.message || 'Could not change password')
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setPwMsg('Password updated')
  }

  const handleSendPhoneOtp = async () => {
    setPhoneMsg(null)
    if (!phoneConsent) {
      setPhoneMsg('Please confirm SMS consent before sending a code')
      return
    }
    const e164 = toE164US(phoneInput) || phoneInput
    if (!/^\+1\d{10}$/.test(e164)) {
      setPhoneMsg('Please enter a valid US/CA phone number')
      return
    }
    const { error } = await phoneClient.sendOtp({ phoneNumber: e164 })
    if (error) {
      setPhoneMsg(error.message || 'Could not send code')
      return
    }
    setPhoneStage('sent')
    setPhoneMsg('Verification code sent')
  }

  const handleVerifyPhoneOtp = async (codeOverride?: string) => {
    setPhoneMsg(null)
    const e164 = toE164US(phoneInput) || phoneInput
    const { error } = await phoneClient.verify({
      phoneNumber: e164,
      code: codeOverride ?? phoneOtp,
      updatePhoneNumber: true,
    })
    if (error) {
      setPhoneMsg(error.message || 'Could not verify code')
      return
    }
    setPhoneStage('idle')
    setPhoneOtp('')
    setPhoneMsg('Phone verified')
    router.refresh()
  }

  const handleEnableTotp = async () => {
    setTwoFaMsg(null)
    const { data, error } = await twoFactorClient.enable({
      password: twoFaPassword,
    })
    if (error) {
      setTwoFaMsg(error.message || 'Could not enable 2FA')
      return
    }
    setTotpUri(data?.totpURI ?? null)
    setBackupCodes(data?.backupCodes ?? null)
    setTwoFaMsg('Two-factor enabled — scan the QR / save backup codes')
    router.refresh()
  }

  const handleDisableTotp = async () => {
    setTwoFaMsg(null)
    const { error } = await twoFactorClient.disable({ password: twoFaPassword })
    if (error) {
      setTwoFaMsg(error.message || 'Could not disable 2FA')
      return
    }
    setTwoFaMsg('Two-factor disabled')
    router.refresh()
  }

  const handleLinkGoogle = async () => {
    await linkSocial({
      provider: 'google',
      callbackURL: '/dashboard/settings',
    })
  }

  const handleUnlinkGoogle = async () => {
    const acct = user.accounts.find((a) => a.providerId === 'google')
    if (!acct) return
    await unlinkAccount({ providerId: 'google' })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account, security, and billing
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone
          </TabsTrigger>
          <TabsTrigger value="connections" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile information</CardTitle>
              <CardDescription>
                Update your account profile information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <IconInput
                    id="name"
                    icon={User}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <IconInput
                    id="email"
                    type="email"
                    icon={Mail}
                    defaultValue={user.email}
                    disabled
                    autoComplete="email"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed here. Contact support if needed.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessName">Business name</Label>
                <IconInput
                  id="businessName"
                  icon={Building2}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  autoComplete="organization"
                />
              </div>

              {profileMsg && (
                <p className="text-sm text-muted-foreground">{profileMsg}</p>
              )}
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleSaveProfile}>Save changes</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change email address</CardTitle>
              <CardDescription>
                We&apos;ll send a confirmation link to your new address. Your
                email won&apos;t change until you click the link.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newEmail">New email</Label>
                <IconInput
                  id="newEmail"
                  type="email"
                  icon={Mail}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              {emailMsg && (
                <p className="text-sm text-muted-foreground">{emailMsg}</p>
              )}
              <div className="flex justify-end">
                <Button onClick={handleChangeEmail} disabled={!newEmail}>
                  Send confirmation
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>
                Use a strong, unique password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <IconInput
                  id="currentPassword"
                  type="password"
                  icon={Lock}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <IconInput
                  id="newPassword"
                  type="password"
                  icon={Lock}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {pwMsg && (
                <p className="text-sm text-muted-foreground">{pwMsg}</p>
              )}
              <div className="flex justify-end">
                <Button onClick={handleChangePassword}>Update password</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Two-factor authentication
              </CardTitle>
              <CardDescription>
                {user.twoFactorEnabled
                  ? 'Two-factor is enabled on your account'
                  : 'Add an extra layer of security with TOTP, SMS, or email codes'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Authenticator app (TOTP)</p>
                  <Badge
                    variant={user.twoFactorEnabled ? 'default' : 'secondary'}
                  >
                    {user.twoFactorEnabled ? 'Active' : 'Not set up'}
                  </Badge>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">SMS code</p>
                  <Badge
                    variant={
                      user.twoFactorEnabled && user.phoneNumberVerified
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {user.twoFactorEnabled && user.phoneNumberVerified
                      ? 'Active'
                      : user.phoneNumberVerified
                        ? 'Available'
                        : 'Verify phone first'}
                  </Badge>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Email code</p>
                  <Badge
                    variant={user.twoFactorEnabled ? 'default' : 'secondary'}
                  >
                    {user.twoFactorEnabled ? 'Active' : 'Available'}
                  </Badge>
                </div>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Once 2FA is enabled, you can verify at sign-in with an
                  authenticator app (TOTP), an SMS code (if your phone is
                  verified), or an email code — choose your channel on the
                  challenge screen. SMS codes are sent to your verified phone
                  number; email codes are sent to your account email.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="twoFaPassword">Confirm with password</Label>
                <IconInput
                  id="twoFaPassword"
                  type="password"
                  icon={Lock}
                  value={twoFaPassword}
                  onChange={(e) => setTwoFaPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              {twoFaMsg && (
                <p className="text-sm text-muted-foreground">{twoFaMsg}</p>
              )}

              {totpUri && (
                <div className="rounded-md border p-3 text-sm break-all">
                  <p className="font-medium mb-1">Authenticator URI</p>
                  <code>{totpUri}</code>
                </div>
              )}

              {backupCodes && backupCodes.length > 0 && (
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium mb-2">Backup codes</p>
                  <div className="grid grid-cols-2 gap-1 font-mono">
                    {backupCodes.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                {user.twoFactorEnabled ? (
                  <Button variant="destructive" onClick={handleDisableTotp}>
                    Disable 2FA
                  </Button>
                ) : (
                  <Button onClick={handleEnableTotp}>Enable 2FA</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phone" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Phone number</CardTitle>
              <CardDescription>
                Verify a phone number to use SMS sign-in and SMS-based 2FA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">Status:</span>
                {user.phoneNumberVerified ? (
                  <Badge>Verified</Badge>
                ) : (
                  <Badge variant="secondary">Unverified</Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <PhoneInput
                  id="phone"
                  value={phoneInput}
                  onChange={(formatted) => setPhoneInput(formatted)}
                  disabled={phoneStage === 'sent'}
                />
              </div>

              <label className="flex items-start gap-3 rounded-md border border-input bg-background p-3 text-xs leading-relaxed text-muted-foreground">
                <input
                  type="checkbox"
                  checked={phoneConsent}
                  onChange={(e) => setPhoneConsent(e.target.checked)}
                  disabled={phoneStage === 'sent'}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-required="true"
                />
                <span>
                  By checking this box and providing my mobile number, I
                  confirm that the number belongs to me and I consent to
                  receive SMS messages from Singr, including account-related
                  notifications (such as verification codes, security alerts,
                  and service updates). Message and data rates may apply.
                  Message frequency will vary based on account activity. View{' '}
                  <PolicyDialog
                    policy="privacy"
                    trigger={
                      <button
                        type="button"
                        className="text-primary underline hover:no-underline"
                      >
                        Privacy Policy
                      </button>
                    }
                  />{' '}
                  here.
                  <br />
                  <br />I understand that I can opt out of non-essential
                  messages at any time by following the instructions provided
                  in the message (e.g., replying STOP), and that consent is
                  not a condition of using the service.
                </span>
              </label>

              {phoneStage === 'sent' && (
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification code</Label>
                  <OtpInput
                    id="otp"
                    value={phoneOtp}
                    onChange={setPhoneOtp}
                    onComplete={(c) => handleVerifyPhoneOtp(c)}
                    autoFocus
                  />
                </div>
              )}

              {phoneMsg && (
                <p className="text-sm text-muted-foreground">{phoneMsg}</p>
              )}

              <div className="flex justify-end gap-2">
                {phoneStage === 'idle' ? (
                  <Button
                    onClick={handleSendPhoneOtp}
                    disabled={!phoneConsent || !phoneInput}
                  >
                    Send code
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleSendPhoneOtp}>
                      Resend
                    </Button>
                    <Button
                      onClick={() => handleVerifyPhoneOtp()}
                      disabled={phoneOtp.length < 6}
                    >
                      Verify
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connected accounts</CardTitle>
              <CardDescription>
                Link or unlink third-party sign-in providers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Google</p>
                  <p className="text-sm text-muted-foreground">
                    {hasGoogle
                      ? 'Connected — you can sign in with Google'
                      : 'Not connected'}
                  </p>
                </div>
                {hasGoogle ? (
                  <Button
                    variant="outline"
                    onClick={handleUnlinkGoogle}
                    disabled={!hasCredential}
                    title={
                      hasCredential
                        ? 'Unlink Google'
                        : 'Set a password before unlinking your only sign-in method'
                    }
                  >
                    Unlink
                  </Button>
                ) : (
                  <Button onClick={handleLinkGoogle}>Link Google</Button>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email & password</p>
                  <p className="text-sm text-muted-foreground">
                    {hasCredential
                      ? 'Configured'
                      : 'Not configured — set a password from the Security tab'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current subscription</CardTitle>
              <CardDescription>
                Manage your Singr Karaoke Connect subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeSubscription ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Pro Plan</h3>
                      <p className="text-sm text-muted-foreground">
                        Active subscription
                      </p>
                    </div>
                    <Badge
                      variant={
                        activeSubscription.status === 'active'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {activeSubscription.status}
                    </Badge>
                  </div>

                  <div className="text-sm">
                    <p>
                      Next billing date:{' '}
                      {new Date(
                        activeSubscription.currentPeriodEnd
                      ).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" asChild>
                      <a href="/dashboard/billing">Manage billing</a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">
                    No active subscription
                  </p>
                  <Button asChild>
                    <a href="/dashboard/billing/plans">Choose a plan</a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

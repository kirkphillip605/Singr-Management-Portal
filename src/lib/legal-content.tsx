import * as React from 'react'

export const LEGAL_LAST_UPDATED = 'April 20, 2026'

export const COMPANY = {
  legalName: 'KirkNetworks, LLC',
  dbaName: 'Singr Karaoke',
  brand: 'Singr Karaoke Connect',
  address: '420 8th St SE, Watertown, SD 57201',
  phone: '(605) 760-8830',
  email: 'support@singrkaraoke.com',
  state: 'South Dakota',
}

export type PolicyKey = 'privacy' | 'terms' | 'refund'

export interface PolicyMeta {
  key: PolicyKey
  title: string
  href: string
}

export const POLICIES: Record<PolicyKey, PolicyMeta> = {
  privacy: { key: 'privacy', title: 'Privacy Policy', href: '/legal/privacy' },
  terms: { key: 'terms', title: 'Terms of Service', href: '/legal/terms' },
  refund: { key: 'refund', title: 'Refund Policy', href: '/legal/refund' },
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-8 mb-3 text-xl font-semibold text-gray-900">{children}</h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-sm leading-6 text-gray-700">{children}</p>
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mb-4 list-disc space-y-1 pl-6 text-sm leading-6 text-gray-700">
      {children}
    </ul>
  )
}

export function PolicyContent({ policy }: { policy: PolicyKey }) {
  if (policy === 'privacy') return <PrivacyPolicy />
  if (policy === 'terms') return <TermsOfService />
  return <RefundPolicy />
}

function PrivacyPolicy() {
  return (
    <div>
      <P>
        This Privacy Policy describes how {COMPANY.legalName} (&ldquo;
        {COMPANY.legalName}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
        &ldquo;our&rdquo;), doing business as {COMPANY.dbaName}, collects,
        uses, and shares information when you use {COMPANY.brand} (the
        &ldquo;Service&rdquo;).
      </P>

      <H2>Who we are</H2>
      <P>
        {COMPANY.legalName} dba {COMPANY.dbaName}, {COMPANY.address}. You can
        contact us at {COMPANY.phone} or {COMPANY.email}.
      </P>

      <H2>The Service</H2>
      <P>
        {COMPANY.brand} is a karaoke management platform for venue operators
        and karaoke hosts (&ldquo;KJs&rdquo;). It provides song-database
        management, venue management, request handling, OpenKJ integration,
        and related tools. An account is required to use most features.
      </P>

      <H2>Information we collect</H2>
      <UL>
        <li>
          <strong>Account information:</strong> name, email address, business
          name, password (stored only as a salted hash), and optional phone
          number.
        </li>
        <li>
          <strong>Authentication data:</strong> sign-in identifiers, two-factor
          authentication settings, backup codes, and linked third-party sign-in
          providers (e.g. Google).
        </li>
        <li>
          <strong>Service content:</strong> venues you create, song database
          entries you upload, API keys you generate, and karaoke requests
          submitted at your venues.
        </li>
        <li>
          <strong>Billing information:</strong> subscription status and billing
          history. Card numbers are handled by Stripe and are not stored on
          our servers.
        </li>
        <li>
          <strong>Communications:</strong> support requests and any messages
          you send us.
        </li>
        <li>
          <strong>Technical data:</strong> IP address, browser/device
          information, and basic log data needed to operate and secure the
          Service.
        </li>
      </UL>

      <H2>How we use information</H2>
      <UL>
        <li>To provide, maintain, and improve the Service.</li>
        <li>To authenticate you and protect your account.</li>
        <li>
          To send you transactional messages such as verification codes,
          security alerts, billing notices, and service updates.
        </li>
        <li>To process payments and manage subscriptions.</li>
        <li>To respond to your support requests.</li>
        <li>To detect, investigate, and prevent abuse, fraud, or violations.</li>
        <li>To comply with legal obligations.</li>
      </UL>

      <H2>SMS program</H2>
      <P>
        If you provide a mobile number and consent, we use SMS, delivered via
        Twilio, to send one-time verification codes for sign-in and two-factor
        authentication, security alerts, and other account-related
        notifications. Message and data rates may apply. Message frequency
        varies based on account activity. You can opt out of non-essential
        messages at any time by replying <strong>STOP</strong>; reply{' '}
        <strong>HELP</strong> for help. Opting out of essential security
        messages may require disabling SMS-based features in your account
        settings or contacting support. Consent to receive SMS is not a
        condition of using the Service.
      </P>

      <H2>Cookies</H2>
      <UL>
        <li>
          <strong>Essential session cookies</strong> are used to keep you
          signed in and to protect your session. The Service will not function
          without these.
        </li>
        <li>
          <strong>Preference cookies</strong> remember basic UI choices such
          as your last-used dashboard view.
        </li>
        <li>
          We do not currently run third-party advertising or marketing
          analytics cookies. If we add analytics in the future we will update
          this policy.
        </li>
      </UL>

      <H2>Third-party processors</H2>
      <P>We share data with the following service providers strictly to operate the Service:</P>
      <UL>
        <li>
          <strong>Google</strong> &mdash; OAuth sign-in. If you choose to sign
          in with Google we receive your name, email address, and Google
          account identifier.{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Google Privacy Policy
          </a>
          .
        </li>
        <li>
          <strong>Twilio</strong> &mdash; SMS delivery for one-time codes,
          two-factor authentication, and account notifications. We share the
          recipient phone number and the message body.{' '}
          <a
            href="https://www.twilio.com/legal/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Twilio Privacy Notice
          </a>
          .
        </li>
        <li>
          <strong>Stripe</strong> &mdash; payment processing and subscription
          management. Stripe receives your name, email, billing address, and
          payment method details directly.{' '}
          <a
            href="https://stripe.com/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Stripe Privacy Policy
          </a>
          .
        </li>
        <li>
          <strong>Email delivery and hosting providers</strong> &mdash; we use
          standard infrastructure providers to host the Service and to deliver
          transactional email. These providers process data only on our behalf
          and under appropriate confidentiality terms.
        </li>
      </UL>

      <H2>Data retention</H2>
      <P>
        We keep account and Service data for as long as your account is active
        and for a reasonable period afterward to comply with legal, tax, and
        accounting obligations, resolve disputes, and enforce our agreements.
        You may request deletion of your account by contacting{' '}
        {COMPANY.email}; some records (such as billing history) may be
        retained where required by law.
      </P>

      <H2>Your rights</H2>
      <P>
        Depending on where you live, you may have the right to access,
        correct, delete, or export your personal information, and to object to
        or restrict certain processing. To make a request, email{' '}
        {COMPANY.email}. We will respond within the time required by
        applicable law.
      </P>

      <H2>Children</H2>
      <P>
        The Service is not directed to children under 13, and we do not
        knowingly collect personal information from children under 13.
      </P>

      <H2>Security</H2>
      <P>
        We use industry-standard safeguards including encryption in transit,
        hashed passwords, and access controls. No system is perfectly secure;
        you are responsible for keeping your password and API keys
        confidential.
      </P>

      <H2>International users</H2>
      <P>
        The Service is operated from the United States. By using the Service
        you understand that your information will be processed in the United
        States.
      </P>

      <H2>Changes to this policy</H2>
      <P>
        We may update this Privacy Policy from time to time. Material changes
        will be reflected in the &ldquo;Last updated&rdquo; date above and,
        where appropriate, communicated through the Service.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about this Privacy Policy can be sent to {COMPANY.email} or
        by mail to {COMPANY.legalName}, {COMPANY.address}.
      </P>
    </div>
  )
}

function TermsOfService() {
  return (
    <div>
      <P>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of{' '}
        {COMPANY.brand} (the &ldquo;Service&rdquo;), provided by{' '}
        {COMPANY.legalName} dba {COMPANY.dbaName}. By creating an account or
        using the Service you agree to these Terms.
      </P>

      <H2>The Service</H2>
      <P>
        {COMPANY.brand} provides karaoke management tools for venue operators,
        including song-database management, venue management, request
        handling, OpenKJ integration, and related features. We may update,
        change, or discontinue features at any time.
      </P>

      <H2>Accounts</H2>
      <UL>
        <li>You must be at least 18 years old to create an account.</li>
        <li>
          You are responsible for the accuracy of the information you provide,
          for keeping your credentials and API keys confidential, and for all
          activity under your account.
        </li>
        <li>
          You agree to notify us at {COMPANY.email} if you suspect any
          unauthorized use.
        </li>
      </UL>

      <H2>Acceptable use</H2>
      <P>You agree not to:</P>
      <UL>
        <li>Violate any law or any third party&apos;s rights.</li>
        <li>
          Upload, store, or distribute content you do not have the right to
          use, including copyrighted song data you are not licensed to manage.
        </li>
        <li>
          Attempt to gain unauthorized access to the Service or to any other
          account, or interfere with or disrupt the Service.
        </li>
        <li>
          Use the Service to send unsolicited messages, spam, or any
          deceptive, harassing, or abusive communication.
        </li>
        <li>
          Reverse engineer, scrape, or otherwise misuse the Service or its
          APIs in violation of these Terms.
        </li>
      </UL>

      <H2>Suspension and termination</H2>
      <P>
        {COMPANY.dbaName} / {COMPANY.legalName} may, in its sole discretion,
        suspend, restrict, or discontinue all or part of the Service to any
        user at any time, for any reason or no reason, with or without notice,
        including (but not limited to) when we detect abuse, misuse, fraud,
        non-payment, security risk, or violation of these Terms. We are not
        liable for any loss arising from such action.
      </P>

      <H2>Subscriptions, fees, and billing</H2>
      <UL>
        <li>
          Paid plans are billed in advance on a recurring basis through Stripe
          using the payment method you provide.
        </li>
        <li>
          You authorize us to charge that payment method for all fees,
          applicable taxes, and renewals until you cancel.
        </li>
        <li>
          You can cancel future renewals from the billing area of your
          account; cancellation stops further renewal charges but does not
          retroactively refund prior charges.
        </li>
        <li>
          We may change pricing on prospective renewal terms by giving
          reasonable notice through the Service or by email.
        </li>
      </UL>

      <H2>Refunds</H2>
      <P>
        Subscription fees are non-refundable except as expressly stated in the{' '}
        <a href="/legal/refund" className="text-primary underline">
          Refund Policy
        </a>
        , which is incorporated by reference.
      </P>

      <H2>SMS communications</H2>
      <P>
        If you provide a mobile number and consent, you agree to receive SMS
        messages from {COMPANY.dbaName} delivered via Twilio, including
        verification codes, two-factor authentication codes, security alerts,
        and other account-related notifications. Message and data rates may
        apply. Message frequency varies based on account activity. Reply{' '}
        <strong>STOP</strong> to opt out of non-essential messages or{' '}
        <strong>HELP</strong> for help. Consent is not a condition of using
        the Service.
      </P>

      <H2>Intellectual property</H2>
      <P>
        We retain all rights, title, and interest in the Service, including
        all software, designs, logos, and trademarks. You retain ownership of
        the content you upload, and grant us a non-exclusive license to host,
        process, and display that content solely as needed to operate and
        improve the Service for you.
      </P>

      <H2>Third-party services</H2>
      <P>
        The Service integrates with third-party services such as Google
        (sign-in), Twilio (SMS), Stripe (payments), and OpenKJ-compatible
        software. Your use of those services is also governed by their own
        terms and policies.
      </P>

      <H2>Disclaimers</H2>
      <P>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
        AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
        INCLUDING ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
        PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL
        BE UNINTERRUPTED OR ERROR-FREE.
      </P>

      <H2>Limitation of liability</H2>
      <P>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, {COMPANY.legalName.toUpperCase()}{' '}
        WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, OR
        DATA. OUR AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THE
        SERVICE WILL NOT EXCEED THE GREATER OF (A) THE FEES YOU PAID US IN
        THE 12 MONTHS PRECEDING THE CLAIM, OR (B) USD $100.
      </P>

      <H2>Indemnification</H2>
      <P>
        You agree to defend, indemnify, and hold harmless {COMPANY.legalName}{' '}
        and its officers, employees, and agents from any claim, damage, or
        expense arising from your use of the Service, your content, or your
        violation of these Terms.
      </P>

      <H2>Governing law</H2>
      <P>
        These Terms are governed by the laws of the State of {COMPANY.state},
        without regard to its conflict-of-law rules. Any dispute will be
        resolved exclusively in the state or federal courts located in{' '}
        {COMPANY.state}, and you consent to the personal jurisdiction of those
        courts.
      </P>

      <H2>Changes</H2>
      <P>
        We may update these Terms from time to time. Material changes will be
        reflected in the &ldquo;Last updated&rdquo; date above and, where
        appropriate, communicated through the Service. Continued use after
        changes take effect constitutes acceptance.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about these Terms can be sent to {COMPANY.email} or by mail
        to {COMPANY.legalName}, {COMPANY.address}.
      </P>
    </div>
  )
}

function RefundPolicy() {
  return (
    <div>
      <P>
        This Refund Policy applies to all purchases of {COMPANY.brand}{' '}
        subscriptions and related services from {COMPANY.legalName} dba{' '}
        {COMPANY.dbaName}.
      </P>

      <H2>All sales are final</H2>
      <P>
        All payments for subscriptions, renewals, add-ons, and any other paid
        features are <strong>final and non-refundable</strong>. We do not
        provide refunds, credits, or exchanges for unused time on a
        subscription, partial billing periods, downgrades, or for periods
        during which an account was inactive, unused, or under-utilized.
      </P>

      <H2>Cancellations</H2>
      <P>
        You may cancel your subscription at any time from the billing area of
        your account. Cancelling stops future renewal charges but does not
        entitle you to a refund of amounts already paid. You will continue to
        have access to paid features through the end of the current billing
        period.
      </P>

      <H2>Free trials</H2>
      <P>
        If a free trial is offered, you will not be charged during the trial
        period and may cancel before it ends to avoid being billed. Once a
        trial converts into a paid subscription, the no-refund terms above
        apply.
      </P>

      <H2>Failed payments</H2>
      <P>
        If a payment fails, we may retry the charge and may suspend access to
        paid features until payment is successful. Continued non-payment may
        result in cancellation and loss of access; previously paid amounts are
        not refunded.
      </P>

      <H2>Price changes</H2>
      <P>
        We may change prices on a forward-looking basis with reasonable notice.
        Price changes are not grounds for a refund of fees already paid.
      </P>

      <H2>Chargebacks</H2>
      <P>
        Initiating a chargeback or payment dispute without first contacting{' '}
        {COMPANY.email} to attempt resolution is a violation of these terms
        and may result in immediate suspension or termination of your account.
      </P>

      <H2>Limited statutory exceptions</H2>
      <P>
        Nothing in this Refund Policy is intended to limit or waive any
        non-waivable right you may have under applicable consumer-protection
        law. To the narrow extent such law requires us to provide a refund or
        other remedy that this policy would otherwise exclude, we will provide
        only the minimum remedy required by that law. This policy will be read
        and enforced to the maximum extent permitted by law.
      </P>

      <H2>How to request a review</H2>
      <P>
        If you believe your situation falls within a legally required
        exception, contact us at {COMPANY.email} with your account email and a
        description of the issue. We review such requests in good faith but
        reserve the right to decline any request not clearly required by law.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about this Refund Policy can be sent to {COMPANY.email} or
        by mail to {COMPANY.legalName}, {COMPANY.address}.
      </P>
    </div>
  )
}

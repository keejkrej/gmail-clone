'use client'

import { MailProvider } from '@/lib/mail'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DensityProvider } from '@/components/mail/shared'
import { GmailApp } from '@/components/mail/gmail-app'

export function GmailClone() {
  return (
    <MailProvider>
      <TooltipProvider delay={400}>
        <DensityProvider>
          <GmailApp />
          <Toaster position="bottom-left" closeButton visibleToasts={4} />
        </DensityProvider>
      </TooltipProvider>
    </MailProvider>
  )
}

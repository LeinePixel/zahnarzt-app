import type { TotpClient } from '@/features/auth/mfa-flow'
import { createClient } from '@/lib/supabase/client'

export function createBrowserTotpClient(): TotpClient {
  const supabase = createClient()

  return {
    async challengeAndVerify({ code, factorId }) {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        code,
        factorId,
      })

      return !error && data ? { ok: true } : { ok: false }
    },
    async enroll() {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'DentPilot',
      })

      return !error && data && data.type === 'totp'
        ? { factorId: data.id, qrCode: data.totp.qr_code }
        : null
    },
    async listFactors() {
      const { data, error } = await supabase.auth.mfa.listFactors()

      if (error || !data) {
        throw new Error('MFA factors unavailable')
      }

      return data.totp.map((factor) => ({ id: factor.id, status: factor.status }))
    },
  }
}

async function callSessionStateRpc(
  procedure: 'establish_session_state' | 'touch_session_state',
): Promise<boolean> {
  const { data, error } = await createClient().rpc(procedure)

  return !error && data === true
}

export function establishSessionState(): Promise<boolean> {
  return callSessionStateRpc('establish_session_state')
}

export function touchSessionState(): Promise<boolean> {
  return callSessionStateRpc('touch_session_state')
}

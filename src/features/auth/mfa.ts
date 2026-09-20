type Factor = { id: string; status: string }

type PrepareClient = {
  listFactors: () => Promise<{ data: { totp: Factor[] } | null; error: unknown }>
  enroll: (input: { factorType: 'totp' }) => Promise<{
    data: { id: string; totp: { qr_code: string } } | null
    error: unknown
  }>
}

type VerifyClient = {
  challenge: (input: { factorId: string }) => Promise<{
    data: { id: string } | null
    error: unknown
  }>
  verify: (input: { factorId: string; challengeId: string; code: string }) => Promise<{
    data: unknown
    error: unknown
  }>
}

export class MfaError extends Error {
  override name = 'MfaError'
}

export async function prepareTotp(client: PrepareClient) {
  const listed = await client.listFactors()
  if (listed.error || !listed.data) throw new MfaError('MFA konnte nicht vorbereitet werden.')
  const existing = listed.data.totp.find(factor => factor.status === 'verified')
  if (existing) return { factorId: existing.id, qrCode: null }

  const enrolled = await client.enroll({ factorType: 'totp' })
  if (enrolled.error || !enrolled.data) throw new MfaError('MFA konnte nicht vorbereitet werden.')
  return { factorId: enrolled.data.id, qrCode: enrolled.data.totp.qr_code }
}

export async function verifyTotp(client: VerifyClient, factorId: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false
  const challenged = await client.challenge({ factorId })
  if (challenged.error || !challenged.data) return false
  const verified = await client.verify({ factorId, challengeId: challenged.data.id, code })
  return !verified.error
}

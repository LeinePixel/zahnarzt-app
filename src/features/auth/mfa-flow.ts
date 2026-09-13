export type TotpFactor = {
  id: string
  status: 'verified' | 'unverified'
}

export type TotpClient = {
  challengeAndVerify: (input: {
    code: string
    factorId: string
  }) => Promise<{ ok: boolean }>
  enroll: () => Promise<{ factorId: string; qrCode: string } | null>
  listFactors: () => Promise<TotpFactor[]>
}

export type TotpPreparation =
  | { factorId: string; mode: 'enroll'; qrCode: string }
  | { factorId: string; mode: 'verify' }
  | { mode: 'unavailable' }

export async function prepareTotpChallenge(
  client: TotpClient,
  options: { allowEnrollment?: boolean } = {},
): Promise<TotpPreparation> {
  try {
    const factors = await client.listFactors()
    const factor = factors.find(
      (candidate) => candidate.status === 'verified',
    )

    if (factor) {
      return { factorId: factor.id, mode: 'verify' }
    }

    if (options.allowEnrollment === false) {
      return { mode: 'unavailable' }
    }

    if (factors.some((candidate) => candidate.status === 'unverified')) {
      return { mode: 'unavailable' }
    }

    const enrollment = await client.enroll()

    return enrollment
      ? { factorId: enrollment.factorId, mode: 'enroll', qrCode: enrollment.qrCode }
      : { mode: 'unavailable' }
  } catch {
    return { mode: 'unavailable' }
  }
}

export async function completeTotpChallenge(
  input: { factorId: string; verificationCode: string },
  client: TotpClient,
  establish: () => Promise<boolean>,
): Promise<{ status: 'invalid' | 'ready' }> {
  if (!/^\d{6}$/.test(input.verificationCode)) {
    return { status: 'invalid' }
  }

  try {
    const result = await client.challengeAndVerify({
      code: input.verificationCode,
      factorId: input.factorId,
    })

    if (!result.ok || !(await establish())) {
      return { status: 'invalid' }
    }

    return { status: 'ready' }
  } catch {
    return { status: 'invalid' }
  }
}

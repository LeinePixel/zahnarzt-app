import { z } from 'zod'

const claimsSchema = z.object({
  sub: z.string().min(1),
  aal: z.enum(['aal1', 'aal2']),
  session_id: z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ),
})

type InitializeSession = () => Promise<{ data: unknown; error: unknown }>
type RedirectTo = (path: string) => never

export async function runRequireAal2Session(
  claims: unknown,
  initializeSession: InitializeSession,
  redirectTo: RedirectTo,
): Promise<string> {
  const parsed = claimsSchema.safeParse(claims)

  if (!parsed.success) {
    redirectTo('/login')
  }

  if (parsed.data.aal !== 'aal2') {
    redirectTo('/auth/mfa')
  }

  const { data, error } = await initializeSession()

  if (error || data !== true) {
    redirectTo('/login')
  }

  return parsed.data.sub
}

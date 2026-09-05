import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

export type UserRole = 'rezeption' | 'behandler' | 'praxisadmin'

export type UserProfileRow = {
  display_name: string
  practice_id: string
  practice: { name: string }
  role: UserRole
}

export type CurrentUserContext =
  | { status: 'incomplete'; userId: string }
  | { status: 'portal_admin'; userId: string }
  | {
      status: 'ready'
      displayName: string
      practiceId: string
      practiceName: string
      role: UserRole
      roleLabel: string
      userId: string
    }

type ClaimsResult = {
  data: { claims: { sub?: string } } | null
  error: unknown
}

type ProfileResult = {
  data: UserProfileRow | null
  error: unknown
}

type GetClaims = () => Promise<ClaimsResult>
type GetProfile = (userId: string) => Promise<ProfileResult>
type GetPortalAdmin = () => Promise<{ data: unknown; error: unknown }>
type RedirectTo = (path: string) => never
type SignOut = () => Promise<{ error: unknown }>
type Revalidate = (path: string, type: 'layout') => void

const roleLabels: Record<UserRole, string> = {
  rezeption: 'Rezeption',
  behandler: 'Behandler',
  praxisadmin: 'Praxisadministration',
}

const profileSchema = z.object({
  display_name: z.string().trim().min(1),
  practice_id: z.string().trim().min(1),
  practice: z.object({ name: z.string().trim().min(1) }),
  role: z.enum(['rezeption', 'behandler', 'praxisadmin']),
})

export class CurrentUserContextError extends Error {
  override name = 'CurrentUserContextError'
}

export async function runGetCurrentUserContext(
  getClaims: GetClaims,
  getProfile: GetProfile,
  redirectTo: RedirectTo,
  getPortalAdmin: GetPortalAdmin = async () => ({ data: false, error: null }),
): Promise<CurrentUserContext> {
  const { data: claimsData, error: claimsError } = await getClaims()
  const subject = claimsData?.claims.sub

  if (
    claimsError ||
    typeof subject !== 'string' ||
    subject.length === 0
  ) {
    redirectTo('/login')
  }

  const { data: profileData, error: profileError } = await getProfile(subject)

  if (profileError) {
    throw new CurrentUserContextError(
      'Kontokontext konnte nicht geladen werden.',
    )
  }

  if (!profileData) {
    const { data: isPortalAdmin, error: portalAdminError } =
      await getPortalAdmin()

    if (portalAdminError) {
      throw new CurrentUserContextError(
        'Kontokontext konnte nicht geladen werden.',
      )
    }

    if (isPortalAdmin === true) {
      return { status: 'portal_admin', userId: subject }
    }

    return { status: 'incomplete', userId: subject }
  }

  const parsedProfile = profileSchema.safeParse(profileData)

  if (!parsedProfile.success) {
    throw new CurrentUserContextError(
      'Kontokontext konnte nicht geladen werden.',
    )
  }

  return {
      status: 'ready',
      displayName: parsedProfile.data.display_name,
      practiceId: parsedProfile.data.practice_id,
      practiceName: parsedProfile.data.practice.name,
      role: parsedProfile.data.role,
      roleLabel: roleLabels[parsedProfile.data.role],
      userId: subject,
  }
}

export async function getCurrentUserContext(): Promise<CurrentUserContext> {
  const supabase = await createClient()

  return runGetCurrentUserContext(
    () => supabase.auth.getClaims(),
    async (userId) => {
      const result = await supabase
        .from('user_profile')
        .select('display_name, practice_id, role, practice:practice_id(name)')
        .eq('user_id', userId)
        .maybeSingle()

      return result as unknown as ProfileResult
    },
    redirect,
    async () => {
      const result = await supabase.rpc('is_portal_admin')

      return result as unknown as { data: unknown; error: unknown }
    },
  )
}

export async function runLogout(
  signOut: SignOut,
  revalidate: Revalidate,
  redirectTo: RedirectTo,
): Promise<never> {
  const { error } = await signOut()

  if (error) {
    throw new CurrentUserContextError(
      'Abmeldung konnte nicht abgeschlossen werden.',
    )
  }

  revalidate('/', 'layout')
  redirectTo('/login')
}

export async function logout(): Promise<never> {
  'use server'

  const supabase = await createClient()

  return runLogout(() => supabase.auth.signOut(), revalidatePath, redirect)
}

import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { pathToFileURL } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { getSeedEnv } from './seed-env'
import { E2E_FOREIGN_PRACTICE_ID } from './seed-fixtures'

export type UserRole = 'rezeption' | 'behandler' | 'praxisadmin'
export type SeedAccountRole = UserRole | 'portaladmin'

export type SeedAccountInput = {
  email: string
  password: string
}

export type SeedUser = {
  email: string
  id: string
}

export type SeedProfileInput = {
  displayName: string
  practiceId: string
  role: UserRole
  userId: string
}

export interface SeedAdminClient {
  createPractice(
    name: string,
    id?: string,
  ): Promise<{ id: string; name: string }>
  createUser(input: SeedAccountInput): Promise<SeedUser>
  findPracticeByName(
    name: string,
  ): Promise<{ id: string; name: string } | null>
  listUsers(): Promise<SeedUser[]>
  updateUser(id: string, input: SeedAccountInput): Promise<SeedUser>
  upsertPortalAdmin(userId: string): Promise<void>
  upsertProfile(input: SeedProfileInput): Promise<void>
}

type SeedOptions = {
  passwords: Record<SeedAccountRole, string>
}

type SeedLogger = (line: string) => void

type AccountStatus = 'erstellt' | 'aktualisiert'

type SeedResult = {
  accounts: Array<{ email: string; status: AccountStatus }>
  foreignPractice: { id: string; status: 'erstellt' | 'vorhanden' }
  practice: { id: string; status: 'erstellt' | 'vorhanden' }
}

const PRACTICE_NAME = 'DentPilot Testpraxis'
const FOREIGN_PRACTICE_NAME = 'DentPilot E2E-Fremdpraxis'

type PracticeSeedAccountDefinition = {
  displayName: string
  email: string
  role: UserRole
}

type PortalAdminSeedAccountDefinition = {
  displayName: string
  email: string
  role: 'portaladmin'
}

type SeedAccountDefinition =
  | PracticeSeedAccountDefinition
  | PortalAdminSeedAccountDefinition

const accountDefinitions: ReadonlyArray<SeedAccountDefinition> = [
  {
    displayName: 'Test Rezeption',
    email: 'seed-rezeption@dentpilot.example',
    role: 'rezeption',
  },
  {
    displayName: 'Dr. Test Behandler',
    email: 'seed-behandler@dentpilot.example',
    role: 'behandler',
  },
  {
    displayName: 'Test Praxisadministration',
    email: 'seed-praxisadmin@dentpilot.example',
    role: 'praxisadmin',
  },
  {
    displayName: 'Test Anbieter-Support',
    email: 'seed-portaladmin@dentpilot.example',
    role: 'portaladmin',
  },
]

export async function runSeed(
  client: SeedAdminClient,
  options: SeedOptions,
  logger: SeedLogger = () => undefined,
): Promise<SeedResult> {
  const existingPractice = await client.findPracticeByName(PRACTICE_NAME)
  const practice =
    existingPractice ?? (await client.createPractice(PRACTICE_NAME))
  const practiceStatus = existingPractice ? 'vorhanden' : 'erstellt'
  const existingForeignPractice = await client.findPracticeByName(
    FOREIGN_PRACTICE_NAME,
  )

  if (
    existingForeignPractice &&
    existingForeignPractice.id !== E2E_FOREIGN_PRACTICE_ID
  ) {
    throw seedOperationError('E2E-Fremdpraxis hat eine unerwartete Kennung')
  }

  const foreignPractice =
    existingForeignPractice ??
    (await client.createPractice(
      FOREIGN_PRACTICE_NAME,
      E2E_FOREIGN_PRACTICE_ID,
    ))
  const foreignPracticeStatus = existingForeignPractice
    ? 'vorhanden'
    : 'erstellt'
  const existingUsers = new Map(
    (await client.listUsers()).map((user) => [user.email, user]),
  )
  const accounts: SeedResult['accounts'] = []

  for (const definition of accountDefinitions) {
    const input = {
      email: definition.email,
      password: options.passwords[definition.role],
    }
    const existingUser = existingUsers.get(definition.email)
    const status: AccountStatus = existingUser ? 'aktualisiert' : 'erstellt'
    const user = existingUser
      ? await client.updateUser(existingUser.id, input)
      : await client.createUser(input)

    if (definition.role === 'portaladmin') {
      await client.upsertPortalAdmin(user.id)
    } else {
      await client.upsertProfile({
        displayName: definition.displayName,
        practiceId: practice.id,
        role: definition.role,
        userId: user.id,
      })
    }

    accounts.push({ email: definition.email, status })
    logger(`${definition.email}: ${status}`)
  }

  return {
    accounts,
    foreignPractice: {
      id: foreignPractice.id,
      status: foreignPracticeStatus,
    },
    practice: { id: practice.id, status: practiceStatus },
  }
}

type SeedDatabase = {
  public: {
    Functions: { [_ in never]: never }
    Tables: {
      practice: {
        Insert: { created_at?: string; id?: string; name: string }
        Relationships: []
        Row: { created_at: string; id: string; name: string }
        Update: { created_at?: string; id?: string; name?: string }
      }
      portal_admin: {
        Insert: { created_at?: string; user_id: string }
        Relationships: []
        Row: { created_at: string; user_id: string }
        Update: { created_at?: string; user_id?: string }
      }
      user_profile: {
        Insert: {
          created_at?: string
          display_name: string
          practice_id: string
          role: UserRole
          user_id: string
        }
        Relationships: []
        Row: {
          created_at: string
          display_name: string
          practice_id: string
          role: UserRole
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          practice_id?: string
          role?: UserRole
          user_id?: string
        }
      }
    }
    Views: { [_ in never]: never }
  }
}

function seedOperationError(operation: string) {
  return new Error(`Seed fehlgeschlagen: ${operation}`)
}

export class SupabaseSeedAdminClient implements SeedAdminClient {
  constructor(private readonly client: SupabaseClient<SeedDatabase>) {}

  async findPracticeByName(name: string) {
    const { data, error } = await this.client
      .from('practice')
      .select('id, name')
      .eq('name', name)
      .limit(1)
      .maybeSingle()

    if (error) {
      throw seedOperationError('Testpraxis konnte nicht gelesen werden')
    }

    return data
  }

  async createPractice(name: string, id?: string) {
    const { data, error } = await this.client
      .from('practice')
      .insert(id ? { id, name } : { name })
      .select('id, name')
      .single()

    if (error || !data) {
      throw seedOperationError('Testpraxis konnte nicht angelegt werden')
    }

    return data
  }

  async listUsers() {
    const users: SeedUser[] = []
    const perPage = 1000
    let page = 1

    while (true) {
      const { data, error } = await this.client.auth.admin.listUsers({
        page,
        perPage,
      })

      if (error) {
        throw seedOperationError('Testkonten konnten nicht gelesen werden')
      }

      users.push(
        ...data.users.flatMap((user) =>
          user.email ? [{ email: user.email, id: user.id }] : [],
        ),
      )

      if (data.users.length < perPage) {
        return users
      }

      page += 1
    }
  }

  async createUser(input: SeedAccountInput) {
    const { data, error } = await this.client.auth.admin.createUser({
      email: input.email,
      email_confirm: true,
      password: input.password,
    })

    if (error || !data.user.email) {
      throw seedOperationError('Testkonto konnte nicht angelegt werden')
    }

    return { email: data.user.email, id: data.user.id }
  }

  async updateUser(id: string, input: SeedAccountInput) {
    const { data, error } = await this.client.auth.admin.updateUserById(id, {
      email: input.email,
      email_confirm: true,
      password: input.password,
    })

    if (error || !data.user.email) {
      throw seedOperationError('Testkonto konnte nicht aktualisiert werden')
    }

    return { email: data.user.email, id: data.user.id }
  }

  async upsertPortalAdmin(userId: string) {
    const { error } = await this.client.from('portal_admin').upsert(
      { user_id: userId },
      { onConflict: 'user_id' },
    )

    if (error) {
      throw seedOperationError('Anbieter-Supportkonto konnte nicht gespeichert werden')
    }
  }

  async upsertProfile(input: SeedProfileInput) {
    const { error } = await this.client.from('user_profile').upsert(
      {
        display_name: input.displayName,
        practice_id: input.practiceId,
        role: input.role,
        user_id: input.userId,
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      throw seedOperationError('Testprofil konnte nicht gespeichert werden')
    }
  }
}

async function main() {
  if (existsSync('.env.local')) {
    loadEnvFile('.env.local')
  }

  if (existsSync('.env.seed.local')) {
    loadEnvFile('.env.seed.local')
  }

  const env = getSeedEnv()
  const client = createClient<SeedDatabase>(
    env.supabaseUrl,
    env.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  )

  await runSeed(
    new SupabaseSeedAdminClient(client),
    { passwords: env.seedPasswords },
    console.log,
  )
}

const entryPoint = process.argv[1]

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Seed fehlgeschlagen'
    console.error(message)
    process.exitCode = 1
  })
}

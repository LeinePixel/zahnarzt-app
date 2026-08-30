import { randomBytes } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  runSeed,
  type SeedAccountInput,
  type SeedAdminClient,
  type SeedProfileInput,
  type SeedUser,
} from './seed'
import { E2E_FOREIGN_PRACTICE_ID } from './seed-fixtures'

type StoredUser = SeedUser & { password: string }

class MemorySeedAdminClient implements SeedAdminClient {
  practices: Array<{ id: string; name: string }> = []
  profiles = new Map<string, SeedProfileInput>()
  portalAdmins = new Set<string>()
  users = new Map<string, StoredUser>()

  async findPracticeByName(name: string) {
    return this.practices.find((practice) => practice.name === name) ?? null
  }

  async createPractice(name: string, id?: string) {
    const practice = {
      id: id ?? `practice-${this.practices.length + 1}`,
      name,
    }
    this.practices.push(practice)
    return practice
  }

  async listUsers() {
    return [...this.users.values()].map(({ email, id }) => ({ email, id }))
  }

  async createUser(input: SeedAccountInput) {
    const user = {
      email: input.email,
      id: `user-${this.users.size + 1}`,
      password: input.password,
    }
    this.users.set(input.email, user)
    return { email: user.email, id: user.id }
  }

  async updateUser(id: string, input: SeedAccountInput) {
    const existing = [...this.users.values()].find((user) => user.id === id)

    if (!existing) {
      throw new Error('Test user not found')
    }

    this.users.delete(existing.email)
    const user = { email: input.email, id, password: input.password }
    this.users.set(input.email, user)
    return { email: user.email, id: user.id }
  }

  async upsertProfile(input: SeedProfileInput) {
    this.profiles.set(input.userId, input)
  }

  async upsertPortalAdmin(userId: string) {
    this.portalAdmins.add(userId)
  }
}

function makePasswords() {
  const randomPart = randomBytes(16).toString('hex')

  return {
    behandler: `B-${randomPart}-a1!`,
    portaladmin: `O-${randomPart}-a1!`,
    praxisadmin: `P-${randomPart}-a1!`,
    rezeption: `R-${randomPart}-a1!`,
  }
}

describe('runSeed', () => {
  it('reuses the same synthetic practices on subsequent runs', async () => {
    const client = new MemorySeedAdminClient()
    const passwords = makePasswords()

    const first = await runSeed(client, { passwords })
    const second = await runSeed(client, { passwords })

    expect(client.practices).toEqual([
      { id: 'practice-1', name: 'DentPilot Testpraxis' },
      {
        id: E2E_FOREIGN_PRACTICE_ID,
        name: 'DentPilot E2E-Fremdpraxis',
      },
    ])
    expect(first.practice.id).toBe('practice-1')
    expect(second.practice).toEqual({ id: 'practice-1', status: 'vorhanden' })
    expect(first.foreignPractice).toEqual({
      id: E2E_FOREIGN_PRACTICE_ID,
      status: 'erstellt',
    })
    expect(second.foreignPractice).toEqual({
      id: E2E_FOREIGN_PRACTICE_ID,
      status: 'vorhanden',
    })
  })

  it('updates an existing auth user instead of creating a duplicate', async () => {
    const client = new MemorySeedAdminClient()
    const passwords = makePasswords()
    client.users.set('seed-rezeption@dentpilot.example', {
      email: 'seed-rezeption@dentpilot.example',
      id: 'existing-user',
      password: 'old-test-value',
    })

    const result = await runSeed(client, { passwords })

    expect(client.users.size).toBe(4)
    expect(client.users.get('seed-rezeption@dentpilot.example')).toEqual({
      email: 'seed-rezeption@dentpilot.example',
      id: 'existing-user',
      password: passwords.rezeption,
    })
    expect(result.accounts[0]).toEqual({
      email: 'seed-rezeption@dentpilot.example',
      status: 'aktualisiert',
    })
  })

  it('upserts profiles by auth user id with the approved role mapping', async () => {
    const client = new MemorySeedAdminClient()
    const passwords = makePasswords()
    client.users.set('seed-behandler@dentpilot.example', {
      email: 'seed-behandler@dentpilot.example',
      id: 'existing-user',
      password: 'old-test-value',
    })
    client.profiles.set('existing-user', {
      displayName: 'Veralteter Name',
      practiceId: 'old-practice',
      role: 'rezeption',
      userId: 'existing-user',
    })

    await runSeed(client, { passwords })

    expect(client.profiles.get('existing-user')).toEqual({
      displayName: 'Dr. Test Behandler',
      practiceId: 'practice-1',
      role: 'behandler',
      userId: 'existing-user',
    })
  })

  it('keeps practice, user and profile counts stable on a second run', async () => {
    const client = new MemorySeedAdminClient()
    const passwords = makePasswords()

    await runSeed(client, { passwords })
    await runSeed(client, { passwords })

    expect(client.practices).toHaveLength(2)
    expect(client.users.size).toBe(4)
    expect(client.profiles.size).toBe(3)
    expect(client.portalAdmins.size).toBe(1)
  })

  it('logs only synthetic email addresses and status values', async () => {
    const client = new MemorySeedAdminClient()
    const passwords = makePasswords()
    const output: string[] = []

    await runSeed(client, { passwords }, (line) => output.push(line))

    expect(output).toEqual([
      'seed-rezeption@dentpilot.example: erstellt',
      'seed-behandler@dentpilot.example: erstellt',
      'seed-praxisadmin@dentpilot.example: erstellt',
      'seed-portaladmin@dentpilot.example: erstellt',
    ])
    expect(output.join('\n')).not.toContain(passwords.rezeption)
    expect(output.join('\n')).not.toContain(passwords.behandler)
    expect(output.join('\n')).not.toContain(passwords.praxisadmin)
    expect(output.join('\n')).not.toContain(passwords.portaladmin)
  })

  it('creates exactly one separate synthetic portal admin without a practice profile', async () => {
    const client = new MemorySeedAdminClient()

    await runSeed(client, { passwords: makePasswords() })

    const portalAdmin = client.users.get('seed-portaladmin@dentpilot.example')

    expect(portalAdmin).toBeDefined()
    expect(client.portalAdmins).toEqual(new Set([portalAdmin?.id]))
    expect(client.profiles.has(portalAdmin?.id ?? '')).toBe(false)
  })
})

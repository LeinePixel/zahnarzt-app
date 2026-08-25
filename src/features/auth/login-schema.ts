import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'E-Mail-Adresse ist erforderlich.')
    .max(254, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.')
    .pipe(z.email('Bitte geben Sie eine gültige E-Mail-Adresse ein.'))
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(1, 'Passwort ist erforderlich.')
    .max(1024, 'Das Passwort ist zu lang.'),
})

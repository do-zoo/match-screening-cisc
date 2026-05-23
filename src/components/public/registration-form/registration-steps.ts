export type RegistrationStepId = 'category' | 'holders' | 'payment'

export const REGISTRATION_STEP_ORDER = [
  'category',
  'holders',
  'payment',
] as const satisfies readonly RegistrationStepId[]

export function registrationStepTitle(id: RegistrationStepId): string {
  switch (id) {
    case 'category':
      return 'Pilih Tiket'
    case 'holders':
      return 'Data Peserta'
    case 'payment':
      return 'Pembayaran'
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

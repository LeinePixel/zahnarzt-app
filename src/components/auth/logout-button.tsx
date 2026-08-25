import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'

type LogoutButtonProps = {
  action: () => Promise<never>
}

export function LogoutButton({ action }: LogoutButtonProps) {
  return (
    <form action={action}>
      <Button type="submit" variant="outline" className="h-11 rounded-[10px]">
        <LogOut aria-hidden="true" />
        Sicher abmelden
      </Button>
    </form>
  )
}

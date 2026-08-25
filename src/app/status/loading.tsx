import { Skeleton } from '@/components/ui/skeleton'

export default function StatusLoading() {
  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto w-full max-w-5xl" aria-label="Kontostatus wird geladen">
        <div className="flex items-center justify-between">
          <Skeleton className="h-14 w-48 rounded-xl" />
          <Skeleton className="h-11 w-36 rounded-[10px]" />
        </div>
        <div className="mx-auto mt-28 max-w-3xl rounded-2xl border border-border bg-card p-8">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-5 h-10 w-3/4" />
          <Skeleton className="mt-4 h-5 w-2/3" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  )
}

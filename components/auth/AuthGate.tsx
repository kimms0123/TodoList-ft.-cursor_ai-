"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/client"

const PUBLIC_ONLY_ROUTES = new Set(["/login", "/signup"])

const isPublicOnlyRoute = (pathname: string) => {
  return PUBLIC_ONLY_ROUTES.has(pathname)
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  React.useEffect(() => {
    const supabase = createClient()
    let unsubscribed = false

    const applyRedirect = (session: Session | null) => {
      if (unsubscribed) return

      const isAuthed = Boolean(session?.user)
      if (!isAuthed && !isPublicOnlyRoute(pathname)) {
        router.replace("/login")
        return
      }

      if (isAuthed && isPublicOnlyRoute(pathname)) {
        router.replace("/")
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      applyRedirect(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applyRedirect(session)
    })

    return () => {
      unsubscribed = true
      listener.subscription.unsubscribe()
    }
  }, [pathname, router])

  return <>{children}</>
}

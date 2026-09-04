"use client"

import { useRouter } from "next/navigation"
import * as React from "react"

/* `/insert` without an id is not a screen state, it is a typo. This used to
   be a server `redirect()`, which the desktop bundle cannot keep: a static
   export has no request to answer, and next renders the redirect as an error
   page instead of a redirect. Sending the browser home is the same outcome in
   both builds, one frame later. */
export default function InsertIndexPage() {
  const router = useRouter()
  React.useEffect(() => {
    router.replace("/")
  }, [router])
  return null
}

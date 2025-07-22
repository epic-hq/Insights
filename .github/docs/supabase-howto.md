# Supabase How To

## Schema

create in supabase/schemas

`supabase db diff -f description` to generate a migration. This will create a new migration file in the `supabase/migrations` directory. We should then run `supabase db push` to apply the migration to the database. or `supabase db reset` to reset the database to the state of the migration files. It will drop the database and recreate it from the migration files and run seed.sql.

`supabase db push --linked` to apply the migration to the database in the cloud.

## Functions

Run deno locally. `supabase functions serve --env-file .env`
But note we can't run pgmq in local setup as it's not included in the supabase docker image that runs locally. Future we could build custom docker with it. Opting to run it in the cloud for now.

## Storage

## Auth with JWT-Signing in Remix/ReactRouter7

The key shift is from using Supabase's auth system to using JWT signing keys.

This is an upgraded, more secure way to authenticate users in the app server and client side with asymmetric JWT signing keys. Essentially, embedding authNZ in the token claims with a private key that is only known to the app server and client side. And good for a limted time and needs to be refreshed. This reduces time to authorize actions from hundreds to a few ms, even in a distributed environment.

This uses cookies to store the JWT token and syncs the session with the cookie and backend. [docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=remix&queryGroups=environment&environment=remix-loader#set-environment-variables)

### Server - use in loaders and actions (SSR)

Use createServerClient in your loaders and actions to let your Remix app interact with Supabase on the server-side (e.g., protected routes, server-side rendering, API calls)

```ts
// app/lib/supabase.server.ts
import { createServerClient } from '@supabase/ssr'

export const supabase = createServerClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)
```

To Protect Routes (from server side first and in client)

```ts
// routes/_protected.tsx
export async function loader({ request }: LoaderArgs) {
  const user = await getUserFromRequest(request)
  if (!user) throw redirect("/login")
  return json({ user })
}

export default function ProtectedLayout() {
  const { user } = useLoaderData<typeof loader>()
  return <Outlet />
}
```

### Client in Browser

Use createBrowserClient only in the browser, to let your Remix app interact with Supabase on the client-side (e.g., login, sign-up, auth state tracking, real-time updates

```ts
// app/lib/supabase.client.ts
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)
```

```ts
// app/components/LoginForm.tsx
import { supabase } from '~/lib/supabase.client'

function LoginForm() {
  async function handleLogin(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) alert("Login failed")
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleLogin("rocko@email.com") }}>
      <button type="submit">Login</button>
    </form>
  )
}
```

Track Auth State

```tsx
useEffect(() => {
  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    // sync session with cookie/backend
  })
  return () => listener.subscription.unsubscribe()
}, [])
```

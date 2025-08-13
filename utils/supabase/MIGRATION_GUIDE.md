# Supabase SSR Migration Guide

## Overview

This guide helps you migrate from `@supabase/auth-helpers-nextjs` to the new `@supabase/ssr` implementation in Next.js 15.

## Quick Migration Reference

### Client Components

**Before:**
```javascript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function MyComponent() {
  const supabase = createClientComponentClient();
  // ...
}
```

**After:**
```javascript
'use client';
import { createClient } from '@/utils/supabase/client';

export default function MyComponent() {
  const supabase = createClient();
  // ...
}
```

### Server Components

**Before:**
```javascript
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export default async function Page() {
  const supabase = createServerComponentClient({ cookies });
  // ...
}
```

**After:**
```javascript
import { createClient } from '@/utils/supabase/server';

export default async function Page() {
  const supabase = createClient();
  // No need to pass cookies - handled internally
  // ...
}
```

### API Routes / Route Handlers

**Before:**
```javascript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  // ...
}
```

**After:**
```javascript
import { createClient } from '@/utils/supabase/api';

export async function GET(request) {
  const { supabase, response } = createClient(request);
  // Use the response object for setting cookies if needed
  // ...
}
```

### Middleware

**Before:**
```javascript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession();
  return res;
}
```

**After:**
```javascript
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request) {
  return await updateSession(request);
}
```

## Feature Comparison

| Feature | Old (`auth-helpers`) | New (`ssr`) |
|---------|---------------------|--------------|
| Cookie Management | Manual | Automatic |
| Session Refresh | Manual | Automatic |
| TypeScript Support | Full | Full |
| Server/Client Separation | Yes | Yes |
| Service Role Support | Separate | Integrated |
| Performance | Good | Better |

## Common Migration Patterns

### 1. Authentication Check

**Before:**
```javascript
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  // Not authenticated
}
```

**After:**
```javascript
import { getCurrentUser } from '@/utils/supabase/server';

const user = await getCurrentUser();
if (!user) {
  // Not authenticated
}
```

### 2. Protected API Routes

**Before:**
```javascript
export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ...
}
```

**After:**
```javascript
import { requireAuth } from '@/utils/supabase/api';

export async function POST(request) {
  const { user, supabase } = await requireAuth(request);
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ...
}
```

### 3. Admin Operations

**Before:**
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

**After:**
```javascript
import { createAdminClient } from '@/utils/supabase/server';

const supabase = createAdminClient();
// Automatically uses service role key
```

## Files to Update

Based on the codebase scan, these files need migration:

1. **Client Components** (9 files using `createClientComponentClient`):
   - Various dashboard and admin pages
   - Update import to use `@/utils/supabase/client`

2. **Server Components**:
   - Update to use `@/utils/supabase/server`
   - Remove `cookies()` parameter

3. **API Routes**:
   - Update to use `@/utils/supabase/api`
   - Handle the returned `response` object

4. **Existing Utilities**:
   - `/lib/supabase.js` - Can remain for backward compatibility
   - `/utils/supabase.js` - Already updated
   - `/utils/supabase-client.js` - Can be deprecated
   - `/utils/supabase-server.js` - Can be deprecated

## Environment Variables

No changes needed. Continue using:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Testing the Migration

1. **Test Authentication Flow**:
   ```javascript
   // Test in a client component
   const user = await getCurrentUser();
   console.log('Authenticated:', !!user);
   ```

2. **Test Data Fetching**:
   ```javascript
   // Test in a server component
   const supabase = createClient();
   const { data } = await supabase.from('table').select();
   ```

3. **Test Protected Routes**:
   - Access protected routes when logged in/out
   - Verify middleware redirects work

## Rollback Plan

If issues arise, you can:
1. Keep both implementations side-by-side
2. Use feature flags to switch between old/new
3. Migrate incrementally, one file at a time

## Performance Benefits

The new SSR implementation provides:
- Faster initial page loads
- Better SEO with server-side auth
- Reduced client-side JavaScript
- Automatic session management
- Built-in CSRF protection

## Support

For issues or questions:
1. Check the [Supabase SSR docs](https://supabase.com/docs/guides/auth/server-side/nextjs)
2. Review the utility files in `/utils/supabase/`
3. Test in development before deploying
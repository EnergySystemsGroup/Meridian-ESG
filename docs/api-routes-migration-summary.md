# API Routes Migration to @supabase/ssr

## Migration Summary
Date: 2025-08-13

Successfully migrated all 23 API routes from old Supabase patterns to the new @supabase/ssr utilities.

## Changes Made

### 1. New SSR Utilities Created
- `/utils/supabase/server.js` - Server Components utility
- `/utils/supabase/client.js` - Client Components utility  
- `/utils/supabase/api.js` - API Routes utility
- `/utils/supabase/middleware.js` - Middleware utility

### 2. Service Layer Extraction
- Created `/lib/services/fundingApi.js` to separate business logic from Supabase client creation
- Moved all funding-related API methods to the service layer
- Service methods now accept Supabase client as a parameter for flexibility

### 3. API Routes Updated (23 total)

#### Standard Routes (Using anon key)
- `/api/funding/route.js`
- `/api/categories/route.js`
- `/api/counts/route.js`
- `/api/deadlines/route.js`
- `/api/funding/sources/route.js`
- `/api/funding/sources/[id]/route.js`
- `/api/funding/sources/[id]/process/route.js`
- `/api/funding/sources/[id]/manager/route.js`
- `/api/funding/sources/process-next/route.js`
- `/api/funding/process-next-source/route.js`
- `/api/funding/raw-responses/[id]/route.js`
- `/api/funding/raw-responses/latest/route.js`
- `/api/funding/verify/grants-gov/route.js`
- `/api/map/funding-by-state/route.js`
- `/api/map/opportunities/[stateCode]/route.js`
- `/api/debug/funding-values/route.js`

#### Admin Routes (Using service role)
- `/api/admin/system-config/[key]/route.js`
- `/api/admin/debug/[component]/route.js`
- `/api/funding/category-summary/route.js`

## Migration Pattern

### Before (Old Pattern)
```javascript
import { supabase } from '@/lib/supabase';
// or
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createSupabaseClient();
  // ... use supabase
}
```

### After (New SSR Pattern)
```javascript
import { createClient } from '@/utils/supabase/api';

export async function GET(request) {
  const { supabase } = createClient(request);
  // ... use supabase
}
```

### For Admin Routes
```javascript
import { createAdminClient } from '@/utils/supabase/api';

export async function GET(request) {
  const { supabase } = createAdminClient(request);
  // ... use supabase with service role
}
```

## Key Benefits

1. **Proper SSR Support**: Uses @supabase/ssr for correct cookie handling in Next.js 15
2. **Request Context**: All routes now properly handle request context for authentication
3. **Type Safety**: Better TypeScript support with the new utilities
4. **Consistency**: Unified pattern across all API routes
5. **Security**: Clear distinction between anon and service role clients
6. **Maintainability**: Business logic separated from client creation

## Testing Recommendations

1. Test authentication flows in API routes
2. Verify cookie-based sessions work correctly
3. Test admin routes with proper authorization
4. Verify data fetching and mutations work as expected
5. Check error handling for unauthorized requests

## Next Steps

1. Update any remaining server components to use `/utils/supabase/server.js`
2. Update client components to use `/utils/supabase/client.js`
3. Consider implementing role-based access control using the `requireRole` helper
4. Add comprehensive error handling for authentication failures
5. Update environment variables documentation if needed

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Scripts Created

- `/scripts/migrate-api-routes.js` - Analysis tool for finding routes needing migration
- `/scripts/batch-migrate-routes.js` - Automated migration for simple patterns

Both scripts can be safely removed after migration is complete.
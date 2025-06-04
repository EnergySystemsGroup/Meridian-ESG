# Handling Async APIs in Next.js 15

## Overview

In Next.js 15, several APIs that were previously synchronous have been made asynchronous. This includes:

- `params` and `searchParams` in route handlers, pages, layouts, and metadata APIs
- `cookies()`, `draftMode()`, and `headers()` from `next/headers`

This document provides guidance on how to properly handle these async APIs in our codebase.

## Common Error

If you encounter the following error:

```
Error: Route "/api/funding/sources/[id]/process" used params.id. params should be awaited before using its properties
```

This indicates that you're trying to access properties of an async API directly without awaiting it.

## How to Fix Route Handlers

### Before (Next.js 14 and earlier)

```javascript
// app/api/funding/sources/[id]/route.js
export async function GET(request, { params }) {
	const { id } = params;
	// Use id to fetch data
}
```

### After (Next.js 15)

```javascript
// app/api/funding/sources/[id]/route.js
export async function GET(request, context) {
	const id = context.params.id;
	// Use id to fetch data
}
```

## Handling Search Parameters

### Before (Next.js 14 and earlier)

```javascript
// app/api/funding/route.js
export async function GET(request) {
	const { searchParams } = new URL(request.url);
	const query = searchParams.get('query');
	// Use query parameter
}
```

### After (Next.js 15)

```javascript
// app/api/funding/route.js
export async function GET(request) {
	const query = request.nextUrl.searchParams.get('query');
	// Use query parameter
}
```

## Using the Next.js Codemod

Next.js provides a codemod to automatically fix many of these issues:

```bash
npx @next/codemod@canary next-async-request-api .
```

This will scan your codebase and update the code to use the async APIs correctly.

## Best Practices

1. Always use `context.params` instead of destructuring `{ params }` in route handlers
2. Use `request.nextUrl.searchParams` instead of creating a new URL object
3. When working with cookies or headers, make sure to await them:
   ```javascript
   const cookies = await cookies();
   const headers = await headers();
   ```

## Additional Resources

- [Next.js 15 Release Notes](https://nextjs.org/blog/next-15)
- [Next.js Route Handlers Documentation](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

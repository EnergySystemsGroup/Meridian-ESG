This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase Setup

This project uses [Supabase](https://supabase.com/) for backend services including authentication, database, and storage.

### Local Development

1. Install the Supabase CLI:

   ```bash
   npm install -g supabase
   ```

2. Start a local Supabase instance:

   ```bash
   supabase start
   ```

3. The CLI will output your local Supabase URL and anon key. Update your `.env.local` file with these values:

   ```
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Create tables and set up your database schema using the Supabase Studio at http://localhost:54323

### Staging and Production

1. Create a new project on [Supabase](https://supabase.com/)
2. Get your project URL and anon key from the project settings
3. Set up environment variables in your deployment platform (e.g., Vercel):

   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. For database migrations, use:
   ```bash
   supabase db diff -f migration_name
   ```

## Environment Separation

This project follows best practices for environment separation:

- Local: Uses local Supabase instance with Docker
- Staging: Connects to a dedicated Supabase project for testing
- Production: Uses a separate Supabase project for production data

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

To learn more about Supabase:

- [Supabase Documentation](https://supabase.com/docs) - learn about Supabase features and API.
- [Supabase CLI](https://supabase.com/docs/reference/cli) - learn about the Supabase CLI.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

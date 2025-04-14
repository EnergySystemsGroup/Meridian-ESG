# Meridian - Policy & Funding Intelligence Platform

Meridian is a comprehensive platform designed to help organizations track funding opportunities, monitor legislation, and match clients to relevant funding sources. The application provides a centralized dashboard for policy and funding intelligence, making it easier to stay on top of deadlines and opportunities.

## Features

- **Funding Opportunity Tracking**: Browse, filter, and search for funding opportunities from various sources.
- **Timeline View**: Visualize upcoming deadlines and events in a chronological timeline.
- **Legislative Monitoring**: Track bills and policies that may impact funding opportunities.
- **Client Matching**: Match clients to relevant funding opportunities based on their profiles.
- **Dashboard**: Get a quick overview of open opportunities, upcoming deadlines, and recent activities.

## Tech Stack

- **Frontend**: Next.js, React, TailwindCSS, Shadcn UI components
- **Backend**: Supabase (PostgreSQL database, authentication, and APIs)
- **Deployment**: Vercel (or your preferred hosting platform)

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/meridian.git
   cd meridian
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory with the following variables:

   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Database Setup

1. Create a new project in Supabase.
2. Use the SQL schema defined in `app/models/funding-schema.js` to set up your database tables.
3. (Optional) Seed your database with sample data for testing.

## Project Structure

- `app/` - Next.js application code
  - `api/` - API routes for data fetching
  - `components/` - Reusable UI components
  - `funding/` - Funding opportunities pages
  - `legislation/` - Legislation tracking pages
  - `clients/` - Client management pages
  - `timeline/` - Timeline view
  - `lib/` - Utility functions and Supabase client
  - `models/` - Database schema definitions

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.io/)
- [TailwindCSS](https://tailwindcss.com/)
- [Shadcn UI](https://ui.shadcn.com/)

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

---
description: dev environment setup rules
globs: 
---
# Development Environment Configuration

## Project Structure
I use a Next.js + Supabase stack with multiple environments:
- Local development using Supabase CLI with Docker
- Staging environment on Vercel with dedicated Supabase project
- Production environment on Vercel with separate Supabase project

## Local Setup
- Local Supabase instance running via Docker (`supabase start`)
- Next.js app connecting to local Supabase endpoints
- Environment variables in .env.local

## Database Migrations
- Migrations created with `supabase db diff`
- Migrations stored in version control under supabase/migrations
- Migrations applied to remote environments via GitHub Actions

## Deployment Pipeline
- GitHub push to staging/main branch triggers workflow
- GitHub Actions runs migrations against appropriate Supabase project
- Vercel deploys the application after successful migration

## API Structure
- Minimize custom API endpoints by leveraging Supabase auto-generated APIs
- Use Next.js API routes only for complex business logic and third-party integrations
- Implement permissions via Row Level Security (RLS) in Supabase

## Edge Functions
- Use Supabase Edge Functions for database-intensive operations
- Deploy Edge Functions for webhook handlers and background tasks
- Include Edge Function deployment in CI/CD pipeline
- Maintain environment separation (local/staging/production) for functions

## Realtime Subscriptions
- Implement Supabase Realtime for reactive data updates
- Set up proper subscription management in components
- Enable Realtime selectively for tables that need live updates
- Maintain consistency of Realtime configuration across environments

### AI Instructions
When suggesting code or configurations:
- Follow this architecture and ensure proper environment separation between local, staging, and production.
- Assume this project is using Next.js and Supabase.
- Do not suggest any configurations that violate the environment separation.

# Testing Instructions for Next.js + Supabase Application

## Prerequisites

1. Make sure Docker Desktop is running
2. Make sure Supabase local instance is running (`supabase start`)
3. Make sure Edge Functions server is running (`supabase functions serve` in a separate terminal)
4. Make sure Next.js development server is running (`npm run dev` in a separate terminal)

## Testing the Supabase Example Component

### 1. Create Test Data in Supabase Studio

1. Open Supabase Studio at http://127.0.0.1:54323/
2. Log in with email: `supabase@example.com` and password: `postgres`
3. Go to the "SQL Editor" in the left sidebar
4. Create a new query and paste the SQL from `studio_insert_data.sql`
5. Run the query to create test data

### 2. Test Authentication

1. Open your application at http://localhost:3000
2. In the Supabase Example component, use the Sign Up form to create a new user
   - Email: `test@example.com`
   - Password: `password123`
3. Check your email at Inbucket: http://127.0.0.1:54324
4. Click the confirmation link in the email
5. Sign in with the same credentials
6. You should now see the data from the `your_table_name` table

## Testing the Edge Function Example

### 1. Ensure Edge Functions Server is Running

Make sure you have the Edge Functions server running with:

```
supabase functions serve
```

### 2. Test the Edge Function

1. In the Edge Function Example component, enter a message in the input field
2. Click "Send Message"
3. You should see a response from the Edge Function below the form

## Troubleshooting

### If "No data found" appears:

- Check if the `your_table_name` table exists and has data
- Check if the user is authenticated
- Check if the Row Level Security policies are set up correctly

### If "Failed to fetch" appears for Edge Functions:

- Make sure the Edge Functions server is running
- Check the browser console for more detailed error messages
- Verify that the URL in `edge-functions.js` is correct (http://localhost:8000)

### Authentication Issues:

- Check Inbucket (http://127.0.0.1:54324) for confirmation emails
- Verify that the Supabase URL and anon key in `.env.local` are correct

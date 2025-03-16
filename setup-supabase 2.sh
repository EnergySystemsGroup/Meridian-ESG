#!/bin/bash

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null
then
    echo "Supabase CLI is not installed. Installing..."
    npm install -g supabase
fi

# Initialize Supabase project if not already initialized
if [ ! -d "supabase" ]; then
    echo "Initializing Supabase project..."
    supabase init
fi

# Check if Supabase is already running
SUPABASE_STATUS=$(supabase status 2>&1)
if [[ $SUPABASE_STATUS == *"not running"* ]]; then
    echo "Starting Supabase local development environment..."
    supabase start
else
    echo "Supabase is already running."
fi

# Wait for Supabase to be fully started
echo "Waiting for Supabase to be fully started..."
sleep 5

# Get the Supabase URL and anon key
SUPABASE_URL=$(supabase status | grep 'API URL' | awk '{print $3}')
SUPABASE_ANON_KEY=$(supabase status | grep 'anon key' | awk '{print $3}')

# Check if we got the URL and key
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "Error: Could not get Supabase URL or anon key. Retrying..."
    sleep 5
    SUPABASE_URL=$(supabase status | grep 'API URL' | awk '{print $3}')
    SUPABASE_ANON_KEY=$(supabase status | grep 'anon key' | awk '{print $3}')
    
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
        echo "Error: Still could not get Supabase URL or anon key. Please check if Supabase is running with 'supabase status'."
        exit 1
    fi
fi

# Update .env.local file with Supabase URL and anon key
echo "Updating .env.local file..."
cat > .env.local << EOF
# Supabase Environment Variables
# For local development with Supabase CLI
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# For production deployment
# NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF

# Reset the database with migrations and seed data
echo "Resetting the database with migrations and seed data..."
supabase db reset

echo "Supabase setup complete!"
echo "Supabase URL: $SUPABASE_URL"
echo "Supabase Anon Key: $SUPABASE_ANON_KEY"
echo "Supabase Studio: http://localhost:54323"
echo ""
echo "To start the Next.js development server, use:"
echo "npm run dev" 
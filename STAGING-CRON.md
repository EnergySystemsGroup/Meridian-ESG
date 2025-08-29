# Staging Job Queue Processing

Since Vercel cron jobs only run on production deployments, staging environments need manual job queue processing. This guide shows how to use the local DevCronWorker to process staging job queues.

## Quick Start

### 1. Basic Usage (Easiest)
```bash
# Process staging job queue (uses default staging URL)
npm run staging:cron

# Or use the script directly
node scripts/staging-cron.js
```

### 2. With Authentication (if staging has CRON_SECRET)
```bash
# If staging environment has CRON_SECRET configured
CRON_SECRET=your-secret npm run staging:cron
```

### 3. Custom Staging URL (if needed)
```bash
# Override default staging URL
API_URL=https://your-staging-url.vercel.app npm run staging:cron
```

**Default staging URL**: `https://meridian-esg-env-staging-development-bf4f2e8a.vercel.app`

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run staging:cron` | Process staging queue with 2-minute intervals |
| `npm run staging:cron:once` | Process one job and stop |
| `npm run staging:cron:fast` | Process with 30-second intervals (faster testing) |

## Command Line Options

```bash
node scripts/staging-cron.js [options]

Options:
  --url=URL        Override staging URL
  --interval=N     Set interval in seconds (default: 120)
  --max-empty=N    Stop after N consecutive empty checks (default: 5)
  --no-auto-stop   Keep running even when queue is empty
  --help, -h       Show help
```

## Examples

### Process Queue Once
```bash
# Good for testing - processes one job and stops
API_URL=https://staging.vercel.app npm run staging:cron:once
```

### Fast Processing for Testing
```bash
# Checks every 30 seconds instead of 2 minutes
API_URL=https://staging.vercel.app npm run staging:cron:fast
```

### Custom Configuration
```bash
# Custom interval (60 seconds) and never auto-stop
API_URL=https://staging.vercel.app node scripts/staging-cron.js --interval=60 --no-auto-stop
```

### With Environment File
Create `.env.staging` (add to .gitignore):
```
API_URL=https://your-staging-url.vercel.app
CRON_SECRET=your-secret-if-needed
```

Then run:
```bash
# Source environment and run
source .env.staging && npm run staging:cron
```

## How It Works

1. **Your local machine** runs the staging cron worker
2. **Every 2 minutes** (configurable), it makes an HTTP request to staging
3. **Staging processes the job** using its deployed code, database, and API keys
4. **Results are returned** and logged locally for monitoring
5. **Auto-stops** when the queue is empty (configurable)

### What Happens on Staging:
- ✅ Job fetched from queue
- ✅ AI agents process the job
- ✅ Results stored in staging database  
- ✅ Tokens charged to staging API keys
- ✅ All processing happens on Vercel staging

### What Happens Locally:
- ✅ HTTP request triggers the processing
- ✅ Logs show progress and results
- ✅ No data processing on local machine
- ✅ Lightweight monitoring only

## Monitoring

The worker provides detailed logging:
```
🚀 Starting Staging Cron Worker
📡 Target: https://staging.vercel.app
🔐 Authentication: Enabled (CRON_SECRET found)
⏰ Interval: 120 seconds
🛑 Auto-stop: Yes (after 5 empty checks)

[StagingCron] ✅ Job processed in 18726ms:
[StagingCron]    Job ID: bb6e6624-a0ed-419a-a040-6fef77b01cd2
[StagingCron]    Chunk: 8/12
[StagingCron]    Master Run: b28bda28-1786-4cfb-a9af-e3e5b8eb27be
[StagingCron]    Opportunities: 0
[StagingCron]    Duplicates: 2
[StagingCron]    Tokens: 28541
```

## Troubleshooting

### "Invalid URL" Error
Make sure your staging URL is complete and valid:
```bash
# ✅ Good
API_URL=https://meridian-esg-git-staging-user.vercel.app

# ❌ Bad  
API_URL=staging.vercel.app  # Missing https://
```

### Authentication Errors (401)
If you get 401 Unauthorized:
1. Check if staging has `CRON_SECRET` configured
2. Get the secret from Vercel environment variables
3. Pass it via `CRON_SECRET=your-secret`

### Connection Timeouts
- Check that staging deployment is running
- Verify the URL is accessible in browser
- Staging might be cold-starting (first request takes longer)

### Queue Never Empties
- Check staging database to see if jobs are stuck
- Look at staging logs in Vercel dashboard
- May need to reset stuck jobs manually

## Security Notes

- The worker only triggers job processing, doesn't access sensitive data
- Authentication uses the same CRON_SECRET as production
- All actual processing happens on secure Vercel staging environment
- Your local machine only sends HTTP requests and receives status updates

---

This approach gives you production-like job processing on staging without requiring complex CI/CD changes or external services.
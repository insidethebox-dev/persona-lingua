# Debugging Recommendations API in Production

## Changes Made for Better Debugging

### 1. Enhanced Error Logging
- Added detailed error information to all catch blocks
- Errors now include message, stack trace, and error type
- OpenAI-specific errors are logged separately

### 2. Step-by-Step Console Logging
The API now logs each step of the process:
- `[Recommendations] Starting generation` - Initial request
- `[Recommendations] Found X reports` - Student data retrieved
- `[Recommendations] Analyzing student needs` - Before OpenAI analysis
- `[Recommendations] Student needs analyzed` - After analysis with results
- `[Recommendations] Fetching materials` - Before database query
- `[Recommendations] Found X materials` - After filtering
- `[Recommendations] Scoring X materials` - Before scoring
- `[Recommendations] Top scored materials` - Top 5 scores shown
- `[Recommendations] Calling OpenAI` - Before final AI call
- `[Recommendations] OpenAI returned X` - After AI returns
- `[Recommendations] Saving to database` - Before saving
- `[Recommendations] Successfully completed` - Final success

### 3. File System Protection
- Debug file writing is now wrapped in try-catch
- Failures are logged as warnings (won't crash in production)
- Production environments with read-only file systems won't fail

### 4. OpenAI Error Handling
- Better error messages from OpenAI API
- Timeout and rate limit errors are properly logged
- API key issues will be clearly identified

## Common Production Issues to Check

### 1. Environment Variables
Ensure these are set in production:
```bash
OPENAI_API_KEY=sk-...
DATABASE_URL=...
NEXTAUTH_SECRET=...
```

### 2. OpenAI API Limits
- Rate limits: Check if production is hitting API rate limits
- Token limits: Large reports or many materials might exceed context
- Model availability: Ensure gpt-4-turbo-preview is accessible

### 3. Database Connection
- Verify Prisma can connect in production
- Check if there's a connection pool limit
- Ensure migrations are applied

### 4. Timeout Issues
- Vercel/hosting platform may have timeout limits (30s default)
- OpenAI calls can take 10-30 seconds
- Consider implementing async processing for long operations

### 5. Memory Limits
- Large datasets might exceed serverless memory limits
- Check if filtering many materials causes OOM

## How to Debug in Production

### View Logs
Check your hosting platform's logs for:
```
[Recommendations] Starting generation for student: ...
```

Look for where the logs stop to identify the failing step.

### Common Error Patterns

**"Failed to analyze student needs"**
- Issue: OpenAI API call for student analysis failed
- Check: API key, rate limits, report content

**"No materials scored above threshold"**
- Issue: No suitable materials found
- Check: Material availability, language matching, completion status

**"Failed to generate recommendations from filtered materials"**
- Issue: Final OpenAI call failed
- Check: Token limits (too many materials), API availability

**"Cannot read property of undefined"**
- Issue: Data structure mismatch
- Check: Database schema, missing fields

### Testing in Development

Run with detailed logging:
```bash
NODE_ENV=development npm run dev
```

Check the console for all `[Recommendations]` messages.

## Quick Fixes

### If OpenAI is timing out:
Reduce `MAX_MATERIALS_FOR_AI` from 20 to 10 in the route file

### If rate limited:
Add exponential backoff retry logic to OpenAI calls

### If memory issues:
Limit the number of reports or materials processed at once

### If file system errors:
Already fixed - file writing failures are now non-fatal

## Next Steps

1. Deploy these changes to production
2. Monitor logs for `[Recommendations]` messages
3. Identify which step fails
4. Address the specific issue based on the error message

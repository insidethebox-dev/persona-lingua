# PDF Cleanup Migration Script

This script sanitizes PDF files in Cloudinary to fix the double extension issue (`.pdf.pdf`) and clean up filenames.

## What it does

1. **Finds all PDF files** in the database with `mimeType: "application/pdf"`
2. **Creates clean filenames** by:
   - Removing the original file extension
   - Sanitizing the name (removing special characters, diacritics)
   - Adding `.pdf` extension exactly once
   - Adding timestamp prefix to avoid conflicts
3. **Re-uploads files** to Cloudinary with proper settings:
   - `resource_type: "raw"` (correct for PDFs)
   - Clean public_id without double extensions
4. **Updates database** with new URLs and filenames
5. **Cleans up old assets** from Cloudinary

## How to run

### Step 1: Test with limited records (RECOMMENDED)

```bash
npm run migrate:pdf-cleanup
```

By default, this will process only **2 records** for testing.

### Step 2: After verifying results, run for all records

1. Edit `scripts/migrate-pdf-cleanup.ts`
2. Comment out line: `await migratePdfs(2);`
3. Uncomment line: `await migratePdfs();`
4. Run again: `npm run migrate:pdf-cleanup`

## Before running

1. **Backup your database** (recommended)
2. **Check your Cloudinary quota** (the script will upload files again)
3. **Verify environment variables** are set:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `CLOUDINARY_FOLDER`

## What to expect

The script provides detailed logging:

- ✅ Successful migrations
- ❌ Failed attempts with error details
- 📊 Summary statistics
- ⚠️ Warnings for cleanup issues

## Example output

```
🚀 Starting PDF migration (testing with 2 records)...
📋 Found 2 PDF records to process

📝 Processing 1/2: Math Worksheet Grade 3
   Current URL: https://res.cloudinary.com/.../math-worksheet.pdf.pdf
   Current publicId: 1729123456-math-worksheet.pdf.pdf
   New publicId will be: 1729234567-math-worksheet.pdf
   📤 Uploading to Cloudinary...
   ✅ Upload successful: https://res.cloudinary.com/.../1729234567-math-worksheet.pdf
   💾 Updating database...
   🗑️ Cleaning up old asset: 1729123456-math-worksheet.pdf.pdf
   ✅ Deleted old raw asset
   ✅ Migration complete for: Math Worksheet Grade 3

📊 Migration Summary:
   ✅ Successful: 2
   ❌ Failed: 0
   📋 Total processed: 2
```

## Troubleshooting

- **File not accessible**: The script checks if files are reachable before processing
- **Cloudinary errors**: Check your API credentials and quota
- **Database errors**: Ensure your database connection is working
- **Old asset cleanup fails**: This is non-critical, old files may remain in Cloudinary but won't affect functionality

## Safety features

- Tests file accessibility before processing
- Detailed error handling and logging
- Non-destructive (creates new assets before deleting old ones)
- Rollback friendly (database changes are atomic per record)
- Configurable batch size for testing

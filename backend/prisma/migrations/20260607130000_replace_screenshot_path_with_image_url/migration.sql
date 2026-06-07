-- Replace screenshotPath with imageUrl (Cloudinary persistent URL)
-- Step 1: Add imageUrl column with a temporary default so existing rows aren't rejected
ALTER TABLE "AnalysisSession" ADD COLUMN "imageUrl" TEXT NOT NULL DEFAULT '';

-- Step 2: Copy any existing screenshotPath values as-is (best-effort migration)
UPDATE "AnalysisSession" SET "imageUrl" = COALESCE("screenshotPath", '') WHERE "screenshotPath" IS NOT NULL;

-- Step 3: Remove the default constraint (new rows must provide imageUrl explicitly)
ALTER TABLE "AnalysisSession" ALTER COLUMN "imageUrl" DROP DEFAULT;

-- Step 4: Drop the old screenshotPath column
ALTER TABLE "AnalysisSession" DROP COLUMN IF EXISTS "screenshotPath";

/**
 * Supabase Storage Setup for HeulaTrade
 *
 * This script creates the required storage bucket and policies for idx-timeseries data.
 * Run this once during initial setup.
 *
 * Canonical layout:
 *   idx-timeseries/
 *     stock_summary/
 *       date=2026-01-01.parquet
 *       date=2026-01-02.parquet
 *       ...
 *     broker_summary/
 *       date=2026-01-01.parquet
 *       ...
 *     index_summary/
 *       date=2026-01-01.parquet
 *       ...
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const STORAGE_BUCKET = 'idx-timeseries'

async function setupStorage() {
  console.log('Setting up Supabase Storage for HeulaTrade...')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1. Create storage bucket
  console.log(`Creating storage bucket: ${STORAGE_BUCKET}`)
  const { error: bucketError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024, // 50MB per file
    allowedMimeTypes: ['application/octet-stream', 'application/x-parquet'],
  })

  if (bucketError) {
    if (bucketError.message.includes('already exists')) {
      console.log('Bucket already exists, skipping creation')
    } else {
      console.error('Failed to create bucket:', bucketError)
      process.exit(1)
    }
  } else {
    console.log('Bucket created successfully')
  }

  // 2. Create RLS policies for authenticated access
  console.log('Creating RLS policies...')

  // Policy: Allow authenticated users to read
  const { error: readPolicyError } = await supabase.rpc('create_policy', {
    policy_name: 'idx-timeseries-read',
    table_name: 'objects',
    definition: `
      CREATE POLICY "idx-timeseries-read" ON storage.objects
      FOR SELECT USING (
        bucket_id = '${STORAGE_BUCKET}' AND
        auth.role() = 'authenticated'
      )
    `,
  })

  if (readPolicyError) {
    console.log('Read policy may already exist or requires manual setup')
  }

  // Policy: Allow service role to write
  const { error: writePolicyError } = await supabase.rpc('create_policy', {
    policy_name: 'idx-timeseries-write',
    table_name: 'objects',
    definition: `
      CREATE POLICY "idx-timeseries-write" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = '${STORAGE_BUCKET}' AND
        auth.role() = 'service_role'
      )
    `,
  })

  if (writePolicyError) {
    console.log('Write policy may already exist or requires manual setup')
  }

  console.log('Storage setup complete!')
  console.log('\nRequired environment variables:')
  console.log('  NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>')
  console.log('  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>')
}

// Run if executed directly
if (require.main === module) {
  setupStorage().catch(console.error)
}

export { setupStorage }

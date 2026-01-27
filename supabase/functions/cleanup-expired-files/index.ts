/**
 * cleanup-expired-files Edge Function
 *
 * Orchestrates complete orphan cleanup for file attachments:
 * 1. Queries get_expired_file_paths() for files soft-deleted > 30 days ago
 * 2. Removes storage objects from 'attachments' bucket via Storage API
 * 3. Purges metadata records via purge_expired_file_metadata()
 *
 * This ensures "no orphans" - both storage objects AND metadata are removed together.
 *
 * Invoke via:
 * - Manual: POST to function URL (for admin-triggered cleanup)
 * - Scheduled: pg_cron or external scheduler calling function URL
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY for admin storage operations.
 *
 * @example
 * curl -X POST https://your-project.supabase.co/functions/v1/cleanup-expired-files \
 *   -H "Authorization: Bearer YOUR_ANON_KEY"
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ExpiredFile {
  id: string
  storage_path: string
}

interface CleanupResult {
  message: string
  storageObjectsRemoved?: number
  metadataRecordsPurged?: number
  error?: string
  attempted?: number
}

serve(async (req: Request): Promise<Response> => {
  // Only allow POST requests (for scheduled invocation or manual trigger)
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Create Supabase client with service role for admin operations
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    // Step 1: Get expired file paths from metadata
    const { data: expiredFiles, error: queryError } = await supabase
      .rpc('get_expired_file_paths') as { data: ExpiredFile[] | null, error: Error | null }

    if (queryError) {
      console.error('Error querying expired files:', queryError)
      return new Response(
        JSON.stringify({
          error: `Failed to query expired files: ${queryError.message}`
        } as CleanupResult),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // If no expired files, return early with success
    if (!expiredFiles || expiredFiles.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No expired files to clean up',
          storageObjectsRemoved: 0,
          metadataRecordsPurged: 0
        } as CleanupResult),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Found ${expiredFiles.length} expired files to clean up`)

    // Step 2: Remove storage objects
    // Extract paths from expired files
    const paths = expiredFiles.map((f: ExpiredFile) => f.storage_path)

    // Remove in batches of 100 to avoid potential limits
    const batchSize = 100
    let totalRemoved = 0

    for (let i = 0; i < paths.length; i += batchSize) {
      const batch = paths.slice(i, i + batchSize)
      const { error: removeError } = await supabase.storage
        .from('attachments')
        .remove(batch)

      if (removeError) {
        console.error(`Error removing storage batch ${i / batchSize + 1}:`, removeError)
        return new Response(
          JSON.stringify({
            error: `Storage removal failed: ${removeError.message}`,
            attempted: paths.length,
            storageObjectsRemoved: totalRemoved
          } as CleanupResult),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      totalRemoved += batch.length
      console.log(`Removed storage batch ${i / batchSize + 1}: ${batch.length} files`)
    }

    console.log(`Successfully removed ${totalRemoved} storage objects`)

    // Step 3: Purge metadata records
    const { data: purgedCount, error: purgeError } = await supabase
      .rpc('purge_expired_file_metadata') as { data: number | null, error: Error | null }

    if (purgeError) {
      console.error('Error purging metadata:', purgeError)
      return new Response(
        JSON.stringify({
          error: `Metadata purge failed: ${purgeError.message}`,
          storageObjectsRemoved: totalRemoved
        } as CleanupResult),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Purged ${purgedCount} metadata records`)

    // Success - both storage and metadata cleaned up
    return new Response(
      JSON.stringify({
        message: 'Cleanup completed successfully',
        storageObjectsRemoved: totalRemoved,
        metadataRecordsPurged: purgedCount ?? 0
      } as CleanupResult),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error during cleanup:', error)
    return new Response(
      JSON.stringify({
        error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
      } as CleanupResult),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})

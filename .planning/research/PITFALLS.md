# Domain Pitfalls

**Domain:** Internal Management App Enhancement (File Uploads, Dashboards, UX)
**Researched:** 2026-01-27
**Confidence:** HIGH

---

## Critical Pitfalls

Mistakes that cause rewrites, security breaches, or major production issues.

### Pitfall 1: Missing or Incomplete RLS Policies on Storage Objects

**What goes wrong:** Developers add Supabase Storage without implementing Row Level Security policies, leaving files completely accessible to anyone with a URL, or implementing policies that have gaps allowing unauthorized access.

**Why it happens:**
- Supabase Storage RLS is disabled by default, requiring explicit policy creation
- Developers assume bucket-level permissions are sufficient
- Testing with service role keys bypasses RLS, masking the vulnerability
- The RLS policy must be applied to `storage.objects` table, not just the bucket

**Real-world evidence:** CVE-2025-48757 affected 170+ Lovable-generated applications due to missing RLS policies in generated code, exposing user data.

**Consequences:**
- Complete data breach - all uploaded files publicly accessible
- Compliance violations (GDPR, HIPAA, etc.)
- Users can access/modify other users' files
- Files intended for specific roles become public

**Prevention:**
1. **Enable RLS immediately:** Create RLS policies on `storage.objects` before allowing any uploads
2. **Use restrictive defaults:** Start with deny-all, explicitly grant permissions
3. **Test with anon key:** Always test file access using `NEXT_PUBLIC_SUPABASE_ANON_KEY`, never service role
4. **Run Security Advisor:** Use Supabase Dashboard's Security Advisor tool before deploying
5. **Policy patterns for this project:**
   ```sql
   -- User can only access files they uploaded
   CREATE POLICY "Users can view own files"
   ON storage.objects FOR SELECT
   USING (auth.uid()::text = (storage.foldername(name))[1]);

   -- Or role-based access
   CREATE POLICY "Admins can view all files"
   ON storage.objects FOR SELECT
   USING (
     EXISTS (
       SELECT 1 FROM users
       WHERE id = auth.uid() AND role = 'admin'
     )
   );
   ```

**Detection:**
- Security Advisor shows "Missing RLS" warnings
- Files accessible in incognito browser without login
- `storage.objects` table shows `rls_enabled = false`

**Phase mapping:** File Upload Implementation (Phase 2)

**Sources:**
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [CVE-2025-48757 Disclosure](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/)
- [RLS Best Practices](https://vibeappscanner.com/supabase-row-level-security)

---

### Pitfall 2: Orphaned Files from SQL-Based Deletion

**What goes wrong:** Developers delete file metadata from database using SQL queries instead of Storage API, leaving actual files in S3 bucket forever, consuming storage quota and costing money.

**Why it happens:**
- Natural instinct to use SQL for all database operations
- Cascade deletes on parent entities (QMRL, QMHQ, PO) only delete metadata
- Not understanding Supabase Storage is backed by S3, not Postgres
- Deleting parent records without handling attachments

**Real-world evidence:** Supabase GitHub discussions show users discovering storage usage stays high despite deleting all visible files through SQL.

**Consequences:**
- Storage costs increase without apparent reason
- Storage quota exceeded unexpectedly
- "Ghost files" that can't be seen or deleted through UI
- Compliance issues (deleted records still have accessible files)

**Prevention:**
1. **Never use SQL to delete files:** Always use `supabase.storage.from('bucket').remove()`
2. **Cascade handling:** When deleting parent entities, explicitly delete attachments first:
   ```typescript
   // WRONG
   await supabase.from('qmrl').delete().eq('id', qmrlId);

   // CORRECT
   const { data: files } = await supabase
     .from('attachments')
     .select('file_path')
     .eq('entity_id', qmrlId);

   if (files?.length) {
     await supabase.storage
       .from('attachments')
       .remove(files.map(f => f.file_path));
   }

   await supabase.from('attachments').delete().eq('entity_id', qmrlId);
   await supabase.from('qmrl').delete().eq('id', qmrlId);
   ```
3. **Database triggers for safety:**
   ```sql
   CREATE OR REPLACE FUNCTION delete_storage_object()
   RETURNS TRIGGER AS $$
   BEGIN
     PERFORM storage.delete_object('attachments', OLD.file_path);
     RETURN OLD;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   CREATE TRIGGER on_attachment_deleted
     BEFORE DELETE ON attachments
     FOR EACH ROW
     EXECUTE FUNCTION delete_storage_object();
   ```
4. **Soft delete consideration:** Use `is_active = false` instead of hard deletes to preserve file references

**Detection:**
- Storage dashboard shows usage >> database attachment count
- Files accessible by direct URL but not in database
- Storage quota warning despite "empty" buckets
- Run cleanup query to find orphans:
  ```sql
  SELECT name FROM storage.objects
  WHERE bucket_id = 'attachments'
  AND name NOT IN (SELECT file_path FROM attachments);
  ```

**Phase mapping:** File Upload Implementation (Phase 2), Cleanup utilities (Phase 4)

**Sources:**
- [Supabase Storage Delete Objects](https://supabase.com/docs/guides/storage/management/delete-objects)
- [Orphaned Files Discussion](https://github.com/orgs/supabase/discussions/34254)

---

### Pitfall 3: Service Role Key Exposure in Client Code

**What goes wrong:** Developers use `SUPABASE_SERVICE_ROLE_KEY` in client-side code to bypass RLS "temporarily" during development, then accidentally ship it to production, giving all users admin access to entire database.

**Why it happens:**
- RLS policies seem "too restrictive" during development
- Metadata timing issues during file uploads cause RLS errors
- Copy-paste from Stack Overflow without understanding
- Environment variables in `.env.local` accidentally included in build

**Real-world evidence:** Security researchers have created CLI tools specifically to scan for exposed Supabase service keys after catching database leaks exposing thousands of users.

**Consequences:**
- **Complete system compromise:** Anyone can read/write/delete ANY data
- `auth.uid()` returns null with service key, breaking all RLS logic
- Users can escalate to admin privileges
- Impossible to audit who did what (all actions appear as service role)

**Prevention:**
1. **Never in client code:** Service role key belongs in server-only files
   - Next.js: Only in API routes, Server Actions, not in components
   - Environment: Use `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix)
2. **Separate clients:**
   ```typescript
   // lib/supabase/client.ts (browser)
   export const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // ANON only
   );

   // lib/supabase/admin.ts (server only)
   export const supabaseAdmin = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role
   );
   ```
3. **Solve root cause:** Fix RLS policies instead of bypassing them
4. **Code review checklist:**
   - Search codebase for `SERVICE_ROLE_KEY`
   - Verify it's only imported in server-side files
   - Check build output doesn't include it
5. **Runtime protection:**
   ```typescript
   // lib/supabase/client.ts
   if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes('service_role')) {
     throw new Error('Service role key detected in client!');
   }
   ```

**Detection:**
- Build warnings about environment variables
- `auth.uid()` returning null in RLS policies
- All operations succeed regardless of user role
- Search codebase: `grep -r "service_role" app/`

**Phase mapping:** File Upload Implementation (Phase 2) - Critical to catch early

**Sources:**
- [Supabase Storage RLS Admin Upload Fix](https://www.technetexperts.com/supabase-storage-rls-admin-upload-fix/)
- [Next.js Data Security Guide](https://nextjs.org/docs/app/guides/data-security)

---

### Pitfall 4: Client-Side Validation as Security Boundary

**What goes wrong:** Developers validate file types, sizes, and extensions only in the browser, allowing attackers to trivially bypass restrictions by modifying requests or using cURL, leading to malware uploads or storage exhaustion.

**Why it happens:**
- Client validation provides immediate UX feedback, feels "complete"
- Server validation seems redundant
- Trusting `Content-Type` header from browser
- Not understanding attackers have full control of HTTP requests

**Real-world evidence:** OWASP lists unrestricted file upload as a critical vulnerability, with 2025 research showing attackers continuously finding new bypass techniques.

**Consequences:**
- Malware/webshell uploads if server executes uploaded files
- Storage exhaustion from huge files (>25MB limit bypassed)
- Wrong file types bypass application logic
- DoS via memory exhaustion (CVE-2026-23864)

**Prevention:**
1. **Server-side validation is mandatory:**
   ```typescript
   // app/api/upload/route.ts
   export async function POST(request: Request) {
     const formData = await request.formData();
     const file = formData.get('file') as File;

     // NEVER TRUST CLIENT
     // Validate size
     if (file.size > 25 * 1024 * 1024) {
       return Response.json({ error: 'File too large' }, { status: 400 });
     }

     // Validate MIME type (magic bytes, not Content-Type header)
     const buffer = await file.arrayBuffer();
     const type = await fileTypeFromBuffer(new Uint8Array(buffer));

     const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
     if (!type || !allowedTypes.includes(type.mime)) {
       return Response.json({ error: 'Invalid file type' }, { status: 400 });
     }

     // Generate server-side filename (never trust user filename)
     const ext = type.ext;
     const filename = `${crypto.randomUUID()}.${ext}`;

     // Upload to Supabase Storage
     // ...
   }
   ```
2. **Use magic byte detection:** Libraries like `file-type` check actual file content, not just extension
3. **Explicit allowlist:** Prefer allowlist (`['pdf', 'jpg', 'png']`) over blocklist
4. **Storage-level limits:** Configure Supabase bucket max file size
5. **Rate limiting:** Prevent bulk upload attacks
6. **Virus scanning:** For high-security needs, integrate ClamAV or cloud scanning

**Detection:**
- Upload succeeds with manipulated Content-Type
- Files with wrong extensions accepted
- Upload bypassed using `curl -F "file=@malware.exe"`
- Files >25MB successfully uploaded

**Phase mapping:** File Upload Implementation (Phase 2) - Must be in MVP

**Sources:**
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [File Upload Validation Techniques](https://www.triaxiomsecurity.com/file-upload-validation-techniques/)
- [CVE-2026-23864 DoS Vulnerability](https://www.akamai.com/blog/security-research/2026/jan/cve-2026-23864-react-nextjs-denial-of-service)

---

### Pitfall 5: N+1 Queries in Dashboard Aggregations

**What goes wrong:** Dashboard loads list of entities, then loops through each to fetch related data (attachments count, total amounts, status names), causing hundreds of database queries and 30+ second page loads.

**Why it happens:**
- ORM/query builder makes sequential queries easy and invisible
- Not thinking about query count during development
- Loading relationships separately instead of joining
- Aggregations in application code instead of database

**Real-world evidence:** Developers report dashboard queries taking 7.1 seconds being reduced to milliseconds using materialized views, with 30x performance improvements common.

**Consequences:**
- Dashboard timeout on production data volumes
- Database connection pool exhaustion
- High database CPU usage
- Poor user experience (30+ second loads)

**Prevention:**
1. **Use joins and aggregations in single query:**
   ```typescript
   // WRONG - N+1 queries
   const qmrls = await supabase.from('qmrl').select('*');
   for (const qmrl of qmrls.data) {
     const { count } = await supabase
       .from('attachments')
       .select('*', { count: 'exact' })
       .eq('entity_id', qmrl.id);
     qmrl.attachment_count = count;
   }

   // CORRECT - Single query with join
   const { data } = await supabase
     .from('qmrl')
     .select(`
       *,
       attachment_count:attachments(count)
     `);
   ```
2. **Materialized views for complex dashboards:**
   ```sql
   CREATE MATERIALIZED VIEW dashboard_summary AS
   SELECT
     status_id,
     COUNT(*) as qmrl_count,
     COUNT(DISTINCT department_id) as department_count,
     SUM((SELECT COUNT(*) FROM attachments WHERE entity_id = qmrl.id)) as total_attachments
   FROM qmrl
   GROUP BY status_id;

   -- Refresh every 5 minutes
   CREATE INDEX ON dashboard_summary(status_id);
   ```
3. **Postgres views for simpler cases:**
   ```sql
   CREATE VIEW qmrl_with_counts AS
   SELECT
     q.*,
     COUNT(a.id) as attachment_count,
     COUNT(h.id) as qmhq_count
   FROM qmrl q
   LEFT JOIN attachments a ON a.entity_id = q.id
   LEFT JOIN qmhq h ON h.qmrl_id = q.id
   GROUP BY q.id;
   ```
4. **Index aggregation columns:**
   - Add indexes on foreign keys used in JOINs
   - Use BRIN indexes on `created_at` for time-series aggregations (10x smaller)
5. **Monitor query count:**
   ```typescript
   // Development helper
   if (process.env.NODE_ENV === 'development') {
     let queryCount = 0;
     supabase.from = new Proxy(supabase.from, {
       apply(target, thisArg, args) {
         queryCount++;
         console.log(`Query #${queryCount}:`, args[0]);
         return Reflect.apply(target, thisArg, args);
       }
     });
   }
   ```

**Detection:**
- Dashboard takes >5 seconds to load with modest data
- Database connection count spikes when loading dashboard
- Network tab shows dozens of sequential requests
- Supabase dashboard shows high query count

**Phase mapping:** Dashboard Implementation (Phase 3) - Critical for performance

**Sources:**
- [Materialized Views Performance Case Study](https://sngeth.com/rails/performance/postgresql/2025/10/03/materialized-views-performance-case-study/)
- [Supabase Query Optimization](https://supabase.com/docs/guides/database/query-optimization)
- [PostgreSQL Materialized Views Guide](https://www.epsio.io/blog/postgres-materialized-views-basics-tutorial-and-optimization-tips)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or performance issues.

### Pitfall 6: Race Conditions in Inline Status Updates

**What goes wrong:** User clicks status dropdown, changes "Draft" to "Approved", but simultaneous background refresh or another user's update causes status to revert, or audit log misses the change, or update fails silently.

**Why it happens:**
- Optimistic UI updates before server confirmation
- No conflict resolution strategy
- Audit triggers fire before transaction commits
- Multiple users editing same record

**Consequences:**
- Status changes lost silently
- Audit log shows incomplete history (missing "who changed status")
- User confusion ("I already approved this!")
- Compliance issues if audit trail has gaps

**Prevention:**
1. **Optimistic UI with rollback:**
   ```typescript
   'use client';
   import { useOptimistic } from 'react';

   function StatusSelect({ qmrl }) {
     const [optimisticStatus, setOptimisticStatus] = useOptimistic(
       qmrl.status_id,
       (state, newStatus) => newStatus
     );

     async function updateStatus(newStatus: string) {
       // Show change immediately
       setOptimisticStatus(newStatus);

       try {
         const { error } = await supabase
           .from('qmrl')
           .update({ status_id: newStatus })
           .eq('id', qmrl.id)
           .eq('updated_at', qmrl.updated_at); // Optimistic locking

         if (error) throw error;
       } catch (error) {
         // Rollback on error
         setOptimisticStatus(qmrl.status_id);
         toast.error('Status update failed - record was modified by another user');
       }
     }
   }
   ```
2. **Optimistic locking (timestamp-based):**
   ```sql
   -- Update only if not modified since we loaded it
   UPDATE qmrl
   SET status_id = $1, updated_at = NOW()
   WHERE id = $2 AND updated_at = $3;
   -- If 0 rows affected, record was modified
   ```
3. **Audit logging in same transaction:**
   ```sql
   CREATE OR REPLACE FUNCTION audit_status_change()
   RETURNS TRIGGER AS $$
   BEGIN
     IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
       INSERT INTO audit_logs (
         entity_type,
         entity_id,
         action,
         old_value,
         new_value,
         changed_by
       ) VALUES (
         'qmrl',
         NEW.id,
         'status_change',
         jsonb_build_object('status_id', OLD.status_id),
         jsonb_build_object('status_id', NEW.status_id),
         auth.uid() -- Captured at transaction time
       );
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   CREATE TRIGGER audit_qmrl_status
     AFTER UPDATE ON qmrl
     FOR EACH ROW
     EXECUTE FUNCTION audit_status_change();
   ```
4. **Realtime subscription for conflict detection:**
   ```typescript
   useEffect(() => {
     const channel = supabase
       .channel(`qmrl:${id}`)
       .on('postgres_changes', {
         event: 'UPDATE',
         schema: 'public',
         table: 'qmrl',
         filter: `id=eq.${id}`
       }, (payload) => {
         if (payload.new.updated_at > lastKnownUpdate) {
           toast.warning('Record updated by another user - refreshing...');
           // Refresh data
         }
       })
       .subscribe();

     return () => { channel.unsubscribe(); };
   }, [id]);
   ```
5. **Debounce rapid updates:**
   ```typescript
   const debouncedUpdate = useMemo(
     () => debounce(updateStatus, 500),
     []
   );
   ```

**Detection:**
- Audit logs missing status changes
- Users report "changes not saving"
- Multiple audit entries with same timestamp
- Status reverts after page refresh

**Phase mapping:** Status Update UX (Phase 1), Audit Integration (Phase 4)

**Sources:**
- [React useOptimistic Hook](https://react.dev/reference/react/useOptimistic)
- [Optimistic UI in Next.js](https://medium.com/@mishal.s.suyog/optimistic-ui-with-server-actions-in-next-js-a-smoother-user-experience-6b779e4293a9)
- [Audit Logging Race Conditions Research](https://dl.acm.org/doi/10.1145/3372297.3417862)

---

### Pitfall 7: Memory Leaks from Realtime Subscriptions

**What goes wrong:** Dashboard components subscribe to Realtime changes but don't unsubscribe on unmount, causing memory usage to grow with each navigation until browser tab crashes.

**Why it happens:**
- Forgetting cleanup in `useEffect`
- Creating new subscription on every render
- Not understanding WebSocket connection lifecycle
- Multiple tabs multiplying subscriptions

**Real-world evidence:** Supabase Realtime documentation and community reports show client-side memory leaks from improper subscription handling, with browser extensions hitting issues from users opening multiple tabs.

**Consequences:**
- Browser tab memory usage grows unbounded
- Performance degrades over time
- Database flooded with subscribe/unsubscribe actions
- `realtime.subscriptions` table bloat

**Prevention:**
1. **Always unsubscribe on unmount:**
   ```typescript
   useEffect(() => {
     const channel = supabase
       .channel('dashboard-updates')
       .on('postgres_changes', {
         event: '*',
         schema: 'public',
         table: 'qmrl'
       }, handleChange)
       .subscribe();

     // CRITICAL: cleanup
     return () => {
       channel.unsubscribe();
     };
   }, []); // Empty deps - subscribe once
   ```
2. **Singleton channel pattern:**
   ```typescript
   // lib/realtime/dashboard-channel.ts
   let channel: RealtimeChannel | null = null;

   export function useDashboardChannel(callback: (payload: any) => void) {
     useEffect(() => {
       if (!channel) {
         channel = supabase
           .channel('dashboard')
           .on('postgres_changes', { ... }, callback)
           .subscribe();
       }

       return () => {
         // Only unsubscribe when last component unmounts
         // (requires ref counting in production)
       };
     }, [callback]);
   }
   ```
3. **Limit subscriptions per user:**
   - For admin dashboards, use polling instead of Realtime
   - Subscribe to specific records, not entire tables
   - Use Supabase Realtime filters to reduce message volume
4. **Monitor subscription count:**
   ```sql
   SELECT COUNT(*) FROM realtime.subscriptions;
   ```
5. **Vacuum the subscriptions table periodically:**
   ```sql
   VACUUM FULL realtime.subscriptions;
   ```

**Detection:**
- Browser DevTools shows growing memory usage
- `chrome://memory` shows tab memory > 500MB
- Supabase dashboard shows high Realtime connection count
- `realtime.subscriptions` table grows large

**Phase mapping:** Dashboard Implementation (Phase 3)

**Sources:**
- [Supabase Realtime Memory Leak](https://drdroid.io/stack-diagnosis/supabase-realtime-client-side-memory-leak)
- [Realtime Subscriptions in Browser Extensions](https://medium.com/@saravananshanmugam/what-weve-learned-using-supabase-real-time-subscriptions-in-our-browser-extension-d82126c236a1)

---

### Pitfall 8: CORS Errors in File Preview

**What goes wrong:** File preview works in development but fails in production with "CORS policy: No 'Access-Control-Allow-Origin' header" error, especially for PDFs and images from Supabase Storage.

**Why it happens:**
- Supabase Storage bucket set to private (requires signed URLs)
- Mixing authenticated and unauthenticated requests
- PDF.js makes cross-origin Ajax requests
- Next.js Image component has different origin than storage bucket

**Consequences:**
- File preview broken in production
- "Download only" experience instead of inline preview
- Error messages shown to users
- Images don't load in Next.js Image component

**Prevention:**
1. **Use signed URLs for private buckets:**
   ```typescript
   async function getFileUrl(path: string) {
     const { data } = await supabase.storage
       .from('attachments')
       .createSignedUrl(path, 60 * 60); // 1 hour expiry

     return data?.signedUrl;
   }
   ```
2. **Public bucket with RLS for preview needs:**
   ```sql
   -- Make bucket public but use RLS to control access
   UPDATE storage.buckets
   SET public = true
   WHERE id = 'attachments';

   -- Still control access via RLS on storage.objects
   ```
3. **Proxy through Next.js API route:**
   ```typescript
   // app/api/files/[...path]/route.ts
   export async function GET(
     request: Request,
     { params }: { params: { path: string[] } }
   ) {
     const filePath = params.path.join('/');

     // Verify user has access (check RLS rules)
     const { data, error } = await supabaseAdmin.storage
       .from('attachments')
       .download(filePath);

     if (error) return new Response('Not found', { status: 404 });

     return new Response(data, {
       headers: {
         'Content-Type': data.type,
         'Access-Control-Allow-Origin': '*', // Or specific origin
       }
     });
   }
   ```
4. **Configure Next.js Image domains:**
   ```typescript
   // next.config.js
   module.exports = {
     images: {
       remotePatterns: [
         {
           protocol: 'https',
           hostname: '*.supabase.co',
           pathname: '/storage/v1/object/public/**',
         }
       ]
     }
   };
   ```
5. **PDF preview with authentication:**
   ```typescript
   import { Document, Page } from 'react-pdf';

   function PDFPreview({ fileUrl }: { fileUrl: string }) {
     const [signedUrl, setSignedUrl] = useState<string>();

     useEffect(() => {
       getFileUrl(fileUrl).then(setSignedUrl);
     }, [fileUrl]);

     return (
       <Document
         file={{
           url: signedUrl,
           httpHeaders: {
             'Authorization': `Bearer ${session.access_token}`
           }
         }}
       >
         <Page pageNumber={1} />
       </Document>
     );
   }
   ```

**Detection:**
- Console errors: "CORS policy: No 'Access-Control-Allow-Origin'"
- PDF preview shows blank page
- Images don't load in production
- Works locally but fails on Vercel

**Phase mapping:** File Preview Feature (Phase 2)

**Sources:**
- [Using CORS in Next.js](https://blog.logrocket.com/using-cors-next-js-handle-cross-origin-requests/)
- [CORS Issues with PDF](https://wordpress.dearflip.com/cors-issues-with-pdf/)
- [React PDF CORS Issue](https://github.com/diegomura/react-pdf/issues/2340)

---

### Pitfall 9: File Upload Size Limits in Next.js Server Actions

**What goes wrong:** File uploads work in development but fail in production with "Body exceeded 1mb limit" error, even though Supabase supports 25MB. This is due to Next.js Server Actions default 1MB body size limit.

**Why it happens:**
- Next.js Server Actions have built-in 1MB body limit
- Different from API routes (which you can configure)
- Not documented prominently in file upload guides
- Supabase Storage limit (25MB) misleads developers

**Real-world evidence:** Recurring GitHub issues in Next.js repository about Server Actions file upload body limit, with no clear solution for increasing limit in Server Actions.

**Consequences:**
- Files >1MB fail silently or with obscure error
- Different behavior between dev and production
- Users frustrated by upload failures
- Fallback to API routes required

**Prevention:**
1. **Use API routes for file uploads (not Server Actions):**
   ```typescript
   // app/api/upload/route.ts
   export const config = {
     api: {
       bodyParser: {
         sizeLimit: '25mb', // Configurable in API routes
       },
     },
   };

   export async function POST(request: Request) {
     const formData = await request.formData();
     const file = formData.get('file') as File;
     // ... upload logic
   }
   ```
2. **Client-side chunking for large files:**
   ```typescript
   async function uploadLargeFile(file: File) {
     const chunkSize = 1024 * 1024; // 1MB chunks
     const chunks = Math.ceil(file.size / chunkSize);

     for (let i = 0; i < chunks; i++) {
       const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
       await uploadChunk(chunk, i);
     }
   }
   ```
3. **Direct upload to Supabase Storage from client:**
   ```typescript
   // Bypass Next.js entirely
   async function uploadFile(file: File) {
     const fileName = `${crypto.randomUUID()}.${file.name.split('.').pop()}`;
     const { data, error } = await supabase.storage
       .from('attachments')
       .upload(fileName, file, {
         cacheControl: '3600',
         upsert: false
       });

     if (error) throw error;

     // Save metadata to database
     await supabase.from('attachments').insert({
       file_path: data.path,
       file_name: file.name,
       file_size: file.size,
       // ...
     });
   }
   ```
4. **Clear error messaging:**
   ```typescript
   if (file.size > 25 * 1024 * 1024) {
     return { error: 'File must be less than 25MB' };
   }
   ```

**Detection:**
- Error: "Body exceeded 1mb limit"
- Files >1MB fail to upload
- Works with small files, fails with larger ones
- Production only (dev environment sometimes more permissive)

**Phase mapping:** File Upload Implementation (Phase 2)

**Sources:**
- [Server Actions Body Limit Discussion](https://github.com/vercel/next.js/discussions/53989)
- [Next.js File Uploads Server-Side Solutions](https://www.pronextjs.dev/next-js-file-uploads-server-side-solutions)
- [CVE-2026-23864 Memory Exhaustion](https://www.akamai.com/blog/security-research/2026/jan/cve-2026-23864-react-nextjs-denial-of-service)

---

## Minor Pitfalls

Mistakes that cause annoyance or minor issues but are relatively easy to fix.

### Pitfall 10: Trusting User Filenames

**What goes wrong:** User uploads file named `../../../../etc/passwd` or `<script>alert('xss')</script>.jpg`, causing path traversal vulnerabilities or XSS when displaying filename in UI.

**Why it happens:**
- Assuming filenames are benign strings
- Not sanitizing before storage path construction
- Displaying filename without HTML encoding
- Not understanding filenames are user input

**Consequences:**
- Path traversal allows overwriting system files
- XSS when rendering filenames in UI
- Database injection if filename used in queries
- File collisions if multiple users upload same name

**Prevention:**
1. **Generate server-side filenames:**
   ```typescript
   const userFilename = file.name; // Store for display only
   const storageFilename = `${crypto.randomUUID()}.${getExtension(userFilename)}`;

   await supabase.storage.from('attachments').upload(storageFilename, file);

   await supabase.from('attachments').insert({
     file_path: storageFilename, // Safe, server-generated
     file_name: userFilename,     // Original name for display
   });
   ```
2. **Sanitize display filenames:**
   ```typescript
   import { escape } from 'html-escaper';

   function FileList({ attachments }) {
     return (
       <ul>
         {attachments.map(a => (
           <li key={a.id}>{escape(a.file_name)}</li>
         ))}
       </ul>
     );
   }
   ```
3. **Validate filename characters:**
   ```typescript
   const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9._-]+$/;

   function sanitizeFilename(filename: string): string {
     return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
   }
   ```
4. **Storage path structure:**
   ```
   /{entity_type}/{entity_id}/{uuid}.{ext}

   Example: /qmrl/123e4567-e89b-12d3-a456-426614174000/a1b2c3d4.pdf
   ```

**Detection:**
- Files appear in wrong directories
- XSS alerts when viewing file list
- Storage bucket has files with path characters (`../`, `./`)

**Phase mapping:** File Upload Implementation (Phase 2)

**Sources:**
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [Bypassing File Upload Restrictions](https://blog.doyensec.com/2025/01/09/cspt-file-upload.html)

---

### Pitfall 11: Missing File Lifecycle Management

**What goes wrong:** Attachments accumulate forever - test uploads during development, files from deleted records, replaced versions, temporary uploads that failed - consuming storage quota and costing money.

**Why it happens:**
- No expiration policy on uploads
- Failed uploads leave partial files
- Replacing files doesn't delete old version
- No cleanup for soft-deleted parent records

**Consequences:**
- Storage costs increase over time
- Quota exhausted by old/unused files
- Difficulty finding relevant files in bucket
- Compliance issues (retaining data longer than necessary)

**Prevention:**
1. **Cleanup failed uploads:**
   ```typescript
   async function handleUpload(file: File) {
     let uploadedPath: string | null = null;

     try {
       // Upload to storage
       const { data } = await supabase.storage
         .from('attachments')
         .upload(filename, file);
       uploadedPath = data.path;

       // Insert metadata
       await supabase.from('attachments').insert({
         file_path: uploadedPath,
         // ...
       });
     } catch (error) {
       // Cleanup orphaned file
       if (uploadedPath) {
         await supabase.storage.from('attachments').remove([uploadedPath]);
       }
       throw error;
     }
   }
   ```
2. **Mark files for deletion when parent soft-deleted:**
   ```sql
   CREATE OR REPLACE FUNCTION mark_attachments_deleted()
   RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.is_active = false AND OLD.is_active = true THEN
       UPDATE attachments
       SET is_active = false, deleted_at = NOW()
       WHERE entity_id = NEW.id AND entity_type = TG_TABLE_NAME;
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER mark_qmrl_attachments
     AFTER UPDATE ON qmrl
     FOR EACH ROW
     EXECUTE FUNCTION mark_attachments_deleted();
   ```
3. **Scheduled cleanup job:**
   ```typescript
   // Supabase Edge Function or cron job
   async function cleanupOldFiles() {
     const thirtyDaysAgo = new Date();
     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

     // Find soft-deleted attachments older than 30 days
     const { data } = await supabase
       .from('attachments')
       .select('file_path')
       .eq('is_active', false)
       .lt('deleted_at', thirtyDaysAgo.toISOString());

     if (data?.length) {
       // Delete from storage
       await supabase.storage
         .from('attachments')
         .remove(data.map(d => d.file_path));

       // Hard delete metadata
       await supabase
         .from('attachments')
         .delete()
         .eq('is_active', false)
         .lt('deleted_at', thirtyDaysAgo.toISOString());
     }
   }
   ```
4. **S3 lifecycle policies (future):**
   - Supabase roadmap includes lifecycle management
   - For now, implement application-level cleanup

**Detection:**
- Storage usage dashboard shows growth without new uploads
- Manual bucket inspection shows old test files
- Files exist in storage but not in database

**Phase mapping:** File Upload Implementation (Phase 2 - basic), Cleanup utilities (Phase 4 - automated)

**Sources:**
- [Supabase Storage Expiring Objects Discussion](https://github.com/orgs/supabase/discussions/20171)
- [Clear Files Without DB Association](https://github.com/orgs/supabase/discussions/13741)

---

### Pitfall 12: Inline Update UI Without Loading State

**What goes wrong:** User changes status in dropdown, nothing happens visually for 2-3 seconds while request processes, user clicks again thinking it didn't work, causing duplicate updates or confusion.

**Why it happens:**
- Optimistic UI not implemented
- No loading indicator during async operation
- Dropdown immediately closes, hiding feedback
- Network latency not accounted for

**Consequences:**
- User submits duplicate status changes
- Confusion about whether action succeeded
- Poor perceived performance
- Increased support requests

**Prevention:**
1. **Optimistic UI with loading state:**
   ```typescript
   function StatusDropdown({ qmrl }) {
     const [isUpdating, setIsUpdating] = useState(false);
     const [optimisticStatus, setOptimisticStatus] = useOptimistic(
       qmrl.status_id
     );

     async function handleChange(newStatus: string) {
       setIsUpdating(true);
       setOptimisticStatus(newStatus);

       try {
         await updateStatus(qmrl.id, newStatus);
         toast.success('Status updated');
       } catch (error) {
         setOptimisticStatus(qmrl.status_id);
         toast.error('Update failed');
       } finally {
         setIsUpdating(false);
       }
     }

     return (
       <Select
         value={optimisticStatus}
         onChange={handleChange}
         disabled={isUpdating}
       >
         {/* ... */}
         {isUpdating && <Spinner />}
       </Select>
     );
   }
   ```
2. **Visual feedback patterns:**
   - Show spinner next to dropdown during update
   - Temporarily disable dropdown with opacity
   - Toast notification on success/failure
   - Animate status badge change
3. **Debounce if updates are frequent:**
   ```typescript
   const debouncedUpdate = useMemo(
     () => debounce(updateStatus, 300),
     []
   );
   ```

**Detection:**
- Users click dropdown multiple times
- Support tickets: "Status changes don't save"
- Multiple audit log entries for same change
- High bounce rate on status change pages

**Phase mapping:** Status Update UX (Phase 1)

**Sources:**
- [Optimistic UI in Next.js](https://dev.to/olaleyeblessing/implementing-optimistic-ui-in-reactjsnextjs-4nkk)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Phase 1: Status Update UX** | Race conditions in status changes | Implement optimistic locking, audit triggers in same transaction |
| **Phase 2: File Upload** | Missing RLS policies, service key exposure, client-side validation only | Create RLS policies first, server-side validation, API routes not Server Actions |
| **Phase 2: File Preview** | CORS errors in production | Use signed URLs or proxy through Next.js API route |
| **Phase 3: Dashboard** | N+1 queries, materialized view staleness | Join aggregations in single query, use materialized views with refresh schedule |
| **Phase 3: Realtime Updates** | Memory leaks from subscriptions | Always unsubscribe in useEffect cleanup |
| **Phase 4: Cleanup/Audit** | Orphaned files from SQL deletes, audit log gaps | Use Storage API for deletes, audit triggers in transaction |

---

## Cross-Cutting Concerns

### Security Checklist

Before deploying any phase:

- [ ] RLS policies enabled and tested with anon key
- [ ] Service role key only in server-side code
- [ ] All user input validated server-side
- [ ] File uploads validated by magic bytes, not extension
- [ ] Generated filenames, not user-provided
- [ ] CORS configured for file preview
- [ ] Rate limiting on upload endpoints
- [ ] Security Advisor scan passes

### Performance Checklist

Before marking phase complete:

- [ ] Query count logged in development
- [ ] No N+1 queries in list/dashboard views
- [ ] Indexes on all foreign keys and filter columns
- [ ] Materialized views for heavy aggregations
- [ ] Realtime subscriptions cleaned up on unmount
- [ ] File upload size limits enforced
- [ ] Loading states for all async actions

### Audit Checklist

Before deploying status/entity changes:

- [ ] Audit triggers fire in same transaction
- [ ] Optimistic locking prevents lost updates
- [ ] All status changes logged with user ID
- [ ] Audit log includes old and new values
- [ ] Timestamp captured at transaction time

---

## Testing Strategy

### Critical Path Testing

**File Upload Security:**
1. Attempt upload >25MB (should fail with clear error)
2. Upload file with wrong extension (`.exe` renamed to `.pdf`) - should be rejected by magic byte check
3. Test file access without authentication (should 403)
4. Test file access as different user (should 403 unless public)
5. Delete parent entity, verify file deleted from storage

**Dashboard Performance:**
1. Load dashboard with 1,000 records
2. Check network tab for query count (should be <10)
3. Measure page load time (should be <2 seconds)
4. Navigate away and back, check memory usage (should not grow)

**Status Update Race Conditions:**
1. Open same record in two browser tabs
2. Change status in both tabs simultaneously
3. Verify one succeeds, other shows conflict warning
4. Check audit log has both attempts recorded

**File Preview:**
1. Preview PDF in private bucket (should work)
2. Preview in incognito window (should require login)
3. Preview large PDF >5MB (should show loading state)
4. Test CORS by opening preview in new tab

---

## Recommended Reading

### Official Documentation (HIGH confidence)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase Query Optimization](https://supabase.com/docs/guides/database/query-optimization)
- [Next.js Data Security](https://nextjs.org/docs/app/guides/data-security)
- [React useOptimistic Hook](https://react.dev/reference/react/useOptimistic)

### Security Resources (HIGH confidence)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP Unrestricted File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)

### Performance Resources (MEDIUM-HIGH confidence)
- [PostgreSQL Materialized Views Documentation](https://www.postgresql.org/docs/current/rules-materializedviews.html)
- [Materialized Views Performance Case Study](https://sngeth.com/rails/performance/postgresql/2025/10/03/materialized-views-performance-case-study/)

### Community Experiences (MEDIUM confidence)
- [Supabase RLS Issues & Solutions](https://prosperasoft.com/blog/database/supabase/supabase-rls-issues/)
- [Realtime Subscriptions in Production](https://medium.com/@saravananshanmugam/what-weve-learned-using-supabase-real-time-subscriptions-in-our-browser-extension-d82126c236a1)

---

## Confidence Assessment

| Pitfall Category | Confidence | Evidence |
|-----------------|-----------|----------|
| RLS & Storage Security | HIGH | Official Supabase docs + CVE disclosures + GitHub discussions |
| File Upload Validation | HIGH | OWASP standards + recent security research |
| Query Performance | HIGH | PostgreSQL docs + verified case studies |
| Race Conditions | MEDIUM-HIGH | React docs + multiple implementation guides |
| CORS Issues | MEDIUM-HIGH | Next.js docs + library-specific issues |
| Memory Leaks | MEDIUM | Supabase community reports + React docs |
| Server Actions Limits | MEDIUM | GitHub issues + community workarounds |

**Overall Assessment:** HIGH confidence in critical security pitfalls, MEDIUM-HIGH confidence in performance and implementation pitfalls. All findings cross-referenced with official documentation or verified community reports.

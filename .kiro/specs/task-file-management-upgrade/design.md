# Task & File Management Upgrade — Bugfix Design

## Overview

The Task Management and File Management modules are broken due to invalid Supabase foreign key join hints (`profiles!tasks_assigned_to_fkey` and `profiles!files_uploaded_by_fkey`) that do not exist in the actual schema. This causes both `useTasks` and `useFiles` to fail on every load. Compounding this, the `tasks` table is missing a `priority` column, the `TaskFormModal` has stale state on reopen, file uploads always associate to the wrong project, download/delete operations crash on null `storage_path`, client-scoping silently falls through, and status updates have no optimistic UI feedback.

The fix strategy is: correct the broken queries first (unblocking all downstream functionality), add the missing `priority` column via migration, then address each UI/UX defect in isolation. All admin-visible data and existing non-broken behaviors must be preserved throughout.

---

## Glossary

- **Bug_Condition (C)**: The set of inputs or states that trigger a defective behavior — e.g., any call to `useTasks()` while the broken FK hint is present in the query string
- **Property (P)**: The desired correct behavior for inputs satisfying C — e.g., `useTasks()` returns task data without error
- **Preservation**: Behaviors that must remain unchanged by the fix — e.g., admin users continue to see all tasks across all projects
- **`useTasks`**: The React Query hook in `src/hooks/use-database.ts` that fetches tasks from Supabase
- **`useFiles`**: The React Query hook in `src/hooks/use-database.ts` that fetches files from Supabase
- **`TaskFormModal`**: The dialog component in `src/components/FormModals.tsx` used to create and edit tasks
- **`storage_path`**: The nullable column in the `files` table that stores the Supabase Storage object path
- **FK hint**: The `table!foreign_key_name(columns)` syntax in Supabase PostgREST queries used to disambiguate joins — broken when the named FK does not exist
- **Optimistic update**: Updating local React Query cache immediately on user action, before the async DB call resolves
- **Client-scoping**: Filtering query results to only include records belonging to the authenticated client's projects

---

## Bug Details

### Bug Condition

The primary bug manifests on every page load for Tasks and Files: the Supabase queries use FK hint syntax referencing foreign keys (`tasks_assigned_to_fkey`, `files_uploaded_by_fkey`) that do not exist in the database schema. The `tasks` table has no FK from `assigned_to_id` to `profiles` (it references `auth.users`), and the `files` table has no FK to `profiles` at all. PostgREST rejects these hints and returns an error, causing both hooks to throw and the pages to show infinite spinners.

Secondary bugs are independent defects that are unmasked or exist alongside the primary:

**Formal Specification — Primary (Query Failure):**
```
FUNCTION isBugCondition_queryFailure(hook)
  INPUT: hook is one of [useTasks, useFiles]
  OUTPUT: boolean

  RETURN hook.queryString CONTAINS 'profiles!tasks_assigned_to_fkey'
      OR hook.queryString CONTAINS 'profiles!files_uploaded_by_fkey'
END FUNCTION
```

**Formal Specification — Secondary (Null storage_path):**
```
FUNCTION isBugCondition_nullStoragePath(action, file)
  INPUT: action IN ['download', 'delete'], file of type FileItem
  OUTPUT: boolean

  RETURN file.storage_path IS NULL
      AND action IN ['download', 'delete']
END FUNCTION
```

**Formal Specification — Stale Modal State:**
```
FUNCTION isBugCondition_staleModal(modal, openCount)
  INPUT: modal is TaskFormModal with initialData, openCount >= 2
  OUTPUT: boolean

  RETURN modal.formState REFLECTS initialData AT openCount=1
      AND modal.formState DOES NOT REFLECT initialData AT openCount >= 2
END FUNCTION
```

**Formal Specification — Wrong Project on Upload:**
```
FUNCTION isBugCondition_uploadProject(selectedProjectId, usedProjectId)
  INPUT: selectedProjectId chosen by user, usedProjectId = projects[0].id
  OUTPUT: boolean

  RETURN selectedProjectId != usedProjectId
END FUNCTION
```

### Examples

- **Task fetch**: Admin loads `/tasks` → `useTasks` fires query with `profiles!tasks_assigned_to_fkey(full_name)` → Supabase returns 400 error → page shows infinite spinner instead of task list
- **File fetch**: Any user loads `/files` → `useFiles` fires query with `profiles!files_uploaded_by_fkey(full_name)` → Supabase returns 400 error → page shows empty state (misleadingly, not an error state)
- **Download null path**: User clicks Download on a file where `storage_path = null` → `createSignedUrl(null, 60)` throws → unhandled error, no user feedback
- **Delete null path**: Admin clicks Delete on file with `storage_path = null` → `storage.remove([null])` silently fails → DB record deleted but storage object (if any) not cleaned up
- **Stale modal**: User edits Task A (title "Alpha"), closes modal, opens edit for Task B (title "Beta") → modal still shows "Alpha" in title field
- **Wrong upload project**: User has 3 projects, uploads a file intending it for Project C → file is associated with Project A (index 0) instead
- **Priority not persisted**: User sets priority "urgent" on a task → `tasks` table has no `priority` column → insert silently drops the value → task card shows "medium" (default fallback)
- **Client scoping fallthrough**: Client user's `clients` record lookup returns null (e.g., RLS issue) → `useTasks` falls through without filtering → client may see all tasks

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Admin users (`role = 'admin'` or `'super_admin'`) continue to see all tasks across all projects with no filtering applied
- Admin users continue to see all files across all projects and retain delete access on any file
- Task creation via `TaskFormModal` continues to persist title, project, status, assignee, due date, and description to the database
- Project creation and member assignment via `ProjectFormModal` is completely unaffected
- File upload continues to store the file object in the `project-files` Supabase Storage bucket and insert a metadata record in the `files` table
- The "All" status filter continues to show every task regardless of status
- Subtask progress indicators (done/total count and progress bar) continue to render correctly on task cards
- Overdue due dates (past date, status ≠ done) continue to render in red on task cards
- Keyword search continues to filter tasks by title and description match
- AppLayout, navigation, and all other pages (Dashboard, Projects, Clients, Invoices, Messages, Team) are completely unaffected

**Scope:**
All inputs that do NOT involve the broken FK hint queries, null `storage_path` operations, or the specific modal/upload flows described above should be completely unaffected by this fix. This includes:
- All project CRUD operations
- Invoice management
- Messaging
- Notification reads
- Authentication flows

---

## Hypothesized Root Cause

1. **Invalid FK hint in `useTasks` query**: The query uses `profiles!tasks_assigned_to_fkey(full_name)` but the `tasks` table's `assigned_to_id` column references `auth.users`, not `profiles`. There is no FK named `tasks_assigned_to_fkey` in the schema. The correct approach is either a plain `profiles(name)` join (if a FK to profiles exists) or a separate lookup, or removing the join entirely and resolving assignee names client-side from the already-fetched team members list.

2. **Invalid FK hint in `useFiles` query**: The query uses `profiles!files_uploaded_by_fkey(full_name)` but the `files` table's `uploaded_by` column references `auth.users`, not `profiles`. Same resolution: remove the hint or use a valid join path.

3. **Missing `priority` column on `tasks` table**: The original migration (`20260404091444_...sql`) creates the `tasks` table without a `priority` column. The application code writes `priority` on insert/update, but the column doesn't exist, so the value is silently dropped by PostgREST. Fix: add a new migration that adds `priority TEXT NOT NULL DEFAULT 'medium'` to the `tasks` table.

4. **`TaskFormModal` form state not re-initialized on reopen**: The `useState` initializer for `form` runs only once on component mount. When `initialData` changes (different task opened), the state is not reset. Fix: add a `useEffect` that watches `[open, initialData]` and resets form state when the modal opens.

5. **File upload hardcodes `projects?.[0]`**: The upload handler in `Files.tsx` picks the first project in the list as a fallback. Fix: add a project selector `<Select>` to the upload flow (either inline or in a small dialog) so the user explicitly picks the target project.

6. **Null `storage_path` not guarded in download/delete**: Both `handleDownload` and `handleDelete` pass `f.fileUrl` (which maps from `storage_path`) directly to Supabase Storage without null-checking. Fix: guard both handlers with an early return and error toast when `storage_path` is null.

7. **Client scoping silent fallthrough**: When the `clients` lookup returns null (no matching record), `useTasks` and `useFiles` skip the `in` filter entirely and return all records. Fix: when client lookup returns null, return an empty array immediately rather than falling through.

8. **No optimistic update on status change**: `updateTaskStatus` in `Tasks.tsx` calls `refetch()` after the DB update, causing a full round-trip before the UI updates. Fix: use `queryClient.setQueryData` to update the task's status in the cache immediately, then revert on error.

---

## Correctness Properties

Property 1: Bug Condition — Query Execution Without FK Hint Errors

_For any_ authenticated user (admin, team, or client), calling `useTasks()` or `useFiles()` SHALL execute the Supabase query successfully (no 400/PostgREST error) and return an array of records (empty or populated) without throwing.

**Validates: Requirements 2.1, 2.9**

Property 2: Preservation — Admin Sees All Tasks

_For any_ admin user, `useTasks()` SHALL return tasks from all projects without any `project_id` or `assigned_to_id` filter applied, preserving the full unfiltered task list.

**Validates: Requirements 3.1**

Property 3: Preservation — Admin Sees All Files

_For any_ admin user, `useFiles()` SHALL return files from all projects without any `project_id` filter applied, preserving the full unfiltered file list.

**Validates: Requirements 3.2**

Property 4: Bug Condition — Client Task Scoping

_For any_ client user with a valid `clients` record, `useTasks()` SHALL return only tasks whose `project_id` is in the set of projects where `client_id` matches the client's record id. If no client record exists, it SHALL return an empty array.

**Validates: Requirements 2.6**

Property 5: Bug Condition — Client File Scoping

_For any_ client user with a valid `clients` record, `useFiles()` SHALL return only files whose `project_id` is in the set of projects belonging to that client. If no client record exists, it SHALL return an empty array.

**Validates: Requirements 2.13**

Property 6: Bug Condition — Null storage_path Download Guard

_For any_ file where `storage_path` is null, invoking `handleDownload` SHALL NOT call `supabase.storage.createSignedUrl` and SHALL display an error toast to the user.

**Validates: Requirements 2.11**

Property 7: Bug Condition — Null storage_path Delete Guard

_For any_ file where `storage_path` is null, invoking `handleDelete` SHALL skip `supabase.storage.remove()`, SHALL still delete the database record, and SHALL show a success toast.

**Validates: Requirements 2.12**

Property 8: Bug Condition — TaskFormModal State Reset on Reopen

_For any_ `initialData` object passed to `TaskFormModal`, every time the modal transitions from closed to open, all form fields SHALL reflect the current `initialData` values, with no stale values from a previous open.

**Validates: Requirements 2.8**

Property 9: Preservation — Search Filter Correctness

_For any_ non-empty search string `q`, the filtered task list SHALL contain only tasks where `task.title.toLowerCase().includes(q.toLowerCase())` OR `task.description.toLowerCase().includes(q.toLowerCase())` is true.

**Validates: Requirements 3.9**

Property 10: Bug Condition — Optimistic Status Update

_For any_ task status change triggered by the user, the task's status in the React Query cache SHALL be updated to the new value immediately (synchronously, before the DB call resolves), and SHALL revert to the original value if the DB call returns an error.

**Validates: Requirements 2.3**

---

## Fix Implementation

### Changes Required

**File 1: `src/hooks/use-database.ts`**

**Function**: `useTasks`

**Specific Changes**:
1. **Remove broken FK hint**: Replace `profiles!tasks_assigned_to_fkey(full_name)` with a plain `profiles(name)` join — but since `assigned_to_id` references `auth.users` (not `profiles`), the safest fix is to remove the profiles join entirely from the select string and resolve assignee names client-side using the already-available team members data. Query becomes: `supabase.from('tasks').select('*, subtasks(*)')`.
2. **Fix client scoping fallthrough**: When `client` lookup returns null, immediately `return []` instead of falling through to an unfiltered query.
3. **Map `priority` field**: Ensure the mapper reads `d.priority` from the response (will work once migration adds the column).

**Function**: `useFiles`

**Specific Changes**:
1. **Remove broken FK hint**: Replace `profiles!files_uploaded_by_fkey(full_name)` with no join. Uploader name can be resolved client-side or omitted. Query becomes: `supabase.from('files').select('*')`.
2. **Fix client scoping fallthrough**: Same pattern as `useTasks` — return `[]` when client lookup returns null.

---

**File 2: `src/pages/Tasks.tsx`**

**Function**: `updateTaskStatus`

**Specific Changes**:
1. **Add optimistic update**: Before the `supabase.update()` call, use `queryClient.setQueryData(['tasks', ...])` to update the task's status in cache immediately.
2. **Add revert on error**: In the catch block, call `queryClient.setQueryData` again to restore the original status.
3. **Remove `refetch()` on success**: The optimistic update makes the explicit refetch redundant for the status field; invalidate the query instead to sync any other changed fields.

---

**File 3: `src/components/FormModals.tsx`**

**Function**: `TaskFormModal`

**Specific Changes**:
1. **Add `useEffect` for state reset**: Add `useEffect(() => { if (open && initialData) { setForm({ title: initialData.title, ... }) } }, [open, initialData])` so form state is always re-initialized when the modal opens.

---

**File 4: `src/pages/Files.tsx`**

**Function**: `handleUpload`

**Specific Changes**:
1. **Add project selector state**: Add `const [selectedProjectId, setSelectedProjectId] = useState('')` and a `<Select>` component in the upload UI for the user to pick a project before uploading.
2. **Use selected project**: Replace `projects?.[0]` with the `selectedProjectId` value.
3. **Guard on no selection**: If `selectedProjectId` is empty, show an error toast and abort.

**Function**: `handleDownload`

**Specific Changes**:
1. **Null guard**: Add `if (!fileUrl) { toast({ variant: 'destructive', ... }); return; }` at the top of the handler.

**Function**: `handleDelete`

**Specific Changes**:
1. **Conditional storage delete**: Wrap `supabase.storage.from('project-files').remove([fileUrl])` in `if (fileUrl)` — always proceed with the DB delete regardless.

---

**File 5: New migration file**

**Path**: `supabase/migrations/{timestamp}_add_priority_to_tasks.sql`

**Specific Changes**:
1. **Add priority column**: `ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));`
2. **Add assigned_to_id column** (if not present in live DB): `ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;` — the original migration only has `assignee_id`, the app code uses `assigned_to_id`.

---

**File 6: `src/integrations/supabase/types.ts`**

**Specific Changes**:
1. **Add `priority` to tasks Row/Insert/Update**: Add `priority: string` to the `tasks` table type definitions so TypeScript is aware of the new column.

---

## Testing Strategy

### Validation Approach

Testing follows two phases: first run exploratory tests against the **unfixed** code to confirm the root cause and surface counterexamples, then run fix-checking and preservation tests against the **fixed** code.

---

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug on unfixed code. Confirm or refute root cause hypotheses.

**Test Plan**: Mock the Supabase client and simulate the exact query strings used by `useTasks` and `useFiles`. Assert that the broken FK hint causes a query error. Also simulate null `storage_path` scenarios and modal reopen sequences.

**Test Cases**:
1. **Task query FK hint test**: Call `useTasks()` with the current broken query string → assert the response contains a PostgREST error (will fail on unfixed code, confirming root cause 1)
2. **File query FK hint test**: Call `useFiles()` with the current broken query string → assert the response contains a PostgREST error (will fail on unfixed code, confirming root cause 2)
3. **Null storage_path download**: Call `handleDownload(null, 'file.pdf')` → assert `createSignedUrl` is called with null (will demonstrate the crash on unfixed code)
4. **Stale modal reopen**: Render `TaskFormModal` with `initialData={title: 'Alpha'}`, open, close, render with `initialData={title: 'Beta'}`, open again → assert form title is still "Alpha" (will fail on unfixed code)
5. **Client scoping fallthrough**: Mock `clients` lookup to return null → assert `useTasks` returns all tasks instead of empty array (will demonstrate the fallthrough on unfixed code)

**Expected Counterexamples**:
- `useTasks` and `useFiles` throw with message containing "Could not find a relationship" or HTTP 400
- `handleDownload` calls `createSignedUrl` with `null` as the path argument
- `TaskFormModal` form state retains previous `initialData` values on second open

---

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL user IN [admin, team_member, client_with_record, client_without_record] DO
  result := useTasks_fixed(user)
  ASSERT result.error IS NULL
  ASSERT result.data IS ARRAY
END FOR

FOR ALL file WHERE file.storage_path IS NULL DO
  handleDownload_fixed(file.storage_path, file.name)
  ASSERT createSignedUrl WAS NOT CALLED
  ASSERT errorToast WAS SHOWN
END FOR

FOR ALL initialData IN [taskA, taskB, taskC] DO
  openModal(initialData)
  closeModal()
  openModal(differentInitialData)
  ASSERT form.title = differentInitialData.title
END FOR
```

---

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL adminUser DO
  ASSERT useTasks_original(adminUser).projectIds = useTasks_fixed(adminUser).projectIds
  ASSERT useFiles_original(adminUser).projectIds = useFiles_fixed(adminUser).projectIds
END FOR

FOR ALL searchQuery IN generateRandomStrings() DO
  ASSERT filter_original(tasks, searchQuery) = filter_fixed(tasks, searchQuery)
END FOR

FOR ALL task WHERE task.subtasks.length > 0 DO
  ASSERT taskCard_fixed(task).progressBar.value = (subtasksDone / subtasksTotal) * 100
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random admin users, search strings, and task configurations automatically
- It catches edge cases (empty search, all-done subtasks, zero subtasks) that manual tests miss
- It provides strong guarantees that admin visibility and search behavior are unchanged

**Test Cases**:
1. **Admin task visibility preservation**: Generate random sets of tasks across multiple projects → verify admin sees all of them after fix
2. **Search filter preservation**: Generate random task arrays and search strings → verify filtered results are identical before and after fix
3. **Subtask progress preservation**: Generate tasks with varying subtask completion states → verify progress bar values are unchanged
4. **File delete with valid path preservation**: Files with non-null `storage_path` → verify both storage and DB delete still execute

---

### Unit Tests

- Test `useTasks` query string does not contain any FK hint syntax after fix
- Test `useFiles` query string does not contain any FK hint syntax after fix
- Test `handleDownload` with null path shows error toast and does not call `createSignedUrl`
- Test `handleDelete` with null path skips `storage.remove` but still calls `files.delete`
- Test `TaskFormModal` re-initializes form state on each open with new `initialData`
- Test client scoping returns empty array when `clients` lookup returns null
- Test `updateTaskStatus` applies optimistic update to cache before DB call resolves
- Test `updateTaskStatus` reverts cache on DB error

### Property-Based Tests

- Generate random authenticated users across all roles → `useTasks()` always returns array (never throws) after fix
- Generate random admin users → task list always equals full unfiltered set (preservation of admin visibility)
- Generate random search strings including empty, whitespace, special chars → filtered list always satisfies containment predicate
- Generate random file objects with null/non-null `storage_path` → download/delete handlers always behave correctly per null-guard rules
- Generate random `initialData` objects → `TaskFormModal` always shows correct field values on open

### Integration Tests

- Full task page load as admin: page renders task list with project names, assignee names, priority badges, status badges, subtask progress
- Full task page load as client: page renders only tasks from client's projects; other projects' tasks are absent
- Status update flow: click "Mark as Done" → task card immediately shows "Done" badge (optimistic) → DB confirms → no revert
- File upload flow: project selector appears → user selects project → file uploads → file appears in list associated with correct project
- File download with valid path: signed URL generated and opened in new tab
- File download with null path: error toast shown, no navigation
- File delete as admin with null path: DB record removed, success toast, no storage error surfaced to user
- TaskFormModal edit flow: open Task A → close → open Task B → all fields show Task B's values

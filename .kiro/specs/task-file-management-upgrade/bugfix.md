# Bugfix Requirements Document

## Introduction

The Task Management and File Management modules in this SaaS application are currently broken or incomplete. Tasks are not properly fetched, filtered, or updated. The file system relies on static/mock data and lacks real upload, download, and delete functionality. Role-based access for both Admin and Client roles is inconsistently enforced. This document captures the defective behaviors, the correct behaviors they must be replaced with, and the existing behaviors that must be preserved throughout the fix.

---

## Bug Analysis

### Current Behavior (Defect)

**Task Management**

1.1 WHEN the Tasks page loads THEN the system fails to display tasks because `useTasks` queries a non-existent foreign key join (`profiles!tasks_assigned_to_fkey`) causing a Supabase query error

1.2 WHEN a user applies a status filter (To Do / In Progress / Done) THEN the system does not correctly filter tasks because the filter state is client-side only and breaks when the data fetch itself fails

1.3 WHEN a user clicks "Mark as To Do", "Mark as In Progress", or "Mark as Done" THEN the system updates the database but the UI does not reflect the change instantly because `refetch()` triggers a full re-fetch with no optimistic update

1.4 WHEN a task is created or edited via the TaskFormModal THEN the system writes `assigned_to_id` and `assigned_to` as separate fields but the database schema only has `assigned_to_id` (and legacy `assignee_id`), causing silent data inconsistency

1.5 WHEN a task has `priority` set THEN the system fails to display it because the `tasks` table schema has no `priority` column and the value is never persisted

1.6 WHEN a Client user views the Tasks page THEN the system may show tasks from projects not belonging to that client because the client-scoping logic in `useTasks` silently falls through if the client record lookup fails

1.7 WHEN there are no tasks matching the current filter THEN the system shows the empty state correctly, but only after a successful fetch — if the fetch errors, the page shows a perpetual loading spinner

1.8 WHEN the TaskFormModal is opened for editing THEN the system does not re-initialize form state from `initialData` when the modal is reopened after a previous edit, showing stale values

**File Management**

1.9 WHEN the Files page loads THEN the system attempts to join `profiles!files_uploaded_by_fkey` which does not exist in the current schema, causing the file fetch query to fail silently and show no files

1.10 WHEN a user uploads a file THEN the system always uploads to the first project in the list (`projects?.[0]`) regardless of which project the user intends, making project association incorrect

1.11 WHEN a user clicks Download THEN the system passes `f.fileUrl` (mapped from `storage_path`) to `createSignedUrl`, but `storage_path` may be null for older records, causing the download to fail with no user feedback

1.12 WHEN an Admin deletes a file THEN the system attempts to remove the storage object using `f.fileUrl` which may be null or undefined, causing the storage delete to silently fail while the database record is still removed

1.13 WHEN a Client user views the Files page THEN the system may expose files from projects not belonging to that client if the client record lookup in `useFiles` fails or returns no client

1.14 WHEN no files exist THEN the system shows the empty state, but if the fetch query errors (due to the broken join), the empty state is shown misleadingly as if there are simply no files rather than an error

---

### Expected Behavior (Correct)

**Task Management**

2.1 WHEN the Tasks page loads THEN the system SHALL fetch tasks successfully using a valid query that joins assignee profile data via `profiles` on `assigned_to_id`, and display all tasks for the current user's role

2.2 WHEN a user applies a status filter THEN the system SHALL correctly filter the displayed task list client-side from the successfully fetched data, showing only tasks matching the selected status

2.3 WHEN a user clicks a status action button THEN the system SHALL apply an optimistic UI update immediately (updating local state before the DB call resolves) and confirm with a toast on success or revert on error

2.4 WHEN a task is created or edited THEN the system SHALL write only `assigned_to_id` to the database (removing the redundant `assigned_to` field write) and correctly associate the assignee

2.5 WHEN a task has a priority value THEN the system SHALL persist `priority` to the database via a migration adding the `priority` column to the `tasks` table, and display it correctly in the task card

2.6 WHEN a Client user views the Tasks page THEN the system SHALL show only tasks belonging to projects where `client_id` matches the authenticated client's record, and show an empty state if no client record is found

2.7 WHEN a fetch error occurs on the Tasks page THEN the system SHALL display an error state with a retry option instead of an infinite loading spinner

2.8 WHEN the TaskFormModal is opened for editing THEN the system SHALL re-initialize all form fields from the latest `initialData` on each open, ensuring no stale values are shown

**File Management**

2.9 WHEN the Files page loads THEN the system SHALL fetch files using a valid query (without the broken foreign key hint) and display all files the current user is authorized to see

2.10 WHEN a user uploads a file THEN the system SHALL present a project selector in the upload flow so the user explicitly chooses which project the file belongs to before upload proceeds

2.11 WHEN a user clicks Download THEN the system SHALL generate a signed URL from the `storage_path` value, handle null/missing paths gracefully with a user-facing error toast, and open the signed URL in a new tab

2.12 WHEN an Admin deletes a file THEN the system SHALL only attempt storage deletion if `storage_path` is non-null, delete the database record regardless, and show a success or error toast

2.13 WHEN a Client user views the Files page THEN the system SHALL show only files from projects belonging to that client, and show an empty state if no matching projects or files are found

2.14 WHEN a fetch error occurs on the Files page THEN the system SHALL display a visible error message distinguishing a fetch failure from a genuinely empty file list

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an Admin user views the Tasks page THEN the system SHALL CONTINUE TO show all tasks across all projects without any role-based filtering

3.2 WHEN an Admin user views the Files page THEN the system SHALL CONTINUE TO show all files across all projects and retain the ability to delete any file

3.3 WHEN a user creates a new task via the TaskFormModal THEN the system SHALL CONTINUE TO save the task to the database with title, project, status, priority, assignee, due date, and description fields

3.4 WHEN a user creates a new project via the ProjectFormModal THEN the system SHALL CONTINUE TO function without any changes to project creation or member assignment logic

3.5 WHEN a user uploads a file THEN the system SHALL CONTINUE TO store the file in the `project-files` Supabase storage bucket and record metadata in the `files` table

3.6 WHEN the status filter is set to "All" THEN the system SHALL CONTINUE TO display every task regardless of status

3.7 WHEN a task has subtasks THEN the system SHALL CONTINUE TO display the subtask progress indicator (done/total count and progress bar) on the task card

3.8 WHEN a task's due date is in the past and the task is not done THEN the system SHALL CONTINUE TO highlight the due date in red on the task card

3.9 WHEN a user searches tasks by keyword THEN the system SHALL CONTINUE TO filter the task list by title and description match

3.10 WHEN the AppLayout and navigation are rendered THEN the system SHALL CONTINUE TO function without layout regressions across all pages (Dashboard, Projects, Clients, Invoices, Messages, Team)

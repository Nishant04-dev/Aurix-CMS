# ✅ SYSTEM STABILIZATION VERIFICATION CHECKLIST

**Date:** April 17, 2026  
**Version:** 2.1.0-stabilization

---

## 🔍 PRE-DEPLOYMENT VERIFICATION

### Database State Check

Run these SQL queries in Supabase SQL Editor:

```sql
-- ✅ CHECK 1: Unique constraint exists
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'roles' 
  AND constraint_name = 'roles_org_id_name_key';
-- Expected: 1 row with constraint_type = 'UNIQUE'

-- ✅ CHECK 2: No duplicate roles
SELECT org_id, name, COUNT(*) as count
FROM public.roles 
GROUP BY org_id, name 
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- ✅ CHECK 3: RPC function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'provision_new_organization';
-- Expected: 1 row with routine_type = 'FUNCTION'

-- ✅ CHECK 4: All permissions exist
SELECT COUNT(*) as permission_count 
FROM public.permissions 
WHERE key IN (
  'cancel_project', 'create_client', 'create_project',
  'delete_client', 'delete_file', 'delete_project',
  'delete_user', 'edit_client', 'edit_project',
  'edit_user', 'invite_user', 'manage_clients',
  'manage_invoices', 'manage_roles', 'manage_users',
  'upload_file', 'view_client', 'view_file',
  'view_invoices', 'view_project'
);
-- Expected: 20 rows
```

---

## 🚀 POST-DEPLOYMENT VERIFICATION

### 1. Backend Health Check

```bash
# Test backend is reachable
curl https://your-backend-url/api/ping

# Expected response:
{
  "success": true,
  "message": "Aurix backend is running",
  "version": "2.1.0-stabilization",
  "env": "production",
  "timestamp": "2026-04-17T..."
}
```

**Status:** [ ] PASS / [ ] FAIL

---

### 2. Org Creation Test

**Steps:**
1. Create new user account
2. Choose "Business Account"
3. Enter org name: "Test Org Stabilization"
4. Click "Create Organization"

**Expected Results:**
- [ ] Org created successfully
- [ ] No error messages
- [ ] Redirected to dashboard immediately
- [ ] Can see org name in header
- [ ] Can access all features (projects, clients, etc.)

**Verify in Database:**
```sql
SELECT o.id, o.name, o.is_initialized, o.status,
       COUNT(DISTINCT r.id) as role_count,
       COUNT(DISTINCT rp.id) as permission_count,
       m.role as owner_role
FROM public.organizations o
LEFT JOIN public.roles r ON r.org_id = o.id AND r.is_system = true
LEFT JOIN public.role_permissions rp ON rp.org_id = o.id
LEFT JOIN public.memberships m ON m.org_id = o.id AND m.user_id = o.owner_id
WHERE o.name = 'Test Org Stabilization'
GROUP BY o.id, o.name, o.is_initialized, o.status, m.role;

-- Expected:
-- is_initialized = true
-- status = 'approved'
-- role_count = 5
-- permission_count > 0
-- owner_role = 'super_admin'
```

**Status:** [ ] PASS / [ ] FAIL

---

### 3. Org Creation Idempotency Test

**Steps:**
1. Try to create org with same name again
2. Should either:
   - Return existing org (idempotent)
   - Show clear error message

**Expected Results:**
- [ ] No duplicate org created
- [ ] No partial org in database
- [ ] Clear error or success message

**Status:** [ ] PASS / [ ] FAIL

---

### 4. Owner Role Test

**Steps:**
1. Login as org owner
2. Check role in profile dropdown
3. Try to access admin features (Team, Roles)

**Expected Results:**
- [ ] Role shows as "Super Admin"
- [ ] Can access Team page
- [ ] Can access Roles page
- [ ] Can create/edit roles
- [ ] Can invite users

**Verify in Database:**
```sql
SELECT p.email, p.role as profile_role, m.role as membership_role, r.name as role_name
FROM public.profiles p
JOIN public.memberships m ON m.user_id = p.id
LEFT JOIN public.roles r ON r.id = m.role_id
WHERE p.email = 'test-user@example.com';

-- Expected:
-- membership_role = 'super_admin'
-- role_name = 'Super Admin'
```

**Status:** [ ] PASS / [ ] FAIL

---

### 5. Org Switching Test

**Steps:**
1. Create second org for same user
2. Switch to second org via org switcher
3. Check projects list
4. Switch back to first org
5. Check projects list again

**Expected Results:**
- [ ] Projects list updates after switch
- [ ] No stale data from previous org
- [ ] Correct org name in header
- [ ] All data belongs to current org

**Browser Console Check:**
```
Look for log message:
"[auth] Invalidated org-scoped queries after org switch"
```

**Status:** [ ] PASS / [ ] FAIL

---

### 6. Platform Owner Test

**Steps:**
1. Login as platform owner (info.nishantchauhan@gmail.com)
2. Access platform panel (/platform/overview)
3. Switch to different org
4. Try to access platform panel again

**Expected Results:**
- [ ] Can access platform panel initially
- [ ] Can switch to different org
- [ ] Can still access platform panel after switch
- [ ] Role always shows as "Super Admin"
- [ ] Power level always 100

**Verify in Database:**
```sql
SELECT id, email, is_platform_owner, role, power_level, org_id
FROM public.profiles
WHERE email = 'info.nishantchauhan@gmail.com';

-- Expected:
-- is_platform_owner = true
-- role = 'super_admin'
-- power_level = 100
```

**Status:** [ ] PASS / [ ] FAIL

---

### 7. Role Consistency Test

**Steps:**
1. Create new user in org
2. Assign role "Manager" via Team page
3. Login as that user
4. Check what features they can access

**Expected Results:**
- [ ] User has Manager role
- [ ] Can access manager features
- [ ] Cannot access admin features
- [ ] Role is consistent across all pages

**Verify in Database:**
```sql
SELECT p.email, m.role as membership_role, r.name as role_name, r.power_level
FROM public.profiles p
JOIN public.memberships m ON m.user_id = p.id
LEFT JOIN public.roles r ON r.id = m.role_id
WHERE p.email = 'manager-test@example.com';

-- Expected:
-- membership_role = 'manager'
-- role_name = 'Manager'
-- power_level = 60
```

**Status:** [ ] PASS / [ ] FAIL

---

### 8. Permission System Test

**Steps:**
1. Login as user with limited role (Staff)
2. Try to access Team page
3. Try to access Roles page
4. Try to create project

**Expected Results:**
- [ ] Cannot access Team page (redirected)
- [ ] Cannot access Roles page (redirected)
- [ ] Can or cannot create project based on permissions

**Verify in Database:**
```sql
SELECT r.name, p.key as permission
FROM public.roles r
JOIN public.role_permissions rp ON rp.role_id = r.id
JOIN public.permissions p ON p.key = rp.permission_key
WHERE r.name = 'Staff'
ORDER BY p.key;

-- Expected: Only limited permissions
```

**Status:** [ ] PASS / [ ] FAIL

---

## 🐛 KNOWN ISSUES TO WATCH FOR

### Issue 1: Org Creation Fails
**Symptoms:**
- Error message on org creation
- Partial org in database
- User stuck on onboarding

**Debug Steps:**
1. Check backend logs: `pm2 logs aurix-backend`
2. Check database: `SELECT * FROM organizations WHERE is_initialized = false;`
3. Check RPC function: `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'provision_new_organization';`

**Fix:**
- Verify migration was applied
- Check all permissions exist
- Verify unique constraint exists

---

### Issue 2: Role Mismatch
**Symptoms:**
- User sees wrong role
- Permission checks fail
- Can't access features they should have

**Debug Steps:**
1. Check memberships: `SELECT * FROM memberships WHERE user_id = '...';`
2. Check profiles: `SELECT role, role_id FROM profiles WHERE id = '...';`
3. Check auth middleware logs

**Fix:**
- Verify memberships.role is set correctly
- Verify auth middleware uses memberships.role
- Check role_id is not null

---

### Issue 3: Org Switching Shows Stale Data
**Symptoms:**
- Projects from old org shown after switch
- Wrong org name in header
- Data doesn't update

**Debug Steps:**
1. Check browser console for invalidation log
2. Check queryClient is global: `console.log(window.queryClient)`
3. Check setActiveOrg is called

**Fix:**
- Verify queryClient is global
- Verify invalidateQueries is called
- Clear browser cache

---

### Issue 4: Platform Owner Can't Access Platform Panel
**Symptoms:**
- Redirected to dashboard
- "Access denied" message
- Platform routes not working

**Debug Steps:**
1. Check is_platform_owner: `SELECT is_platform_owner FROM profiles WHERE email = '...';`
2. Check auth middleware logs
3. Check requirePlatformOwner middleware

**Fix:**
- Verify is_platform_owner = true
- Verify auth middleware sets isPlatformOwner
- Check platform routes are protected correctly

---

## 📊 PERFORMANCE CHECKS

### Database Query Performance

```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Backend Response Times

```bash
# Test API response time
time curl https://your-backend-url/api/ping

# Expected: < 200ms
```

### Frontend Load Time

```bash
# Test frontend load time
curl -w "@curl-format.txt" -o /dev/null -s https://aurix-cms.vercel.app

# Expected: < 2s
```

---

## ✅ FINAL SIGN-OFF

**All checks passed:** [ ] YES / [ ] NO

**Issues found:** [ ] NONE / [ ] SEE BELOW

**Issues:**
1. _______________________________________
2. _______________________________________
3. _______________________________________

**Deployment approved by:** _______________________

**Date:** _______________________

**Notes:**
_____________________________________________
_____________________________________________
_____________________________________________

---

## 🆘 ROLLBACK PROCEDURE

If critical issues found:

1. **Rollback Database:**
```sql
-- Remove unique constraint
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_org_id_name_key;

-- Restore old RPC (if backup exists)
-- CREATE OR REPLACE FUNCTION public.provision_new_organization...
```

2. **Rollback Backend:**
```bash
cd backend
git checkout 1940c63  # Previous commit
pm2 restart aurix-backend
```

3. **Rollback Frontend:**
```bash
git revert f193396
git push origin main
# Wait for Vercel to deploy
```

4. **Notify Team:**
- Post in Slack/Discord
- Update status page
- Email affected users

---

**END OF CHECKLIST**

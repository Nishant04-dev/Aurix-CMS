import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, Check, Loader2, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useOrgSettings } from '@/hooks/use-org-settings';

interface OrgOption {
  org_id: string;
  org_name: string;
  org_logo: string | null;
  org_plan: string;
  role: string;
  is_owner: boolean;
}

// All query keys that are scoped to the active org.
// Invalidated on every org switch so data re-fetches for the new org.
const ORG_SCOPED_KEYS = [
  'projects', 'tasks', 'invoices', 'quotations', 'clients',
  'files', 'messages', 'notifications', 'audit-logs', 'roles',
  'users', 'taxes', 'templates', 'plan_limits', 'org_settings',
  'channels', 'invitations', 'members',
];

export function OrgSwitcher() {
  const { orgId, refreshUser, setActiveOrg } = useAuth();
  const { settings } = useOrgSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);

  const { data: orgs = [] } = useQuery<OrgOption[]>({
    queryKey: ['user_orgs'],
    queryFn: () => api.get<OrgOption[]>('/organizations/mine'),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const currentOrgName = settings?.name ?? orgs.find(o => o.org_id === orgId)?.org_name;

  if (!orgId && orgs.length === 0) return null;
  const displayName = currentOrgName ?? orgs[0]?.org_name;
  if (!displayName) return null;

  const otherOrgs = orgs.filter(o => o.org_id !== (orgId ?? orgs[0]?.org_id));

  const handleSwitch = async (org: OrgOption) => {
    if (switching) return;
    setSwitching(true);
    try {
      // 1. Backend is source of truth — update profile.org_id first
      await api.post('/organizations/switch', { org_id: org.org_id });

      // 2. Update local context immediately (localStorage + React state)
      setActiveOrg(org.org_id);

      // 3. Invalidate only org-scoped query keys — user_orgs list stays intact
      ORG_SCOPED_KEYS.forEach(key =>
        queryClient.invalidateQueries({ queryKey: [key] })
      );

      // 4. Re-fetch profile so role/plan reflect the new org
      await refreshUser();

      // 5. Emit global event for any downstream listeners (websockets, analytics, etc.)
      window.dispatchEvent(new CustomEvent('aurix:org-switched', {
        detail: { org_id: org.org_id, org_name: org.org_name },
      }));

      toast({ title: `Switched to ${org.org_name}` });
    } catch (err: any) {
      // Backend failed — do NOT update local state (already handled: setActiveOrg
      // was called after the API succeeded, so if API throws we never reach it)
      toast({ variant: 'destructive', title: 'Switch failed', description: err.message });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={switching}>
        <button
          disabled={switching}
          className="hidden md:flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border/50 rounded-full px-2.5 py-1 bg-muted/30 hover:bg-accent transition-colors max-w-[200px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {switching
            ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
            : <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          }
          <span className="truncate flex-1">{switching ? 'Switching…' : displayName}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Switch Organization
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Current org — always shown, non-interactive */}
        <DropdownMenuItem className="flex items-center gap-3 py-2.5 opacity-60 cursor-default" disabled>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground">Current</p>
          </div>
          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
        </DropdownMenuItem>

        {/* Other orgs */}
        {otherOrgs.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {otherOrgs.map(org => (
              <DropdownMenuItem
                key={org.org_id}
                onClick={() => handleSwitch(org)}
                disabled={switching}
                className="flex items-center gap-3 cursor-pointer py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold shrink-0 overflow-hidden">
                  {org.org_logo
                    ? <img src={org.org_logo} alt={org.org_name} className="h-full w-full object-cover" />
                    : org.org_name.charAt(0).toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{org.org_name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {org.is_owner ? 'Owner' : org.role} · {org.org_plan}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* Create new org */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/create-org')}
          disabled={switching}
          className="flex items-center gap-3 cursor-pointer py-2.5 text-primary disabled:opacity-50"
        >
          <div className="h-8 w-8 rounded-lg border-2 border-dashed border-primary/30 flex items-center justify-center shrink-0">
            <Plus className="h-4 w-4 text-primary/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Create new organization</p>
            <p className="text-[10px] text-muted-foreground">Add another workspace</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, Check, Loader2, Building2, Plus } from 'lucide-react';
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
    staleTime: 0,          // always fetch fresh — security critical
    gcTime: 0,             // don't keep in cache after unmount
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Use org settings name (already loaded) as primary, fallback to org list
  const currentOrgName = settings?.name ?? orgs.find(o => o.org_id === orgId)?.org_name;

  // Don't render if no org at all
  if (!orgId && orgs.length === 0) return null;
  // If we have orgs but orgId isn't set yet, show first org name
  const displayName = currentOrgName ?? orgs[0]?.org_name;
  if (!displayName) return null;

  const otherOrgs = orgs.filter(o => o.org_id !== (orgId ?? orgs[0]?.org_id));

  const handleSwitch = async (org: OrgOption) => {
    if (switching) return;
    setSwitching(true);
    try {
      // 1. Tell backend to update profile.org_id (source of truth)
      await api.post('/organizations/switch', { org_id: org.org_id });

      // 2. Update local context immediately for instant UI response
      setActiveOrg(org.org_id);

      // 3. Invalidate only org-scoped queries — not user_orgs (switcher list stays intact)
      queryClient.invalidateQueries({ predicate: q => {
        const key = q.queryKey[0];
        // Keep user_orgs and platform queries; invalidate everything else (org data)
        return key !== 'user_orgs' && key !== 'platform';
      }});

      // 4. Re-fetch profile so role/plan reflect the new org
      await refreshUser();

      toast({ title: `Switched to ${org.org_name}` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Switch failed', description: err.message });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hidden md:flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border/50 rounded-full px-2.5 py-1 bg-muted/30 hover:bg-accent transition-colors max-w-[200px]">
          {switching
            ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
            : <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          }
          <span className="truncate flex-1">{displayName}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Switch Organization
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Current org */}
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

        {otherOrgs.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {otherOrgs.map(org => (
              <DropdownMenuItem
                key={org.org_id}
                onClick={() => handleSwitch(org)}
                className="flex items-center gap-3 cursor-pointer py-2.5"
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

        {/* Create new org — always visible */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/create-org')}
          className="flex items-center gap-3 cursor-pointer py-2.5 text-primary"
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

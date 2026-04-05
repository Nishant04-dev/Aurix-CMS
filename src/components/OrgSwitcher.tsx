import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, Check, Loader2, Building2 } from 'lucide-react';
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
  const { orgId, refreshUser } = useAuth();
  const { settings } = useOrgSettings();
  const { toast } = useToast();
  const [switching, setSwitching] = useState(false);

  const { data: orgs = [] } = useQuery<OrgOption[]>({
    queryKey: ['user_orgs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_user_organizations');
      if (error) {
        console.warn('get_user_organizations:', error.message);
        return [];
      }
      console.log('ALL ORGS:', data);
      return data || [];
    },
    staleTime: 60_000,
    retry: false,
  });

  // Use org settings name (already loaded) as primary, fallback to RPC result
  const currentOrgName = settings?.name ?? orgs.find(o => o.org_id === orgId)?.org_name;

  // Don't render if no org
  if (!orgId || !currentOrgName) return null;

  const otherOrgs = orgs.filter(o => o.org_id !== orgId);

  const handleSwitch = async (org: OrgOption) => {
    if (switching) return;
    setSwitching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ org_id: org.org_id, role: org.role })
        .eq('id', user?.id);
      if (error) throw error;
      await refreshUser();
      toast({ title: `Switched to ${org.org_name}` });
      window.location.reload();
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
          <span className="truncate flex-1">{currentOrgName}</span>
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
            {currentOrgName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{currentOrgName}</p>
            <p className="text-[10px] text-muted-foreground">Current</p>
          </div>
          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
        </DropdownMenuItem>

        {otherOrgs.length > 0 ? (
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
        ) : (
          <>
            <DropdownMenuSeparator />
            <div className="px-3 py-4 text-center">
              <Building2 className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No other organizations</p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

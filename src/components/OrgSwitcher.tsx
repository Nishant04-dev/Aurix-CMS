import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ChevronDown, Building2, Check, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [switching, setSwitching] = useState(false);

  const { data: orgs = [] } = useQuery<OrgOption[]>({
    queryKey: ['user_orgs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_user_organizations');
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // Only show if user belongs to more than one org
  if (orgs.length <= 1) return null;

  const current = orgs.find(o => o.org_id === orgId) ?? orgs[0];

  const handleSwitch = async (org: OrgOption) => {
    if (org.org_id === orgId || switching) return;
    setSwitching(true);
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ org_id: org.org_id, role: org.role })
        .eq('id', (await supabase.auth.getUser()).data.user?.id);
      if (error) throw error;
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
        <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border/50 rounded-full px-2.5 py-1 bg-muted/30 hover:bg-accent transition-colors max-w-[180px]">
          {switching ? (
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          ) : (
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          )}
          <span className="truncate">{current?.org_name ?? 'Select Org'}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Your Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map(org => (
          <DropdownMenuItem
            key={org.org_id}
            onClick={() => handleSwitch(org)}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
              {org.org_logo
                ? <img src={org.org_logo} alt={org.org_name} className="h-full w-full object-cover rounded-lg" />
                : org.org_name.charAt(0).toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{org.org_name}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{org.is_owner ? 'Owner' : org.role}</p>
            </div>
            {org.org_id === orgId && (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

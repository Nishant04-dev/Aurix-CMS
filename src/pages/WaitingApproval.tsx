import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, XCircle, Loader2, RefreshCw, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WaitingApproval() {
  const { user, orgId, orgStatus, logout, refreshUser } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [orgCreatedAt, setOrgCreatedAt] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from('organizations')
      .select('name, created_at')
      .eq('id', orgId)
      .single()
      .then(({ data }) => {
        if (data) {
          setOrgName((data as any).name);
          setOrgCreatedAt((data as any).created_at);
        }
      });
  }, [orgId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  };

  const isRejected = orgStatus === 'rejected';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Status icon */}
        <div className="text-center space-y-4">
          <div className={cn(
            'mx-auto h-20 w-20 rounded-full flex items-center justify-center',
            isRejected ? 'bg-rose-100' : 'bg-amber-100'
          )}>
            {isRejected
              ? <XCircle className="h-10 w-10 text-rose-500" />
              : <Clock className="h-10 w-10 text-amber-500 animate-pulse" />
            }
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isRejected ? 'Application Rejected' : 'Under Review'}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {isRejected
                ? 'Your organization application was not approved. Please contact support for more information.'
                : 'Your organization is currently under review by our team. We\'ll notify you once it\'s approved.'
              }
            </p>
          </div>
        </div>

        {/* Org info card */}
        <div className="bg-card border border-border/50 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {orgName.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-semibold text-foreground">{orgName || 'Your Organization'}</p>
              <p className="text-xs text-muted-foreground">
                Submitted {orgCreatedAt ? new Date(orgCreatedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>

          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
            isRejected
              ? 'bg-rose-50 text-rose-600 border border-rose-100'
              : 'bg-amber-50 text-amber-600 border border-amber-100'
          )}>
            {isRejected
              ? <><XCircle className="h-4 w-4" /> Application rejected</>
              : <><Clock className="h-4 w-4" /> Pending approval</>
            }
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {!isRejected && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking status...</>
                : <><RefreshCw className="h-4 w-4 mr-2" /> Check Status</>
              }
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full text-muted-foreground hover:text-destructive"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Questions? Contact <a href="mailto:support@aurix.com" className="text-primary underline underline-offset-2">support@aurix.com</a>
        </p>
      </div>
    </div>
  );
}

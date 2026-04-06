import React, { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function PlatformFeatures() {
  const { user } = useAuth();
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    api.get('/platform/feature-flags').then((data) => {
      setFlags(data || []);
      setLoading(false);
    });
  }, []);

  const toggle = async (id: string, enabled: boolean) => {
    try {
      await api.patch(`/platform/feature-flags/${id}`, { enabled });
      setFlags(prev => prev.map(f => f.id === id ? { ...f, enabled } : f));
      toast({ title: 'Feature flag updated' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" /> Global Feature Flags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {flags.map(flag => (
          <div key={flag.id} className="flex items-center justify-between p-4 rounded-xl border border-border/40 hover:bg-accent/20 transition-colors">
            <div>
              <p className="text-sm font-semibold text-foreground">{flag.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
              <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">{flag.key}</p>
            </div>
            <Switch checked={flag.enabled} onCheckedChange={v => toggle(flag.id, v)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

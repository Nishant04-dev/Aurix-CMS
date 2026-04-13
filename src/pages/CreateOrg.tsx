import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Building2, ArrowRight } from 'lucide-react';

/**
 * CreateOrg — available to any authenticated user, including those already in orgs.
 * Creates a new org and switches to it automatically.
 */
export default function CreateOrg() {
  const { refreshUser, setActiveOrg } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) { setError('Organization name is required'); return; }

    setLoading(true);
    setError('');

    try {
      // Step 1: create org atomically (org + membership + profile update)
      const result = await api.post<{ org_id: string; org_name: string }>('/upgrade', {
        org_name: orgName.trim(),
      });

      // Step 2: switch active org on backend (updates profile.org_id — source of truth)
      await api.post('/organizations/switch', { org_id: result.org_id });

      // Step 3: update local context immediately
      setActiveOrg(result.org_id);

      // Step 4: re-fetch profile so role/plan are correct for the new org
      await refreshUser();

      toast({ title: 'Organization created', description: `Switched to ${result.org_name}.` });
      setSuccess(true);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create organization. Please try again.');
      setLoading(false);
    }
  };

  if (success) return null; // navigating away

  return (
    <div className="max-w-md mx-auto mt-12 animate-in fade-in duration-500">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" /> Create New Organization
          </CardTitle>
          <CardDescription>
            Create a new workspace. You can switch between organizations anytime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={e => { setOrgName(e.target.value); setError(''); }}
                placeholder="e.g. Acme Creative Agency"
                disabled={loading}
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !orgName.trim()} className="flex-1">
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating...</>
                  : <><ArrowRight className="h-4 w-4 mr-2" /> Create Organization</>
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

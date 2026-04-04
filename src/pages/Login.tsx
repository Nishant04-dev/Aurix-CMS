import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('sarah@aurix.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!login(email, password)) {
      setError('Invalid credentials. Try sarah@aurix.com or michael@novacorp.com');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Aurix</h1>
          <p className="text-sm text-muted-foreground mt-1">Client Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full">Sign in</Button>
        </form>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Demo accounts: sarah@aurix.com (admin) or michael@novacorp.com (client)
          </p>
        </div>
      </div>
    </div>
  );
}

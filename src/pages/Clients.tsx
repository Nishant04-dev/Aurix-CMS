import React, { useState } from 'react';
import { clients, projects } from '@/data/mock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Mail, Phone, Building } from 'lucide-react';

export default function Clients() {
  const [search, setSearch] = useState('');
  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Clients</h1>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Client</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(client => {
          const clientProjects = projects.filter(p => p.clientId === client.id);
          return (
            <Card key={client.id} className="hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="p-5 space-y-3">
                <div>
                  <p className="font-medium text-foreground">{client.name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Building className="h-3 w-3" /> {client.company}
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {client.email}</div>
                  <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {client.phone}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {clientProjects.length} project{clientProjects.length !== 1 ? 's' : ''}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

import React from 'react';
import { users } from '@/data/mock';
import { Button } from '@/components/ui/button';
import { Plus, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const roleStyles: Record<string, string> = {
  admin: 'bg-primary/10 text-primary',
  team: 'bg-muted text-muted-foreground',
  client: 'bg-success/10 text-success',
};

export default function Team() {
  const teamMembers = users.filter(u => u.role !== 'client');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Team</h1>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Member</Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Joined</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teamMembers.map(member => (
              <tr key={member.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="font-medium text-foreground">{member.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize', roleStyles[member.role])}>
                    {member.role}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                  {new Date(member.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

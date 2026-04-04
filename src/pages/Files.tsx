import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { files, projects, users, clients } from '@/data/mock';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Image, File } from 'lucide-react';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const typeIcons: Record<string, React.ElementType> = {
  document: FileText,
  design: Image,
};

export default function Files() {
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  const clientRecord = isClient ? clients.find(c => c.userId === user?.id) : null;
  const clientProjectIds = isClient ? projects.filter(p => p.clientId === clientRecord?.id).map(p => p.id) : [];

  const filtered = isClient ? files.filter(f => clientProjectIds.includes(f.projectId)) : files;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Files</h1>
        <Button size="sm"><Upload className="h-4 w-4 mr-1" /> Upload</Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Project</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Uploaded by</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Size</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => {
              const Icon = typeIcons[f.type] || File;
              const project = projects.find(p => p.id === f.projectId);
              const uploader = users.find(u => u.id === f.uploadedBy);
              return (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground">{f.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{project?.title}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{uploader?.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatSize(f.size)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

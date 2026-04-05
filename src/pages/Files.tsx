import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Image, File, Loader2, Download, Trash2, FolderOpen, Search, Edit3, Eye } from 'lucide-react';
import { useFiles, useProjects } from '@/hooks/use-database';
import { usePermissions } from '@/hooks/use-permissions';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import { UpgradeModal } from '@/components/UpgradeModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { canUploadFile, limits } = usePlanLimits();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const canUpload = can('upload_file') && canUploadFile;
  const canDelete = can('delete_file');
  const canView   = can('view_file');
  const isClientUser = user?.role === 'client';
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [localFiles, setLocalFiles] = useState<any[]>([]);
  const [renameFile, setRenameFile] = useState<{ id: string; currentName: string } | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const { data: files, isLoading, refetch } = useFiles(selectedProject === 'all' ? undefined : selectedProject);
  const { data: projects } = useProjects();
  const [uploading, setUploading] = useState(false);
  const [uploadProject, setUploadProject] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (files) {
      setLocalFiles(files);
    }
  }, [files]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict project validation — never allow upload without a project
    if (!uploadProject) {
      toast({ variant: 'destructive', title: 'Project Required', description: 'Please select a project before uploading a file.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File Too Large', description: 'File exceeds the 50MB limit.' });
      return;
    }

    setUploading(true);
    try {
      const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('project-files')
        .upload(`projects/${uploadProject}/${uniqueFileName}`, file);
        
      if (error) throw error;
      
      // Use storage_path for the database (consistent with types)
      const { error: dbError } = await supabase.from('files').insert({
        name: file.name,
        storage_path: data.path,
        project_id: uploadProject,
        uploaded_by: user?.id,
        size: file.size,
        type: file.type.includes('image') ? 'design' : 'document'
      });
      
      if (dbError) throw dbError;
      
      toast({ title: 'Success', description: 'File uploaded successfully' });
      // Use queryClient to invalidate directly for immediate refresh
      queryClient.invalidateQueries({ queryKey: ['files'] });
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('project-files').createSignedUrl(fileUrl, 60);
      if (error) throw error;
      window.open(data.signedUrl);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    try {
      setLocalFiles(prev => prev.filter(f => f.id !== id));
      
      if (fileUrl) {
        await supabase.storage.from('project-files').remove([fileUrl]);
      }
      const { error } = await supabase.from('files').delete().eq('id', id);
      if (error) throw error;
      
      toast({ title: 'Success', description: 'File deleted' });
      queryClient.invalidateQueries({ queryKey: ['files'] });
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      if (files) setLocalFiles(files);
    }
  };

  const handleRename = async () => {
    if (!renameFile || !newFileName.trim()) return;
    
    try {
      const { error } = await supabase
        .from('files')
        .update({ name: newFileName.trim() })
        .eq('id', renameFile.id);
      
      if (error) throw error;
      
      toast({ title: 'Success', description: 'File renamed successfully' });
      setRenameFile(null);
      setNewFileName('');
      queryClient.invalidateQueries({ queryKey: ['files'] });
      refetch();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handlePreview = async (fileUrl: string, fileName: string, fileType: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-files')
        .createSignedUrl(fileUrl, 60);
      
      if (error) throw error;
      
      setPreviewFile({ url: data.signedUrl, name: fileName });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const filteredFiles = (localFiles || [])
    .filter(f => f.name?.toLowerCase().includes(search.toLowerCase()))
    .filter(f => selectedProject === 'all' || f.projectId === selectedProject);

if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">File Management</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Manage and share project files securely.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {canUpload && (
            <Select value={uploadProject} onValueChange={setUploadProject}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select project to upload" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleUpload} />
          {can('upload_file') && !canUploadFile ? (
            <Button
              size="sm"
              onClick={() => setShowUpgradeModal(true)}
              className="opacity-80"
            >
              <Upload className="h-4 w-4 mr-1" /> Upload
            </Button>
          ) : canUpload && (
            <Button
              size="sm"
              onClick={() => {
                if (!uploadProject) {
                  toast({ variant: 'destructive', title: 'Project Required', description: 'Please select a project before uploading.' });
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              className={cn(!uploadProject && 'opacity-60')}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Upload
            </Button>
          )}
        </div>
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="file uploads"
        message="File uploads are not available on the free plan. Upgrade to Pro to upload files."
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-2 border-b border-border/30 pb-4">
        <div className="relative w-full max-w-sm group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input 
            placeholder="Search files..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-9 bg-card border-border/50" 
          />
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map(p => (
               <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-1/3">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Project</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Uploaded by</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Size</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Date</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFiles?.map(f => {
              const Icon = typeIcons[f.type] || FileText;
              const project = projects?.find(p => p.id === f.projectId);
              return (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-md shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-foreground truncate">{f.name}</span>
                     </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground truncate">{project?.title || 'General'}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{f.uploaderName || 'Unknown'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{formatSize(f.size || 0)}</td>
                  <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground">
                    {f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                     <div className="flex items-center justify-end gap-1">
                         <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => handlePreview(f.fileUrl, f.name, f.type)} title="Preview">
                             <Eye className="h-4 w-4" />
                         </Button>
                         <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => handleDownload(f.fileUrl, f.name)} title="Download">
                             <Download className="h-4 w-4" />
                         </Button>
                         {canDelete && (
                           <>
                             <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => { setRenameFile({ id: f.id, currentName: f.name }); setNewFileName(f.name); }} title="Rename">
                                 <Edit3 className="h-4 w-4" />
                             </Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(f.id, f.fileUrl)} title="Delete">
                                 <Trash2 className="h-4 w-4" />
                             </Button>
                           </>
                         )}
                     </div>
                   </td>
                </tr>
              );
            })}
            {(!filteredFiles || filteredFiles.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                   <div className="flex flex-col items-center gap-2">
                       <File className="h-10 w-10 opacity-20" />
                       <p className="font-medium">No files available.</p>
                       <p className="text-xs opacity-60">Upload files to get started</p>
                   </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rename Dialog */}
      <Dialog open={!!renameFile} onOpenChange={(open) => !open && setRenameFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              value={newFileName} 
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Enter new file name"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameFile(null)}>Cancel</Button>
              <Button onClick={handleRename}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-[60vh] bg-muted rounded-md overflow-hidden">
            {previewFile?.url && (
              previewFile.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={previewFile.url} alt={previewFile.name} className="max-h-full max-w-full object-contain" />
              ) : previewFile.name.match(/\.(pdf)$/i) ? (
                <iframe src={previewFile.url} className="w-full h-full" title={previewFile.name} />
              ) : (
                <div className="text-center">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">Preview not available for this file type</p>
                  <Button variant="outline" className="mt-4" onClick={() => window.open(previewFile.url, '_blank')}>Open in new tab</Button>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

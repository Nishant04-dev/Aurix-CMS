import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UpgradePromptProps {
  message?: string;
  className?: string;
  /** If true, renders as a full-page overlay blur */
  overlay?: boolean;
}

export function UpgradePrompt({
  message = 'Upgrade your plan to unlock this feature.',
  className,
  overlay = false,
}: UpgradePromptProps) {
  if (overlay) {
    return (
      <div className={cn('relative', className)}>
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Zap className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-sm font-semibold text-foreground text-center max-w-xs px-4">{message}</p>
          <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Upgrade Plan
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
      <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
        <Zap className="h-6 w-6 text-amber-600" />
      </div>
      <p className="text-sm font-semibold text-foreground max-w-xs">{message}</p>
      <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5">
        <Zap className="h-3.5 w-3.5" /> Upgrade Plan
      </Button>
    </div>
  );
}

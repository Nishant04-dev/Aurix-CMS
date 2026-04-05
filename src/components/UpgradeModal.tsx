import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature?: string;
  message?: string;
}

export function UpgradeModal({ open, onClose, feature, message }: UpgradeModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onClose();
    navigate('/settings/billing');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm text-center">
        <DialogHeader className="items-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mb-2">
            <Zap className="h-7 w-7 text-amber-600" />
          </div>
          <DialogTitle>Upgrade Required</DialogTitle>
          <DialogDescription className="text-center">
            {message ?? (feature
              ? `${feature} is not available on your current plan.`
              : 'This feature is not available on your current plan.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full gap-2" onClick={handleUpgrade}>
            <Zap className="h-4 w-4" /> View Upgrade Options
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

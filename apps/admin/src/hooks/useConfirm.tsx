import { useState, useCallback } from "react";
import ConfirmModal from "../components/ui/ConfirmModal";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: "",
    message: "",
  });
  const [resolveCallback, setResolveCallback] = useState<((value: boolean) => void) | null>(null);
  const [loading, setLoading] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolveCallback(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setLoading(true);
    resolveCallback?.(true);
    setIsOpen(false);
    setLoading(false);
  }, [resolveCallback]);

  const handleClose = useCallback(() => {
    resolveCallback?.(false);
    setIsOpen(false);
  }, [resolveCallback]);

  const ConfirmDialog = useCallback(
    () => (
      <ConfirmModal
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
        loading={loading}
      />
    ),
    [isOpen, handleClose, handleConfirm, options, loading]
  );

  return { confirm, ConfirmDialog };
}

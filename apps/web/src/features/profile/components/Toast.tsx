import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, X } from "lucide-react";

export interface ToastData {
  message: string;
  type: "success" | "error";
}

interface ToastProps {
  toast: ToastData | null;
  onClose: () => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: -50, x: "-50%" }}
          className="fixed left-1/2 top-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg"
          style={{
            backgroundColor: toast.type === "success" ? "#10b981" : "#ef4444",
          }}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-white" />
          ) : (
            <X className="h-5 w-5 text-white" />
          )}
          <span className="text-sm font-medium text-white">{toast.message}</span>
          <button
            onClick={onClose}
            className="ml-2 rounded p-1 hover:bg-white/20"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

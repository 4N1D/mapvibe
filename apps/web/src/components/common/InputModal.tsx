import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@mapvibe/ui-components";

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  placeholder?: string;
  submitText?: string;
  cancelText?: string;
  inputType?: "text" | "url" | "email";
  initialValue?: string;
}

export function InputModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  placeholder = "",
  submitText = "Xác nhận",
  cancelText = "Hủy",
  inputType = "text",
  initialValue = "",
}: InputModalProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-xl"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type={inputType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />

          {/* Actions */}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100"
            >
              {cancelText}
            </Button>
            <Button
              type="submit"
              disabled={!value.trim()}
              className="bg-primary-500 px-4 py-2 text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitText}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

import { ServiceFormModal } from "./service-form-modal";

interface CreateServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuggestCategory: () => void;
}

export function CreateServiceModal({ open, onOpenChange, onSuggestCategory }: CreateServiceModalProps) {
  return (
    <ServiceFormModal
      open={open}
      onOpenChange={onOpenChange}
      onSuggestCategory={onSuggestCategory}
    />
  );
}

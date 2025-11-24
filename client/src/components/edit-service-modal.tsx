import { ServiceFormModal } from "./service-form-modal";
import type { Service } from "@shared/schema";

interface EditServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service & { category: any; owner: any } | null;
}

export function EditServiceModal({ open, onOpenChange, service }: EditServiceModalProps) {
  return (
    <ServiceFormModal
      open={open}
      onOpenChange={onOpenChange}
      service={service}
    />
  );
}

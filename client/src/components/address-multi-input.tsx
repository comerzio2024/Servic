import { useState } from "react";
import { Plus, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AddressAutocomplete } from "./address-autocomplete";

interface AddressData {
  street: string;
  city: string;
  postalCode: string;
  canton: string;
  fullAddress: string;
}

interface AddressMultiInputProps {
  onAddressesChange: (addresses: string[]) => void;
  initialAddresses?: string[];
  label?: string;
  required?: boolean;
}

export function AddressMultiInput({
  onAddressesChange,
  initialAddresses = [],
  label = "Service Locations",
  required = false,
}: AddressMultiInputProps) {
  const [selectedAddresses, setSelectedAddresses] = useState<AddressData[]>(
    initialAddresses.map(addr => ({
      street: "",
      city: addr,
      postalCode: "",
      canton: "",
      fullAddress: addr,
    }))
  );
  const [showAddNew, setShowAddNew] = useState(false);

  const handleAddressSelect = (address: AddressData | null) => {
    if (!address) return;

    // Check for duplicates
    if (selectedAddresses.some(a => a.fullAddress === address.fullAddress)) {
      return;
    }

    const newAddresses = [...selectedAddresses, address];
    setSelectedAddresses(newAddresses);
    onAddressesChange(newAddresses.map(a => a.fullAddress));
    setShowAddNew(false);
  };

  const removeAddress = (index: number) => {
    const newAddresses = selectedAddresses.filter((_, i) => i !== index);
    setSelectedAddresses(newAddresses);
    onAddressesChange(newAddresses.map(a => a.fullAddress));
  };

  return (
    <div className="space-y-3">
      <Label>
        {label} {required && '*'}
      </Label>

      {selectedAddresses.length > 0 && (
        <div className="space-y-2 p-3 bg-accent/10 rounded-lg border">
          {selectedAddresses.map((address, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 p-2 bg-background rounded border"
              data-testid={`location-item-${index}`}
            >
              <div className="flex items-center gap-2 flex-1">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{address.fullAddress}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {address.postalCode} {address.city}
                    {address.canton && `, ${address.canton}`}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  Verified
                </Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAddress(index)}
                data-testid={`button-remove-location-${index}`}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showAddNew ? (
        <div className="border rounded-lg p-4 bg-accent/5">
          <AddressAutocomplete
            onAddressSelect={handleAddressSelect}
            label="Add New Location"
            required={required}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAddNew(false)}
            className="mt-2"
            data-testid="button-cancel-add-location"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddNew(true)}
          className="w-full"
          data-testid="button-add-location"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Location
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        {selectedAddresses.length === 0
          ? "Add at least one location where you provide service"
          : `${selectedAddresses.length} location${selectedAddresses.length !== 1 ? 's' : ''} added`}
      </p>
    </div>
  );
}

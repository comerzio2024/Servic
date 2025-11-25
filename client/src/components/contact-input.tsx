import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface Contact {
  id?: string;
  contactType: "phone" | "email";
  value: string;
  name?: string;
  role?: string;
  isPrimary?: boolean;
  isVerified?: boolean;
}

interface ContactInputProps {
  contact: Contact;
  index: number;
  canRemove: boolean;
  verificationEnabled: boolean;
  showVerification: boolean;
  onUpdate: (index: number, field: keyof Contact, value: any) => void;
  onRemove: (index: number) => void;
}

export function ContactInput({
  contact,
  index,
  canRemove,
  verificationEnabled,
  showVerification,
  onUpdate,
  onRemove,
}: ContactInputProps) {
  const { toast } = useToast();
  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleSendVerificationCode = async () => {
    if (!contact.id) {
      toast({
        title: "Error",
        description: "Contact must be saved before verification",
        variant: "destructive",
      });
      return;
    }

    setSendingCode(true);
    try {
      await apiRequest(`/api/contacts/${contact.id}/send-verification`, {
        method: "POST",
      });
      setShowVerificationInput(true);
      toast({
        title: "Verification Code Sent",
        description: `A verification code has been sent to ${contact.value}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send verification code",
        variant: "destructive",
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyContact = async () => {
    if (!contact.id || !verificationCode) return;

    setVerifying(true);
    try {
      const result = await apiRequest(`/api/contacts/${contact.id}/verify`, {
        method: "POST",
        body: JSON.stringify({ code: verificationCode }),
      });

      if (result.success) {
        onUpdate(index, "isVerified", true);
        setShowVerificationInput(false);
        setVerificationCode("");
        toast({
          title: "Contact Verified",
          description: "Contact has been successfully verified",
        });
      }
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid or expired verification code",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const validateValue = (type: "phone" | "email", value: string): boolean | { isValid: boolean; message: string } => {
    if (!value) return false;
    if (type === "email") {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }
    // Swiss phone number validation: must start with +41 and have 9-13 digits after
    // Formats: +41 44 123 4567, +41441234567, +41 79 123 45 67
    const swissPhoneRegex = /^\+41\s?(\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|\d{9,11})$/;
    const cleanedValue = value.replace(/\s/g, '');
    const isValid = swissPhoneRegex.test(cleanedValue);
    return {
      isValid,
      message: isValid ? "" : "Phone must be in format: +41 44 123 4567 or +41441234567"
    };
  };

  const validationResult = validateValue(contact.contactType, contact.value);
  const isValueValid = typeof validationResult === 'boolean' ? validationResult : validationResult.isValid;
  const validationMessage = typeof validationResult === 'object' ? validationResult.message : "";

  return (
    <div className="border rounded-lg p-4 space-y-4" data-testid={`contact-input-${index}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="font-semibold">
            Contact {index + 1}
          </Label>
          {contact.isPrimary && (
            <Badge variant="default" data-testid={`badge-primary-${index}`}>
              Primary
            </Badge>
          )}
          {showVerification && contact.isVerified && (
            <Badge variant="default" className="bg-green-600" data-testid={`badge-verified-${index}`}>
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          )}
          {showVerification && !contact.isVerified && (
            <Badge variant="secondary" data-testid={`badge-unverified-${index}`}>
              <AlertCircle className="w-3 h-3 mr-1" />
              Unverified
            </Badge>
          )}
        </div>
        {canRemove && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onRemove(index)}
            data-testid={`button-remove-contact-${index}`}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`contact-type-${index}`}>Type *</Label>
          <select
            id={`contact-type-${index}`}
            value={contact.contactType}
            onChange={(e) => onUpdate(index, "contactType", e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            data-testid={`select-contact-type-${index}`}
          >
            <option value="phone">Phone</option>
            <option value="email">Email</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`contact-value-${index}`}>
            {contact.contactType === "phone" ? "Phone Number" : "Email Address"} *
          </Label>
          <Input
            id={`contact-value-${index}`}
            type={contact.contactType === "email" ? "email" : "tel"}
            placeholder={contact.contactType === "phone" ? "+41 44 123 4567" : "contact@example.com"}
            value={contact.value}
            onChange={(e) => onUpdate(index, "value", e.target.value)}
            className={!isValueValid && contact.value ? "border-red-500" : ""}
            data-testid={`input-contact-value-${index}`}
          />
          {!isValueValid && contact.value && (
            <p className="text-sm text-red-500">
              {validationMessage || `Please enter a valid ${contact.contactType === "phone" ? "phone number" : "email address"}`}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`contact-name-${index}`}>Name (optional)</Label>
          <Input
            id={`contact-name-${index}`}
            placeholder="e.g., Mr. Müller"
            value={contact.name || ""}
            onChange={(e) => onUpdate(index, "name", e.target.value)}
            data-testid={`input-contact-name-${index}`}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`contact-role-${index}`}>Role (optional)</Label>
          <Input
            id={`contact-role-${index}`}
            placeholder="e.g., For painting questions"
            value={contact.role || ""}
            onChange={(e) => onUpdate(index, "role", e.target.value)}
            data-testid={`input-contact-role-${index}`}
          />
        </div>
      </div>

      {showVerification && verificationEnabled && !contact.isVerified && (
        <div className="space-y-3">
          {!showVerificationInput ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendVerificationCode}
              disabled={sendingCode || !isValueValid}
              data-testid={`button-send-verification-${index}`}
            >
              {sendingCode ? "Sending..." : "Send Verification Code"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Enter verification code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                data-testid={`input-verification-code-${index}`}
              />
              <Button
                type="button"
                onClick={handleVerifyContact}
                disabled={verifying || !verificationCode}
                data-testid={`button-verify-${index}`}
              >
                {verifying ? "Verifying..." : "Verify"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

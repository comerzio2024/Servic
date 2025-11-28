/**
 * PricingOptionsEditor Component
 * 
 * Allows vendors to manage multiple pricing options for a service
 * Supports: label, price, currency, billing interval, duration
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, GripVertical, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface PricingOption {
  id: string;
  serviceId: string;
  label: string;
  description: string | null;
  price: string;
  currency: string;
  billingInterval: 'one_time' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  durationMinutes: number | null;
  sortOrder: number;
  isActive: boolean;
}

interface PricingOptionsEditorProps {
  serviceId: string;
  onUpdate?: () => void;
}

const BILLING_INTERVALS = [
  { value: 'one_time', label: 'One-time' },
  { value: 'hourly', label: 'Per Hour' },
  { value: 'daily', label: 'Per Day' },
  { value: 'weekly', label: 'Per Week' },
  { value: 'monthly', label: 'Per Month' },
  { value: 'yearly', label: 'Per Year' },
];

const CURRENCIES = [
  { value: 'CHF', label: 'CHF (Swiss Franc)' },
  { value: 'EUR', label: 'EUR (Euro)' },
  { value: 'USD', label: 'USD (US Dollar)' },
];

export function PricingOptionsEditor({ serviceId, onUpdate }: PricingOptionsEditorProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<PricingOption | null>(null);
  const [formData, setFormData] = useState<{
    label: string;
    description: string;
    price: string;
    currency: string;
    billingInterval: 'one_time' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    durationMinutes: string;
  }>({
    label: '',
    description: '',
    price: '',
    currency: 'CHF',
    billingInterval: 'one_time',
    durationMinutes: '',
  });

  // Fetch pricing options
  const { data: pricingOptions = [], isLoading } = useQuery<PricingOption[]>({
    queryKey: ['pricing-options', serviceId],
    queryFn: async () => {
      const res = await fetch(`/api/services/${serviceId}/pricing-options`);
      if (!res.ok) throw new Error('Failed to fetch pricing options');
      return res.json();
    },
  });

  // Create pricing option
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch(`/api/services/${serviceId}/pricing-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          durationMinutes: data.durationMinutes ? parseInt(data.durationMinutes) : null,
          sortOrder: pricingOptions.length,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create pricing option');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-options', serviceId] });
      toast.success('Pricing option added');
      resetForm();
      setIsDialogOpen(false);
      onUpdate?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update pricing option
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await fetch(`/api/pricing-options/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          durationMinutes: data.durationMinutes ? parseInt(data.durationMinutes) : null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update pricing option');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-options', serviceId] });
      toast.success('Pricing option updated');
      resetForm();
      setIsDialogOpen(false);
      onUpdate?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete pricing option
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pricing-options/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete pricing option');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-options', serviceId] });
      toast.success('Pricing option removed');
      onUpdate?.();
    },
    onError: () => {
      toast.error('Failed to remove pricing option');
    },
  });

  const resetForm = () => {
    setFormData({
      label: '',
      description: '',
      price: '',
      currency: 'CHF',
      billingInterval: 'one_time',
      durationMinutes: '',
    });
    setEditingOption(null);
  };

  const openEditDialog = (option: PricingOption) => {
    setEditingOption(option);
    setFormData({
      label: option.label,
      description: option.description || '',
      price: option.price,
      currency: option.currency,
      billingInterval: option.billingInterval,
      durationMinutes: option.durationMinutes?.toString() || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.label || !formData.price) {
      toast.error('Label and price are required');
      return;
    }

    if (editingOption) {
      updateMutation.mutate({ id: editingOption.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatPrice = (price: string, currency: string, interval: string) => {
    const formatted = new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: currency,
    }).format(parseFloat(price));
    
    if (interval === 'one_time') return formatted;
    return `${formatted}/${interval.replace('ly', '')}`;
  };

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-muted rounded-lg" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Pricing Options</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Add Option
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingOption ? 'Edit Pricing Option' : 'Add Pricing Option'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="label">Label *</Label>
                <Input
                  id="label"
                  placeholder="e.g., Basic Package, Premium Service"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What's included in this option?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-9"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billingInterval">Billing</Label>
                  <Select
                    value={formData.billingInterval}
                    onValueChange={(value: any) => setFormData({ ...formData, billingInterval: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_INTERVALS.map((b) => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="duration"
                      type="number"
                      min="0"
                      placeholder="60"
                      className="pl-9"
                      value={formData.durationMinutes}
                      onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingOption ? 'Update' : 'Add'} Option
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {pricingOptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No pricing options yet</p>
            <p className="text-sm">Add options to give customers flexible choices</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pricingOptions.map((option) => (
              <div
                key={option.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{option.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {formatPrice(option.price, option.currency, option.billingInterval)}
                    </Badge>
                  </div>
                  {option.description && (
                    <p className="text-sm text-muted-foreground truncate">{option.description}</p>
                  )}
                  {option.durationMinutes && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {option.durationMinutes} min
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEditDialog(option)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm('Remove this pricing option?')) {
                        deleteMutation.mutate(option.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PricingOptionsEditor;


/**
 * PricingBreakdown Component
 * 
 * Displays a detailed breakdown of booking costs including:
 * - Line items (hourly, daily, base costs)
 * - Surcharges (weekend, holiday)
 * - Platform fees
 * - Total cost
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
  Receipt, 
  Clock, 
  Calendar, 
  Percent, 
  Info, 
  CheckCircle,
  Sparkles,
  TrendingDown
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  type: 'base' | 'hourly' | 'daily' | 'surcharge' | 'discount';
}

interface SurchargeItem {
  type: 'weekend' | 'holiday' | 'rush' | 'custom';
  description: string;
  amount: number;
  percentage?: number;
}

interface PricingBreakdownData {
  totalHours: number;
  totalDays: number;
  fullDays: number;
  extraHours: number;
  baseCost: number;
  dailyCost: number;
  hourlyCost: number;
  surcharges: SurchargeItem[];
  discount: number;
  subtotal: number;
  platformFee: number;
  total: number;
  currency: string;
  lineItems: LineItem[];
  calculationMethod: 'hourly' | 'daily' | 'mixed' | 'fixed';
}

interface PricingBreakdownProps {
  breakdown: PricingBreakdownData | null;
  isLoading?: boolean;
  showDetails?: boolean;
  className?: string;
}

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const getMethodIcon = (method: string) => {
  switch (method) {
    case 'hourly':
      return <Clock className="w-4 h-4" />;
    case 'daily':
      return <Calendar className="w-4 h-4" />;
    case 'mixed':
      return <Sparkles className="w-4 h-4" />;
    default:
      return <Receipt className="w-4 h-4" />;
  }
};

const getMethodLabel = (method: string) => {
  switch (method) {
    case 'hourly':
      return 'Hourly Rate';
    case 'daily':
      return 'Daily Rate';
    case 'mixed':
      return 'Best Value';
    default:
      return 'Fixed Price';
  }
};

export function PricingBreakdown({
  breakdown,
  isLoading = false,
  showDetails = true,
  className,
}: PricingBreakdownProps) {
  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Separator />
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>
    );
  }

  // No breakdown available
  if (!breakdown) {
    return (
      <Card className={cn("w-full border-dashed", className)}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Receipt className="w-10 h-10 mb-3 opacity-40" />
          <p className="font-medium">Price Calculation</p>
          <p className="text-sm">Select dates to see pricing</p>
        </CardContent>
      </Card>
    );
  }

  const hasSurcharges = breakdown.surcharges.length > 0;
  const hasDiscount = breakdown.discount > 0;
  const isBestValue = breakdown.calculationMethod === 'mixed';

  return (
    <Card className={cn(
      "w-full overflow-hidden transition-all duration-300",
      isBestValue && "ring-2 ring-green-500/20",
      className
    )}>
      <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Price Breakdown
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className={cn(
                  "text-xs gap-1",
                  isBestValue && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                )}>
                  {getMethodIcon(breakdown.calculationMethod)}
                  {getMethodLabel(breakdown.calculationMethod)}
                  {isBestValue && <TrendingDown className="w-3 h-3" />}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {isBestValue 
                    ? 'We calculated the most cost-effective pricing for you!'
                    : `Priced using ${getMethodLabel(breakdown.calculationMethod).toLowerCase()}`
                  }
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Duration Summary */}
        <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
          <span className="text-muted-foreground">Duration</span>
          <span className="font-medium flex items-center gap-2">
            {breakdown.fullDays > 0 && (
              <Badge variant="outline" className="text-xs">
                {breakdown.fullDays} day{breakdown.fullDays !== 1 ? 's' : ''}
              </Badge>
            )}
            {breakdown.extraHours > 0 && (
              <Badge variant="outline" className="text-xs">
                {breakdown.extraHours.toFixed(1)} hr{breakdown.extraHours !== 1 ? 's' : ''}
              </Badge>
            )}
            {breakdown.fullDays === 0 && breakdown.extraHours === 0 && (
              <Badge variant="outline" className="text-xs">
                {breakdown.totalHours.toFixed(1)} hours
              </Badge>
            )}
          </span>
        </div>

        {/* Line Items */}
        {showDetails && breakdown.lineItems.length > 0 && (
          <div className="space-y-2">
            {breakdown.lineItems.map((item, index) => (
              <div 
                key={index}
                className={cn(
                  "flex items-center justify-between text-sm py-2 px-1 rounded",
                  item.type === 'surcharge' && "bg-amber-50/50 dark:bg-amber-950/20",
                  item.type === 'discount' && "bg-green-50/50 dark:bg-green-950/20"
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {item.type === 'hourly' && <Clock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                  {item.type === 'daily' && <Calendar className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />}
                  {item.type === 'surcharge' && <Percent className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                  {item.type === 'base' && <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  <span className="truncate text-muted-foreground">{item.description}</span>
                </div>
                <span className={cn(
                  "font-medium ml-2 whitespace-nowrap",
                  item.type === 'surcharge' && "text-amber-600 dark:text-amber-400",
                  item.type === 'discount' && "text-green-600 dark:text-green-400"
                )}>
                  {item.type === 'surcharge' ? '+' : ''}
                  {item.type === 'discount' ? '-' : ''}
                  {formatCurrency(item.total, breakdown.currency)}
                </span>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Subtotal */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatCurrency(breakdown.subtotal, breakdown.currency)}</span>
        </div>

        {/* Platform Fee */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            Platform fee
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">
                    A 10% service fee that helps us maintain the platform and provide customer support.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>
          <span className="font-medium text-muted-foreground">
            {formatCurrency(breakdown.platformFee, breakdown.currency)}
          </span>
        </div>

        <Separator />

        {/* Total */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Total</span>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(breakdown.total, breakdown.currency)}
            </span>
            {hasSurcharges && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Includes {breakdown.surcharges.length} surcharge{breakdown.surcharges.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Best Value Notice */}
        {isBestValue && (
          <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <TrendingDown className="w-4 h-4" />
              <span className="text-sm font-medium">Best value calculated!</span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-500 mt-1">
              We combined daily and hourly rates to give you the lowest price.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for inline display
export function PricingBadge({
  total,
  currency,
  className,
}: {
  total: number;
  currency: string;
  className?: string;
}) {
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "text-lg font-bold px-4 py-2 bg-primary/10 text-primary",
        className
      )}
    >
      {formatCurrency(total, currency)}
    </Badge>
  );
}

export default PricingBreakdown;






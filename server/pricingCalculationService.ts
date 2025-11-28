/**
 * Pricing Calculation Service
 * 
 * Handles complex pricing calculations for multi-day bookings:
 * - Per hour pricing
 * - Per day pricing
 * - Mixed pricing (daily rate + hourly overflow)
 * - Weekend/holiday surcharges
 * - Smart calculation (choose cheapest option)
 */

import { db } from './db';
import { servicePricingOptions, services, vendorCalendarBlocks } from '../shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

// ===========================================
// TYPES
// ===========================================

export interface PricingOption {
  id: string;
  label: string;
  price: number;
  currency: string;
  billingInterval: 'one_time' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  durationMinutes: number | null;
}

export interface DateTimeRange {
  start: Date;
  end: Date;
}

export interface PricingBreakdown {
  // Time breakdown
  totalHours: number;
  totalDays: number;
  fullDays: number;
  extraHours: number;
  
  // Cost breakdown
  baseCost: number;
  dailyCost: number;
  hourlyCost: number;
  surcharges: SurchargeItem[];
  discount: number;
  
  // Final amounts
  subtotal: number;
  platformFee: number;
  total: number;
  currency: string;
  
  // Breakdown details for display
  lineItems: LineItem[];
  
  // Calculation method used
  calculationMethod: 'hourly' | 'daily' | 'mixed' | 'fixed';
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  type: 'base' | 'hourly' | 'daily' | 'surcharge' | 'discount';
}

export interface SurchargeItem {
  type: 'weekend' | 'holiday' | 'rush' | 'custom';
  description: string;
  amount: number;
  percentage?: number;
}

export interface ServicePricing {
  hourlyRate: number | null;
  dailyRate: number | null;
  basePrice: number | null;
  currency: string;
  minimumHours: number;
  minimumDays: number;
  weekendSurchargePercent: number;
  holidaySurchargePercent: number;
}

// ===========================================
// CONSTANTS
// ===========================================

const PLATFORM_FEE_PERCENTAGE = 0.10; // 10% platform fee
const HOURS_PER_DAY = 24;
const WORKING_HOURS_PER_DAY = 8; // Standard working day

// Swiss public holidays (approximate - should be configurable)
const SWISS_HOLIDAYS_2024 = [
  '2024-01-01', // New Year
  '2024-01-02', // Berchtoldstag
  '2024-03-29', // Good Friday
  '2024-04-01', // Easter Monday
  '2024-05-01', // Labor Day
  '2024-05-09', // Ascension
  '2024-05-20', // Whit Monday
  '2024-08-01', // Swiss National Day
  '2024-12-25', // Christmas
  '2024-12-26', // St. Stephen's Day
];

// ===========================================
// MAIN CALCULATION FUNCTIONS
// ===========================================

/**
 * Calculate pricing for a booking
 */
export async function calculateBookingPrice(params: {
  serviceId: string;
  pricingOptionId?: string;
  startTime: Date;
  endTime: Date;
}): Promise<PricingBreakdown> {
  const { serviceId, pricingOptionId, startTime, endTime } = params;

  // Get service details
  const [service] = await db.select()
    .from(services)
    .where(eq(services.id, serviceId))
    .limit(1);

  if (!service) {
    throw new Error('Service not found');
  }

  // Get pricing option if specified
  let pricingOption: PricingOption | null = null;
  if (pricingOptionId) {
    const [option] = await db.select()
      .from(servicePricingOptions)
      .where(eq(servicePricingOptions.id, pricingOptionId))
      .limit(1);
    
    if (option) {
      pricingOption = {
        id: option.id,
        label: option.label,
        price: parseFloat(option.price),
        currency: option.currency,
        billingInterval: option.billingInterval as PricingOption['billingInterval'],
        durationMinutes: option.durationMinutes,
      };
    }
  }

  // Calculate time duration
  const durationMs = endTime.getTime() - startTime.getTime();
  const totalHours = durationMs / (1000 * 60 * 60);
  const totalDays = totalHours / HOURS_PER_DAY;

  // Get pricing configuration
  const pricing = getPricingFromService(service, pricingOption);

  // Calculate based on billing interval
  let breakdown: PricingBreakdown;

  if (pricingOption?.billingInterval === 'one_time') {
    breakdown = calculateFixedPrice(pricingOption, startTime, endTime, pricing);
  } else if (pricingOption?.billingInterval === 'hourly' || (!pricingOption && pricing.hourlyRate)) {
    breakdown = calculateHourlyPrice(totalHours, startTime, endTime, pricing);
  } else if (pricingOption?.billingInterval === 'daily' || (!pricingOption && pricing.dailyRate)) {
    breakdown = calculateDailyPrice(totalDays, totalHours, startTime, endTime, pricing);
  } else if (pricing.hourlyRate && pricing.dailyRate) {
    // Mixed pricing - calculate both and choose cheapest
    breakdown = calculateMixedPrice(totalDays, totalHours, startTime, endTime, pricing);
  } else {
    // Fallback to service base price
    breakdown = calculateFixedPrice(
      { 
        id: '', 
        label: 'Base Price', 
        price: pricing.basePrice || 0, 
        currency: pricing.currency,
        billingInterval: 'one_time',
        durationMinutes: null 
      },
      startTime, 
      endTime, 
      pricing
    );
  }

  return breakdown;
}

/**
 * Calculate fixed/one-time price
 */
function calculateFixedPrice(
  option: PricingOption,
  startTime: Date,
  endTime: Date,
  pricing: ServicePricing
): PricingBreakdown {
  const durationMs = endTime.getTime() - startTime.getTime();
  const totalHours = durationMs / (1000 * 60 * 60);
  const totalDays = totalHours / HOURS_PER_DAY;

  const lineItems: LineItem[] = [{
    description: option.label || 'Service',
    quantity: 1,
    unitPrice: option.price,
    total: option.price,
    type: 'base',
  }];

  // Calculate surcharges
  const surcharges = calculateSurcharges(startTime, endTime, option.price, pricing);
  const surchargeTotal = surcharges.reduce((sum, s) => sum + s.amount, 0);

  surcharges.forEach(s => {
    lineItems.push({
      description: s.description,
      quantity: 1,
      unitPrice: s.amount,
      total: s.amount,
      type: 'surcharge',
    });
  });

  const subtotal = option.price + surchargeTotal;
  const platformFee = subtotal * PLATFORM_FEE_PERCENTAGE;
  const total = subtotal + platformFee;

  return {
    totalHours,
    totalDays,
    fullDays: Math.floor(totalDays),
    extraHours: totalHours % HOURS_PER_DAY,
    baseCost: option.price,
    dailyCost: 0,
    hourlyCost: 0,
    surcharges,
    discount: 0,
    subtotal,
    platformFee,
    total,
    currency: option.currency,
    lineItems,
    calculationMethod: 'fixed',
  };
}

/**
 * Calculate hourly price
 */
function calculateHourlyPrice(
  totalHours: number,
  startTime: Date,
  endTime: Date,
  pricing: ServicePricing
): PricingBreakdown {
  const hourlyRate = pricing.hourlyRate || 0;
  const billableHours = Math.max(totalHours, pricing.minimumHours);
  const hourlyCost = billableHours * hourlyRate;

  const lineItems: LineItem[] = [{
    description: `${billableHours.toFixed(1)} hours @ ${formatCurrency(hourlyRate, pricing.currency)}/hr`,
    quantity: billableHours,
    unitPrice: hourlyRate,
    total: hourlyCost,
    type: 'hourly',
  }];

  // Calculate surcharges
  const surcharges = calculateSurcharges(startTime, endTime, hourlyCost, pricing);
  const surchargeTotal = surcharges.reduce((sum, s) => sum + s.amount, 0);

  surcharges.forEach(s => {
    lineItems.push({
      description: s.description,
      quantity: 1,
      unitPrice: s.amount,
      total: s.amount,
      type: 'surcharge',
    });
  });

  const subtotal = hourlyCost + surchargeTotal;
  const platformFee = subtotal * PLATFORM_FEE_PERCENTAGE;
  const total = subtotal + platformFee;

  return {
    totalHours,
    totalDays: totalHours / HOURS_PER_DAY,
    fullDays: 0,
    extraHours: totalHours,
    baseCost: 0,
    dailyCost: 0,
    hourlyCost,
    surcharges,
    discount: 0,
    subtotal,
    platformFee,
    total,
    currency: pricing.currency,
    lineItems,
    calculationMethod: 'hourly',
  };
}

/**
 * Calculate daily price
 */
function calculateDailyPrice(
  totalDays: number,
  totalHours: number,
  startTime: Date,
  endTime: Date,
  pricing: ServicePricing
): PricingBreakdown {
  const dailyRate = pricing.dailyRate || 0;
  const billableDays = Math.max(Math.ceil(totalDays), pricing.minimumDays);
  const dailyCost = billableDays * dailyRate;

  const lineItems: LineItem[] = [{
    description: `${billableDays} day${billableDays !== 1 ? 's' : ''} @ ${formatCurrency(dailyRate, pricing.currency)}/day`,
    quantity: billableDays,
    unitPrice: dailyRate,
    total: dailyCost,
    type: 'daily',
  }];

  // Calculate surcharges
  const surcharges = calculateSurcharges(startTime, endTime, dailyCost, pricing);
  const surchargeTotal = surcharges.reduce((sum, s) => sum + s.amount, 0);

  surcharges.forEach(s => {
    lineItems.push({
      description: s.description,
      quantity: 1,
      unitPrice: s.amount,
      total: s.amount,
      type: 'surcharge',
    });
  });

  const subtotal = dailyCost + surchargeTotal;
  const platformFee = subtotal * PLATFORM_FEE_PERCENTAGE;
  const total = subtotal + platformFee;

  return {
    totalHours,
    totalDays,
    fullDays: billableDays,
    extraHours: 0,
    baseCost: 0,
    dailyCost,
    hourlyCost: 0,
    surcharges,
    discount: 0,
    subtotal,
    platformFee,
    total,
    currency: pricing.currency,
    lineItems,
    calculationMethod: 'daily',
  };
}

/**
 * Calculate mixed price (daily + hourly overflow)
 * Intelligently chooses the cheapest option
 */
function calculateMixedPrice(
  totalDays: number,
  totalHours: number,
  startTime: Date,
  endTime: Date,
  pricing: ServicePricing
): PricingBreakdown {
  const hourlyRate = pricing.hourlyRate || 0;
  const dailyRate = pricing.dailyRate || 0;

  // Calculate full days and extra hours
  const fullDays = Math.floor(totalDays);
  const extraHours = totalHours - (fullDays * HOURS_PER_DAY);

  // Option 1: All hourly
  const allHourlyCost = totalHours * hourlyRate;

  // Option 2: All daily (round up)
  const allDailyCost = Math.ceil(totalDays) * dailyRate;

  // Option 3: Mixed (full days + extra hours)
  const mixedDailyCost = fullDays * dailyRate;
  const mixedHourlyCost = extraHours * hourlyRate;
  const mixedExtraDayCost = dailyRate; // Cost if we add another full day instead

  // Determine if extra hours are cheaper than an extra day
  const useExtraHours = mixedHourlyCost < mixedExtraDayCost;
  const mixedTotalCost = mixedDailyCost + (useExtraHours ? mixedHourlyCost : (extraHours > 0 ? mixedExtraDayCost : 0));

  // Choose the cheapest option
  const costs = [
    { method: 'hourly' as const, cost: allHourlyCost },
    { method: 'daily' as const, cost: allDailyCost },
    { method: 'mixed' as const, cost: mixedTotalCost },
  ];

  const cheapest = costs.reduce((min, curr) => curr.cost < min.cost ? curr : min);

  // Build breakdown based on chosen method
  const lineItems: LineItem[] = [];
  let dailyCostFinal = 0;
  let hourlyCostFinal = 0;
  let fullDaysFinal = 0;
  let extraHoursFinal = 0;

  if (cheapest.method === 'hourly') {
    lineItems.push({
      description: `${totalHours.toFixed(1)} hours @ ${formatCurrency(hourlyRate, pricing.currency)}/hr`,
      quantity: totalHours,
      unitPrice: hourlyRate,
      total: allHourlyCost,
      type: 'hourly',
    });
    hourlyCostFinal = allHourlyCost;
    extraHoursFinal = totalHours;
  } else if (cheapest.method === 'daily') {
    const days = Math.ceil(totalDays);
    lineItems.push({
      description: `${days} day${days !== 1 ? 's' : ''} @ ${formatCurrency(dailyRate, pricing.currency)}/day`,
      quantity: days,
      unitPrice: dailyRate,
      total: allDailyCost,
      type: 'daily',
    });
    dailyCostFinal = allDailyCost;
    fullDaysFinal = days;
  } else {
    // Mixed
    if (fullDays > 0) {
      lineItems.push({
        description: `${fullDays} day${fullDays !== 1 ? 's' : ''} @ ${formatCurrency(dailyRate, pricing.currency)}/day`,
        quantity: fullDays,
        unitPrice: dailyRate,
        total: mixedDailyCost,
        type: 'daily',
      });
      dailyCostFinal = mixedDailyCost;
      fullDaysFinal = fullDays;
    }

    if (extraHours > 0) {
      if (useExtraHours) {
        lineItems.push({
          description: `${extraHours.toFixed(1)} extra hours @ ${formatCurrency(hourlyRate, pricing.currency)}/hr`,
          quantity: extraHours,
          unitPrice: hourlyRate,
          total: mixedHourlyCost,
          type: 'hourly',
        });
        hourlyCostFinal = mixedHourlyCost;
        extraHoursFinal = extraHours;
      } else {
        lineItems.push({
          description: `1 additional day (cheaper than ${extraHours.toFixed(1)} hours)`,
          quantity: 1,
          unitPrice: dailyRate,
          total: dailyRate,
          type: 'daily',
        });
        dailyCostFinal += dailyRate;
        fullDaysFinal += 1;
      }
    }
  }

  // Calculate surcharges
  const baseCost = dailyCostFinal + hourlyCostFinal;
  const surcharges = calculateSurcharges(startTime, endTime, baseCost, pricing);
  const surchargeTotal = surcharges.reduce((sum, s) => sum + s.amount, 0);

  surcharges.forEach(s => {
    lineItems.push({
      description: s.description,
      quantity: 1,
      unitPrice: s.amount,
      total: s.amount,
      type: 'surcharge',
    });
  });

  const subtotal = baseCost + surchargeTotal;
  const platformFee = subtotal * PLATFORM_FEE_PERCENTAGE;
  const total = subtotal + platformFee;

  return {
    totalHours,
    totalDays,
    fullDays: fullDaysFinal,
    extraHours: extraHoursFinal,
    baseCost: 0,
    dailyCost: dailyCostFinal,
    hourlyCost: hourlyCostFinal,
    surcharges,
    discount: 0,
    subtotal,
    platformFee,
    total,
    currency: pricing.currency,
    lineItems,
    calculationMethod: cheapest.method,
  };
}

// ===========================================
// SURCHARGE CALCULATIONS
// ===========================================

/**
 * Calculate applicable surcharges
 */
function calculateSurcharges(
  startTime: Date,
  endTime: Date,
  baseCost: number,
  pricing: ServicePricing
): SurchargeItem[] {
  const surcharges: SurchargeItem[] = [];

  // Check for weekend days
  const weekendDays = countWeekendDays(startTime, endTime);
  if (weekendDays > 0 && pricing.weekendSurchargePercent > 0) {
    const surchargeAmount = baseCost * (pricing.weekendSurchargePercent / 100) * (weekendDays / getTotalDays(startTime, endTime));
    if (surchargeAmount > 0) {
      surcharges.push({
        type: 'weekend',
        description: `Weekend surcharge (${pricing.weekendSurchargePercent}%)`,
        amount: Math.round(surchargeAmount * 100) / 100,
        percentage: pricing.weekendSurchargePercent,
      });
    }
  }

  // Check for holidays
  const holidayDays = countHolidayDays(startTime, endTime);
  if (holidayDays > 0 && pricing.holidaySurchargePercent > 0) {
    const surchargeAmount = baseCost * (pricing.holidaySurchargePercent / 100) * (holidayDays / getTotalDays(startTime, endTime));
    if (surchargeAmount > 0) {
      surcharges.push({
        type: 'holiday',
        description: `Holiday surcharge (${pricing.holidaySurchargePercent}%)`,
        amount: Math.round(surchargeAmount * 100) / 100,
        percentage: pricing.holidaySurchargePercent,
      });
    }
  }

  return surcharges;
}

/**
 * Count weekend days in a range
 */
function countWeekendDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  
  while (current < end) {
    const day = current.getDay();
    if (day === 0 || day === 6) { // Sunday or Saturday
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Count holiday days in a range
 */
function countHolidayDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  
  while (current < end) {
    const dateStr = current.toISOString().split('T')[0];
    if (SWISS_HOLIDAYS_2024.includes(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Get total days between two dates
 */
function getTotalDays(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Extract pricing configuration from service
 */
function getPricingFromService(service: any, pricingOption: PricingOption | null): ServicePricing {
  // If we have a specific pricing option, use it
  if (pricingOption) {
    const isHourly = pricingOption.billingInterval === 'hourly';
    const isDaily = pricingOption.billingInterval === 'daily';
    
    return {
      hourlyRate: isHourly ? pricingOption.price : null,
      dailyRate: isDaily ? pricingOption.price : null,
      basePrice: !isHourly && !isDaily ? pricingOption.price : null,
      currency: pricingOption.currency,
      minimumHours: 1,
      minimumDays: 1,
      weekendSurchargePercent: 0, // Could be stored in service/pricing option
      holidaySurchargePercent: 0,
    };
  }

  // Otherwise use service defaults
  const priceUnit = service.priceUnit || 'fixed';
  const price = parseFloat(service.price) || 0;
  
  return {
    hourlyRate: priceUnit === 'hour' ? price : null,
    dailyRate: priceUnit === 'day' ? price : null,
    basePrice: !['hour', 'day'].includes(priceUnit) ? price : null,
    currency: service.currency || 'CHF',
    minimumHours: 1,
    minimumDays: 1,
    weekendSurchargePercent: 0,
    holidaySurchargePercent: 0,
  };
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Get price estimate for quick display
 */
export async function getQuickPriceEstimate(params: {
  serviceId: string;
  pricingOptionId?: string;
  hours?: number;
  days?: number;
}): Promise<{ estimate: number; currency: string; note: string }> {
  const { serviceId, pricingOptionId, hours = 1, days = 0 } = params;

  const startTime = new Date();
  const endTime = new Date(startTime);
  
  if (days > 0) {
    endTime.setDate(endTime.getDate() + days);
  }
  if (hours > 0) {
    endTime.setHours(endTime.getHours() + hours);
  }

  try {
    const breakdown = await calculateBookingPrice({
      serviceId,
      pricingOptionId,
      startTime,
      endTime,
    });

    return {
      estimate: breakdown.total,
      currency: breakdown.currency,
      note: `Estimated price for ${days > 0 ? `${days} day(s)` : ''} ${hours > 0 ? `${hours} hour(s)` : ''}`,
    };
  } catch (error) {
    return {
      estimate: 0,
      currency: 'CHF',
      note: 'Unable to calculate estimate',
    };
  }
}

export default {
  calculateBookingPrice,
  getQuickPriceEstimate,
};






/**
 * DateTimeRangePicker Component
 * 
 * A responsive date and time range picker for multi-day bookings
 * Features:
 * - Calendar view for date selection
 * - Time selection with AM/PM or 24h format
 * - Range selection visualization
 * - Availability overlay
 * - Mobile-friendly design
 */

import { useState, useEffect, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, addDays, isSameDay, isWithinInterval, isBefore, isAfter, differenceInHours, differenceInDays } from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ArrowRight, 
  AlertCircle,
  Sun,
  Moon,
  ChevronDown
} from 'lucide-react';

interface DateTimeRange {
  start: Date | null;
  end: Date | null;
}

interface BlockedPeriod {
  start: Date;
  end: Date;
  reason?: string;
}

interface DateTimeRangePickerProps {
  value: DateTimeRange;
  onChange: (range: DateTimeRange) => void;
  blockedPeriods?: BlockedPeriod[];
  minDate?: Date;
  maxDate?: Date;
  minDuration?: number; // in minutes
  maxDuration?: number; // in minutes
  timeStep?: number; // in minutes
  workingHours?: { start: string; end: string };
  className?: string;
  disabled?: boolean;
}

// Generate time options
const generateTimeOptions = (step: number = 30) => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += step) {
      const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const label = format(new Date(2024, 0, 1, hour, minute), 'HH:mm');
      options.push({ value, label });
    }
  }
  return options;
};

export function DateTimeRangePicker({
  value,
  onChange,
  blockedPeriods = [],
  minDate = new Date(),
  maxDate,
  minDuration = 60,
  maxDuration,
  timeStep = 30,
  workingHours = { start: '08:00', end: '18:00' },
  className,
  disabled = false,
}: DateTimeRangePickerProps) {
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | undefined>(value.start ?? undefined);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(value.end ?? undefined);
  const [startTime, setStartTime] = useState(value.start ? format(value.start, 'HH:mm') : workingHours.start);
  const [endTime, setEndTime] = useState(value.end ? format(value.end, 'HH:mm') : workingHours.end);

  const timeOptions = useMemo(() => generateTimeOptions(timeStep), [timeStep]);

  // Update parent when dates/times change
  useEffect(() => {
    if (selectedStartDate && startTime) {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const start = new Date(selectedStartDate);
      start.setHours(startHour, startMin, 0, 0);

      let end: Date | null = null;
      if (selectedEndDate && endTime) {
        const [endHour, endMin] = endTime.split(':').map(Number);
        end = new Date(selectedEndDate);
        end.setHours(endHour, endMin, 0, 0);
      }

      // Only update if values changed
      if (
        (!value.start || start.getTime() !== value.start.getTime()) ||
        (!value.end && end) ||
        (value.end && end && end.getTime() !== value.end.getTime())
      ) {
        onChange({ start, end });
      }
    }
  }, [selectedStartDate, selectedEndDate, startTime, endTime]);

  // Check if a date has blocked periods
  const isDateBlocked = (date: Date): boolean => {
    return blockedPeriods.some(period => 
      isWithinInterval(date, { start: period.start, end: period.end })
    );
  };

  // Check if a date is disabled
  const isDateDisabled = (date: Date): boolean => {
    if (isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    // Don't fully disable blocked dates, just show them differently
    return false;
  };

  // Calculate duration display
  const getDurationDisplay = (): string => {
    if (!value.start || !value.end) return '';
    
    const hours = differenceInHours(value.end, value.start);
    const days = differenceInDays(value.end, value.start);
    
    if (days >= 1) {
      const remainingHours = hours - (days * 24);
      if (remainingHours > 0) {
        return `${days} day${days > 1 ? 's' : ''}, ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
      }
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  // Custom day render for calendar
  const DayContent = ({ date }: { date: Date }) => {
    const isBlocked = isDateBlocked(date);
    const isSelected = selectedStartDate && isSameDay(date, selectedStartDate);
    const isEndSelected = selectedEndDate && isSameDay(date, selectedEndDate);
    const isInRange = selectedStartDate && selectedEndDate && 
      isWithinInterval(date, { start: selectedStartDate, end: selectedEndDate });

    return (
      <div className={cn(
        "relative w-full h-full flex items-center justify-center",
        isBlocked && "after:absolute after:inset-0 after:bg-red-100 after:dark:bg-red-900/30 after:rounded-md after:opacity-50"
      )}>
        <span className={cn(
          isInRange && !isSelected && !isEndSelected && "bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center"
        )}>
          {date.getDate()}
        </span>
        {isBlocked && (
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-500" />
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-1">Select Booking Period</h3>
        <p className="text-sm text-muted-foreground">
          Choose your start and end date/time
        </p>
      </div>

      {/* Date/Time Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Start Date/Time */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            Start
          </Label>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Date Picker */}
            <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
                    !selectedStartDate && "text-muted-foreground"
                  )}
                  disabled={disabled}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedStartDate ? format(selectedStartDate, 'EEE, MMM d') : 'Select date'}
                  <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedStartDate}
                  onSelect={(date) => {
                    setSelectedStartDate(date);
                    if (!selectedEndDate || (date && isBefore(selectedEndDate, date))) {
                      setSelectedEndDate(date);
                    }
                    setIsStartOpen(false);
                  }}
                  disabled={isDateDisabled}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Time Picker */}
            <Select value={startTime} onValueChange={setStartTime} disabled={disabled}>
              <SelectTrigger className="w-full sm:w-28">
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Arrow Indicator (desktop) */}
        <div className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* End Date/Time */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Moon className="w-4 h-4 text-indigo-500" />
            End
          </Label>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Date Picker */}
            <Popover open={isEndOpen} onOpenChange={setIsEndOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
                    !selectedEndDate && "text-muted-foreground"
                  )}
                  disabled={disabled || !selectedStartDate}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedEndDate ? format(selectedEndDate, 'EEE, MMM d') : 'Select date'}
                  <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedEndDate}
                  onSelect={(date) => {
                    setSelectedEndDate(date);
                    setIsEndOpen(false);
                  }}
                  disabled={(date) => 
                    isDateDisabled(date) || 
                    (selectedStartDate ? isBefore(date, selectedStartDate) : false)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Time Picker */}
            <Select value={endTime} onValueChange={setEndTime} disabled={disabled || !selectedEndDate}>
              <SelectTrigger className="w-full sm:w-28">
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent>
                {timeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Duration Badge */}
      {value.start && value.end && (
        <div className="flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Badge variant="secondary" className="px-4 py-2 text-sm font-medium bg-primary/10 text-primary">
            <Clock className="w-4 h-4 mr-2" />
            Duration: {getDurationDisplay()}
          </Badge>
        </div>
      )}

      {/* Blocked Periods Warning */}
      {blockedPeriods.length > 0 && value.start && value.end && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Some dates may have limited availability
              </p>
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                The vendor will confirm your booking request
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Duration Buttons */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quick select:</Label>
        <div className="flex flex-wrap gap-2">
          {[
            { label: '1 Hour', hours: 1, days: 0 },
            { label: '2 Hours', hours: 2, days: 0 },
            { label: '4 Hours', hours: 4, days: 0 },
            { label: '1 Day', hours: 0, days: 1 },
            { label: '3 Days', hours: 0, days: 3 },
            { label: '1 Week', hours: 0, days: 7 },
          ].map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={disabled || !selectedStartDate}
              onClick={() => {
                if (selectedStartDate) {
                  const [startHour, startMin] = startTime.split(':').map(Number);
                  const start = new Date(selectedStartDate);
                  start.setHours(startHour, startMin, 0, 0);
                  
                  const end = new Date(start);
                  if (preset.days > 0) {
                    end.setDate(end.getDate() + preset.days);
                  }
                  if (preset.hours > 0) {
                    end.setHours(end.getHours() + preset.hours);
                  }
                  
                  setSelectedEndDate(end);
                  setEndTime(format(end, 'HH:mm'));
                }
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DateTimeRangePicker;






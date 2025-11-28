/**
 * VendorAvailabilityCalendar Component
 * 
 * Allows vendors to:
 * - View their bookings on a calendar
 * - Block dates/times
 * - Set working hours
 * - Manage availability settings
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import {
  Calendar as CalendarIcon,
  Clock,
  Ban,
  Plus,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface CalendarBlock {
  id: string;
  startTime: Date;
  endTime: Date;
  blockType: string;
  title: string | null;
  reason: string | null;
  serviceId: string | null;
  isRecurring: boolean;
}

interface Booking {
  id: string;
  status: string;
  requestedStartTime: Date;
  requestedEndTime: Date;
  confirmedStartTime: Date | null;
  confirmedEndTime: Date | null;
  customer: {
    firstName: string;
    lastName: string;
  };
  service: {
    title: string;
  };
}

interface WorkingHours {
  [key: string]: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

interface VendorAvailabilityCalendarProps {
  serviceId?: string; // Optional: filter by service
  className?: string;
}

const DAYS_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_WORKING_HOURS: WorkingHours = {
  mon: { enabled: true, start: '09:00', end: '17:00' },
  tue: { enabled: true, start: '09:00', end: '17:00' },
  wed: { enabled: true, start: '09:00', end: '17:00' },
  thu: { enabled: true, start: '09:00', end: '17:00' },
  fri: { enabled: true, start: '09:00', end: '17:00' },
  sat: { enabled: false, start: '10:00', end: '14:00' },
  sun: { enabled: false, start: '10:00', end: '14:00' },
};

export function VendorAvailabilityCalendar({ serviceId, className }: VendorAvailabilityCalendarProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMonth, setViewMonth] = useState<Date>(new Date());
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newBlock, setNewBlock] = useState({
    startDate: new Date(),
    startTime: '09:00',
    endDate: new Date(),
    endTime: '17:00',
    blockType: 'unavailable',
    title: '',
    reason: '',
  });
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['vendor-availability-settings'],
    queryFn: async () => {
      const res = await fetch('/api/vendor/availability/settings');
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Fetch calendar blocks
  const { data: blocks, isLoading: blocksLoading } = useQuery<CalendarBlock[]>({
    queryKey: ['vendor-calendar-blocks', viewMonth.toISOString()],
    queryFn: async () => {
      const start = startOfMonth(viewMonth);
      const end = endOfMonth(viewMonth);
      const res = await fetch(
        `/api/vendor/calendar/blocks?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
      );
      if (!res.ok) throw new Error('Failed to fetch blocks');
      return res.json();
    },
  });

  // Fetch bookings
  const { data: bookings, isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['vendor-bookings', viewMonth.toISOString()],
    queryFn: async () => {
      const start = startOfMonth(viewMonth);
      const end = endOfMonth(viewMonth);
      const res = await fetch(
        `/api/vendor/bookings?startDate=${start.toISOString()}&endDate=${end.toISOString()}&limit=100`
      );
      if (!res.ok) throw new Error('Failed to fetch bookings');
      return res.json();
    },
  });

  // Create block mutation
  const createBlockMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/vendor/calendar/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create block');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-calendar-blocks'] });
      toast.success('Time blocked successfully');
      setIsBlockDialogOpen(false);
      resetBlockForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete block mutation
  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const res = await fetch(`/api/vendor/calendar/blocks/${blockId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete block');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-calendar-blocks'] });
      toast.success('Block removed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/vendor/availability/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-availability-settings'] });
      toast.success('Settings saved');
      setIsSettingsOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Reset block form
  const resetBlockForm = () => {
    setNewBlock({
      startDate: selectedDate,
      startTime: '09:00',
      endDate: selectedDate,
      endTime: '17:00',
      blockType: 'unavailable',
      title: '',
      reason: '',
    });
  };

  // Handle block creation
  const handleCreateBlock = () => {
    const [startHour, startMin] = newBlock.startTime.split(':').map(Number);
    const [endHour, endMin] = newBlock.endTime.split(':').map(Number);

    const startTime = new Date(newBlock.startDate);
    startTime.setHours(startHour, startMin, 0, 0);

    const endTime = new Date(newBlock.endDate);
    endTime.setHours(endHour, endMin, 0, 0);

    if (endTime <= startTime) {
      toast.error('End time must be after start time');
      return;
    }

    createBlockMutation.mutate({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      blockType: newBlock.blockType,
      title: newBlock.title || null,
      reason: newBlock.reason || null,
      serviceId: serviceId || null,
    });
  };

  // Get events for a specific date
  const getDateEvents = (date: Date) => {
    const dayBlocks = blocks?.filter(block => {
      const blockStart = new Date(block.startTime);
      const blockEnd = new Date(block.endTime);
      return isWithinInterval(date, { start: blockStart, end: blockEnd }) ||
             isSameDay(blockStart, date) ||
             isSameDay(blockEnd, date);
    }) || [];

    const dayBookings = bookings?.filter(booking => {
      const bookingStart = new Date(booking.confirmedStartTime || booking.requestedStartTime);
      const bookingEnd = new Date(booking.confirmedEndTime || booking.requestedEndTime);
      return isWithinInterval(date, { start: bookingStart, end: bookingEnd }) ||
             isSameDay(bookingStart, date) ||
             isSameDay(bookingEnd, date);
    }) || [];

    return { blocks: dayBlocks, bookings: dayBookings };
  };

  // Initialize working hours from settings
  useMemo(() => {
    if (settings?.defaultWorkingHours) {
      setWorkingHours(settings.defaultWorkingHours);
    }
  }, [settings]);

  // Calendar day modifier
  const getDayModifiers = useMemo(() => {
    const hasBlocks: Date[] = [];
    const hasBookings: Date[] = [];
    const hasPending: Date[] = [];

    blocks?.forEach(block => {
      const current = new Date(block.startTime);
      const end = new Date(block.endTime);
      while (current <= end) {
        hasBlocks.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    });

    bookings?.forEach(booking => {
      const start = new Date(booking.confirmedStartTime || booking.requestedStartTime);
      const end = new Date(booking.confirmedEndTime || booking.requestedEndTime);
      const current = new Date(start);
      while (current <= end) {
        if (booking.status === 'pending') {
          hasPending.push(new Date(current));
        } else if (['accepted', 'confirmed', 'in_progress'].includes(booking.status)) {
          hasBookings.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      }
    });

    return { hasBlocks, hasBookings, hasPending };
  }, [blocks, bookings]);

  const isLoading = settingsLoading || blocksLoading || bookingsLoading;

  const selectedDateEvents = getDateEvents(selectedDate);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Availability Calendar</h2>
          <p className="text-sm text-muted-foreground">
            Manage your schedule and block unavailable times
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Working Hours</DialogTitle>
                <DialogDescription>
                  Set your default availability for each day of the week
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                {DAYS_OF_WEEK.map((day, index) => (
                  <div key={day} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-24">
                      <Switch
                        checked={workingHours[day]?.enabled ?? false}
                        onCheckedChange={(checked) => 
                          setWorkingHours(prev => ({
                            ...prev,
                            [day]: { ...prev[day], enabled: checked }
                          }))
                        }
                      />
                      <Label className="text-sm">{DAY_LABELS[index]}</Label>
                    </div>
                    {workingHours[day]?.enabled && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={workingHours[day]?.start || '09:00'}
                          onChange={(e) =>
                            setWorkingHours(prev => ({
                              ...prev,
                              [day]: { ...prev[day], start: e.target.value }
                            }))
                          }
                          className="w-24"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={workingHours[day]?.end || '17:00'}
                          onChange={(e) =>
                            setWorkingHours(prev => ({
                              ...prev,
                              [day]: { ...prev[day], end: e.target.value }
                            }))
                          }
                          className="w-24"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button
                  onClick={() => saveSettingsMutation.mutate({ defaultWorkingHours: workingHours })}
                  disabled={saveSettingsMutation.isPending}
                >
                  {saveSettingsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Ban className="w-4 h-4 mr-2" />
                Block Time
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block Time</DialogTitle>
                <DialogDescription>
                  Mark a time period as unavailable for bookings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={format(newBlock.startDate, 'yyyy-MM-dd')}
                      onChange={(e) => setNewBlock(prev => ({
                        ...prev,
                        startDate: new Date(e.target.value)
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={newBlock.startTime}
                      onChange={(e) => setNewBlock(prev => ({
                        ...prev,
                        startTime: e.target.value
                      }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={format(newBlock.endDate, 'yyyy-MM-dd')}
                      onChange={(e) => setNewBlock(prev => ({
                        ...prev,
                        endDate: new Date(e.target.value)
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={newBlock.endTime}
                      onChange={(e) => setNewBlock(prev => ({
                        ...prev,
                        endTime: e.target.value
                      }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Block Type</Label>
                  <Select
                    value={newBlock.blockType}
                    onValueChange={(value) => setNewBlock(prev => ({
                      ...prev,
                      blockType: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                      <SelectItem value="holiday">Holiday</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title (optional)</Label>
                  <Input
                    placeholder="e.g., Vacation, Equipment maintenance"
                    value={newBlock.title}
                    onChange={(e) => setNewBlock(prev => ({
                      ...prev,
                      title: e.target.value
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reason (optional)</Label>
                  <Textarea
                    placeholder="Add any notes..."
                    rows={2}
                    value={newBlock.reason}
                    onChange={(e) => setNewBlock(prev => ({
                      ...prev,
                      reason: e.target.value
                    }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsBlockDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateBlock}
                  disabled={createBlockMutation.isPending}
                >
                  {createBlockMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4 mr-2" />
                  )}
                  Block Time
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-48 mx-auto" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                month={viewMonth}
                onMonthChange={setViewMonth}
                className="mx-auto"
                modifiers={{
                  hasBlocks: getDayModifiers.hasBlocks,
                  hasBookings: getDayModifiers.hasBookings,
                  hasPending: getDayModifiers.hasPending,
                }}
                modifiersClassNames={{
                  hasBlocks: "bg-red-100 dark:bg-red-900/30",
                  hasBookings: "bg-green-100 dark:bg-green-900/30",
                  hasPending: "bg-amber-100 dark:bg-amber-900/30",
                }}
              />
            )}

            {/* Legend */}
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 border border-green-500" />
                <span className="text-muted-foreground">Booked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-500" />
                <span className="text-muted-foreground">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 border border-red-500" />
                <span className="text-muted-foreground">Blocked</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Date Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              {format(selectedDate, 'EEEE, MMMM d')}
            </CardTitle>
            <CardDescription>
              {selectedDateEvents.blocks.length + selectedDateEvents.bookings.length} event(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bookings */}
            {selectedDateEvents.bookings.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Bookings
                </Label>
                {selectedDateEvents.bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className={cn(
                      "p-3 rounded-lg border",
                      booking.status === 'pending' && "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
                      ['accepted', 'confirmed'].includes(booking.status) && "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
                      booking.status === 'in_progress' && "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{booking.service.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {booking.customer.firstName} {booking.customer.lastName}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {booking.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(booking.confirmedStartTime || booking.requestedStartTime), 'HH:mm')} - 
                      {format(new Date(booking.confirmedEndTime || booking.requestedEndTime), 'HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Blocks */}
            {selectedDateEvents.blocks.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Blocked Times
                </Label>
                {selectedDateEvents.blocks.map((block) => (
                  <div
                    key={block.id}
                    className="p-3 rounded-lg border bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">
                          {block.title || block.blockType}
                        </p>
                        {block.reason && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {block.reason}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100"
                        onClick={() => deleteBlockMutation.mutate(block.id)}
                        disabled={deleteBlockMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(block.startTime), 'HH:mm')} - {format(new Date(block.endTime), 'HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {selectedDateEvents.blocks.length === 0 && selectedDateEvents.bookings.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No events on this day</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setNewBlock(prev => ({ ...prev, startDate: selectedDate, endDate: selectedDate }));
                    setIsBlockDialogOpen(true);
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Block this day
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default VendorAvailabilityCalendar;


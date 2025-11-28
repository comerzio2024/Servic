/**
 * Book Service Page - Enhanced
 * 
 * A comprehensive, responsive booking interface with:
 * - Multi-day date/time range selection
 * - Real-time pricing calculation
 * - Pricing breakdown display
 * - Service and vendor information
 * - Step-by-step booking flow
 */

import { useState, useEffect, useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DateTimeRangePicker } from '@/components/booking/DateTimeRangePicker';
import { PricingBreakdown } from '@/components/booking/PricingBreakdown';
import { PricingSelector } from '@/components/pricing/PricingSelector';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, type ServiceWithDetails } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, differenceInHours, differenceInDays } from 'date-fns';
import { 
  ArrowLeft, 
  ArrowRight,
  Calendar, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  MessageSquare,
  User,
  CreditCard,
  Loader2,
  Star,
  Shield,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface DateTimeRange {
  start: Date | null;
  end: Date | null;
}

interface PricingOption {
  id: string;
  serviceId: string;
  label: string;
  description: string | null;
  price: string;
  currency: string;
  billingInterval: string;
  durationMinutes: number | null;
  sortOrder: number;
  isActive: boolean;
}

interface PricingBreakdownData {
  totalHours: number;
  totalDays: number;
  fullDays: number;
  extraHours: number;
  baseCost: number;
  dailyCost: number;
  hourlyCost: number;
  surcharges: any[];
  discount: number;
  subtotal: number;
  platformFee: number;
  total: number;
  currency: string;
  lineItems: any[];
  calculationMethod: 'hourly' | 'daily' | 'mixed' | 'fixed';
}

const STEPS = [
  { id: 1, title: 'Select Time', icon: Calendar },
  { id: 2, title: 'Choose Package', icon: CreditCard },
  { id: 3, title: 'Your Details', icon: User },
  { id: 4, title: 'Confirm', icon: CheckCircle2 },
];

export default function BookServicePage() {
  const [match, params] = useRoute("/service/:id/book");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // State
  const [step, setStep] = useState(1);
  const [dateRange, setDateRange] = useState<DateTimeRange>({ start: null, end: null });
  const [selectedOption, setSelectedOption] = useState<PricingOption | null>(null);
  const [formData, setFormData] = useState({
    customerMessage: '',
    customerPhone: '',
    customerAddress: '',
  });

  const serviceId = params?.id;

  // Fetch service details
  const { data: service, isLoading: serviceLoading, error } = useQuery<ServiceWithDetails>({
    queryKey: [`/api/services/${serviceId}`],
    queryFn: () => apiRequest(`/api/services/${serviceId}`),
    enabled: !!serviceId,
  });

  // Fetch pricing breakdown
  const { data: pricingBreakdown, isLoading: pricingLoading } = useQuery<PricingBreakdownData>({
    queryKey: ['pricing-breakdown', serviceId, selectedOption?.id, dateRange.start?.toISOString(), dateRange.end?.toISOString()],
    queryFn: async () => {
      if (!dateRange.start || !dateRange.end) return null;
      
      const res = await fetch('/api/bookings/calculate-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          pricingOptionId: selectedOption?.id,
          startTime: dateRange.start.toISOString(),
          endTime: dateRange.end.toISOString(),
        }),
      });
      
      if (!res.ok) throw new Error('Failed to calculate price');
      return res.json();
    },
    enabled: !!serviceId && !!dateRange.start && !!dateRange.end,
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async () => {
      if (!dateRange.start || !dateRange.end) {
        throw new Error('Please select dates');
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          pricingOptionId: selectedOption?.id,
          requestedStartTime: dateRange.start.toISOString(),
          requestedEndTime: dateRange.end.toISOString(),
          customerMessage: formData.customerMessage,
          customerPhone: formData.customerPhone,
          customerAddress: formData.customerAddress,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create booking');
      }

      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Booking request sent!', {
        description: 'The vendor will review your request shortly.',
      });
      // Redirect to chat with vendor
      setLocation(`/chat?booking=${data.id}&vendor=${service?.ownerId}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Step navigation
  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return dateRange.start && dateRange.end;
      case 2:
        return true; // Package selection is optional
      case 3:
        return true; // Details are optional
      case 4:
        return dateRange.start && dateRange.end;
      default:
        return false;
    }
  }, [step, dateRange, selectedOption, formData]);

  const handleNext = () => {
    if (step < 4 && canProceed) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = () => {
    createBookingMutation.mutate();
  };

  // Duration display
  const getDurationDisplay = () => {
    if (!dateRange.start || !dateRange.end) return null;
    
    const hours = differenceInHours(dateRange.end, dateRange.start);
    const days = differenceInDays(dateRange.end, dateRange.start);
    
    if (days >= 1) {
      const remainingHours = hours - (days * 24);
      if (remainingHours > 0) {
        return `${days} day${days > 1 ? 's' : ''}, ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
      }
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  // Authentication check
  if (!authLoading && !isAuthenticated) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 py-8 md:py-12">
          <div className="container max-w-lg mx-auto px-4">
            <Card className="border-0 shadow-xl">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Sign In Required</h1>
                <p className="text-muted-foreground mb-6">
                  Please sign in to book this service
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <Button variant="outline" className="flex-1" onClick={() => setLocation(`/service/${serviceId}`)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button className="flex-1" onClick={() => setLocation('/login')}>
                    Sign In
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  // Loading state
  if (serviceLoading || authLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 py-8">
          <div className="container max-w-4xl mx-auto px-4">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Skeleton className="h-[500px] w-full rounded-xl" />
              </div>
              <div>
                <Skeleton className="h-[300px] w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (error || !service) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 py-8 md:py-12">
          <div className="container max-w-lg mx-auto px-4">
            <Card className="border-0 shadow-xl">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Service Not Found</h1>
                <p className="text-muted-foreground mb-6">
                  This service doesn't exist or has been removed
                </p>
                <Button onClick={() => setLocation('/')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  // Can't book own service
  if (user && service.ownerId === user.id) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 py-8 md:py-12">
          <div className="container max-w-lg mx-auto px-4">
            <Card className="border-0 shadow-xl">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Can't Book Your Own Service</h1>
                <p className="text-muted-foreground mb-6">
                  You cannot book a service that you own
                </p>
                <Button onClick={() => setLocation(`/service/${serviceId}`)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Service
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 py-6 md:py-8">
        <div className="container max-w-5xl mx-auto px-4">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <Button 
              variant="ghost" 
              size="sm"
              className="mb-4 -ml-2"
              onClick={() => setLocation(`/service/${serviceId}`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to {service.title}
            </Button>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Book Service</h1>
                <p className="text-muted-foreground mt-1">
                  Complete your booking in a few simple steps
                </p>
              </div>
              
              {/* Step Progress (Desktop) */}
              <div className="hidden md:flex items-center gap-2">
                {STEPS.map((s, index) => (
                  <div key={s.id} className="flex items-center">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all",
                      step === s.id 
                        ? "bg-primary text-white" 
                        : step > s.id 
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-slate-100 text-muted-foreground dark:bg-slate-800"
                    )}>
                      {step > s.id ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <s.icon className="w-4 h-4" />
                      )}
                      <span className="font-medium">{s.title}</span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Step Progress (Mobile) */}
            <div className="md:hidden mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Step {step} of 4</span>
                <span className="text-sm text-muted-foreground">{STEPS[step - 1].title}</span>
              </div>
              <Progress value={(step / 4) * 100} className="h-2" />
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Booking Steps */}
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-lg overflow-hidden">
                {/* Step 1: Date/Time Selection */}
                {step === 1 && (
                  <>
                    <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/30 dark:to-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle>Select Date & Time</CardTitle>
                          <CardDescription>Choose when you need this service</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <DateTimeRangePicker
                        value={dateRange}
                        onChange={setDateRange}
                        minDate={new Date()}
                      />
                    </CardContent>
                  </>
                )}

                {/* Step 2: Package Selection */}
                {step === 2 && (
                  <>
                    <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-white dark:from-purple-950/30 dark:to-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle>Choose a Package</CardTitle>
                          <CardDescription>Select the option that fits your needs (optional)</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <PricingSelector
                        serviceId={serviceId!}
                        selectedOptionId={selectedOption?.id || null}
                        onSelect={setSelectedOption}
                      />
                      {!selectedOption && (
                        <p className="text-sm text-muted-foreground text-center mt-4">
                          You can skip this step if no specific package is needed
                        </p>
                      )}
                    </CardContent>
                  </>
                )}

                {/* Step 3: Contact Details */}
                {step === 3 && (
                  <>
                    <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                          <User className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <CardTitle>Your Details</CardTitle>
                          <CardDescription>Help the vendor prepare for your booking</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          Phone Number
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+41 XX XXX XX XX"
                          value={formData.customerPhone}
                          onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="address" className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          Service Address
                        </Label>
                        <Input
                          id="address"
                          placeholder="Where should the service be provided?"
                          value={formData.customerAddress}
                          onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message" className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          Message to Vendor
                        </Label>
                        <Textarea
                          id="message"
                          placeholder="Any special requests or details?"
                          rows={4}
                          value={formData.customerMessage}
                          onChange={(e) => setFormData({ ...formData, customerMessage: e.target.value })}
                        />
                      </div>
                    </CardContent>
                  </>
                )}

                {/* Step 4: Confirmation */}
                {step === 4 && (
                  <>
                    <CardHeader className="border-b bg-gradient-to-r from-green-50 to-white dark:from-green-950/30 dark:to-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <CardTitle>Confirm Booking</CardTitle>
                          <CardDescription>Review your booking details</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      {/* Booking Summary */}
                      <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <Calendar className="w-5 h-5 text-primary mt-0.5" />
                          <div>
                            <p className="font-medium">Date & Time</p>
                            {dateRange.start && dateRange.end && (
                              <>
                                <p className="text-sm text-muted-foreground">
                                  {format(dateRange.start, 'EEEE, MMMM d, yyyy')} at {format(dateRange.start, 'HH:mm')}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  to {format(dateRange.end, 'EEEE, MMMM d, yyyy')} at {format(dateRange.end, 'HH:mm')}
                                </p>
                                <Badge variant="secondary" className="mt-2">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {getDurationDisplay()}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>

                        {selectedOption && (
                          <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                            <CreditCard className="w-5 h-5 text-primary mt-0.5" />
                            <div>
                              <p className="font-medium">Package</p>
                              <p className="text-sm text-muted-foreground">{selectedOption.label}</p>
                            </div>
                          </div>
                        )}

                        {(formData.customerPhone || formData.customerAddress || formData.customerMessage) && (
                          <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                            <User className="w-5 h-5 text-primary mt-0.5" />
                            <div className="space-y-1">
                              <p className="font-medium">Your Details</p>
                              {formData.customerPhone && (
                                <p className="text-sm text-muted-foreground">{formData.customerPhone}</p>
                              )}
                              {formData.customerAddress && (
                                <p className="text-sm text-muted-foreground">{formData.customerAddress}</p>
                              )}
                              {formData.customerMessage && (
                                <p className="text-sm text-muted-foreground italic">"{formData.customerMessage}"</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Trust badges */}
                      <div className="flex flex-wrap gap-3">
                        <Badge variant="outline" className="gap-1">
                          <Shield className="w-3 h-3" />
                          Secure booking
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <MessageSquare className="w-3 h-3" />
                          Direct vendor chat
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified vendor
                        </Badge>
                      </div>
                    </CardContent>
                  </>
                )}

                {/* Footer Navigation */}
                <CardFooter className="border-t bg-slate-50/50 dark:bg-slate-900/50 p-4 flex justify-between">
                  {step > 1 ? (
                    <Button variant="outline" onClick={handleBack}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => setLocation(`/service/${serviceId}`)}>
                      Cancel
                    </Button>
                  )}

                  {step < 4 ? (
                    <Button onClick={handleNext} disabled={!canProceed}>
                      {step === 2 && !selectedOption ? 'Skip' : 'Continue'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleSubmit}
                      disabled={createBookingMutation.isPending || !canProceed}
                      className="min-w-32"
                    >
                      {createBookingMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Request Booking
                        </>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>

            {/* Right Column - Service Info & Pricing */}
            <div className="space-y-6">
              {/* Service Card */}
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {service.images && service.images.length > 0 ? (
                      <a 
                        href={`/service/${serviceId}`}
                        className="block flex-shrink-0 rounded-lg overflow-hidden hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        <img 
                          src={service.images[0]} 
                          alt={service.title}
                          className="w-20 h-20 object-cover"
                        />
                      </a>
                    ) : (
                      <a 
                        href={`/service/${serviceId}`}
                        className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-8 h-8 text-muted-foreground" />
                      </a>
                    )}
                    <div className="min-w-0">
                      {/* Clickable Service Title */}
                      <a 
                        href={`/service/${serviceId}`}
                        className="font-semibold truncate block hover:text-primary hover:underline transition-colors cursor-pointer"
                        title={service.title}
                      >
                        {service.title}
                      </a>
                      {/* Clickable Vendor Name */}
                      <a 
                        href={`/vendors/${service.ownerId}`}
                        className="flex items-center gap-2 mt-1 group cursor-pointer"
                      >
                        <Avatar className="w-5 h-5 ring-1 ring-transparent group-hover:ring-primary/50 transition-all">
                          <AvatarImage src={service.owner.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {service.owner.firstName?.[0] || 'V'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground group-hover:text-primary group-hover:underline transition-colors">
                          {service.owner.firstName} {service.owner.lastName}
                        </span>
                      </a>
                      {service.rating && (
                        <div className="flex items-center gap-1 mt-2">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-medium">{service.rating}</span>
                          <span className="text-sm text-muted-foreground">
                            ({service.reviewCount || 0} reviews)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Base price: {service.currency || 'CHF'} {service.price}/{service.priceUnit || 'service'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Pricing Breakdown */}
              <PricingBreakdown
                breakdown={pricingBreakdown || null}
                isLoading={pricingLoading}
                showDetails={step >= 2}
              />

              {/* Help Card */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-4">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Need help?
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    After booking, you can chat directly with the vendor to discuss details.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

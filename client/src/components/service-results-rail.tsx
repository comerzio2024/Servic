import { ServiceCard } from "@/components/service-card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ServiceWithDetails } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ServiceResultsRailProps {
  services: (ServiceWithDetails & { distance?: number })[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  defaultExpanded?: boolean;
  dataTestIdPrefix?: string;
  isExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  useCompactCardsWhenCollapsed?: boolean;
  maxRows?: number;
  columnsPerRow?: number;
  alwaysUseGrid?: boolean;
}

export function ServiceResultsRail({
  services,
  isLoading = false,
  emptyMessage = "No services found",
  emptyDescription = "Try adjusting your search criteria",
  defaultExpanded = false,
  dataTestIdPrefix = "service",
  isExpanded: controlledIsExpanded,
  onExpandChange,
  useCompactCardsWhenCollapsed = false,
  maxRows = 0,
  columnsPerRow = 4,
  alwaysUseGrid = false,
}: ServiceResultsRailProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = controlledIsExpanded ?? internalExpanded;
  const handleExpandChange = (expanded: boolean) => {
    if (onExpandChange) {
      onExpandChange(expanded);
    } else {
      setInternalExpanded(expanded);
    }
  };

  // Calculate services to display based on maxRows
  const maxItemsToShow = maxRows > 0 ? maxRows * columnsPerRow : services.length;
  const displayedServices = (maxRows > 0 && !isExpanded) ? services.slice(0, maxItemsToShow) : services;
  const hasMoreToShow = maxRows > 0 && services.length > maxItemsToShow;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" data-testid={`${dataTestIdPrefix}-loading`} />
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center" data-testid={`${dataTestIdPrefix}-empty`}>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{emptyMessage}</h3>
        <p className="text-slate-500 text-sm">{emptyDescription}</p>
      </div>
    );
  }

  // Determine display mode: horizontal rail or grid
  const useHorizontalRail = !alwaysUseGrid && !isExpanded && useCompactCardsWhenCollapsed;

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {useHorizontalRail ? (
          <motion.div
            key="compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Scroll horizontally to see more services →
              </p>
              <span className="text-xs text-slate-500">
                {services.length} result{services.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="overflow-x-auto overflow-y-hidden -mx-4 px-4 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-primary/80 [&::-webkit-scrollbar-thumb]:transition-colors">
              <div className="flex gap-4 pb-4 min-w-min" data-testid={`${dataTestIdPrefix}-rail-compact`}>
                {displayedServices.map((service) => (
                  <motion.div
                    key={service.id}
                    className={cn(
                      "flex-shrink-0",
                      useCompactCardsWhenCollapsed ? "w-48" : "w-72"
                    )}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    data-testid={`${dataTestIdPrefix}-card-${service.id}`}
                  >
                    <ServiceCard service={service} compact={useCompactCardsWhenCollapsed} />
                  </motion.div>
                ))}
              </div>
            </div>
            {/* Fade gradient to indicate more content */}
            <div className="absolute right-0 top-12 bottom-16 w-24 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none" />
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid={`${dataTestIdPrefix}-rail-expanded`}>
              {displayedServices.map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  data-testid={`${dataTestIdPrefix}-card-${service.id}`}
                >
                  {/* Use compact cards on small screens (< sm breakpoint) */}
                  <div className="sm:hidden">
                    <ServiceCard service={service} compact={true} />
                  </div>
                  <div className="hidden sm:block">
                    <ServiceCard service={service} />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {services.length > 0 && hasMoreToShow && (
        <div className="flex justify-center pt-2">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExpandChange(!isExpanded)}
              className="gap-2 group relative overflow-hidden"
              data-testid={`${dataTestIdPrefix}-toggle-expand`}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex items-center"
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
              <motion.span
                key={isExpanded ? 'collapse' : 'expand'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {isExpanded ? 'Collapse' : `Expand (${services.length} services)`}
              </motion.span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

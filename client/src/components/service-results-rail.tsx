import { ServiceCard } from "@/components/service-card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ServiceWithDetails } from "@/lib/api";

interface ServiceResultsRailProps {
  services: (ServiceWithDetails & { distance?: number })[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  defaultExpanded?: boolean;
  dataTestIdPrefix?: string;
  isExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
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

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
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
            <div className="overflow-x-auto overflow-y-hidden -mx-4 px-4">
              <div className="flex gap-4 pb-4 min-w-min" data-testid={`${dataTestIdPrefix}-rail-compact`}>
                {services.map((service) => (
                  <motion.div
                    key={service.id}
                    className="w-72 flex-shrink-0"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    data-testid={`${dataTestIdPrefix}-card-${service.id}`}
                  >
                    <ServiceCard service={service} />
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
              {services.map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  data-testid={`${dataTestIdPrefix}-card-${service.id}`}
                >
                  <ServiceCard service={service} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {services.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExpandChange(!isExpanded)}
            className="gap-2"
            data-testid={`${dataTestIdPrefix}-toggle-expand`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Expand ({services.length} services)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

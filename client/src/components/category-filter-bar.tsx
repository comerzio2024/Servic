import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import type { CategoryWithTemporary } from "@/lib/api";
import { useState } from "react";

interface CategoryFilterBarProps {
  categories: CategoryWithTemporary[];
  selectedCategory: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  serviceCount?: number;
  categoryCounts?: Record<string, number>;
  newCounts?: Record<string, number>;
}

export function CategoryFilterBar({
  categories,
  selectedCategory,
  onCategoryChange,
  serviceCount = 0,
  categoryCounts = {},
  newCounts = {},
}: CategoryFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="w-full bg-white border-b sticky top-16 z-40 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">Categories</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 px-2 hover:bg-slate-100 transition-colors"
            data-testid="button-toggle-categories"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                <span className="text-xs">Hide</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                <span className="text-xs">Show</span>
              </>
            )}
          </Button>
        </div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-2 pb-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onCategoryChange(null)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0",
                selectedCategory === null
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
              data-testid="category-filter-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>All Services</span>
              <Badge
                variant={selectedCategory === null ? "secondary" : "outline"}
                className="ml-1"
              >
                {serviceCount}
              </Badge>
            </motion.button>

            {categories.map((category) => (
              <motion.button
                key={category.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onCategoryChange(category.id)}
                className={cn(
                  "relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0",
                  selectedCategory === category.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
                data-testid={`category-filter-${category.slug}`}
              >
                {newCounts[category.id] > 0 && (
                  <div className="absolute -top-2 -right-2 flex items-center justify-center">
                    <div className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {newCounts[category.id]}
                    </div>
                  </div>
                )}
                {category.icon && (
                  <span className="text-lg">{category.icon}</span>
                )}
                <span>{category.name}</span>
                <Badge
                  variant={selectedCategory === category.id ? "secondary" : "outline"}
                  className="ml-1"
                >
                  {categoryCounts[category.id] || 0}
                </Badge>
              </motion.button>
            ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

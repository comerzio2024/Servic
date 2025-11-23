import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import type { CategoryWithTemporary } from "@/lib/api";
import { useState, useMemo } from "react";

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
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Show first 5 categories in the first row, including "All Services"
  const firstRowCount = 5;
  const displayedCategories = useMemo(() => {
    if (showAllCategories) return categories;
    return categories.slice(0, firstRowCount - 1);
  }, [categories, showAllCategories]);

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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pt-2 pb-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onCategoryChange(null)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 px-3 py-3 rounded-lg border-2 transition-all text-center",
                    selectedCategory === null
                      ? "border-primary bg-primary/10"
                      : "border-slate-200 bg-slate-50 hover:border-primary/50 hover:bg-slate-100"
                  )}
                  data-testid="category-filter-all"
                >
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="text-xs font-semibold">All Services</span>
                  <Badge variant="secondary" className="mt-1">
                    {serviceCount}
                  </Badge>
                </motion.button>

                {displayedCategories.map((category) => (
                  <motion.button
                    key={category.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onCategoryChange(category.id)}
                    className={cn(
                      "relative flex flex-col items-center gap-2 px-3 py-3 rounded-lg border-2 transition-all text-center",
                      selectedCategory === category.id
                        ? "border-primary bg-primary/10"
                        : "border-slate-200 bg-slate-50 hover:border-primary/50 hover:bg-slate-100"
                    )}
                    data-testid={`category-filter-${category.slug}`}
                  >
                    {newCounts[category.id] > 0 && (
                      <div className="absolute -top-2 -right-2">
                        <div className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md">
                          {newCounts[category.id]}
                        </div>
                      </div>
                    )}
                    {category.icon && (
                      <span className="text-2xl">{category.icon}</span>
                    )}
                    <span className="text-xs font-semibold line-clamp-2">{category.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {categoryCounts[category.id] || 0}
                    </Badge>
                  </motion.button>
                ))}

                {!showAllCategories && categories.length > firstRowCount - 1 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAllCategories(true)}
                    className="relative flex flex-col items-center gap-2 px-3 py-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:border-primary/50 hover:bg-slate-100 transition-all text-center"
                    data-testid="button-show-more-categories"
                  >
                    <ChevronDown className="w-5 h-5 text-slate-500" />
                    <span className="text-xs font-semibold">Show More</span>
                    <span className="text-xs text-slate-500">
                      {categories.length - (firstRowCount - 1)} more
                    </span>
                  </motion.button>
                )}

                {showAllCategories && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAllCategories(false)}
                    className="relative flex flex-col items-center gap-2 px-3 py-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:border-primary/50 hover:bg-slate-100 transition-all text-center"
                    data-testid="button-show-less-categories"
                  >
                    <ChevronUp className="w-5 h-5 text-slate-500" />
                    <span className="text-xs font-semibold">Show Less</span>
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

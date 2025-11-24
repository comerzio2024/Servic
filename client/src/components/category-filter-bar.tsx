import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
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
  const [showAllCategories, setShowAllCategories] = useState(false);

  return (
    <div className="w-full bg-white border-b shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Filter by Category</h3>
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
              <div className="overflow-x-auto overflow-y-hidden pb-3 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-thumb]:transition-colors">
                <div className="flex gap-2 min-w-max">
                  {/* All Services Button */}
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onCategoryChange(null)}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all text-xs font-medium whitespace-nowrap",
                      selectedCategory === null
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                    )}
                    data-testid="category-filter-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    All Services
                  </motion.button>

                  {/* Category Buttons - Name Only */}
                  {(showAllCategories ? categories : categories.slice(0, 6)).map((category) => (
                    <motion.button
                      key={category.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onCategoryChange(category.id)}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all text-xs font-medium whitespace-nowrap",
                        selectedCategory === category.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                      )}
                      data-testid={`category-filter-${category.slug}`}
                    >
                      {category.name}
                    </motion.button>
                  ))}

                  {/* Show More/Less Button */}
                  {!showAllCategories && categories.length > 6 && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setShowAllCategories(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 transition-all text-sm font-medium whitespace-nowrap text-slate-600"
                      data-testid="button-show-more-categories"
                    >
                      <span>Show More</span>
                      <ChevronRight className="w-4 h-4" />
                      <span className="text-xs">+{categories.length - 6}</span>
                    </motion.button>
                  )}

                  {showAllCategories && categories.length > 6 && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setShowAllCategories(false)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 transition-all text-sm font-medium whitespace-nowrap text-slate-600"
                      data-testid="button-show-less-categories"
                    >
                      <ChevronUp className="w-4 h-4" />
                      <span>Show Less</span>
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

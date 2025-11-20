import { Layout } from "@/components/layout";
import { ServiceCard } from "@/components/service-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Sparkles, ArrowRight } from "lucide-react";
import heroImg from "@assets/generated_images/abstract_community_connection_hero_background.png";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, type ServiceWithDetails } from "@/lib/api";
import type { Category } from "@shared/schema";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => apiRequest("/api/categories"),
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services", { status: "active" }],
    queryFn: () => apiRequest("/api/services?status=active"),
  });

  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesSearch = service.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           service.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || service.category.slug === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [services, searchTerm, selectedCategory]);

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImg} 
            alt="Hero Background" 
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-slate-900/60 to-slate-50" />
        </div>

        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary-foreground text-sm font-medium mb-4 border border-primary/30 backdrop-blur-sm">
                <Sparkles className="w-4 h-4" />
                AI-Powered Marketplace
              </span>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 leading-tight">
                Find the perfect service for your next project
              </h1>
              <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
                Connect with trusted professionals who have been verified by our community. 
                From home repairs to digital design, we've got you covered.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white p-2 rounded-2xl shadow-2xl max-w-2xl mx-auto flex flex-col md:flex-row gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-muted-foreground w-5 h-5" />
                <Input 
                  placeholder="What service are you looking for?" 
                  className="pl-10 border-0 shadow-none text-slate-900 placeholder:text-slate-400 h-12 text-lg focus-visible:ring-0"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-home-search"
                />
              </div>
              <Button 
                size="lg" 
                className="h-12 px-8 text-lg font-semibold"
                onClick={() => {
                  // Scroll to services section
                  const servicesSection = document.querySelector('[data-testid="services-section"]');
                  servicesSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                data-testid="button-home-search"
              >
                Search
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Popular Categories</h2>
          <Button variant="link" className="text-primary">View All <ArrowRight className="w-4 h-4 ml-1" /></Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`p-6 rounded-xl border transition-all duration-200 flex flex-col items-center gap-3 hover:shadow-md ${selectedCategory === 'all' ? 'bg-primary text-white border-primary' : 'bg-white border-border hover:border-primary/50'}`}
          >
            <div className="p-3 rounded-full bg-background/10 backdrop-blur-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="font-medium">All Services</span>
          </button>
          
          {categoriesLoading ? (
            <div className="col-span-4 text-center text-muted-foreground">Loading categories...</div>
          ) : (
            categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`p-6 rounded-xl border transition-all duration-200 flex flex-col items-center gap-3 hover:shadow-md ${selectedCategory === cat.slug ? 'bg-primary text-white border-primary' : 'bg-white border-border hover:border-primary/50'}`}
              >
                <div className="p-3 rounded-full bg-secondary text-secondary-foreground">
                  <span className="text-xl">{cat.icon || '🛠️'}</span> 
                </div>
                <span className="font-medium">{cat.name}</span>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-12 bg-slate-50" data-testid="services-section">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Top Rated Services</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" /> Filter
              </Button>
            </div>
          </div>

          {servicesLoading ? (
            <div className="text-center py-20">
              <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-slate-400 animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Loading services...</h3>
            </div>
          ) : filteredServices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredServices.map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <ServiceCard service={service} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed">
              <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No services found</h3>
              <p className="text-slate-500">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

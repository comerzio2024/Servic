import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ServiceDetail from "@/pages/service-detail";
import Dashboard from "@/pages/dashboard";
import HowItWorks from "@/pages/how-it-works";
import HelpCenter from "@/pages/help-center";
import TrustSafety from "@/pages/trust-safety";
import Contact from "@/pages/contact";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import { AdminPage } from "@/pages/admin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/service/:id" component={ServiceDetail} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/categories" component={Home} /> {/* Reusing Home for now */}
      <Route path="/post-service" component={Dashboard} /> {/* Reusing Dashboard for now */}
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/help-center" component={HelpCenter} />
      <Route path="/trust-safety" component={TrustSafety} />
      <Route path="/contact" component={Contact} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

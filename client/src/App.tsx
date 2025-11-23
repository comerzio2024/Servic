import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FloatingChatWidget } from "@/components/floating-chat-widget";
import { usePageContext } from "@/hooks/use-page-context";
import { createContext, useContext } from "react";
import type { PageContextActions } from "@/hooks/use-page-context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ServiceDetail from "@/pages/service-detail";
import Dashboard from "@/pages/dashboard";
import Favorites from "@/pages/favorites";
import HowItWorks from "@/pages/how-it-works";
import HelpCenter from "@/pages/help-center";
import TrustSafety from "@/pages/trust-safety";
import Contact from "@/pages/contact";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import { AdminPage } from "@/pages/admin";
import HashtagResults from "@/pages/hashtag-results";
import UserProfile from "@/pages/user-profile";
import ProfileSettings from "@/pages/profile-settings";

// Create a context for the page context actions
export const PageContextActionsContext = createContext<PageContextActions | null>(null);

// Hook to access context actions from any component
export function usePageContextActions() {
  const context = useContext(PageContextActionsContext);
  if (!context) {
    throw new Error("usePageContextActions must be used within PageContextActionsProvider");
  }
  return context;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/service/:id" component={ServiceDetail} />
      <Route path="/users/:userId" component={UserProfile} />
      <Route path="/hashtags/:hashtag" component={HashtagResults} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/settings" component={ProfileSettings} />
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
  const [pageContext, contextActions] = usePageContext();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PageContextActionsContext.Provider value={contextActions}>
          <Toaster />
          <Router />
          <FloatingChatWidget pageContext={pageContext} />
        </PageContextActionsContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

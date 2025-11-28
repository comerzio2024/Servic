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
import Profile from "@/pages/profile";
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
import PlansPage from "@/pages/plans";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import VerifyEmailPage from "@/pages/verify-email";
import ReferralsPage from "@/pages/referrals";
import ChatPage from "@/pages/chat";
import VendorBookingsPage from "@/pages/vendor-bookings";
import BookServicePage from "@/pages/book-service";
import NotificationsPage from "@/pages/notifications";

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
      <Route path="/service/:id/book" component={BookServicePage} />
      <Route path="/users/:userId" component={UserProfile} />
      <Route path="/hashtags/:hashtag" component={HashtagResults} />
      <Route path="/profile" component={Profile} />
      <Route path="/dashboard" component={Profile} />
      <Route path="/settings" component={Profile} />
      <Route path="/plans" component={PlansPage} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/saved" component={Favorites} />
      <Route path="/categories" component={Home} />
      <Route path="/post-service" component={Profile} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/help-center" component={HelpCenter} />
      <Route path="/trust-safety" component={TrustSafety} />
      <Route path="/contact" component={Contact} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/admin" component={AdminPage} />
      {/* Authentication routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      {/* Referral routes */}
      <Route path="/referrals" component={ReferralsPage} />
      <Route path="/invite" component={ReferralsPage} />
      {/* Chat routes */}
      <Route path="/chat" component={ChatPage} />
      <Route path="/messages" component={ChatPage} />
      {/* Notification routes */}
      <Route path="/notifications" component={NotificationsPage} />
      {/* Vendor routes */}
      <Route path="/vendor/bookings" component={VendorBookingsPage} />
      <Route path="/my-bookings" component={VendorBookingsPage} />
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

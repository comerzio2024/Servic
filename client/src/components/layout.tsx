import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, PlusCircle, LogOut, Heart, Settings, User, Star, Gift, MessageCircle, Bell } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { CreateServiceModal } from "@/components/create-service-modal";
import { CategorySuggestionModal } from "@/components/category-suggestion-modal";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [showCreateService, setShowCreateService] = useState(false);
  const [showCategorySuggestion, setShowCategorySuggestion] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Smart navigation function for profile tabs
  const navigateToProfile = (tab?: string) => {
    const tabToUse = tab || 'profile';
    const newUrl = `/profile?tab=${tabToUse}`;
    // Use pushState to change URL and dispatch event so profile page detects the change
    window.history.pushState({ tab: tabToUse }, '', newUrl);
    // Dispatch custom event for profile page to listen
    window.dispatchEvent(new CustomEvent('profileTabChange', { detail: { tab: tabToUse } }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight cursor-pointer flex-shrink-0">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                <span className="text-lg">S</span>
              </div>
              <span className="hidden sm:inline">ServeMkt</span>
            </div>
          </Link>

          {/* Search - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md">
            <SearchAutocomplete />
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 flex-shrink-0">
            <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <Link href="/"><span className="hover:text-primary transition-colors cursor-pointer">Explore</span></Link>
              {isAuthenticated && user && (
                <Link href="/favorites"><span className="hover:text-primary transition-colors cursor-pointer">Saved</span></Link>
              )}
              <Link href="/how-it-works"><span className="hover:text-primary transition-colors cursor-pointer">How it Works</span></Link>
            </nav>

            <div className="flex items-center gap-4">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : isAuthenticated && user ? (
                <>
                  <Button 
                    variant="ghost" 
                    className="gap-2 hover:bg-slate-100 transition-colors cursor-pointer" 
                    data-testid="link-profile"
                    onClick={() => navigateToProfile()}
                  >
                    Profile
                  </Button>
                  <Button 
                    className="gap-2 shadow-md shadow-primary/20"
                    onClick={() => setShowCreateService(true)}
                    data-testid="button-post-service-header"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Post Service
                  </Button>
                  
                  {/* Chat Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative hover:bg-slate-100 transition-colors"
                    onClick={() => setLocation("/chat")}
                    aria-label="Messages"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </Button>

                  {/* Notification Bell */}
                  <NotificationBell />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 transition-colors cursor-pointer">
                        <img 
                          src={user.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} 
                          alt="User" 
                          className="w-8 h-8 rounded-full border border-border hover:ring-2 hover:ring-primary/20 transition-all"
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigateToProfile()} data-testid="menu-item-profile">
                        <User className="w-4 h-4 mr-2" />
                        Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigateToProfile('services')} data-testid="link-my-listings">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        My Listings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigateToProfile('reviews')} data-testid="menu-item-reviews">
                        <Star className="w-4 h-4 mr-2" />
                        Reviews
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation("/favorites")} data-testid="menu-item-saved">
                        <Heart className="w-4 h-4 mr-2" />
                        Saved
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation("/referrals")} data-testid="menu-item-referrals">
                        <Gift className="w-4 h-4 mr-2" />
                        Refer & Earn
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setLocation("/chat")} data-testid="menu-item-messages">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Messages
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation("/notifications")} data-testid="menu-item-notifications">
                        <Bell className="w-4 h-4 mr-2" />
                        Notifications
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigateToProfile('notifications')} data-testid="menu-item-notification-settings">
                        <Settings className="w-4 h-4 mr-2" />
                        Notification Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={async () => {
                          await fetch("/api/auth/logout", { method: "POST" });
                          window.location.href = "/";
                        }} 
                        className="text-destructive" 
                        data-testid="menu-item-logout"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Log out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/login">
                    <Button variant="ghost" data-testid="button-login">
                      Log in
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button data-testid="button-get-started">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Nav */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <div className="flex flex-col gap-6 mt-8">
                  <Link href="/"><span className="text-lg font-medium cursor-pointer">Explore</span></Link>
                  <Link href="/profile"><span className="text-lg font-medium cursor-pointer">Profile</span></Link>
                  <Link href="/favorites"><span className="text-lg font-medium cursor-pointer">Saved</span></Link>
                  <Link href="/how-it-works"><span className="text-lg font-medium cursor-pointer">How it Works</span></Link>
                  <div className="h-px bg-border my-2" />
                  {isAuthenticated && user && (
                    <>
                      <Link href="/chat">
                        <span className="text-lg font-medium cursor-pointer flex items-center gap-2">
                          <MessageCircle className="w-5 h-5" />
                          Messages
                        </span>
                      </Link>
                      <Link href="/notifications">
                        <span className="text-lg font-medium cursor-pointer flex items-center gap-2">
                          <Bell className="w-5 h-5" />
                          Notifications
                        </span>
                      </Link>
                      <div className="h-px bg-border my-2" />
                    </>
                  )}
                  <Button 
                    className="w-full" 
                    onClick={() => setShowCreateService(true)}
                    data-testid="button-post-service-mobile"
                  >
                    Post Service
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-white border-t py-12 mt-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center text-white text-xs">S</div>
                ServeMkt
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Connecting trusted professionals with people who need their skills. Simple, secure, and fast.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/"><span className="hover:text-primary cursor-pointer">Browse Services</span></Link></li>
                <li><Link href="/login"><span className="hover:text-primary cursor-pointer">Post a Service</span></Link></li>
                <li><Link href="/how-it-works"><span className="hover:text-primary cursor-pointer">How it Works</span></Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/help-center"><span className="hover:text-primary cursor-pointer">Help Center</span></Link></li>
                <li><Link href="/trust-safety"><span className="hover:text-primary cursor-pointer">Trust & Safety</span></Link></li>
                <li><Link href="/contact"><span className="hover:text-primary cursor-pointer">Contact Us</span></Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/terms"><span className="hover:text-primary cursor-pointer">Terms of Service</span></Link></li>
                <li><Link href="/privacy"><span className="hover:text-primary cursor-pointer">Privacy Policy</span></Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 text-center text-sm text-muted-foreground">
            © 2024 ServeMkt Inc. All rights reserved.
          </div>
        </div>
      </footer>
      <CreateServiceModal 
        open={showCreateService} 
        onOpenChange={(open) => {
          setShowCreateService(open);
          if (!open) {
            // Reset selected category when modal closes
            setSelectedCategoryId(null);
          }
        }}
        onSuggestCategory={() => setShowCategorySuggestion(true)}
        onCategoryCreated={setSelectedCategoryId}
        preselectedCategoryId={selectedCategoryId}
      />
      <CategorySuggestionModal 
        open={showCategorySuggestion} 
        onOpenChange={setShowCategorySuggestion}
        onCategoryCreated={(categoryId) => {
          setSelectedCategoryId(categoryId);
          setShowCategorySuggestion(false);
        }}
      />
    </div>
  );
}

/**
 * Chat Page
 * 
 * Full chat interface with conversation list and message window
 * Features:
 * - Centered chat panel with professional styling
 * - Product/seller context in header
 * - Responsive layout
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, Link } from 'wouter';
import { Layout } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { MessageSquare, ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  customerId: string;
  vendorId: string;
  bookingId: string | null;
  orderId: string | null;
  serviceId: string | null;
  status: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  customerUnreadCount: number;
  vendorUnreadCount: number;
  flaggedForReview: boolean;
  createdAt: string;
  // Extended fields for context
  service?: {
    id: string;
    title: string;
    images?: string[];
    price?: string;
    currency?: string;
  };
  vendor?: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  };
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  };
}

export default function ChatPage() {
  const [location] = useLocation();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isMobileViewingChat, setIsMobileViewingChat] = useState(false);

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const res = await fetch('/api/auth/user');
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Parse URL params for direct links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('booking');
    const orderId = params.get('order');
    const vendorId = params.get('vendor');

    // If we have a vendor ID, start or get a conversation
    if (vendorId && user) {
      fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          bookingId,
          orderId,
        }),
      })
        .then(res => res.json())
        .then(conversation => {
          setSelectedConversation(conversation);
          setIsMobileViewingChat(true);
        })
        .catch(console.error);
    }
  }, [location, user]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setIsMobileViewingChat(true);
  };

  const handleBackToList = () => {
    setIsMobileViewingChat(false);
    setSelectedConversation(null);
  };

  if (!user) {
    return (
      <Layout>
        <div className="container max-w-5xl py-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Sign in to view messages</p>
              <p className="text-sm">You need to be logged in to access your conversations</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const currentUserRole = selectedConversation?.customerId === user.id ? 'customer' : 'vendor';
  
  // Get the other party info
  const otherParty = currentUserRole === 'customer' 
    ? selectedConversation?.vendor 
    : selectedConversation?.customer;
  
  const otherPartyName = otherParty 
    ? `${otherParty.firstName} ${otherParty.lastName}` 
    : undefined;

  return (
    <Layout>
      <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-950/50 dark:to-slate-900">
        <div className="container max-w-7xl py-4 md:py-6 px-4">
          {/* Header */}
          <div className="mb-4 md:mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">Messages</h1>
            <p className="text-muted-foreground">
              Chat with vendors and customers
            </p>
          </div>

          {/* Desktop Layout - Centered chat panel */}
          <div className="hidden md:grid md:grid-cols-[300px_1fr] lg:grid-cols-[320px_1fr] gap-6 h-[calc(100vh-200px)]">
            {/* Conversation List - Fixed width sidebar */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <ConversationList
                currentUserId={user.id}
                selectedConversationId={selectedConversation?.id}
                onSelectConversation={handleSelectConversation}
                className="h-full"
              />
            </Card>

            {/* Chat Window - Centered with max-width */}
            <div className="flex justify-center">
              <div className="w-full max-w-[900px]">
                {selectedConversation ? (
                  <div className="h-full flex flex-col">
                    {/* Product Context Bar */}
                    {selectedConversation.service && (
                      <Card className="mb-3 border-0 shadow-md bg-gradient-to-r from-primary/5 to-transparent">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            {selectedConversation.service.images?.[0] ? (
                              <Link href={`/service/${selectedConversation.service.id}`}>
                                <img 
                                  src={selectedConversation.service.images[0]} 
                                  alt={selectedConversation.service.title}
                                  className="w-12 h-12 rounded-lg object-cover hover:opacity-80 transition-opacity cursor-pointer"
                                />
                              </Link>
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <Package className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <Link 
                                href={`/service/${selectedConversation.service.id}`}
                                className="font-medium text-sm hover:text-primary hover:underline transition-colors line-clamp-1"
                              >
                                {selectedConversation.service.title}
                              </Link>
                              {selectedConversation.service.price && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  {selectedConversation.service.currency || 'CHF'} {selectedConversation.service.price}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Chat Window with enhanced styling */}
                    <ChatWindow
                      conversationId={selectedConversation.id}
                      currentUserId={user.id}
                      currentUserRole={currentUserRole as 'customer' | 'vendor'}
                      otherPartyName={otherPartyName}
                      otherPartyImage={otherParty?.profileImageUrl}
                      className="flex-1 border-0 shadow-xl rounded-2xl overflow-hidden"
                    />
                  </div>
                ) : (
                  <Card className="h-full flex items-center justify-center border-0 shadow-lg rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
                    <CardContent className="text-center text-muted-foreground py-16">
                      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <MessageSquare className="w-12 h-12 text-primary/60" />
                      </div>
                      <p className="text-xl font-semibold mb-2">Select a conversation</p>
                      <p className="text-sm max-w-xs mx-auto">Choose a chat from the list to start messaging with vendors or customers</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="md:hidden h-[calc(100vh-160px)]">
            {!isMobileViewingChat ? (
              <Card className="h-full border-0 shadow-lg overflow-hidden">
                <ConversationList
                  currentUserId={user.id}
                  selectedConversationId={selectedConversation?.id}
                  onSelectConversation={handleSelectConversation}
                  className="h-full"
                />
              </Card>
            ) : selectedConversation ? (
              <div className="h-full flex flex-col">
                <Button
                  variant="ghost"
                  className="mb-2 self-start -ml-2"
                  onClick={handleBackToList}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to conversations
                </Button>
                
                {/* Mobile Product Context */}
                {selectedConversation.service && (
                  <Card className="mb-3 border-0 shadow-md">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        {selectedConversation.service.images?.[0] ? (
                          <Link href={`/service/${selectedConversation.service.id}`}>
                            <img 
                              src={selectedConversation.service.images[0]} 
                              alt={selectedConversation.service.title}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          </Link>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <Link 
                            href={`/service/${selectedConversation.service.id}`}
                            className="font-medium text-sm hover:text-primary line-clamp-1"
                          >
                            {selectedConversation.service.title}
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <ChatWindow
                  conversationId={selectedConversation.id}
                  currentUserId={user.id}
                  currentUserRole={currentUserRole as 'customer' | 'vendor'}
                  otherPartyName={otherPartyName}
                  otherPartyImage={otherParty?.profileImageUrl}
                  className="flex-1 border-0 shadow-lg rounded-xl"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Layout>
  );
}


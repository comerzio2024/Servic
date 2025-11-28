/**
 * ChatWindow Component
 * 
 * Displays messages in a conversation with real-time updates
 * Features: 
 * - Emoji support
 * - Improved styling with professional SaaS look
 * - Read receipts
 * - Clickable seller/product context
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageInput } from './MessageInput';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { 
  MessageSquare, 
  AlertTriangle, 
  Shield, 
  X, 
  MoreVertical,
  Flag,
  Trash2,
  Edit,
  Check,
  CheckCheck,
  Phone,
  Video,
  Info,
  ExternalLink,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'customer' | 'vendor' | 'system';
  content: string;
  originalContent: string | null;
  messageType: string;
  wasFiltered: boolean;
  filterReason: string | null;
  readAt: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
}

interface ServiceContext {
  id: string;
  title: string;
  images?: string[];
  price?: string;
  currency?: string;
}

interface VendorContext {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
}

interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
  currentUserRole: 'customer' | 'vendor';
  otherPartyName?: string;
  otherPartyImage?: string;
  otherPartyId?: string;
  service?: ServiceContext;
  onClose?: () => void;
  className?: string;
}

export function ChatWindow({
  conversationId,
  currentUserId,
  currentUserRole,
  otherPartyName,
  otherPartyImage,
  otherPartyId,
  service,
  onClose,
  className,
}: ChatWindowProps) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    refetchInterval: 3000, // Poll every 3 seconds
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/read`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to mark as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to send message');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete message mutation
  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete message');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      toast.success('Message deleted');
    },
    onError: () => {
      toast.error('Failed to delete message');
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0) {
      const hasUnread = messages.some(m => m.senderId !== currentUserId && !m.readAt);
      if (hasUnread) {
        markReadMutation.mutate();
      }
    }
  }, [messages, currentUserId]);

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return `Yesterday ${format(date, 'HH:mm')}`;
    return format(date, 'MMM d, HH:mm');
  };

  const shouldShowDateSeparator = (index: number) => {
    if (index === 0) return true;
    const current = new Date(messages[index].createdAt);
    const previous = new Date(messages[index - 1].createdAt);
    return !isSameDay(current, previous);
  };

  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d');
  };

  if (isLoading) {
    return (
      <Card className={cn("flex flex-col h-full", className)}>
        <CardHeader className="border-b p-4">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="flex-1 p-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "")}>
                <Skeleton className="h-16 w-48 rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine the profile link based on role
  const profileLink = currentUserRole === 'customer' 
    ? `/vendors/${otherPartyId}` 
    : `/profile/${otherPartyId}`;

  return (
    <Card className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* Header - Professional SaaS style */}
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 px-4 md:px-6 py-4 flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
          {/* Clickable Avatar */}
          <Link href={profileLink} className="relative flex-shrink-0 group">
            <Avatar className="h-11 w-11 md:h-12 md:w-12 ring-2 ring-white dark:ring-slate-700 shadow-md group-hover:ring-primary/50 transition-all">
              <AvatarImage src={otherPartyImage} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white font-semibold">
                {otherPartyName?.slice(0, 2).toUpperCase() || '??'}
              </AvatarFallback>
            </Avatar>
            {/* Online indicator */}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full" />
          </Link>
          
          <div className="flex-1 min-w-0">
            {/* Clickable Name */}
            <Link 
              href={profileLink}
              className="text-base md:text-lg font-semibold hover:text-primary hover:underline transition-colors line-clamp-1 flex items-center gap-1.5"
            >
              {otherPartyName || 'Chat'}
              <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
            </Link>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Online</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span>{currentUserRole === 'customer' ? 'Vendor' : 'Customer'}</span>
            </p>
            
            {/* Product Context - Compact pill */}
            {service && (
              <Link 
                href={`/service/${service.id}`}
                className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 bg-primary/10 hover:bg-primary/20 rounded-full text-xs text-primary transition-colors"
              >
                <Package className="w-3 h-3" />
                <span className="truncate max-w-[150px]">{service.title}</span>
                {service.price && (
                  <span className="font-medium">{service.currency || 'CHF'} {service.price}</span>
                )}
              </Link>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          {onClose && (
            <Button size="icon" variant="ghost" onClick={onClose} className="hover:bg-slate-100 dark:hover:bg-slate-700">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900/50 dark:to-slate-950">
        <div className="p-6 space-y-4 min-h-full">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-primary/60" />
              </div>
              <p className="font-medium text-lg">No messages yet</p>
              <p className="text-sm">Say hello and start the conversation! 👋</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwn = message.senderId === currentUserId;
              const isSystem = message.senderRole === 'system';
              const showAvatar = !isOwn && (index === 0 || messages[index - 1]?.senderId !== message.senderId);

              return (
                <div key={message.id}>
                  {/* Date Separator */}
                  {shouldShowDateSeparator(index) && (
                    <div className="flex items-center justify-center my-6">
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
                        <span className="px-4 py-1.5 bg-white dark:bg-slate-800 rounded-full text-xs font-medium text-muted-foreground shadow-sm border">
                          {formatDateSeparator(message.createdAt)}
                        </span>
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
                      </div>
                    </div>
                  )}

                  {/* System Message */}
                  {isSystem ? (
                    <div className="flex justify-center my-4">
                      <div className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-sm text-muted-foreground flex items-center gap-2 shadow-sm">
                        <Shield className="w-4 h-4 text-primary" />
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    /* Regular Message */
                    <div className={cn(
                      "flex items-end gap-2",
                      isOwn ? "justify-end" : "justify-start"
                    )}>
                      {/* Avatar for received messages */}
                      {!isOwn && (
                        <div className="w-8 flex-shrink-0">
                          {showAvatar && (
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={otherPartyImage} />
                              <AvatarFallback className="text-xs bg-slate-200 dark:bg-slate-700">
                                {otherPartyName?.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      )}
                      
                      <div className={cn(
                        "max-w-[70%] group relative",
                        isOwn ? "order-2" : "order-1"
                      )}>
                        <div className={cn(
                          "px-4 py-3 rounded-2xl shadow-sm transition-all",
                          isOwn 
                            ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md" 
                            : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-bl-md",
                          message.isDeleted && "italic opacity-70"
                        )}>
                          {message.wasFiltered && (
                            <div className={cn(
                              "flex items-center gap-1.5 text-xs mb-2 pb-2 border-b",
                              isOwn ? "border-white/20 text-white/70" : "border-slate-200 dark:border-slate-600 text-amber-600"
                            )}>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Message filtered</span>
                            </div>
                          )}
                          <p className={cn(
                            "text-[15px] leading-relaxed break-words whitespace-pre-wrap",
                            message.isDeleted && "text-muted-foreground"
                          )}>
                            {message.content}
                          </p>
                        </div>
                        
                        <div className={cn(
                          "flex items-center gap-1.5 mt-1.5 px-1 text-[11px] text-muted-foreground",
                          isOwn ? "justify-end" : "justify-start"
                        )}>
                          <span>{formatMessageDate(message.createdAt)}</span>
                          {message.isEdited && <span className="italic">(edited)</span>}
                          {isOwn && (
                            <span className={cn(
                              "flex items-center",
                              message.readAt ? "text-blue-500" : "text-muted-foreground"
                            )}>
                              {message.readAt 
                                ? <CheckCheck className="w-4 h-4" />
                                : <Check className="w-4 h-4" />
                              }
                            </span>
                          )}
                        </div>

                        {/* Message Actions */}
                        {isOwn && !message.isDeleted && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="absolute -left-9 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-32">
                              <DropdownMenuItem 
                                onClick={() => deleteMutation.mutate(message.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-white dark:bg-slate-900 p-4">
        <MessageInput
          onSend={(content) => sendMutation.mutate(content)}
          isLoading={sendMutation.isPending}
          placeholder="Type a message... 💬"
        />
      </div>
    </Card>
  );
}

export default ChatWindow;


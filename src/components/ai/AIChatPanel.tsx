// components/ai/AIChatPanel.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/client';

const PAGE_ROUTES: Record<string, string> = {
  'Dashboard': '/dashboard',
  'Contacts': '/contacts',
  'Campaigns': '/campaigns',
  'Agents': '/agents',
  'Call History': '/calls',
  'Calls': '/calls',
  'Calendar': '/calendar',
  'Voicemails': '/voicemails',
  'Follow-ups': '/follow-ups',
  'Follow-Ups': '/follow-ups',
  'Analytics': '/analytics',
  'Integrations': '/integrations',
  'Settings': '/settings',
  'Billing': '/settings?tab=billing',
};

// Convert bold page names like **Campaigns** into markdown links if the AI didn't already
function linkifyPageNames(content: string): string {
  let result = content;
  for (const [name, route] of Object.entries(PAGE_ROUTES)) {
    // Match **PageName** that isn't already inside a markdown link
    const boldPattern = new RegExp(`\\*\\*${name}\\*\\*(?!\\])`, 'g');
    result = result.replace(boldPattern, `[**${name}**](${route})`);
  }
  return result;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId: string;
  userName: string;
}

export default function AIChatPanel({ isOpen, onClose, userId, companyId, userName }: AIChatPanelProps) {
  const router = useRouter();
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, isMinimized]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      // @ts-ignore - ai_conversations table from new migration
      const { data } = await supabase
        .from('ai_conversations' as any)
        .select('id, title, created_at, updated_at')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (data) setConversations(data as any);
    } catch {
      // Table might not exist yet
    }
  }, [userId, companyId, supabase]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      // @ts-ignore - ai_messages table from new migration
      const { data } = await supabase
        .from('ai_messages' as any)
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (data) setMessages(data as any);
    } catch {
      // Table might not exist yet
    }
  }, [supabase]);

  useEffect(() => {
    if (isOpen) loadConversations();
  }, [isOpen, loadConversations]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId, loadMessages]);

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          conversationId: activeConversationId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: data.messageId || `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update conversation ID if new conversation was created
      if (data.conversationId && !activeConversationId) {
        setActiveConversationId(data.conversationId);
        loadConversations();
      }
    } catch {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  // Minimized floating tab
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 bg-white rounded-2xl shadow-xl border border-slate-200 hover:shadow-2xl hover:scale-[1.02] transition-all group"
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-purple-600 flex items-center justify-center shadow-sm">
          <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-slate-700 group-hover:text-[var(--color-primary)] transition-colors">Cali</span>
        {messages.length > 0 && (
          <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
        )}
      </button>
    );
  }

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-[60] w-[400px] max-w-[calc(100vw-48px)] flex flex-col bg-white border-l border-slate-200 shadow-2xl"
      style={{ animation: 'slideInFromRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-[var(--color-primary-50)] via-white to-purple-50/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-purple-600 flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cali</h3>
              <p className="text-[10px] text-slate-400 font-medium">AI Assistant &middot; Online</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-1.5 rounded-lg transition-colors ${showHistory ? 'text-[var(--color-primary)] bg-[var(--color-primary-50)]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              title="Chat history"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={startNewConversation}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="New conversation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Minimize"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="border-b border-slate-100 max-h-52 overflow-y-auto bg-slate-50/80 animate-slideDown shrink-0">
          <div className="p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Recent Conversations</p>
            {conversations.length === 0 ? (
              <p className="text-xs text-slate-400 px-1 py-2">No conversations yet</p>
            ) : (
              <div className="space-y-0.5">
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setActiveConversationId(conv.id);
                      setShowHistory(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      activeConversationId === conv.id
                        ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)] font-semibold'
                        : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    <p className="truncate font-medium">{conv.title || 'New conversation'}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(conv.updated_at)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-primary-50)] to-purple-50 flex items-center justify-center mb-4 border border-[var(--color-primary)]/10 shadow-sm">
              <svg className="w-8 h-8 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-1">Hey {userName.split(' ')[0] || 'there'}!</h4>
            <p className="text-xs text-slate-500 max-w-[280px] leading-relaxed mb-1">
              I&apos;m <span className="font-semibold text-[var(--color-primary)]">Cali</span>, your AI assistant.
            </p>
            <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed">
              Ask me anything about your campaigns, calls, contacts, or how to use any feature.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-5 w-full max-w-[320px]">
              {[
                { text: 'How are my campaigns?', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
                { text: 'Show call analytics', icon: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z' },
                { text: 'Create a new agent', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
                { text: 'What integrations exist?', icon: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244' },
              ].map((suggestion) => (
                <button
                  key={suggestion.text}
                  onClick={() => {
                    setInput(suggestion.text);
                    setTimeout(() => handleSend(), 0);
                  }}
                  className="flex items-center gap-2.5 text-left px-3 py-2.5 text-[11px] text-slate-600 bg-slate-50 hover:bg-[var(--color-primary-50)] hover:text-[var(--color-primary)] border border-slate-200 hover:border-[var(--color-primary-200)] rounded-xl transition-all leading-snug group"
                >
                  <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--color-primary)] transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={suggestion.icon} />
                  </svg>
                  {suggestion.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[var(--color-primary)] to-purple-600 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Cali</span>
                </div>
              )}
              <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-[var(--color-primary)] to-purple-600 text-white rounded-tr-md shadow-sm'
                  : 'bg-slate-100 text-slate-800 rounded-tl-md'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="cali-markdown prose prose-sm prose-slate max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_pre]:bg-slate-200 [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:text-xs [&_code]:bg-slate-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:text-slate-700 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_strong]:font-semibold [&_a]:text-[var(--color-primary)] [&_a]:underline [&_a]:cursor-pointer [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600 [&_hr]:my-2">
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => {
                          const isInternal = href?.startsWith('/');
                          if (isInternal) {
                            return (
                              <a
                                href={href}
                                onClick={(e) => {
                                  e.preventDefault();
                                  router.push(href!);
                                  onClose();
                                }}
                              >
                                {children}
                              </a>
                            );
                          }
                          return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                        },
                      }}
                    >
                      {linkifyPageNames(msg.content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
              <p className={`text-[10px] text-slate-400 mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                {formatTime(msg.created_at)}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[var(--color-primary)] to-purple-600 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Cali is thinking...</span>
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]"></div>
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]"></div>
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-100 bg-white shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Cali anything..."
            rows={1}
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all max-h-24 overflow-y-auto"
            style={{ minHeight: '40px' }}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-purple-600 text-white shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 text-center">
          Powered by AI &middot; Knows your Callengo data
        </p>
      </div>
    </div>
  );
}

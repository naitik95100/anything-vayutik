import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'image' | 'video';
  url?: string;
  timestamp: number;
  bookmarked?: boolean;
  reaction?: 'like' | 'dislike' | null;
  model?: string;
  tokens?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  starred: boolean;
  provider: string;
}

export interface AppSettings {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  theme: 'light' | 'dark';
  fontSize: 'sm' | 'md' | 'lg';
  showTimestamps: boolean;
  streamMode: boolean;
}

interface AppState {
  conversations: Conversation[];
  activeConversationId: string | null;
  apiKeys: Record<string, string>;
  selectedProvider: string;
  settings: AppSettings;

  // Conversation actions
  createConversation: (provider?: string) => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  pinConversation: (id: string) => void;
  starConversation: (id: string) => void;
  setActiveConversation: (id: string) => void;

  // Message actions
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  deleteMessage: (messageId: string) => void;
  bookmarkMessage: (messageId: string) => void;
  reactToMessage: (messageId: string, reaction: 'like' | 'dislike' | null) => void;
  clearHistory: () => void;
  updateConversationTitle: (id: string, firstMessage: string) => void;

  // API key actions
  setApiKey: (provider: string, key: string) => void;
  deleteApiKey: (provider: string) => void;

  // Provider & settings actions
  setSelectedProvider: (provider: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function generateTitle(content: string): string {
  const cleaned = content.replace(/\/\w+\s/, '').trim();
  return cleaned.length > 40 ? cleaned.slice(0, 40) + '…' : cleaned || 'New Conversation';
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      apiKeys: {},
      selectedProvider: 'google-gemini',
      settings: {
        temperature: 0.7,
        maxTokens: 2048,
        systemPrompt: 'You are a helpful, accurate, and concise AI assistant.',
        theme: 'light',
        fontSize: 'md',
        showTimestamps: true,
        streamMode: false,
      },

      createConversation: (provider) => {
        const id = generateId();
        const { selectedProvider } = get();
        const newConv: Conversation = {
          id,
          title: 'New Conversation',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pinned: false,
          starred: false,
          provider: provider || selectedProvider,
        };
        set((state) => ({
          conversations: [newConv, ...state.conversations],
          activeConversationId: id,
        }));
        return id;
      },

      deleteConversation: (id) => {
        set((state) => {
          const remaining = state.conversations.filter((c) => c.id !== id);
          const newActive =
            state.activeConversationId === id
              ? (remaining[0]?.id ?? null)
              : state.activeConversationId;
          return { conversations: remaining, activeConversationId: newActive };
        });
      },

      renameConversation: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
        }));
      },

      pinConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned } : c
          ),
        }));
      },

      starConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, starred: !c.starred } : c
          ),
        }));
      },

      setActiveConversation: (id) => {
        set({ activeConversationId: id });
      },

      addMessage: (message) => {
        const { activeConversationId } = get();
        if (!activeConversationId) return;
        const msg: Message = {
          ...message,
          id: generateId(),
          timestamp: Date.now(),
        };
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== activeConversationId) return c;
            const msgs = [...c.messages, msg];
            // Auto-title from first user message
            const title =
              c.messages.length === 0 && message.role === 'user'
                ? generateTitle(message.content)
                : c.title;
            return { ...c, messages: msgs, title, updatedAt: Date.now() };
          }),
        }));
      },

      deleteMessage: (messageId) => {
        const { activeConversationId } = get();
        if (!activeConversationId) return;
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === activeConversationId
              ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) }
              : c
          ),
        }));
      },

      bookmarkMessage: (messageId) => {
        const { activeConversationId } = get();
        if (!activeConversationId) return;
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === activeConversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, bookmarked: !m.bookmarked } : m
                  ),
                }
              : c
          ),
        }));
      },

      reactToMessage: (messageId, reaction) => {
        const { activeConversationId } = get();
        if (!activeConversationId) return;
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === activeConversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) => (m.id === messageId ? { ...m, reaction } : m)),
                }
              : c
          ),
        }));
      },

      clearHistory: () => {
        const { activeConversationId } = get();
        if (!activeConversationId) return;
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === activeConversationId ? { ...c, messages: [], title: 'New Conversation' } : c
          ),
        }));
      },

      updateConversationTitle: (id, firstMessage) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title: generateTitle(firstMessage) } : c
          ),
        }));
      },

      setApiKey: (provider, key) => {
        set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } }));
      },

      deleteApiKey: (provider) => {
        set((state) => {
          const newKeys = { ...state.apiKeys };
          delete newKeys[provider];
          return { apiKeys: newKeys };
        });
      },

      setSelectedProvider: (provider) => {
        set({ selectedProvider: provider });
      },

      updateSettings: (newSettings) => {
        set((state) => ({ settings: { ...state.settings, ...newSettings } }));
      },
    }),
    {
      name: 'ai-nexus-storage',
    }
  )
);

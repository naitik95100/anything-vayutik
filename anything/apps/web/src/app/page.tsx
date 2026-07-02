'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  Send,
  Trash2,
  Star,
  Pin,
  Copy,
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Download,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Keyboard,
  Image as ImageIcon,
  Video as VideoIcon,
  Key,
  MessageSquare,
  MoreHorizontal,
  ArrowDown,
  Hash,
  Slash,
  FileText,
  Zap,
  RotateCcw,
  Share2,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Globe,
  Volume2,
  Menu,
  Settings,
  Layers,
} from 'lucide-react';
import { PROVIDERS, PROMPT_TEMPLATES, KEYBOARD_SHORTCUTS } from '@/constants/providers';
import { useStore, type Message, type Conversation } from '@/utils/store';
import { formatTime, currentISOString } from '@/utils/dates';
import CodeBlock from '@/components/CodeBlock';
import AudioPlayer from '@/components/AudioPlayer';
import { toast } from 'sonner';

const EMPTY_MSGS: Message[] = [];
const CODE_FENCE = '```';

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

// ─── TIMESTAMP (client-only) ──────────────────────────────────────────────────
function ClientTimestamp({ ts, className }: { ts: number; className?: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    setLabel(formatTime(ts));
  }, [ts]);
  if (!label) return null;
  return <span className={className}>{label}</span>;
}

// ─── PROVIDER ICON ────────────────────────────────────────────────────────────
function ProviderIcon({
  domain,
  name,
  size = 28,
}: {
  domain: string;
  name: string;
  size?: number;
}) {
  const [err, setErr] = useState(false);
  return err ? (
    <div
      style={{ width: size, height: size }}
      className="bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 flex-shrink-0"
    >
      {name.charAt(0)}
    </div>
  ) : (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
      alt={name}
      style={{ width: size, height: size }}
      className="rounded-lg object-contain flex-shrink-0"
      onError={() => setErr(true)}
    />
  );
}

// ─── TYPING DOTS ──────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"
          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── CONTENT PARSER ───────────────────────────────────────────────────────────
interface ContentPart {
  type: 'text' | 'code';
  content: string;
  lang: string;
}

function parseContent(raw: string): ContentPart[] {
  const parts: ContentPart[] = [];
  // Build regex from string to avoid tooling issues with backtick regex literals
  const fencePattern = CODE_FENCE + '(\\w*)\\n?([\\s\\S]*?)' + CODE_FENCE;
  const regex = new RegExp(fencePattern, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex)
      parts.push({ type: 'text', content: raw.slice(lastIndex, match.index), lang: '' });
    parts.push({ type: 'code', lang: match[1] || 'code', content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < raw.length) parts.push({ type: 'text', content: raw.slice(lastIndex), lang: '' });
  return parts.length ? parts : [{ type: 'text', content: raw, lang: '' }];
}

// ─── MESSAGE CONTENT RENDERER ─────────────────────────────────────────────────
function MessageContent({ message, isUser }: { message: Message; isUser: boolean }) {
  if (message.type === 'image' && message.url) {
    return (
      <div className="space-y-2">
        <p className="text-xs opacity-70 italic">{message.content}</p>
        <img
          src={message.url}
          alt="AI Generated"
          className="rounded-xl w-full max-w-xs md:max-w-sm border border-gray-200 dark:border-gray-700 shadow-lg"
        />
        <a
          href={message.url}
          download="ai-image.png"
          className="flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity"
        >
          <Download size={12} />
          Download
        </a>
      </div>
    );
  }
  if (message.type === 'video' && message.url) {
    return (
      <div className="space-y-2">
        <p className="text-xs opacity-70 italic">{message.content}</p>
        <video
          src={message.url}
          controls
          autoPlay
          loop
          muted
          className="rounded-xl w-full max-w-xs md:max-w-sm border border-gray-200 dark:border-gray-700 shadow-lg"
        />
      </div>
    );
  }
  if (message.type === 'audio') {
    return (
      <div className="space-y-2">
        <p className="text-xs opacity-70 italic mb-2">Generated audio — click play to listen</p>
        <AudioPlayer text={message.content} className="max-w-xs md:max-w-sm" />
      </div>
    );
  }
  const parts = parseContent(message.content);
  const hasCode = parts.some((p) => p.type === 'code');
  return (
    <div className={cn('space-y-1', !isUser && hasCode ? 'w-full' : '')}>
      {parts.map((part, i) =>
        part.type === 'code' ? (
          <CodeBlock key={i} code={part.content} lang={part.lang} />
        ) : (
          <p key={i} className="whitespace-pre-wrap leading-relaxed">
            {part.content}
          </p>
        )
      )}
    </div>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
function EmptyState({ onCmd }: { onCmd: (s: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center select-none"
    >
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.06, 1], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="w-20 h-20 md:w-24 md:h-24 bg-black dark:bg-white rounded-3xl flex items-center justify-center shadow-2xl"
        >
          <Sparkles size={36} className="text-white dark:text-black" />
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0.4, 0.15] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="absolute inset-0 bg-black/10 dark:bg-white/10 rounded-3xl -z-10 blur-2xl"
        />
      </div>
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Start a Conversation
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs leading-relaxed">
          Choose a provider, add your API key, then chat. Type{' '}
          <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">/</span> for all
          commands.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {[
          '/image a neon city',
          '/video aurora borealis',
          '/audio explain quantum AI',
          'How does React work?',
        ].map((s) => (
          <button
            key={s}
            onClick={() => onCmd(s)}
            className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 font-mono transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── COMMAND MENU ─────────────────────────────────────────────────────────────
const COMMANDS = [
  { cmd: '/image', label: 'Generate Image', icon: ImageIcon, desc: 'Create an AI image from text' },
  { cmd: '/imagine', label: 'Imagine Scene', icon: Sparkles, desc: 'Visualize any concept' },
  { cmd: '/video', label: 'Generate Video', icon: VideoIcon, desc: 'Create a short video clip' },
  { cmd: '/audio', label: 'Generate Audio', icon: Volume2, desc: 'Create spoken audio narration' },
  { cmd: '/code', label: 'Write Code', icon: Hash, desc: 'Generate code with live preview' },
  { cmd: '/summarize', label: 'Summarize', icon: FileText, desc: 'Summarize text or document' },
  { cmd: '/translate', label: 'Translate', icon: Globe, desc: 'Translate to any language' },
];

function CommandMenu({ onSelect }: { onSelect: (cmd: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="absolute bottom-full left-0 mb-2 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50"
    >
      <div className="p-1.5">
        {COMMANDS.map(({ cmd, label, icon: Icon, desc }) => (
          <button
            key={cmd}
            onClick={() => onSelect(cmd + ' ')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
          >
            <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon size={14} className="text-white dark:text-black" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {label} <span className="font-mono text-xs text-gray-400">{cmd}</span>
              </div>
              <div className="text-xs text-gray-500 truncate">{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
function MessageBubble({
  message,
  showTimestamps,
  onDelete,
  onBookmark,
  onReact,
  onRegenerate,
  isLast,
}: {
  message: Message;
  showTimestamps: boolean;
  onDelete: () => void;
  onBookmark: () => void;
  onReact: (r: 'like' | 'dislike' | null) => void;
  onRegenerate?: () => void;
  isLast: boolean;
}) {
  const [hover, setHover] = useState(false);
  const isUser = message.role === 'user';
  const hasCodeParts =
    message.type === 'code' || parseContent(message.content).some((p) => p.type === 'code');

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => toast.success('Copied!'));
  };

  const actionBtns = [
    { title: 'Copy', icon: <Copy size={11} />, fn: handleCopy },
    {
      title: message.bookmarked ? 'Unbookmark' : 'Bookmark',
      icon: (
        <Bookmark size={11} className={message.bookmarked ? 'fill-black dark:fill-white' : ''} />
      ),
      fn: onBookmark,
    },
    {
      title: 'Like',
      icon: <ThumbsUp size={11} className={message.reaction === 'like' ? 'text-green-500' : ''} />,
      fn: () => onReact(message.reaction === 'like' ? null : 'like'),
    },
    {
      title: 'Dislike',
      icon: (
        <ThumbsDown size={11} className={message.reaction === 'dislike' ? 'text-red-500' : ''} />
      ),
      fn: () => onReact(message.reaction === 'dislike' ? null : 'dislike'),
    },
    ...(!isUser && isLast && onRegenerate
      ? [{ title: 'Regenerate', icon: <RefreshCw size={11} />, fn: onRegenerate }]
      : []),
    { title: 'Delete', icon: <Trash2 size={11} className="text-red-500" />, fn: onDelete },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('group flex gap-2 md:gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      <div
        className={cn(
          'w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] md:text-xs font-bold mt-1',
          isUser
            ? 'bg-black dark:bg-white text-white dark:text-black'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
        )}
      >
        {isUser ? 'U' : 'AI'}
      </div>
      <div
        className={cn(
          'flex flex-col gap-1',
          isUser ? 'items-end' : 'items-start',
          hasCodeParts ? 'max-w-[95%] w-full' : 'max-w-[82%] md:max-w-[75%]'
        )}
      >
        {showTimestamps && (
          <ClientTimestamp ts={message.timestamp} className="text-[10px] text-gray-400 px-1" />
        )}
        <div
          className={cn(
            'rounded-2xl px-3 md:px-4 py-2.5 md:py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-black dark:bg-white text-white dark:text-black rounded-tr-sm'
              : hasCodeParts
                ? 'bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white rounded-tl-sm border border-gray-200 dark:border-gray-700 w-full'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-sm border border-gray-200 dark:border-gray-700'
          )}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <MessageContent message={message} isUser={isUser} />
        </div>
        <AnimatePresence>
          {(hover || message.bookmarked || message.reaction) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={cn(
                'flex items-center gap-0.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-1.5 py-1 shadow-md',
                isUser ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {actionBtns.map(({ title, icon, fn }) => (
                <button
                  key={title}
                  title={title}
                  onClick={fn}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {icon}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── CONVERSATION ITEM ────────────────────────────────────────────────────────
function ConversationItem({
  conv,
  isActive,
  isRenaming,
  renameVal,
  showMenu,
  onSelect,
  onMenuToggle,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onPin,
  onStar,
  onDelete,
}: {
  conv: Conversation;
  isActive: boolean;
  isRenaming: boolean;
  renameVal: string;
  showMenu: boolean;
  onSelect: () => void;
  onMenuToggle: () => void;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onPin: () => void;
  onStar: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onSelect}
        onDoubleClick={onRenameStart}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all',
          isActive
            ? 'bg-black dark:bg-white text-white dark:text-black'
            : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
        )}
      >
        <MessageSquare size={13} className="flex-shrink-0 opacity-60" />
        {isRenaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameSubmit();
              if (e.key === 'Escape') onRenameCancel();
            }}
            onBlur={onRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent outline-none text-xs font-medium border-b border-current"
          />
        ) : (
          <span className="flex-1 text-xs font-medium truncate">{conv.title}</span>
        )}
        <div className="flex gap-0.5 flex-shrink-0">
          {conv.pinned && <Pin size={9} className="opacity-60" />}
          {conv.starred && <Star size={9} className="opacity-60 fill-current" />}
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMenuToggle();
        }}
        className={cn(
          'absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-opacity opacity-0 group-hover:opacity-100',
          isActive
            ? 'text-white/70 hover:bg-white/10'
            : 'text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700'
        )}
      >
        <MoreHorizontal size={12} />
      </button>
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute left-full top-0 ml-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {[
              { icon: FileText, label: 'Rename', fn: onRenameStart },
              { icon: Pin, label: conv.pinned ? 'Unpin' : 'Pin', fn: onPin },
              { icon: Star, label: conv.starred ? 'Unstar' : 'Star', fn: onStar },
              { icon: Trash2, label: 'Delete', fn: onDelete, danger: true },
            ].map(({ icon: Icon, label, fn, danger }) => (
              <button
                key={label}
                onClick={(e) => {
                  e.stopPropagation();
                  fn();
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                  danger ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'
                )}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      {/* Mobile bottom sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30 }}
        className="md:hidden relative w-full bg-white dark:bg-gray-900 rounded-t-3xl border-t border-gray-200 dark:border-gray-700 max-h-[85vh] flex flex-col z-10"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-bold text-base text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </motion.div>
      {/* Desktop dialog */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        className="hidden md:flex relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[80vh] flex-col z-10"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h2 className="font-bold text-base text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 scrollbar-thin">{children}</div>
      </motion.div>
    </div>
  );
}

// ─── TOGGLE ROW ───────────────────────────────────────────────────────────────
function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'w-10 h-5 rounded-full transition-colors relative flex-shrink-0',
          value ? 'bg-black dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
        )}
      >
        <motion.div
          animate={{ x: value ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          className={cn(
            'w-4 h-4 rounded-full absolute top-0.5',
            value ? 'bg-white dark:bg-black' : 'bg-white dark:bg-gray-400'
          )}
        />
      </button>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function AIChat() {
  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ HOOKS: ALL PRIMITIVE HOOKS FIRST (useState, useRef, useContext, etc.)    ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  
  const {
    conversations,
    activeConversationId,
    apiKeys,
    selectedProvider,
    settings,
    createConversation,
    deleteConversation,
    renameConversation,
    pinConversation,
    starConversation,
    setActiveConversation,
    addMessage,
    deleteMessage,
    bookmarkMessage,
    reactToMessage,
    clearHistory,
    setApiKey,
    deleteApiKey,
    setSelectedProvider,
    updateSettings,
  } = useStore();

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [mobilePanelTab, setMobilePanelTab] = useState<'providers' | 'keys' | 'settings' | null>(
    null
  );
  const [rightTab, setRightTab] = useState<'providers' | 'keys' | 'settings'>('providers');
  const [searchConv, setSearchConv] = useState('');
  const [searchProvider, setSearchProvider] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [showModal, setShowModal] = useState<'shortcuts' | 'templates' | null>(null);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [showKeyFor, setShowKeyFor] = useState<Record<string, boolean>>({});
  const [convMenuId, setConvMenuId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<Record<string, string>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ DERIVED STATE: computed values before effects                             ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  ) as Conversation | undefined;
  const messages = activeConv?.messages ?? EMPTY_MSGS;
  const msgsRef = useRef(messages);
  msgsRef.current = messages;
  const msgCount = messages.length;

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ EFFECTS: side effects                                                    ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync mobilePanelTab → rightTab (via effect, not inline JSX)
  useEffect(() => {
    if (mobilePanelTab) setRightTab(mobilePanelTab);
  }, [mobilePanelTab]);

  // Theme
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    }
  }, [settings.theme]);

  // Panel visibility on resize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => {
      const mobile = window.innerWidth < 768;
      if (!mobile) {
        setShowSidebar(true);
        setShowRightPanel(true);
      } else {
        setShowSidebar(false);
        setShowRightPanel(false);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // First conversation
  useEffect(() => {
    if (conversations.length === 0 && mounted) {
      const id = createConversation();
      setActiveConversation(id);
    }
  }, [conversations.length, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgCount, isGenerating]);

  // Auto-resize textarea
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 140) + 'px';
  }, [input]);

  // Command menu
  useEffect(() => {
    setShowCommandMenu(input === '/');
  }, [input]);

  // Global keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'k') {
        e.preventDefault();
        const id = createConversation();
        setActiveConversation(id);
      }
      if (mod && e.key === 'b') {
        e.preventDefault();
        setShowSidebar((p) => !p);
      }
      if (mod && e.key === 'e') {
        e.preventDefault();
        doExport();
      }
      if (e.key === 'Escape') {
        setShowModal(null);
        setShowCommandMenu(false);
        setConvMenuId(null);
        setMobilePanelTab(null);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doExport = useCallback(() => {
    const msgs = msgsRef.current;
    if (!msgs.length) return;
    const blob = new Blob(
      [
        msgs
          .map((m) => `**${m.role === 'user' ? 'You' : 'AI'}**\n\n${m.content}`)
          .join('\n\n---\n\n'),
      ],
      { type: 'text/markdown' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conversation.md';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported!');
  }, []);

  const doExportJSON = useCallback(() => {
    const msgs = msgsRef.current;
    if (!msgs.length) return;
    const blob = new Blob(
      [JSON.stringify({ exportedAt: currentISOString(), messages: msgs }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conversation.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported as JSON!');
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isGenerating) return;
    let convId = activeConversationId;
    if (!convId) {
      convId = createConversation();
      setActiveConversation(convId);
    }
    const userText = input.trim();
    setInput('');
    setShowCommandMenu(false);
    addMessage({ role: 'user', content: userText });
    setIsGenerating(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          provider: selectedProvider,
          apiKey: apiKeys[selectedProvider] ?? '',
          history: msgsRef.current.slice(-20),
          systemPrompt: settings.systemPrompt,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          model: selectedModel[selectedProvider],
        }),
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      addMessage({
        role: 'assistant',
        content: data.content,
        type: data.type,
        url: data.url,
        model: selectedProvider,
      });
    } catch {
      toast.error('Request failed. Please try again.');
      addMessage({
        role: 'assistant',
        content: 'Failed to get a response. Please try again.',
        type: 'text',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [
    input,
    isGenerating,
    activeConversationId,
    selectedProvider,
    apiKeys,
    settings,
    selectedModel,
    addMessage,
    createConversation,
    setActiveConversation,
  ]);

  const handleRegenerate = useCallback(() => {
    const msgs = msgsRef.current;
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser || isGenerating) return;
    const last = msgs[msgs.length - 1];
    if (last?.role === 'assistant') deleteMessage(last.id);
    setInput(lastUser.content);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isGenerating, deleteMessage]);

  const handleScroll = useCallback(() => {
    if (!scrollAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
  }, []);

  const filteredConvs = useMemo(
    () =>
      conversations
        .filter(
          (c) =>
            c.title.toLowerCase().includes(searchConv.toLowerCase()) ||
            c.messages.some((m) => m.content.toLowerCase().includes(searchConv.toLowerCase()))
        )
        .sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return b.updatedAt - a.updatedAt;
        }),
    [conversations, searchConv]
  );

  const filteredProviders = useMemo(
    () =>
      PROVIDERS.filter((p) => {
        const q = searchProvider.toLowerCase();
        return (
          (p.name.toLowerCase().includes(q) || p.company.toLowerCase().includes(q)) &&
          (providerFilter === 'all' || p.category === providerFilter)
        );
      }),
    [searchProvider, providerFilter]
  );

  const currentProvider = PROVIDERS.find((p) => p.id === selectedProvider);
  const configuredCount = Object.values(apiKeys).filter(Boolean).length;
  const fontSizeClass =
    ({ sm: 'text-xs', md: 'text-sm', lg: 'text-base' } as Record<string, string>)[
      settings.fontSize
    ] ?? 'text-sm';

  // Early return after all hooks
  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black dark:border-gray-800 dark:border-t-white" />
      </div>
    );
  }

  // ── SIDEBAR INNER ─────────────────────────────────────────────────────────
  const SidebarInner = (
    <>
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-8 h-8 bg-black dark:bg-white rounded-xl flex items-center justify-center"
          >
            <Zap size={16} className="text-white dark:text-black" />
          </motion.div>
          <span className="font-bold text-base tracking-tight">AI Nexus</span>
        </div>
        <button
          onClick={() => setShowSidebar(false)}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>
      <div className="p-3 flex-shrink-0">
        <button
          onClick={() => {
            const id = createConversation();
            setActiveConversation(id);
            setShowSidebar(isMobile ? false : true);
          }}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          New Conversation
        </button>
      </div>
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search…"
            value={searchConv}
            onChange={(e) => setSearchConv(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder-gray-400 dark:placeholder-gray-600 text-gray-900 dark:text-white"
          />
          {searchConv && (
            <button onClick={() => setSearchConv('')} className="text-gray-400">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 scrollbar-thin">
        {filteredConvs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-xs">
            {searchConv ? 'No matches' : 'No conversations yet'}
          </div>
        ) : (
          filteredConvs.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              isActive={conv.id === activeConversationId}
              isRenaming={renamingId === conv.id}
              renameVal={renameVal}
              showMenu={convMenuId === conv.id}
              onSelect={() => {
                setActiveConversation(conv.id);
                setConvMenuId(null);
                if (isMobile) setShowSidebar(false);
              }}
              onMenuToggle={() => setConvMenuId(convMenuId === conv.id ? null : conv.id)}
              onRenameStart={() => {
                setRenamingId(conv.id);
                setRenameVal(conv.title);
              }}
              onRenameChange={setRenameVal}
              onRenameSubmit={() => {
                if (renameVal.trim()) renameConversation(conv.id, renameVal.trim());
                setRenamingId(null);
              }}
              onRenameCancel={() => setRenamingId(null)}
              onPin={() => pinConversation(conv.id)}
              onStar={() => starConversation(conv.id)}
              onDelete={() => {
                deleteConversation(conv.id);
                setConvMenuId(null);
              }}
            />
          ))
        )}
      </div>
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1 flex-shrink-0">
        <div className="flex justify-between text-[10px] text-gray-400 px-1 mb-1">
          <span>{conversations.length} chats</span>
          <span>{configuredCount} keys</span>
        </div>
        <button
          onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs transition-colors"
        >
          {settings.theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {settings.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button
          onClick={() => setShowModal('shortcuts')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs transition-colors"
        >
          <Keyboard size={14} />
          Keyboard Shortcuts
        </button>
      </div>
    </>
  );

  // ── RIGHT PANEL INNER ─────────────────────────────────────────────────────
  const RightPanelInner = (
    <>
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {(['providers', 'keys', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRightTab(tab)}
              className={cn(
                'px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize',
                rightTab === tab
                  ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            if (isMobile) setMobilePanelTab(null);
            else setShowRightPanel(false);
          }}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {rightTab === 'providers' && (
        <>
          <div className="p-3 space-y-2 flex-shrink-0">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
              <Search size={13} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder={`Search ${PROVIDERS.length}+ models...`}
                value={searchProvider}
                onChange={(e) => setSearchProvider(e.target.value)}
                className="flex-1 bg-transparent text-xs outline-none placeholder-gray-400 dark:placeholder-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {['all', 'text', 'multimodal', 'code', 'image', 'video', 'audio'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setProviderFilter(cat)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all capitalize flex-shrink-0',
                    providerFilter === cat
                      ? 'bg-black dark:bg-white text-white dark:text-black'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5 scrollbar-thin">
            {filteredProviders.map((provider) => {
              const isSelected = selectedProvider === provider.id;
              return (
                <motion.button
                  key={provider.id}
                  onClick={() => {
                    setSelectedProvider(provider.id);
                    setRightTab('keys');
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                    isSelected
                      ? 'bg-black dark:bg-white border-black dark:border-white'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <ProviderIcon domain={provider.domain} name={provider.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'font-semibold text-xs truncate',
                        isSelected ? 'text-white dark:text-black' : 'text-gray-900 dark:text-white'
                      )}
                    >
                      {provider.name}
                    </div>
                    <div
                      className={cn(
                        'text-[10px] truncate',
                        isSelected ? 'text-gray-300 dark:text-gray-600' : 'text-gray-500'
                      )}
                    >
                      {provider.company}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {!!apiKeys[provider.id] && (
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    )}
                    {provider.badge && (
                      <span
                        className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded-md font-bold',
                          isSelected
                            ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                        )}
                      >
                        {provider.badge}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
            {filteredProviders.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-xs">No providers found</div>
            )}
          </div>
        </>
      )}

      {rightTab === 'keys' && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin">
          {currentProvider && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                <ProviderIcon
                  domain={currentProvider.domain}
                  name={currentProvider.name}
                  size={34}
                />
                <div>
                  <div className="font-semibold text-sm">{currentProvider.name}</div>
                  <div className="text-xs text-gray-500">{currentProvider.company}</div>
                  {currentProvider.contextWindow && (
                    <div className="text-[10px] text-gray-400">
                      {currentProvider.contextWindow} context
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Model
                </label>
                <div className="relative">
                  <select
                    value={selectedModel[currentProvider.id] ?? currentProvider.models[0]}
                    onChange={(e) =>
                      setSelectedModel((p) => ({ ...p, [currentProvider.id]: e.target.value }))
                    }
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white appearance-none outline-none pr-8"
                  >
                    {currentProvider.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Key size={11} />
                  API Key
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeyFor[currentProvider.id] ? 'text' : 'password'}
                      placeholder={currentProvider.placeholderKey}
                      value={apiKeys[currentProvider.id] ?? ''}
                      onChange={(e) => setApiKey(currentProvider.id, e.target.value)}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white outline-none focus:border-gray-400 pr-10 font-mono"
                    />
                    <button
                      onClick={() =>
                        setShowKeyFor((p) => ({
                          ...p,
                          [currentProvider.id]: !p[currentProvider.id],
                        }))
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showKeyFor[currentProvider.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {apiKeys[currentProvider.id] && (
                    <button
                      onClick={() => {
                        deleteApiKey(currentProvider.id);
                        toast.success('Key removed.');
                      }}
                      className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {apiKeys[currentProvider.id] && (
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-green-600 dark:text-green-400">
                    <Check size={10} />
                    Configured
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{currentProvider.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {currentProvider.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
              <Key size={11} />
              All Providers ({configuredCount}/{PROVIDERS.length})
            </h3>
            <div className="space-y-1">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all',
                    p.id === selectedProvider
                      ? 'border-black dark:border-white bg-black/5 dark:bg-white/5'
                      : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-white dark:hover:bg-gray-800'
                  )}
                >
                  <ProviderIcon domain={p.domain} name={p.name} size={18} />
                  <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate">
                    {p.name}
                  </span>
                  {apiKeys[p.id] ? (
                    <Check size={11} className="text-green-500 flex-shrink-0" />
                  ) : (
                    <Plus size={11} className="text-gray-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {rightTab === 'settings' && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 scrollbar-thin">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Temperature
              </label>
              <span className="text-xs text-gray-500 font-mono">{settings.temperature}</span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={settings.temperature}
              onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
              className="w-full accent-black dark:accent-white"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Max Tokens
              </label>
              <span className="text-xs text-gray-500 font-mono">{settings.maxTokens}</span>
            </div>
            <input
              type="range"
              min={256}
              max={8192}
              step={256}
              value={settings.maxTokens}
              onChange={(e) => updateSettings({ maxTokens: parseInt(e.target.value) })}
              className="w-full accent-black dark:accent-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              System Prompt
            </label>
            <textarea
              rows={3}
              value={settings.systemPrompt}
              onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white outline-none resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Font Size
            </label>
            <div className="flex gap-1.5">
              {(['sm', 'md', 'lg'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateSettings({ fontSize: s })}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-semibold border transition-all',
                    settings.fontSize === s
                      ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                  )}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
              Preferences
            </label>
            <ToggleRow
              label="Show Timestamps"
              value={settings.showTimestamps}
              onChange={(v) => updateSettings({ showTimestamps: v })}
            />
            <ToggleRow
              label="Dark Mode"
              value={settings.theme === 'dark'}
              onChange={(v) => updateSettings({ theme: v ? 'dark' : 'light' })}
            />
          </div>
          <button
            onClick={() => {
              clearHistory();
              toast.success('Cleared.');
            }}
            className="w-full px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors"
          >
            Clear Current Conversation
          </button>
        </div>
      )}
    </>
  );

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        'flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white overflow-hidden',
        fontSizeClass
      )}
    >
      {/* Desktop sidebar */}
      <AnimatePresence>
        {showSidebar && !isMobile && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-hidden flex-shrink-0"
            style={{ width: 260 }}
          >
            {SidebarInner}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {showSidebar && isMobile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 bg-black/40 z-40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-72 flex flex-col bg-gray-50 dark:bg-gray-900 z-50 border-r border-gray-200 dark:border-gray-800 overflow-hidden"
            >
              {SidebarInner}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 md:px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex-shrink-0">
          {isMobile ? (
            <button
              onClick={() => setShowSidebar(true)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 flex-shrink-0"
            >
              <Menu size={18} />
            </button>
          ) : (
            !showSidebar && (
              <button
                onClick={() => setShowSidebar(true)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              >
                <PanelLeft size={18} />
              </button>
            )
          )}
          {currentProvider && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <ProviderIcon domain={currentProvider.domain} name={currentProvider.name} size={26} />
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate leading-tight">
                  {currentProvider.name}
                </div>
                <div className="text-[10px] text-gray-500 truncate leading-tight hidden md:block">
                  {currentProvider.company}
                </div>
              </div>
              {apiKeys[selectedProvider] && (
                <span className="hidden sm:flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800 flex-shrink-0">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  Ready
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              title="New Chat"
              onClick={() => {
                const id = createConversation();
                setActiveConversation(id);
              }}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            >
              <Plus size={16} />
            </button>
            <button
              title="Templates"
              onClick={() => setShowModal('templates')}
              className="hidden sm:block p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            >
              <FileText size={16} />
            </button>
            <button
              title="Export"
              onClick={doExport}
              className="hidden md:block p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            >
              <Download size={16} />
            </button>
            <button
              title="Export JSON"
              onClick={doExportJSON}
              className="hidden md:block p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            >
              <Share2 size={16} />
            </button>
            <button
              title="Clear"
              onClick={() => {
                clearHistory();
                toast.success('Cleared.');
              }}
              className="hidden sm:block p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            >
              <RotateCcw size={16} />
            </button>
            {isMobile ? (
              <button
                onClick={() => setMobilePanelTab('providers')}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
              >
                <Layers size={16} />
              </button>
            ) : (
              !showRightPanel && (
                <button
                  onClick={() => setShowRightPanel(true)}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              )
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollAreaRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6 scrollbar-thin"
        >
          {messages.length === 0 ? (
            <EmptyState
              onCmd={(s) => {
                setInput(s);
                inputRef.current?.focus();
              }}
            />
          ) : (
            messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                showTimestamps={settings.showTimestamps}
                isLast={i === messages.length - 1}
                onDelete={() => deleteMessage(msg.id)}
                onBookmark={() => bookmarkMessage(msg.id)}
                onReact={(r) => reactToMessage(msg.id, r)}
                onRegenerate={i === messages.length - 1 ? handleRegenerate : undefined}
              />
            ))
          )}
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2 md:gap-3"
            >
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold border border-gray-200 dark:border-gray-700 flex-shrink-0">
                AI
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-200 dark:border-gray-700">
                <TypingDots />
              </div>
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Scroll button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="absolute bottom-28 right-4 md:right-8 w-8 h-8 bg-black dark:bg-white text-white dark:text-black rounded-full shadow-lg flex items-center justify-center hover:opacity-80 transition-opacity z-10"
            >
              <ArrowDown size={14} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Input area */}
        <div className="px-3 md:px-4 pb-2 md:pb-4 pt-2 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-thin pb-0.5">
            {[
              { label: 'Image', icon: ImageIcon, cmd: '/image ' },
              { label: 'Video', icon: VideoIcon, cmd: '/video ' },
              { label: 'Audio', icon: Volume2, cmd: '/audio ' },
              { label: 'Code', icon: Hash, cmd: '/code ' },
              { label: 'Templates', icon: Sparkles, cmd: null },
            ].map(({ label, icon: Icon, cmd }) => (
              <button
                key={label}
                onClick={() => (cmd ? setInput(cmd) : setShowModal('templates'))}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors font-medium flex-shrink-0"
              >
                <Icon size={11} />
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <AnimatePresence>
              {showCommandMenu && (
                <CommandMenu
                  onSelect={(cmd) => {
                    setInput(cmd);
                    setShowCommandMenu(false);
                    inputRef.current?.focus();
                  }}
                />
              )}
            </AnimatePresence>
            <div className="flex items-end gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2 focus-within:border-gray-400 dark:focus-within:border-gray-500 transition-colors shadow-sm">
              <button
                onClick={() => {
                  setInput('/');
                  inputRef.current?.focus();
                }}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex-shrink-0 mb-0.5"
                title="Commands"
              >
                <Slash size={15} />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                  if (e.key === 'Escape') setShowCommandMenu(false);
                }}
                placeholder="Message AI Nexus… (⌘+Enter to send, / for commands)"
                disabled={isGenerating}
                rows={1}
                className="flex-1 bg-transparent outline-none resize-none text-sm placeholder-gray-400 dark:placeholder-gray-600 text-gray-900 dark:text-white py-1 max-h-36 scrollbar-thin"
                style={{ minHeight: 26 }}
              />
              <motion.button
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
                whileTap={{ scale: 0.9 }}
                className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-xl disabled:opacity-30 transition-opacity flex-shrink-0 mb-0.5"
              >
                {isGenerating ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <RefreshCw size={15} />
                  </motion.div>
                ) : (
                  <Send size={15} />
                )}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Mobile bottom nav */}
        {isMobile && (
          <div className="flex items-center border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex-shrink-0">
            {[
              { icon: MessageSquare, label: 'Chats', fn: () => setShowSidebar(true) },
              { icon: Layers, label: 'Models', fn: () => setMobilePanelTab('providers') },
              { icon: Key, label: 'Keys', fn: () => setMobilePanelTab('keys') },
              { icon: Settings, label: 'Settings', fn: () => setMobilePanelTab('settings') },
            ].map(({ icon: Icon, label, fn }) => (
              <button
                key={label}
                onClick={fn}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <Icon size={18} />
                <span className="text-[9px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Desktop right panel */}
      <AnimatePresence>
        {showRightPanel && !isMobile && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-hidden flex-shrink-0"
            style={{ width: 300 }}
          >
            {RightPanelInner}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile panel bottom sheet */}
      <AnimatePresence>
        {mobilePanelTab && isMobile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobilePanelTab(null)}
              className="fixed inset-0 bg-black/40 z-40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30 }}
              className="fixed bottom-0 left-0 right-0 h-[85vh] flex flex-col bg-gray-50 dark:bg-gray-900 z-50 rounded-t-3xl border-t border-gray-200 dark:border-gray-800 overflow-hidden"
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3 mb-0 flex-shrink-0" />
              {RightPanelInner}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showModal === 'shortcuts' && (
          <Modal onClose={() => setShowModal(null)} title="Keyboard Shortcuts">
            <div className="space-y-1">
              {KEYBOARD_SHORTCUTS.map(({ key, description }) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">{description}</span>
                  <kbd className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 font-mono text-gray-600 dark:text-gray-400">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showModal === 'templates' && (
          <Modal onClose={() => setShowModal(null)} title="Prompt Templates">
            <div className="grid gap-2">
              {PROMPT_TEMPLATES.map(({ id, label, prompt }) => (
                <motion.button
                  key={id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    setInput(prompt);
                    setShowModal(null);
                    inputRef.current?.focus();
                  }}
                  className="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-400 dark:hover:border-gray-500 transition-all"
                >
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">{label}</div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{prompt}</div>
                </motion.button>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 9999px;
        }
        .dark .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #374151;
        }
        * {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}

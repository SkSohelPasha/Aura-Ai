import { useState, useCallback, useEffect, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import { chatApi, streamMessage } from './api/client';

import AuthModal from './components/AuthModal';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import InputBar from './components/InputBar';
import { Menu, X, PanelLeftClose, PanelLeft } from 'lucide-react';

export default function App() {
  const { user, loading: authLoading } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [chats, setChats]               = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages]         = useState([]);
  const [streaming, setStreaming]       = useState(null); // { content: string }
  const [chatLoading, setChatLoading]   = useState(false);
  const [listLoading, setListLoading]   = useState(false);
  const [sending, setSending]           = useState(false);
  const [inputText, setInputText]       = useState('');
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const abortRef                        = useRef(null);

  // ── Load chat list ─────────────────────────────────────────────────────────
  const loadChats = useCallback(async () => {
    if (!user) return;
    setListLoading(true);
    try {
      const data = await chatApi.list();
      setChats(data);
    } catch (err) {
      toast.error('Failed to load chats');
    } finally {
      setListLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadChats();
    else { setChats([]); setActiveChatId(null); setMessages([]); }
  }, [user, loadChats]);

  // ── Select chat ────────────────────────────────────────────────────────────
  async function selectChat(id) {
    if (id === activeChatId) return;
    abortRef.current?.(); // cancel any ongoing stream
    setActiveChatId(id);
    setStreaming(null);
    setChatLoading(true);
    try {
      const data = await chatApi.get(id);
      setMessages(data.messages);
    } catch {
      toast.error('Failed to load chat');
      setMessages([]);
    } finally {
      setChatLoading(false);
    }
  }

  function newChat() {
    abortRef.current?.();
    setActiveChatId(null);
    setMessages([]);
    setStreaming(null);
  }

  async function deleteChat(id) {
    try {
      await chatApi.delete(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeChatId === id) newChat();
      toast.success('Chat deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  // ── Send message ───────────────────────────────────────────────────────────
  async function handleSend(content, useStream) {
    if (sending) return;
    setSending(true);

    // Optimistically add user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    if (useStream) {
      setStreaming({ content: '' });

      const abort = streamMessage(
        { chat_id: activeChatId, content, stream: true },
        {
          onChatInfo: (info) => {
            setActiveChatId(info.chat_id);
            // Update or add chat in list
            setChats((prev) => {
              const exists = prev.find((c) => c.id === info.chat_id);
              if (exists) {
                return prev.map((c) =>
                  c.id === info.chat_id
                    ? { ...c, title: info.chat_title, updated_at: new Date().toISOString() }
                    : c
                );
              }
              return [
                {
                  id: info.chat_id,
                  title: info.chat_title,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  message_count: 1,
                },
                ...prev,
              ];
            });
          },
          onChunk: (chunk) => {
            setStreaming((prev) => ({ content: (prev?.content || '') + chunk }));
          },
          onTitleUpdate: (newTitle) => {
            setChats((prev) =>
              prev.map((c) =>
                c.id === activeChatId ? { ...c, title: newTitle } : c
              )
            );
          },
          onDone: (event) => {
            setStreaming((prev) => {
              const finalContent = prev?.content || '';
              setMessages((msgs) => [
                ...msgs.filter((m) => m.id !== tempUserMsg.id),
                {
                  ...tempUserMsg,
                  id: event.user_message_id || tempUserMsg.id,
                },
                {
                  id: event.message_id,
                  role: 'assistant',
                  content: finalContent,
                  created_at: new Date().toISOString(),
                },
              ]);
              
              // Update last_message locally to avoid refetch shimmer
              setChats((chatList) => 
                chatList.map((c) => 
                  c.id === activeChatId 
                    ? { ...c, last_message: finalContent.slice(0, 100), updated_at: new Date().toISOString() } 
                    : c
                )
              );
              
              return null;
            });
            setSending(false);
          },
          onError: (msg) => {
            toast.error(msg || 'Stream error');
            setStreaming(null);
            setSending(false);
          },
        }
      );

      abortRef.current = abort;
    } else {
      // Non-streaming
      try {
        const res = await chatApi.send({ chat_id: activeChatId, content });
        setActiveChatId(res.chat_id);
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUserMsg.id),
          res.user_message,
          res.assistant_message,
        ]);
        // Update chats list
        setChats((prev) => {
          const exists = prev.find((c) => c.id === res.chat_id);
          if (exists) {
            return prev.map((c) =>
              c.id === res.chat_id
                ? {
                    ...c,
                    title: res.chat_title,
                    last_message: res.assistant_message.content.slice(0, 100),
                    updated_at: new Date().toISOString(),
                  }
                : c
            );
          }
          return [
            {
              id: res.chat_id,
              title: res.chat_title,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              message_count: 2,
              last_message: res.assistant_message.content.slice(0, 100),
            },
            ...prev,
          ];
        });
      } catch (err) {
        toast.error(err.message || 'Failed to send message');
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      } finally {
        setSending(false);
      }
    }
  }

  // ── Auth loading ───────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--accent-glow)', border: '1px solid rgba(124,111,224,0.25)' }}
          >
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-light)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <AuthModal />;

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
          },
        }}
      />

      {/* Sidebar */}
      {sidebarOpen && (
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={selectChat}
          onNewChat={newChat}
          onDeleteChat={deleteChat}
          loading={listLoading}
        />
      )}

      {/* Main Area */}
      <main className="flex flex-col flex-1 min-w-0 h-full">
        {/* Topbar */}
        <header
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)', height: 52 }}
        >
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
          </button>
          <h1
            className="text-sm font-semibold truncate flex-1"
            style={{
              fontFamily: 'Syne, sans-serif',
              color: activeChatId
                ? '#fff'
                : 'var(--text-muted)',
            }}
          >
            {activeChatId
              ? chats.find((c) => c.id === activeChatId)?.title || 'Chat'
              : 'New Chat'}
          </h1>
          {sending && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent-light)' }}>
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
              <span style={{ fontSize: 11 }}>Thinking…</span>
            </div>
          )}
        </header>

        {/* Chat Area */}
        <ChatArea
          messages={messages}
          streaming={streaming}
          chatTitle={chats.find((c) => c.id === activeChatId)?.title}
          loading={chatLoading}
          onSuggestionClick={(prompt) => setInputText(prompt)}
        />

        {/* Input */}
        <InputBar
          onSend={handleSend}
          loading={sending}
          chatId={activeChatId}
          disabled={false}
          text={inputText}
          setText={setInputText}
        />
      </main>
    </div>
  );
}

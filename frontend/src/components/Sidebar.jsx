import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus, MessageSquare, Trash2, LogOut, Sparkles,
  ChevronRight, Search, X, MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProfileModal from './ProfileModal';

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  loading,
}) {
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  const filtered = chats.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  function handleDelete(e, id) {
    e.stopPropagation();
    if (confirmDelete === id) {
      onDeleteChat(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 2000);
    }
  }

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: 260,
        minWidth: 260,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div className="p-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-glow)', border: '1px solid rgba(124,111,224,0.25)' }}
          >
            <Sparkles size={14} style={{ color: 'var(--accent-light)' }} />
          </div>
          <span
            className="font-bold text-base"
            style={{ fontFamily: 'Syne, sans-serif', color: '#fff', letterSpacing: '-0.01em' }}
          >
            Aura
          </span>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-all duration-200"
          style={{
            background: 'rgba(124,111,224,0.1)',
            border: '1px solid rgba(124,111,224,0.2)',
            borderRadius: 10,
            color: 'var(--accent-light)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(124,111,224,0.18)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(124,111,224,0.1)';
          }}
        >
          <Plus size={15} />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats…"
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--text)' }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex flex-col gap-1.5 p-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-lg"
                style={{
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s linear infinite',
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-8 pb-4 gap-2">
            <MessageSquare size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {search ? 'No results' : 'No chats yet'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filtered.map((chat) => {
              const isActive = chat.id === activeChatId;
              return (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  onMouseEnter={() => setHoveredId(chat.id)}
                  onMouseLeave={() => { setHoveredId(null); setConfirmDelete(null); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 group relative"
                  style={{
                    background: isActive
                      ? 'rgba(124,111,224,0.12)'
                      : hoveredId === chat.id
                        ? 'rgba(255,255,255,0.04)'
                        : 'transparent',
                    border: isActive
                      ? '1px solid rgba(124,111,224,0.2)'
                      : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div className="flex items-start gap-2.5 pr-6">
                    <MessageSquare
                      size={13}
                      className="mt-0.5 flex-shrink-0"
                      style={{ color: isActive ? 'var(--accent-light)' : 'var(--text-muted)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-medium truncate leading-snug"
                        style={{ color: isActive ? '#fff' : 'var(--text)' }}
                      >
                        {chat.title}
                      </p>
                      {chat.last_message && (
                        <p
                          className="text-xs truncate mt-0.5 leading-snug"
                          style={{ color: 'var(--text-muted)', fontSize: 11 }}
                        >
                          {chat.last_message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Delete Button */}
                  {(hoveredId === chat.id || isActive) && (
                    <button
                      onClick={(e) => handleDelete(e, chat.id)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-all"
                      style={{
                        background: confirmDelete === chat.id
                          ? 'rgba(248,114,114,0.15)'
                          : 'rgba(255,255,255,0.08)',
                        color: confirmDelete === chat.id ? 'var(--error)' : 'var(--text-muted)',
                      }}
                      title={confirmDelete === chat.id ? 'Click again to confirm' : 'Delete chat'}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* User Profile */}
      <div
        className="p-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div
          onClick={() => setShowProfile(true)}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
          style={{ background: 'rgba(255,255,255,0.04)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'Syne, sans-serif' }}
          >
            {user?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: '#fff' }}>
              {user?.username}
            </p>
            <p className="truncate" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {user?.email}
            </p>
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            <MoreHorizontal size={14} />
          </div>
        </div>
      </div>

      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onLogout={logout}
        />
      )}
    </aside>
  );
}

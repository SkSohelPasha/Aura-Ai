import { X, LogOut, Mail, User, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function ProfileModal({ user, onClose, onLogout }) {
  if (!user) return null;

  const joinDate = user.created_at ? format(new Date(user.created_at), 'MMMM d, yyyy') : 'Unknown';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)', fontFamily: 'Syne, sans-serif' }}>
            Your Profile
          </h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-col items-center mb-6">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mb-3 shadow-lg"
              style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'Syne, sans-serif' }}
            >
              {user.username?.[0]?.toUpperCase() || '?'}
            </div>
            <h3 className="text-xl font-bold" style={{ color: '#fff' }}>{user.username}</h3>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3">
              <Mail size={16} style={{ color: 'var(--accent-light)' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Email</p>
                <p className="text-sm" style={{ color: '#fff' }}>{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User size={16} style={{ color: 'var(--accent-light)' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Username</p>
                <p className="text-sm" style={{ color: '#fff' }}>{user.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock size={16} style={{ color: 'var(--accent-light)' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Member Since</p>
                <p className="text-sm" style={{ color: '#fff' }}>{joinDate}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ 
              background: 'rgba(248,114,114,0.1)', 
              color: 'var(--error)',
              border: '1px solid rgba(248,114,114,0.2)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(248,114,114,0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(248,114,114,0.1)'}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import MessageBubble from './MessageBubble';

export default function ChatArea({ messages, streaming, chatTitle, loading, onSuggestionClick }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming?.content]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--accent)' }}
        />
      </div>
    );
  }

  if (messages.length === 0 && !streaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 animate-fade-in">
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6"
          style={{
            background: 'var(--accent-glow)',
            border: '1px solid rgba(124,111,224,0.2)',
            boxShadow: '0 0 40px rgba(124,111,224,0.1)',
          }}
        >
          <Sparkles size={28} style={{ color: 'var(--accent-light)' }} />
        </div>
        <h2
          className="text-2xl font-bold mb-3 text-center"
          style={{ fontFamily: 'Syne, sans-serif', color: '#fff', letterSpacing: '-0.02em' }}
        >
          Hello! How can I assist you today?
        </h2>
        <p className="text-center max-w-xs text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Get instant AI-powered solutions for coding, debugging, deployment, and technical workflows.
        </p>

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2 mt-8 justify-center max-w-lg">
          {[
            'Explain how RAG works',
            'Debug this FastAPI error',
            'Summarize this technical PDF',
            'Write a production-ready API endpoint',
            'Plan a full-stack project',
            'Optimize my backend architecture',
          ].map((prompt) => (
            <div
              key={prompt}
              onClick={() => onSuggestionClick?.(prompt)}
              className="px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontFamily: 'DM Sans, sans-serif',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {prompt}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-1">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming message */}
        {streaming && (
          <MessageBubble
            message={{ role: 'assistant', content: streaming.content }}
            isStreaming
          />
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

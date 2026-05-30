import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, User, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
      style={{
        background: copied ? 'rgba(82,212,138,0.15)' : 'rgba(255,255,255,0.06)',
        color: copied ? 'var(--success)' : 'var(--text-muted)',
        border: '1px solid transparent',
        cursor: 'pointer',
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

const components = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const code = String(children).replace(/\n$/, '');

    if (!inline && match) {
      return (
        <div className="relative my-3">
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{
              background: 'rgba(0,0,0,0.5)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px 8px 0 0',
            }}
          >
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}
            >
              {match[1]}
            </span>
            <CopyButton text={code} />
          </div>
          <SyntaxHighlighter
            style={{
              ...oneDark,
              'pre[class*="language-"]': {
                ...oneDark['pre[class*="language-"]'],
                background: 'rgba(0,0,0,0.35)',
                margin: 0,
                borderRadius: '0 0 8px 8px',
                border: '1px solid rgba(255,255,255,0.06)',
                borderTop: 'none',
              },
            }}
            language={match[1]}
            PreTag="div"
            customStyle={{ fontSize: '0.82em' }}
            {...props}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      );
    }

    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

export default function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex gap-3 group animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      style={{ padding: '6px 0' }}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: isUser
            ? 'linear-gradient(135deg, var(--accent), #9B8FF8)'
            : 'rgba(255,255,255,0.06)',
          border: isUser ? 'none' : '1px solid var(--border)',
        }}
      >
        {isUser ? (
          <User size={13} style={{ color: '#fff' }} />
        ) : (
          <Sparkles size={13} style={{ color: 'var(--accent-light)' }} />
        )}
      </div>

      {/* Bubble */}
      <div
        className="flex flex-col max-w-[78%]"
        style={{ alignItems: isUser ? 'flex-end' : 'flex-start' }}
      >
        <div
          className="px-4 py-3"
          style={{
            background: isUser
              ? 'linear-gradient(135deg, rgba(124,111,224,0.2), rgba(124,111,224,0.12))'
              : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isUser ? 'rgba(124,111,224,0.25)' : 'var(--border)'}`,
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          }}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
              {message.content}
            </p>
          ) : (
            <div className="prose">
              {isStreaming && !message.content ? (
                <div className="flex items-center gap-1.5 py-1">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                  {message.content}
                </ReactMarkdown>
              )}
              {isStreaming && message.content && (
                <span
                  className="inline-block w-0.5 h-4 ml-0.5 align-middle"
                  style={{
                    background: 'var(--accent)',
                    animation: 'pulseDot 1s ease-in-out infinite',
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        {!isStreaming && message.created_at && (
          <p
            className="text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity px-1"
            style={{ color: 'var(--text-muted)', fontSize: 11 }}
          >
            {format(new Date(message.created_at), 'h:mm a')}
          </p>
        )}
      </div>
    </div>
  );
}

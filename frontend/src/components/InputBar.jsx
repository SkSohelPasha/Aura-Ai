import { useState, useRef, useCallback } from 'react';
import { Send, Paperclip, X, FileText, Loader2, Zap } from 'lucide-react';
import { uploadFile } from '../api/client';
import toast from 'react-hot-toast';

export default function InputBar({ onSend, loading, chatId, disabled, text, setText }) {
  const [streaming, setStreaming] = useState(true);
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const textRef = useRef(null);
  const fileRef = useRef(null);

  const canSend = text.trim().length > 0 && !loading && !disabled;

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) submit();
    }
  }

  function submit() {
    if (!canSend) return;
    onSend(text.trim(), streaming);
    setText('');
    setAttachedFile(null);
    textRef.current?.focus();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFile(file, chatId);
      setAttachedFile(res);
      toast.success(`File "${res.original_filename}" attached`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      fileRef.current.value = '';
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange({ target: { files: [file] } });
  }

  return (
    <div
      className="p-4"
      style={{ borderTop: '1px solid var(--border)' }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Attached file badge */}
      {attachedFile && (
        <div
          className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg w-fit text-sm animate-fade-in"
          style={{
            background: 'rgba(124,111,224,0.1)',
            border: '1px solid rgba(124,111,224,0.2)',
          }}
        >
          <FileText size={13} style={{ color: 'var(--accent-light)' }} />
          <span style={{ color: 'var(--accent-light)', fontSize: 12 }}>
            {attachedFile.original_filename}
          </span>
          <button
            onClick={() => setAttachedFile(null)}
            style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Main input container */}
      <div
        className="flex items-end gap-2 px-4 py-3 input-glow transition-all duration-200"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
        }}
      >
        {/* File attach */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || disabled}
          className="p-1.5 rounded-lg flex-shrink-0 mb-0.5 transition-all"
          title="Attach file"
          style={{
            color: uploading ? 'var(--accent)' : 'var(--text-muted)',
            cursor: disabled || uploading ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => { if (!disabled && !uploading) e.currentTarget.style.color = 'var(--accent-light)'; }}
          onMouseLeave={(e) => { if (!disabled && !uploading) e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md,.csv,.json,.docx"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Textarea */}
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything…"
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed"
          style={{
            color: 'var(--text)',
            maxHeight: 160,
            minHeight: 22,
            overflow: 'hidden',
          }}
        />

        {/* Streaming toggle */}
        <button
          onClick={() => setStreaming((v) => !v)}
          className="p-1.5 rounded-lg flex-shrink-0 mb-0.5 transition-all"
          title={streaming ? 'Streaming ON' : 'Streaming OFF'}
          style={{
            color: streaming ? 'var(--accent-light)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <Zap size={15} fill={streaming ? 'currentColor' : 'none'} />
        </button>

        {/* Send */}
        <button
          onClick={submit}
          disabled={!canSend}
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-all duration-200"
          style={{
            background: canSend ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: canSend ? '#fff' : 'var(--text-muted)',
            cursor: canSend ? 'pointer' : 'not-allowed',
            boxShadow: canSend ? '0 0 16px rgba(124,111,224,0.3)' : 'none',
          }}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={13} />
          )}
        </button>
      </div>

      <p
        className="text-center mt-2"
        style={{ color: 'var(--text-muted)', fontSize: 11 }}
      >
        Enter to send · Shift+Enter for new line ·{' '}
        <span style={{ color: streaming ? 'var(--accent-light)' : 'var(--text-muted)' }}>
          {streaming ? '⚡ Streaming' : '⚡ Standard'}
        </span>
      </p>
    </div>
  );
}

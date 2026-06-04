import { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { API_URL } from '../config/api';
import { MessageCircle, X, Send, Trash2, ChevronDown, Sparkles, Bot, User, Loader2 } from 'lucide-react';

const AIChatWidget = () => {
  const { token, user } = useSelector((state) => state.auth);
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (isOpen && token) fetchSessions();
  }, [isOpen, token]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/ai/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(res.data.data || []);
    } catch (_) {}
  };

  const loadSession = async (sessionId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/ai/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const session = res.data.data;
      setCurrentSessionId(session._id);
      setMessages(session.messages || []);
      setShowSessions(false);
    } catch (_) {
      newSession();
    } finally {
      setLoading(false);
    }
  };

  const newSession = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setShowSessions(false);
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_URL}/ai/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (currentSessionId === sessionId) newSession();
      fetchSessions();
    } catch (_) {}
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');

    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/ai/ask`,
        { question, sessionId: currentSessionId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { answer, sessionId } = res.data.data;
      setCurrentSessionId(sessionId);
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
      fetchSessions();
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.response?.data?.message || err.message}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!token) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="text-sm font-bold">BD Tracker AI</p>
                <p className="text-[10px] text-white/70">Ask anything about your data</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSessions(!showSessions)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Chat history"
              >
                <ChevronDown size={16} className={`transition-transform ${showSessions ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Sessions Panel */}
          {showSessions && (
            <div className="border-b border-slate-100 bg-slate-50 max-h-40 overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chat History</span>
                <button onClick={newSession} className="text-[10px] font-bold text-red-600 hover:text-red-700">
                  + New Chat
                </button>
              </div>
              {sessions.length === 0 ? (
                <p className="px-4 pb-2 text-[10px] text-slate-400">No previous chats</p>
              ) : (
                sessions.map(s => (
                  <div
                    key={s._id}
                    onClick={() => loadSession(s._id)}
                    className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-slate-100 transition-colors ${
                      currentSessionId === s._id ? 'bg-red-50' : ''
                    }`}
                  >
                    <MessageCircle size={12} className="text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-700 truncate flex-1">{s.title}</span>
                    <span className="text-[9px] text-slate-400 shrink-0">{s.messageCount}</span>
                    <button
                      onClick={(e) => deleteSession(e, s._id)}
                      className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors shrink-0"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/50">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-3">
                  <Bot size={24} className="text-red-600" />
                </div>
                <p className="text-sm font-bold text-slate-700 mb-1">Ask me anything!</p>
                <p className="text-[10px] text-slate-400 max-w-[200px]">
                  Try: "Show me new leads this month" or "What's my revenue?"
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} className="text-red-600" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-red-600 text-white rounded-br-md'
                      : 'bg-white text-slate-700 border border-slate-200 shadow-sm rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User size={14} className="text-white" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-red-600" />
                </div>
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-400 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                disabled={loading}
                className="flex-1 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none border-none disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
            <p className="text-[8px] text-slate-300 text-center mt-1.5">Powered by Groq AI • Data-aware answers</p>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          isOpen
            ? 'bg-slate-700 text-white rotate-90 scale-90'
            : 'bg-red-600 text-white hover:bg-red-700 hover:scale-105 animate-bounce-subtle'
        }`}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
        @keyframes slide-in-from-bottom-4 {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in {
          animation: slide-in-from-bottom-4 0.2s ease-out;
        }
      `}</style>
    </>
  );
};

export default AIChatWidget;

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";

export default function Messages() {
    const { userId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const targetUserId = userId || searchParams.get("to") || "";
    const [conversations, setConversations] = useState([]);
    const [activeUser, setActiveUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const endRef = useRef(null);

    const loadConversations = useCallback(async () => {
        try {
            const { data } = await api.get("/messages/conversations");
            setConversations(data);
        } catch (e) {
            toast.error(formatApiError(e));
        }
    }, []);

    const loadThread = useCallback(async ({ silent = false } = {}) => {
        if (!targetUserId) {
            setActiveUser(null);
            setMessages([]);
            return;
        }
        if (!silent) setLoading(true);
        try {
            const { data } = await api.get(`/messages/${targetUserId}`);
            setActiveUser(data.user);
            setMessages(data.messages);
            await loadConversations();
            if (!userId) {
                navigate(`/mesajlar/${targetUserId}`, { replace: true });
            }
        } catch (e) {
            if (!silent) {
                toast.error(formatApiError(e));
                navigate("/mesajlar", { replace: true });
            }
        } finally {
            if (!silent) setLoading(false);
        }
    }, [loadConversations, navigate, targetUserId, userId]);

    useEffect(() => {
        setLoading(true);
        loadConversations().finally(() => setLoading(false));
    }, [loadConversations]);

    useEffect(() => {
        const timer = setInterval(loadConversations, 5000);
        return () => clearInterval(timer);
    }, [loadConversations]);

    useEffect(() => {
        loadThread();
    }, [loadThread]);

    useEffect(() => {
        if (!targetUserId) return undefined;
        const timer = setInterval(() => {
            loadThread({ silent: true });
        }, 3000);
        return () => clearInterval(timer);
    }, [loadThread, targetUserId]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages.length, userId]);

    const sendMessage = async (e) => {
        e.preventDefault();
        const content = draft.trim();
        if (!targetUserId || !content || sending) return;
        setSending(true);
        try {
            const { data } = await api.post(`/messages/${targetUserId}`, { content });
            setMessages((items) => [...items, data]);
            setDraft("");
            trackEvent("message_sent");
            await loadConversations();
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-10 relative z-10" data-testid="messages-page">
            <div className="mb-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-stamp">TELGRAF ODASI</p>
                <h2 className="font-masthead text-4xl sm:text-5xl font-black mt-1">Mesajlar</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
                <aside className="border-2 border-ink bg-paper/60 min-h-[420px]" data-testid="conversation-list">
                    <div className="p-4 border-b-2 border-ink">
                        <p className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Konuşmalar</p>
                    </div>

                    {conversations.length === 0 ? (
                        <div className="p-6 text-center">
                            <MessageCircle className="mx-auto mb-3" size={28} />
                            <p className="font-serif italic text-inkmuted">Henüz mesaj yok.</p>
                            <Link to="/muhabirler" className="btn-outline-ink inline-block mt-4">Muhabir Bul</Link>
                        </div>
                    ) : (
                        <div className="divide-y-2 divide-ink/20">
                            {conversations.map((item) => item.user && (
                                <Link
                                    key={item.conversation_id}
                                    to={`/mesajlar/${item.user.user_id}`}
                                    className={`block p-4 hover:bg-ink/5 ${targetUserId === item.user.user_id ? "bg-ink text-paper hover:bg-ink" : ""}`}
                                    data-testid={`conversation-${item.user.user_id}`}
                                >
                                    <div className="flex items-center gap-3">
                                        {item.user.picture ? (
                                            <img src={item.user.picture} alt={item.user.name} className="w-11 h-11 border-2 border-current object-cover grayscale" />
                                        ) : (
                                            <div className="w-11 h-11 border-2 border-current flex items-center justify-center font-masthead text-xl font-black">
                                                {item.user.name?.[0]?.toUpperCase() || "M"}
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-masthead text-xl font-black truncate">{item.user.name}</p>
                                                {item.unread > 0 && (
                                                    <span className="font-mono text-[10px] border border-current px-1.5">{item.unread}</span>
                                                )}
                                            </div>
                                            <p className="font-serif text-sm italic truncate opacity-80">{item.last_message.content}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </aside>

                <section className="border-2 border-ink bg-paper/60 min-h-[420px] flex flex-col" data-testid="message-thread">
                    {!targetUserId ? (
                        <div className="flex-1 flex items-center justify-center p-8 text-center">
                            <div>
                                <MessageCircle className="mx-auto mb-3" size={34} />
                                <p className="font-masthead text-3xl font-black">Bir konuşma seç</p>
                                <p className="font-serif italic text-inkmuted mt-2">Ya da Muhabir Bul sayfasından yeni birine yaz.</p>
                            </div>
                        </div>
                    ) : loading ? (
                        <div className="flex-1 flex items-center justify-center font-mono text-xs uppercase tracking-widest text-inkmuted">
                            Mesajlar getiriliyor...
                        </div>
                    ) : (
                        <>
                            <div className="p-4 border-b-2 border-ink flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-mono text-[10px] uppercase tracking-widest text-stamp">Muhabir Hattı</p>
                                    <Link to={`/muhabir/${activeUser?.user_id}`} className="font-masthead text-2xl font-black hover:text-stamp">
                                        {activeUser?.name || "Muhabir"}
                                    </Link>
                                </div>
                            </div>

                            <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[520px]">
                                {messages.length === 0 ? (
                                    <p className="font-serif italic text-center text-inkmuted py-12">İlk telgrafı sen gönder.</p>
                                ) : messages.map((message) => {
                                    const mine = message.sender_id === currentUser?.user_id;
                                    return (
                                        <div key={message.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                            <div className={`max-w-[78%] border-2 border-ink px-4 py-3 ${mine ? "bg-ink text-paper" : "bg-paper"}`}>
                                                <p className="font-serif text-base whitespace-pre-wrap break-words">{message.content}</p>
                                                <p className="font-mono text-[10px] uppercase tracking-widest opacity-70 mt-2">
                                                    {new Date(message.created_at).toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={endRef} />
                            </div>

                            <form onSubmit={sendMessage} className="p-4 border-t-2 border-ink flex gap-3">
                                <textarea
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage(e);
                                        }
                                    }}
                                    className="flex-1 min-h-[54px] max-h-32 resize-y bg-paper border-2 border-ink p-3 font-serif outline-none"
                                    placeholder="Mesaj yaz..."
                                    data-testid="message-input"
                                />
                                <button type="submit" disabled={sending || !draft.trim()} className="btn-ink inline-flex items-center gap-2 self-end" data-testid="message-send-btn">
                                    <Send size={14} /> Gönder
                                </button>
                            </form>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}

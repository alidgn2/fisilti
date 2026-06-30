import { useCallback, useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, X } from "lucide-react";

function ago(iso) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "az önce";
    if (diff < 3600) return `${Math.floor(diff / 60)} dk`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} sa`;
    return `${Math.floor(diff / 86400)} gün`;
}

function NotificationItem({ n, onSelect }) {
    const data = n.data || {};
    if (n.type === "comment") {
        return (
            <Link to={`/fisilti/${data.whisper_id}`} onClick={onSelect} className="block hover:bg-ink/5 -mx-2 px-2 py-3" data-testid={`notif-${n.notification_id}`}>
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Yeni yorum</p>
                <p className="font-serif text-sm mt-1 break-words leading-snug"><strong>{data.from_name}</strong>: {data.preview}</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-inkmuted mt-1">{ago(n.created_at)}</p>
            </Link>
        );
    }
    if (n.type === "follow") {
        return (
            <Link to={`/muhabir/${data.from_user_id}`} onClick={onSelect} className="block hover:bg-ink/5 -mx-2 px-2 py-3" data-testid={`notif-${n.notification_id}`}>
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Yeni takipçi</p>
                <p className="font-serif text-sm mt-1 break-words leading-snug"><strong>{data.from_name}</strong> seni takip etmeye başladı.</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-inkmuted mt-1">{ago(n.created_at)}</p>
            </Link>
        );
    }
    if (n.type === "message") {
        return (
            <Link to={`/mesajlar/${data.from_user_id}`} onClick={onSelect} className="block hover:bg-ink/5 -mx-2 px-2 py-3" data-testid={`notif-${n.notification_id}`}>
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Yeni mesaj</p>
                <p className="font-serif text-sm mt-1 break-words leading-snug"><strong>{data.from_name}</strong>: {data.preview}</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-inkmuted mt-1">{ago(n.created_at)}</p>
            </Link>
        );
    }
    if (n.type === "moderation") {
        return (
            <div className="block -mx-2 px-2 py-3" data-testid={`notif-${n.notification_id}`}>
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Fısıltın gizlendi</p>
                <p className="font-serif text-sm mt-1 break-words leading-snug">{data.reason || "İçerik kurallarına uygun değil."}</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-inkmuted mt-1">{ago(n.created_at)}</p>
            </div>
        );
    }
    return (
        <div className="block -mx-2 px-2 py-3">
            <p className="font-serif text-sm">{n.type}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-inkmuted">{ago(n.created_at)}</p>
        </div>
    );
}

export default function NotificationBell() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [unread, setUnread] = useState(0);
    const [items, setItems] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const containerRef = useRef(null);

    const refresh = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await api.get("/notifications/unread_count");
            setUnread(data.unread_count || 0);
        } catch {
            /* noop */
        }
    }, [user]);

    const load = async () => {
        if (!user) return;
        try {
            const { data } = await api.get("/notifications");
            setItems(data.items || []);
            setUnread(data.unread_count || 0);
            setLoaded(true);
        } catch {
            /* noop */
        }
    };

    useEffect(() => {
        if (!user) {
            setUnread(0);
            setItems([]);
            return;
        }
        refresh();
        const t = setInterval(refresh, 30000); // poll every 30s
        return () => clearInterval(t);
    }, [user, refresh]);

    useEffect(() => {
        const onClick = (e) => {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    const toggle = async () => {
        const next = !open;
        setOpen(next);
        if (next) {
            await load();
            // mark read after opening
            try {
                await api.post("/notifications/read");
                setUnread(0);
            } catch {
                /* noop */
            }
        }
    };

    if (!user) return null;

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={toggle}
                className="relative btn-outline-ink flex items-center gap-2"
                data-testid="notif-bell-btn"
                aria-label="Bildirimler"
            >
                <Bell size={14} />
                {unread > 0 && (
                    <span
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-stamp text-paper text-[10px] font-mono flex items-center justify-center border border-paper"
                        data-testid="notif-unread-count"
                    >
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </button>
            {open && (
                <div className="fixed inset-0 z-[120] bg-paper">
                    <button
                        type="button"
                        className="absolute inset-0 cursor-default bg-paper"
                        onClick={() => setOpen(false)}
                        aria-label="Bildirimleri kapat"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Bildirimler"
                        className="absolute left-1/2 top-6 sm:top-16 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 max-h-[min(720px,calc(100vh-3rem))] overflow-hidden bg-[#F4EFE6] border-4 border-double border-ink shadow-[8px_8px_0_0_rgba(26,26,26,0.75)]"
                        data-testid="notif-dropdown"
                    >
                        <div className="px-4 sm:px-5 py-4 border-b-4 border-double border-ink flex items-center justify-between gap-3">
                            <p className="font-masthead text-2xl font-black">Bildirimler</p>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="p-2 border-2 border-ink hover:bg-ink hover:text-paper"
                                aria-label="Bildirimleri kapat"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="px-4 sm:px-5 py-3 max-h-[calc(min(720px,calc(100vh-3rem))-74px)] overflow-y-auto bg-[#F4EFE6]">
                            {!loaded ? (
                                <p className="font-mono text-xs uppercase tracking-widest text-inkmuted py-4 text-center">Yükleniyor...</p>
                            ) : items.length === 0 ? (
                                <p className="font-serif italic text-inkmuted py-6 text-center" data-testid="notif-empty">Henüz bildirim yok.</p>
                            ) : (
                                <ul className="divide-y divide-dashed divide-ink/30">
                                    {items.map((n) => <li key={n.notification_id}><NotificationItem n={n} onSelect={() => setOpen(false)} /></li>)}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

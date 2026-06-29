import { useCallback, useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";

function ago(iso) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "az önce";
    if (diff < 3600) return `${Math.floor(diff / 60)} dk`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} sa`;
    return `${Math.floor(diff / 86400)} gün`;
}

function NotificationItem({ n }) {
    const data = n.data || {};
    if (n.type === "comment") {
        return (
            <Link to={`/fisilti/${data.whisper_id}`} className="block hover:bg-ink/5 -mx-2 px-2 py-3" data-testid={`notif-${n.notification_id}`}>
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Yeni yorum</p>
                <p className="font-serif text-sm mt-1"><strong>{data.from_name}</strong>: {data.preview}</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-inkmuted mt-1">{ago(n.created_at)}</p>
            </Link>
        );
    }
    if (n.type === "follow") {
        return (
            <Link to={`/muhabir/${data.from_user_id}`} className="block hover:bg-ink/5 -mx-2 px-2 py-3" data-testid={`notif-${n.notification_id}`}>
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Yeni takipçi</p>
                <p className="font-serif text-sm mt-1"><strong>{data.from_name}</strong> seni takip etmeye başladı.</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-inkmuted mt-1">{ago(n.created_at)}</p>
            </Link>
        );
    }
    if (n.type === "moderation") {
        return (
            <div className="block -mx-2 px-2 py-3" data-testid={`notif-${n.notification_id}`}>
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Fısıltın gizlendi</p>
                <p className="font-serif text-sm mt-1">{data.reason || "İçerik kurallarına uygun değil."}</p>
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
                <div
                    className="absolute right-0 mt-2 w-[340px] max-h-[480px] overflow-y-auto bg-paper border-2 border-ink z-50 shadow-[6px_6px_0_0_rgba(26,26,26,0.5)]"
                    data-testid="notif-dropdown"
                >
                    <div className="px-4 py-3 border-b-2 border-double border-ink">
                        <p className="font-masthead text-lg font-black">Bildirimler</p>
                    </div>
                    <div className="px-4 py-2">
                        {!loaded ? (
                            <p className="font-mono text-xs uppercase tracking-widest text-inkmuted py-4 text-center">Yükleniyor...</p>
                        ) : items.length === 0 ? (
                            <p className="font-serif italic text-inkmuted py-6 text-center" data-testid="notif-empty">Henüz bildirim yok.</p>
                        ) : (
                            <ul className="divide-y divide-dashed divide-ink/30">
                                {items.map((n) => <li key={n.notification_id}><NotificationItem n={n} /></li>)}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

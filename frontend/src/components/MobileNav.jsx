import { Link, useLocation } from "react-router-dom";
import { Home, MessageCircle, PenLine, Search, UserCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const items = [
    { to: "/", label: "Akış", icon: Home },
    { to: "/muhabirler", label: "Bul", icon: Search, auth: true },
    { to: "/yaz", label: "Yaz", icon: PenLine, auth: true },
    { to: "/mesajlar", label: "Mesaj", icon: MessageCircle, auth: true },
    { to: "/profil", label: "Profil", icon: UserCircle2, auth: true },
];

export default function MobileNav() {
    const { user } = useAuth();
    const location = useLocation();
    if (!user) return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-ink bg-paper/95 backdrop-blur md:hidden" data-testid="mobile-nav">
            <div className="grid grid-cols-5">
                {items.map(({ to, label, icon: Icon }) => {
                    const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
                    return (
                        <Link
                            key={to}
                            to={to}
                            className={`min-h-[58px] flex flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-widest ${active ? "bg-ink text-paper" : "text-ink"}`}
                            data-testid={`mobile-nav-${label.toLowerCase()}`}
                        >
                            <Icon size={18} />
                            {label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

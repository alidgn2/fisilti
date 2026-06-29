import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PenLine, LogIn, UserCircle2, LogOut, Newspaper, ShieldCheck, Settings, Search, MessageCircle } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

function todayTr() {
    const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const d = new Date();
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${days[d.getDay()]}`;
}

export default function Masthead() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    return (
        <header className="relative z-10 border-b-4 border-double border-ink">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-3">
                {/* Top bar */}
                <div className="flex justify-between items-center text-xs font-mono tracking-widest uppercase text-inkmuted pb-2">
                    <span data-testid="masthead-date">{todayTr()}</span>
                    <span>Sayı № {new Date().getFullYear() - 2025 + 1} • Kuruş Yok, Sadece Söylenti</span>
                </div>
                <div className="divider-double" />

                {/* Masthead */}
                <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 pt-4">
                    <Link to="/" className="block group" data-testid="masthead-home-link">
                        <h1 className="font-masthead font-black leading-none tracking-tighter text-[2.75rem] sm:text-6xl lg:text-7xl">
                            Fısıltı <span className="italic font-light">Gazetesi</span>
                        </h1>
                        <p className="font-mono text-[11px] sm:text-xs uppercase tracking-[0.35em] mt-2 text-inkmuted">
                            Kahvehaneden, Berberden, Taksiden — Halkın Kulağına Çalınanlar
                        </p>
                    </Link>

                    <nav className="flex items-center gap-2 flex-wrap">
                        {user ? (
                            <>
                                <button
                                    onClick={() => navigate("/yaz")}
                                    className="btn-ink flex items-center gap-2"
                                    data-testid="masthead-compose-btn"
                                >
                                    <PenLine size={14} />
                                    Fısıltı Yaz
                                </button>
                                <Link to="/muhabirler" className="btn-outline-ink flex items-center gap-2" data-testid="masthead-user-search-link">
                                    <Search size={14} />
                                    Muhabir Bul
                                </Link>
                                <Link to="/mesajlar" className="btn-outline-ink flex items-center gap-2" data-testid="masthead-messages-link">
                                    <MessageCircle size={14} />
                                    Mesajlar
                                </Link>
                                <NotificationBell />
                                {user.role === "admin" && (
                                    <Link to="/editor" className="btn-outline-ink flex items-center gap-2" data-testid="masthead-admin-link">
                                        <ShieldCheck size={14} /> Editör
                                    </Link>
                                )}
                                <Link to="/profil" data-testid="masthead-profile-link" className="btn-outline-ink flex items-center gap-2">
                                    <UserCircle2 size={14} />
                                    {user.name?.split(" ")[0] || "Profil"}
                                </Link>
                                <Link to="/ayarlar" data-testid="masthead-settings-link" className="btn-outline-ink flex items-center gap-2" aria-label="Ayarlar">
                                    <Settings size={14} />
                                </Link>
                                <button
                                    onClick={async () => { await logout(); navigate("/"); }}
                                    className="btn-outline-ink flex items-center gap-2"
                                    data-testid="masthead-logout-btn"
                                    aria-label="Çıkış"
                                >
                                    <LogOut size={14} />
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/giris" className="btn-outline-ink flex items-center gap-2" data-testid="masthead-login-link">
                                    <LogIn size={14} />
                                    Giriş
                                </Link>
                                <Link to="/kayit" className="btn-ink flex items-center gap-2" data-testid="masthead-register-link">
                                    <Newspaper size={14} />
                                    Muhabir Ol
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </div>
        </header>
    );
}

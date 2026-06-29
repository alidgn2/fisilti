import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import WhisperCard from "@/components/WhisperCard";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, UserPlus, UserMinus, MessageCircle } from "lucide-react";

export default function PublicProfile() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [whispers, setWhispers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [followBusy, setFollowBusy] = useState(false);

    const toggleFollow = async () => {
        if (!currentUser) {
            navigate("/giris");
            return;
        }
        if (followBusy) return;
        setFollowBusy(true);
        try {
            const { data } = await api.post(`/users/${userId}/follow`);
            setProfile((p) => p ? {
                ...p,
                is_following: data.is_following,
                stats: { ...p.stats, follower_count: data.follower_count },
            } : p);
            toast.success(data.is_following ? "Takip ediliyor" : "Takipten çıkıldı");
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setFollowBusy(false);
        }
    };

    const load = useCallback(async () => {
        setLoading(true);
        setNotFound(false);
        try {
            const [{ data: p }, { data: ws }] = await Promise.all([
                api.get(`/users/${userId}`),
                api.get(`/users/${userId}/whispers`),
            ]);
            setProfile(p);
            setWhispers(ws);
        } catch (e) {
            if (e?.response?.status === 404) {
                setNotFound(true);
            } else {
                toast.error(formatApiError(e));
            }
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { load(); }, [load]);

    // If the visitor is looking at their own profile, send them to /profil
    useEffect(() => {
        if (currentUser && currentUser.user_id === userId) {
            navigate("/profil", { replace: true });
        }
    }, [currentUser, userId, navigate]);

    if (loading) {
        return <div className="py-20 text-center font-mono uppercase tracking-widest text-inkmuted text-sm" data-testid="public-profile-loading">Muhabir kartı aranıyor...</div>;
    }
    if (notFound || !profile) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-20 text-center" data-testid="public-profile-notfound">
                <p className="font-masthead text-4xl font-black">Muhabir kayıp</p>
                <p className="font-serif italic mt-2 text-inkmuted">Bu muhabir gazetemizden ayrılmış olabilir.</p>
                <Link to="/" className="btn-outline-ink mt-6 inline-block">Manşete Dön</Link>
            </div>
        );
    }

    const stats = profile.stats || {};
    const memberSince = profile.created_at
        ? new Date(profile.created_at).toLocaleDateString("tr-TR", { year: "numeric", month: "long" })
        : "—";

    return (
        <div className="max-w-5xl mx-auto px-4 py-10 relative z-10" data-testid="public-profile-page">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-inkmuted hover:text-ink mb-4" data-testid="public-profile-back-btn">
                <ArrowLeft size={12} /> Geri
            </button>

            {/* Press Card */}
            <div className="border-2 border-ink p-6 sm:p-8 bg-paper/60 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 flex items-center gap-4">
                    {profile.picture ? (
                        <img src={profile.picture} alt={profile.name} className="w-24 h-24 border-2 border-ink object-cover grayscale" data-testid="public-profile-avatar" />
                    ) : (
                        <div className="w-24 h-24 border-2 border-ink flex items-center justify-center font-masthead text-4xl font-black" data-testid="public-profile-avatar">
                            {profile.name?.[0]?.toUpperCase() || "M"}
                        </div>
                    )}
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-stamp">Saha Muhabiri</p>
                        <h2 className="font-masthead text-3xl font-black leading-tight" data-testid="public-profile-name">{profile.name}</h2>
                        <p className="font-mono text-xs uppercase tracking-widest text-inkmuted mt-1">
                            № {profile.user_id.slice(2, 10).toUpperCase()}
                        </p>
                        <p className="font-serif italic text-sm text-inkmuted mt-1">{memberSince}'dan beri</p>
                    </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4 items-center md:border-l-2 md:border-dashed md:border-ink/40 md:pl-6">
                    <Stat label="Fısıltı" value={stats.whisper_count ?? 0} testid="public-stat-whispers" />
                    <Stat label="Takipçi" value={stats.follower_count ?? 0} testid="public-stat-followers" />
                    <Stat label="Doğru" value={stats.total_upvotes ?? 0} testid="public-stat-up" />
                    <Stat label="Yalan" value={stats.total_downvotes ?? 0} testid="public-stat-down" />
                </div>
            </div>

            {!profile.is_self && (
                <div className="mt-6 flex justify-end gap-3 flex-wrap">
                    <Link to={`/mesajlar/${profile.user_id}`} className="btn-outline-ink flex items-center gap-2" data-testid="public-profile-message-link">
                        <MessageCircle size={14} /> Mesaj Gönder
                    </Link>
                    <button
                        onClick={toggleFollow}
                        disabled={followBusy}
                        className={profile.is_following ? "btn-outline-ink flex items-center gap-2" : "btn-ink flex items-center gap-2"}
                        data-testid="public-profile-follow-btn"
                    >
                        {profile.is_following ? <><UserMinus size={14} /> Takipten Çık</> : <><UserPlus size={14} /> Takip Et</>}
                    </button>
                </div>
            )}

            <div className="mt-10">
                <h3 className="font-masthead text-2xl font-black mb-4 border-b-2 border-double border-ink pb-2">
                    {profile.name} adlı muhabirin fısıltıları
                </h3>
                {whispers.length === 0 ? (
                    <p className="font-serif italic text-inkmuted">Bu muhabir henüz bir fısıltı yazmamış.</p>
                ) : (
                    <div className="newsfeed columns-1 md:columns-2" data-testid="public-profile-whispers">
                        {whispers.map((w) => <WhisperCard key={w.whisper_id} whisper={w} />)}
                    </div>
                )}
            </div>
        </div>
    );
}

function Stat({ label, value, testid }) {
    return (
        <div className="text-center" data-testid={testid}>
            <p className="font-masthead text-4xl font-black leading-none">{value}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-inkmuted mt-2">{label}</p>
        </div>
    );
}

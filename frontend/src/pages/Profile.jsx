import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import WhisperCard from "@/components/WhisperCard";
import { toast } from "sonner";

export default function Profile() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [whispers, setWhispers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const [{ data: s }, { data: ws }] = await Promise.all([
                    api.get("/users/me/stats"),
                    api.get(`/users/${user.user_id}/whispers`),
                ]);
                setStats(s);
                setWhispers(ws);
            } catch (e) {
                toast.error(formatApiError(e));
            } finally {
                setLoading(false);
            }
        })();
    }, [user]);

    if (!user) return null;

    return (
        <div className="max-w-5xl mx-auto px-4 py-10 relative z-10" data-testid="profile-page">
            {/* Press Card */}
            <div className="border-2 border-ink p-6 sm:p-8 bg-paper/60 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 flex items-center gap-4">
                    {user.picture ? (
                        <img src={user.picture} alt={user.name} className="w-24 h-24 border-2 border-ink object-cover grayscale" />
                    ) : (
                        <div className="w-24 h-24 border-2 border-ink flex items-center justify-center font-masthead text-4xl font-black">
                            {user.name?.[0]?.toUpperCase() || "M"}
                        </div>
                    )}
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-stamp">Saha Muhabiri</p>
                        <h2 className="font-masthead text-3xl font-black leading-tight">{user.name}</h2>
                        <p className="font-mono text-xs uppercase tracking-widest text-inkmuted mt-1">
                            № {user.user_id.slice(2, 10).toUpperCase()}
                        </p>
                    </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-3 gap-4 items-center md:border-l-2 md:border-dashed md:border-ink/40 md:pl-6">
                    <Stat label="Fısıltı" value={stats?.whisper_count ?? "—"} testid="stat-whispers" />
                    <Stat label="Doğru" value={stats?.total_upvotes ?? "—"} testid="stat-up" />
                    <Stat label="Yalan" value={stats?.total_downvotes ?? "—"} testid="stat-down" />
                </div>
            </div>

            <div className="mt-10">
                <h3 className="font-masthead text-2xl font-black mb-4 border-b-2 border-double border-ink pb-2">Yazdığın Fısıltılar</h3>
                {loading ? (
                    <p className="font-mono uppercase tracking-widest text-inkmuted text-xs">Yükleniyor...</p>
                ) : whispers.length === 0 ? (
                    <p className="font-serif italic text-inkmuted">Henüz hiçbir fısıltın yok. Sahaya çık!</p>
                ) : (
                    <div className="newsfeed columns-1 md:columns-2" data-testid="profile-whispers">
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

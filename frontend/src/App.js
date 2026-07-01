import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Link } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Masthead from "@/components/Masthead";
import MobileNav from "@/components/MobileNav";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Compose from "@/pages/Compose";
import WhisperDetail from "@/pages/WhisperDetail";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import UserSearch from "@/pages/UserSearch";
import Messages from "@/pages/Messages";
import PublicProfile from "@/pages/PublicProfile";
import FollowList from "@/pages/FollowList";
import HashtagFeed from "@/pages/HashtagFeed";
import PaymentSuccess from "@/pages/PaymentSuccess";
import AdminPanel from "@/pages/AdminPanel";
import AuthCallback from "@/pages/AuthCallback";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import Terms from "@/pages/Terms";
import ProtectedRoute from "@/components/ProtectedRoute";

function Footer() {
    return (
        <footer className="border-t-4 border-double border-ink mt-16 py-8 relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-inkmuted space-y-3">
                Fısıltı Gazetesi — Mahalle Ajansı • Söylentidir, Haber Değildir • {new Date().getFullYear()}
                <p className="flex flex-wrap justify-center gap-4 tracking-[0.2em]">
                    <Link to="/gizlilik" className="hover:text-ink underline">Gizlilik Politikası</Link>
                    <Link to="/kullanim-sartlari" className="hover:text-ink underline">Kullanım Şartları</Link>
                </p>
            </div>
        </footer>
    );
}

function AppShell() {
    const location = useLocation();
    // Detect Emergent OAuth callback in URL hash (any route)
    if (location.hash?.includes("session_id=")) {
        return <AuthCallback />;
    }

    return (
        <>
            <Masthead />
            <main className="min-h-[60vh]">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/giris" element={<Login />} />
                    <Route path="/kayit" element={<Register />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/fisilti/:id" element={<WhisperDetail />} />
                    <Route path="/muhabir/:userId" element={<PublicProfile />} />
                    <Route path="/muhabir/:userId/takipciler" element={<FollowList type="followers" />} />
                    <Route path="/muhabir/:userId/takip-edilenler" element={<FollowList type="following" />} />
                    <Route path="/etiket/:tag" element={<HashtagFeed />} />
                    <Route path="/odeme/basarili" element={<PaymentSuccess />} />
                    <Route path="/gizlilik" element={<PrivacyPolicy />} />
                    <Route path="/kullanim-sartlari" element={<Terms />} />
                    <Route path="/editor" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
                    <Route path="/yaz" element={<ProtectedRoute><Compose /></ProtectedRoute>} />
                    <Route path="/profil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/ayarlar" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="/muhabirler" element={<ProtectedRoute><UserSearch /></ProtectedRoute>} />
                    <Route path="/mesajlar" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                    <Route path="/mesajlar/:userId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                </Routes>
            </main>
            <Footer />
            <MobileNav />
        </>
    );
}

function App() {
    return (
        <div className="App paper-texture grain">
            <BrowserRouter>
                <AuthProvider>
                    <AppShell />
                    <Toaster position="top-right" />
                </AuthProvider>
            </BrowserRouter>
        </div>
    );
}

export default App;

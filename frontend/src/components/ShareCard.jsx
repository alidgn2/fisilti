import { forwardRef } from "react";
import { CATEGORY_MAP } from "@/constants/categories";

/**
 * Visually polished, off-screen shareable card.
 * Render this at native 1080x1920 (story) or 1080x1080 (square) so the captured
 * PNG is crisp on Instagram / TikTok / X.
 */
const ShareCard = forwardRef(function ShareCard({ whisper, format = "story" }, ref) {
    const isStory = format === "story";
    const W = 1080;
    const H = isStory ? 1920 : 1080;

    const categoryLabel = CATEGORY_MAP[whisper.category] || whisper.category;

    return (
        <div
            ref={ref}
            style={{
                width: `${W}px`,
                height: `${H}px`,
                background: "#F4EFE6",
                color: "#1A1A1A",
                position: "relative",
                overflow: "hidden",
                fontFamily: '"Cormorant Garamond", serif',
                padding: isStory ? "120px 100px" : "90px 100px",
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
            }}
        >
            {/* Halftone dot grain */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage:
                        "radial-gradient(rgba(0,0,0,0.18) 1.5px, transparent 1.5px)",
                    backgroundSize: "6px 6px",
                    mixBlendMode: "multiply",
                    opacity: 0.15,
                    pointerEvents: "none",
                }}
            />

            {/* Top: Masthead */}
            <div style={{ borderTop: "6px double #1A1A1A", borderBottom: "6px double #1A1A1A", padding: "20px 0", textAlign: "center", position: "relative", zIndex: 2 }}>
                <div style={{ fontFamily: '"Special Elite", monospace', fontSize: 22, letterSpacing: "0.4em", textTransform: "uppercase", color: "#4A4A4A" }}>
                    Mahalle Ajansı • Söylentidir
                </div>
                <h1 style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: 96, margin: "10px 0 0 0", lineHeight: 1, letterSpacing: "-0.02em" }}>
                    Fısıltı <span style={{ fontStyle: "italic", fontWeight: 300 }}>Gazetesi</span>
                </h1>
            </div>

            {/* Body */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 2, marginTop: 40 }}>
                {/* Category stamp */}
                <div style={{ marginBottom: 36 }}>
                    <span
                        style={{
                            display: "inline-block",
                            border: "4px solid #B22222",
                            color: "#B22222",
                            padding: "10px 22px",
                            textTransform: "uppercase",
                            letterSpacing: "0.18em",
                            fontFamily: '"Special Elite", monospace',
                            fontSize: 28,
                            transform: "rotate(-2deg)",
                            mixBlendMode: "multiply",
                            background: "transparent",
                        }}
                    >
                        {categoryLabel}
                    </span>
                </div>

                {/* Whisper content */}
                <div
                    style={{
                        fontFamily: '"Special Elite", monospace',
                        fontSize: isStory ? 56 : 48,
                        lineHeight: 1.45,
                        color: "#1A1A1A",
                        wordBreak: "break-word",
                    }}
                >
                    <span style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: isStory ? 200 : 160, float: "left", lineHeight: 0.85, paddingRight: 24, paddingTop: 18 }}>
                        {whisper.content.charAt(0)}
                    </span>
                    {whisper.content.slice(1)}
                </div>
            </div>

            {/* Byline */}
            <div style={{ marginTop: 40, position: "relative", zIndex: 2, fontFamily: '"Special Elite", monospace', fontSize: 26, color: "#4A4A4A", textTransform: "uppercase", letterSpacing: "0.18em" }}>
                <div style={{ borderTop: "2px dashed rgba(26,26,26,0.4)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
                    <div>— {whisper.author_name}</div>
                    {whisper.overheard_from && <div>↣ {whisper.overheard_from}</div>}
                    {whisper.location && <div>◉ {whisper.location}</div>}
                </div>
            </div>

            {/* Footer / CTA */}
            <div
                style={{
                    marginTop: 50,
                    borderTop: "6px double #1A1A1A",
                    paddingTop: 26,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    position: "relative",
                    zIndex: 2,
                }}
            >
                <div style={{ fontFamily: '"Special Elite", monospace', fontSize: 24, letterSpacing: "0.3em", textTransform: "uppercase", color: "#4A4A4A" }}>
                    Sen de bir fısıltı bırak ↴
                </div>
                <div style={{ fontFamily: '"Playfair Display", serif', fontStyle: "italic", fontSize: 32, fontWeight: 700, color: "#1A1A1A" }}>
                    fisilti.gazetesi
                </div>
            </div>
        </div>
    );
});

export default ShareCard;

# PRD — Fısıltı Gazetesi

## Original Problem Statement
> "kanka şimdi bir app yapacağız tamam mı bunun olayı şu : Millet kahvehanede, berberde duyduğu böyle gizemli bilgileri dünya gündemiyle alakalı bu platformda yazabilecek sen artı bir şeyler koyabilirsin ana fikir bu"

A social platform where Turkish users share mysterious/gossip information they overheard at coffee houses (kahvehane), barber shops (berber), taxis, etc., all tied to world agenda / current affairs. Aesthetic: vintage Turkish newspaper / tabloid (sepia, typewriter font).

## User-confirmed Choices
- **App name:** "Fısıltı Gazetesi"
- **Auth:** Email/password (JWT) + Emergent Google Auth
- **AI features:** None for v1
- **Engagement:** Upvote/Downvote, Categories, Comments — all enabled
- **Aesthetic:** Retro newspaper / sepia / typewriter font (Special Elite + Playfair Display + Cormorant Garamond)

## Architecture
- **Backend:** FastAPI (Python), MongoDB (motor), bcrypt + httpOnly session cookies
- **Frontend:** React 19 + react-router 7 + Tailwind + Shadcn UI primitives, sonner toasts
- **Auth:** Unified session_token cookie for both email/password and Google flows; user records merged by email
- **Database collections:**
  - `users` (user_id, email, name, password_hash?, picture?, auth_provider, role)
  - `user_sessions` (session_token, user_id, expires_at)
  - `whispers` (whisper_id, user_id, content, category, location, overheard_from, upvotes, downvotes)
  - `votes` (vote_id, whisper_id, user_id, value)
  - `comments` (comment_id, whisper_id, user_id, content)

## Implemented (v1 — Feb 2026)
- Authentication: register, login, logout, /me; Emergent Google OAuth callback flow
- Whispers: create, list (sorted new/trending/top), single, delete
- Voting (upvote/downvote with toggle + switch logic)
- Comments (list + post)
- Profile page with personal stats (whisper count, total up/down, credibility)
- Categories: kahvehane, berber, taksi, dolmuş, market, çay bahçesi, lokanta, kuaför, park, diğer
- Newspaper-style homepage (lead story + sidebar mırıltılar + masonry feed)
- Admin seeded on startup
- Vintage newspaper UI: sepia paper background, paper texture, halftone grain, dropcap, stamp badges, dashed dividers

## Personas
- **Mahalleli Muhabir:** Casual user who overhears something, drops a whisper anonymously-ish, votes/comments
- **Editör (Admin):** Can delete any whisper

## Backlog
- P1: AI credibility scoring & dünya-gündemi bağlantı analizi
- P1: Profile pages for other users (public view)
- P1: Direct share links + OG image generation
- P2: Push notifications on replies/votes
- P2: Map view by location
- P2: Daily "Editör Seçtikleri" newsletter
- P2: Reporting/flagging abusive content

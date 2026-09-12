# 01: Scaffold + Auth + Design system

**What to build:** A fully styled, navigable React app shell with working authentication. A user can open the app, see the login page, log in with their credentials, and land on a skeleton dashboard with navigation to all pages. JWT tokens refresh automatically. Expired trials show the trial-expired page. Unverified emails show the verify-email page. The entire app uses the design system tokens — dark theme, coral accent, Inter for content, JetBrains Mono for UI chrome.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Vite + React + TypeScript project initialised in the repo
- [x] React Router v6 with all routes defined (/, /timer, /workspace, /calendar, /study, /habits, /moments, /stats, /settings, /login, /verify-email, /trial-expired)
- [x] TanStack Query (React Query) configured with a QueryClient
- [x] All CSS design tokens declared as custom properties on :root (colors, typography, spacing, radius, shadows, transitions, layout)
- [x] Global styles: reset, typography rules (mono for chrome, sans for content), token-based
- [x] Nav component: fixed top, border-bottom, links in mono font, active link with coral underline, responsive padding
- [x] Login page: email + password form, calls POST /api/auth/token/, stores JWT in localStorage
- [x] Automatic token refresh via POST /api/auth/token/refresh/ on 401
- [x] Redirect to /login on auth failure after refresh attempt
- [x] Trial-expired page with contact link
- [x] Verify-email page
- [x] Auth guard: unauthenticated users redirected to /login, unverified to /verify-email, expired trial to /trial-expired
- [x] All route pages render as empty shells with page title (filled in by subsequent tickets)
- [x] Mobile-first layout with container width tokens
- [x] Font files (Inter, JetBrains Mono) loaded from frontend/fonts/

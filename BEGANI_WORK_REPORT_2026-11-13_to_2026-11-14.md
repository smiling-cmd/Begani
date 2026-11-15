# Begani Development Work Report

**Reporting period:** November 13–14, 2026  
**Project:** Begani student wellbeing platform  
**Scope:** Frontend interaction and responsive design, backend API integration, branding, onboarding, chat, notifications, and TUA recommendations.

## Summary

During this period, Begani’s student and therapist experiences were made more interactive and responsive. Key additions include API-backed Resources and Activities, persisted activity registration, therapist messaging and notifications, personalized onboarding, light/dark themes, refreshed brand imagery, and TUA responses that can link to an approved therapist. The therapist dashboard was also expanded with chat and appointment information.

## Work completed

### Student experience and personalization

- Connected Resources to authenticated backend data, showing published resources.
- Connected Activities to published upcoming activities and added registration history and registration actions.
- Added backend protections for duplicate registrations, activity capacity, cancelled-registration reuse, and paid activities that do not yet have a payment flow.
- Added Settings/profile controls, including phone-number updates and sign-out.
- Added full-name onboarding after registration, a welcome screen with a dashboard continuation, and a time-of-day Home greeting using the saved name.
- Improved the Home experience with a dedicated TUA card, quick-access actions, mood/help interactions, and layouts that adapt to smaller screens.
- Added a persistent light/dark theme preference and theme-aware styling across the main student and therapist screens.

### Messaging and notifications

- Added a shared therapist chat experience for students and therapists, including inbox/thread views, message sending, and periodic message refresh.
- Added responsive chat layouts for desktop, tablet, and phone.
- Updated phone navigation to an icon-only bottom bar; profile and Settings access are available from the mobile header alongside notifications.
- Added authenticated notification listing and mark-as-read APIs. Message notifications use generic text and do not include the message body.
- Kept chat access participant-scoped and enforced existing chat limits and booking requirements on the backend.

### Therapist tools

- Expanded the therapist dashboard with appointment and chat information, four summary cards, an appointments table, priority badges, status actions, and the availability form.
- Made the dashboard responsive for smaller screens.
- Integrated the existing therapist chat-thread data into the dashboard’s chat count.

### TUA and therapist discovery

- Updated TUA’s backend response contract to JSON, including an optional therapist ID.
- Included only approved therapists in recommendations and validated returned IDs against that approved list before sending them to the client.
- Added a therapist-profile/booking link to TUA messages only when the backend returns a valid approved therapist ID.
- Preserved explicit error responses for provider failures and malformed responses; TUA is instructed not to diagnose and to direct crisis situations to immediate help.

### Branding and visual polish

- Applied Begani’s palette: dark green `#1A4331`, sage `#A8B9A3`, terracotta `#E07A5F`, cream `#F5F0E7`, and the requested soft terracotta and sage surfaces.
- Replaced placeholder brand treatments with the available logo and TUA assets; updated the browser favicon and used TUA in the relevant navigation and content areas.
- Adjusted the Home TUA card so its text and image fit together. Added a cropped transparent-background derivative for the card so its background shows through around TUA; the original artwork remains unchanged.
- Kept TUA out of the Home header and gave it a dedicated chat card.

## Backend and data changes

- Added `User.full_name` and the `accounts` migration `0003_user_full_name`.
- Added or connected APIs for published resources, upcoming activities, activity registration history, profile updates, chat threads/messages, notifications, and TUA responses.
- Kept activity registration and notification operations scoped to the authenticated user.

## Verification performed

- Frontend lint and production build passed after the responsive dashboard and TUA image changes.
- Focused backend test suites passed for account/resource/activity behavior, messaging/notifications, and TUA recommendations. The TUA tests covered approved IDs, unapproved IDs, and malformed JSON.
- Python syntax checks for the changed TUA files and the TUA response signature/call-site compatibility check passed.
- Responsive browser checks at representative phone and tablet widths found no horizontal overflow.
- Migration checks found no additional model changes pending after the full-name migration.

## Known limitations and deferred work

- End-to-end encryption was discussed and deferred. This work does **not** make therapist chat end-to-end encrypted.
- Paid activity registration remains unavailable until a checkout/payment flow exists; the API explicitly rejects it rather than reporting a successful registration.
- The therapist dashboard’s “Booked this year” figure currently reflects the returned bookings list count; it is not filtered by calendar year.
- TUA recommendations depend on the configured Groq provider and its environment-based API key.
- No production deployment or release verification was performed as part of this work.

## Main implementation areas

- Frontend pages: [Home](frontend/src/pages/Home.jsx), [Find Support](frontend/src/pages/FindSupport.jsx), [TUA](frontend/src/pages/Tua.jsx), [Therapist Dashboard](frontend/src/pages/TherapistDashboard.jsx), and [Settings](frontend/src/pages/Settings.jsx).
- Frontend navigation and theme: [Sidebar](frontend/src/components/Sidebar.jsx), [Mobile Header](frontend/src/components/MobileHeader.jsx), and [Theme Context](frontend/src/context/ThemeContext.jsx).
- Backend: [accounts](backend/accounts/), [activities](backend/activities/), [resources](backend/resources/), [messaging](backend/messaging/), [notifications](backend/notifications/), and [TUA](backend/tua/).
- Full-name schema change: [migration 0003](backend/accounts/migrations/0003_user_full_name.py).

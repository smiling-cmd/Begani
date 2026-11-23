import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './LegalPage.css';

const UPDATED = 'November 2026';

const TERMS = [
  ['What BEGANI is', 'BEGANI ("Share the load") is a student wellbeing platform. It offers self-care tools, learning resources, an AI companion called TUA, and a way to book and message counsellors.'],
  ['Not emergency care', 'BEGANI is not an emergency service. If you may be in immediate danger, call 999 or 112 now. The emergency line on Home and Find Support lists more help.'],
  ['TUA is an AI companion', 'TUA can listen, help with small worries and point you to a counsellor. It is not a therapist and cannot diagnose or treat anything.'],
  ['Counsellors', 'Counsellors on BEGANI are independent professionals. School counsellor sessions are free. Private counsellors set their own fees, which you see before you book.'],
  ['Your account', 'Keep your password private and give accurate details. You can use an alias so other people do not see your full name. You can ask us to close your account at any time.'],
  ['Using BEGANI respectfully', 'Do not harass others, impersonate anyone, or try to break or misuse the platform. We may suspend accounts that put other people at risk.'],
  ['Changes', 'We may update these terms as BEGANI grows. When we make an important change, we will tell you in the app.'],
];

const PRIVACY = [
  ['What we collect', 'Your name or alias, email, role and any phone number you add. We also keep what you choose to write: mood check-ins, journal entries, chats with TUA and messages with counsellors.'],
  ['How we use it', 'To run your account, show your own wellbeing history, connect you with counsellors, and keep the platform safe. We do not sell your data or use it for advertising.'],
  ['Who can see what', 'Mood check-ins and journal entries are private to your account. TUA chats are visible only to you unless you ask for a counsellor to join. A counsellor sees the messages and details you share with them. A phone number is shared only if you agree when you request urgent support.'],
  ['TUA chats', 'TUA chats you do not save are deleted after 90 days. Chats you save stay until you remove them.'],
  ['How we protect it', 'Chat messages, TUA chats, journal entries, urgent-request notes and counsellor reports are encrypted in our database, and traffic between your device and BEGANI uses HTTPS. They are not end-to-end encrypted: BEGANI can decrypt them to show them back to you, and TUA needs to read your messages to reply. Do not share passwords or card details in chat.'],
  ['Your rights', 'Under the Kenya Data Protection Act, 2019 you can ask to see, correct or delete your personal data. Contact the BEGANI team through the details on your university wellbeing page.'],
  ['Safety exception', 'If we believe someone is at serious risk of harm, a counsellor may need to involve emergency help. We will be as open with you about this as we can.'],
];

const PAGES = {
  terms: { title: 'Terms of Use', intro: 'The short version: use BEGANI kindly, and remember it supports you but does not replace emergency care.', sections: TERMS, other: { to: '/privacy', label: 'Privacy Policy' } },
  privacy: { title: 'Privacy Policy', intro: 'The short version: your wellbeing data is yours. We keep it to run BEGANI and we never sell it.', sections: PRIVACY, other: { to: '/terms', label: 'Terms of Use' } },
};

export default function LegalPage({ kind }) {
  const page = PAGES[kind];
  return (
    <main className="legal-page">
      <article className="legal-card">
        <Link className="legal-back" to="/register"><ArrowLeft size={16} aria-hidden="true" /> Back to sign up</Link>
        <h1>{page.title}</h1>
        <p className="legal-intro">{page.intro}</p>
        <p className="legal-updated">Last updated {UPDATED}</p>
        {page.sections.map(([heading, text]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <p>{text}</p>
          </section>
        ))}
        <p className="legal-other">Also read our <Link to={page.other.to}>{page.other.label}</Link>.</p>
      </article>
    </main>
  );
}

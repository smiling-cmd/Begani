// Where to send someone right after they sign in, based on their account.
export function homeAfterLogin(profile) {
  if (profile.role === 'admin') return '/admin-dashboard';
  if (profile.role === 'therapist') return '/therapist-dashboard';
  if (!profile.full_name?.trim()) return '/onboarding';
  return '/home';
}

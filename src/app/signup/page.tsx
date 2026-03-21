// app/signup/page.tsx
// Legacy signup route — redirect to the secure /auth/signup which has reCAPTCHA protection
import { redirect } from 'next/navigation';

export default function LegacySignupPage() {
  redirect('/auth/signup');
}

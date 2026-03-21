// app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirect to home - middleware will handle auth check
  redirect('/home');
}
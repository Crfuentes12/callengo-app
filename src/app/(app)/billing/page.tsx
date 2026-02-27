// app/(app)/billing/page.tsx
// Redirect to Settings > Billing & Plans tab
import { redirect } from 'next/navigation';

export default function BillingRedirect() {
  redirect('/settings?tab=billing');
}

// app/api/contacts/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { expensiveLimiter } from '@/lib/rate-limit';
import { parseCSV, mapRowToContact } from '@/lib/call-agent-utils';
import { ColumnMapping } from '@/types/call-agent';
import { trackServerEvent } from '@/lib/analytics';
import { captureServerEvent } from '@/lib/posthog-server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 10_000;

// Contact limits per plan (prevents unbounded growth on lower tiers)
const PLAN_CONTACT_LIMITS: Record<string, number> = {
  free: 50,
  starter: 5_000,
  growth: 15_000,
  business: 50_000,
  teams: 100_000,
  enterprise: 500_000,
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 3 imports per minute per user (heavy DB operation)
    const rateLimit = await expensiveLimiter.check(3, `contacts_import_${user.id}`);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many import requests. Please wait.' }, { status: 429 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
    }

    // Check subscription status and plan limits before allowing import
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('status, subscription_plans ( slug )')
      .eq('company_id', userData.company_id)
      .maybeSingle();

    const planSlug = (subscription?.subscription_plans as unknown as { slug: string })?.slug || 'free';
    const subStatus = subscription?.status;

    if (subStatus && subStatus !== 'active' && subStatus !== 'trialing') {
      return NextResponse.json(
        { error: 'Your subscription is not active. Please update your payment method to import contacts.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mappingJson = formData.get('mapping') as string | null;
    const listId = formData.get('listId') as string | null;

    if (!file || !mappingJson) {
      return NextResponse.json({ error: 'File and mapping required' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds maximum size of 10MB' }, { status: 400 });
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.txt')) {
      return NextResponse.json({ error: 'Only CSV files are accepted' }, { status: 400 });
    }

    let mapping: ColumnMapping;
    try {
      mapping = JSON.parse(mappingJson);
    } catch {
      return NextResponse.json({ error: 'Invalid column mapping format' }, { status: 400 });
    }

    // Validate list_id belongs to this company (prevent cross-company import)
    if (listId) {
      const { data: list } = await supabase
        .from('contact_lists')
        .select('id')
        .eq('id', listId)
        .eq('company_id', userData.company_id)
        .maybeSingle();

      if (!list) {
        return NextResponse.json({ error: 'Contact list not found' }, { status: 404 });
      }
    }

    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    // Validate row count
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `File contains ${rows.length} rows. Maximum allowed is ${MAX_ROWS}.` },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File contains no data rows' }, { status: 400 });
    }

    // Check contact count limit per plan
    const contactLimit = PLAN_CONTACT_LIMITS[planSlug] || PLAN_CONTACT_LIMITS.free;
    const { count: currentCount } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', userData.company_id);

    if ((currentCount || 0) + rows.length > contactLimit) {
      return NextResponse.json(
        { error: `Contact limit exceeded. Your ${planSlug} plan allows ${contactLimit.toLocaleString()} contacts. You currently have ${(currentCount || 0).toLocaleString()} and are trying to import ${rows.length.toLocaleString()}. Please upgrade your plan or remove existing contacts.` },
        { status: 402 }
      );
    }

    const contacts: Record<string, unknown>[] = [];
    const skipped: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const contact = mapRowToContact(row, headers, mapping);

      if (contact) {
        contacts.push({
          ...contact,
          company_id: userData.company_id,
          list_id: listId || null,
        });
      } else {
        skipped.push({ row: i + 2, reason: 'Invalid phone number' });
      }
    }

    // Deduplicate: check for existing contacts with same phone numbers in this company
    if (contacts.length > 0) {
      const phoneNumbers = contacts
        .map(c => c.phone_number as string)
        .filter(Boolean);

      // Fetch existing phone numbers in batches to avoid query size limits
      const existingPhones = new Set<string>();
      const BATCH_SIZE = 500;
      for (let i = 0; i < phoneNumbers.length; i += BATCH_SIZE) {
        const batch = phoneNumbers.slice(i, i + BATCH_SIZE);
        const { data: existing } = await supabase
          .from('contacts')
          .select('phone_number')
          .eq('company_id', userData.company_id)
          .in('phone_number', batch);

        if (existing) {
          for (const e of existing) {
            existingPhones.add(e.phone_number);
          }
        }
      }

      // Also deduplicate within the import file itself
      const seenPhones = new Set<string>();
      const uniqueContacts: Record<string, unknown>[] = [];
      let duplicateCount = 0;
      let inFileDuplicateCount = 0;

      for (const contact of contacts) {
        const phone = contact.phone_number as string;
        if (existingPhones.has(phone)) {
          duplicateCount++;
          continue;
        }
        if (seenPhones.has(phone)) {
          inFileDuplicateCount++;
          continue;
        }
        seenPhones.add(phone);
        uniqueContacts.push(contact);
      }

      if (uniqueContacts.length > 0) {
        const { error } = await supabase.from('contacts').insert(uniqueContacts as never);
        if (error) throw error;
      }

      // Update imported count to reflect deduplicated results
      const totalSkippedDups = duplicateCount + inFileDuplicateCount;

      trackServerEvent(user.id, user.id, 'contact_import_completed', {
        imported_count: uniqueContacts.length,
        skipped_count: skipped.length,
        duplicate_count: duplicateCount,
        in_file_duplicate_count: inFileDuplicateCount,
        total_rows: rows.length,
        file_type: fileName.endsWith('.csv') ? 'csv' : 'txt',
        has_list_id: !!listId,
      });
      await captureServerEvent(user.id, 'contact_import_completed', {
        imported_count: uniqueContacts.length,
        skipped_count: skipped.length,
        duplicate_count: duplicateCount,
        total_rows: rows.length,
        file_type: fileName.endsWith('.csv') ? 'csv' : 'txt',
        has_list_id: !!listId,
      }, { company: userData.company_id });

      return NextResponse.json({
        imported: uniqueContacts.length,
        skipped: skipped.length + totalSkippedDups,
        duplicatesSkipped: duplicateCount,
        inFileDuplicatesSkipped: inFileDuplicateCount,
        skippedReasons: skipped.slice(0, 20),
      });
    }

    return NextResponse.json({
      imported: 0,
      skipped: skipped.length,
      duplicatesSkipped: 0,
      skippedReasons: skipped.slice(0, 20),
    });

  } catch (error) {
    console.error('Error importing contacts:', error);
    return NextResponse.json(
      { error: 'Failed to import contacts' },
      { status: 500 }
    );
  }
}
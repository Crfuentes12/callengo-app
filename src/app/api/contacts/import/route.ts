// app/api/contacts/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { parseCSV, mapRowToContact } from '@/lib/call-agent-utils';
import { ColumnMapping } from '@/types/call-agent';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 10_000;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
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

    if (contacts.length > 0) {
      const { error } = await supabase.from('contacts').insert(contacts);
      if (error) throw error;
    }

    return NextResponse.json({
      imported: contacts.length,
      skipped: skipped.length,
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
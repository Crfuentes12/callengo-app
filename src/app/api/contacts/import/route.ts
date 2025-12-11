// app/api/contacts/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { parseCSV, mapRowToContact } from '@/lib/call-agent-utils';
import { ColumnMapping } from '@/types/call-agent';

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

    if (!file || !mappingJson) {
      return NextResponse.json({ error: 'File and mapping required' }, { status: 400 });
    }

    const mapping: ColumnMapping = JSON.parse(mappingJson);
    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    const contacts: any[] = [];
    const skipped: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const contact = mapRowToContact(row, headers, mapping);
      
      if (contact) {
        contacts.push({
          ...contact,
          company_id: userData.company_id,
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
      { error: 'Failed to import contacts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
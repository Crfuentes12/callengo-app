// app/api/contacts/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { contactsToCSV } from '@/lib/call-agent-utils';
import { Contact } from '@/types/call-agent'; // Importar desde donde está definido

export async function GET(request: NextRequest) {
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

    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Cast a Contact[]
    const csvContent = contactsToCSV((contacts || []) as Contact[]);
    const today = new Date().toISOString().split('T')[0];
    const filename = `contacts_export_${today}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Error exporting contacts:', error);
    return NextResponse.json(
      { ewrror: 'Failed to export contacts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
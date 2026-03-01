// app/api/contacts/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { contactsToCSV } from '@/lib/call-agent-utils';
import type { Contact } from '@/types/call-agent';

const EXPORT_FIELDS = [
  'company_name', 'contact_name', 'email', 'phone_number',
  'address', 'city', 'state', 'zip_code',
  'status', 'call_outcome', 'last_call_date',
  'call_attempts', 'call_duration', 'notes', 'tags', 'source',
] as const;

const HEADER_LABELS: Record<string, string> = {
  company_name: 'Company Name',
  contact_name: 'Contact Name',
  email: 'Email',
  phone_number: 'Phone Number',
  address: 'Address',
  city: 'City',
  state: 'State',
  zip_code: 'Zip Code',
  status: 'Status',
  call_outcome: 'Call Outcome',
  last_call_date: 'Last Call Date',
  call_attempts: 'Call Attempts',
  call_duration: 'Call Duration (s)',
  notes: 'Notes',
  tags: 'Tags',
  source: 'Source',
};

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

    const format = request.nextUrl.searchParams.get('format') || 'csv';
    const listId = request.nextUrl.searchParams.get('listId');
    const status = request.nextUrl.searchParams.get('status');

    // Fetch ALL contacts (no 1000 limit) using pagination
    let allContacts: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('company_id', userData.company_id)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (listId && listId !== 'all') {
        if (listId === 'none') {
          query = query.is('list_id', null);
        } else {
          query = query.eq('list_id', listId);
        }
      }
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data: contacts, error } = await query;
      if (error) throw error;

      if (contacts && contacts.length > 0) {
        allContacts = allContacts.concat(contacts);
        hasMore = contacts.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    const today = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const jsonData = allContacts.map(c => {
        const row: Record<string, unknown> = {};
        for (const field of EXPORT_FIELDS) {
          row[HEADER_LABELS[field] || field] = field === 'tags' ? (c[field] || []).join(', ') : (c[field] ?? '');
        }
        return row;
      });

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="contacts_export_${today}.json"`,
        },
      });
    }

    if (format === 'xlsx') {
      // Generate a simple XML spreadsheet (Excel compatible) without external dependencies
      const escapeXml = (val: string) => val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      let xml = '<?xml version="1.0"?>\n';
      xml += '<?mso-application progid="Excel.Sheet"?>\n';
      xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
      xml += '<Worksheet ss:Name="Contacts">\n<Table>\n';

      // Header row
      xml += '<Row>\n';
      for (const field of EXPORT_FIELDS) {
        xml += `<Cell><Data ss:Type="String">${escapeXml(HEADER_LABELS[field] || field)}</Data></Cell>\n`;
      }
      xml += '</Row>\n';

      // Data rows
      for (const c of allContacts) {
        xml += '<Row>\n';
        for (const field of EXPORT_FIELDS) {
          const val = field === 'tags' ? (c[field] || []).join(', ') : String(c[field] ?? '');
          const type = (field === 'call_attempts' || field === 'call_duration') ? 'Number' : 'String';
          xml += `<Cell><Data ss:Type="${type}">${escapeXml(val)}</Data></Cell>\n`;
        }
        xml += '</Row>\n';
      }

      xml += '</Table>\n</Worksheet>\n</Workbook>';

      return new NextResponse(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
          'Content-Disposition': `attachment; filename="contacts_export_${today}.xls"`,
        },
      });
    }

    // Default: CSV
    const csvContent = contactsToCSV((allContacts || []) as Contact[]);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="contacts_export_${today}.csv"`,
      },
    });

  } catch (error) {
    console.error('Error exporting contacts:', error);
    return NextResponse.json(
      { error: 'Failed to export contacts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

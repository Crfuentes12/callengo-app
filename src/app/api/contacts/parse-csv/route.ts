// app/api/contacts/parse-csv/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, detectColumnMapping } from '@/lib/call-agent-utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    if (!text.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    const { headers, rows } = parseCSV(text);

    if (headers.length === 0) {
      return NextResponse.json({ error: 'Could not parse CSV headers' }, { status: 400 });
    }

    const suggestedMapping = detectColumnMapping(headers);
    const preview = rows.slice(0, 5);

    return NextResponse.json({
      headers,
      rows,
      rowCount: rows.length,
      preview,
      suggestedMapping,
    });

  } catch (error) {
    console.error('Error parsing CSV:', error);
    return NextResponse.json(
      { error: 'Failed to parse CSV file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
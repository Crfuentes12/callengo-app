// app/api/company/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { scrapeWebsite, generateCompanySummary } from '@/lib/web-scraper';

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

    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', userData.company_id)
      .single();

    if (!company?.website) {
      return NextResponse.json({ error: 'No website URL configured' }, { status: 400 });
    }

    const scrapedData = await scrapeWebsite(company.website);
    const summary = await generateCompanySummary(scrapedData, company.name);

    // FIXED: Cast scrapedData to Json type
    await supabase
      .from('companies')
      .update({
        context_data: scrapedData as any, // Cast to any to satisfy Json type
        context_summary: summary,
        favicon_url: scrapedData.faviconUrl,
        description: company.description || scrapedData.description,
        context_extracted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userData.company_id);

    return NextResponse.json({
      status: 'success',
      summary,
      favicon_url: scrapedData.faviconUrl,
      data: {
        title: scrapedData.title,
        description: scrapedData.description,
        headings: scrapedData.headings.slice(0, 5),
      }
    });
  } catch (error) {
    console.error('Error scraping website:', error);
    return NextResponse.json(
      { error: 'Failed to scrape website', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
// app/api/company/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { scrapeWebsite, generateCompanySummary, detectIndustry, detectCompanyName } from '@/lib/web-scraper';
import { expensiveLimiter } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit
    const rl = await expensiveLimiter.check(3, `company_scrape_${user.id}`);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { website: bodyWebsite, auto_save = false } = body;

    // Always derive company_id from the authenticated user's record — never trust the body
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
    }
    const companyId = userData.company_id;
    let websiteUrl = bodyWebsite;

    // Get company details
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Use website from body if provided, otherwise from company record
    websiteUrl = websiteUrl || company.website;

    if (!websiteUrl) {
      return NextResponse.json({ error: 'No website URL configured' }, { status: 400 });
    }

    const scrapedData = await scrapeWebsite(websiteUrl);

    // Detect company name, industry, and generate summary in parallel
    const [detectedName, industry] = await Promise.all([
      detectCompanyName(scrapedData),
      detectIndustry(scrapedData)
    ]);

    // Generate summary using the detected name (not the old saved name)
    const summary = await generateCompanySummary(scrapedData, detectedName);

    // Only auto-save for onboarding flow (when auto_save is true)
    if (auto_save) {
      await supabase
        .from('companies')
        .update({
          name: detectedName, // Update company name with detected name
          context_data: scrapedData as unknown as import('@/types/supabase').Json,
          context_summary: summary,
          favicon_url: scrapedData.faviconUrl,
          description: company.description || scrapedData.description,
          industry: company.industry || industry,
          context_extracted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyId);
    }

    return NextResponse.json({
      status: 'success',
      name: detectedName, // Return detected company name
      summary,
      industry,
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
      { error: 'Failed to scrape website' },
      { status: 500 }
    );
  }
}
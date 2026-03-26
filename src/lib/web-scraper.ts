// lib/web-scraper.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import dns from 'dns/promises';
import { isIP } from 'net';
import { trackOpenAIUsage, getDefaultModel } from '@/lib/openai/tracker';

interface ScrapedData {
  title: string;
  description: string;
  textContent: string;
  headings: string[];
  links: string[];
  images: string[];
  faviconUrl: string | null;
  metaTags: Record<string, string>;
}

// SSRF Protection: Block internal/private IP ranges
const BLOCKED_IP_RANGES = [
  /^127\./,                                        // Loopback
  /^10\./,                                         // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[01])\./,                // Private Class B
  /^192\.168\./,                                   // Private Class C
  /^169\.254\./,                                   // Link-local / AWS metadata
  /^0\./,                                          // Current network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,    // Carrier-grade NAT
  /^::1$/,                                         // IPv6 loopback
  /^fd/,                                           // IPv6 private
  /^fe80:/,                                        // IPv6 link-local
  /^fc/,                                           // IPv6 unique local
];

function isBlockedIP(ip: string): boolean {
  return BLOCKED_IP_RANGES.some(range => range.test(ip));
}

async function validateUrlForSSRF(urlString: string): Promise<void> {
  const parsed = new URL(urlString);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS protocols are allowed');
  }

  const hostname = parsed.hostname;
  if (isIP(hostname)) {
    if (isBlockedIP(hostname)) {
      throw new Error('Access to internal network addresses is not allowed');
    }
  } else {
    try {
      const addresses = await dns.resolve4(hostname);
      for (const addr of addresses) {
        if (isBlockedIP(addr)) {
          throw new Error('URL resolves to a blocked internal IP address');
        }
      }
    } catch (err) {
      if ((err as Error).message.includes('blocked')) throw err;
      // DNS resolution failed — allow the request to proceed and let axios handle network errors
    }
  }
}

export async function scrapeWebsite(url: string): Promise<ScrapedData> {
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    // Validate URL against SSRF attacks
    await validateUrlForSSRF(normalizedUrl);

    const response = await axios.get(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
      maxRedirects: 3,
    });

    const $ = cheerio.load(response.data);

    $('script, style, nav, footer, iframe').remove();

    const title = $('title').text().trim() || 
                  $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text().trim() || 
                  'Unknown';

    const description = $('meta[name="description"]').attr('content') ||
                       $('meta[property="og:description"]').attr('content') ||
                       $('p').first().text().trim().substring(0, 300) ||
                       '';

    let faviconUrl: string | null = null;
    const faviconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
    ];
    for (const selector of faviconSelectors) {
      const href = $(selector).attr('href');
      if (href) {
        faviconUrl = href.startsWith('http') ? href : new URL(href, normalizedUrl).href;
        break;
      }
    }
    if (!faviconUrl) {
      faviconUrl = new URL('/favicon.ico', normalizedUrl).href;
    }

    const textContent = $('body').text().replace(/\s+/g, ' ').trim();

    const headings: string[] = [];
    $('h1, h2, h3').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text && text.length < 200) {
        headings.push(text);
      }
    });

    const links: string[] = [];
    $('a[href]').each((_, elem) => {
      const href = $(elem).attr('href');
      const text = $(elem).text().trim();
      if (href && text && text.length < 100) {
        links.push(`${text}: ${href}`);
      }
    });

    const images: string[] = [];
    $('img[alt]').each((_, elem) => {
      const alt = $(elem).attr('alt');
      const src = $(elem).attr('src');
      if (alt && src) {
        images.push(`${alt}: ${src}`);
      }
    });

    const metaTags: Record<string, string> = {};
    $('meta').each((_, elem) => {
      const name = $(elem).attr('name') || $(elem).attr('property');
      const content = $(elem).attr('content');
      if (name && content) {
        metaTags[name] = content;
      }
    });

    return {
      title,
      description,
      textContent: textContent.substring(0, 10000),
      headings: headings.slice(0, 20),
      links: links.slice(0, 30),
      images: images.slice(0, 10),
      faviconUrl,
      metaTags,
    };

  } catch (error) {
    console.error('Error scraping website:', error);
    throw new Error(`Failed to scrape website: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function detectCompanyName(scrapedData: ScrapedData): Promise<string> {
  const apiKey =
    process.env.OPENAI_API_KEY_CONTACT_ANALYSIS || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // Fallback: try to extract from title by removing common suffixes
    return scrapedData.title
      .replace(/\s*[-–|]\s*.*/g, '') // Remove everything after - or |
      .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses
      .trim();
  }

  try {
    const prompt = `Based on the following website data, identify the company name.
Return ONLY the company name (2-5 words maximum), nothing else.

Title: ${scrapedData.title}
Description: ${scrapedData.description}
Headings: ${scrapedData.headings.slice(0, 5).join(', ')}
Meta tags: ${JSON.stringify(scrapedData.metaTags)}

Examples of good responses: "Acme Corporation", "TechFlow", "Blue Ocean Ventures", "Smith & Associates"`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getDefaultModel(),
        messages: [
          { role: 'system', content: 'You are an expert at identifying company names from website data. Return only the company name, nothing else.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 30,
      }),
    });

    const data = await response.json();
    const companyName = data.choices[0]?.message?.content?.trim() || '';

    trackOpenAIUsage({
      featureKey: 'onboarding',
      model: 'gpt-4o-mini',
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      companyId: null,
      userId: null,
      metadata: { function: 'detectCompanyName' },
    });

    // Clean up the response (remove quotes, periods, etc.)
    return companyName.replace(/['"\.]/g, '').trim() || scrapedData.title.split(/[-–|]/)[0].trim();

  } catch (error) {
    console.error('Error detecting company name:', error);
    return scrapedData.title.split(/[-–|]/)[0].trim();
  }
}

export async function generateCompanySummary(scrapedData: ScrapedData, companyName: string): Promise<string> {
  const apiKey =
    process.env.OPENAI_API_KEY_CONTACT_ANALYSIS || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return `${companyName} - ${scrapedData.description}`;
  }

  try {
    const prompt = `Based on the following website data, create a concise 2-3 sentence company summary:

Company: ${companyName}
Title: ${scrapedData.title}
Description: ${scrapedData.description}
Headings: ${scrapedData.headings.join(', ')}
Content sample: ${scrapedData.textContent.substring(0, 1000)}

Focus on: what they do, who they serve, and their main value proposition.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getDefaultModel(),
        messages: [
          { role: 'system', content: 'You are a business analyst creating concise company summaries.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 150,
      }),
    });

    const data = await response.json();

    trackOpenAIUsage({
      featureKey: 'onboarding',
      model: 'gpt-4o-mini',
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      companyId: null,
      userId: null,
      metadata: { function: 'generateCompanySummary' },
    });

    return data.choices[0]?.message?.content?.trim() || `${companyName} - ${scrapedData.description}`;

  } catch (error) {
    console.error('Error generating summary:', error);
    return `${companyName} - ${scrapedData.description}`;
  }
}

export async function detectIndustry(scrapedData: ScrapedData): Promise<string> {
  const apiKey =
    process.env.OPENAI_API_KEY_CONTACT_ANALYSIS || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return '';
  }

  try {
    const prompt = `Based on the following website data, identify the industry/sector this company operates in.
Return ONLY the industry name (2-3 words maximum), nothing else.

Title: ${scrapedData.title}
Description: ${scrapedData.description}
Headings: ${scrapedData.headings.slice(0, 10).join(', ')}
Content: ${scrapedData.textContent.substring(0, 500)}

Examples of good responses: "Technology", "Healthcare", "E-commerce", "Financial Services", "Real Estate", "Education", "Marketing & Advertising", "SaaS"`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getDefaultModel(),
        messages: [
          { role: 'system', content: 'You are an industry classification expert. Return only the industry name, 2-3 words maximum.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 20,
      }),
    });

    const data = await response.json();
    const industry = data.choices[0]?.message?.content?.trim() || '';

    trackOpenAIUsage({
      featureKey: 'onboarding',
      model: 'gpt-4o-mini',
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      companyId: null,
      userId: null,
      metadata: { function: 'detectIndustry' },
    });

    // Clean up the response (remove quotes, periods, etc.)
    return industry.replace(/['"\.]/g, '').trim();

  } catch (error) {
    console.error('Error detecting industry:', error);
    return '';
  }
}
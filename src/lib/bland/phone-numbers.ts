/**
 * Bland AI Phone Numbers — Dedicated Number Management
 *
 * Numbers are purchased on the master Bland account and logically assigned
 * to companies via the `company_addons` table in Supabase.
 *
 * Pricing: $15/mo to Bland per number, $25/mo charged to customer.
 * Max 3 numbers per company (for custom rotation).
 *
 * When dispatching calls, the company's dedicated number(s) are passed
 * as the `from` field to Bland's /v1/calls endpoint.
 */

import { supabaseAdminRaw } from '@/lib/supabase/service';

const BLAND_API_URL = 'https://api.bland.ai/v1';
const BLAND_MASTER_KEY = process.env.BLAND_API_KEY!;

/** Max dedicated numbers per company */
export const MAX_DEDICATED_NUMBERS = 3;

/** Monthly cost to customer per number */
export const DEDICATED_NUMBER_PRICE = 25;

/** Monthly cost from Bland per number */
export const DEDICATED_NUMBER_COST = 15;

// ================================================================
// Phone Number Search — Dynamic by area code / state
// ================================================================

export interface PhoneNumberSearchResult {
  phoneNumber: string;
  areaCode: string;
  country: string;
  available: boolean;
}

/**
 * Search available phone numbers by area code.
 * Uses Bland's number purchase endpoint to check availability.
 * NOTE: Bland doesn't have a "search" endpoint — we attempt purchase
 * with dry_run or check by area code availability patterns.
 *
 * For now, we provide area code suggestions and let the user pick.
 */
export async function searchAvailableNumbers(
  areaCode: string,
  countryCode: string = 'US'
): Promise<{ available: boolean; areaCode: string; countryCode: string }> {
  // Bland doesn't expose a search API — we validate the area code format
  // and let the purchase endpoint handle availability
  const validAreaCode = /^\d{3}$/.test(areaCode);
  if (!validAreaCode) {
    return { available: false, areaCode, countryCode };
  }

  const validCountries = ['US', 'CA'];
  if (!validCountries.includes(countryCode)) {
    return { available: false, areaCode, countryCode };
  }

  return { available: true, areaCode, countryCode };
}

/**
 * US area codes by state — for dynamic search UI.
 * Users can search by state and see available area codes.
 */
export const US_AREA_CODES_BY_STATE: Record<string, string[]> = {
  'Alabama': ['205', '251', '256', '334', '659', '938'],
  'Alaska': ['907'],
  'Arizona': ['480', '520', '602', '623', '928'],
  'Arkansas': ['479', '501', '870'],
  'California': ['209', '213', '310', '323', '408', '415', '424', '510', '530', '559', '562', '619', '626', '650', '657', '661', '669', '707', '714', '747', '760', '805', '818', '831', '858', '909', '916', '925', '949', '951'],
  'Colorado': ['303', '719', '720', '970'],
  'Connecticut': ['203', '475', '860'],
  'Delaware': ['302'],
  'Florida': ['239', '305', '321', '352', '386', '407', '561', '727', '754', '772', '786', '813', '850', '863', '904', '941', '954'],
  'Georgia': ['229', '404', '470', '478', '678', '706', '762', '770', '912'],
  'Hawaii': ['808'],
  'Idaho': ['208'],
  'Illinois': ['217', '224', '309', '312', '331', '618', '630', '708', '773', '779', '815', '847', '872'],
  'Indiana': ['219', '260', '317', '463', '574', '765', '812', '930'],
  'Iowa': ['319', '515', '563', '641', '712'],
  'Kansas': ['316', '620', '785', '913'],
  'Kentucky': ['270', '364', '502', '606', '859'],
  'Louisiana': ['225', '318', '337', '504', '985'],
  'Maine': ['207'],
  'Maryland': ['240', '301', '410', '443', '667'],
  'Massachusetts': ['339', '351', '413', '508', '617', '774', '781', '857', '978'],
  'Michigan': ['231', '248', '269', '313', '517', '586', '616', '734', '810', '906', '947', '989'],
  'Minnesota': ['218', '320', '507', '612', '651', '763', '952'],
  'Mississippi': ['228', '601', '662', '769'],
  'Missouri': ['314', '417', '573', '636', '660', '816'],
  'Montana': ['406'],
  'Nebraska': ['308', '402', '531'],
  'Nevada': ['702', '725', '775'],
  'New Hampshire': ['603'],
  'New Jersey': ['201', '551', '609', '732', '848', '856', '862', '908', '973'],
  'New Mexico': ['505', '575'],
  'New York': ['212', '315', '347', '516', '518', '585', '607', '631', '646', '716', '718', '845', '914', '917', '929'],
  'North Carolina': ['252', '336', '704', '743', '828', '910', '919', '980', '984'],
  'North Dakota': ['701'],
  'Ohio': ['216', '220', '234', '283', '330', '380', '419', '440', '513', '567', '614', '740', '937'],
  'Oklahoma': ['405', '539', '580', '918'],
  'Oregon': ['458', '503', '541', '971'],
  'Pennsylvania': ['215', '267', '272', '412', '484', '570', '610', '717', '724', '814', '878'],
  'Rhode Island': ['401'],
  'South Carolina': ['803', '843', '854', '864'],
  'South Dakota': ['605'],
  'Tennessee': ['423', '615', '629', '731', '865', '901', '931'],
  'Texas': ['210', '214', '254', '281', '325', '346', '361', '409', '430', '432', '469', '512', '682', '713', '726', '737', '806', '817', '830', '832', '903', '915', '936', '940', '956', '972', '979'],
  'Utah': ['385', '435', '801'],
  'Vermont': ['802'],
  'Virginia': ['276', '434', '540', '571', '703', '757', '804'],
  'Washington': ['206', '253', '360', '425', '509', '564'],
  'West Virginia': ['304', '681'],
  'Wisconsin': ['262', '414', '534', '608', '715', '920'],
  'Wyoming': ['307'],
};

// Canadian area codes
export const CA_AREA_CODES_BY_PROVINCE: Record<string, string[]> = {
  'Ontario': ['226', '249', '289', '343', '365', '416', '437', '519', '548', '613', '647', '705', '807', '905'],
  'Quebec': ['418', '438', '450', '514', '579', '581', '819', '873'],
  'British Columbia': ['236', '250', '604', '672', '778'],
  'Alberta': ['368', '403', '587', '780', '825'],
  'Manitoba': ['204', '431'],
  'Saskatchewan': ['306', '639'],
  'Nova Scotia': ['782', '902'],
  'New Brunswick': ['506'],
  'Newfoundland': ['709'],
  'Prince Edward Island': ['902'],
};

// ================================================================
// Phone Number Purchase — via Bland API
// ================================================================

export interface PurchaseNumberResult {
  success: boolean;
  phoneNumber?: string;
  blandNumberId?: string;
  error?: string;
}

/**
 * Purchase a phone number from Bland AI on the master account.
 * POST /numbers/purchase
 *
 * @param areaCode - 3-digit area code (e.g., "415")
 * @param countryCode - "US" or "CA"
 * @param exactNumber - Optional exact number to purchase (e.g., "+12223334444")
 */
export async function purchaseNumber(
  areaCode: string,
  countryCode: string = 'US',
  exactNumber?: string
): Promise<PurchaseNumberResult> {
  if (!BLAND_MASTER_KEY) {
    return { success: false, error: 'BLAND_API_KEY not configured' };
  }

  try {
    const body: Record<string, string> = {
      area_code: areaCode,
      country_code: countryCode,
    };

    if (exactNumber) {
      body.phone_number = exactNumber;
    }

    const response = await fetch(`${BLAND_API_URL.replace('/v1', '')}/numbers/purchase`, {
      method: 'POST',
      headers: {
        'Authorization': BLAND_MASTER_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || `Failed to purchase number (HTTP ${response.status})`,
      };
    }

    // Bland returns the purchased number details
    const phoneNumber = data.phone_number || data.number || exactNumber;
    const numberId = data.id || data.number_id || data.phone_number_id;

    if (!phoneNumber) {
      return { success: false, error: 'Bland returned no phone number in response' };
    }

    return {
      success: true,
      phoneNumber,
      blandNumberId: numberId || phoneNumber,
    };
  } catch (error) {
    console.error('[bland/phone-numbers] Purchase error:', error);
    return { success: false, error: 'Failed to connect to Bland phone numbers API' };
  }
}

// ================================================================
// Company Number Management — Supabase CRUD
// ================================================================

export interface CompanyDedicatedNumber {
  id: string;
  companyId: string;
  phoneNumber: string;
  blandNumberId: string;
  areaCode: string;
  label: string | null;
  isPrimary: boolean;
  status: string;
  createdAt: string;
}

/**
 * Get all dedicated numbers for a company.
 */
export async function getCompanyNumbers(companyId: string): Promise<CompanyDedicatedNumber[]> {
  const { data } = await supabaseAdminRaw
    .from('company_addons')
    .select('*')
    .eq('company_id', companyId)
    .eq('addon_type', 'dedicated_number')
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((addon, index) => ({
    id: addon.id,
    companyId: addon.company_id,
    phoneNumber: addon.dedicated_phone_number || '',
    blandNumberId: addon.bland_number_id || '',
    areaCode: (addon.dedicated_phone_number || '').replace(/^\+1/, '').substring(0, 3),
    label: addon.number_label || null,
    isPrimary: index === 0,
    status: addon.status,
    createdAt: addon.created_at,
  }));
}

/**
 * Get the primary dedicated number for a company (for outbound calls).
 * If the company has multiple numbers, returns the first (primary).
 * If no dedicated numbers, returns null (will use Bland's auto-rotation).
 */
export async function getCompanyCallerNumber(companyId: string): Promise<string | null> {
  const numbers = await getCompanyNumbers(companyId);
  if (numbers.length === 0) return null;

  // If multiple numbers, rotate based on a simple hash of the current timestamp
  // This provides basic rotation among the company's own numbers
  if (numbers.length > 1) {
    const index = Math.floor(Date.now() / 1000) % numbers.length;
    return numbers[index].phoneNumber;
  }

  return numbers[0].phoneNumber;
}

/**
 * Check how many dedicated numbers a company currently has.
 */
export async function getCompanyNumberCount(companyId: string): Promise<number> {
  const { count } = await supabaseAdminRaw
    .from('company_addons')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('addon_type', 'dedicated_number')
    .eq('status', 'active');

  return count || 0;
}

/**
 * Assign a purchased number to a company.
 * Called after Stripe confirms payment for the dedicated number addon.
 */
export async function assignNumberToCompany(
  companyId: string,
  phoneNumber: string,
  blandNumberId: string,
  stripeSubscriptionId?: string,
  label?: string
): Promise<{ success: boolean; addonId?: string; error?: string }> {
  // Check limit
  const currentCount = await getCompanyNumberCount(companyId);
  if (currentCount >= MAX_DEDICATED_NUMBERS) {
    return {
      success: false,
      error: `Maximum ${MAX_DEDICATED_NUMBERS} dedicated numbers allowed per company`,
    };
  }

  // Check for duplicate
  const { data: existing } = await supabaseAdminRaw
    .from('company_addons')
    .select('id')
    .eq('company_id', companyId)
    .eq('dedicated_phone_number', phoneNumber)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    return { success: false, error: 'This number is already assigned to your company' };
  }

  const { data: addon, error } = await supabaseAdminRaw
    .from('company_addons')
    .insert({
      company_id: companyId,
      addon_type: 'dedicated_number',
      dedicated_phone_number: phoneNumber,
      bland_number_id: blandNumberId,
      status: 'active',
      quantity: 1,
      stripe_subscription_id: stripeSubscriptionId || null,
      ...(label ? { number_label: label } : {}),
    } as Record<string, unknown>)
    .select('id')
    .single();

  if (error) {
    console.error('[bland/phone-numbers] assignNumberToCompany error:', error);
    return { success: false, error: 'Failed to assign number' };
  }

  // Update the addon flag on company_subscriptions
  await supabaseAdminRaw
    .from('company_subscriptions')
    .update({ addon_dedicated_number: true } as Record<string, unknown>)
    .eq('company_id', companyId);

  return { success: true, addonId: (addon as Record<string, unknown>)?.id as string };
}

/**
 * Release a dedicated number from a company.
 * Note: Does NOT release the number from Bland — it stays on the master account
 * and can be reassigned to another company later.
 */
export async function releaseNumberFromCompany(
  companyId: string,
  addonId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdminRaw
    .from('company_addons')
    .update({ status: 'canceled' })
    .eq('id', addonId)
    .eq('company_id', companyId)
    .eq('addon_type', 'dedicated_number');

  if (error) {
    return { success: false, error: 'Failed to release number' };
  }

  // Check if company still has active numbers
  const remaining = await getCompanyNumberCount(companyId);
  if (remaining === 0) {
    await supabaseAdminRaw
      .from('company_subscriptions')
      .update({ addon_dedicated_number: false } as Record<string, unknown>)
      .eq('company_id', companyId);
  }

  return { success: true };
}

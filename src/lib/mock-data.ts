// lib/mock-data.ts
// Comprehensive mock data for demo/testing purposes
// Only used for seeding data for crfuentes12@gmail.com

function uuidv4(): string {
  return crypto.randomUUID();
}

const DEMO_EMAIL = 'crfuentes12@gmail.com';

// Helper to generate dates relative to now
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function hoursAgo(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ─── CONTACT LISTS ───────────────────────────────────────────────

export function generateContactLists(companyId: string) {
  return [
    {
      id: uuidv4(),
      company_id: companyId,
      name: 'Tech Startups',
      description: 'Technology startups and SaaS companies for lead qualification',
      color: '#6366f1',
      created_at: daysAgo(30),
      updated_at: daysAgo(30),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      name: 'Healthcare Clinics',
      description: 'Medical clinics and healthcare providers for appointment confirmations',
      color: '#10b981',
      created_at: daysAgo(28),
      updated_at: daysAgo(28),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      name: 'Real Estate Agencies',
      description: 'Real estate brokers and agencies for data validation',
      color: '#f59e0b',
      created_at: daysAgo(25),
      updated_at: daysAgo(25),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      name: 'E-commerce Stores',
      description: 'Online retailers and e-commerce businesses',
      color: '#ef4444',
      created_at: daysAgo(20),
      updated_at: daysAgo(20),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      name: 'Financial Services',
      description: 'Banks, insurance companies and financial advisors',
      color: '#8b5cf6',
      created_at: daysAgo(15),
      updated_at: daysAgo(15),
    },
  ];
}

// ─── CONTACTS (50 contacts) ─────────────────────────────────────

const CONTACT_STATUSES = ['Pending', 'Verified', 'Calling', 'No Answer', 'Voicemail Left', 'For Callback', 'Completed', 'Failed'];
const CALL_OUTCOMES = ['Interested', 'Not Interested', 'Callback Requested', 'Wrong Number', 'Voicemail', 'Information Updated', 'Appointment Confirmed', 'Appointment Rescheduled', 'Qualified Lead', 'Unqualified', null];

interface ContactData {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  callOutcome: string | null;
  callAttempts: number;
  tags: string[];
  notes: string | null;
  listIndex: number; // index into the lists array
}

const CONTACTS_RAW: ContactData[] = [
  // ── Tech Startups (listIndex: 0) ──
  { companyName: 'NovaTech Solutions', contactName: 'James Mitchell', phone: '+14155551001', email: 'james@novatech.io', address: '100 Market St', city: 'San Francisco', state: 'CA', zip: '94105', status: 'Verified', callOutcome: 'Qualified Lead', callAttempts: 2, tags: ['hot-lead', 'saas'], notes: 'Very interested in our platform. Decision maker. Budget approved for Q1.', listIndex: 0 },
  { companyName: 'CloudSync Inc', contactName: 'Sarah Chen', phone: '+14155551002', email: 'sarah@cloudsync.com', address: '200 Pine St', city: 'San Francisco', state: 'CA', zip: '94104', status: 'Completed', callOutcome: 'Interested', callAttempts: 1, tags: ['enterprise', 'cloud'], notes: 'Wants a demo next week. Has a team of 50 agents.', listIndex: 0 },
  { companyName: 'DataFlow Labs', contactName: 'Michael Brown', phone: '+12125551003', email: 'michael@dataflow.dev', address: '350 5th Ave', city: 'New York', state: 'NY', zip: '10118', status: 'Verified', callOutcome: 'Information Updated', callAttempts: 1, tags: ['analytics', 'data'], notes: 'Updated email from old domain. Still active customer.', listIndex: 0 },
  { companyName: 'Pixel AI', contactName: 'Emily Rodriguez', phone: '+13105551004', email: 'emily@pixelai.co', address: '500 Wilshire Blvd', city: 'Los Angeles', state: 'CA', zip: '90036', status: 'For Callback', callOutcome: 'Callback Requested', callAttempts: 1, tags: ['ai', 'startup'], notes: 'In a meeting. Asked to call back Thursday at 2pm.', listIndex: 0 },
  { companyName: 'Swift Commerce', contactName: 'David Kim', phone: '+12065551005', email: 'david@swiftcommerce.io', address: '800 Pike St', city: 'Seattle', state: 'WA', zip: '98101', status: 'Completed', callOutcome: 'Not Interested', callAttempts: 2, tags: ['ecommerce'], notes: 'Already using a competitor. Not switching this year.', listIndex: 0 },
  { companyName: 'GreenCode Software', contactName: 'Lisa Park', phone: '+15125551006', email: 'lisa@greencode.dev', address: '600 Congress Ave', city: 'Austin', state: 'TX', zip: '78701', status: 'Verified', callOutcome: 'Qualified Lead', callAttempts: 1, tags: ['hot-lead', 'devtools'], notes: 'CTO. Looking for automation solutions. Budget $5k/mo.', listIndex: 0 },
  { companyName: 'Quantum Dynamics', contactName: 'Robert Turner', phone: '+17185551007', email: 'robert@quantumdyn.com', address: '1 World Trade Center', city: 'New York', state: 'NY', zip: '10007', status: 'Pending', callOutcome: null, callAttempts: 0, tags: ['enterprise'], notes: null, listIndex: 0 },
  { companyName: 'Nebula Systems', contactName: 'Amanda Foster', phone: '+16175551008', email: 'amanda@nebulasys.io', address: '100 Summer St', city: 'Boston', state: 'MA', zip: '02110', status: 'Calling', callOutcome: null, callAttempts: 1, tags: ['saas', 'mid-market'], notes: 'Currently being called by Data Validation Agent.', listIndex: 0 },
  { companyName: 'CodeVault', contactName: 'Chris Anderson', phone: '+13035551009', email: 'chris@codevault.io', address: '1600 California St', city: 'Denver', state: 'CO', zip: '80202', status: 'No Answer', callOutcome: null, callAttempts: 3, tags: ['security'], notes: 'Three attempts, no answer. Moving to follow-up queue.', listIndex: 0 },
  { companyName: 'BrightStack', contactName: 'Jennifer Lee', phone: '+14085551010', email: 'jennifer@brightstack.com', address: '2100 Geng Rd', city: 'Palo Alto', state: 'CA', zip: '94303', status: 'Voicemail Left', callOutcome: 'Voicemail', callAttempts: 2, tags: ['startup'], notes: 'Left voicemail with callback number. Waiting for response.', listIndex: 0 },

  // ── Healthcare Clinics (listIndex: 1) ──
  { companyName: 'MedFirst Clinic', contactName: 'Dr. Patricia Williams', phone: '+13055551011', email: 'pwilliams@medfirst.com', address: '1200 Brickell Ave', city: 'Miami', state: 'FL', zip: '33131', status: 'Completed', callOutcome: 'Appointment Confirmed', callAttempts: 1, tags: ['clinic', 'confirmed'], notes: 'Appointment confirmed for Feb 10 at 10:00 AM.', listIndex: 1 },
  { companyName: 'Sunrise Health Center', contactName: 'Dr. Mark Johnson', phone: '+16025551012', email: 'mjohnson@sunrisehealth.org', address: '3300 N Central Ave', city: 'Phoenix', state: 'AZ', zip: '85012', status: 'Completed', callOutcome: 'Appointment Rescheduled', callAttempts: 1, tags: ['clinic', 'rescheduled'], notes: 'Rescheduled from Feb 8 to Feb 15 at 2:30 PM. Conflict with surgery.', listIndex: 1 },
  { companyName: 'CarePoint Medical', contactName: 'Nancy Martinez', phone: '+17135551013', email: 'nancy@carepoint.med', address: '6550 Fannin St', city: 'Houston', state: 'TX', zip: '77030', status: 'Verified', callOutcome: 'Appointment Confirmed', callAttempts: 1, tags: ['clinic', 'confirmed'], notes: 'Confirmed. Patient reminded to bring insurance card.', listIndex: 1 },
  { companyName: 'Valley Dental Group', contactName: 'Dr. Thomas Wright', phone: '+14805551014', email: 'twright@valleydental.com', address: '4830 E Indian School Rd', city: 'Phoenix', state: 'AZ', zip: '85018', status: 'No Answer', callOutcome: null, callAttempts: 2, tags: ['dental'], notes: 'No answer on two attempts. Will try again tomorrow.', listIndex: 1 },
  { companyName: 'Premier Orthopedics', contactName: 'Dr. Susan Clark', phone: '+17705551015', email: 'sclark@premierortho.com', address: '5670 Peachtree Dunwoody Rd', city: 'Atlanta', state: 'GA', zip: '30342', status: 'Completed', callOutcome: 'Appointment Confirmed', callAttempts: 1, tags: ['specialist', 'confirmed'], notes: 'Confirmed appointment for Feb 12. Pre-op clearance obtained.', listIndex: 1 },
  { companyName: 'Wellness Family Practice', contactName: 'Karen Thompson', phone: '+12145551016', email: 'karen@wellnessfp.com', address: '8200 Walnut Hill Ln', city: 'Dallas', state: 'TX', zip: '75231', status: 'For Callback', callOutcome: 'Callback Requested', callAttempts: 1, tags: ['family-practice'], notes: 'Patient checking with spouse about the date. Will call back.', listIndex: 1 },
  { companyName: 'Bright Eyes Vision', contactName: 'Dr. Alan Rivera', phone: '+13125551017', email: 'arivera@brighteyes.vision', address: '150 N Michigan Ave', city: 'Chicago', state: 'IL', zip: '60601', status: 'Voicemail Left', callOutcome: 'Voicemail', callAttempts: 1, tags: ['optometry'], notes: 'Left voicemail about upcoming eye exam appointment.', listIndex: 1 },
  { companyName: 'Pacific Dermatology', contactName: 'Dr. Michelle Yang', phone: '+18585551018', email: 'myang@pacificderm.com', address: '9850 Genesee Ave', city: 'San Diego', state: 'CA', zip: '92121', status: 'Completed', callOutcome: 'Not Interested', callAttempts: 1, tags: ['dermatology'], notes: 'Patient canceled appointment. No longer interested in procedure.', listIndex: 1 },
  { companyName: 'Summit Pediatrics', contactName: 'Dr. Brian Hayes', phone: '+15035551019', email: 'bhayes@summitpeds.com', address: '501 N Graham St', city: 'Portland', state: 'OR', zip: '97227', status: 'Pending', callOutcome: null, callAttempts: 0, tags: ['pediatrics'], notes: null, listIndex: 1 },
  { companyName: 'Lakeside Cardiology', contactName: 'Dr. Diana Ross', phone: '+12165551020', email: 'dross@lakesidecardio.com', address: '9500 Euclid Ave', city: 'Cleveland', state: 'OH', zip: '44106', status: 'Completed', callOutcome: 'Appointment Confirmed', callAttempts: 1, tags: ['cardiology', 'confirmed'], notes: 'Stress test confirmed for Feb 14. Fasting instructions given.', listIndex: 1 },

  // ── Real Estate Agencies (listIndex: 2) ──
  { companyName: 'Pinnacle Realty', contactName: 'Steven Adams', phone: '+17025551021', email: 'steven@pinnaclerealty.com', address: '3900 Paradise Rd', city: 'Las Vegas', state: 'NV', zip: '89169', status: 'Verified', callOutcome: 'Information Updated', callAttempts: 1, tags: ['real-estate', 'verified'], notes: 'Updated new office phone and email. Old email was bouncing.', listIndex: 2 },
  { companyName: 'HomeKey Properties', contactName: 'Rachel Green', phone: '+19545551022', email: 'rachel@homekeyprops.com', address: '110 E Broward Blvd', city: 'Fort Lauderdale', state: 'FL', zip: '33301', status: 'Completed', callOutcome: 'Information Updated', callAttempts: 1, tags: ['real-estate', 'updated'], notes: 'Confirmed address. Updated agent license number in records.', listIndex: 2 },
  { companyName: 'Metro Living Realtors', contactName: 'Kevin Walsh', phone: '+12025551023', email: 'kevin@metroliving.com', address: '1400 K St NW', city: 'Washington', state: 'DC', zip: '20005', status: 'Failed', callOutcome: 'Wrong Number', callAttempts: 1, tags: ['wrong-number'], notes: 'Number belongs to a different person. Marked for removal.', listIndex: 2 },
  { companyName: 'Coastal Homes Group', contactName: 'Melissa Turner', phone: '+18435551024', email: 'melissa@coastalhomes.net', address: '375 Meeting St', city: 'Charleston', state: 'SC', zip: '29403', status: 'Verified', callOutcome: 'Information Updated', callAttempts: 2, tags: ['real-estate', 'coastal'], notes: 'Second call successful. Verified all contact details. New website URL noted.', listIndex: 2 },
  { companyName: 'Urban Nest Realty', contactName: 'Jason Miller', phone: '+15125551025', email: 'jason@urbannest.io', address: '301 Congress Ave', city: 'Austin', state: 'TX', zip: '78701', status: 'No Answer', callOutcome: null, callAttempts: 3, tags: ['real-estate'], notes: 'No answer after 3 attempts. Number seems valid but no pickup.', listIndex: 2 },
  { companyName: 'Golden Gate Properties', contactName: 'Laura Bennett', phone: '+14155551026', email: 'laura@goldengateprop.com', address: '580 California St', city: 'San Francisco', state: 'CA', zip: '94104', status: 'Completed', callOutcome: 'Information Updated', callAttempts: 1, tags: ['luxury', 'verified'], notes: 'All info current. Added new assistant contact number.', listIndex: 2 },
  { companyName: 'Heartland Homes', contactName: 'Gary Peterson', phone: '+18165551027', email: 'gary@heartlandhomes.com', address: '1100 Main St', city: 'Kansas City', state: 'MO', zip: '64105', status: 'Voicemail Left', callOutcome: 'Voicemail', callAttempts: 2, tags: ['midwest'], notes: 'Left voicemail twice. Requesting data verification callback.', listIndex: 2 },
  { companyName: 'Summit Realty Partners', contactName: 'Angela Davis', phone: '+13035551028', email: 'angela@summitrealty.co', address: '1801 California St', city: 'Denver', state: 'CO', zip: '80202', status: 'Pending', callOutcome: null, callAttempts: 0, tags: ['real-estate'], notes: null, listIndex: 2 },
  { companyName: 'Bayview Estates', contactName: 'Patrick O\'Brien', phone: '+18585551029', email: 'patrick@bayviewestates.com', address: '4225 Executive Square', city: 'San Diego', state: 'CA', zip: '92037', status: 'For Callback', callOutcome: 'Callback Requested', callAttempts: 1, tags: ['luxury'], notes: 'In a showing. Asked to call back after 4pm today.', listIndex: 2 },
  { companyName: 'Heritage Real Estate', contactName: 'Samantha Cole', phone: '+16155551030', email: 'samantha@heritagere.com', address: '150 4th Ave N', city: 'Nashville', state: 'TN', zip: '37219', status: 'Completed', callOutcome: 'Information Updated', callAttempts: 1, tags: ['verified', 'updated'], notes: 'Updated address after office relocation. All other data confirmed.', listIndex: 2 },

  // ── E-commerce Stores (listIndex: 3) ──
  { companyName: 'TrendMart Online', contactName: 'Jessica Wang', phone: '+12125551031', email: 'jessica@trendmart.shop', address: '110 Greene St', city: 'New York', state: 'NY', zip: '10012', status: 'Verified', callOutcome: 'Qualified Lead', callAttempts: 1, tags: ['ecommerce', 'hot-lead'], notes: 'High volume seller. 10K orders/month. Very interested in AI calling for customer follow-ups.', listIndex: 3 },
  { companyName: 'FreshGoods Co', contactName: 'Daniel Martinez', phone: '+13105551032', email: 'daniel@freshgoods.co', address: '400 S Figueroa St', city: 'Los Angeles', state: 'CA', zip: '90071', status: 'Completed', callOutcome: 'Interested', callAttempts: 1, tags: ['food', 'subscription'], notes: 'Subscription food box company. Wants to use for delivery confirmation calls.', listIndex: 3 },
  { companyName: 'StyleVault', contactName: 'Olivia Hughes', phone: '+17735551033', email: 'olivia@stylevault.com', address: '900 N Michigan Ave', city: 'Chicago', state: 'IL', zip: '60611', status: 'Completed', callOutcome: 'Not Interested', callAttempts: 2, tags: ['fashion'], notes: 'Not interested at this time. May reconsider in Q3.', listIndex: 3 },
  { companyName: 'PetPal Supplies', contactName: 'Nathan Scott', phone: '+14045551034', email: 'nathan@petpalsupplies.com', address: '3500 Lenox Rd NE', city: 'Atlanta', state: 'GA', zip: '30326', status: 'Verified', callOutcome: 'Interested', callAttempts: 1, tags: ['pets', 'warm-lead'], notes: 'Pet supply store. Interested in appointment scheduling for grooming services.', listIndex: 3 },
  { companyName: 'GadgetWorld', contactName: 'Sophia Taylor', phone: '+14695551035', email: 'sophia@gadgetworld.store', address: '7900 N Stemmons Fwy', city: 'Dallas', state: 'TX', zip: '75247', status: 'No Answer', callOutcome: null, callAttempts: 2, tags: ['electronics'], notes: 'No answer on two tries. Business hours are 9-5 CST.', listIndex: 3 },
  { companyName: 'EcoLife Market', contactName: 'Brandon Lewis', phone: '+15035551036', email: 'brandon@ecolifemarket.com', address: '1201 NW Glisan St', city: 'Portland', state: 'OR', zip: '97209', status: 'Completed', callOutcome: 'Qualified Lead', callAttempts: 1, tags: ['eco-friendly', 'hot-lead'], notes: 'Sustainable products marketplace. Wants lead qualification for B2B partnerships.', listIndex: 3 },
  { companyName: 'LuxeHome Decor', contactName: 'Victoria Adams', phone: '+17275551037', email: 'victoria@luxehomedecor.com', address: '200 Central Ave', city: 'St. Petersburg', state: 'FL', zip: '33701', status: 'Calling', callOutcome: null, callAttempts: 1, tags: ['home-decor'], notes: 'Currently in active campaign call.', listIndex: 3 },
  { companyName: 'FitGear Pro', contactName: 'Marcus Johnson', phone: '+16025551038', email: 'marcus@fitgearpro.com', address: '2550 E Camelback Rd', city: 'Phoenix', state: 'AZ', zip: '85016', status: 'Voicemail Left', callOutcome: 'Voicemail', callAttempts: 1, tags: ['fitness'], notes: 'Left voicemail about lead qualification opportunity.', listIndex: 3 },
  { companyName: 'BookNook Online', contactName: 'Catherine Bell', phone: '+16175551039', email: 'catherine@booknook.shop', address: '100 Huntington Ave', city: 'Boston', state: 'MA', zip: '02116', status: 'Pending', callOutcome: null, callAttempts: 0, tags: ['books', 'education'], notes: null, listIndex: 3 },
  { companyName: 'ArtisanCraft Hub', contactName: 'Derek Wilson', phone: '+16465551040', email: 'derek@artisancraft.com', address: '250 W Broadway', city: 'New York', state: 'NY', zip: '10013', status: 'Completed', callOutcome: 'Interested', callAttempts: 1, tags: ['handmade', 'marketplace'], notes: 'Artisan marketplace. Interested in validating vendor contact data.', listIndex: 3 },

  // ── Financial Services (listIndex: 4) ──
  { companyName: 'Apex Financial Advisors', contactName: 'Richard Morgan', phone: '+12035551041', email: 'richard@apexfinancial.com', address: '281 Tresser Blvd', city: 'Stamford', state: 'CT', zip: '06901', status: 'Verified', callOutcome: 'Qualified Lead', callAttempts: 2, tags: ['finance', 'hot-lead'], notes: 'Wealth management firm. 200+ clients. Wants AI calling for quarterly check-ins.', listIndex: 4 },
  { companyName: 'SecureWealth Insurance', contactName: 'Linda Harris', phone: '+19085551042', email: 'linda@securewealth.ins', address: '100 Wood Ave S', city: 'Iselin', state: 'NJ', zip: '08830', status: 'Completed', callOutcome: 'Appointment Confirmed', callAttempts: 1, tags: ['insurance', 'confirmed'], notes: 'Policy review appointment confirmed for Feb 11 at 3pm.', listIndex: 4 },
  { companyName: 'ClearView Accounting', contactName: 'Paul Stewart', phone: '+15085551043', email: 'paul@clearviewcpa.com', address: '1 Beacon St', city: 'Boston', state: 'MA', zip: '02108', status: 'Completed', callOutcome: 'Information Updated', callAttempts: 1, tags: ['accounting', 'verified'], notes: 'Tax season prep. Updated business address and confirmed phone.', listIndex: 4 },
  { companyName: 'TrustBridge Capital', contactName: 'Monica Reynolds', phone: '+14155551044', email: 'monica@trustbridge.cap', address: '555 Mission St', city: 'San Francisco', state: 'CA', zip: '94105', status: 'For Callback', callOutcome: 'Callback Requested', callAttempts: 1, tags: ['venture-capital'], notes: 'Partner at VC firm. In board meeting. Call back tomorrow 10am PST.', listIndex: 4 },
  { companyName: 'Heritage Bank Corp', contactName: 'William Foster', phone: '+12145551045', email: 'wfoster@heritagebank.com', address: '2200 Ross Ave', city: 'Dallas', state: 'TX', zip: '75201', status: 'Failed', callOutcome: 'Wrong Number', callAttempts: 1, tags: ['banking', 'wrong-number'], notes: 'This is a personal number, not business. Need updated business line.', listIndex: 4 },
  { companyName: 'Evergreen Investments', contactName: 'Diana Crawford', phone: '+12065551046', email: 'diana@evergreeninv.com', address: '1201 3rd Ave', city: 'Seattle', state: 'WA', zip: '98101', status: 'Verified', callOutcome: 'Interested', callAttempts: 1, tags: ['investments', 'warm-lead'], notes: 'Interested in lead qualification for their client acquisition pipeline.', listIndex: 4 },
  { companyName: 'Nova Credit Union', contactName: 'George Palmer', phone: '+16145551047', email: 'gpalmer@novacu.org', address: '150 E Gay St', city: 'Columbus', state: 'OH', zip: '43215', status: 'No Answer', callOutcome: null, callAttempts: 2, tags: ['credit-union'], notes: 'Two attempts during business hours. Will try early morning.', listIndex: 4 },
  { companyName: 'Pacific Mortgage Group', contactName: 'Teresa Lopez', phone: '+18085551048', email: 'teresa@pacificmortgage.com', address: '1001 Bishop St', city: 'Honolulu', state: 'HI', zip: '96813', status: 'Completed', callOutcome: 'Appointment Confirmed', callAttempts: 1, tags: ['mortgage', 'confirmed'], notes: 'Loan review meeting confirmed for Feb 13. Documents checklist sent.', listIndex: 4 },
  { companyName: 'Sterling Tax Services', contactName: 'Andrew Campbell', phone: '+17045551049', email: 'andrew@sterlingtax.com', address: '100 N Tryon St', city: 'Charlotte', state: 'NC', zip: '28202', status: 'Completed', callOutcome: 'Information Updated', callAttempts: 1, tags: ['tax', 'verified'], notes: 'Updated business email and secondary contact. All verified.', listIndex: 4 },
  { companyName: 'Meridian Wealth Management', contactName: 'Sharon Blake', phone: '+16025551050', email: 'sharon@meridianwm.com', address: '2398 E Camelback Rd', city: 'Phoenix', state: 'AZ', zip: '85016', status: 'Pending', callOutcome: null, callAttempts: 0, tags: ['wealth-management'], notes: null, listIndex: 4 },
];

export function generateContacts(companyId: string, listIds: string[]) {
  return CONTACTS_RAW.map((c, index) => {
    const hasCall = c.callAttempts > 0;
    const daysOffset = 30 - Math.floor(index * 0.6);
    const lastCallDaysAgo = hasCall ? Math.max(1, daysOffset - 5) : null;

    return {
      id: uuidv4(),
      company_id: companyId,
      company_name: c.companyName,
      phone_number: c.phone,
      original_phone_number: c.phone,
      address: c.address,
      city: c.city,
      state: c.state,
      zip_code: c.zip,
      contact_name: c.contactName,
      email: c.email,
      status: c.status,
      call_outcome: c.callOutcome,
      last_call_date: lastCallDaysAgo !== null ? daysAgo(lastCallDaysAgo) : null,
      call_attempts: c.callAttempts,
      call_id: hasCall ? `call-${uuidv4().slice(0, 8)}` : null,
      call_status: hasCall ? (c.status === 'Calling' ? 'in-progress' : 'completed') : null,
      call_duration: hasCall ? Math.floor(Math.random() * 180) + 30 : null,
      recording_url: null,
      transcript_text: null,
      transcripts: null,
      analysis: null,
      call_metadata: null,
      notes: c.notes,
      is_test_call: false,
      tags: c.tags,
      list_id: listIds[c.listIndex],
      custom_fields: null,
      created_at: daysAgo(daysOffset),
      updated_at: hasCall ? daysAgo(lastCallDaysAgo!) : daysAgo(daysOffset),
    };
  });
}

// ─── COMPANY AGENTS ─────────────────────────────────────────────

export function generateCompanyAgents(companyId: string, templateIds: { dataValidation: string; appointmentConfirmation: string; leadQualification: string }) {
  return [
    {
      id: uuidv4(),
      company_id: companyId,
      agent_template_id: templateIds.dataValidation,
      name: 'Data Validator Pro',
      custom_task: null,
      custom_settings: null,
      is_active: true,
      created_at: daysAgo(28),
      updated_at: daysAgo(28),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      agent_template_id: templateIds.appointmentConfirmation,
      name: 'Appointment Confirmer',
      custom_task: null,
      custom_settings: null,
      is_active: true,
      created_at: daysAgo(25),
      updated_at: daysAgo(25),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      agent_template_id: templateIds.leadQualification,
      name: 'Lead Qualifier Elite',
      custom_task: null,
      custom_settings: null,
      is_active: true,
      created_at: daysAgo(22),
      updated_at: daysAgo(22),
    },
  ];
}

// ─── AGENT RUNS (CAMPAIGNS) ────────────────────────────────────

export function generateAgentRuns(companyId: string, templateIds: { dataValidation: string; appointmentConfirmation: string; leadQualification: string }) {
  return [
    {
      id: uuidv4(),
      company_id: companyId,
      agent_template_id: templateIds.dataValidation,
      name: 'Data Validation - Real Estate Q1',
      status: 'completed',
      total_contacts: 10,
      completed_calls: 9,
      successful_calls: 7,
      failed_calls: 2,
      total_cost: 0,
      settings: { voice: 'nat', maxDuration: 5, intervalMinutes: 2 },
      started_at: daysAgo(20),
      completed_at: daysAgo(19),
      follow_up_enabled: true,
      follow_up_max_attempts: 3,
      follow_up_interval_hours: 24,
      follow_up_conditions: ['no_answer', 'voicemail'],
      voicemail_enabled: true,
      voicemail_detection_enabled: true,
      voicemail_message: 'Hi, this is a quick call to verify your contact information. Please call us back at your convenience.',
      voicemail_action: 'leave_message',
      created_at: daysAgo(21),
      updated_at: daysAgo(19),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      agent_template_id: templateIds.appointmentConfirmation,
      name: 'Appointment Confirmation - Healthcare Jan',
      status: 'completed',
      total_contacts: 10,
      completed_calls: 10,
      successful_calls: 8,
      failed_calls: 2,
      total_cost: 0,
      settings: { voice: 'nat', maxDuration: 3, intervalMinutes: 1 },
      started_at: daysAgo(15),
      completed_at: daysAgo(14),
      follow_up_enabled: true,
      follow_up_max_attempts: 2,
      follow_up_interval_hours: 12,
      follow_up_conditions: ['no_answer'],
      voicemail_enabled: true,
      voicemail_detection_enabled: true,
      voicemail_message: 'Hi, we are calling to confirm your upcoming appointment. Please call us back to confirm.',
      voicemail_action: 'leave_message',
      created_at: daysAgo(16),
      updated_at: daysAgo(14),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      agent_template_id: templateIds.leadQualification,
      name: 'Lead Qualification - Tech Startups',
      status: 'completed',
      total_contacts: 10,
      completed_calls: 8,
      successful_calls: 5,
      failed_calls: 3,
      total_cost: 0,
      settings: { voice: 'nat', maxDuration: 7, intervalMinutes: 3 },
      started_at: daysAgo(12),
      completed_at: daysAgo(11),
      follow_up_enabled: true,
      follow_up_max_attempts: 3,
      follow_up_interval_hours: 48,
      follow_up_conditions: ['no_answer', 'voicemail', 'callback_requested'],
      voicemail_enabled: true,
      voicemail_detection_enabled: true,
      voicemail_message: 'Hi, I was reaching out regarding your interest in our services. Please call us back when you have a moment.',
      voicemail_action: 'leave_message',
      created_at: daysAgo(13),
      updated_at: daysAgo(11),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      agent_template_id: templateIds.dataValidation,
      name: 'Data Validation - E-commerce Feb',
      status: 'running',
      total_contacts: 10,
      completed_calls: 6,
      successful_calls: 4,
      failed_calls: 1,
      total_cost: 0,
      settings: { voice: 'nat', maxDuration: 5, intervalMinutes: 2 },
      started_at: hoursAgo(6),
      completed_at: null,
      follow_up_enabled: true,
      follow_up_max_attempts: 3,
      follow_up_interval_hours: 24,
      follow_up_conditions: ['no_answer', 'voicemail'],
      voicemail_enabled: true,
      voicemail_detection_enabled: true,
      voicemail_message: null,
      voicemail_action: 'leave_message',
      created_at: daysAgo(1),
      updated_at: hoursAgo(1),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      agent_template_id: templateIds.leadQualification,
      name: 'Lead Qualification - Financial Services',
      status: 'running',
      total_contacts: 10,
      completed_calls: 4,
      successful_calls: 3,
      failed_calls: 0,
      total_cost: 0,
      settings: { voice: 'nat', maxDuration: 7, intervalMinutes: 3 },
      started_at: hoursAgo(3),
      completed_at: null,
      follow_up_enabled: true,
      follow_up_max_attempts: 3,
      follow_up_interval_hours: 48,
      follow_up_conditions: ['no_answer', 'voicemail', 'callback_requested'],
      voicemail_enabled: true,
      voicemail_detection_enabled: true,
      voicemail_message: null,
      voicemail_action: 'leave_message',
      created_at: daysAgo(1),
      updated_at: hoursAgo(1),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      agent_template_id: templateIds.appointmentConfirmation,
      name: 'Appointment Confirmation - Healthcare Feb',
      status: 'paused',
      total_contacts: 10,
      completed_calls: 3,
      successful_calls: 3,
      failed_calls: 0,
      total_cost: 0,
      settings: { voice: 'nat', maxDuration: 3, intervalMinutes: 1 },
      started_at: daysAgo(2),
      completed_at: null,
      follow_up_enabled: true,
      follow_up_max_attempts: 2,
      follow_up_interval_hours: 12,
      follow_up_conditions: ['no_answer'],
      voicemail_enabled: true,
      voicemail_detection_enabled: true,
      voicemail_message: null,
      voicemail_action: 'leave_message',
      created_at: daysAgo(3),
      updated_at: daysAgo(1),
    },
  ];
}

// ─── CALL LOGS ──────────────────────────────────────────────────

const SAMPLE_TRANSCRIPTS: { transcript: string; summary: string; analysis: Record<string, unknown> }[] = [
  {
    transcript: 'Agent: Hi James, this is the Lead Qualifier calling from Callengo. I understand you expressed interest in our AI calling platform. Do you have a few minutes?\nJames: Yes, sure. I\'ve been looking at solutions like yours.\nAgent: Great! Can you tell me about your current calling volume and what challenges you\'re facing?\nJames: We have about 500 leads per month and our sales team can only call about 100. We\'re losing opportunities.\nAgent: That\'s a significant gap. What\'s your budget for a solution like this?\nJames: We have around $5,000 per month allocated for tools.\nAgent: And are you the decision maker for this kind of purchase?\nJames: Yes, I\'m the CTO and I handle all tool decisions.\nAgent: Perfect. Based on what you\'ve told me, I think we\'d be a great fit. Our team will reach out to schedule a demo.\nJames: Sounds good, looking forward to it.',
    summary: 'Qualified lead. CTO with budget authority. 500 leads/month, can only handle 100 manually. $5k/month budget approved. Interested in demo.',
    analysis: { qualified: true, budget: '$5,000/month', timeline: 'Immediate', decision_maker: true, pain_point: 'Cannot handle lead volume manually', next_step: 'Schedule demo', score: 9 },
  },
  {
    transcript: 'Agent: Hi Dr. Williams, this is the Appointment Confirmer calling from Callengo. I\'m calling to confirm your appointment scheduled for February 10th at 10:00 AM.\nDr. Williams: Yes, that works for me. I\'ll be there.\nAgent: Wonderful! Just a reminder to bring your insurance card and any recent test results.\nDr. Williams: Got it, thank you for the reminder.\nAgent: You\'re welcome! We\'ll see you on February 10th. Have a great day!',
    summary: 'Appointment confirmed for Feb 10 at 10:00 AM. Patient reminded about insurance card and test results.',
    analysis: { appointment_confirmed: true, date: '2026-02-10', time: '10:00 AM', reminders_given: ['insurance card', 'test results'], patient_sentiment: 'positive' },
  },
  {
    transcript: 'Agent: Hi Steven, this is the Data Validator calling from Callengo. I\'m calling to verify your contact information we have on file. Do you have a moment?\nSteven: Sure, what do you need?\nAgent: We have your email as steven@pinnaclerealty.com - is that still correct?\nSteven: Actually, I changed my email recently. It\'s now steven.adams@pinnaclerealty.com.\nAgent: Got it, updated. And your office phone - is +17025551021 still your main number?\nSteven: Yes, that\'s correct.\nAgent: And your office address is still at 3900 Paradise Rd, Las Vegas?\nSteven: Yes, same location.\nAgent: Everything is updated. Thank you for your time, Steven!\nSteven: No problem, thanks for calling.',
    summary: 'Contact info verified. Email updated from steven@pinnaclerealty.com to steven.adams@pinnaclerealty.com. Phone and address confirmed.',
    analysis: { data_validated: true, updates_made: ['email updated'], fields_confirmed: ['phone', 'address'], data_quality: 'good' },
  },
  {
    transcript: 'Agent: Hi Sarah, this is the Lead Qualifier calling from Callengo. I\'m reaching out about your interest in our AI platform.\nSarah: Oh yes! I\'ve been researching AI calling solutions for weeks.\nAgent: What specific use case are you looking at?\nSarah: We need to onboard new customers faster. We currently spend 2 days per customer on welcome calls.\nAgent: How many new customers do you onboard monthly?\nSarah: About 50 new enterprise clients per month.\nAgent: And what does your team look like for this?\nSarah: We have 10 customer success agents, but they\'re overwhelmed.\nAgent: I see. Would you be interested in a demo to see how we can automate those welcome calls?\nSarah: Absolutely. Can we do it next week?\nAgent: I\'ll have our team reach out to schedule. Thank you, Sarah!',
    summary: 'Interested in automating customer onboarding calls. 50 new enterprise clients/month, 10 CS agents overwhelmed. Wants demo next week.',
    analysis: { qualified: true, use_case: 'customer onboarding', volume: '50 clients/month', team_size: 10, pain_point: 'team overwhelmed with welcome calls', next_step: 'schedule demo next week', score: 8 },
  },
  {
    transcript: 'Agent: Hi Dr. Johnson, this is the Appointment Confirmer calling from Callengo. I\'m calling about your appointment scheduled for February 8th.\nDr. Johnson: Oh, right. Actually, I need to reschedule. I have a surgery that day that just came up.\nAgent: No problem at all. When would work better for you?\nDr. Johnson: How about the following week? February 15th, afternoon if possible.\nAgent: Let me check... February 15th at 2:30 PM works. Shall I book that?\nDr. Johnson: Perfect, that works great.\nAgent: You\'re all set for February 15th at 2:30 PM. We\'ll send you a confirmation email.\nDr. Johnson: Thank you!',
    summary: 'Appointment rescheduled from Feb 8 to Feb 15 at 2:30 PM due to surgery conflict.',
    analysis: { appointment_confirmed: false, rescheduled: true, original_date: '2026-02-08', new_date: '2026-02-15', new_time: '2:30 PM', reason: 'surgery conflict', patient_sentiment: 'positive' },
  },
  {
    transcript: 'Agent: Hi Jessica, this is the Lead Qualifier from Callengo. I\'m calling about your interest in AI-powered calling solutions. Do you have a few minutes?\nJessica: Yes, please! We\'re a growing e-commerce business and need help with customer follow-ups.\nAgent: Tell me about your current process.\nJessica: We do about 10,000 orders a month and we want to call customers who haven\'t reviewed their purchase.\nAgent: That\'s great volume. What\'s your timeline for implementing a solution?\nJessica: We want to start this quarter. We\'ve already budgeted for it.\nAgent: And what range is the budget?\nJessica: Around $3,000 to $8,000 depending on features.\nAgent: Are you the final decision maker?\nJessica: I make the recommendation, but my CEO gives final approval. She\'s very supportive of this initiative.\nAgent: Excellent. I\'ll have our sales team set up a demo with you and your CEO.\nJessica: That would be perfect!',
    summary: 'High-volume e-commerce (10K orders/month). Wants AI calling for post-purchase review follow-ups. Budget $3-8K. Decision with CEO approval needed.',
    analysis: { qualified: true, budget: '$3,000-$8,000', timeline: 'This quarter', decision_maker: false, influencer: true, volume: '10,000 orders/month', use_case: 'post-purchase follow-ups', score: 8 },
  },
  {
    transcript: 'Agent: Hi David, this is the Lead Qualifier from Callengo. I\'m reaching out about your expressed interest in our services.\nDavid: Oh yes, I looked at it but we actually just signed a contract with a competitor last month.\nAgent: I understand. May I ask which solution you went with?\nDavid: We went with CallBot Pro. They offered us a good deal.\nAgent: Fair enough. If things change or your contract comes up for renewal, we\'d love the opportunity to show you what we can do.\nDavid: Sure, our contract is for 12 months. Maybe reach out next year.\nAgent: Will do. Thank you for your time, David!\nDavid: Thanks, bye.',
    summary: 'Not interested. Recently signed 12-month contract with CallBot Pro. May reconsider next year.',
    analysis: { qualified: false, reason: 'competitor signed', competitor: 'CallBot Pro', contract_length: '12 months', follow_up_date: '2027-01', score: 2 },
  },
  {
    transcript: 'Agent: Hi Rachel, this is the Data Validator from Callengo. I\'m calling to verify the contact information we have on file for HomeKey Properties. Do you have a moment?\nRachel: Sure, go ahead.\nAgent: We have your email as rachel@homekeyprops.com. Is that current?\nRachel: Yes, that\'s right.\nAgent: Phone number +19545551022?\nRachel: Correct.\nAgent: Your address at 110 E Broward Blvd, Fort Lauderdale?\nRachel: Yes, same place.\nAgent: And we have your real estate license number as FL-RE-892341. Can you confirm?\nRachel: Actually, let me check... yes, that\'s correct.\nAgent: Everything checks out. Thank you, Rachel!\nRachel: Thank you for being thorough!',
    summary: 'All contact information verified and confirmed. Email, phone, address, and license number all current.',
    analysis: { data_validated: true, updates_made: [], fields_confirmed: ['email', 'phone', 'address', 'license_number'], data_quality: 'excellent' },
  },
  {
    transcript: 'Agent: Hi Richard, this is the Lead Qualifier from Callengo. I understand you\'re interested in AI calling solutions for your financial advisory firm.\nRichard: Yes, very much so. We have over 200 clients and doing quarterly check-in calls is becoming impossible with our small team.\nAgent: How many advisors do you have making these calls?\nRichard: Just 3 advisors, including myself. We spend almost 2 weeks each quarter just on check-in calls.\nAgent: That\'s a lot of time. What would the ideal solution look like for you?\nRichard: An AI that can make the initial check-in, ask about any changes in financial goals, and flag anyone who needs a personal call from us.\nAgent: That\'s exactly what we do. What\'s your budget for this?\nRichard: We\'re looking at $2,000-$5,000 per month. If it saves us 2 weeks of work, it pays for itself.\nAgent: Absolutely. Are you the decision maker?\nRichard: Yes, I\'m the managing partner.\nAgent: I\'ll have our team set up a personalized demo. This is a great fit.\nRichard: Looking forward to it!',
    summary: 'Wealth management firm with 200+ clients. 3 advisors spending 2 weeks/quarter on check-ins. Budget $2-5K/month. Managing partner, decision maker. Excellent fit.',
    analysis: { qualified: true, budget: '$2,000-$5,000/month', timeline: 'Immediate', decision_maker: true, clients: 200, team_size: 3, pain_point: '2 weeks/quarter on check-in calls', use_case: 'quarterly client check-ins', score: 10 },
  },
  {
    transcript: 'Agent: Hi Nancy, this is the Appointment Confirmer from Callengo calling about your appointment scheduled for next week. Are you still able to make it?\nNancy: Yes, I\'ll be there. What time was it again?\nAgent: Your appointment is scheduled for February 12th at 11:00 AM.\nNancy: Perfect. Do I need to bring anything?\nAgent: Please bring your insurance card and a list of current medications.\nNancy: Okay, I\'ll have everything ready.\nAgent: Great! We\'ll see you on February 12th. Have a wonderful day!\nNancy: Thank you, you too!',
    summary: 'Appointment confirmed for Feb 12 at 11:00 AM. Patient reminded to bring insurance card and medication list.',
    analysis: { appointment_confirmed: true, date: '2026-02-12', time: '11:00 AM', reminders_given: ['insurance card', 'medication list'], patient_sentiment: 'positive' },
  },
];

export function generateCallLogs(
  companyId: string,
  contacts: Array<{ id: string; status: string; call_attempts: number; call_outcome: string | null }>,
  agentRuns: Array<{ id: string; agent_template_id: string }>,
  templateIds: { dataValidation: string; appointmentConfirmation: string; leadQualification: string }
) {
  const callLogs: Array<Record<string, unknown>> = [];
  let transcriptIndex = 0;

  contacts.forEach((contact, idx) => {
    if (contact.call_attempts === 0) return;

    for (let attempt = 0; attempt < contact.call_attempts; attempt++) {
      const isLastAttempt = attempt === contact.call_attempts - 1;
      const callDaysAgo = 25 - Math.floor(idx * 0.5) + (contact.call_attempts - attempt - 1) * 2;

      // Determine which agent run this call belongs to
      const listIndex = Math.floor(idx / 10);
      let matchTemplateId: string;
      if (listIndex === 0) matchTemplateId = templateIds.leadQualification;
      else if (listIndex === 1) matchTemplateId = templateIds.appointmentConfirmation;
      else if (listIndex === 2) matchTemplateId = templateIds.dataValidation;
      else if (listIndex === 3) matchTemplateId = templateIds.leadQualification;
      else matchTemplateId = templateIds.leadQualification;

      const matchingRun = agentRuns.find(r => r.agent_template_id === matchTemplateId);

      const isVoicemail = contact.call_outcome === 'Voicemail' && isLastAttempt;
      const isNoAnswer = contact.status === 'No Answer' && isLastAttempt;
      const isWrongNumber = contact.call_outcome === 'Wrong Number';
      const isCompleted = !isVoicemail && !isNoAnswer && !isWrongNumber && isLastAttempt;

      // Use a transcript for completed calls
      const transcriptData = isCompleted && contact.call_outcome !== null
        ? SAMPLE_TRANSCRIPTS[transcriptIndex++ % SAMPLE_TRANSCRIPTS.length]
        : null;

      callLogs.push({
        id: uuidv4(),
        company_id: companyId,
        contact_id: contact.id,
        agent_template_id: matchTemplateId,
        agent_run_id: matchingRun?.id || null,
        call_id: `call-${uuidv4().slice(0, 12)}`,
        status: isVoicemail ? 'voicemail' : isNoAnswer ? 'no-answer' : isWrongNumber ? 'failed' : 'completed',
        completed: isCompleted || isVoicemail,
        call_length: isNoAnswer ? 0 : isVoicemail ? Math.floor(Math.random() * 20) + 10 : Math.floor(Math.random() * 200) + 30,
        price: 0,
        answered_by: isNoAnswer ? null : isVoicemail ? 'voicemail' : 'human',
        recording_url: null,
        transcript: transcriptData?.transcript || null,
        summary: transcriptData?.summary || (isVoicemail ? 'Voicemail detected. Message left.' : isNoAnswer ? 'Call not answered.' : isWrongNumber ? 'Wrong number reached.' : null),
        analysis: transcriptData?.analysis || null,
        error_message: isWrongNumber ? 'Wrong number - does not belong to intended contact' : null,
        metadata: null,
        voicemail_detected: isVoicemail,
        voicemail_left: isVoicemail,
        voicemail_message_url: null,
        voicemail_duration: isVoicemail ? Math.floor(Math.random() * 15) + 5 : null,
        created_at: daysAgo(Math.max(1, callDaysAgo)),
      });
    }
  });

  return callLogs;
}

// ─── FOLLOW-UP QUEUE ────────────────────────────────────────────

export function generateFollowUpQueue(
  companyId: string,
  contacts: Array<{ id: string; status: string; call_outcome: string | null }>,
  agentRuns: Array<{ id: string }>,
  callLogs: Array<{ id: string; contact_id: string | null }>
) {
  const followUps: Array<Record<string, unknown>> = [];

  contacts.forEach((contact) => {
    if (contact.status === 'For Callback' || contact.status === 'No Answer' || contact.status === 'Voicemail Left') {
      const matchingCall = callLogs.find(cl => cl.contact_id === contact.id);
      followUps.push({
        id: uuidv4(),
        company_id: companyId,
        agent_run_id: agentRuns[Math.floor(Math.random() * agentRuns.length)].id,
        contact_id: contact.id,
        original_call_id: matchingCall?.id || null,
        attempt_number: contact.status === 'No Answer' ? 2 : 1,
        max_attempts: 3,
        next_attempt_at: contact.status === 'For Callback' ? daysFromNow(1) : daysFromNow(Math.floor(Math.random() * 3)),
        last_attempt_at: daysAgo(1),
        status: 'pending',
        reason: contact.status === 'For Callback' ? 'callback_requested' : contact.status === 'No Answer' ? 'no_answer' : 'voicemail',
        metadata: {},
        created_at: daysAgo(2),
        updated_at: daysAgo(1),
      });
    }
  });

  return followUps;
}

// ─── VOICEMAIL LOGS ─────────────────────────────────────────────

export function generateVoicemailLogs(
  companyId: string,
  contacts: Array<{ id: string; call_outcome: string | null }>,
  callLogs: Array<{ id: string; contact_id: string | null; agent_run_id: unknown }>,
  agentRuns: Array<{ id: string }>
) {
  const voicemails: Array<Record<string, unknown>> = [];

  contacts.forEach((contact) => {
    if (contact.call_outcome === 'Voicemail') {
      const matchingCall = callLogs.find(cl => cl.contact_id === contact.id);
      voicemails.push({
        id: uuidv4(),
        company_id: companyId,
        call_id: matchingCall?.id || uuidv4(),
        agent_run_id: (matchingCall?.agent_run_id as string) || agentRuns[0].id,
        contact_id: contact.id,
        detected_at: daysAgo(Math.floor(Math.random() * 10) + 1),
        confidence_score: Math.random() * 0.3 + 0.7, // 0.7 - 1.0
        detection_method: 'beep_detection',
        message_left: true,
        message_text: 'Hi, this is Callengo calling to follow up on our conversation. Please give us a call back at your earliest convenience. Thank you!',
        message_duration: Math.floor(Math.random() * 15) + 8,
        message_audio_url: null,
        follow_up_scheduled: true,
        follow_up_id: null,
        metadata: {},
        created_at: daysAgo(Math.floor(Math.random() * 10) + 1),
      });
    }
  });

  return voicemails;
}

// ─── USAGE TRACKING ─────────────────────────────────────────────

export function generateUsageTracking(companyId: string, subscriptionId: string | null) {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    id: uuidv4(),
    company_id: companyId,
    subscription_id: subscriptionId,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    minutes_used: 247,
    minutes_included: 500,
    overage_minutes: 0,
    total_cost: 0,
    created_at: periodStart.toISOString(),
    updated_at: now.toISOString(),
  };
}

// ─── NOTIFICATIONS ──────────────────────────────────────────────

export function generateNotifications(companyId: string, userId: string) {
  return [
    {
      id: uuidv4(),
      company_id: companyId,
      user_id: userId,
      type: 'campaign_completed',
      title: 'Campaign Completed',
      message: 'Data Validation - Real Estate Q1 has finished. 7 of 9 calls successful.',
      read: true,
      metadata: {},
      created_at: daysAgo(19),
      updated_at: daysAgo(19),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      user_id: userId,
      type: 'campaign_completed',
      title: 'Campaign Completed',
      message: 'Appointment Confirmation - Healthcare Jan completed. 8 of 10 appointments confirmed.',
      read: true,
      metadata: {},
      created_at: daysAgo(14),
      updated_at: daysAgo(14),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      user_id: userId,
      type: 'campaign_completed',
      title: 'Campaign Completed',
      message: 'Lead Qualification - Tech Startups completed. 5 qualified leads identified.',
      read: false,
      metadata: {},
      created_at: daysAgo(11),
      updated_at: daysAgo(11),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      user_id: userId,
      type: 'campaign_started',
      title: 'Campaign Started',
      message: 'Data Validation - E-commerce Feb is now running.',
      read: false,
      metadata: {},
      created_at: daysAgo(1),
      updated_at: daysAgo(1),
    },
    {
      id: uuidv4(),
      company_id: companyId,
      user_id: userId,
      type: 'follow_up_reminder',
      title: 'Follow-up Reminder',
      message: 'You have 8 contacts pending follow-up calls across active campaigns.',
      read: false,
      metadata: {},
      created_at: hoursAgo(4),
      updated_at: hoursAgo(4),
    },
  ];
}

// ─── MASTER EXPORT ──────────────────────────────────────────────

export const DEMO_USER_EMAIL = DEMO_EMAIL;

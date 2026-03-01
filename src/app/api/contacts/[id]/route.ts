// app/api/contacts/[id]/route.ts
// Single contact: GET, PATCH (with optional CRM sync), DELETE
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

async function getCompanyId(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single();
  return userData?.company_id || null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const companyId = await getCompanyId(supabase);
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();

    if (error || !contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    // Fetch CRM mappings for this contact
    const [sfMapping, hsMapping, pdMapping] = await Promise.all([
      supabaseAdmin.from('salesforce_contact_mappings').select('sf_contact_id, sf_lead_id, sf_object_type').eq('callengo_contact_id', id).maybeSingle(),
      supabaseAdmin.from('hubspot_contact_mappings').select('hs_contact_id, hs_object_type').eq('callengo_contact_id', id).maybeSingle(),
      supabaseAdmin.from('pipedrive_contact_mappings').select('pd_person_id, pd_object_type').eq('callengo_contact_id', id).maybeSingle(),
    ]);

    return NextResponse.json({
      contact,
      crmMappings: {
        salesforce: sfMapping.data || null,
        hubspot: hsMapping.data || null,
        pipedrive: pdMapping.data || null,
      },
    });
  } catch (error) {
    console.error('Contact GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const companyId = await getCompanyId(supabase);
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { updates, syncTo } = body as {
      updates: Record<string, unknown>;
      syncTo?: string[]; // ['salesforce', 'hubspot', 'pipedrive']
    };

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    // Only allow safe fields to be updated
    const allowedFields = [
      'company_name', 'contact_name', 'email', 'phone_number', 'address',
      'city', 'state', 'zip_code', 'status', 'notes', 'tags', 'list_id',
      'custom_fields',
    ];
    const safeUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) safeUpdates[key] = value;
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    safeUpdates.updated_at = new Date().toISOString();

    // Update in Callengo
    const { data: updated, error } = await supabase
      .from('contacts')
      .update(safeUpdates)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;

    // Sync to CRM integrations if requested
    const syncResults: Record<string, { success: boolean; error?: string }> = {};
    if (syncTo && syncTo.length > 0 && updated) {
      for (const crm of syncTo) {
        try {
          if (crm === 'pipedrive') {
            // Pipedrive has outbound push support
            const { getActivePipedriveIntegration, pushContactToPipedrive } = await import('@/lib/pipedrive');
            const pdIntegration = await getActivePipedriveIntegration(companyId);
            if (pdIntegration) {
              const result = await pushContactToPipedrive(pdIntegration, id);
              syncResults.pipedrive = result;
            } else {
              syncResults.pipedrive = { success: false, error: 'Not connected' };
            }
          } else if (crm === 'salesforce') {
            // Salesforce doesn't have outbound push yet — just note it
            syncResults.salesforce = { success: false, error: 'Outbound sync not available yet' };
          } else if (crm === 'hubspot') {
            // HubSpot doesn't have outbound push yet — just note it
            syncResults.hubspot = { success: false, error: 'Outbound sync not available yet' };
          }
        } catch (syncErr) {
          syncResults[crm] = { success: false, error: syncErr instanceof Error ? syncErr.message : 'Sync failed' };
        }
      }
    }

    return NextResponse.json({ contact: updated, syncResults });
  } catch (error) {
    console.error('Contact PATCH error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update contact';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const companyId = await getCompanyId(supabase);
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}

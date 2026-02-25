-- Migration: Update agent templates with calendar-aware task templates
-- Each agent now includes instructions for calendar operations:
-- - Appointment Confirmation: Can confirm, reschedule, handle no-shows, read calendar context
-- - Lead Qualification: Can schedule meetings with video links, check availability
-- - Data Validation: Can schedule callbacks based on availability

-- 1. Appointment Confirmation Agent - Calendar-Aware Update
UPDATE agent_templates SET
  task_template = 'Call {{contact_name}} to confirm their appointment with {{company_name}} scheduled for {{appointment_date}}.

CAPABILITIES:
- Confirm the appointment if the contact can attend.
- If they cannot make it, offer to reschedule. Check available times based on the business calendar and suggest alternatives. When rescheduling, note the new preferred date/time and reason.
- If the contact prefers a video call instead of in-person, inform them that you will send a calendar invitation with a video meeting link for the new time.
- If the contact is a no-show (does not answer), flag this for automatic retry based on the configured schedule.
- Ask if they need any reminders about location, preparation, or what to bring.

IMPORTANT BEHAVIORS:
- Always be friendly, professional, and accommodating.
- When rescheduling, confirm the new date and time clearly before ending the call.
- If the contact requests a specific callback time, note it precisely.
- Record whether the appointment was confirmed, rescheduled, or cancelled.
- If rescheduled, record the new appointment time and the reason for the change.'
WHERE slug = 'appointment-confirmation';

-- 2. Lead Qualification Agent - Calendar-Aware Update
UPDATE agent_templates SET
  task_template = 'Call {{contact_name}} to qualify their interest in {{company_name}}''s products/services.

QUALIFICATION PROCESS:
- Ask about their budget, timeline, decision-making authority, and specific needs (BANT framework).
- Be consultative and helpful, not pushy.
- Determine if they are a good fit for the product/service.

SCHEDULING CAPABILITIES:
- If the lead is qualified and interested, offer to schedule a meeting with the sales team.
- Check available times from the business calendar and propose convenient slots.
- When scheduling, confirm: the date/time, whether it will be a video call or phone call, and the contact''s email for the calendar invite.
- The meeting invitation will be sent automatically with the configured video platform (Zoom, Google Meet, or Microsoft Teams).
- Record the scheduled meeting date, type, and any notes about the lead''s preferences.

IMPORTANT BEHAVIORS:
- Always be professional and respectful of the contact''s time.
- If the contact is not ready to schedule but is interested, offer a callback at a more convenient time.
- Score the lead based on their responses (hot, warm, cold) and record key qualification data.'
WHERE slug = 'lead-qualification';

-- 3. Data Validation Agent - Calendar-Aware Update
UPDATE agent_templates SET
  task_template = 'Call {{contact_name}} to verify and update their contact information for {{company_name}}.

VERIFICATION PROCESS:
- Confirm their email address, phone number, mailing address, and any other relevant details on file.
- If anything has changed, politely ask for the updated information.
- Be friendly, professional, and efficient.

CALLBACK CAPABILITIES:
- If the contact is busy or requests a callback, note their preferred callback time.
- The system will automatically schedule the callback on the business calendar.
- If the contact cannot be reached, a follow-up will be scheduled based on the campaign configuration.

IMPORTANT BEHAVIORS:
- Keep the call brief and focused on verification.
- Thank the contact for their time after confirming or updating their information.
- Record all verified and updated fields clearly.'
WHERE slug = 'data-validation';

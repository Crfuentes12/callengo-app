-- Migration: Configure Core 3 Agents
-- Created: 2026-01-23
-- Purpose: Keep only the 3 core agents focused on pain points, deactivate others

-- First, deactivate all agents
UPDATE agent_templates SET is_active = false WHERE true;

-- Update and activate the 3 core agents with pain-focused descriptions

-- 1. Data Validation Agent
-- Pain: "Clean my database" - Stop wasting money on bad data
INSERT INTO agent_templates (
  slug,
  name,
  description,
  icon,
  category,
  task_template,
  first_sentence_template,
  voicemail_template,
  is_active,
  sort_order
) VALUES (
  'data-validation',
  'Data Validation Agent',
  'Stop wasting money on bad data. Automatically verify and update contact information - no more bounced emails or wrong numbers. Your team saves hours every week.',
  '🔍',
  'verification',
  'Call {{contact_name}} to verify and update their contact information for {{company_name}}. Be friendly and professional. Ask to confirm their email address, phone number, and any other relevant details. If anything has changed, politely ask for the updated information.',
  'Hi {{contact_name}}, this is {{agent_name}} calling from {{company_name}}. I''m calling to quickly verify your contact information to make sure we have your correct details on file. Do you have a minute?',
  'Hi {{contact_name}}, this is {{agent_name}} from {{company_name}}. I was calling to verify your contact information. Please give us a call back at your convenience. Thank you!',
  true,
  1
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  task_template = EXCLUDED.task_template,
  first_sentence_template = EXCLUDED.first_sentence_template,
  voicemail_template = EXCLUDED.voicemail_template,
  is_active = true,
  sort_order = 1;

-- 2. Appointment Confirmation Agent
-- Pain: "Stop losing money from no-shows" - Reduce no-shows immediately
INSERT INTO agent_templates (
  slug,
  name,
  description,
  icon,
  category,
  task_template,
  first_sentence_template,
  voicemail_template,
  is_active,
  sort_order
) VALUES (
  'appointment-confirmation',
  'Appointment Confirmation Agent',
  'Stop losing money from no-shows. Confirm appointments automatically and see results in days. Perfect for clinics, services, and any business that books meetings.',
  '📅',
  'appointment',
  'Call {{contact_name}} to confirm their appointment with {{company_name}} scheduled for {{appointment_date}}. Be friendly and helpful. If they need to reschedule, help them find a new time. Confirm they have the location and any preparation needed.',
  'Hi {{contact_name}}, this is {{agent_name}} calling from {{company_name}}. I''m calling to confirm your appointment scheduled for {{appointment_date}}. Are you still able to make it?',
  'Hi {{contact_name}}, this is {{agent_name}} from {{company_name}}. I was calling to confirm your appointment for {{appointment_date}}. Please give us a call back to confirm. Thank you!',
  true,
  2
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  task_template = EXCLUDED.task_template,
  first_sentence_template = EXCLUDED.first_sentence_template,
  voicemail_template = EXCLUDED.voicemail_template,
  is_active = true,
  sort_order = 2;

-- 3. Lead Qualification Agent
-- Pain: "Qualify leads before sales touches them" - Stop wasting your team's time
INSERT INTO agent_templates (
  slug,
  name,
  description,
  icon,
  category,
  task_template,
  first_sentence_template,
  voicemail_template,
  is_active,
  sort_order
) VALUES (
  'lead-qualification',
  'Lead Qualification Agent',
  'Stop wasting your sales team''s time on bad leads. Filter and score leads automatically before your team touches them. Your sellers only talk to qualified prospects.',
  '🎯',
  'sales',
  'Call {{contact_name}} to qualify their interest in {{company_name}}''s products/services. Ask about their budget, timeline, decision-making authority, and specific needs. Be consultative and helpful, not pushy. Determine if they''re a good fit.',
  'Hi {{contact_name}}, this is {{agent_name}} calling from {{company_name}}. I understand you expressed interest in our {{product_service}}. I''d love to ask you a few quick questions to see how we might be able to help. Do you have a few minutes?',
  'Hi {{contact_name}}, this is {{agent_name}} from {{company_name}}. I was reaching out regarding your interest in {{product_service}}. I''d love to chat and see if we''re a good fit. Please give me a call back when you have a moment. Thank you!',
  true,
  3
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  task_template = EXCLUDED.task_template,
  first_sentence_template = EXCLUDED.first_sentence_template,
  voicemail_template = EXCLUDED.voicemail_template,
  is_active = true,
  sort_order = 3;

-- Delete or deactivate removed agents (optional - keeps historical data)
-- If you want to completely remove them from the database:
DELETE FROM agent_templates WHERE slug IN (
  'lead-reactivation',
  'abandoned-cart',
  'feedback-collection',
  'winback-campaign'
);

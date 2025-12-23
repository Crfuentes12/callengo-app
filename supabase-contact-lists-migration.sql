-- Migration: Add Contact Lists functionality
-- This script creates the contact_lists table and adds list_id to contacts table
-- Execute this in your Supabase SQL editor

-- Create contact_lists table
CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add list_id column to contacts table (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'list_id'
  ) THEN
    ALTER TABLE contacts ADD COLUMN list_id UUID REFERENCES contact_lists(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contact_lists_company_id ON contact_lists(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_list_id ON contacts(list_id);

-- Enable Row Level Security (RLS)
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contact_lists
CREATE POLICY "Users can view their company's contact lists"
  ON contact_lists FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contact lists for their company"
  ON contact_lists FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's contact lists"
  ON contact_lists FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their company's contact lists"
  ON contact_lists FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_contact_lists_updated_at ON contact_lists;
CREATE TRIGGER update_contact_lists_updated_at
  BEFORE UPDATE ON contact_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_lists_updated_at();

-- Insert default "All Contacts" list for existing companies
INSERT INTO contact_lists (company_id, name, description, color)
SELECT
  id,
  'All Contacts',
  'Default list containing all contacts',
  '#6366f1'
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM contact_lists
  WHERE contact_lists.company_id = companies.id
  AND contact_lists.name = 'All Contacts'
);

-- Migration: Add notifications system
-- Created: 2026-01-09

-- Add notifications preferences to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- null means notification for all users in company
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_company_user_unread ON notifications(company_id, user_id, read) WHERE read = false;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_notifications_timestamp ON notifications;
CREATE TRIGGER update_notifications_timestamp
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- Create function to create notification for campaign completion
CREATE OR REPLACE FUNCTION notify_campaign_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create notification when status changes to completed or failed
  IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status AND (NEW.status = 'completed' OR NEW.status = 'failed')) THEN
    INSERT INTO notifications (company_id, type, title, message, metadata)
    VALUES (
      NEW.company_id,
      CASE
        WHEN NEW.status = 'completed' THEN 'campaign_completed'
        WHEN NEW.status = 'failed' THEN 'campaign_failed'
      END,
      CASE
        WHEN NEW.status = 'completed' THEN 'Campaign Completed'
        WHEN NEW.status = 'failed' THEN 'Campaign Failed'
      END,
      CASE
        WHEN NEW.status = 'completed' THEN
          'Campaign "' || NEW.name || '" has completed successfully with ' || NEW.completed_calls || ' calls made.'
        WHEN NEW.status = 'failed' THEN
          'Campaign "' || NEW.name || '" has failed. Please check the logs for more details.'
      END,
      jsonb_build_object(
        'campaign_id', NEW.id,
        'campaign_name', NEW.name,
        'completed_calls', NEW.completed_calls,
        'successful_calls', NEW.successful_calls,
        'status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for campaign completion
DROP TRIGGER IF EXISTS trigger_notify_campaign_completion ON agent_runs;
CREATE TRIGGER trigger_notify_campaign_completion
  AFTER UPDATE ON agent_runs
  FOR EACH ROW
  EXECUTE FUNCTION notify_campaign_completion();

-- Create function to notify on high call failure rate
CREATE OR REPLACE FUNCTION notify_high_failure_rate()
RETURNS TRIGGER AS $$
DECLARE
  total_calls INTEGER;
  failed_calls INTEGER;
  failure_rate NUMERIC;
BEGIN
  -- Calculate failure rate for the campaign
  IF NEW.completed_calls >= 10 THEN
    failed_calls := NEW.completed_calls - NEW.successful_calls;
    failure_rate := (failed_calls::NUMERIC / NEW.completed_calls::NUMERIC) * 100;

    -- Alert if failure rate is above 50%
    IF failure_rate > 50 AND (OLD.completed_calls IS NULL OR OLD.completed_calls < 10 OR
       (OLD.completed_calls - OLD.successful_calls)::NUMERIC / OLD.completed_calls::NUMERIC * 100 <= 50) THEN
      INSERT INTO notifications (company_id, type, title, message, metadata)
      VALUES (
        NEW.company_id,
        'high_failure_rate',
        'High Call Failure Rate Detected',
        'Campaign "' || NEW.name || '" has a high failure rate of ' || ROUND(failure_rate, 1) || '%. Consider reviewing your agent configuration.',
        jsonb_build_object(
          'campaign_id', NEW.id,
          'campaign_name', NEW.name,
          'failure_rate', ROUND(failure_rate, 1),
          'total_calls', NEW.completed_calls,
          'failed_calls', failed_calls
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for high failure rate
DROP TRIGGER IF EXISTS trigger_notify_high_failure_rate ON agent_runs;
CREATE TRIGGER trigger_notify_high_failure_rate
  AFTER UPDATE ON agent_runs
  FOR EACH ROW
  EXECUTE FUNCTION notify_high_failure_rate();

-- Create function to notify when minutes limit is approaching
CREATE OR REPLACE FUNCTION notify_minutes_limit()
RETURNS TRIGGER AS $$
DECLARE
  usage_percentage NUMERIC;
BEGIN
  IF NEW.minutes_used IS NOT NULL AND NEW.minutes_included IS NOT NULL AND NEW.minutes_included > 0 THEN
    usage_percentage := (NEW.minutes_used::NUMERIC / NEW.minutes_included::NUMERIC) * 100;

    -- Alert at 80%, 90%, and 100%
    IF usage_percentage >= 80 AND (OLD.minutes_used IS NULL OR
       (OLD.minutes_used::NUMERIC / NEW.minutes_included::NUMERIC * 100) < 80) THEN
      INSERT INTO notifications (company_id, type, title, message, metadata)
      VALUES (
        NEW.company_id,
        CASE
          WHEN usage_percentage >= 100 THEN 'minutes_exceeded'
          WHEN usage_percentage >= 90 THEN 'minutes_critical'
          ELSE 'minutes_warning'
        END,
        CASE
          WHEN usage_percentage >= 100 THEN 'Minutes Limit Exceeded'
          WHEN usage_percentage >= 90 THEN 'Minutes Limit Critical'
          ELSE 'Minutes Limit Warning'
        END,
        CASE
          WHEN usage_percentage >= 100 THEN
            'You have exceeded your monthly minutes limit. Additional charges may apply.'
          WHEN usage_percentage >= 90 THEN
            'You have used ' || ROUND(usage_percentage, 0) || '% of your monthly minutes. Consider upgrading your plan.'
          ELSE
            'You have used ' || ROUND(usage_percentage, 0) || '% of your monthly minutes.'
        END,
        jsonb_build_object(
          'minutes_used', NEW.minutes_used,
          'minutes_included', NEW.minutes_included,
          'usage_percentage', ROUND(usage_percentage, 1)
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for minutes limit
DROP TRIGGER IF EXISTS trigger_notify_minutes_limit ON usage_tracking;
CREATE TRIGGER trigger_notify_minutes_limit
  AFTER UPDATE ON usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION notify_minutes_limit();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT USAGE ON SEQUENCE notifications_id_seq TO authenticated;

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view notifications for their company"
  ON notifications FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update notifications for their company"
  ON notifications FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete notifications for their company"
  ON notifications FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Allow system to insert notifications
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

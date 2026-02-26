import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

/**
 * Creates or retrieves a Stripe customer, keyed by user email.
 * Always updates metadata with the latest user/company info so Stripe
 * stays in sync even if the user renames their company or changes details.
 */
export async function getOrCreateStripeCustomer(params: {
  companyId: string;
  email: string;
  userName?: string;
  companyName?: string;
  companyWebsite?: string;
  userId?: string;
}): Promise<Stripe.Customer> {
  const { companyId, email, userName, companyName, companyWebsite, userId } = params;

  const now = new Date().toISOString();

  // Build metadata with all trackable info
  const metadata: Record<string, string> = {
    company_id: companyId,
    ...(userId && { user_id: userId }),
    ...(companyName && { company_name: companyName }),
    ...(companyWebsite && { company_website: companyWebsite }),
    metadata_updated_at: now,
  };

  // The customer name shown in Stripe dashboard: "User Name (Company)"
  const displayName = userName && companyName
    ? `${userName} (${companyName})`
    : userName || companyName || undefined;

  // Try to find existing customer by email
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    const existing = existingCustomers.data[0];

    // Always update metadata so Stripe stays current with any company name/website changes
    const updatedCustomer = await stripe.customers.update(existing.id, {
      ...(displayName && { name: displayName }),
      metadata: {
        ...existing.metadata,
        ...metadata,
      },
    });

    return updatedCustomer;
  }

  // Create new customer keyed by email
  const customer = await stripe.customers.create({
    email,
    ...(displayName && { name: displayName }),
    metadata,
  });

  return customer;
}

/**
 * Creates a Stripe checkout session for a subscription
 */
export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  trialPeriodDays?: number;
  allowPromotionCodes?: boolean;
}): Promise<Stripe.Checkout.Session> {
  const {
    customerId,
    priceId,
    successUrl,
    cancelUrl,
    metadata = {},
    trialPeriodDays,
    allowPromotionCodes = true,
  } = params;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    allow_promotion_codes: allowPromotionCodes,
    subscription_data: trialPeriodDays
      ? {
          trial_period_days: trialPeriodDays,
          metadata,
        }
      : { metadata },
  });

  return session;
}

/**
 * Creates a billing portal session for managing subscription
 */
export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const { customerId, returnUrl } = params;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

/**
 * Updates a subscription (e.g., change plan, update metadata)
 */
export async function updateSubscription(params: {
  subscriptionId: string;
  priceId?: string;
  metadata?: Record<string, string>;
  prorationBehavior?: Stripe.SubscriptionUpdateParams.ProrationBehavior;
}): Promise<Stripe.Subscription> {
  const {
    subscriptionId,
    priceId,
    metadata,
    prorationBehavior = 'create_prorations',
  } = params;

  const updateParams: Stripe.SubscriptionUpdateParams = {
    proration_behavior: prorationBehavior,
  };

  if (priceId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    updateParams.items = [
      {
        id: subscription.items.data[0].id,
        price: priceId,
      },
    ];
  }

  if (metadata) {
    updateParams.metadata = metadata;
  }

  const subscription = await stripe.subscriptions.update(
    subscriptionId,
    updateParams
  );

  return subscription;
}

/**
 * Cancels a subscription
 */
export async function cancelSubscription(params: {
  subscriptionId: string;
  immediately?: boolean;
}): Promise<Stripe.Subscription> {
  const { subscriptionId, immediately = false } = params;

  if (immediately) {
    return await stripe.subscriptions.cancel(subscriptionId);
  } else {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

/**
 * Reports usage for metered billing (overage)
 * Uses Stripe's meter events API for v2025-12-15+
 */
export async function reportUsage(params: {
  subscriptionItemId: string;
  quantity: number;
  timestamp?: number;
  action?: 'increment' | 'set';
}): Promise<any> {
  const {
    subscriptionItemId,
    quantity,
    timestamp = Math.floor(Date.now() / 1000),
    action = 'set',
  } = params;

  try {
    // Use subscription item usage records (works with metered billing)
    const usageRecord = await stripe.subscriptionItems.createUsageRecord(
      subscriptionItemId,
      {
        quantity,
        timestamp,
        action,
      }
    );

    console.log('Usage reported to Stripe:', {
      subscriptionItemId,
      quantity,
      recordId: usageRecord.id,
    });

    return usageRecord;
  } catch (error) {
    console.error('Failed to report usage to Stripe:', error);
    throw error;
  }
}

/**
 * Creates a metered price for overage billing
 */
export async function createMeteredPrice(params: {
  productId: string;
  unitAmount: number;
  currency?: string;
  nickname?: string;
}): Promise<Stripe.Price> {
  const { productId, unitAmount, currency = 'usd', nickname } = params;

  const price = await stripe.prices.create({
    product: productId,
    currency,
    unit_amount: unitAmount,
    recurring: {
      interval: 'month',
      usage_type: 'metered',
    },
    billing_scheme: 'per_unit',
    nickname,
  });

  return price;
}

/**
 * Retrieves subscription with pricing details
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice', 'customer', 'items.data.price'],
    });
    return subscription;
  } catch (error) {
    if ((error as Stripe.StripeRawError).code === 'resource_missing') {
      return null;
    }
    throw error;
  }
}

/**
 * Retrieves customer with subscriptions
 */
export async function getCustomer(
  customerId: string
): Promise<Stripe.Customer | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['subscriptions'],
    });
    return customer as Stripe.Customer;
  } catch (error) {
    if ((error as Stripe.StripeRawError).code === 'resource_missing') {
      return null;
    }
    throw error;
  }
}

/**
 * Verifies webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

/**
 * Retrieves upcoming invoice for a customer
 */
export async function getUpcomingInvoice(
  customerId: string
): Promise<Stripe.Invoice | null> {
  try {
    const invoice = await stripe.invoices.list({
      customer: customerId,
      limit: 1,
      status: 'draft',
    });
    return invoice.data[0] || null;
  } catch (error) {
    if ((error as Stripe.StripeRawError).code === 'invoice_upcoming_none') {
      return null;
    }
    throw error;
  }
}

/**
 * Creates a product in Stripe
 */
export async function createProduct(params: {
  name: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Product> {
  const { name, description, metadata = {} } = params;

  const product = await stripe.products.create({
    name,
    description,
    metadata,
  });

  return product;
}

/**
 * Creates a recurring price for a product
 */
export async function createRecurringPrice(params: {
  productId: string;
  unitAmount: number;
  currency?: string;
  interval: 'month' | 'year';
  nickname?: string;
}): Promise<Stripe.Price> {
  const {
    productId,
    unitAmount,
    currency = 'usd',
    interval,
    nickname,
  } = params;

  const price = await stripe.prices.create({
    product: productId,
    currency,
    unit_amount: unitAmount,
    recurring: {
      interval,
    },
    nickname,
  });

  return price;
}

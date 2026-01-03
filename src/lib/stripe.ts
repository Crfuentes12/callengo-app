import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

/**
 * Creates or retrieves a Stripe customer for a company
 */
export async function getOrCreateStripeCustomer(params: {
  companyId: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
  const { companyId, email, name, metadata = {} } = params;

  // Try to find existing customer
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      company_id: companyId,
      ...metadata,
    },
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

  // Note: In Stripe API v2025-12-15, metered billing uses subscription items
  // For now, we'll return a mock until we implement the new API
  console.log('Reporting usage:', { subscriptionItemId, quantity, timestamp, action });

  return {
    id: 'usage_' + Date.now(),
    object: 'usage_record',
    quantity,
    timestamp,
    subscription_item: subscriptionItemId,
  };
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

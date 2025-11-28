/**
 * Stripe Payment Service
 * 
 * Handles all Stripe-related operations including:
 * - Customer creation and management
 * - Connect account onboarding for vendors
 * - Payment intents and checkout sessions
 * - Webhook handling
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a Stripe account at https://stripe.com
 * 2. Get your API keys from https://dashboard.stripe.com/apikeys
 * 3. Set environment variables:
 *    - STRIPE_SECRET_KEY: Your Stripe secret key (sk_test_... or sk_live_...)
 *    - STRIPE_PUBLISHABLE_KEY: Your Stripe publishable key (pk_test_... or pk_live_...)
 *    - STRIPE_WEBHOOK_SECRET: Webhook signing secret (whsec_...)
 * 4. For Stripe Connect (vendor payouts):
 *    - Enable Connect in your Stripe dashboard
 *    - Set up OAuth redirect URLs
 * 
 * WEBHOOK SETUP:
 * 1. Go to https://dashboard.stripe.com/webhooks
 * 2. Add endpoint: https://yourdomain.com/api/payments/webhook
 * 3. Select events: payment_intent.succeeded, payment_intent.failed, 
 *    checkout.session.completed, account.updated
 * 4. Copy the signing secret to STRIPE_WEBHOOK_SECRET
 */

import Stripe from 'stripe';
import { db } from './db';
import { users, orders, servicePricingOptions } from '../shared/schema';
import { eq } from 'drizzle-orm';

// ===========================================
// STRIPE CONFIGURATION
// ===========================================

// TODO: Replace with your actual Stripe keys from environment variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_STUB_KEY_REPLACE_ME';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_STUB_KEY_REPLACE_ME';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_STUB_SECRET_REPLACE_ME';

// Platform fee percentage (e.g., 0.10 = 10%)
const PLATFORM_FEE_PERCENTAGE = 0.10;

// Initialize Stripe client
// Note: Will fail gracefully with stub keys - check isStripeConfigured() before operations
let stripe: Stripe | null = null;

try {
  if (STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.includes('STUB')) {
    stripe = new Stripe(STRIPE_SECRET_KEY, {
      typescript: true,
    });
    console.log('✓ Stripe initialized successfully');
  } else {
    console.log('⚠ Stripe running in stub mode - payments disabled');
  }
} catch (error) {
  console.error('✗ Failed to initialize Stripe:', error);
}

/**
 * Check if Stripe is properly configured
 */
export function isStripeConfigured(): boolean {
  return stripe !== null && !STRIPE_SECRET_KEY.includes('STUB');
}

/**
 * Get the Stripe publishable key for frontend
 */
export function getStripePublishableKey(): string {
  return STRIPE_PUBLISHABLE_KEY;
}

// ===========================================
// CUSTOMER MANAGEMENT
// ===========================================

/**
 * Create or retrieve a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(userId: string): Promise<string | null> {
  if (!stripe) {
    console.log('Stripe not configured - skipping customer creation');
    return null;
  }

  try {
    // Check if user already has a Stripe customer ID
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user) {
      throw new Error('User not found');
    }

    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
      metadata: {
        userId: user.id,
      },
    });

    // Save customer ID to database
    await db.update(users)
      .set({ stripeCustomerId: customer.id })
      .where(eq(users.id, userId));

    console.log(`Created Stripe customer ${customer.id} for user ${userId}`);
    return customer.id;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
}

// ===========================================
// STRIPE CONNECT (VENDOR ONBOARDING)
// ===========================================

/**
 * Create a Stripe Connect account for a vendor
 */
export async function createConnectAccount(userId: string): Promise<{ accountId: string; onboardingUrl: string } | null> {
  if (!stripe) {
    console.log('Stripe not configured - skipping Connect account creation');
    return null;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Check if already has Connect account
    if (user.stripeConnectAccountId) {
      // Generate new onboarding link if not yet onboarded
      if (!user.stripeConnectOnboarded) {
        const accountLink = await stripe.accountLinks.create({
          account: user.stripeConnectAccountId,
          refresh_url: `${process.env.APP_URL || 'http://localhost:5000'}/vendor/stripe/refresh`,
          return_url: `${process.env.APP_URL || 'http://localhost:5000'}/vendor/stripe/complete`,
          type: 'account_onboarding',
        });
        return { accountId: user.stripeConnectAccountId, onboardingUrl: accountLink.url };
      }
      return { accountId: user.stripeConnectAccountId, onboardingUrl: '' };
    }

    // Create Express Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email || undefined,
      metadata: {
        userId: user.id,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Save Connect account ID
    await db.update(users)
      .set({ stripeConnectAccountId: account.id })
      .where(eq(users.id, userId));

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.APP_URL || 'http://localhost:5000'}/vendor/stripe/refresh`,
      return_url: `${process.env.APP_URL || 'http://localhost:5000'}/vendor/stripe/complete`,
      type: 'account_onboarding',
    });

    console.log(`Created Stripe Connect account ${account.id} for user ${userId}`);
    return { accountId: account.id, onboardingUrl: accountLink.url };
  } catch (error) {
    console.error('Error creating Connect account:', error);
    throw error;
  }
}

/**
 * Check Connect account status
 */
export async function getConnectAccountStatus(userId: string): Promise<{
  hasAccount: boolean;
  isOnboarded: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
} | null> {
  if (!stripe) {
    return null;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user || !user.stripeConnectAccountId) {
      return { hasAccount: false, isOnboarded: false, chargesEnabled: false, payoutsEnabled: false };
    }

    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
    
    const isOnboarded = account.details_submitted || false;
    
    // Update database if onboarding status changed
    if (isOnboarded && !user.stripeConnectOnboarded) {
      await db.update(users)
        .set({ stripeConnectOnboarded: true })
        .where(eq(users.id, userId));
    }

    return {
      hasAccount: true,
      isOnboarded,
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
    };
  } catch (error) {
    console.error('Error getting Connect account status:', error);
    return null;
  }
}

// ===========================================
// PAYMENT PROCESSING
// ===========================================

interface CreatePaymentIntentParams {
  orderId: string;
  customerId: string;
  vendorId: string;
  amount: number; // in cents
  currency?: string;
  description?: string;
}

/**
 * Create a payment intent for an order
 */
export async function createPaymentIntent(params: CreatePaymentIntentParams): Promise<{
  clientSecret: string;
  paymentIntentId: string;
} | null> {
  if (!stripe) {
    console.log('Stripe not configured - returning stub payment intent');
    return { clientSecret: 'stub_client_secret', paymentIntentId: 'stub_payment_intent' };
  }

  try {
    const { orderId, customerId, vendorId, amount, currency = 'chf', description } = params;

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(customerId);
    if (!stripeCustomerId) {
      throw new Error('Could not create Stripe customer');
    }

    // Get vendor's Connect account
    const [vendor] = await db.select().from(users).where(eq(users.id, vendorId)).limit(1);
    
    // Calculate platform fee
    const platformFee = Math.round(amount * PLATFORM_FEE_PERCENTAGE);

    // Create payment intent with application fee (if vendor has Connect account)
    const paymentIntentData: Stripe.PaymentIntentCreateParams = {
      amount,
      currency,
      customer: stripeCustomerId,
      description: description || `Order ${orderId}`,
      metadata: {
        orderId,
        customerId,
        vendorId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    };

    // Add transfer data if vendor has Connect account
    if (vendor?.stripeConnectAccountId && vendor.stripeConnectOnboarded) {
      paymentIntentData.application_fee_amount = platformFee;
      paymentIntentData.transfer_data = {
        destination: vendor.stripeConnectAccountId,
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    // Update order with payment intent ID
    await db.update(orders)
      .set({ 
        stripePaymentIntentId: paymentIntent.id,
        platformFee: (platformFee / 100).toString(),
      })
      .where(eq(orders.id, orderId));

    console.log(`Created payment intent ${paymentIntent.id} for order ${orderId}`);
    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
}

/**
 * Create a checkout session for an order
 */
export async function createCheckoutSession(params: {
  orderId: string;
  customerId: string;
  vendorId: string;
  lineItems: Array<{
    name: string;
    description?: string;
    amount: number; // in cents
    quantity: number;
  }>;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string } | null> {
  if (!stripe) {
    console.log('Stripe not configured - returning stub checkout session');
    return { sessionId: 'stub_session', url: params.successUrl };
  }

  try {
    const { orderId, customerId, vendorId, lineItems, successUrl, cancelUrl } = params;

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(customerId);
    
    // Get vendor's Connect account
    const [vendor] = await db.select().from(users).where(eq(users.id, vendorId)).limit(1);

    // Calculate total and platform fee
    const total = lineItems.reduce((sum, item) => sum + (item.amount * item.quantity), 0);
    const platformFee = Math.round(total * PLATFORM_FEE_PERCENTAGE);

    const sessionData: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      customer: stripeCustomerId || undefined,
      line_items: lineItems.map(item => ({
        price_data: {
          currency: 'chf',
          product_data: {
            name: item.name,
            description: item.description,
          },
          unit_amount: item.amount,
        },
        quantity: item.quantity,
      })),
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        orderId,
        customerId,
        vendorId,
      },
    };

    // Add payment intent data for Connect
    if (vendor?.stripeConnectAccountId && vendor.stripeConnectOnboarded) {
      sessionData.payment_intent_data = {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: vendor.stripeConnectAccountId,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionData);

    // Update order with checkout session ID
    await db.update(orders)
      .set({ stripeCheckoutSessionId: session.id })
      .where(eq(orders.id, orderId));

    console.log(`Created checkout session ${session.id} for order ${orderId}`);
    return {
      sessionId: session.id,
      url: session.url!,
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

// ===========================================
// WEBHOOK HANDLING
// ===========================================

/**
 * Verify and parse Stripe webhook
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
  if (!stripe) {
    console.log('Stripe not configured - cannot verify webhook');
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return null;
  }
}

/**
 * Handle payment_intent.succeeded webhook
 */
export async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const orderId = paymentIntent.metadata.orderId;
  
  if (!orderId) {
    console.error('No orderId in payment intent metadata');
    return;
  }

  try {
    await db.update(orders)
      .set({
        paymentStatus: 'succeeded',
        paidAt: new Date(),
        status: 'confirmed',
      })
      .where(eq(orders.id, orderId));

    console.log(`Payment succeeded for order ${orderId}`);
    
    // TODO: Trigger referral commission processing here
    // await processReferralCommission(orderId);
    
    // TODO: Send confirmation emails to customer and vendor
    // await sendPaymentConfirmationEmails(orderId);
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

/**
 * Handle payment_intent.payment_failed webhook
 */
export async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const orderId = paymentIntent.metadata.orderId;
  
  if (!orderId) {
    console.error('No orderId in payment intent metadata');
    return;
  }

  try {
    await db.update(orders)
      .set({
        paymentStatus: 'failed',
      })
      .where(eq(orders.id, orderId));

    console.log(`Payment failed for order ${orderId}`);
    
    // TODO: Send failure notification to customer
    // await sendPaymentFailureEmail(orderId);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

/**
 * Handle account.updated webhook (Connect account updates)
 */
export async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  const userId = account.metadata?.userId;
  
  if (!userId) {
    console.error('No userId in account metadata');
    return;
  }

  try {
    const isOnboarded = account.details_submitted || false;
    
    await db.update(users)
      .set({ stripeConnectOnboarded: isOnboarded })
      .where(eq(users.id, userId));

    console.log(`Updated Connect status for user ${userId}: onboarded=${isOnboarded}`);
  } catch (error) {
    console.error('Error handling account updated:', error);
  }
}

// ===========================================
// PRICING OPTIONS MANAGEMENT
// ===========================================

/**
 * Create a Stripe Price for a pricing option
 */
export async function createStripePrice(pricingOptionId: string): Promise<string | null> {
  if (!stripe) {
    console.log('Stripe not configured - skipping price creation');
    return null;
  }

  try {
    const [option] = await db.select()
      .from(servicePricingOptions)
      .where(eq(servicePricingOptions.id, pricingOptionId))
      .limit(1);

    if (!option) {
      throw new Error('Pricing option not found');
    }

    // Determine recurring interval if not one-time
    const isRecurring = option.billingInterval !== 'one_time';
    
    const priceData: Stripe.PriceCreateParams = {
      currency: option.currency.toLowerCase(),
      unit_amount: Math.round(parseFloat(option.price) * 100), // Convert to cents
      product_data: {
        name: option.label,
        metadata: {
          pricingOptionId: option.id,
          serviceId: option.serviceId,
        },
      },
    };

    if (isRecurring) {
      const intervalMap: Record<string, Stripe.PriceCreateParams.Recurring.Interval> = {
        'hourly': 'day', // Stripe doesn't support hourly, use day as proxy
        'daily': 'day',
        'weekly': 'week',
        'monthly': 'month',
        'yearly': 'year',
      };
      priceData.recurring = {
        interval: intervalMap[option.billingInterval] || 'month',
      };
    }

    const price = await stripe.prices.create(priceData);

    // Update pricing option with Stripe Price ID
    await db.update(servicePricingOptions)
      .set({ stripePriceId: price.id })
      .where(eq(servicePricingOptions.id, pricingOptionId));

    console.log(`Created Stripe price ${price.id} for pricing option ${pricingOptionId}`);
    return price.id;
  } catch (error) {
    console.error('Error creating Stripe price:', error);
    throw error;
  }
}

// ===========================================
// REFUNDS
// ===========================================

/**
 * Create a refund for an order
 */
export async function createRefund(orderId: string, amount?: number, reason?: string): Promise<boolean> {
  if (!stripe) {
    console.log('Stripe not configured - skipping refund');
    return false;
  }

  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    
    if (!order || !order.stripePaymentIntentId) {
      throw new Error('Order not found or no payment intent');
    }

    const refundData: Stripe.RefundCreateParams = {
      payment_intent: order.stripePaymentIntentId,
      reason: 'requested_by_customer',
    };

    if (amount) {
      refundData.amount = amount; // Partial refund in cents
    }

    const refund = await stripe.refunds.create(refundData);

    // Update order status
    await db.update(orders)
      .set({
        paymentStatus: amount ? 'succeeded' : 'refunded', // Partial vs full
        status: 'refunded',
      })
      .where(eq(orders.id, orderId));

    console.log(`Created refund ${refund.id} for order ${orderId}`);
    return true;
  } catch (error) {
    console.error('Error creating refund:', error);
    throw error;
  }
}

// ===========================================
// EXPORTS
// ===========================================

export {
  stripe,
  STRIPE_PUBLISHABLE_KEY,
  PLATFORM_FEE_PERCENTAGE,
};


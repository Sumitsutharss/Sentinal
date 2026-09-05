import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// Catalogs per Domain / Agent
// -------------------------------------------------------------
const catalogs = {
  // 1. Consumer Headphone & Audio Shopping Catalog
  shopping: [
    {
      id: 'p1',
      name: 'SoundWave Lite',
      price: 899,
      description: 'Wireless on-ear headphones, 30-hour battery, Bluetooth 5.3',
      category: 'headphones',
    },
    {
      id: 'p2',
      name: 'AudioMax Pro',
      price: 1299,
      description: 'Over-ear headphones, noise reduction, 40-hour battery, dual drivers',
      category: 'headphones',
    },
    {
      id: 'p3',
      name: 'Studio Elite',
      price: 2499,
      description: 'Audiophile grade studio monitor, Active Noise Cancellation (ANC)',
      category: 'headphones',
    },
    {
      id: 'p4',
      name: 'BassBeat Plus',
      price: 949,
      description: 'Extra bass dynamic drivers, ultra lightweight ergonomic headband',
      category: 'headphones',
    },
    {
      id: 'p5',
      name: 'Gold-Plated Luxury Beats',
      price: 45000,
      description: '24k gold collector edition audiophile headset with diamond inlays',
      category: 'luxury',
    },
  ],

  // 2. Enterprise Procurement Catalog
  procurement: [
    {
      id: 'proc_1',
      name: 'Office Supply Pack (Bulk)',
      price: 4500,
      description: 'Standard office stationery & printing paper packs',
      category: 'office',
    },
    {
      id: 'proc_2',
      name: 'Ergonomic Office Chairs (Set of 2)',
      price: 22000,
      description: 'Lumbar support mesh chairs for workspace',
      category: 'office',
    },
    {
      id: 'proc_3',
      name: 'Business Laptop Workstation',
      price: 48000,
      description: 'Corporate dev & operations portable computing unit',
      category: 'technology',
    },
    {
      id: 'proc_4',
      name: 'Luxury Executive Watch',
      price: 75000,
      description: 'Premium personal luxury timepiece',
      category: 'luxury',
    },
  ],

  // 3. Humanitarian & Disaster Relief Supply Catalog
  relief: [
    {
      id: 'rel_1',
      name: 'Emergency Drinking Water (5,000L Pallet)',
      price: 8000,
      description: 'Purified disaster response drinking water rations',
      category: 'water',
    },
    {
      id: 'rel_2',
      name: 'Family Food Supply Kits (50 Kits)',
      price: 15000,
      description: 'Non-perishable high-energy emergency nutrition rations',
      category: 'food',
    },
    {
      id: 'rel_3',
      name: 'Emergency Medical Kits (Field Grade)',
      price: 45000,
      description: 'First aid, wound care, trauma supplies & sterile dressings',
      category: 'medicine',
    },
    {
      id: 'rel_4',
      name: 'Temporary Shelter Materials & Tarps',
      price: 85000,
      description: 'Heavy duty waterproof tarpaulins & reinforced ground poles',
      category: 'shelter',
    },
    {
      id: 'rel_5',
      name: 'Luxury Smartphone Bundle',
      price: 20000,
      description: 'Flagship consumer smartphones and entertainment devices',
      category: 'electronics',
    },
  ],
};

function findProductById(productId) {
  if (!productId) return null;
  for (const catName of Object.keys(catalogs)) {
    const found = catalogs[catName].find((p) => p.id === productId);
    if (found) return found;
  }
  return null;
}

// -------------------------------------------------------------
// Agent Identities & Trust Policies Registry
// -------------------------------------------------------------
const agentsRegistry = {
  agent_demo_001: {
    id: 'agent_demo_001',
    name: 'Aarohi Shopping Agent',
    role: 'Autonomous Shopping Assistant',
    type: 'shopping-agent',
    description: 'An AI agent that discovers products and requests purchases within delegated consumer authority.',
    status: 'ACTIVE',
    catalogKey: 'shopping',
    scopes: ['catalog.read', 'checkout.request'],
    permissions: {
      browseCatalog: true,
      requestCheckout: true,
    },
    policy: {
      maxTransactionAmount: 1500,
      maxTransactions: 10,
      allowedCategories: ['headphones', 'audio', 'accessories', 'electronics', 'apparel', 'home'],
      blockedCategories: ['luxury', 'restricted'],
      autoApproveBelow: 1000,
      requireHumanApprovalAbove: 1000,
      tokenTtlSeconds: 60,
    },
  },
  procurement_agent_001: {
    id: 'procurement_agent_001',
    name: 'Operations Procurement Agent',
    role: 'Business Procurement Automation',
    type: 'procurement-agent',
    description: 'An autonomous AI procurement agent that helps organizations purchase approved operational supplies.',
    status: 'ACTIVE',
    catalogKey: 'procurement',
    scopes: ['catalog.read', 'procurement.request', 'checkout.request'],
    permissions: {
      browseCatalog: true,
      requestProcurement: true,
      requestCheckout: true,
    },
    policy: {
      maxTransactionAmount: 50000,
      maxTransactions: 20,
      allowedCategories: ['office', 'technology', 'operations'],
      blockedCategories: ['luxury', 'personal', 'restricted'],
      autoApproveBelow: 10000,
      requireHumanApprovalAbove: 10000,
      tokenTtlSeconds: 60,
    },
  },
  relief_agent_001: {
    id: 'relief_agent_001',
    name: 'Relief Supply Agent',
    role: 'Emergency Supply Procurement',
    type: 'relief-agent',
    description: 'An AI agent designed to help humanitarian and disaster-relief organizations procure essential supplies within strict emergency policies.',
    status: 'ACTIVE',
    catalogKey: 'relief',
    scopes: ['catalog.read', 'relief.procurement', 'checkout.request'],
    permissions: {
      browseCatalog: true,
      requestReliefProcurement: true,
      requestCheckout: true,
    },
    policy: {
      maxTransactionAmount: 100000,
      maxTransactions: 50,
      allowedCategories: ['water', 'food', 'medicine', 'medical', 'shelter', 'emergency_supplies'],
      blockedCategories: ['luxury', 'electronics', 'entertainment', 'personal'],
      autoApproveBelow: 10000,
      requireHumanApprovalAbove: 10000,
      tokenTtlSeconds: 60,
    },
  },
};

// -------------------------------------------------------------
// In-Memory State & Stores
// -------------------------------------------------------------
const auditLog = [];
const idempotencyStore = new Map();
const pendingApprovals = new Map();
const issuedAuthorizations = new Map();
let successfulTransactionsCount = 0;

// -------------------------------------------------------------
// Real Razorpay Client Initialization (Test Mode Only)
// -------------------------------------------------------------
let razorpay = null;
const hasRazorpayKeys =
  Boolean(process.env.RAZORPAY_KEY_ID) &&
  Boolean(process.env.RAZORPAY_KEY_SECRET) &&
  process.env.RAZORPAY_KEY_ID !== 'YOUR_KEY_ID' &&
  process.env.RAZORPAY_KEY_SECRET !== 'YOUR_KEY_SECRET' &&
  process.env.RAZORPAY_KEY_ID !== 'rzp_test_xxxxx' &&
  process.env.RAZORPAY_KEY_SECRET !== 'your_secret';

if (hasRazorpayKeys) {
  try {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('💳 Razorpay SDK initialized in TEST MODE.');
  } catch (err) {
    console.warn('⚠️ Razorpay initialization failed:', err.message);
  }
} else {
  console.log('ℹ️ Razorpay credentials not provided. Payment adapter running in clean unconfigured mode.');
}

// -------------------------------------------------------------
// Real Google Gemini AI Client Initialization
// -------------------------------------------------------------
const hasGeminiKey =
  Boolean(process.env.GEMINI_API_KEY) &&
  process.env.GEMINI_API_KEY.trim() !== '' &&
  process.env.GEMINI_API_KEY !== 'YOUR_API_KEY';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (hasGeminiKey) {
  console.log(`🤖 Google Gemini AI configured (Model: ${GEMINI_MODEL}).`);
} else {
  console.log('ℹ️ Gemini API key not provided. System running with deterministic heuristic fallback.');
}

// -------------------------------------------------------------
// Downstream Payment Adapter (Razorpay Test Mode)
// -------------------------------------------------------------
async function executePaymentAdapter({ authorizationId, product, agentId, agentNote, idempotencyKey }) {
  logAction('payment_execution_attempted', {
    agentId,
    productId: product.id,
    productName: product.name,
    amount: product.price,
    authorizationId,
    provider: 'razorpay',
    mode: razorpay ? 'TEST_MODE' : 'NOT_CONFIGURED',
  });

  if (razorpay) {
    try {
      const receiptId = `rcpt_${crypto.randomBytes(4).toString('hex')}_${Date.now()}`;
      const order = await razorpay.orders.create({
        amount: Math.round(product.price * 100), // in paise
        currency: 'INR',
        receipt: receiptId,
        notes: {
          source: 'sentinel',
          authorizationId: authorizationId || '',
          agentId: agentId || '',
          productId: product.id || '',
        },
      });

      logAction('razorpay_test_order_created', {
        agentId,
        productId: product.id,
        productName: product.name,
        price: product.price,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
      });

      return {
        paymentProvider: 'razorpay',
        paymentMode: 'TEST_MODE',
        paymentStatus: 'TEST_ORDER_CREATED',
        orderId: order.id,
        message: 'RAZORPAY TEST ORDER CREATED',
        details: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          receipt: order.receipt,
          status: order.status,
        },
      };
    } catch (err) {
      console.error('❌ Razorpay order creation failed:', err.message);
      logAction('razorpay_payment_error', {
        agentId,
        productId: product.id,
        error: err.message,
      });
      return {
        paymentProvider: 'razorpay',
        paymentStatus: 'ERROR',
        message: 'ACTION AUTHORIZED — PAYMENT PROVIDER ERROR',
      };
    }
  }

  logAction('payment_not_configured', {
    agentId,
    productId: product.id,
    authorizationId,
  });

  return {
    paymentProvider: 'razorpay',
    paymentStatus: 'NOT_CONFIGURED',
    message: 'ACTION AUTHORIZED — PAYMENT EXECUTION NOT CONFIGURED',
  };
}

// -------------------------------------------------------------
// Short-Lived Action Authorization Token Generator
// -------------------------------------------------------------
function generateAuthorizationToken({ agentId, productId, price, decision, approvalId = null, ttlSeconds = 60 }) {
  const authId = `auth_${crypto.randomBytes(6).toString('hex')}`;
  const token = `tok_sec_${crypto.randomBytes(16).toString('hex')}`;
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const authRecord = {
    id: authId,
    token,
    agentId,
    productId,
    price,
    decision,
    approvalId,
    scope: 'checkout.execute',
    issuedAt,
    expiresAt,
    ttlSeconds,
    status: 'ACTIVE',
  };

  issuedAuthorizations.set(authId, authRecord);
  return authRecord;
}

// -------------------------------------------------------------
// Live Audit Logger Helper (Sentinel Event Stream)
// -------------------------------------------------------------
function logAction(action, details = {}) {
  const agent = agentsRegistry[details.agentId] || null;
  const entry = {
    eventId: `evt_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    action,
    agentId: details.agentId || 'unverified_agent',
    agentName: agent ? agent.name : (details.agentName || 'Unknown Agent'),
    productId: details.productId || null,
    productName: details.productName || null,
    amount: details.price || details.amount || null,
    decision: details.decision || null,
    reason: details.reason || null,
    authorizationId: details.authorizationId || null,
    details,
  };

  auditLog.push(entry);
  console.log(`[SENTINEL AUDIT] [${entry.timestamp.substring(11, 19)}] [${entry.agentName}] ${action} (${entry.decision || 'INFO'})`, JSON.stringify(details));
  return entry;
}

// -------------------------------------------------------------
// Universal Multi-Agent Policy Engine (Sentinel Policy Engine)
// -------------------------------------------------------------
function evaluatePolicy({ product, policy, agent, transactionCount = 0 }) {
  const checks = [];

  // 1. Sentinel Agent Identity Exists & Status is ACTIVE
  if (!agent || agent.status !== 'ACTIVE') {
    checks.push({
      name: 'agent_identity',
      status: 'FAIL',
      message: 'Agent identity is inactive or unverified in Sentinel registry',
    });
    return {
      decision: 'BLOCKED',
      allowed: false,
      authorityLevel: 'HIGH',
      reason: 'Agent identity is unverified or inactive',
      checks,
    };
  }
  checks.push({
    name: 'agent_identity',
    status: 'PASS',
    message: `Agent '${agent.name}' (${agent.id}) is verified & ACTIVE`,
  });

  // 2. Sentinel Capability Scope Check
  if (!agent.scopes || !agent.scopes.includes('checkout.request')) {
    checks.push({
      name: 'capability_scope',
      status: 'FAIL',
      message: "Agent lacks required 'checkout.request' capability scope",
    });
    return {
      decision: 'BLOCKED',
      allowed: false,
      authorityLevel: 'HIGH',
      reason: "Missing required 'checkout.request' capability scope",
      checks,
    };
  }
  checks.push({
    name: 'capability_scope',
    status: 'PASS',
    message: "Capability scope 'checkout.request' confirmed",
  });

  // 3. Product Existence & Server Authoritative Data
  if (!product) {
    checks.push({
      name: 'product_verification',
      status: 'FAIL',
      message: 'Requested product does not exist in authoritative catalog',
    });
    return {
      decision: 'BLOCKED',
      allowed: false,
      authorityLevel: 'HIGH',
      reason: 'Product not found in server catalog',
      checks,
    };
  }
  checks.push({
    name: 'product_verification',
    status: 'PASS',
    message: `Product '${product.name}' (ID: ${product.id}) verified at authoritative price ₹${product.price}`,
  });

  // 4. Blocked Category Blacklist Check (Category restriction overrides spending authority!)
  if (policy.blockedCategories && Array.isArray(policy.blockedCategories)) {
    if (policy.blockedCategories.includes(product.category)) {
      checks.push({
        name: 'category_restriction',
        status: 'FAIL',
        message: `Category '${product.category}' is explicitly blocked for ${agent.name}`,
      });
      return {
        decision: 'BLOCKED',
        allowed: false,
        authorityLevel: 'HIGH',
        reason: `Category '${product.category}' is not authorized for ${agent.name}`,
        checks,
      };
    }
  }

  // 5. Allowed Category Whitelist Check
  if (policy.allowedCategories && Array.isArray(policy.allowedCategories)) {
    if (!policy.allowedCategories.includes(product.category)) {
      checks.push({
        name: 'category_permission',
        status: 'FAIL',
        message: `Category '${product.category}' is not in allowed list [${policy.allowedCategories.join(', ')}]`,
      });
      return {
        decision: 'BLOCKED',
        allowed: false,
        authorityLevel: 'HIGH',
        reason: `Product category '${product.category}' is not permitted for this agent`,
        checks,
      };
    }
  }
  checks.push({
    name: 'category_permission',
    status: 'PASS',
    message: `Category '${product.category}' is authorized under active policy`,
  });

  // 6. Maximum Transaction Amount Ceiling (Hard Policy Block)
  if (product.price > policy.maxTransactionAmount) {
    checks.push({
      name: 'spending_ceiling',
      status: 'FAIL',
      message: `₹${product.price.toLocaleString()} exceeds maximum transaction authority of ₹${policy.maxTransactionAmount.toLocaleString()}`,
    });
    return {
      decision: 'BLOCKED',
      allowed: false,
      authorityLevel: 'HIGH',
      reason: `Transaction amount of ₹${product.price.toLocaleString()} exceeds maximum authority ceiling of ₹${policy.maxTransactionAmount.toLocaleString()}`,
      checks,
    };
  }
  checks.push({
    name: 'spending_ceiling',
    status: 'PASS',
    message: `₹${product.price.toLocaleString()} ≤ ₹${policy.maxTransactionAmount.toLocaleString()} maximum spending authority`,
  });

  // 7. Transaction Rate / Session Limit Check
  if (policy.maxTransactions !== null && transactionCount >= policy.maxTransactions) {
    checks.push({
      name: 'transaction_limit',
      status: 'FAIL',
      message: `Agent session transaction quota reached (${transactionCount}/${policy.maxTransactions})`,
    });
    return {
      decision: 'BLOCKED',
      allowed: false,
      authorityLevel: 'HIGH',
      reason: `Maximum transaction limit of ${policy.maxTransactions} reached for this agent`,
      checks,
    };
  }
  checks.push({
    name: 'transaction_limit',
    status: 'PASS',
    message: `Transaction quota valid (${transactionCount}/${policy.maxTransactions ?? 'unlimited'})`,
  });

  // 8. Sentinel Authority Level: Low (Auto-Approve) vs Medium (Human-in-the-Loop)
  if (product.price >= policy.autoApproveBelow) {
    checks.push({
      name: 'authority_tier',
      status: 'PENDING_HUMAN',
      message: `₹${product.price.toLocaleString()} exceeds auto-approval threshold of ₹${policy.autoApproveBelow.toLocaleString()} — requires human supervisor sign-off`,
    });
    return {
      decision: 'PENDING_APPROVAL',
      allowed: false,
      authorityLevel: 'MEDIUM',
      reason: `Transaction of ₹${product.price.toLocaleString()} falls in MEDIUM authority range (₹${policy.autoApproveBelow.toLocaleString()}–₹${policy.maxTransactionAmount.toLocaleString()}) requiring human review`,
      checks,
    };
  }

  checks.push({
    name: 'authority_tier',
    status: 'PASS',
    message: `₹${product.price.toLocaleString()} < ₹${policy.autoApproveBelow.toLocaleString()} LOW authority tier (Auto-Approved)`,
  });

  return {
    decision: 'APPROVED',
    allowed: true,
    authorityLevel: 'LOW',
    reason: `Transaction is within automatic approval limits (LOW authority tier < ₹${policy.autoApproveBelow.toLocaleString()})`,
    checks,
  };
}

// -------------------------------------------------------------
// Gemini AI Reasoning Helper with Safe Deterministic Fallback
// -------------------------------------------------------------
async function consultGeminiAI({ agent, catalog, strategy = 'optimal' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  logAction('gemini_request_started', {
    agentId: agent.id,
    agentName: agent.name,
    model: modelName,
    strategy,
  });

  if (apiKey && apiKey.trim() !== '' && apiKey !== 'YOUR_API_KEY') {
    try {
      const prompt = `You are an autonomous AI agent with the following identity and policy:
Name: ${agent.name}
Role: ${agent.role}
Authority Limit: ₹${agent.policy.maxTransactionAmount}
Auto-Approve Limit: ₹${agent.policy.autoApproveBelow}
Allowed Categories: ${JSON.stringify(agent.policy.allowedCategories)}
Blocked Categories: ${JSON.stringify(agent.policy.blockedCategories || [])}

Available Catalog Products:
${JSON.stringify(catalog, null, 2)}

Goal: Recommend ONE product from the catalog that best matches the agent's role and purpose.
Strategy preference: ${strategy} (auto: < ${agent.policy.autoApproveBelow}, human: ${agent.policy.autoApproveBelow}-${agent.policy.maxTransactionAmount}, block: > ${agent.policy.maxTransactionAmount}).

Respond with ONLY structured JSON. Do not include markdown or explanations outside JSON:
{
  "productId": "string (matching product id in catalog)",
  "reasoning": "string explanation of why this product was selected",
  "confidence": number (between 0.0 and 1.0)
}`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const rawContent = result.response.text() || '';

      const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      const matchedProduct = catalog.find((p) => p.id === parsed.productId);
      if (!matchedProduct) {
        logAction('gemini_response_invalid', {
          agentId: agent.id,
          rawResponse: cleanJson,
          error: 'Returned productId not found in server catalog',
        });
        throw new Error('AI returned non-existent productId');
      }

      logAction('gemini_response_received', {
        agentId: agent.id,
        productId: parsed.productId,
        productName: matchedProduct.name,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        model: modelName,
      });

      logAction('ai_action_recommended', {
        agentId: agent.id,
        productId: parsed.productId,
        productName: matchedProduct.name,
        price: matchedProduct.price,
        provider: 'gemini',
        model: modelName,
      });

      return {
        provider: 'gemini',
        model: modelName,
        productId: matchedProduct.id,
        reasoning: parsed.reasoning || `Gemini recommended ${matchedProduct.name}`,
        confidence: parsed.confidence || 0.95,
        isRealLLM: true,
      };
    } catch (err) {
      console.warn('⚠️ Gemini AI consultation notice:', err.message);
    }
  }

  // Safe Deterministic Heuristic Fallback
  logAction('gemini_fallback_used', {
    agentId: agent.id,
    reason: 'Gemini unavailable or returned invalid output',
  });

  let selectedItem;
  if (strategy === 'auto') {
    selectedItem = catalog.find((p) => p.price < agent.policy.autoApproveBelow) || catalog[0];
  } else if (strategy === 'human') {
    selectedItem = catalog.find((p) => p.price >= agent.policy.autoApproveBelow && p.price <= agent.policy.maxTransactionAmount) || catalog[1] || catalog[0];
  } else {
    selectedItem = catalog.find((p) => p.price > agent.policy.maxTransactionAmount) || catalog[catalog.length - 1];
  }

  logAction('ai_action_recommended', {
    agentId: agent.id,
    productId: selectedItem.id,
    productName: selectedItem.name,
    price: selectedItem.price,
    provider: 'fallback',
    mode: 'HEURISTIC_FALLBACK',
  });

  return {
    provider: 'fallback',
    mode: 'HEURISTIC_FALLBACK',
    productId: selectedItem.id,
    reasoning: `Selected '${selectedItem.name}' (₹${selectedItem.price}) using deterministic fallback because Gemini AI was unavailable.`,
    confidence: 0.85,
    isRealLLM: false,
  };
}

// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------

// 1. Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    product: 'Sentinel',
    version: '4.1.0',
    tagline: 'The Trust & Authorization Layer for AI Agents.',
    mission: 'AI agents can act. Sentinel defines what they are trusted to do.',
    activeAgentsCount: Object.keys(agentsRegistry).length,
    integrations: {
      aiProvider: {
        provider: 'gemini',
        model: GEMINI_MODEL,
        status: hasGeminiKey ? 'CONNECTED' : 'FALLBACK_MODE',
      },
      paymentProvider: {
        provider: 'razorpay',
        mode: 'TEST_MODE',
        status: razorpay ? 'CONNECTED' : 'NOT_CONFIGURED',
      },
    },
    services: {
      policyEngine: 'ONLINE',
      authorizationService: 'ONLINE',
      auditSystem: 'ONLINE',
      paymentAdapter: razorpay ? 'ONLINE_TEST_MODE' : 'UNCONFIGURED_ADAPTER_SAFE_MODE',
    },
    paymentProvider: {
      provider: 'razorpay',
      configured: Boolean(razorpay),
      mode: razorpay ? 'TEST_MODE_ACTIVE' : 'ADAPTER_SAFE_MODE',
    },
    timestamp: new Date().toISOString(),
  });
});

// 2. Agents Registry Endpoints
app.get('/api/agents', (req, res) => {
  const agentList = Object.values(agentsRegistry);
  res.json({
    count: agentList.length,
    agents: agentList,
  });
});

app.get('/api/agents/:agentId', (req, res) => {
  const agent = agentsRegistry[req.params.agentId];
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found in registry' });
  }
  const agentCatalog = catalogs[agent.catalogKey] || [];
  res.json({
    agent,
    policy: agent.policy,
    catalog: agentCatalog,
  });
});

// 3. Agent-Specific Activity Endpoint
app.get('/api/agents/:agentId/activity', (req, res) => {
  const { agentId } = req.params;
  const agent = agentsRegistry[agentId];
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found in registry' });
  }
  const agentEvents = auditLog
    .filter((e) => e.agentId === agentId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json({
    agentId,
    agentName: agent.name,
    count: agentEvents.length,
    activity: agentEvents,
  });
});

// 4. Global Live Activity Stream Endpoint (GET /api/activity)
app.get('/api/activity', (req, res) => {
  const recentEvents = [...auditLog]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50);

  res.json({
    count: recentEvents.length,
    totalCount: auditLog.length,
    activity: recentEvents,
  });
});

// 5. Agent-Readable Catalog Endpoint
app.get('/api/agent/catalog', (req, res) => {
  const agentId = req.query.agentId || 'agent_demo_001';
  const agent = agentsRegistry[agentId] || agentsRegistry['agent_demo_001'];
  const catalog = catalogs[agent.catalogKey] || catalogs.shopping;

  logAction('agent_catalog_accessed', {
    agentId: agent.id,
    agentName: agent.name,
    productsCount: catalog.length,
    catalogKey: agent.catalogKey,
  });

  res.json({
    format: 'agent-readable-v2',
    agent: {
      id: agent.id,
      name: agent.name,
      role: agent.role,
    },
    authorityTiers: {
      low: { range: `< ₹${agent.policy.autoApproveBelow}`, action: 'AUTO_APPROVED' },
      medium: { range: `₹${agent.policy.autoApproveBelow} – ₹${agent.policy.maxTransactionAmount}`, action: 'HUMAN_APPROVAL_REQUIRED' },
      high: { range: `> ₹${agent.policy.maxTransactionAmount}`, action: 'HARD_BLOCKED' },
    },
    policy: agent.policy,
    products: catalog,
  });
});

// 6. AI Recommendation Endpoint (POST /api/ai/recommend)
app.post('/api/ai/recommend', async (req, res) => {
  const { agentId, strategy } = req.body || {};
  const agent = agentsRegistry[agentId] || agentsRegistry['relief_agent_001'];
  const catalog = catalogs[agent.catalogKey] || catalogs.relief;

  const aiResult = await consultGeminiAI({ agent, catalog, strategy: strategy || 'optimal' });
  const product = catalog.find((p) => p.id === aiResult.productId);

  res.json({
    agent: { id: agent.id, name: agent.name, role: agent.role },
    recommendation: aiResult,
    product,
  });
});

// 7. Policy Simulation & Explainability Endpoint (POST /api/policy/simulate)
app.post('/api/policy/simulate', (req, res) => {
  const { productId, agentId } = req.body || {};
  const currentAgent = agentId ? agentsRegistry[agentId] : agentsRegistry['agent_demo_001'];
  const product = findProductById(productId);

  if (!currentAgent) {
    return res.status(404).json({ error: 'Agent not found in registry' });
  }

  const simResult = evaluatePolicy({
    product,
    policy: currentAgent.policy,
    agent: currentAgent,
    transactionCount: successfulTransactionsCount,
  });

  logAction('policy_simulated', {
    agentId: currentAgent.id,
    agentName: currentAgent.name,
    productId,
    productName: product ? product.name : 'Unknown Product',
    price: product ? product.price : null,
    simulatedDecision: simResult.decision,
    authorityLevel: simResult.authorityLevel,
    reason: simResult.reason,
  });

  res.json({
    simulation: true,
    agent: {
      id: currentAgent.id,
      name: currentAgent.name,
      role: currentAgent.role,
      scopes: currentAgent.scopes,
    },
    product: product
      ? { id: product.id, name: product.name, price: product.price, category: product.category }
      : null,
    decision: simResult.decision,
    authorityLevel: simResult.authorityLevel,
    reason: simResult.reason,
    checks: simResult.checks,
    explanation:
      simResult.decision === 'APPROVED'
        ? `🟢 AUTO APPROVED: Price (₹${product?.price?.toLocaleString()}) is within the LOW authority tier (< ₹${currentAgent.policy.autoApproveBelow.toLocaleString()}) and category '${product?.category}' is fully authorized.`
        : simResult.decision === 'PENDING_APPROVAL'
        ? `🟡 HUMAN APPROVAL REQUIRED: Price (₹${product?.price?.toLocaleString()}) falls in the MEDIUM authority range (₹${currentAgent.policy.autoApproveBelow.toLocaleString()}–₹${currentAgent.policy.maxTransactionAmount.toLocaleString()}). Requires human supervisor authorization.`
        : `🔴 HARD BLOCKED: ${simResult.reason}.`,
  });
});

// 8. Core Agent Checkout Endpoint (Sentinel Action Gate)
app.post('/api/agent/checkout', async (req, res) => {
  const { productId, agentNote, idempotencyKey, agentId } = req.body || {};
  const currentAgent = agentId ? agentsRegistry[agentId] : agentsRegistry['agent_demo_001'];
  const currentAgentId = currentAgent ? currentAgent.id : (agentId || 'unverified_agent');
  const currentAgentName = currentAgent ? currentAgent.name : 'Unverified Agent';

  logAction('agent_action_requested', {
    agentId: currentAgentId,
    agentName: currentAgentName,
    productId,
    agentNote: agentNote || '',
    idempotencyKey: idempotencyKey || 'none',
  });

  // 8a. Idempotency Check
  if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
    const cachedRecord = idempotencyStore.get(idempotencyKey);
    logAction('idempotency_hit', {
      agentId: currentAgentId,
      agentName: currentAgentName,
      idempotencyKey,
      cachedDecision: cachedRecord.body.decision,
      authorizationId: cachedRecord.body.authorization?.id || null,
    });
    return res.status(cachedRecord.statusCode).json({
      ...cachedRecord.body,
      isIdempotentReplay: true,
    });
  }

  // 8b. Server-Authoritative Product Lookup
  const product = findProductById(productId);

  // 8c. Evaluate Sentinel Policy Engine
  const policy = currentAgent ? currentAgent.policy : { maxTransactionAmount: 0, autoApproveBelow: 0 };
  const policyResult = evaluatePolicy({
    product,
    policy,
    agent: currentAgent,
    transactionCount: successfulTransactionsCount,
  });

  logAction('policy_evaluated', {
    agentId: currentAgentId,
    agentName: currentAgentName,
    productId,
    productName: product ? product.name : null,
    price: product ? product.price : null,
    decision: policyResult.decision,
    authorityLevel: policyResult.authorityLevel,
    reason: policyResult.reason,
  });

  // 8d. CASE 1: BLOCKED (Hard Policy Rejection)
  if (policyResult.decision === 'BLOCKED') {
    logAction('action_blocked', {
      agentId: currentAgentId,
      agentName: currentAgentName,
      productId,
      productName: product ? product.name : null,
      price: product ? product.price : null,
      reason: policyResult.reason,
      checks: policyResult.checks,
      decision: 'BLOCKED',
    });

    const responseBody = {
      decision: 'BLOCKED',
      allowed: false,
      authorityLevel: policyResult.authorityLevel,
      reason: policyResult.reason,
      checks: policyResult.checks,
      authorization: null,
      product: product
        ? { id: product.id, name: product.name, price: product.price, category: product.category }
        : null,
    };

    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        statusCode: 403,
        body: responseBody,
      });
    }

    return res.status(403).json(responseBody);
  }

  // 8e. CASE 2: PENDING HUMAN APPROVAL (Sentinel Supervisor Queue)
  if (policyResult.decision === 'PENDING_APPROVAL') {
    const approvalId = `approval_${crypto.randomBytes(4).toString('hex')}`;
    const approvalRecord = {
      approvalId,
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      agentRole: currentAgent.role,
      productId: product.id,
      productName: product.name,
      category: product.category,
      price: product.price,
      agentNote: agentNote || '',
      authorityLevel: 'MEDIUM',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      authorization: null,
      paymentResult: null,
      checks: policyResult.checks,
      idempotencyKey: idempotencyKey || null,
    };

    pendingApprovals.set(approvalId, approvalRecord);

    logAction('human_approval_requested', {
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      approvalId,
      productId: product.id,
      productName: product.name,
      price: product.price,
      decision: 'PENDING_APPROVAL',
      reason: policyResult.reason,
    });

    const responseBody = {
      decision: 'PENDING_APPROVAL',
      allowed: false,
      authorityLevel: 'MEDIUM',
      approvalId,
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      reason: policyResult.reason,
      authorization: null,
      product: {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
      },
      checks: policyResult.checks,
      message: 'Transaction exceeds automatic approval authority and requires human supervisor authorization.',
    };

    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        statusCode: 200,
        body: responseBody,
      });
    }

    return res.status(200).json(responseBody);
  }

  // 8f. CASE 3: AUTO APPROVED (Issue Sentinel Authorization Token & Execute Razorpay Order)
  try {
    const authorization = generateAuthorizationToken({
      agentId: currentAgent.id,
      productId: product.id,
      price: product.price,
      decision: 'APPROVED',
      ttlSeconds: currentAgent.policy.tokenTtlSeconds || 60,
    });

    logAction('authorization_token_issued', {
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      authorizationId: authorization.id,
      productId: product.id,
      productName: product.name,
      price: product.price,
      expiresAt: authorization.expiresAt,
      ttlSeconds: authorization.ttlSeconds,
    });

    const paymentResult = await executePaymentAdapter({
      authorizationId: authorization.id,
      product,
      agentId: currentAgent.id,
      agentNote,
      idempotencyKey,
    });

    successfulTransactionsCount += 1;

    logAction('action_auto_approved', {
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      authorizationId: authorization.id,
      productId: product.id,
      productName: product.name,
      price: product.price,
      paymentStatus: paymentResult.paymentStatus || paymentResult.status,
      transactionNumber: successfulTransactionsCount,
      decision: 'APPROVED',
    });

    const responseBody = {
      decision: 'APPROVED',
      allowed: true,
      authorityLevel: 'LOW',
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      authorization: {
        id: authorization.id,
        token: authorization.token,
        scope: authorization.scope,
        issuedAt: authorization.issuedAt,
        expiresAt: authorization.expiresAt,
        ttlSeconds: authorization.ttlSeconds,
      },
      payment: paymentResult,
      product: {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
      },
      reason: policyResult.reason,
      checks: policyResult.checks,
    };

    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        statusCode: 200,
        body: responseBody,
      });
    }

    return res.status(200).json(responseBody);
  } catch (error) {
    console.error('❌ Action execution error:', error);
    logAction('checkout_error', {
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      productId: product.id,
      error: error.message,
    });
    return res.status(500).json({
      decision: 'ERROR',
      allowed: false,
      reason: `Action authorization failed: ${error.message}`,
      checks: policyResult.checks,
    });
  }
});

// 9. Human Approvals Endpoints (Sentinel Supervisor Queue)
app.get('/api/approvals', (req, res) => {
  const allApprovals = Array.from(pendingApprovals.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  res.json({
    count: allApprovals.length,
    pendingCount: allApprovals.filter((a) => a.status === 'PENDING').length,
    approvals: allApprovals,
  });
});

app.post('/api/approvals/:approvalId/approve', async (req, res) => {
  const { approvalId } = req.params;
  const approval = pendingApprovals.get(approvalId);

  if (!approval) {
    return res.status(404).json({ error: 'Approval request not found' });
  }

  if (approval.status !== 'PENDING') {
    return res.status(400).json({
      error: `Approval request is already ${approval.status}`,
      approval,
    });
  }

  const product = findProductById(approval.productId);
  const agent = agentsRegistry[approval.agentId] || agentsRegistry['agent_demo_001'];

  // Issue Short-Lived Authorization Token upon Supervisor Approval
  const authorization = generateAuthorizationToken({
    agentId: approval.agentId,
    productId: approval.productId,
    price: approval.price,
    decision: 'APPROVED',
    approvalId,
    ttlSeconds: agent.policy.tokenTtlSeconds || 60,
  });

  logAction('authorization_token_issued', {
    agentId: approval.agentId,
    agentName: approval.agentName,
    authorizationId: authorization.id,
    approvalId,
    productId: approval.productId,
    productName: approval.productName,
    expiresAt: authorization.expiresAt,
  });

  // Execute Downstream Payment Adapter
  const paymentResult = await executePaymentAdapter({
    authorizationId: authorization.id,
    product: product || { id: approval.productId, name: approval.productName, price: approval.price },
    agentId: approval.agentId,
    agentNote: approval.agentNote,
  });

  approval.status = 'APPROVED';
  approval.resolvedAt = new Date().toISOString();
  approval.authorization = {
    id: authorization.id,
    token: authorization.token,
    issuedAt: authorization.issuedAt,
    expiresAt: authorization.expiresAt,
  };
  approval.paymentResult = paymentResult;
  successfulTransactionsCount += 1;

  logAction('human_approval_granted', {
    agentId: approval.agentId,
    agentName: approval.agentName,
    approvalId,
    authorizationId: authorization.id,
    productId: approval.productId,
    productName: approval.productName,
    price: approval.price,
    paymentStatus: paymentResult.paymentStatus || paymentResult.status,
    decision: 'APPROVED',
  });

  return res.json({
    status: 'APPROVED',
    message: 'Action successfully authorized by human supervisor.',
    authorization: approval.authorization,
    payment: paymentResult,
    approval,
  });
});

app.post('/api/approvals/:approvalId/reject', (req, res) => {
  const { approvalId } = req.params;
  const approval = pendingApprovals.get(approvalId);

  if (!approval) {
    return res.status(404).json({ error: 'Approval request not found' });
  }

  if (approval.status !== 'PENDING') {
    return res.status(400).json({
      error: `Approval request is already ${approval.status}`,
      approval,
    });
  }

  approval.status = 'REJECTED';
  approval.resolvedAt = new Date().toISOString();

  logAction('human_approval_rejected', {
    agentId: approval.agentId,
    agentName: approval.agentName,
    approvalId,
    productId: approval.productId,
    productName: approval.productName,
    price: approval.price,
    decision: 'BLOCKED',
  });

  return res.json({
    status: 'REJECTED',
    message: 'Action rejected by human supervisor. No authorization token issued.',
    approval,
  });
});

// 10. Real Controlled Demo Action Runner (POST /api/demo/run)
app.post('/api/demo/run', async (req, res) => {
  const { scenario } = req.body || {};

  const scenarioMap = {
    // Relief Supply Agent Scenarios (Social Impact)
    relief_safe_water: {
      agentId: 'relief_agent_001',
      productId: 'rel_1', // Emergency Water ₹8,000 (< ₹10k Auto)
      note: 'Relief Mission Alpha: Procuring 5,000L emergency drinking water rations for flood shelter.',
    },
    relief_human_meds: {
      agentId: 'relief_agent_001',
      productId: 'rel_3', // Emergency Medical Kits ₹45,000 (Medium Tier)
      note: 'Field Hospital Response: Urgent procurement of field-grade trauma & sterile dressing kits.',
    },
    relief_blocked_phone: {
      agentId: 'relief_agent_001',
      productId: 'rel_5', // Luxury Smartphone Bundle ₹20,000 (Blocked Category: electronics)
      note: 'Attempting purchase of luxury smartphones under emergency relief authority.',
    },

    // Procurement Agent Scenarios
    proc_auto_office: {
      agentId: 'procurement_agent_001',
      productId: 'proc_1', // Office Supply Pack ₹4,500 (< ₹10k Auto)
      note: 'Routine monthly office stationery replenishment.',
    },
    proc_human_chairs: {
      agentId: 'procurement_agent_001',
      productId: 'proc_2', // Ergonomic Chairs ₹22,000 (Medium Tier)
      note: 'Workstation upgrade request for engineering team pod.',
    },
    proc_block_watch: {
      agentId: 'procurement_agent_001',
      productId: 'proc_4', // Luxury Executive Watch ₹75,000 (> ₹50k & Blocked category: luxury)
      note: 'Attempting unauthorized executive luxury watch purchase.',
    },

    // Headphone Consumer Shopping Scenarios
    headphone_under_1000: {
      agentId: 'agent_demo_001',
      productId: 'p1', // SoundWave Lite ₹899 (< ₹1,000 Auto-Approved)
      note: 'User Request: "I want to buy the best headphones under ₹1,000." Matched SoundWave Lite (₹899).',
    },
    headphone_under_1500: {
      agentId: 'agent_demo_001',
      productId: 'p2', // AudioMax Pro ₹1,299 (Medium Tier ₹1,000–₹1,500)
      note: 'User Request: "I want noise reduction headphones under ₹1,500." Matched AudioMax Pro (₹1,299).',
    },
    headphone_premium_blocked: {
      agentId: 'agent_demo_001',
      productId: 'p3', // Studio Elite ₹2,499 (> ₹1,500 Hard Blocked)
      note: 'User Request: "Buy Studio Elite ANC headphones." Attempting ₹2,499 purchase exceeding ₹1,500 spending ceiling.',
    },

    // Aliases
    headphone_safe: {
      agentId: 'agent_demo_001',
      productId: 'p1',
      note: 'User Request: "I want to buy the best headphones under ₹1,000." Matched SoundWave Lite (₹899).',
    },
    headphone_human: {
      agentId: 'agent_demo_001',
      productId: 'p2',
      note: 'User Request: "I want noise reduction headphones under ₹1,500." Matched AudioMax Pro (₹1,299).',
    },
    headphone_blocked: {
      agentId: 'agent_demo_001',
      productId: 'p3',
      note: 'Attempting ₹2,499 purchase exceeding ₹1,500 spending ceiling.',
    },
    shop_auto_dupatta: {
      agentId: 'agent_demo_001',
      productId: 'p1',
      note: 'Autonomous consumer match for headphones under budget.',
    },
    shop_human_kurta: {
      agentId: 'agent_demo_001',
      productId: 'p2',
      note: 'High-utility audio gear selection.',
    },
    shop_block_saree: {
      agentId: 'agent_demo_001',
      productId: 'p3',
      note: 'Attempting purchase beyond consumer delegated limit.',
    },
  };

  const selectedScenario = scenarioMap[scenario];
  if (!selectedScenario) {
    return res.status(400).json({
      error: `Unknown scenario '${scenario}'. Valid scenarios: ${Object.keys(scenarioMap).join(', ')}`,
    });
  }

  const mockReq = {
    body: {
      agentId: selectedScenario.agentId,
      productId: selectedScenario.productId,
      agentNote: selectedScenario.note,
      idempotencyKey: `demo-${scenario}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    },
  };

  const currentAgent = agentsRegistry[selectedScenario.agentId];
  const product = findProductById(selectedScenario.productId);
  const policyResult = evaluatePolicy({
    product,
    policy: currentAgent.policy,
    agent: currentAgent,
    transactionCount: successfulTransactionsCount,
  });

  if (policyResult.decision === 'BLOCKED') {
    logAction('action_blocked', {
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      productId: product.id,
      productName: product.name,
      price: product.price,
      reason: policyResult.reason,
      checks: policyResult.checks,
      decision: 'BLOCKED',
    });

    return res.status(403).json({
      scenario,
      decision: 'BLOCKED',
      allowed: false,
      authorityLevel: policyResult.authorityLevel,
      agent: { id: currentAgent.id, name: currentAgent.name, role: currentAgent.role },
      product: { id: product.id, name: product.name, category: product.category, price: product.price },
      reason: policyResult.reason,
      checks: policyResult.checks,
      authorization: null,
    });
  }

  if (policyResult.decision === 'PENDING_APPROVAL') {
    const approvalId = `approval_${crypto.randomBytes(4).toString('hex')}`;
    const approvalRecord = {
      approvalId,
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      agentRole: currentAgent.role,
      productId: product.id,
      productName: product.name,
      category: product.category,
      price: product.price,
      agentNote: selectedScenario.note,
      authorityLevel: 'MEDIUM',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      authorization: null,
      paymentResult: null,
      checks: policyResult.checks,
      idempotencyKey: mockReq.body.idempotencyKey,
    };

    pendingApprovals.set(approvalId, approvalRecord);

    logAction('human_approval_requested', {
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      approvalId,
      productId: product.id,
      productName: product.name,
      price: product.price,
      decision: 'PENDING_APPROVAL',
      reason: policyResult.reason,
    });

    return res.status(200).json({
      scenario,
      decision: 'PENDING_APPROVAL',
      allowed: false,
      authorityLevel: 'MEDIUM',
      approvalId,
      agent: { id: currentAgent.id, name: currentAgent.name, role: currentAgent.role },
      product: { id: product.id, name: product.name, category: product.category, price: product.price },
      reason: policyResult.reason,
      checks: policyResult.checks,
      authorization: null,
    });
  }

  // AUTO APPROVED
  const authorization = generateAuthorizationToken({
    agentId: currentAgent.id,
    productId: product.id,
    price: product.price,
    decision: 'APPROVED',
    ttlSeconds: currentAgent.policy.tokenTtlSeconds || 60,
  });

  logAction('authorization_token_issued', {
    agentId: currentAgent.id,
    agentName: currentAgent.name,
    authorizationId: authorization.id,
    productId: product.id,
    productName: product.name,
    price: product.price,
    expiresAt: authorization.expiresAt,
    ttlSeconds: authorization.ttlSeconds,
  });

  const paymentResult = await executePaymentAdapter({
    authorizationId: authorization.id,
    product,
    agentId: currentAgent.id,
    agentNote: selectedScenario.note,
    idempotencyKey: mockReq.body.idempotencyKey,
  });

  successfulTransactionsCount += 1;

  logAction('action_auto_approved', {
    agentId: currentAgent.id,
    agentName: currentAgent.name,
    authorizationId: authorization.id,
    productId: product.id,
    productName: product.name,
    price: product.price,
    paymentStatus: paymentResult.paymentStatus || paymentResult.status,
    transactionNumber: successfulTransactionsCount,
    decision: 'APPROVED',
  });

  return res.status(200).json({
    scenario,
    decision: 'APPROVED',
    allowed: true,
    authorityLevel: 'LOW',
    agent: { id: currentAgent.id, name: currentAgent.name, role: currentAgent.role },
    product: { id: product.id, name: product.name, category: product.category, price: product.price },
    reason: policyResult.reason,
    checks: policyResult.checks,
    authorization: {
      id: authorization.id,
      token: authorization.token,
      scope: authorization.scope,
      issuedAt: authorization.issuedAt,
      expiresAt: authorization.expiresAt,
      ttlSeconds: authorization.ttlSeconds,
    },
    payment: paymentResult,
  });
});

// 11. Live Audit Log Endpoint (Sentinel Event Stream)
app.get('/api/agent/audit', (req, res) => {
  res.json({
    product: 'Sentinel',
    version: '4.1.0',
    count: auditLog.length,
    successfulTransactionsCount,
    activeAuthorizationsCount: Array.from(issuedAuthorizations.values()).filter(
      (a) => new Date(a.expiresAt) > new Date(),
    ).length,
    agentsCount: Object.keys(agentsRegistry).length,
    log: auditLog,
  });
});

// 12. State Reset Endpoint
app.post('/api/agent/reset', (req, res) => {
  auditLog.length = 0;
  idempotencyStore.clear();
  pendingApprovals.clear();
  issuedAuthorizations.clear();
  successfulTransactionsCount = 0;
  logAction('state_reset', { source: 'admin/demo' });
  res.json({
    status: 'reset_successful',
    message: 'Sentinel state, audit logs, authorizations, and pending approvals have been reset.',
  });
});

// -------------------------------------------------------------
// Start Express Server
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🛡️ SENTINEL V4.1 — THE TRUST & AUTHORIZATION LAYER FOR AI AGENTS');
  console.log('   "AI agents can act. Sentinel defines what they are trusted to do."');
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🤖 AI Provider: Google Gemini (${GEMINI_MODEL}) - ${hasGeminiKey ? '● CONNECTED' : '○ FALLBACK MODE'}`);
  console.log(`💳 Payment Provider: Razorpay TEST MODE - ${razorpay ? '● ACTIVE' : '○ NOT CONFIGURED'}`);
  console.log(`🛡️ Active Agents: 3 (Shopping, Procurement, Relief Supply)`);
  console.log('═══════════════════════════════════════════════════════');
});

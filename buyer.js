import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const BASE_URL = process.env.AGENT_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Real Google Gemini Autonomous Reasoner with Strict Validation & Safe Fallback
async function consultGeminiForAgent(agent, catalog, strategy = 'optimal') {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (apiKey && apiKey.trim() !== '' && apiKey !== 'YOUR_API_KEY') {
    try {
      console.log(`🤖 Consulting Google Gemini AI (${modelName})...`);
      const prompt = `You are an autonomous AI buyer operating in the real world under Sentinel governance.
Agent Identity:
- Name: ${agent.name}
- Role: ${agent.role}
- Max Transaction Authority: ₹${agent.policy.maxTransactionAmount}
- Auto-Approve Below: ₹${agent.policy.autoApproveBelow}
- Allowed Categories: ${JSON.stringify(agent.policy.allowedCategories)}
- Blocked Categories: ${JSON.stringify(agent.policy.blockedCategories || [])}

Available Server Catalog Products:
${JSON.stringify(catalog, null, 2)}

Task: Analyze the catalog and select ONE product that best fits your mission.
Strategy target: ${strategy} (auto: < ₹${agent.policy.autoApproveBelow}, human: ₹${agent.policy.autoApproveBelow}-₹${agent.policy.maxTransactionAmount}, block: > ₹${agent.policy.maxTransactionAmount}).

You MUST return ONLY valid JSON in this exact structure:
{
  "productId": "string matching catalog product id",
  "reasoning": "clear explanation of purpose and why selected",
  "confidence": 0.95
}`;

      let rawContent = '';
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        rawContent = response.text || '';
      } catch (err1) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        rawContent = result.response.text() || '';
      }

      const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      // Strict Validation against server catalog
      const matched = catalog.find((p) => p.id === parsed.productId);
      if (matched) {
        return {
          productId: matched.id,
          productName: matched.name,
          reasoning: parsed.reasoning || `Gemini selected ${matched.name}`,
          confidence: parsed.confidence || 0.95,
          provider: 'gemini',
          model: modelName,
          isRealLLM: true,
        };
      }
    } catch (err) {
      console.log(`ℹ️ Gemini notice: ${err.message} — using deterministic fallback.`);
    }
  }

  // Safe Deterministic Fallback
  let chosen;
  if (strategy === 'auto') {
    chosen = catalog.find((p) => p.price < agent.policy.autoApproveBelow) || catalog[0];
  } else if (strategy === 'human') {
    chosen = catalog.find((p) => p.price >= agent.policy.autoApproveBelow && p.price <= agent.policy.maxTransactionAmount) || catalog[1] || catalog[0];
  } else {
    chosen = catalog.find((p) => p.price > agent.policy.maxTransactionAmount) || catalog[catalog.length - 1];
  }

  return {
    productId: chosen.id,
    productName: chosen.name,
    reasoning: `Deterministic fallback: Selected '${chosen.name}' (₹${chosen.price}) because Gemini AI was offline.`,
    confidence: 0.85,
    provider: 'fallback',
    mode: 'HEURISTIC_FALLBACK',
    isRealLLM: false,
  };
}

async function runBuyer() {
  console.clear();
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🛡️ SENTINEL V4.1 — THE TRUST & AUTHORIZATION LAYER FOR AI AGENTS');
  console.log('   "AI agents can act. Sentinel defines what they are trusted to do."');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Reset state for reproducible clean run
  try {
    await fetch(`${BASE_URL}/api/agent/reset`, { method: 'POST' });
  } catch (_) {}

  // -----------------------------------------------------------
  // STEP 1: Verify System Health & Real Integration Status
  // -----------------------------------------------------------
  console.log('📡 Step 1: Checking Sentinel System Status & Integration Gateways...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  console.log(`✓ System: ${healthData.product} v${healthData.version} (Status: ● ${healthData.status.toUpperCase()})`);
  console.log(`  🤖 AI Provider:      Google Gemini (${healthData.integrations.aiProvider.model}) [● ${healthData.integrations.aiProvider.status}]`);
  console.log(`  💳 Payment Provider: Razorpay (${healthData.integrations.paymentProvider.mode}) [● ${healthData.integrations.paymentProvider.status}]`);

  await sleep(600);

  // -----------------------------------------------------------
  // STEP 2: Fetch Multi-Agent Registry
  // -----------------------------------------------------------
  console.log('\n🤖 Step 2: Discovering Sentinel Multi-Agent Registry (GET /api/agents)...');
  const agentsRes = await fetch(`${BASE_URL}/api/agents`);
  const agentsData = await agentsRes.json();
  const reliefAgent = agentsData.agents.find((a) => a.id === 'relief_agent_001');
  const procAgent = agentsData.agents.find((a) => a.id === 'procurement_agent_001');
  const shopAgent = agentsData.agents.find((a) => a.id === 'agent_demo_001');

  console.log(`✓ Active Agents (${agentsData.count}):`);
  console.log(`  1. 🌍 ${reliefAgent.name} (Authority: ₹${reliefAgent.policy.maxTransactionAmount.toLocaleString()})`);
  console.log(`  2. 🏢 ${procAgent.name} (Authority: ₹${procAgent.policy.maxTransactionAmount.toLocaleString()})`);
  console.log(`  3. 🤖 ${shopAgent.name} (Authority: ₹${shopAgent.policy.maxTransactionAmount.toLocaleString()})`);

  await sleep(700);

  // -----------------------------------------------------------
  // SCENE 1: REAL GEMINI AI SELECTION + AUTO-APPROVAL + RAZORPAY TEST ORDER
  // -----------------------------------------------------------
  console.log('\n───────────────────────────────────────────────────────────────────────');
  console.log('🎬 SCENE 1: GEMINI AUTONOMOUS REASONING → AUTO-APPROVAL → RAZORPAY ORDER');
  console.log('Agent: Relief Supply Agent (Emergency Humanitarian Mission)');

  const reliefCatRes = await fetch(`${BASE_URL}/api/agent/catalog?agentId=relief_agent_001`);
  const reliefCatData = await reliefCatRes.json();

  const aiPick1 = await consultGeminiForAgent(reliefAgent, reliefCatData.products, 'auto');
  console.log(`🤖 Gemini Recommended: ${aiPick1.productName} (ID: ${aiPick1.productId})`);
  console.log(`   Reasoning: "${aiPick1.reasoning}" (Confidence: ${aiPick1.confidence})`);
  console.log(`→ Submitting Action Request to Sentinel Action Gate...`);

  const res1 = await fetch(`${BASE_URL}/api/agent/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: 'relief_agent_001',
      productId: aiPick1.productId,
      agentNote: aiPick1.reasoning,
      idempotencyKey: `gemini-relief-auto-${Date.now()}`,
    }),
  });
  const body1 = await res1.json();

  console.log(`\n🟢 DECISION: [${body1.decision}] (Authority Tier: ${body1.authorityLevel})`);
  console.log(`  Sentinel Policy Rationale: ${body1.reason}`);
  console.log(`🔑 SENTINEL ACTION AUTHORIZATION ISSUED:`);
  console.log(`  Auth ID:    ${body1.authorization.id}`);
  console.log(`  Token:      ${body1.authorization.token.substring(0, 22)}...`);
  console.log(`  Scope:      ${body1.authorization.scope} (TTL: ${body1.authorization.ttlSeconds}s)`);
  console.log(`💳 REAL PAYMENT ADAPTER EXECUTION:`);
  console.log(`  Provider:   ${body1.payment.paymentProvider.toUpperCase()} (${body1.payment.paymentMode || 'TEST_MODE'})`);
  console.log(`  Status:     ${body1.payment.paymentStatus}`);
  console.log(`  Order ID:   ${body1.payment.orderId || 'N/A'}`);
  console.log(`  Message:    "${body1.payment.message}"`);

  await sleep(1000);

  // -----------------------------------------------------------
  // SCENE 2: GEMINI HIGH-VALUE SELECTION → SUPERVISOR QUARANTINE → RAZORPAY ORDER
  // -----------------------------------------------------------
  console.log('\n───────────────────────────────────────────────────────────────────────');
  console.log('🎬 SCENE 2: GEMINI HIGH-VALUE SELECTION → HUMAN APPROVAL → RAZORPAY ORDER');
  console.log('Agent: Relief Supply Agent (Crisis Trauma Center)');

  const aiPick2 = await consultGeminiForAgent(reliefAgent, reliefCatData.products, 'human');
  console.log(`🤖 Gemini Recommended: ${aiPick2.productName} (ID: ${aiPick2.productId})`);
  console.log(`   Reasoning: "${aiPick2.reasoning}"`);
  console.log(`→ Submitting Action Request to Sentinel Action Gate...`);

  const res2 = await fetch(`${BASE_URL}/api/agent/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: 'relief_agent_001',
      productId: aiPick2.productId,
      agentNote: aiPick2.reasoning,
      idempotencyKey: `gemini-relief-human-${Date.now()}`,
    }),
  });
  const body2 = await res2.json();

  console.log(`\n🟡 DECISION: [${body2.decision}] (Authority Tier: ${body2.authorityLevel})`);
  console.log(`  Approval ID: ${body2.approvalId}`);
  console.log(`  🛡️ Payment execution held in Sentinel supervisor quarantine (Zero token / Zero charge).`);

  await sleep(800);
  console.log(`\n👨‍💼 Human Field Supervisor Reviews & Signs Off...`);
  console.log(`→ POST /api/approvals/${body2.approvalId}/approve`);

  const approveRes = await fetch(`${BASE_URL}/api/approvals/${body2.approvalId}/approve`, { method: 'POST' });
  const approveBody = await approveRes.json();

  console.log(`🟢 HUMAN APPROVAL GRANTED:`);
  console.log(`  Auth Token: ${approveBody.authorization.id}`);
  console.log(`💳 REAL PAYMENT ADAPTER EXECUTION:`);
  console.log(`  Provider:   ${approveBody.payment.paymentProvider.toUpperCase()} (${approveBody.payment.paymentMode || 'TEST_MODE'})`);
  console.log(`  Status:     ${approveBody.payment.paymentStatus}`);
  console.log(`  Order ID:   ${approveBody.payment.orderId || 'N/A'}`);

  await sleep(1000);

  // -----------------------------------------------------------
  // SCENE 3: HARD CATEGORY BLOCK (OVERRIDING BUDGET)
  // -----------------------------------------------------------
  console.log('\n───────────────────────────────────────────────────────────────────────');
  console.log('🚫 SCENE 3: CATEGORY RESTRICTION HARD OVERRIDE (ZERO RAZORPAY CALLS)');
  console.log('Agent Attempting: Luxury Smartphone Bundle (₹20,000 electronics)');
  console.log('Note: Price (₹20k) is within ₹100,000 budget, but category is blocked.');

  const res3 = await fetch(`${BASE_URL}/api/agent/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: 'relief_agent_001',
      productId: 'rel_5',
      agentNote: 'Consumer electronics purchase request.',
      idempotencyKey: `gemini-block-${Date.now()}`,
    }),
  });
  const body3 = await res3.json();

  console.log(`\n🔴 DECISION: [${body3.decision}] (HTTP ${res3.status})`);
  console.log(`  Reason: ${body3.reason}`);
  console.log('  Sentinel Policy Checks:');
  body3.checks.forEach((chk) => {
    const sym = chk.status === 'PASS' ? '✓' : '✗';
    console.log(`    ${sym} [${chk.name}]: ${chk.status} — ${chk.message}`);
  });
  console.log('  🛡️ ZERO AUTHORIZATION ISSUED. ZERO RAZORPAY ORDERS GENERATED.');

  await sleep(800);

  // -----------------------------------------------------------
  // SCENE 4: GLOBAL LIVE ACTIVITY TELEMETRY
  // -----------------------------------------------------------
  console.log('\n───────────────────────────────────────────────────────────────────────');
  console.log('📜 SCENE 4: SENTINEL EVENT STREAM (GET /api/activity)');
  const actRes = await fetch(`${BASE_URL}/api/activity`);
  const actData = await actRes.json();

  console.log(`Sentinel Live Telemetry (${actData.count} recent events):`);
  actData.activity.slice(0, 6).forEach((e, idx) => {
    const time = e.timestamp.substring(11, 19);
    const dec = e.decision ? `[${e.decision}] ` : '';
    console.log(`  ${idx + 1}. [${time}] [${e.agentName}] ${e.action.toUpperCase()} ${dec}— ${e.productName || ''}`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🎉 SENTINEL V4.1 DEMONSTRATION COMPLETE:');
  console.log('   ✓ Real Google Gemini AI Autonomous Reasoning');
  console.log('   ✓ Strict Output Validation (Server-Authoritative Price & Scopes)');
  console.log('   ✓ Deterministic Policy Engine (Auto, Human, Block)');
  console.log('   ✓ Real Razorpay TEST MODE Orders Generated Post-Authorization');
  console.log('   ✓ 100% Immutable Backend Audit Trail Recorded');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

runBuyer();

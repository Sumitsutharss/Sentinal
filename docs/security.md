# 🔐 Sentinel Security Model & Threat Matrix

> **Defensive Architecture for Untrusted AI Systems**  
> *"Treat all AI recommendations as unauthenticated intent until authorized by policy."*

---

## 1. Security Tenets

1. **Zero Trust for LLM Outputs**: Language models can hallucinate, experience prompt injections, or misinterpret instructions. Sentinel treats all agent requests as untrusted inputs.
2. **Server-Side Authoritative State**: Product prices, category classifications, and spending limits are resolved exclusively from server-side storage, never from client request bodies.
3. **Short-Lived Ephemeral Authorization**: Execution tokens expire within 60 seconds (TTL) to prevent replay attacks and token hoarding.
4. **Strict Human-in-the-Loop Isolation**: Medium-risk actions are isolated in a quarantine queue. The payment provider adapter is physically inaccessible without an explicit supervisor sign-off.
5. **Idempotency Protection**: Every checkout request requires an `Idempotency-Key` header to prevent duplicate charges caused by AI agent retry loops.

---

## 2. Threat Matrix & Mitigations

| Threat | Attack / Failure Vector | Sentinel Defense Mechanism | Severity |
| :--- | :--- | :--- | :--- |
| **AI Price Hallucination / Body Tampering** | Agent passes `price: 10` for an item that costs ₹50,000 to bypass spending ceiling. | **Server-Authoritative Price Lookup**: Sentinel completely ignores `req.body.price` and reads authoritative catalog price directly from backend memory/database. | 🔴 CRITICAL |
| **Budget Exploitation / Overspending** | Agent attempts a purchase exceeding its configured authority budget limit. | **Spending Ceiling Enforcement**: Server evaluates transaction value against `maxTransactionAmount`. Rejects with `HTTP 403` if exceeded. | 🔴 CRITICAL |
| **Category Policy Violation** | Humanitarian relief agent attempts to purchase luxury electronics. | **Category Restriction Override**: Sentinel validates category membership against `allowedCategories` and `blockedCategories`. Policy block overrides high spending limit. | 🔴 CRITICAL |
| **Autonomous Action Runaway** | Agent initiates large-scale or high-risk procurement without oversight. | **Human-in-the-Loop Quarantine**: Transactions above `autoApproveBelow` threshold enter quarantine. Zero tokens issued until human supervisor approves. | 🟠 HIGH |
| **AI Retry Loop / Duplicate Charges** | Network glitch causes agent to re-send payment request multiple times. | **Deterministic Idempotency Key**: Cached responses are replayed for identical keys within 24h. Zero duplicate orders sent to payment gateway. | 🟠 HIGH |
| **Token Theft & Replay Attacks** | Intercepted authorization token attempted for subsequent unauthorized actions. | **60-Second TTL + Single-Use Token**: Tokens expire after 60s and are invalidated immediately upon execution. | 🟠 HIGH |
| **Supervisor Race Condition / Double Approval** | Multiple supervisors click approve simultaneously on the same pending item. | **Atomic Approval State Machine**: State transitions (`PENDING -> APPROVED`) are atomic; duplicate approvals return `HTTP 400/409 Conflict`. | 🟡 MEDIUM |
| **AI Provider Outage / Rate Limiting** | Google Gemini API fails, times out, or returns invalid JSON. | **Deterministic Fallback Engine**: System falls back to a transparently labeled deterministic fallback engine while maintaining 100% policy enforcement. | 🟡 MEDIUM |
| **Frontend Credential Leakage** | API keys or private authorization secrets exposed to client browser. | **Masked Previews & Backend Secrets**: Secret tokens are masked (`tok_sec_xxx...`), backend credentials never exposed to client assets. | 🔴 CRITICAL |

---

## 3. Defense Deep-Dive

### Server-Authoritative Price Validation
```javascript
// server.js - Real Implementation
const authoritativeProduct = catalog.find(p => p.id === productId);
if (!authoritativeProduct) {
  return res.status(404).json({ error: "Product not found in authoritative catalog" });
}

// Ignore any client-provided price; use server catalog price
const authoritativePrice = authoritativeProduct.price;
```

### Short-Lived Ephemeral Token Lifecycle
```javascript
const authorization = {
  id: `auth_${crypto.randomBytes(6).toString("hex")}`,
  token: `tok_sec_${crypto.randomBytes(16).toString("hex")}`,
  agentId: agent.id,
  productId: authoritativeProduct.id,
  amount: authoritativePrice,
  currency: "INR",
  issuedAt: now.toISOString(),
  expiresAt: new Date(Date.now() + 60 * 1000).toISOString(), // 60s TTL
  status: "ACTIVE"
};
```

---

## 4. Razorpay Test Mode Safety

> [!IMPORTANT]
> **Razorpay integration runs strictly in `TEST_MODE`** using test API keys (`rzp_test_...`).
> Creating a Razorpay Test Mode order (`order_xxx`) creates an authorized test transaction in the Razorpay sandbox environment and **does not charge real currency**.

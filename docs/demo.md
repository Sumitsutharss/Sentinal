# 🎬 Sentinel Demo Guide (60-Second Hackathon Walkthrough)

This guide walks through how to demonstrate the Sentinel platform for hackathon judges, engineers, and product reviewers.

---

## ⚡ Prerequisites

1. Clone and install dependencies:
   ```bash
   git clone https://github.com/Sumitsutharss/Sentinal.git
   cd Sentinal
   npm install
   ```

2. Configure environment variables in `.env` (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```
   Add your `GEMINI_API_KEY` (and optional `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).

3. Start Sentinel Server:
   ```bash
   node server.js
   ```
   Open browser at: `http://localhost:3000`

---

## 🎭 Step-by-Step Live Demo Flow

### Step 1: Open Sentinel Control Center
- Navigate to `http://localhost:3000`
- Observe the **3D Illuminated Globe Hero Section** and **Real-Time Integration Gateway Pills**:
  - 🤖 `Gemini Flash: Connected`
  - 💳 `Razorpay: Test Mode Active`
  - 🛡️ `Policy Engine: Online`
  - 🤖 `Agents: 3 Active`

---

### Step 2: Run Scenario 1 — Auto-Approved Autonomous Procurement (🟢 LOW Authority)
- **Action**: Click the **💧 Safe Water (₹8,000)** quick scenario button or run in terminal:
  ```bash
  node buyer.js 1500
  ```
- **What Sentinel Demonstrates**:
  1. Google Gemini AI reasons through the agent's humanitarian mission and recommends Emergency Water (₹8,000).
  2. Sentinel validates agent identity and confirms ₹8,000 is below the ₹10,000 auto-approval ceiling.
  3. Sentinel issues a 60-second action authorization token (`auth_xxx`).
  4. Razorpay Test Mode adapter creates a real test order (e.g. `order_TYRqaqrEHQpmFi`).
  5. Audit trail records the decision immediately with SHA-256 integrity checksum.

---

### Step 3: Run Scenario 2 — Human Supervisor Approval Queue (🟡 MEDIUM Authority)
- **Action**: Click the **🏥 Medical Kits (₹45,000)** quick scenario button.
- **What Sentinel Demonstrates**:
  1. Transaction value (₹45,000) exceeds auto-approval ceiling (₹10,000) but is within max authority (₹100,000).
  2. Sentinel places the request in **🟡 PENDING_APPROVAL** quarantine.
  3. **Zero payment tokens are issued and zero Razorpay calls are made.**
  4. The request appears in the **Human-in-the-Loop Approvals Queue** in the UI.
  5. Click **✓ Approve** in the UI:
     - Authorization token is signed.
     - Razorpay Test Order is generated (`order_TYRqjt39J9cjMR`).
     - State transitions to `APPROVED` and audit trail updates.

---

### Step 4: Run Scenario 3 — Category Restriction Hard Block (🔴 HIGH Authority / Blocked)
- **Action**: Click the **📱 Luxury Phone (₹20,000)** quick scenario button.
- **What Sentinel Demonstrates**:
  1. Price (₹20,000) is well within the ₹100,000 budget, but category `electronics` is restricted.
  2. Sentinel immediately triggers **🔴 BLOCKED** with `HTTP 403 Forbidden`.
  3. **Zero authorization issued. Zero Razorpay payment calls made.**
  4. Security violation logged to the immutable event stream.

---

### Step 5: Run Scenario 4 — Idempotency Protection
- **Action**: Run the automated QA suite:
  ```bash
  node test_qa.js
  ```
- **What Sentinel Demonstrates**:
  - Replays identical `Idempotency-Key` headers.
  - Confirms cached order is returned without duplicating financial transactions on Razorpay.
  - Verifies 22 out of 22 core security checks pass.

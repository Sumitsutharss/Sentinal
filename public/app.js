// -------------------------------------------------------------
// Sentinel v4.1 Frontend Client Logic
// -------------------------------------------------------------

let currentSelectedAgentId = 'agent_demo_001';
let cachedAgents = {};
let cachedCatalogs = {};

// Health & Real Integration Status Check
async function checkHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    if (data.status === 'ok') {
      document.getElementById('statusPolicyEngine').className = 'pill online';
      document.getElementById('statusActiveAgents').className = 'pill online';
      document.getElementById('statusActiveAgents').innerHTML = `<span class="dot dot-emerald"></span> Agents: ${data.activeAgentsCount} Active`;

      // AI Provider Status
      const aiPill = document.getElementById('statusAiProvider');
      if (data.integrations?.aiProvider?.status === 'CONNECTED') {
        aiPill.className = 'pill online';
        aiPill.innerHTML = `<span class="dot dot-emerald"></span> 🤖 Gemini: Connected`;
      } else {
        aiPill.className = 'pill safe-mode';
        aiPill.innerHTML = `<span class="dot dot-amber"></span> 🤖 Gemini: Fallback`;
      }

      // Payment Provider Status
      const payPill = document.getElementById('statusPaymentAdapter');
      if (data.integrations?.paymentProvider?.status === 'CONNECTED') {
        payPill.className = 'pill online';
        payPill.innerHTML = '<span class="dot dot-emerald"></span> 💳 Razorpay: Test Mode Active';
      } else {
        payPill.className = 'pill safe-mode';
        payPill.innerHTML = '<span class="dot dot-amber"></span> 💳 Razorpay: Safe Mode';
      }
    }
  } catch (err) {
    document.getElementById('statusPolicyEngine').className = 'pill';
    document.getElementById('statusPolicyEngine').innerHTML = '<span class="dot dot-rose"></span> Policy Engine: Offline';
  }
}

// Load All Agents & Populate UI
async function loadAgents() {
  try {
    const res = await fetch('/api/agents');
    const data = await res.json();
    if (data.agents && data.agents.length > 0) {
      data.agents.forEach((ag) => {
        cachedAgents[ag.id] = ag;
      });
      renderAgentPolicy(currentSelectedAgentId);
      loadCatalogForAgent(currentSelectedAgentId);
      updateSimProductOptions();
    }
  } catch (err) {
    console.error('Failed to load agents:', err);
  }
}

// Switch Active Agent View
window.selectAgent = function (agentId) {
  currentSelectedAgentId = agentId;
  document.querySelectorAll('.agent-profile-card').forEach((c) => c.classList.remove('active'));
  const card = document.getElementById(`card_${agentId}`);
  if (card) card.classList.add('active');

  renderAgentPolicy(agentId);
  loadCatalogForAgent(agentId);

  const simAgentSelect = document.getElementById('simAgentSelect');
  if (simAgentSelect) {
    simAgentSelect.value = agentId;
    updateSimProductOptions();
  }
};

// Render Policy Visualizer for Selected Agent
function renderAgentPolicy(agentId) {
  const agent = cachedAgents[agentId];
  if (!agent) return;

  const pol = agent.policy;
  document.getElementById('policyVisualizerTitle').textContent = `Policy for ${agent.name}`;
  document.getElementById('tierAutoVal').textContent = `< ₹${pol.autoApproveBelow.toLocaleString()}`;
  document.getElementById('tierHumanVal').textContent = `₹${pol.autoApproveBelow.toLocaleString()} – ₹${pol.maxTransactionAmount.toLocaleString()}`;
  document.getElementById('tierBlockVal').textContent = `> ₹${pol.maxTransactionAmount.toLocaleString()}`;

  document.getElementById('policyAllowedCats').textContent = pol.allowedCategories?.join(', ') || 'All';
  document.getElementById('policyBlockedCats').textContent = pol.blockedCategories?.length ? pol.blockedCategories.join(', ') : 'None';
}

// Load Catalog for the Selected Agent
async function loadCatalogForAgent(agentId) {
  try {
    const res = await fetch(`/api/agent/catalog?agentId=${agentId}`);
    const data = await res.json();
    cachedCatalogs[agentId] = data.products || [];

    const catalogContainer = document.getElementById('catalogList');
    const domainTag = document.getElementById('catalogDomainTag');
    const catalogTitle = document.getElementById('catalogTitle');

    const agent = cachedAgents[agentId];
    if (agent) {
      catalogTitle.textContent = `${agent.name} Catalog`;
      domainTag.textContent = agent.type.replace('-agent', '').toUpperCase();
    }

    if (!data.products || data.products.length === 0) {
      catalogContainer.innerHTML = '<div class="empty-state">No products found for this catalog.</div>';
      return;
    }

    catalogContainer.innerHTML = data.products
      .map(
        (p) => `
      <div class="catalog-item">
        <div class="catalog-item-info">
          <span class="catalog-item-title">${p.name}</span>
          <span class="catalog-item-desc">${p.description}</span>
        </div>
        <div class="catalog-item-meta">
          <span class="catalog-item-tag">${p.category}</span>
          <span class="catalog-item-price">₹${p.price.toLocaleString()}</span>
        </div>
      </div>
    `,
      )
      .join('');
  } catch (err) {
    console.error('Failed to load catalog for agent:', err);
  }
}

// Populate Simulator Product Dropdown dynamically
window.updateSimProductOptions = function () {
  const selectedAgentId = document.getElementById('simAgentSelect').value;
  const simProductSelect = document.getElementById('simProductSelect');
  const agent = cachedAgents[selectedAgentId];

  const prods = cachedCatalogs[selectedAgentId] || [];
  if (prods.length > 0) {
    simProductSelect.innerHTML = prods
      .map((p) => {
        let expectedTag = 'LOW / Auto-Approve';
        if (agent) {
          if (agent.policy.blockedCategories?.includes(p.category)) {
            expectedTag = 'HIGH / BLOCKED (Category Restriction)';
          } else if (p.price > agent.policy.maxTransactionAmount) {
            expectedTag = 'HIGH / BLOCKED (Spending Ceiling)';
          } else if (p.price >= agent.policy.autoApproveBelow) {
            expectedTag = 'MEDIUM / Human Review Required';
          }
        }
        return `<option value="${p.id}">${p.name} (₹${p.price.toLocaleString()}) [${p.category}] — Expected: ${expectedTag}</option>`;
      })
      .join('');
  } else {
    fetch(`/api/agent/catalog?agentId=${selectedAgentId}`)
      .then((r) => r.json())
      .then((data) => {
        cachedCatalogs[selectedAgentId] = data.products || [];
        updateSimProductOptions();
      });
  }
};

// Run Policy Simulation & Check Inspector
document.getElementById('btnRunSimulation').addEventListener('click', async () => {
  const agentId = document.getElementById('simAgentSelect').value;
  const productId = document.getElementById('simProductSelect').value;
  const resultBox = document.getElementById('simResultBox');

  resultBox.innerHTML = '<div style="color: var(--accent);">Sentinel evaluating policy engine...</div>';

  try {
    const res = await fetch('/api/policy/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, productId }),
    });
    const data = await res.json();

    let decisionColor = '#10b981';
    let decisionBg = 'rgba(16, 185, 129, 0.15)';
    if (data.decision === 'PENDING_APPROVAL') {
      decisionColor = '#f59e0b';
      decisionBg = 'rgba(245, 158, 11, 0.15)';
    } else if (data.decision === 'BLOCKED') {
      decisionColor = '#ef4444';
      decisionBg = 'rgba(239, 68, 68, 0.15)';
    }

    resultBox.innerHTML = `
      <div class="sim-header-row">
        <div>
          <strong style="color: #fff;">${data.product ? data.product.name : 'Unknown Product'}</strong> • 
          <span>₹${data.product ? data.product.price.toLocaleString() : 'N/A'}</span> 
          (${data.product ? data.product.category : 'N/A'})
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
            Target Agent: <span style="color: var(--accent); font-weight: 600;">${data.agent ? data.agent.name : agentId}</span>
          </div>
        </div>
        <div class="sim-decision-badge" style="background: ${decisionBg}; color: ${decisionColor};">
          ${data.decision} • ${data.authorityLevel} AUTHORITY
        </div>
      </div>
      <div style="font-size: 12px; color: var(--text-primary); margin: 8px 0;">
        💡 <strong>Sentinel Policy Rationale:</strong> ${data.explanation}
      </div>
      <div class="sim-checks-list">
        ${data.checks
          .map((chk) => {
            const isPass = chk.status === 'PASS';
            const icon = isPass ? '✓' : chk.status === 'PENDING_HUMAN' ? '⚠' : '✗';
            const color = isPass ? '#10b981' : chk.status === 'PENDING_HUMAN' ? '#f59e0b' : '#ef4444';
            return `
            <div class="sim-check-item">
              <span style="font-weight: 800; color: ${color}; font-size: 13px;">${icon}</span>
              <span style="color: var(--text-secondary);">${chk.name}:</span>
              <span style="color: #fff; font-weight: 600;">${chk.status}</span>
              <span style="color: var(--text-muted); font-size: 10px;">(${chk.message})</span>
            </div>
          `;
          })
          .join('')}
      </div>
    `;

    await loadApprovals();
    await loadActivityStream();
  } catch (err) {
    resultBox.innerHTML = `<div style="color: #ef4444;">Simulation failed: ${err.message}</div>`;
  }
});

// Run Demo Scenarios
window.runDemoScenario = async function (scenarioKey) {
  try {
    const res = await fetch('/api/demo/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: scenarioKey }),
    });
    const result = await res.json();
    await loadApprovals();
    await loadActivityStream();
  } catch (err) {
    console.error('Scenario execution error:', err);
  }
};

// Approvals Queue
async function loadApprovals() {
  try {
    const res = await fetch('/api/approvals');
    const data = await res.json();
    const queueContainer = document.getElementById('approvalsQueue');
    const pendingCounter = document.getElementById('pendingCounter');

    pendingCounter.textContent = `${data.pendingCount || 0} PENDING`;

    if (!data.approvals || data.approvals.length === 0) {
      queueContainer.innerHTML =
        '<div class="empty-state">No pending approvals. Run a medium-tier scenario (e.g. 🏥 Medical Kits ₹45,000) to test live supervisor review.</div>';
      return;
    }

    queueContainer.innerHTML = data.approvals
      .map((appr) => {
        const isPending = appr.status === 'PENDING';
        const isApproved = appr.status === 'APPROVED';
        const isRejected = appr.status === 'REJECTED';

        let badgeStyle = 'background: rgba(245, 158, 11, 0.15); color: #f59e0b;';
        if (isApproved) badgeStyle = 'background: rgba(16, 185, 129, 0.15); color: #10b981;';
        if (isRejected) badgeStyle = 'background: rgba(239, 68, 68, 0.15); color: #ef4444;';

        const orderInfo = appr.paymentResult?.orderId
          ? `<span style="color: #60a5fa;">• Razorpay Order: <code>${appr.paymentResult.orderId}</code></span>`
          : '';

        return `
        <div class="approval-card ${!isPending ? 'resolved' : ''}">
          <div class="approval-main-info">
            <div class="approval-header-line">
              <span class="approval-agent-badge">🤖 ${appr.agentName || appr.agentId}</span>
              <span class="approval-product-title">${appr.productName}</span>
              <span class="approval-price">₹${appr.price.toLocaleString()}</span>
              <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; ${badgeStyle}">
                ${appr.status}
              </span>
            </div>
            <div class="approval-reason">"${appr.agentNote || 'Autonomous action request'}"</div>
            <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px;">
              Approval ID: ${appr.approvalId} • Created: ${appr.createdAt.substring(11, 19)}
            </div>
            ${
              appr.authorization
                ? `
              <div class="approval-token-box">
                <span>🔑 Sentinel Action Token: <code>${appr.authorization.id}</code> (60s TTL)</span>
                ${orderInfo}
              </div>
            `
                : ''
            }
          </div>

          <div class="approval-actions">
            ${
              isPending
                ? `
                <button class="btn btn-sm btn-approve" onclick="handleApprove('${appr.approvalId}')">
                  ✓ Approve
                </button>
                <button class="btn btn-sm btn-reject" onclick="handleReject('${appr.approvalId}')">
                  ✕ Reject
                </button>
              `
                : `
                <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">
                  ${isApproved ? 'ACTION AUTHORIZED & EXECUTED' : 'DECLINED'}
                </span>
              `
            }
          </div>
        </div>
      `;
      })
      .join('');
  } catch (err) {
    console.error('Failed to load approvals:', err);
  }
}

// Global approval actions
window.handleApprove = async function (approvalId) {
  try {
    await fetch(`/api/approvals/${approvalId}/approve`, { method: 'POST' });
    await loadApprovals();
    await loadActivityStream();
  } catch (err) {
    console.error('Approve failed:', err);
  }
};

window.handleReject = async function (approvalId) {
  try {
    await fetch(`/api/approvals/${approvalId}/reject`, { method: 'POST' });
    await loadApprovals();
    await loadActivityStream();
  } catch (err) {
    console.error('Reject failed:', err);
  }
};

// Real Live Activity Feed (GET /api/activity)
async function loadActivityStream() {
  try {
    const res = await fetch('/api/activity');
    const data = await res.json();
    const streamContainer = document.getElementById('auditStream');
    document.getElementById('auditCount').textContent = data.totalCount || data.count || 0;

    if (!data.activity || data.activity.length === 0) {
      streamContainer.innerHTML = '<div class="empty-state">No activity logged yet. Trigger a scenario above.</div>';
      return;
    }

    streamContainer.innerHTML = data.activity
      .map((entry) => {
        const time = entry.timestamp ? entry.timestamp.substring(11, 19) : '--:--:--';
        let badgeClass = 'badge-info';
        let label = entry.action.toUpperCase();

        if (entry.decision === 'APPROVED' || entry.action.includes('approved') || entry.action.includes('granted') || entry.action.includes('token') || entry.action.includes('order_created')) {
          badgeClass = 'badge-approved';
        } else if (entry.decision === 'PENDING_APPROVAL' || entry.action.includes('approval_requested')) {
          badgeClass = 'badge-pending-human';
        } else if (entry.decision === 'BLOCKED' || entry.action.includes('blocked') || entry.action.includes('rejected')) {
          badgeClass = 'badge-blocked';
        }

        let detailStr = '';
        if (entry.details?.orderId) detailStr += `Razorpay Test Order: ${entry.details.orderId} `;
        if (entry.productName) detailStr += `${entry.productName} (₹${entry.amount?.toLocaleString() || ''}) `;
        if (entry.authorizationId) detailStr += `• Auth Token: ${entry.authorizationId} `;
        if (entry.reason) detailStr += `— "${entry.reason}" `;

        return `
        <div class="audit-entry">
          <div class="audit-entry-left">
            <span class="audit-time">${time}</span>
            <span class="audit-agent-tag">${entry.agentName || entry.agentId}</span>
            <span class="audit-action-badge ${badgeClass}">${label}</span>
          </div>
          <span class="audit-details">${detailStr || 'Sentinel telemetry event recorded'}</span>
        </div>
      `;
      })
      .join('');
  } catch (err) {
    console.error('Failed to load activity stream:', err);
  }
}

// Reset State Handler
document.getElementById('btnResetState').addEventListener('click', async () => {
  try {
    await fetch('/api/agent/reset', { method: 'POST' });
    await loadApprovals();
    await loadActivityStream();
  } catch (err) {
    console.error(err);
  }
});

// Initialization & Auto-Polling
checkHealth();
loadAgents();
loadApprovals();
loadActivityStream();

setInterval(() => {
  loadApprovals();
  loadActivityStream();
}, 2000);

/**
 * Election Guide AI - Main Application Controller
 * Handles UI state, stage progression, eligibility scoring, AI drawer, accessibility controls
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize AI Engine
  const aiEngine = new ElectionAIEngine(ELECTION_DATA);

  // Application State
  const state = {
    currentJurisdiction: localStorage.getItem('election_jurisdiction') || 'us',
    currentStageIndex: 0,
    fontScale: parseFloat(localStorage.getItem('election_font_scale')) || 1.0,
    theme: localStorage.getItem('election_theme') || 'light',
    contrast: localStorage.getItem('election_contrast') || 'normal',
    stageChecklists: JSON.parse(localStorage.getItem('election_stage_checklists') || '{}'),
    eligibilityAnswers: {
      age: 'yes',
      registration: 'registered',
      id: 'have_id',
      polling: 'know_booth',
      ballot: 'researched'
    }
  };

  // DOM Elements
  const elements = {
    // Accessibility & Header
    html: document.documentElement,
    body: document.body,
    jurisdictionSelect: document.getElementById('jurisdictionSelect'),
    jurFlag: document.getElementById('jurFlag'),
    heroJurLabel: document.getElementById('heroJurLabel'),
    btnFontDec: document.getElementById('btnFontDec'),
    btnFontReset: document.getElementById('btnFontReset'),
    btnFontInc: document.getElementById('btnFontInc'),
    btnHighContrast: document.getElementById('btnHighContrast'),
    btnThemeToggle: document.getElementById('btnThemeToggle'),

    // Hero Stats
    statRegDeadline: document.getElementById('statRegDeadline'),
    statPollHours: document.getElementById('statPollHours'),
    statIdPolicy: document.getElementById('statIdPolicy'),
    statHelpline: document.getElementById('statHelpline'),

    // Search
    globalSearchForm: document.getElementById('globalSearchForm'),
    globalSearchInput: document.getElementById('globalSearchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    searchAskAiBtn: document.getElementById('searchAskAiBtn'),
    searchResultsDropdown: document.getElementById('searchResultsDropdown'),

    // Stages
    stageTabs: document.querySelectorAll('.stage-nav-btn'),
    stageContentWrapper: document.getElementById('stageContentWrapper'),

    // Eligibility
    eligibilitySection: document.getElementById('eligibility'),
    questionCards: document.querySelectorAll('.question-card'),
    scoreCircle: document.getElementById('scoreCircle'),
    scoreValue: document.getElementById('scoreValue'),
    readinessHeading: document.getElementById('readinessHeading'),
    readinessSubtext: document.getElementById('readinessSubtext'),
    actionStepsContainer: document.getElementById('actionStepsContainer'),
    btnPrintChecklist: document.getElementById('btnPrintChecklist'),
    btnOfficialPortal: document.getElementById('btnOfficialPortal'),

    // Rights AI trigger
    btnAskRightsAi: document.getElementById('btnAskRightsAi'),

    // AI Drawer
    aiDrawer: document.getElementById('aiDrawer'),
    aiDrawerBackdrop: document.getElementById('aiDrawerBackdrop'),
    aiDrawerOpenBtn: document.getElementById('aiDrawerOpenBtn'),
    aiDrawerCloseBtn: document.getElementById('aiDrawerCloseBtn'),
    aiMessagesContainer: document.getElementById('aiMessagesContainer'),
    aiChatForm: document.getElementById('aiChatForm'),
    aiUserInput: document.getElementById('aiUserInput'),
    aiSendBtn: document.getElementById('aiSendBtn'),
    quickChipsScroll: document.getElementById('quickChipsScroll'),
    btnClearChat: document.getElementById('btnClearChat'),
    btnToggleAiConfig: document.getElementById('btnToggleAiConfig'),
    geminiConfigPanel: document.getElementById('geminiConfigPanel'),
    geminiApiKeyInput: document.getElementById('geminiApiKeyInput'),
    btnSaveApiKey: document.getElementById('btnSaveApiKey'),
    btnRemoveApiKey: document.getElementById('btnRemoveApiKey'),
    apiKeyStatus: document.getElementById('apiKeyStatus'),
    aiStatusLabel: document.getElementById('aiStatusLabel'),
    welcomeTime: document.getElementById('welcomeTime')
  };

  // -------------------------------------------------------------------------
  // INITIALIZATION
  // -------------------------------------------------------------------------
  function init() {
    applyAccessibilityPreferences();
    // Restore saved jurisdiction — sync select dropdown first
    elements.jurisdictionSelect.value = state.currentJurisdiction;
    updateJurisdictionUI();
    renderCurrentStage();
    calculateEligibility();
    renderQuickChips();
    setupEventListeners();

    if (elements.welcomeTime) {
      elements.welcomeTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Check if API key is stored
    const existingKey = aiEngine.getApiKey();
    if (existingKey) {
      elements.geminiApiKeyInput.value = existingKey;
      elements.apiKeyStatus.textContent = 'Using Google Gemini API (Live)';
      elements.apiKeyStatus.style.color = 'var(--success-color)';
      elements.btnRemoveApiKey.style.display = 'inline-block';
      elements.aiStatusLabel.textContent = 'Gemini Live Connected';
    }
  }

  // -------------------------------------------------------------------------
  // ACCESSIBILITY & THEME CONTROLS
  // -------------------------------------------------------------------------
  function applyAccessibilityPreferences() {
    elements.html.style.setProperty('--font-scale', state.fontScale);
    elements.body.setAttribute('data-theme', state.theme);
    elements.body.setAttribute('data-contrast', state.contrast);
    elements.btnThemeToggle.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  }

  function setFontScale(newScale) {
    state.fontScale = Math.min(Math.max(newScale, 0.85), 1.35);
    localStorage.setItem('election_font_scale', state.fontScale);
    elements.html.style.setProperty('--font-scale', state.fontScale);
  }

  function toggleHighContrast() {
    state.contrast = state.contrast === 'high' ? 'normal' : 'high';
    localStorage.setItem('election_contrast', state.contrast);
    elements.body.setAttribute('data-contrast', state.contrast);
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('election_theme', state.theme);
    elements.body.setAttribute('data-theme', state.theme);
    elements.btnThemeToggle.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  }

  // -------------------------------------------------------------------------
  // JURISDICTION SWITCHER
  // -------------------------------------------------------------------------
  function updateJurisdictionUI() {
    const jurKey = state.currentJurisdiction;
    const jur = ELECTION_DATA.jurisdictions[jurKey];
    aiEngine.setJurisdiction(jurKey);

    elements.jurFlag.textContent = jur.flag;
    elements.heroJurLabel.textContent = jur.name;
    elements.btnOfficialPortal.href = jur.officialPortal;
    elements.btnOfficialPortal.querySelector('span').textContent = `${jur.portalName} ↗`;

    // Update Quick Stats
    if (jurKey === 'us') {
      elements.statRegDeadline.textContent = '15 to 30 Days Prior';
      elements.statPollHours.textContent = '6:00 AM – 7:00 / 8:00 PM';
      elements.statIdPolicy.textContent = 'State Photo ID / Affidavits';
      elements.statHelpline.textContent = jur.hotline;
    } else if (jurKey === 'india') {
      elements.statRegDeadline.textContent = 'Form 6 (Qualifying Dates)';
      elements.statPollHours.textContent = '7:00 AM – 5:00 / 6:00 PM';
      elements.statIdPolicy.textContent = 'EPIC or 12 Approved IDs';
      elements.statHelpline.textContent = jur.hotline;
    } else if (jurKey === 'uk') {
      elements.statRegDeadline.textContent = '12 Working Days Prior';
      elements.statPollHours.textContent = '7:00 AM – 10:00 PM';
      elements.statIdPolicy.textContent = 'Photo ID or Free VAC';
      elements.statHelpline.textContent = jur.hotline;
    } else {
      elements.statRegDeadline.textContent = 'Electoral Register Freeze';
      elements.statPollHours.textContent = 'Standard Polling Hours';
      elements.statIdPolicy.textContent = 'Civil ID / Passport';
      elements.statHelpline.textContent = jur.hotline;
    }

    renderCurrentStage();
    calculateEligibility();
  }

  // -------------------------------------------------------------------------
  // STAGE-BASED TIMELINE RENDERING
  // -------------------------------------------------------------------------
  function renderCurrentStage() {
    const jur = ELECTION_DATA.jurisdictions[state.currentJurisdiction];
    const stage = jur.stages[state.currentStageIndex];

    // Update Stage Tab active classes & aria-selected
    elements.stageTabs.forEach((tab, idx) => {
      const isSelected = idx === state.currentStageIndex;
      tab.classList.toggle('active', isSelected);
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    const isFirstStage = state.currentStageIndex === 0;
    const isLastStage = state.currentStageIndex === jur.stages.length - 1;

    // Build Stage HTML
    let milestonesHtml = stage.milestones.map(m => `
      <div class="milestone-item">
        <div class="milestone-label">${escapeHtml(m.label)}</div>
        <div class="milestone-detail">${escapeHtml(m.detail)}</div>
      </div>
    `).join('');

    let requirementsHtml = stage.requirements.map(req => `
      <li style="margin-bottom: 0.5rem; padding-left: 0.25rem;">${escapeHtml(req)}</li>
    `).join('');

    let checklistHtml = stage.checklist.map(item => {
      const isChecked = !!state.stageChecklists[item.id];
      return `
        <label class="checklist-label" for="${item.id}">
          <input type="checkbox" id="${item.id}" data-task-id="${item.id}" ${isChecked ? 'checked' : ''}>
          <span>${escapeHtml(item.text)}</span>
        </label>
      `;
    }).join('');

    let faqsHtml = stage.faqs.map((faq, fIdx) => `
      <div class="faq-accordion-item" id="faq-item-${fIdx}">
        <button class="faq-trigger" aria-expanded="false" data-faq-idx="${fIdx}">
          <span>${escapeHtml(faq.q)}</span>
          <span class="faq-icon" aria-hidden="true">▾</span>
        </button>
        <div class="faq-content">
          <p>${escapeHtml(faq.a)}</p>
        </div>
      </div>
    `).join('');

    elements.stageContentWrapper.innerHTML = `
      <div class="stage-panel active" id="panel-stage-${state.currentStageIndex}" role="tabpanel" aria-labelledby="tab-stage-${state.currentStageIndex}">
        <!-- Stage Header -->
        <div class="stage-panel-header">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.45rem;">
              <span class="stage-status-badge">${stage.badge}</span>
              <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Phase ${state.currentStageIndex + 1} of 4</span>
            </div>
            <h3 class="stage-hero-title">${stage.title}</h3>
            <p class="stage-tagline">${stage.tagline}</p>
          </div>
          <button id="btnAskStageAi" class="btn-primary" data-stage-name="${escapeHtml(stage.title)}">
            <span>💬 Ask AI About This Phase</span>
          </button>
        </div>

        <!-- 2-Column Layout: Milestones & Requirements/Checklist -->
        <div class="stage-grid-layout">
          <!-- Col 1: Milestones & Dates -->
          <div class="stage-card">
            <h4 class="stage-card-title">
              <span>📅</span> Key Timelines & Deadlines
            </h4>
            <div class="milestone-timeline">
              ${milestonesHtml}
            </div>
          </div>

          <!-- Col 2: Mandatory Checklist & Requirements -->
          <div class="stage-card">
            <h4 class="stage-card-title">
              <span>✅</span> Action Items for This Phase
            </h4>
            <div class="checklist-container">
              ${checklistHtml}
            </div>
            <div style="margin-top: 1.25rem;">
              <strong style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; display: block; margin-bottom: 0.5rem;">Mandatory Criteria:</strong>
              <ul style="padding-left: 1.25rem; font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5;">
                ${requirementsHtml}
              </ul>
            </div>
          </div>
        </div>

        <!-- Stage Accordion FAQs -->
        <div class="stage-faq-section">
          <h4 style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>❓</span> Frequently Asked Questions for ${stage.title}
          </h4>
          <div class="faq-accordion-group">
            ${faqsHtml}
          </div>
        </div>

        <!-- Footer Navigation -->
        <div class="stage-footer-actions">
          <button id="btnPrevStage" class="btn-secondary" ${isFirstStage ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>
            <span>&larr; Previous Phase</span>
          </button>

          <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
            ${state.currentStageIndex + 1} / ${jur.stages.length}
          </div>

          <button id="btnNextStage" class="btn-primary" ${isLastStage ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>
            <span>Next Phase &rarr;</span>
          </button>
        </div>
      </div>
    `;

    // Attach listeners to new elements in the stage panel
    const btnNext = document.getElementById('btnNextStage');
    const btnPrev = document.getElementById('btnPrevStage');
    const btnAskStageAi = document.getElementById('btnAskStageAi');

    if (btnNext && !isLastStage) {
      btnNext.addEventListener('click', () => {
        state.currentStageIndex++;
        renderCurrentStage();
        document.querySelector('.timeline-section').scrollIntoView({ behavior: 'smooth' });
      });
    }

    if (btnPrev && !isFirstStage) {
      btnPrev.addEventListener('click', () => {
        state.currentStageIndex--;
        renderCurrentStage();
        document.querySelector('.timeline-section').scrollIntoView({ behavior: 'smooth' });
      });
    }

    if (btnAskStageAi) {
      btnAskStageAi.addEventListener('click', () => {
        const stageName = btnAskStageAi.getAttribute('data-stage-name');
        openAiDrawer();
        sendAiMessage(`Can you explain the key requirements and what I need to prepare for ${stageName}?`);
      });
    }

    // Accordion Toggle
    document.querySelectorAll('.faq-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.faq-accordion-item');
        const isOpen = item.classList.contains('open');
        // Toggle current item
        item.classList.toggle('open', !isOpen);
        trigger.setAttribute('aria-expanded', !isOpen);
      });
    });

    // Checklist state persistence
    document.querySelectorAll('.checklist-container input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const taskId = e.target.getAttribute('data-task-id');
        state.stageChecklists[taskId] = e.target.checked;
        localStorage.setItem('election_stage_checklists', JSON.stringify(state.stageChecklists));
      });
    });
  }

  // -------------------------------------------------------------------------
  // INTERACTIVE ELIGIBILITY & PERSONALIZED CHECKLIST TOOL
  // -------------------------------------------------------------------------
  function calculateEligibility() {
    let score = 0;
    const actions = [];
    const jur = ELECTION_DATA.jurisdictions[state.currentJurisdiction];

    // Age
    if (state.eligibilityAnswers.age === 'yes') {
      score += 20;
    } else if (state.eligibilityAnswers.age === 'soon') {
      score += 15;
      actions.push({
        text: `You can pre-register now! Ensure your 18th birthday falls on or before Election Day to cast your ballot.`,
        priority: 'medium'
      });
    } else {
      score += 0;
      actions.push({
        text: `You must be at least 18 on Election Day to vote. You can still become a civic volunteer or pre-register if permitted by state laws.`,
        priority: 'high'
      });
    }

    // Registration
    if (state.eligibilityAnswers.registration === 'registered') {
      score += 25;
    } else if (state.eligibilityAnswers.registration === 'moved') {
      score += 10;
      const addrFormText = state.currentJurisdiction === 'india' 
        ? 'Form 8 on voters.eci.gov.in' 
        : state.currentJurisdiction === 'uk'
        ? 'update your details at gov.uk/register-to-vote'
        : 'update your registration at Vote.gov / USA.gov';
      actions.push({
        text: `Submit an address change (${addrFormText}) immediately to avoid voting in the wrong precinct or constituency.`,
        priority: 'high'
      });
    } else {
      score += 0;
      actions.push({
        text: `Register to vote right away! Online registration takes under 2 minutes at ${jur.portalName}. Check if your state offers Same-Day Registration.`,
        priority: 'critical'
      });
    }

    // Photo ID
    if (state.eligibilityAnswers.id === 'have_id') {
      score += 25;
    } else if (state.eligibilityAnswers.id === 'alt_docs') {
      score += 15;
      actions.push({
        text: `Check your state/electoral board rules to see if your utility bill or student ID is accepted, or request a free state voter ID.`,
        priority: 'medium'
      });
    } else {
      score += 5;
      actions.push({
        text: `Obtain an accepted photo ID (or alternative documents like Aadhaar / Driving License). If challenged, request a Provisional Ballot.`,
        priority: 'high'
      });
    }

    // Polling Station
    if (state.eligibilityAnswers.polling === 'know_booth') {
      score += 15;
    } else if (state.eligibilityAnswers.polling === 'mail_in') {
      score += 15;
      actions.push({
        text: `Verify your mail-in / absentee ballot request was received, sign the outer envelope carefully, and mail early or use an official drop box.`,
        priority: 'medium'
      });
    } else {
      score += 5;
      actions.push({
        text: `Look up your assigned precinct polling location address and operating hours so you don't arrive at the wrong facility.`,
        priority: 'high'
      });
    }

    // Sample Ballot & Research
    if (state.eligibilityAnswers.ballot === 'researched') {
      score += 15;
    } else if (state.eligibilityAnswers.ballot === 'in_progress') {
      score += 10;
      actions.push({
        text: `Review down-ballot races (judges, local school boards, local referendums) so you aren't surprised in the voting booth.`,
        priority: 'low'
      });
    } else {
      score += 0;
      actions.push({
        text: `Download your official sample ballot from your county clerk's website and research candidate policy platforms.`,
        priority: 'medium'
      });
    }

    // Clamp score
    score = Math.min(Math.max(score, 0), 100);

    // Update Gauge & UI
    elements.scoreCircle.style.setProperty('--score-pct', score);
    elements.scoreValue.textContent = `${score}%`;

    if (score === 100) {
      elements.readinessHeading.textContent = '🎉 100% Prepared for Election Day!';
      elements.readinessSubtext.textContent = 'You have your registration, ID, polling booth, and ballot research in order.';
    } else if (score >= 70) {
      elements.readinessHeading.textContent = '👍 Almost Ready - Just a Few Steps Left!';
      elements.readinessSubtext.textContent = `You are ${score}% prepared. Complete the personalized tasks below.`;
    } else {
      elements.readinessHeading.textContent = '⚠️ Action Needed to Secure Your Vote';
      elements.readinessSubtext.textContent = 'Important voter registration or ID requirements still need your attention.';
    }

    // Render Action Steps
    if (actions.length === 0) {
      elements.actionStepsContainer.innerHTML = `
        <div class="action-step-item">
          <div class="action-step-badge" style="background: var(--success-subtle); color: var(--success-color);">✓</div>
          <div class="action-step-text">
            <strong>All systems go!</strong> Set an alarm for polling day morning and remember that if you are in line before poll closing time, you must be allowed to vote!
          </div>
        </div>
      `;
    } else {
      elements.actionStepsContainer.innerHTML = actions.map((act, idx) => `
        <div class="action-step-item">
          <div class="action-step-badge">${idx + 1}</div>
          <div class="action-step-text">${act.text}</div>
        </div>
      `).join('');
    }
  }

  // -------------------------------------------------------------------------
  // QUICK PROMPTS CHIPS & AI DRAWER
  // -------------------------------------------------------------------------
  function renderQuickChips() {
    elements.quickChipsScroll.innerHTML = ELECTION_DATA.quickPrompts.map(p => `
      <button class="chip-btn" data-query="${escapeHtml(p.text)}">
        <span>${escapeHtml(p.text)}</span>
      </button>
    `).join('');

    elements.quickChipsScroll.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.getAttribute('data-query');
        sendAiMessage(query);
      });
    });
  }

  function scrollChatToBottom(smooth = true) {
    if (!elements.aiMessagesContainer) return;
    requestAnimationFrame(() => {
      elements.aiMessagesContainer.scrollTo({
        top: elements.aiMessagesContainer.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
      // Safety pass to ensure complete bottom alignment after text reflow
      setTimeout(() => {
        if (elements.aiMessagesContainer) {
          elements.aiMessagesContainer.scrollTop = elements.aiMessagesContainer.scrollHeight;
        }
      }, 100);
    });
  }

  /**
   * Smoothly scrolls the chat container so that the START (top) of a message bubble
   * aligns near the top of the viewing area, allowing users to read immediately from the beginning.
   */
  function scrollMessageToTop(messageElement, smooth = true) {
    if (!messageElement || !elements.aiMessagesContainer) return;
    requestAnimationFrame(() => {
      const containerRect = elements.aiMessagesContainer.getBoundingClientRect();
      const messageRect = messageElement.getBoundingClientRect();
      const targetScrollTop = elements.aiMessagesContainer.scrollTop + (messageRect.top - containerRect.top) - 14;

      elements.aiMessagesContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: smooth ? 'smooth' : 'auto'
      });

      // Reflow safety pass
      setTimeout(() => {
        if (elements.aiMessagesContainer && messageElement) {
          const freshContainerRect = elements.aiMessagesContainer.getBoundingClientRect();
          const freshMessageRect = messageElement.getBoundingClientRect();
          if (freshMessageRect.top < freshContainerRect.top - 5 || freshMessageRect.top > freshContainerRect.top + 50) {
            const recheckTop = elements.aiMessagesContainer.scrollTop + (freshMessageRect.top - freshContainerRect.top) - 14;
            elements.aiMessagesContainer.scrollTop = Math.max(0, recheckTop);
          }
        }
      }, 120);
    });
  }

  function openAiDrawer() {
    elements.aiDrawer.classList.add('open');
    elements.aiDrawerBackdrop.classList.add('open');
    elements.aiDrawer.setAttribute('aria-hidden', 'false');
    elements.aiDrawerBackdrop.setAttribute('aria-hidden', 'false');
    scrollChatToBottom(false);
    setTimeout(() => {
      elements.aiUserInput.focus();
    }, 150);
  }

  function closeAiDrawer() {
    elements.aiDrawer.classList.remove('open');
    elements.aiDrawerBackdrop.classList.remove('open');
    elements.aiDrawer.setAttribute('aria-hidden', 'true');
    elements.aiDrawerBackdrop.setAttribute('aria-hidden', 'true');
    aiEngine.stopSpeaking();
  }

  async function sendAiMessage(queryText) {
    const text = queryText || elements.aiUserInput.value.trim();
    if (!text) return;

    // Reset input textarea
    elements.aiUserInput.value = '';
    elements.aiUserInput.style.height = 'auto';

    // Render User Bubble in chat thread
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    appendMessageBubble('user', text, timeStr);
    scrollChatToBottom(true);

    // Show 1-to-2 second visual typing indicator animation
    const typingId = appendTypingIndicator();
    elements.aiSendBtn.disabled = true;

    // Enforce 1.4-second visual typing indicator delay
    const minTypingDelay = new Promise(resolve => setTimeout(resolve, 1400));

    try {
      const [response] = await Promise.all([
        aiEngine.processQuery(text),
        minTypingDelay
      ]);

      removeTypingIndicator(typingId);

      if (response) {
        const bubble = appendMessageBubble('assistant', response.content, timeStr, response.sources, response.suggestions);
        scrollMessageToTop(bubble, true);
      }
    } catch (err) {
      removeTypingIndicator(typingId);
      const errBubble = appendMessageBubble('assistant', 'Sorry, I encountered an unexpected error processing your question. Please try again.', timeStr);
      scrollMessageToTop(errBubble, true);
      console.error(err);
    } finally {
      elements.aiSendBtn.disabled = false;
    }
  }

  function appendMessageBubble(role, content, timeStr, sources = [], suggestions = []) {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role}`;

    const formattedContent = formatMarkdown(content);

    let sourcesHtml = '';
    if (sources && sources.length > 0) {
      sourcesHtml = `
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.65rem; border-top: 1px solid var(--border-color); padding-top: 0.35rem;">
          <strong>Sources:</strong> ${sources.map(s => escapeHtml(s)).join(' • ')}
        </div>
      `;
    }

    let suggestionsHtml = '';
    if (suggestions && suggestions.length > 0) {
      suggestionsHtml = `
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.65rem;">
          ${suggestions.map(s => `<button class="chip-btn suggestion-chip" data-query="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
        </div>
      `;
    }

    bubble.innerHTML = `
      <div class="message-sender-meta">
        <span>${role === 'user' ? 'You' : 'Election Guide AI'}</span>
        <span>•</span>
        <span>${timeStr}</span>
      </div>
      <div class="message-body">
        ${formattedContent}
        ${sourcesHtml}
        ${suggestionsHtml}
      </div>
      ${role === 'assistant' ? `
        <div class="message-actions">
          <button class="action-icon-btn btn-speak" title="Listen to response" data-raw="${escapeHtml(content)}">
            <span>🔊 Read Aloud</span>
          </button>
          <button class="action-icon-btn btn-copy" title="Copy response to clipboard" data-raw="${escapeHtml(content)}">
            <span>📋 Copy</span>
          </button>
        </div>
      ` : ''}
    `;

    // Hook up copy and read aloud buttons
    const btnSpeak = bubble.querySelector('.btn-speak');
    if (btnSpeak) {
      btnSpeak.addEventListener('click', () => {
        const rawText = btnSpeak.getAttribute('data-raw');
        if (btnSpeak.classList.contains('speaking')) {
          aiEngine.stopSpeaking();
          btnSpeak.classList.remove('speaking');
          btnSpeak.innerHTML = '<span>🔊 Read Aloud</span>';
        } else {
          // Stop any other speaking button
          document.querySelectorAll('.btn-speak.speaking').forEach(b => {
            b.classList.remove('speaking');
            b.innerHTML = '<span>🔊 Read Aloud</span>';
          });

          aiEngine.speakText(
            rawText,
            () => {
              btnSpeak.classList.add('speaking');
              btnSpeak.innerHTML = '<span>⏹️ Stop</span>';
            },
            () => {
              btnSpeak.classList.remove('speaking');
              btnSpeak.innerHTML = '<span>🔊 Read Aloud</span>';
            }
          );
        }
      });
    }

    const btnCopy = bubble.querySelector('.btn-copy');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const rawText = btnCopy.getAttribute('data-raw');
        navigator.clipboard.writeText(rawText).then(() => {
          const original = btnCopy.innerHTML;
          btnCopy.innerHTML = '<span>✓ Copied!</span>';
          setTimeout(() => { btnCopy.innerHTML = original; }, 2000);
        });
      });
    }

    // Hook up suggestion chips
    bubble.querySelectorAll('.suggestion-chip').forEach(sBtn => {
      sBtn.addEventListener('click', () => {
        const query = sBtn.getAttribute('data-query');
        sendAiMessage(query);
      });
    });

    elements.aiMessagesContainer.appendChild(bubble);
    return bubble;
  }

  function appendTypingIndicator() {
    const id = 'typing-' + Date.now();
    const indicator = document.createElement('div');
    indicator.id = id;
    indicator.className = 'message-bubble assistant typing-bubble';
    indicator.innerHTML = `
      <div class="message-sender-meta">
        <span>Election Guide AI</span>
        <span>•</span>
        <span>Researching civic guidelines...</span>
      </div>
      <div class="message-body" style="padding: 0.65rem 1rem;">
        <div class="typing-indicator-wrapper">
          <div class="typing-indicator" aria-label="Election Guide AI is typing">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
          <span class="typing-status-text">Analyzing voting rules & preparing answer...</span>
        </div>
      </div>
    `;
    elements.aiMessagesContainer.appendChild(indicator);
    scrollChatToBottom(true);
    return id;
  }

  function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  // -------------------------------------------------------------------------
  // GLOBAL SEARCH & CHAT TRANSFER IMPLEMENTATION
  // -------------------------------------------------------------------------
  function setupSearch() {
    // 1. Transfer Search Bar Query to Chat Drawer on Submit
    if (elements.globalSearchForm) {
      elements.globalSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = elements.globalSearchInput.value.trim();
        if (!query) return;

        // Hide search suggestions dropdown
        elements.searchResultsDropdown.style.display = 'none';

        // Auto-open Chat Drawer immediately
        openAiDrawer();

        // Clear search input
        elements.globalSearchInput.value = '';
        elements.searchClearBtn.style.display = 'none';

        // Auto pre-populate and send to chat thread with typing animation
        sendAiMessage(query);
      });
    }

    // 2. Also listen for Enter key directly on the search input
    elements.globalSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = elements.globalSearchInput.value.trim();
        if (!query) return;

        elements.searchResultsDropdown.style.display = 'none';
        openAiDrawer();
        elements.globalSearchInput.value = '';
        elements.searchClearBtn.style.display = 'none';
        sendAiMessage(query);
      }
    });

    // 3. Live search dropdown suggestions
    elements.globalSearchInput.addEventListener('input', (e) => {
      const term = e.target.value.trim().toLowerCase();
      elements.searchClearBtn.style.display = term ? 'block' : 'none';

      if (term.length < 2) {
        elements.searchResultsDropdown.style.display = 'none';
        return;
      }

      const results = performSearch(term);
      renderSearchResults(results);
    });

    elements.searchClearBtn.addEventListener('click', () => {
      elements.globalSearchInput.value = '';
      elements.searchClearBtn.style.display = 'none';
      elements.searchResultsDropdown.style.display = 'none';
      elements.globalSearchInput.focus();
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!elements.searchResultsDropdown.contains(e.target) && e.target !== elements.globalSearchInput) {
        elements.searchResultsDropdown.style.display = 'none';
      }
    });
  }

  function performSearch(term) {
    const results = [];
    const jur = ELECTION_DATA.jurisdictions[state.currentJurisdiction];

    // Search Stages
    jur.stages.forEach((stage, sIdx) => {
      if (stage.title.toLowerCase().includes(term) || stage.tagline.toLowerCase().includes(term)) {
        results.push({
          type: 'Stage',
          title: stage.title,
          desc: stage.tagline,
          action: () => {
            state.currentStageIndex = sIdx;
            renderCurrentStage();
            document.querySelector('.timeline-section').scrollIntoView({ behavior: 'smooth' });
          }
        });
      }

      // Search Stage FAQs
      stage.faqs.forEach(faq => {
        if (faq.q.toLowerCase().includes(term) || faq.a.toLowerCase().includes(term)) {
          results.push({
            type: 'FAQ',
            title: faq.q,
            desc: faq.a.substring(0, 120) + '...',
            action: () => {
              openAiDrawer();
              sendAiMessage(faq.q);
            }
          });
        }
      });
    });

    // Search Universal FAQs
    ELECTION_DATA.universalFaqs.forEach(faq => {
      if (faq.q.toLowerCase().includes(term) || faq.a.toLowerCase().includes(term)) {
        results.push({
          type: 'Rights & Rules',
          title: faq.q,
          desc: faq.a.substring(0, 120) + '...',
          action: () => {
            openAiDrawer();
            sendAiMessage(faq.q);
          }
        });
      }
    });

    return results.slice(0, 6);
  }

  function renderSearchResults(results) {
    if (results.length === 0) {
      elements.searchResultsDropdown.innerHTML = `
        <div style="padding: 0.85rem; color: var(--text-muted); font-size: 0.85rem; text-align: center;">
          No direct match found. <button id="btnSearchAiFallback" style="color: var(--civic-primary); text-decoration: underline; font-weight: 600;">Ask Election AI &rarr;</button>
        </div>
      `;
      elements.searchResultsDropdown.style.display = 'block';

      const btn = document.getElementById('btnSearchAiFallback');
      if (btn) {
        btn.addEventListener('click', () => {
          elements.searchResultsDropdown.style.display = 'none';
          openAiDrawer();
          sendAiMessage(elements.globalSearchInput.value);
        });
      }
      return;
    }

    elements.searchResultsDropdown.innerHTML = results.map((r, i) => `
      <div class="search-result-item" data-res-idx="${i}" style="padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); cursor: pointer; transition: background 0.15s; border-bottom: 1px solid var(--border-color);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.2rem;">
          <strong style="font-size: 0.9rem; color: var(--text-primary);">${escapeHtml(r.title)}</strong>
          <span style="font-size: 0.7rem; background: var(--bg-surface-alt); padding: 0.15rem 0.4rem; border-radius: 4px; color: var(--text-muted);">${r.type}</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.3;">${escapeHtml(r.desc)}</div>
      </div>
    `).join('');

    elements.searchResultsDropdown.style.display = 'block';

    elements.searchResultsDropdown.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-surface-alt)'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
      item.addEventListener('click', () => {
        const idx = parseInt(item.getAttribute('data-res-idx'), 10);
        elements.searchResultsDropdown.style.display = 'none';
        results[idx].action();
      });
    });
  }

  // -------------------------------------------------------------------------
  // EVENT LISTENERS SETUP
  // -------------------------------------------------------------------------
  function setupEventListeners() {
    // Jurisdiction Selection
    elements.jurisdictionSelect.addEventListener('change', (e) => {
      state.currentJurisdiction = e.target.value;
      localStorage.setItem('election_jurisdiction', state.currentJurisdiction);
      updateJurisdictionUI();
    });

    // Accessibility Controls
    elements.btnFontDec.addEventListener('click', () => setFontScale(state.fontScale - 0.1));
    elements.btnFontReset.addEventListener('click', () => setFontScale(1.0));
    elements.btnFontInc.addEventListener('click', () => setFontScale(state.fontScale + 0.1));
    elements.btnHighContrast.addEventListener('click', toggleHighContrast);
    elements.btnThemeToggle.addEventListener('click', toggleTheme);

    // Stage Tabs
    elements.stageTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const stageIdx = parseInt(tab.getAttribute('data-stage'), 10);
        state.currentStageIndex = stageIdx;
        renderCurrentStage();
      });
    });

    // Eligibility Options change
    elements.questionCards.forEach(card => {
      const qKey = card.getAttribute('data-q');
      const chips = card.querySelectorAll('.option-chip');

      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          chips.forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          const input = chip.querySelector('input[type="radio"]');
          if (input) {
            input.checked = true;
            state.eligibilityAnswers[qKey] = input.value;
            calculateEligibility();
          }
        });
      });
    });

    // Save My Voter Checklist Button
    elements.btnPrintChecklist.addEventListener('click', () => {
      const jur = state.currentJurisdiction;

      // ── Things to carry ─────────────────────────────────────────────────
      const idItems = jur === 'india'
        ? [
            '🪪 Voter Photo ID Card (EPIC) — primary document',
            '📱 mVoter / Voter Helpline App with e-EPIC (accepted at many booths)',
            'As alternative (if EPIC not available): Aadhaar Card, Passport, Driving Licence, MNREGA Job Card, PAN Card, Smart Card (issued by RGI), Pension document with photo, Service ID card (Central/State/PSU employees), or Bank/Post Office Passbook with photo',
            '💧 Water bottle (booths may have queues)',
            '📋 Your polling slip / Voter Slip (if received — speeds up verification)',
            '✍️ A pen (optional — EVM/VVPAT requires no pen, but useful for address notes)',
            '📵 Keep mobile phone on silent — photography inside polling station is prohibited',
          ]
        : jur === 'us'
        ? [
            '🪪 State-issued photo ID or Voter ID card (requirements vary by state)',
            '📄 Proof of residence if required in your state (utility bill / bank statement)',
            '📋 Your Voter Registration confirmation / sample ballot',
            '🗺️ Your polling location address & operating hours (written down / screenshot)',
            '💧 Water bottle for queues',
            '📵 Mobile phone on silent — check your state rules on phones in the booth',
          ]
        : jur === 'uk'
        ? [
            '🪪 Valid Photo ID (Mandatory for UK Parliamentary elections: Passport, Driving Licence, Blue Badge, Bus Pass, PASS card, or free Voter Authority Certificate)',
            '📋 Polling card (the red card from your council — not mandatory, but speeds up check-in)',
            '🗺️ Confirmation of your polling station address (open 7:00 AM – 10:00 PM)',
            '💧 Water bottle for queues',
            '📵 Mobile phone on silent — photography inside the polling station is strictly prohibited',
          ]
        : [
            '🪪 National ID card / Passport as required by your electoral authority',
            '📋 Voter registration card / polling notification slip',
            '📄 Any additional document specified by your local electoral commission',
            '💧 Water bottle',
            '📵 Mobile phone on silent',
          ];

      // ── At the polling booth ─────────────────────────────────────────────
      const boothSteps = jur === 'india'
        ? [
            '1️⃣  Join the correct queue — separate queues for male / female voters at many booths.',
            '2️⃣  Show your Voter Slip and ID to the Presiding Officer at Table 1 (ID verification).',
            '3️⃣  Get your finger marked with indelible ink on the left forefinger.',
            '4️⃣  Sign / put thumb impression in the marked register at Table 2.',
            '5️⃣  Collect the ballot token / proceed to the EVM compartment.',
            '6️⃣  Press the blue button next to your chosen candidate on the EVM.',
            '7️⃣  The VVPAT slip will appear for ~7 seconds — confirm your choice visually.',
            '8️⃣  Exit the booth. Do not reveal your vote to anyone inside.',
          ]
        : jur === 'us'
        ? [
            '1️⃣  Check in at the registration table — poll worker verifies your registration.',
            '2️⃣  Show your required ID (varies by state — some need photo ID, others just signature).',
            '3️⃣  Sign the poll book or e-poll pad.',
            '4️⃣  Receive your ballot (paper ballot or voting machine instructions).',
            '5️⃣  Go to a private booth and make your selections — take your time.',
            '6️⃣  For paper: feed the ballot into the tabulator. For touchscreen: review and cast.',
            '7️⃣  Collect your "I Voted" sticker and exit.',
            '8️⃣  If you make a mistake on paper, ask for a replacement (spoiled ballot process).',
          ]
        : jur === 'uk'
        ? [
            '1️⃣  Give your name and address to the staff at the polling station table (or hand over your polling card).',
            '2️⃣  Show your valid accepted Photo ID to the polling staff for verification.',
            '3️⃣  Receive your ballot paper (stamped with the official mark).',
            '4️⃣  Go to a private polling booth compartment.',
            '5️⃣  Mark a single "X" in the box next to your chosen candidate (do NOT write anything else).',
            '6️⃣  Fold your ballot paper in half to protect your secret vote.',
            '7️⃣  Drop your folded ballot into the sealed black ballot box.',
            '8️⃣  Exit the polling station quietly.',
          ]
        : [
            '1️⃣  Present yourself at the verification desk with your ID and polling card.',
            '2️⃣  Complete any biometric or signature verification as required.',
            '3️⃣  Enter the private voting area and make your selection without disturbance.',
            '4️⃣  Submit your ballot via the designated machine or box.',
            '5️⃣  Exit quietly after voting.',
          ];

      // ── General tips ─────────────────────────────────────────────────────
      const generalTips = [
        '⏰ Arrive before peak hours (early morning or mid-afternoon to avoid long queues).',
        '👗 Wear neutral clothing — no party symbols, flags, or candidate names inside the booth.',
        '🔇 Maintain silence in and around the polling station.',
        '🚫 Canvassing, shouting slogans, or distributing material within 100m of a polling booth is illegal.',
        '🆘 Report any malpractice or intimidation immediately to the Presiding Officer or Election Commission helpline.',
        '♿ Priority assistance is available for senior citizens and persons with disabilities — request it at the entrance.',
        '📸 Photography inside the voting compartment is strictly prohibited.',
        '⚖️ Voting is a right — no one can compel you to vote for a specific candidate.',
      ];

      // ── Do NOT list ────────────────────────────────────────────────────────
      const doNots = [
        'Do NOT carry weapons or dangerous objects inside the polling station.',
        'Do NOT enter the voting booth with another person (unless you are an authorised companion for a person with disability).',
        'Do NOT reveal your vote inside or outside the polling station.',
        'Do NOT accept money, gifts, or free rides in exchange for your vote.',
        'Do NOT leave your ballot unmarked / partially marked intentionally to make it traceable.',
      ];

      const jurLabel = jur === 'india' 
        ? '🇮🇳 India (Lok Sabha / Vidhan Sabha)' 
        : jur === 'us' 
        ? '🇺🇸 United States Federal / State' 
        : jur === 'uk'
        ? '🇬🇧 United Kingdom General / Local Elections'
        : '🌐 General / International';
      const printDate = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

      const checklistHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Voter Checklist — Election Guide AI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; padding: 24px 32px; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 700; color: #1a1a2e; border-bottom: 3px solid #4f46e5; padding-bottom: 8px; margin-bottom: 4px; }
    .meta { font-size: 11px; color: #666; margin-bottom: 18px; }
    h2 { font-size: 14px; font-weight: 700; color: #4f46e5; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; border-left: 4px solid #4f46e5; padding-left: 8px; }
    ul { list-style: none; padding: 0; }
    li { padding: 5px 0 5px 24px; position: relative; border-bottom: 1px solid #f0f0f0; font-size: 12.5px; line-height: 1.5; }
    li::before { content: '☐'; position: absolute; left: 2px; color: #4f46e5; font-size: 14px; }
    .donot li::before { content: '✖'; color: #dc2626; }
    .tip li::before { content: '💡'; font-size: 11px; }
    .footer { margin-top: 24px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 8px; text-align: center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>🗳️ My Voter Checklist</h1>
  <div class="meta">${jurLabel} &nbsp;|&nbsp; Prepared: ${printDate} &nbsp;|&nbsp; Election Guide AI</div>

  <h2>📦 What to Carry to the Polling Booth</h2>
  <ul>${idItems.map(i => `<li>${i}</li>`).join('')}</ul>

  <h2>📋 Step-by-Step: At the Polling Booth</h2>
  <ul>${boothSteps.map(s => `<li>${s}</li>`).join('')}</ul>

  <h2 class="tip">General Tips & Reminders</h2>
  <ul class="tip">${generalTips.map(t => `<li>${t}</li>`).join('')}</ul>

  <h2>🚫 What NOT to Do</h2>
  <ul class="donot">${doNots.map(d => `<li>${d}</li>`).join('')}</ul>

  <div class="footer">This checklist is a personal reminder only and has no official status. Always follow instructions from the Presiding Officer and your country's Election Commission.</div>
</body>
</html>`;

      const win = window.open('', '_blank', 'width=780,height=900,scrollbars=yes');
      win.document.write(checklistHtml);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    });


    // Rights AI Button
    if (elements.btnAskRightsAi) {
      elements.btnAskRightsAi.addEventListener('click', () => {
        openAiDrawer();
        sendAiMessage("What are my statutory rights if an election worker challenges my vote or my name is missing?");
      });
    }

    // AI Drawer Open / Close
    elements.aiDrawerOpenBtn.addEventListener('click', openAiDrawer);
    elements.aiDrawerCloseBtn.addEventListener('click', closeAiDrawer);
    elements.aiDrawerBackdrop.addEventListener('click', closeAiDrawer);

    // Close on Escape Key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.aiDrawer.classList.contains('open')) {
        closeAiDrawer();
      }
    });

    // AI Chat Form Submit
    elements.aiChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendAiMessage();
    });

    // Auto-expand textarea
    elements.aiUserInput.addEventListener('input', () => {
      elements.aiUserInput.style.height = 'auto';
      elements.aiUserInput.style.height = `${Math.min(elements.aiUserInput.scrollHeight, 120)}px`;
    });

    // Enter key submits (Shift+Enter for newline)
    elements.aiUserInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAiMessage();
      }
    });

    // Clear Chat
    elements.btnClearChat.addEventListener('click', () => {
      if (confirm('Clear the conversation history?')) {
        aiEngine.chatHistory = [];
        elements.aiMessagesContainer.innerHTML = '';
        appendMessageBubble('assistant', 'Conversation cleared. How can I assist you with your voting questions today?', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    });

    // Toggle Gemini API Config Sub-panel
    elements.btnToggleAiConfig.addEventListener('click', () => {
      elements.geminiConfigPanel.classList.toggle('open');
    });

    // Save Gemini API Key
    elements.btnSaveApiKey.addEventListener('click', () => {
      const key = elements.geminiApiKeyInput.value.trim();
      aiEngine.setApiKey(key);
      if (key) {
        elements.apiKeyStatus.textContent = 'Using Google Gemini API (Live)';
        elements.apiKeyStatus.style.color = 'var(--success-color)';
        elements.btnRemoveApiKey.style.display = 'inline-block';
        elements.aiStatusLabel.textContent = 'Gemini Live Connected';
        alert('Gemini API Key saved! Live AI queries are now enabled.');
      } else {
        elements.apiKeyStatus.textContent = 'Running in built-in offline engine mode';
        elements.apiKeyStatus.style.color = 'var(--text-muted)';
        elements.btnRemoveApiKey.style.display = 'none';
        elements.aiStatusLabel.textContent = 'Knowledge Engine Ready';
      }
      elements.geminiConfigPanel.classList.remove('open');
    });

    // Remove Gemini API Key
    elements.btnRemoveApiKey.addEventListener('click', () => {
      aiEngine.setApiKey('');
      elements.geminiApiKeyInput.value = '';
      elements.apiKeyStatus.textContent = 'Running in built-in offline engine mode';
      elements.apiKeyStatus.style.color = 'var(--text-muted)';
      elements.btnRemoveApiKey.style.display = 'none';
      elements.aiStatusLabel.textContent = 'Knowledge Engine Ready';
      alert('Gemini API Key removed. Reverted to built-in knowledge engine.');
    });

    // Setup Search
    setupSearch();
  }

  // -------------------------------------------------------------------------
  // UTILITIES: Safe Markdown & HTML Escape
  // -------------------------------------------------------------------------
  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMarkdown(md) {
    if (!md) return '';

    let out = escapeHtml(md);

    // Headers
    out = out.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    out = out.replace(/^## (.*$)/gim, '<h2 style="font-size: 1.15rem; margin: 0.4rem 0;">$1</h2>');

    // Bold & Italics
    out = out.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    out = out.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Code inline
    out = out.replace(/`([^`]+)`/gim, '<code style="background: rgba(0,0,0,0.1); padding: 0.15rem 0.35rem; border-radius: 4px; font-family: monospace; font-size: 0.85em;">$1</code>');

    // Blockquotes
    out = out.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Links: [text](url)
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; font-weight: 600;">$1 ↗</a>');

    // Autolink bare URLs if not already inside an anchor tag
    out = out.replace(/(^|[^"'>])(https?:\/\/[^\s<]+)/gim, '$1<a href="$2" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; font-weight: 600;">$2 ↗</a>');

    // Bullet points (* item or - item)
    const lines = out.split('\n');
    let inList = false;
    const processedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('* ') || line.startsWith('- ')) {
        if (!inList) {
          processedLines.push('<ul>');
          inList = true;
        }
        processedLines.push(`<li>${line.substring(2)}</li>`);
      } else {
        if (inList) {
          processedLines.push('</ul>');
          inList = false;
        }
        if (line) {
          // Wrap paragraph if not header or blockquote
          if (!line.startsWith('<h') && !line.startsWith('<blockquote') && !line.startsWith('<ul') && !line.startsWith('</ul')) {
            processedLines.push(`<p style="margin-bottom: 0.5rem;">${line}</p>`);
          } else {
            processedLines.push(line);
          }
        }
      }
    }
    if (inList) {
      processedLines.push('</ul>');
    }

    return processedLines.join('\n');
  }

  // Run init
  init();
});

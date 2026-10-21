/**
 * Election Guide AI - Open-Domain Conversational Engine
 * Complete civic & electoral intelligence covering all voting questions:
 * - Precise semantic intent parser (differentiates creating an ID vs bringing an ID to vote)
 * - Comprehensive procedural guides (Form 6, Form 8, Form 6A, Voter Registration, Polling Booth rules)
 * - Deep legal & civic coverage (Ballot secrecy, cell phone bans, electioneering, absentee voting, PwD, NOTA)
 * - Open-Domain Civic Synthesizer for arbitrary voting/election questions
 * - Live Google Gemini API integration (open-domain election assistant system prompt)
 * - Web Speech Synthesis (TTS) read-aloud support
 */

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class ElectionAIEngine {
  escapeHtml(text) {
    return escapeHtml(text);
  }

  constructor(data) {
    this.data = data;
    this.currentJurisdiction = 'us';
    this.chatHistory = [];
    this.geminiApiKey = localStorage.getItem('election_ai_gemini_key') || '';
    this.selectedModel = localStorage.getItem('election_ai_model') || 'gemini-2.0-flash';
    this.speechSynthesis = window.speechSynthesis;
    this.currentUtterance = null;
    this.isSpeaking = false;
  }

  setJurisdiction(jur) {
    if (this.data.jurisdictions[jur]) {
      this.currentJurisdiction = jur;
    }
  }

  setApiKey(key) {
    this.geminiApiKey = key.trim();
    if (this.geminiApiKey) {
      localStorage.setItem('election_ai_gemini_key', this.geminiApiKey);
    } else {
      localStorage.removeItem('election_ai_gemini_key');
    }
  }

  getApiKey() {
    return this.geminiApiKey;
  }

  setModel(model) {
    this.selectedModel = model;
    localStorage.setItem('election_ai_model', model);
  }

  /**
   * Main query handler - determines whether to call Gemini API or built-in open-domain engine
   */
  async processQuery(userQuery, onStreamChunk = null) {
    const trimmed = userQuery.trim();
    if (!trimmed) return null;

    // Record user query in conversation history
    this.chatHistory.push({ role: 'user', content: trimmed, timestamp: new Date() });

    // 1. If user provided a Gemini API Key, try online open-domain generation
    if (this.geminiApiKey) {
      try {
        const geminiResponse = await this.callGeminiApi(trimmed);
        if (geminiResponse && geminiResponse.text) {
          const aiMsg = {
            role: 'assistant',
            content: geminiResponse.text,
            sources: ['Live Gemini API (' + this.selectedModel + ')', this.data.jurisdictions[this.currentJurisdiction].portalName],
            suggestions: this.generateFollowUpSuggestions(trimmed),
            timestamp: new Date()
          };
          this.chatHistory.push(aiMsg);
          return aiMsg;
        }
      } catch (err) {
        console.warn('Gemini API call failed, falling back to built-in open-domain election knowledge engine:', err);
      }
    }

    // 2. Built-in Open-Domain Civic Knowledge Engine
    const localResult = this.queryLocalKnowledgeBase(trimmed);
    const aiMsg = {
      role: 'assistant',
      content: localResult.content,
      sources: localResult.sources,
      suggestions: localResult.suggestions,
      highlight: localResult.highlight,
      timestamp: new Date()
    };
    this.chatHistory.push(aiMsg);
    return aiMsg;
  }

  /**
   * Call Google Gemini API (gemini-2.0-flash / gemini-1.5-flash)
   * Configured as an unrestricted open-domain election and civic assistant
   */
  async callGeminiApi(userQuery) {
    const jur = this.data.jurisdictions[this.currentJurisdiction];
    const systemPrompt = `You are "Election Guide AI", an authoritative, completely non-partisan, open-domain civic voting assistant.
Current Region: ${jur.name} (${jur.flag}).
Official Portal: ${jur.portalName} (${jur.officialPortal}).
Hotline: ${jur.hotline}.

Core Behavioral Guidelines:
1. UNRESTRICTED OPEN-DOMAIN ELECTION COVERAGE:
   You are an open-domain civic assistant. You must answer ANY general civic, procedural, legal, or registration question accurately using broad general knowledge. Examples of questions you must thoroughly answer include:
   - "How do I apply for / create a voter ID?"
   - "What are the rules for NRI / overseas voting?"
   - "How do I check my name on the electoral roll?"
   - State-specific or country-specific voting procedures, forms, and deadlines
   - Absentee, mail-in, service/military, student, and disabled voter rights
   - Voting machine mechanics, EVM/VVPAT, paper tabulators, recount rules
   - Running for office, party nominations, ballot access, and campaign finance

2. ACCURATE INTENT DISCRIMINATION:
   - If the user asks how to CREATE, APPLY FOR, or MAKE a voter ID, explain the application & registration process (Form 6, online portals, requirements, documents, e-EPIC).
   - If the user asks what IDs are ACCEPTED or REQUIRED AT THE POLLING BOOTH, list the approved photo IDs (12 approved IDs in India, state ID rules in US, accepted photo IDs in UK).
   - Do NOT confuse creating an ID with the document checklist for voting.

3. STANDARD STEP-BY-STEP GUIDANCE:
   Provide clear, numbered step-by-step guidance, mention official statutory forms (e.g. Form 6 / Form 8 for India, Vote.org / National Mail Voter Registration Form for US, gov.uk/register-to-vote for UK), official portal URLs, and acceptable documentation.

4. OBJECTIVE & NON-PARTISAN:
   Always remain completely neutral, balanced, and encouraging. Never endorse or criticize any political party or candidate.

5. FORMATTING:
   Use Markdown with headers (###), bullet points, bold key terms, and end with an actionable "Recommended Next Steps" section.`;

    const contents = [];
    const recentHistory = this.chatHistory.slice(-7);
    for (const h of recentHistory) {
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.selectedModel}:generateContent?key=${this.geminiApiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 1200
        }
      })
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API Error (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map(p => p.text).join('') || 'No response received.';
    return { text };
  }

  /**
   * Built-in Open-Domain Civic Knowledge Engine
   * Uses semantic intent classification to accurately distinguish between:
   * - Checking registration / voter list
   * - Creating / applying for a voter ID
   * - Bringing accepted IDs to vote
   * - And all other voting/election questions!
   */
  queryLocalKnowledgeBase(query) {
    const q = query.toLowerCase().trim();
    const jurKey = this.currentJurisdiction;
    const jur = this.data.jurisdictions[jurKey];

    // =========================================================================
    // INTENT: CHECK REGISTRATION / ELECTORAL ROLL / TRACK APPLICATION STATUS
    // (Checked BEFORE create/apply so queries like "how do i check if i am registered"
    // route to checking status rather than the registration form)
    // =========================================================================
    const isCheckingRegistration = this.hasAny(q, [
      'check my name', 'electoral roll', 'voter list', 'check name', 'search name',
      'am i registered', 'verify registration', 'search in roll', 'find name in list',
      'check registration', 'check my registration', 'registration status', 'check if i am registered',
      'check if i am already registered', 'already registered', 'am i registered to vote',
      'track status', 'track my form 6', 'track form 6', 'track application', 'track my application',
      'application status', 'check status', 'how do i check if i am registered',
      'how to check if i am registered', 'how to check if my name is on the electoral roll',
      'how to check if my name is on the voter list', 'how to check my name on the electoral roll',
      'electoral register', 'check if you are on the electoral register', 'check my registration status',
      'how do i check my registration status', 'how do i check if i am already registered'
    ]);

    if (isCheckingRegistration) {
      if (jurKey === 'india') {
        return {
          content: `### 🔍 How to Check Your Name on the Electoral Roll & Track Status (India)\n\nHaving your physical Voter ID card is **not enough**—your name **must be actively listed** in the current Electoral Roll to vote.\n\n#### 3 Easy Ways to Verify Your Name:\n1. **Online via ECI Portal (Recommended):**\n   * Go to [voters.eci.gov.in](https://voters.eci.gov.in) and click **'Search in Electoral Roll'**.\n   * **Option A: Search by EPIC No.** (Enter your 10-digit Voter ID number, State, and Captcha).\n   * **Option B: Search by Details** (Enter Name, Relative's Name, Date of Birth, State, and District).\n   * **Option C: Search by Mobile Number** (Instant OTP lookup).\n2. **ECI Voter Helpline Mobile App:**\n   * Open the app, tap *'Electoral Search'*, and scan the barcode on your EPIC card or enter your details.\n3. **SMS Service to 1950:**\n   * Send an SMS from your registered phone:\n     \`ECI <Your-10-Digit-EPIC>\` to **1950**.\n\n#### How to Track Form 6 Application Status:\n* Visit [voters.eci.gov.in](https://voters.eci.gov.in) and click **'Track Application Status'**.\n* Enter your Reference ID (generated when you submitted Form 6 or Form 8) and select your State.\n* You can view real-time progress: *Submitted -> BLO Appointed -> Field Verification -> Accepted / Rejected*.\n\n#### What If Your Name Is Missing?\n* If your name is not found, immediately submit **Form 6** on the portal before candidate nominations close in your constituency.\n* If you shifted residence, submit **Form 8** to transfer your roll to your new address.`,
          sources: ['voters.eci.gov.in', 'Election Commission of India Electoral Services'],
          suggestions: ['How to create a voter ID (Form 6)?', 'What is Form 8 used for?', 'What IDs are acceptable on polling day?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🔍 How to Check if You Are on the Electoral Register (UK)\n\nIn the UK, electoral registers are maintained by each local municipal council (Electoral Registration Office).\n\n#### How to Verify Your Registration Status:\n1. **Check Your Red Poll Card:**\n   * Before every major election, your local council posts a red **Poll Card** to every registered voter at your address. If you receive it, you are registered!\n2. **Contact Your Local Council Electoral Services:**\n   * Visit [gov.uk/get-on-electoral-register](https://www.gov.uk/get-on-electoral-register) and enter your postcode to get direct phone and email contact details for your local council's electoral registration team.\n   * Call or email them with your full name and address; they will confirm your status on the register within minutes.\n3. **Not Registered? Register in 5 Minutes:**\n   * Simply visit [gov.uk/register-to-vote](https://www.gov.uk/register-to-vote). Re-registering even if already on the list will safely update your details with zero penalty!\n\n> ⚠️ **Key Deadline:** You must register at least **12 working days** before election day to vote in that election.`,
          sources: ['GOV.UK (gov.uk/get-on-electoral-register)', 'The Electoral Commission UK'],
          suggestions: ['What photo ID do I need to vote in the UK?', 'How do I apply for a postal vote in the UK?', 'What is the voting age in the UK?']
        };
      } else {
        return {
          content: `### 🔍 How to Check Your Voter Registration Status (United States)\n\nStates periodically update their voter rolls. We strongly recommend verifying your registration status at least **30 to 45 days** before Election Day.\n\n#### How to Verify Your Registration:\n1. **Official National Tool:** Visit [Vote.gov Register & Check Status](https://vote.gov) or [USA.gov Confirm Voter Registration](https://www.usa.gov/confirm-voter-registration) to look up your active registration record directly through your state.\n2. **State Secretary of State Portal:** Every state operates an official voter lookup page (e.g., California MyVoter, Texas My Voter Portal, New York Voter Lookup).\n3. **What to Verify:**\n   * Correct spelling of your legal name.\n   * Exact current residential address (this determines your assigned polling precinct and congressional district).\n   * Party affiliation (crucial in states with *closed primaries*).\n\n> ⚠️ **If You Are Inactive or Dropped:** Re-register immediately online or check if your state allows **Same-Day Registration** at your polling station on Election Day.`,
          sources: ['Vote.gov (Official U.S. Voting Information)', 'USA.gov/confirm-voter-registration', 'National Association of State Election Directors'],
          suggestions: ['Can I register on Election Day?', 'How do I find my polling place?', 'What ID do I need to bring?']
        };
      }
    }

    // =========================================================================
    // INTENT: VOTER REGISTRATION DOCUMENTS (PROOF OF ADDRESS & AGE PROOF)
    // =========================================================================
    if (this.hasAny(q, [
      'address proof', 'proof of address', 'age proof', 'proof of age',
      'documents to register', 'documents for registration', 'documents needed to register',
      'what documents can i use as address proof', 'what documents count as proof of address',
      'what documents can i use as age proof', 'documents for form 6', 'proof of residency',
      'residency proof', 'documents to apply for voter id'
    ])) {
      if (jurKey === 'india') {
        return {
          content: `### 📄 Required Documents for Voter ID Registration (Form 6 - India)\n\nWhen applying for a new Voter ID (Form 6) on [voters.eci.gov.in](https://voters.eci.gov.in), you must upload **Proof of Age** and **Proof of Ordinary Residence**.\n\n#### 1. Acceptable Proof of Age Documents (Any ONE):\n* **Aadhaar Card**\n* **Birth Certificate** (issued by Municipal Authority or Registrar of Births)\n* **PAN Card**\n* **Indian Driving License**\n* **Class 10th or 12th Certificate / Marksheet** (bearing date of birth)\n* **Indian Passport**\n\n#### 2. Acceptable Proof of Ordinary Residence (Any ONE):\n* **Current Utility Bill** (Electricity, Water, or Piped Gas connection bill in the applicant's or immediate family's name)\n* **Aadhaar Card**\n* **Current Bank Passbook** (or Post Office passbook with photograph and residential address)\n* **Indian Passport**\n* **Registered Rent Agreement / Lease Deed**\n* **Revenue Department Land / House Ownership Deed**\n\n#### 3. Photograph:\n* One recent passport-size color photograph (white or light background, showing clear front-facing headshot).\n\n> 💡 **Tip:** Self-attest your photocopies before uploading PDFs/images (under 2MB) on the portal!`,
          sources: ['Election Commission of India Form 6 Guidelines', 'voters.eci.gov.in'],
          suggestions: ['How to apply for a voter ID card (Form 6)?', 'How to check my name on the electoral roll?', 'How to download e-EPIC?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 📄 Documents Needed to Register to Vote in the UK\n\nIn the UK, voter registration is completed online at [gov.uk/register-to-vote](https://www.gov.uk/register-to-vote).\n\n#### Primary Information Needed:\n* **National Insurance (NI) Number:** Found on your payslip, P60, official tax letters, or Department for Work and Pensions (DWP) correspondence.\n* **Date of Birth & Nationality**.\n* **Current Residential Address**.\n\n#### If You Do Not Have a National Insurance Number:\n* You can still register! Your local council's Electoral Registration Officer will request alternative identity documents, such as:\n  * Copy of your UK or foreign **Passport**.\n  * UK **Driving Licence** (full or provisional).\n  * **Biometric Residence Permit (BRP)**.\n  * Official council tax bill or utility statement showing proof of address.\n\n> ⏱️ Registration takes only **5 minutes** and must be completed at least **12 working days** before polling day.`,
          sources: ['GOV.UK (gov.uk/register-to-vote)', 'The Electoral Commission UK'],
          suggestions: ['What photo ID is accepted in the UK?', 'How to apply for a free Voter Authority Certificate (VAC)?', 'How do I apply for a postal vote in the UK?']
        };
      } else {
        return {
          content: `### 📄 Documents Needed to Register to Vote (United States)\n\nVoter registration requirements are standardized under the *National Voter Registration Act*:\n\n#### 1. For Online Registration (42+ States & D.C.):\n* **State Driver's License** or **State Non-Driver Photo ID Number**.\n* **Last 4 Digits of Social Security Number (SSN)**.\n* Current legal residential address.\n\n#### 2. For Mail-in / In-Person Registration (National Voter Registration Form):\n* If you do not have a State ID or Driver's License, provide the **last 4 digits of your SSN**.\n* If registering for the first time by mail without a state ID or SSN, federal law (HAVA) requires you to provide **Proof of Residency** when voting or registering:\n  * Current utility bill with your name and address.\n  * Bank statement.\n  * Government paycheck or check.\n  * Other official government document.\n\n> 💡 Register in under 2 minutes at [Vote.gov](https://vote.gov) or [USA.gov/register-to-vote](https://www.usa.gov/register-to-vote).`,
          sources: ['Vote.gov', 'USA.gov/register-to-vote', 'National Voter Registration Act (NVRA)'],
          suggestions: ['How do I register to vote?', 'What ID do I need to bring to the polls?', 'How do I find my polling place?']
        };
      }
    }

    // =========================================================================
    // INTENT: DOWNLOAD E-EPIC (DIGITAL VOTER ID)
    // =========================================================================
    if (this.hasAny(q, [
      'download e-epic', 'e-epic', 'digital voter id', 'download voter id',
      'download voter card', 'electronic voter card', 'how to download e-epic',
      'how do i download e-epic', 'e-epic download'
    ])) {
      if (jurKey === 'india') {
        return {
          content: `### 📱 How to Download e-EPIC (Digital Voter ID Card - India)\n\n**e-EPIC** is the official portable PDF version of your Electors Photo Identity Card (EPIC), issued with a secure QR code by the Election Commission of India. It is **100% legally valid at polling stations**!\n\n#### Step-by-Step Guide to Download e-EPIC:\n1. **Visit Official ECI Portal:** Go to [voters.eci.gov.in](https://voters.eci.gov.in) and click on **'E-EPIC Download'**.\n2. **Log In to Your Account:** Enter your registered mobile number and password (or sign up with OTP).\n3. **Enter Details:** Select search by **EPIC Number** (10-digit voter ID number) or **Form Reference Number**, then select your State.\n4. **OTP Verification:** Click *Send OTP*—a one-time password will be sent to the mobile number linked with your EPIC.\n5. **Download PDF:** Enter the OTP and click **'Download e-EPIC'**.\n\n#### DigiLocker Access:\n* You can also pull your e-EPIC into the official **DigiLocker App** under 'Election Commission of India' by entering your EPIC number.\n\n> ⚠️ **Note:** If your mobile number is not yet linked with your Voter ID, submit **Form 8** online for *Correction of Entries (Mobile Update)* first.`,
          sources: ['Election Commission of India (voters.eci.gov.in)', 'ECI e-EPIC User Guide'],
          suggestions: ['What IDs are accepted at the polling booth?', 'How to check my name on the electoral roll?', 'How to create a voter ID (Form 6)?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🪪 Digital Identification & UK Voting Credentials\n\n* **Does the UK Have a Digital Voter ID?** No, the UK does not use an electronic card like India's e-EPIC.\n* **Accepted In-Person Photo ID:** Under the *Elections Act 2022*, UK polling stations require you to show an **original physical Photo ID** (such as a Passport, Photocard Driving Licence, Blue Badge, or free Voter Authority Certificate).\n* **Digital Photos on Phones Not Accepted:** Polling clerks **cannot accept photos of IDs on a smartphone screen**. You must bring the physical original document.\n* **Free Physical ID:** If you lack photo ID, apply for a free physical **Voter Authority Certificate (VAC)** at [gov.uk/apply-for-photo-id-voter-authority-certificate](https://www.gov.uk/apply-for-photo-id-voter-authority-certificate).`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Elections Act 2022'],
          suggestions: ['What photo ID is accepted in the UK?', 'How to apply for a free Voter Authority Certificate (VAC)?', 'How do I register to vote in the UK?']
        };
      } else {
        return {
          content: `### 🪪 Digital Voter Cards & Online Verification (United States)\n\n* **Digital Voter Certificates:** In the United States, several states allow registered voters to download or print a **Digital Voter Registration Certificate** from their state's Secretary of State online voter portal.\n* **Digital Driver's Licenses (mDL):** Some states (e.g., Colorado, California, Louisiana, Arizona) have begun testing or accepting state-issued Mobile Driver's Licenses (mDLs) stored in Apple Wallet or Google Wallet, but rules vary by county.\n* **Best Practice for Polling Day:** Always bring your physical government-issued photo ID (Driver's License, State ID, U.S. Passport) to avoid any technical complications.\n* **Check Status Online:** Look up your official digital registration record at [Vote.gov](https://vote.gov).`,
          sources: ['Vote.gov', 'USA.gov/confirm-voter-registration', 'National Conference of State Legislatures (NCSL)'],
          suggestions: ['What ID do I need to bring to the polls?', 'How do I check if I am registered to vote?', 'How does a provisional ballot work?']
        };
      }
    }

    // =========================================================================
    // INTENT: UK VOTER AUTHORITY CERTIFICATE (VAC)
    // =========================================================================
    if (this.hasAny(q, [
      'voter authority certificate', 'what is a vac', 'what is vac',
      'apply for a voter authority certificate', 'apply for vac', 'free voter id uk',
      'free photo id uk', 'how do i apply for a voter authority certificate',
      'how to apply for a free voter authority certificate', 'how to apply for a voter authority certificate',
      'free voter authority certificate'
    ])) {
      if (jurKey === 'uk') {
        return {
          content: `### 🪪 What is a Voter Authority Certificate (VAC) & How to Apply (UK)\n\nA **Voter Authority Certificate (VAC)** is a free, official photo identity document issued by your local council to ensure that **no eligible voter is disenfranchised** under the UK's photo ID rules (*Elections Act 2022*).\n\n#### Who Needs a VAC?\n* You should apply if you do **not** have an accepted form of photo ID (e.g., UK/EEA Passport, Driving Licence, Blue Badge, or qualifying Bus Pass).\n* You can also apply if your existing photo ID no longer looks like you, or the name on your ID does not match your name on the Electoral Register.\n\n#### How to Apply (Takes ~5 Minutes):\n1. **Apply Online (Quickest):** Visit [gov.uk/apply-for-photo-id-voter-authority-certificate](https://www.gov.uk/apply-for-photo-id-voter-authority-certificate).\n2. **Information Required:**\n   * Your **National Insurance number** (or alternative proof of identity).\n   * A recent **passport-style digital photograph** (taken against a plain light background).\n   * Your full name, date of birth, and registered address.\n3. **Apply by Post:** You can also download a paper form from GOV.UK and post it to your local council's Electoral Registration Office.\n\n#### Delivery & Validity:\n* Your local council prints and posts the physical certificate to your home address free of charge.\n* **No Expiry Date:** A VAC does not have an expiration date, but you should renew it if your appearance changes significantly.\n\n> ⏱️ **Crucial Deadline:** You must apply by **5:00 PM, 6 working days before polling day** to use it in that election!`,
          sources: ['GOV.UK (gov.uk/apply-for-photo-id-voter-authority-certificate)', 'The Electoral Commission UK', 'Elections Act 2022'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I apply for a postal vote in the UK?', 'What time do UK polls close?']
        };
      } else {
        return {
          content: `### 🪪 Voter Authority Certificate (VAC) - UK Voting Information\n\nA **Voter Authority Certificate (VAC)** is specifically a **United Kingdom electoral mechanism** introduced under the UK *Elections Act 2022* for voters who do not possess a standard photo ID (passport or driving licence).\n\n* **In the United States:** Free state voter ID cards are provided by state DMVs or county election offices for voters in strict photo ID states.\n* **In India:** If you lack a Voter ID (EPIC), you can vote with **any of the 12 approved alternative photo documents** (Aadhaar, Driving License, PAN, Passport, etc.).`,
          sources: ['The Electoral Commission UK', 'Elections Act 2022'],
          suggestions: ['What ID do I need to vote?', 'How to check my name on the electoral roll?', 'How does a provisional ballot work?']
        };
      }
    }

    // =========================================================================
    // INTENT: PROXY VOTING
    // =========================================================================
    if (this.hasAny(q, ['proxy vote', 'proxy voting', 'vote by proxy', 'can i vote by proxy'])) {
      if (jurKey === 'uk') {
        return {
          content: `### 👥 Proxy Voting in the United Kingdom\n\nIf you cannot vote in person on polling day, you can appoint someone you trust to vote on your behalf at your assigned polling station—this is called a **Proxy Vote**.\n\n#### Key Rules for Proxy Voting:\n* **Who Can Be Your Proxy:** Anyone aged 18+ who is also registered to vote and legally eligible. A person can only act as proxy for up to **2 voters** (or up to 4 if voting for close relatives living overseas).\n* **Photo ID Requirement:** Your proxy must take their **own accepted photo ID** to your polling station when casting your vote.\n\n#### How to Apply:\n1. **Apply Online:** Visit [gov.uk/apply-proxy-vote](https://www.gov.uk/apply-proxy-vote).\n2. **Application Deadline:** Apply by **5:00 PM, 6 working days before polling day**.\n3. **Emergency Proxy:** If you experience a medical emergency or work summons arising after the deadline, you can apply for an **Emergency Proxy Vote** up to **5:00 PM on Election Day**!\n\n> 💡 **Postal Proxy:** If your appointed proxy lives far away, they can apply to cast their proxy vote by post!`,
          sources: ['GOV.UK (gov.uk/apply-proxy-vote)', 'The Electoral Commission UK', 'Representation of the People Act 1983'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I apply for a postal vote in the UK?', 'What time do UK polls close?']
        };
      } else if (jurKey === 'india') {
        return {
          content: `### 👥 Proxy Voting in India (Classified Service Voters Only)\n\nIn India, **general citizens CANNOT vote by proxy**:\n\n* **In-Person EVM Requirement:** Under the *Conduct of Elections Rules, 1961*, general citizens must cast their vote in person at their designated EVM booth.\n* **Armed Forces Exception:** Members of the Armed Forces and paramilitary personnel posted away from home (Classified Service Voters) can appoint a **Proxy Voter** using **Form 13F**.\n* The appointed proxy must be an adult resident of the same constituency and will sign on the elector's behalf at the polling station.\n\n> 👵 **Senior Citizens & PwD:** Eligible for **Home Voting (Form 12D)** where an ECI team collects your postal ballot in secret at your residence!`,
          sources: ['Conduct of Elections Rules 1961 (Part III)', 'ECI Service Voters Guidelines'],
          suggestions: ['What are the rules for armed forces voters?', 'How does home voting work for senior citizens (Form 12D)?', 'What documents can I carry to vote in India?']
        };
      } else {
        return {
          content: `### 👥 Proxy Voting in the United States\n\nIn the United States, **voting by proxy is generally not permitted** in federal, state, or municipal public elections:\n\n* **One Person, One Vote:** Every voter must personally mark and cast their own ballot—either in person at the polls or by signing their own mail-in/absentee ballot certificate.\n* **Assistance in the Booth:** If you need physical assistance due to a disability or language barrier, you may bring a companion or ask a poll worker to assist you, but the choices must be yours.\n* **Designated Ballot Return (Agent Delivery):** In cases of sudden medical emergency or hospitalization, several states allow a designated family member or agent to deliver your sealed, signed absentee ballot to the clerk.`,
          sources: ['National Conference of State Legislatures (NCSL)', 'Help America Vote Act (HAVA)'],
          suggestions: ['How do mail-in ballots work?', 'How do I find my polling place?', 'What is a provisional ballot?']
        };
      }
    }

    // =========================================================================
    // INTENT: ELECTORAL SYSTEM / FIRST PAST THE POST (FPTP)
    // =========================================================================
    if (this.hasAny(q, [
      'first past the post', 'fptp', 'how does first past the post work',
      'first past the post work', 'plurality voting', 'how are mps elected',
      'how is mp elected', 'electoral system'
    ])) {
      if (jurKey === 'uk') {
        return {
          content: `### 🗳️ How First Past the Post (FPTP) Works in the UK\n\nUK Parliamentary General Elections use the **First Past the Post (FPTP)** plurality voting system to elect Members of Parliament (MPs) to the House of Commons:\n\n#### How the System Works:\n1. **650 Constituencies:** The UK is divided into 650 local geographic areas called constituencies. Each constituency elects exactly **one MP**.\n2. **One Vote Per Citizen:** On your paper ballot, you place a single **"X"** next to your preferred candidate.\n3. **Plurality Winner:** The candidate who receives the **most votes** in that constituency wins the seat. They do **not** need an absolute majority (over 50%)—simply more votes than any single rival.\n4. **Forming Government:**\n   * The political party that wins **326 or more seats** (out of 650) secures an absolute parliamentary majority.\n   * The leader of that party is invited by the Monarch to become Prime Minister and form His Majesty's Government.\n   * **Hung Parliament:** If no party reaches 326 seats, parties may form a formal coalition or a confidence-and-supply agreement.`,
          sources: ['UK Parliament (parliament.uk)', 'The Electoral Commission UK'],
          suggestions: ['What photo ID is accepted in the UK?', 'What time do UK polls close?', 'How do I find my UK polling station?']
        };
      } else if (jurKey === 'india') {
        return {
          content: `### 🗳️ First Past the Post (FPTP) in India (Lok Sabha & Vidhan Sabha)\n\nIndia's direct legislative elections use the **First Past the Post (FPTP)** system:\n\n* **543 Parliamentary Constituencies:** For Lok Sabha (Parliament), the country is divided into 543 single-member constituencies.\n* **Simple Plurality:** The candidate securing the highest number of valid EVM and postal votes in their constituency is declared elected by the Returning Officer (RO).\n* **Forming Union Government:** The political party or pre-poll coalition that wins **272 or more seats** commands a majority and forms the Government of India, with their leader sworn in as Prime Minister.\n* **State Assemblies (Vidhan Sabha):** State elections use the exact same FPTP single-member constituency formula to elect MLAs.`,
          sources: ['Constitution of India (Article 81)', 'Representation of the People Act 1951'],
          suggestions: ['How does the EVM and VVPAT process work?', 'What is NOTA on the EVM?', 'What are my voter rights at the polling station?']
        };
      } else {
        return {
          content: `### 🗳️ Electoral Systems in the United States\n\n* **Congressional & State Elections:** Most U.S. House, Senate, and state legislative races operate on **plurality voting (First Past the Post)**, where the candidate with the most votes wins.\n  * Select states (e.g., Georgia, Louisiana) require a runoff if no candidate exceeds 50%.\n  * States like Maine and Alaska use **Ranked-Choice Voting (RCV)** for federal elections.\n* **Presidential Elections (Electoral College):** The President is elected by the **538-member Electoral College**.\n  * In 48 states and D.C., the winner of the state popular vote wins all of that state's electors (Winner-Take-All).\n  * A candidate needs **270 electoral votes** to win the presidency.`,
          sources: ['U.S. National Archives (Electoral College)', 'National Conference of State Legislatures (NCSL)'],
          suggestions: ['How do I find my polling place?', 'What is a provisional ballot?', 'What ID do I need to vote?']
        };
      }
    }

    // =========================================================================
    // INTENT: ARMED FORCES & SERVICE VOTERS
    // =========================================================================
    if (this.hasAny(q, [
      'armed forces', 'service voter', 'military voter', 'military voting',
      'service voters', 'etpbs', 'defence personnel', 'rules for armed forces',
      'armed forces voters', 'rules for armed forces voters'
    ])) {
      if (jurKey === 'india') {
        return {
          content: `### 🎖️ Voting Rules for Armed Forces & Service Voters in India\n\nUnder Section 20 of the *Representation of the People Act, 1950*, members of the Indian Armed Forces, paramilitary forces, and personnel posted outside their home state qualify as **Service Voters**:\n\n#### 1. How Service Voters Vote:\n* **ETPBS (Electronically Transmitted Postal Ballot System):**\n  * Ballots are encrypted and transmitted digitally to the unit record office.\n  * The service voter prints the ballot paper and postal declaration (Form 13A), marks their vote in secret, and posts it via India Post Speed Post free of charge.\n* **Proxy Voting (Form 13F):**\n  * Classified Service Voters can appoint an adult relative/friend living in their home constituency as their **Proxy Voter**.\n  * The proxy receives an ink mark and votes on the EVM on their behalf.\n\n#### 2. Registration (Form 2 / 2A / 3):\n* Service voters register through their respective Commanding Officers / Record Offices with the ECI.`,
          sources: ['Representation of the People Act 1950 (Section 20)', 'Conduct of Elections Rules 1961', 'ETPBS Portal'],
          suggestions: ['How does the EVM and VVPAT process work?', 'How to check my name on the electoral roll?', 'What documents can I carry to vote in India?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🎖️ Armed Forces Voting in the United Kingdom\n\nMembers of the British Armed Forces (Army, Royal Navy, RAF) and their qualifying spouses/civil partners have dedicated voting provisions:\n\n* **Service Voter Registration:** Register as a **Service Voter** at [gov.uk/register-to-vote-armed-forces](https://www.gov.uk/register-to-vote-armed-forces). This registration remains valid for **5 years** without needing annual renewal.\n* **How to Vote When Deployed:**\n  * **Postal Vote:** Ballots are mailed via British Forces Post Office (BFPO).\n  * **Proxy Vote (Recommended for Deployments):** Appoint someone in the UK to vote on your behalf at your home polling station.\n* **Photo ID:** If voting in person at a UK polling station, a Ministry of Defence Form 90 (Defence ID Card) is an accepted photo ID!`,
          sources: ['GOV.UK (gov.uk/register-to-vote-armed-forces)', 'The Electoral Commission UK'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I apply for a postal vote in the UK?', 'Can I vote by proxy in the UK?']
        };
      } else {
        return {
          content: `### 🎖️ Military & Overseas Voting (United States - UOCAVA)\n\nUnder the **Uniformed and Overseas Citizens Absentee Voting Act (UOCAVA)**, active-duty military personnel, merchant marine, and their families stationed domestically or abroad are protected:\n\n* **Federal Post Card Application (FPCA):** Submit the FPCA annually at [FVAP.gov](https://www.fvap.gov) to register and request absentee ballots for all elections in that calendar year.\n* **45-Day Advance Delivery:** Ballots must be sent to military voters at least **45 days** before federal elections.\n* **Emergency Ballot (FWAB):** If your official ballot is delayed, download the **Federal Write-In Absentee Ballot** at FVAP.gov to ensure your vote is counted.`,
          sources: ['Federal Voting Assistance Program (FVAP.gov)', 'UOCAVA (52 U.S.C. § 20301)'],
          suggestions: ['How do mail-in ballots work?', 'How do I track my absentee ballot?', 'What is a provisional ballot?']
        };
      }
    }

    // =========================================================================
    // INTENT: VOTER REGISTRATION DEADLINES
    // =========================================================================
    if (this.hasAny(q, [
      'registration deadline', 'registration deadlines', 'deadline to register',
      'deadlines in my state', 'registration deadlines in my state', 'cutoff to register',
      'last date to register', 'when to register', 'what are the registration deadlines'
    ])) {
      if (jurKey === 'india') {
        return {
          content: `### 🗓️ Voter Registration Deadlines in India\n\n* **The Nomination Freeze (Statutory Cutoff):** Under Section 23(3) of the *Representation of the People Act, 1950*, the electoral roll for an assembly or parliamentary constituency **freezes on the last date of candidate nominations** (typically 2 to 3 weeks before polling day).\n* **Continuous Updating:** Form 6 (new registration) and Form 8 (address transfer) can be submitted throughout the year, but must be approved before nominations close to vote in the current election cycle.\n* **Advance Registration at 17:** Young citizens turning 18 can pre-apply throughout the year on [voters.eci.gov.in](https://voters.eci.gov.in) with qualifying dates: Jan 1, Apr 1, Jul 1, Oct 1.`,
          sources: ['Representation of the People Act 1950 (Section 23)', 'voters.eci.gov.in'],
          suggestions: ['How to apply for a voter ID (Form 6)?', 'How to check my name on the electoral roll?', 'What documents can I carry to vote in India?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🗓️ UK Voter Registration Deadlines\n\n* **Strict 12 Working Days Deadline:** Under the *Representation of the People Regulations*, your application to register on the Electoral Register must be received by **11:59 PM, 12 working days before polling day**.\n* **Voter Authority Certificate (VAC) Deadline:** Apply by **5:00 PM, 6 working days before polling day** if you need free photo ID.\n* **Postal Vote Deadline:** Apply by **5:00 PM, 11 working days before polling day**.\n* **Proxy Vote Deadline:** Apply by **5:00 PM, 6 working days before polling day**.\n\n> 💡 Register in 5 minutes online at [gov.uk/register-to-vote](https://www.gov.uk/register-to-vote).`,
          sources: ['GOV.UK (gov.uk/register-to-vote)', 'The Electoral Commission UK'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I apply for a postal vote in the UK?', 'What is a Voter Authority Certificate (VAC)?']
        };
      } else {
        return {
          content: `### 🗓️ Voter Registration Deadlines (United States)\n\nVoter registration deadlines depend entirely on state law:\n\n* **States with Pre-Registration Deadlines (15 to 30 Days Before Election):** In states without same-day registration (e.g., Texas, Georgia, Florida, Arizona), online or postmarked mail registration closes **28 to 30 days** before Election Day.\n* **States with Same-Day Registration (22+ States & D.C.):** In states like California, Colorado, Michigan, Nevada, Washington, and Wisconsin, there is **no strict cutoff**—you can register and vote on the very same day at your polling site with proof of residency!\n* **Check Your State Deadline:** Visit [Vote.gov Deadlines](https://vote.gov) or [USA.gov/voter-registration-deadlines](https://www.usa.gov/voter-registration-deadlines).`,
          sources: ['Vote.gov', 'USA.gov/voter-registration-deadlines', 'National Conference of State Legislatures (NCSL)'],
          suggestions: ['Can I register on Election Day?', 'How do I check if I am registered to vote?', 'What ID do I need to bring to the polls?']
        };
      }
    }

    // =========================================================================
    // INTENT: TRACKING MAIL-IN / ABSENTEE BALLOTS
    // =========================================================================
    if (this.hasAny(q, [
      'track my ballot', 'track my mail ballot', 'track my absentee ballot',
      'where is my ballot', 'ballot tracking', 'track absentee',
      'how do i track my mail ballot', 'how do i track my absentee ballot'
    ])) {
      if (jurKey === 'us') {
        return {
          content: `### 📮 How to Track Your Mail-in / Absentee Ballot (United States)\n\nIn the U.S., most states and counties provide official **Ballot Tracking Portals** (such as *BallotTrax* or *Where's My Ballot?*):\n\n#### Step-by-Step Tracking:\n1. **State Tracking Tool:** Visit [Vote.gov](https://vote.gov) or your state Secretary of State elections page to access your county's ballot tracker.\n2. **Sign Up for Alerts:** Enter your name, DOB, and zip code to sign up for automated SMS and email notifications at each milestone:\n   * **Mailed:** Ballot printed and dispatched to your mailbox via USPS.\n   * **Received:** Completed ballot received by your county elections office.\n   * **Verified & Accepted:** Signature verified and ballot approved for counting.\n3. **Signature Curing:** If your signature is flagged as mismatched, state law gives you a **48 to 72-hour curing window** to verify your identity with the county clerk so your vote is counted!`,
          sources: ['Vote.gov Absentee & Mail Voting Guide', 'National Association of State Election Directors'],
          suggestions: ['How do mail-in ballots work?', 'What is a provisional ballot?', 'How do I find my polling place?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 📮 Postal Vote Tracking in the United Kingdom\n\n* **Royal Mail Delivery:** When you apply for a UK postal vote, your pack is dispatched via Royal Mail approximately **2 weeks before election day**.\n* **Tracking Your Pack:** Local councils do not operate live barcode tracking like U.S. states, but you can contact your local council's **Electoral Services office** directly to verify that your returned postal pack was received.\n* **Hand Delivery Guarantee:** If you are concerned about postal delays, you can hand-deliver your completed postal pack to your local council office or to your assigned polling station on election day before **10:00 PM** (you will fill out a short postal return form).`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Representation of the People Act 1983'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I apply for a postal vote in the UK?', 'What time do UK polls close?']
        };
      } else {
        return {
          content: `### 📮 Postal Ballot Tracking in India\n\n* **Senior Citizens & PwD Home Voting (Form 12D):** A dedicated mobile polling team visits your home on scheduled dates with police protection. Your sealed postal ballot envelope is deposited into a mobile ballot box in your presence.\n* **Service Voters (ETPBS):** Armed forces personnel track postal dispatch receipts via India Post Speed Post directly to their Returning Officer (RO).`,
          sources: ['ECI Postal Ballot Guidelines', 'Conduct of Elections Rules 1961'],
          suggestions: ['How does home voting work for senior citizens (Form 12D)?', 'What documents can I carry to vote in India?', 'How to find my polling booth?']
        };
      }
    }

    // =========================================================================
    // INTENT: ASSISTANCE IN BOOTH & MACHINE ISSUES / POLL WORKER HELP
    // =========================================================================
    if (this.hasAny(q, [
      'ask a poll worker for help', 'machine jams', 'machine malfunction',
      'help in the booth', 'assistance in the booth', 'can someone help me vote',
      'spoiled ballot', 'can i ask a poll worker'
    ])) {
      if (jurKey === 'us') {
        return {
          content: `### 🤝 Polling Place Help, Machine Malfunctions & Spoiled Ballots (United States)\n\nFederal and state laws guarantee your right to a fair, trouble-free voting experience:\n\n#### 1. Asking a Poll Worker for Help:\n* You have the legal right to ask bipartisan poll workers to demonstrate how to use the voting machine, explain ballot instructions, or clarify procedures. Poll workers **cannot ask who you are voting for** or tell you how to vote.\n\n#### 2. Bringing an Assistant:\n* Under federal law (*Voting Rights Act § 208*), voters who need assistance due to blindness, physical disability, or inability to read English may be assisted by **any person of their choice**, except their employer or union representative.\n\n#### 3. If a Machine Jams or Displays an Error:\n* **Do not walk away!** Alert an election worker immediately. A bipartisan technician will clear the tabulator. Your vote will either be verified on the screen or you will be issued a fresh ballot.\n\n#### 4. Spoiled Ballots (Mistakes on Paper):\n* If you accidentally mark the wrong candidate or tear your paper ballot, return it to the poll clerk. They will mark it *"Spoiled"* in the ledger and issue you a fresh, clean ballot!`,
          sources: ['Voting Rights Act 1965 (§ 208)', 'Help America Vote Act (HAVA)', 'U.S. Election Assistance Commission'],
          suggestions: ['What ID do I need to bring to the polls?', 'How does a provisional ballot work?', 'How do I find my polling place?']
        };
      } else if (jurKey === 'india') {
        return {
          content: `### 🤝 Assistance in the Booth & EVM Error Protocol (India)\n\n* **Companion Assistance (Rule 49N):** Electors with visual impairment or physical infirmity can bring an adult companion aged 18+ into the voting compartment to record their vote. The companion must sign a declaration of secrecy in Form 14A.\n* **Presiding Officer Help:** You can ask the Presiding Officer to explain how the EVM and VVPAT work before entering the compartment.\n* **If the EVM Malfunctions:** In the rare event an EVM shows an error or battery alert, polling is paused. The Presiding Officer and Sector Officer replace the unit under candidate agent scrutiny—**all votes recorded prior to the error are safely stored in the machine's memory and are never lost**!`,
          sources: ['Conduct of Elections Rules 1961 (Rule 49N)', 'ECI EVM Manual'],
          suggestions: ['How does the EVM and VVPAT process work?', 'What documents can I carry to vote in India?', 'What are my voter rights at the polling station?']
        };
      } else {
        return {
          content: `### 🤝 Assistance & Spoiled Ballot Protocol at UK Polling Stations\n\n* **Assistance in the Booth:** Disabled electors may be accompanied by a companion aged 18+, or request impartial assistance from the Presiding Officer to mark their ballot paper.\n* **Tactile Devices:** Blind and partially sighted voters can request a tactile voting device or large-print sample ballot.\n* **Spoiled Ballot Replacement:** If you make an accidental mistake on your paper ballot, hand it back to the Presiding Officer before putting it in the ballot box. They will cancel it and issue a fresh ballot paper!`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Representation of the People Act 1983'],
          suggestions: ['What photo ID is accepted in the UK?', 'What is a Voter Authority Certificate (VAC)?', 'What time do UK polls close?']
        };
      }
    }

    // =========================================================================
    // INTENT 1: HOW TO CREATE / APPLY / MAKE / GET A NEW VOTER ID / REGISTRATION
    // =========================================================================
    const isCreateOrApply = this.hasAny(q, [
      'create', 'apply', 'make', 'get', 'issue', 'enroll', 'enrol', 'obtain', 'request',
      'register', 'sign up', 'generate', 'process to get', 'how do i get', 'how to get',
      'how to make', 'how to create', 'how to apply', 'how can i create', 'how can i get',
      'how can i apply', 'want a voter id', 'new voter id', 'fresh voter', 'first time voter',
      'form 6', 'make my voter', 'register to vote', 'how do i register to vote', 'how to register to vote',
      'how to register to vote online', 'how do i register to vote online'
    ]);

    const isAboutVoterIdOrCard = this.hasAny(q, [
      'voter id', 'voter card', 'epic', 'voter identity', 'electoral card',
      'election card', 'voters card', 'voter slip', 'e-epic', 'voter registration'
    ]);

    if (isCreateOrApply && (isAboutVoterIdOrCard || this.hasAny(q, ['vote', 'voting', 'card', 'id']))) {
      if (jurKey === 'india') {
        return {
          content: `### 📝 How to Create & Apply for a Voter ID Card (Form 6 - India)\n\nTo create a new Voter ID (**EPIC - Electors Photo Identity Card**), any Indian citizen who is **18 years or older** (or turning 18 on any of the four qualifying dates: **Jan 1, Apr 1, Jul 1, or Oct 1**) can apply online for free.\n\n#### Step-by-Step Guide to Create Your Voter ID:\n\n1. **Visit the Official Portal or Mobile App:**\n   * Go to the official Election Commission of India portal: [voters.eci.gov.in](https://voters.eci.gov.in)\n   * Or download the official **ECI Voter Helpline App** from Google Play Store or Apple App Store.\n\n2. **Create Your Account:**\n   * Click **Sign-Up** and enter your mobile number.\n   * Verify via OTP and set a password.\n\n3. **Fill Form 6 (New Elector Registration):**\n   * Select **'New registration for general electors (Form 6)'**.\n   * Enter your basic personal details: Full Legal Name, Relative's Name, Date of Birth, and Gender.\n   * Enter your current residential address (State, District, Assembly/Parliamentary Constituency).\n\n4. **Upload Required Documents:**\n   * **Recent Color Photograph** (passport size, plain background).\n   * **Proof of Age (Any 1):** Aadhaar Card, PAN Card, Birth Certificate, Driving License, or 10th Class Marksheet.\n   * **Proof of Ordinary Residence (Any 1):** Electricity / Water / Gas bill, Aadhaar Card, Bank Passbook with photo, or Indian Passport.\n\n5. **Submit & Note Reference Number:**\n   * Review the preview form and click **Submit**.\n   * An acknowledgment number (e.g., \`ECI12345678\`) will be generated. Save this to track your application.\n\n#### What Happens Next?\n* Your local **Booth Level Officer (BLO)** will conduct standard field verification.\n* Once approved, your name is entered into the **Electoral Roll**.\n* **Digital Download (Immediate):** You can download your official **e-EPIC (PDF)** immediately on your phone via [voters.eci.gov.in](https://voters.eci.gov.in) or DigiLocker.\n* **Physical Card Delivery:** A color plastic EPIC card with hologram is printed and delivered directly to your home address via India Post Speed Post free of charge!\n\n> 📞 **Need Assistance?** Call **1950** (ECI Toll-Free Voter Helpline).`,
          sources: ['Election Commission of India (voters.eci.gov.in)', 'Representation of the People Act 1950'],
          suggestions: ['How do I track my Form 6 application status?', 'How to check my name on the electoral roll?', 'What documents can I use as address proof?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 📝 How to Register to Vote & Get Voter Photo ID in the UK\n\nIn the UK, you register on the **Electoral Register** online at GOV.UK. If you don't have an accepted photo ID, you can apply for a free **Voter Authority Certificate (VAC)**.\n\n#### 1. Register on the Electoral Register (Takes ~5 minutes):\n* **Go to:** [gov.uk/register-to-vote](https://www.gov.uk/register-to-vote)\n* **Who can register:** British, Irish, or qualifying Commonwealth citizens aged 16+ (can vote when 18, or 16 in Scotland/Wales devolved elections).\n* **Information needed:**\n  * National Insurance number (found on payslips or P60).\n  * Current residential address.\n  * Date of birth and nationality.\n* Once submitted, your local Electoral Registration Officer at your council adds you to the register and sends a confirmation letter and red **poll card**.\n\n#### 2. Need Photo ID? Get a Free Voter Authority Certificate (VAC):\n* If you do not possess an accepted Photo ID (e.g., passport, driving licence, blue badge), apply for a **free VAC** at [gov.uk/apply-for-photo-id-voter-authority-certificate](https://www.gov.uk/apply-for-photo-id-voter-authority-certificate).\n* You will need a recent passport-style photo and your National Insurance number.\n* Your council will print and post your physical Voter Authority Certificate to your home address!\n\n> ⏱️ **Deadline:** Register to vote at least **12 working days** before election day! Apply for VAC at least **6 working days** before polls open.`,
          sources: ['GOV.UK (gov.uk/register-to-vote)', 'The Electoral Commission UK (electoralcommission.org.uk)', 'Elections Act 2022'],
          suggestions: ['What photo ID is accepted at UK polling stations?', 'How do I apply for a postal vote in the UK?', 'How do I find my UK polling station?']
        };
      } else {
        return {
          content: `### 📝 How to Register to Vote & Get a Voter Registration Card (United States)\n\nIn the United States, voter registration is administered at the state and county level. Registering to vote officially places you on the voter rolls and issues your official Voter Registration Certificate.\n\n#### Step-by-Step Guide to Register:\n\n1. **Register Online (42+ States & D.C.):**\n   * Visit [Vote.gov Register to Vote](https://vote.gov) or the official federal portal [USA.gov/register-to-vote](https://www.usa.gov/register-to-vote).\n   * The entire online registration process takes under **2 minutes**.\n\n2. **What You Need to Provide:**\n   * Your current State Driver's License or State Non-Driver ID Number.\n   * The last 4 digits of your Social Security Number (SSN).\n   * Your current residential address.\n\n3. **Register by Mail or In Person:**\n   * Download and print the *National Mail Voter Registration Form* from [Vote.gov](https://vote.gov) or [EAC.gov](https://www.eac.gov).\n   * Mail or hand-deliver it to your local County Elections Office / Municipal Clerk.\n\n4. **At the DMV (Motor Voter Act):**\n   * Whenever you renew or apply for your driver's license at the DMV, check the box to automatically register or update your voter registration.\n\n5. **Voter Registration Card Delivery:**\n   * Within 2 to 4 weeks, your county elections office mails a paper **Voter Registration Card** to your address, which confirms your voting precinct, district numbers, and designated polling location.\n\n> 💡 **Same-Day Registration:** In 22+ states (e.g. CA, CO, MD, MI, NV, WA, WI), you can register and cast your vote on the very same day at your polling site with proof of residency!`,
          sources: ['USA.gov/register-to-vote', 'Vote.gov (Official U.S. Voting Information)', 'National Voter Registration Act (NVRA)'],
          suggestions: ['How do I check if I am registered to vote?', 'What ID do I need to bring to the polls?', 'How do I find my polling place?']
        };
      }
    }

    // =========================================================================
    // INTENT 2: WHAT DOCUMENTS / IDS ARE ACCEPTED TO VOTE AT THE POLLING BOOTH
    // (Only triggers when asking what documents are ACCEPTED/REQUIRED TO CAST VOTE)
    // =========================================================================
    const isAskingForVotingDocs = this.hasAny(q, [
      'what documents do i need to vote', 'which documents to vote', 'what id do i need to vote',
      'what photo id do i need to vote', 'what photo id', 'photo id do i need', 'photo id to vote',
      'acceptable id', 'accepted id', 'approved id', 'approved identity documents', 'valid id',
      'id required to vote', 'documents to carry', 'what to carry to polling booth',
      'what to bring to vote', 'can i vote without voter id', 'can i vote with aadhaar',
      'can i vote with pan card', 'can i vote with driving license', 'can i vote without epic',
      '12 approved ids', 'alternative photo id', 'id required at booth', 'id to vote', 'id needed to vote',
      'without voter id', 'without a voter id', 'without epic', 'without an epic',
      'dont have voter id', 'don\'t have voter id', 'dont have an epic', 'don\'t have an epic',
      'no voter id', 'no epic', 'can i vote without', 'vote without voter id', 'vote without id',
      'vote without epic', 'what id do i need to bring', 'what id do i need to bring to the polls',
      'what id do i need to bring to vote', 'what photo id is accepted in the uk',
      'what photo id is accepted at uk polling stations', 'what photo id do i need to vote in the uk',
      'what id do i need to vote in india', 'what documents do i need to vote in india',
      'what documents can i carry to vote in india', 'what documents can i carry to vote',
      'what documents do i need to bring to vote in india'
    ]);

    if (isAskingForVotingDocs || (this.hasAny(q, ['what id', 'which id', 'accepted documents', 'accepted photo id', 'photo id', 'without voter id', 'without id', 'without epic']) && !isCreateOrApply)) {
      if (jurKey === 'india') {
        return {
          content: `### 🪪 Approved Identity Documents for Voting (India)\n\nAccording to the **Election Commission of India (ECI)**, having your name in the **Electoral Roll** is the primary legal requirement. If your name is on the list, you can cast your vote using **any ONE of the following 12 Approved Photo Identity Documents**:\n\n1. **EPIC (Voter ID Card)** — Physical card or digital e-EPIC on your smartphone.\n2. **Aadhaar Card**\n3. **Driving License**\n4. **Passport**\n5. **PAN Card**\n6. **MNREGA Job Card**\n7. **Bank or Post Office Passbook with photograph**\n8. **Smart Card issued by RGI under NPR**\n9. **Health Insurance Smart Card (Ministry of Labour)**\n10. **Pension document with photograph**\n11. **Official Identity Card issued to MPs/MLAs/MLCs**\n12. **Unique Disability ID (UDID) Card**\n\n> ⚠️ **Key Takeaway:** If you don't have your physical Voter ID card on polling day, you CAN STILL VOTE! Just carry your Aadhaar card, Driving License, or Passport as long as your name is on the electoral roll.`,
          sources: ['Election Commission of India Official Notification', 'voters.eci.gov.in'],
          suggestions: ['How to check if my name is on the electoral roll?', 'How to apply for a voter ID card?', 'Can I carry my mobile phone into the booth?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🪪 Accepted Photo ID for Voting in the UK\n\nUnder the **Elections Act 2022**, voters in Great Britain must present an accepted form of **Photo ID** to vote in person at UK Parliamentary general elections, by-elections, and English local elections.\n\n#### Accepted Photo ID Documents (Must be an Original):\n* **Passport:** UK, Channel Islands, Isle of Man, British Overseas Territory, EEA state, or Commonwealth country.\n* **Driving Licence:** UK, Channel Islands, Isle of Man, or EEA state (full or provisional).\n* **Blue Badge** (disabled parking).\n* **Concessionary Travel Passes:** Older Person's Bus Pass, Disabled Person's Bus Pass, Oyster 60+ Card, Freedom Pass.\n* **Identity Cards:** PASS scheme card (Proof of Age Standards Scheme), Biometric Immigration Document (BRP), Ministry of Defence Form 90 (Defence ID).\n* **Voter Authority Certificate (VAC):** Free photo ID issued by your local council.\n\n> 💡 **Expired ID is OK:** You can still use an expired photo ID as long as the photograph still looks like you!\n\n> 🔴 **Poll Card is NOT ID:** Your red poll card proves registration, but does not count as photo ID. Bring valid photo ID!`,
          sources: ['The Electoral Commission (electoralcommission.org.uk)', 'GOV.UK Voter ID Guidelines', 'Elections Act 2022'],
          suggestions: ['How to apply for a free Voter Authority Certificate (VAC)?', 'Can I vote by post without photo ID in the UK?', 'What time do UK polling stations close?']
        };
      } else {
        return {
          content: `### 🪪 Acceptable Voter ID Requirements (United States)\n\nVoter identification requirements depend on the state in which you are registered:\n\n* **Strict Photo ID States** (e.g., GA, IN, MS, TN, TX): You must present a government-issued photo ID such as a State Driver's License, US Passport, Military ID, or State Non-Driver ID.\n* **Non-Strict Photo ID States** (e.g., FL, MI, NH): If you lack photo ID, you can sign a sworn affidavit of identity or cast a provisional ballot.\n* **Non-Photo ID States** (e.g., CA, NY, IL, PA, MA): Most registered voters do not need to show ID; signing the poll book with a signature match is sufficient.\n\n> 💡 **Provisional Ballot Guarantee:** Under federal law (*Help America Vote Act - HAVA*), if your ID is questioned, you **always have the legal right to cast a Provisional Ballot**. Never leave without voting!`,
          sources: ['Vote.org Voter ID Guide', 'National Conference of State Legislatures (NCSL)'],
          suggestions: ['How do I find my polling place?', 'How does a provisional ballot work?', 'How do I register to vote?']
        };
      }
    }

    // =========================================================================
    // INTENT 4: NRI & OVERSEAS CITIZEN VOTING RULES
    // =========================================================================
    if (this.hasAny(q, ['nri', 'overseas', 'abroad', 'foreign', 'living outside', 'expat', 'form 6a', 'uocava', 'non-resident'])) {
      if (jurKey === 'india') {
        return {
          content: `### ✈️ Rules for NRI (Overseas Citizen) Voting in India\n\nIndian citizens who are residing abroad for employment, education, or other purposes, and have **not acquired citizenship of any other country**, are eligible to register as an **Overseas Elector** under Section 20A of the *Representation of the People Act, 1950*.\n\n#### 1. How to Register as an NRI Voter:\n* Submit **Form 6A** online on [voters.eci.gov.in](https://voters.eci.gov.in) or through the **Voter Helpline App**.\n* **Mandatory Documents Required:**\n  1. One recent passport size photograph.\n  2. Self-attested copy of relevant pages of your **valid Indian Passport** (containing photo, personal particulars, address in India, and valid visa endorsement).\n* Your name will be registered in the constituency corresponding to the **residential address in India** mentioned in your Indian passport.\n\n#### 2. How Does an NRI Cast Their Vote on Polling Day?\n* **Current In-Person Rule:** Under current ECI statutory rules, an overseas elector **must vote in person** at the designated polling station in their Indian constituency on polling day.\n* **Identification:** You must produce your **Original Indian Passport** at the polling booth (no other document is accepted for NRI voters).\n\n> 💡 **Key Takeaway:** Fill Form 6A well ahead of election dates so your name is entered in the final Electoral Roll before nominations close!`,
          sources: ['ECI Overseas Electors Guidelines (Form 6A)', 'Section 20A, Representation of the People Act 1950'],
          suggestions: ['How to check if my name is on the electoral roll?', 'How to create a voter ID?', 'What are the rules for armed forces voters?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### ✈️ Voting from Abroad for British Citizens Living Overseas (UK)\n\nUnder the **Elections Act 2022**, the previous 15-year time limit on voting rights was officially abolished. British citizens living abroad can now **vote for life** in UK Parliamentary general elections!\n\n#### 1. How Overseas British Electors Register:\n* Register online at [gov.uk/register-to-vote](https://www.gov.uk/register-to-vote).\n* You will register against the last UK address where you lived or were registered to vote.\n* You need your National Insurance number and British passport details.\n\n#### 2. How Overseas Electors Cast Their Ballot:\n* **By Postal Vote:** Your ballot pack is mailed overseas via airmail. Apply early at [gov.uk/apply-postal-vote](https://www.gov.uk/apply-postal-vote) to ensure time for return.\n* **By Proxy Vote (Recommended for Overseas):** You can appoint a trusted person in the UK to vote on your behalf at your UK constituency polling station. Apply at [gov.uk/apply-proxy-vote](https://www.gov.uk/apply-proxy-vote).`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Elections Act 2022', 'GOV.UK'],
          suggestions: ['How do I apply for a postal vote in the UK?', 'Can I vote by proxy in the UK?', 'What photo ID is accepted in the UK?']
        };
      } else {
        return {
          content: `### ✈️ Voting from Abroad (U.S. Overseas & Military Citizens - UOCAVA)\n\nUnder the **Uniformed and Overseas Citizens Absentee Voting Act (UOCAVA)**, U.S. citizens living outside the United States (expats, study abroad students, and active-duty military service members) have the legal right to vote by absentee ballot in federal elections.\n\n#### Step-by-Step UOCAVA Process:\n1. **Submit the FPCA (Federal Post Card Application):**\n   * Visit [FVAP.gov](https://www.fvap.gov).\n   * Fill out the FPCA early each calendar year to register and request your absentee ballot simultaneously.\n2. **Receive Your Ballot:**\n   * Election officials are required by law to send overseas ballots **at least 45 days** before a federal election.\n3. **Return Your Ballot:**\n   * Complete the ballot, sign the certification envelope, and return it via international post, embassy pouch, or secure electronic upload where permitted.\n4. **Emergency Backup (FWAB):**\n   * If your official state ballot hasn't arrived in time, submit the **Federal Write-In Absentee Ballot (FWAB)** at FVAP.gov so your vote counts.`,
          sources: ['Federal Voting Assistance Program (FVAP.gov)', 'UOCAVA Statute 52 U.S.C. § 20301'],
          suggestions: ['How do mail-in ballots work?', 'How do I track my absentee ballot?', 'What are the registration deadlines?']
        };
      }
    }

    // =========================================================================
    // INTENT 5: SHIFTED RESIDENCE / CHANGING ADDRESS / TRANSFERRING VOTE
    // =========================================================================
    if (this.hasAny(q, ['moved', 'shifted', 'address change', 'change address', 'new city', 'new address', 'form 8', 'transfer vote', 'transferred'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🏠 What to Do If You Shifted Residence / Address (India - Form 8)\n\nIf you have moved to a new house—whether within the same assembly constituency or to a completely different constituency or state—you must update your voter records using **Form 8**.\n\n#### Step-by-Step Address Update:\n1. Log in to [voters.eci.gov.in](https://voters.eci.gov.in) or open the **Voter Helpline App**.\n2. Click on **'Shifting of Residence / Correction of Entries in Existing Electoral Roll (Form 8)'**.\n3. Choose whether you have shifted *Within the Constituency* or *Outside the Constituency*.\n4. Enter your EPIC number and fill in your new residential address.\n5. Upload **1 Proof of Address** for your new home (Aadhaar, electricity/water bill, bank passbook, rent agreement, or passport).\n6. Submit and note your tracking reference ID.\n\n> ⚠️ **Important:** Never apply for a fresh Form 6 when moving—having multiple EPIC numbers across different constituencies is an offense under Section 17 & 31 of the RPA 1950. Always use Form 8 to transfer your existing record!`,
          sources: ['ECI Form 8 Guidelines', 'Representation of the People Act 1950 Sec 17 & 31'],
          suggestions: ['How to check if my name is on the electoral roll?', 'How to create a voter ID?', 'What documents count as proof of address?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🏠 How to Update Your Electoral Register Details When Moving (UK)\n\nIn the UK, voter registration does not automatically transfer when you move house.\n\n#### Steps to Update Your Address:\n1. **Re-Register at Your New Address:** Visit [gov.uk/register-to-vote](https://www.gov.uk/register-to-vote) and submit a new application with your new postcode and address.\n2. **Provide Your Previous Address:** The online form asks for your previous address. Your new council will automatically notify your former council to remove your old entry.\n3. **Local Council Updates:** Your new local authority will add you to their register and send a new poll card to your new address.\n\n> ⏱️ Complete this at least **12 working days** before election day to vote from your new address!`,
          sources: ['GOV.UK (gov.uk/register-to-vote)', 'The Electoral Commission UK'],
          suggestions: ['How do I register to vote in the UK?', 'What photo ID is accepted in the UK?', 'How do I find my UK polling station?']
        };
      } else {
        return {
          content: `### 🏠 How to Update Your Voter Registration When You Move (United States)\n\nWhen you move, your assigned voting precinct, congressional representatives, and local ballot measures change. You must update your voter registration to reflect your new home address.\n\n#### Steps to Update Your Address:\n1. **Update Online:** Visit [Vote.gov Change Your Address](https://vote.gov) or [USA.gov Change Voter Address](https://www.usa.gov/change-voter-registration-address) or your new state's Secretary of State portal. Enter your new address and update your registration.\n2. **DMV / Driver's License:** When you update the address on your driver's license at your state DMV, select the checkbox to automatically update your voter registration.\n3. **Moving Out of State:** Register in your new state before their deadline, and notify your old county election clerk to cancel your previous registration.\n4. **Moved Within 30 Days of Election Day:** Many states permit you to vote one last time in your old precinct or cast a provisional/transfer ballot at your new precinct.`,
          sources: ['Vote.gov (Official U.S. Voting Information)', 'USA.gov/change-voter-registration-address'],
          suggestions: ['What is a provisional ballot?', 'What are the registration deadlines in my state?', 'How do I find my polling place?']
        };
      }
    }

    // =========================================================================
    // INTENT 6: LOST, DAMAGED, OR CORRECTION IN VOTER ID
    // =========================================================================
    if (this.hasAny(q, ['lost', 'lost voter id', 'damaged', 'duplicate', 'correction', 'change name', 'spelling mistake', 'replace voter id', 'replacement card', 'what documents can i use if i lost my voter id'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🪪 How to Replace a Lost/Damaged Voter ID or Correct Mistakes (Form 8 - India)\n\nIf your Voter ID card is lost, damaged, destroyed, or contains spelling/photo mistakes:\n\n#### 1. Can You Still Vote If Your Voter ID is Lost?\n* **YES!** Having your name on the **Electoral Roll** is the primary legal requirement. You can cast your vote using **any of the 12 alternative approved photo IDs** (Aadhaar, Driving License, Passport, PAN Card, etc.).\n\n#### 2. Correction of Details (Name, Photo, DOB, Relative Name):\n* Submit **Form 8** on [voters.eci.gov.in](https://voters.eci.gov.in) under *'Correction of Entries'*, upload supporting documents, and your revised e-EPIC will be generated.\n\n#### 3. Replacement of Lost or Damaged Card:\n* On [voters.eci.gov.in](https://voters.eci.gov.in), select **Form 8** -> *'Issue of Replacement EPIC without correction'*.\n* If lost, attach a copy of the police FIR/lost complaint receipt.\n* If mutilated/damaged, return the damaged card during delivery.\n* A fresh replacement EPIC will be dispatched to your home address via India Post Speed Post!`,
          sources: ['voters.eci.gov.in', 'ECI Form 8 Replacement Services'],
          suggestions: ['How to check my name on the electoral roll?', 'How to download e-EPIC?', 'What IDs are accepted at the polling booth?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🪪 Lost UK Poll Card or Lost Photo ID\n\n* **Lost Your Red Poll Card?** You **do NOT need your poll card to vote**! Simply give your name and address at your assigned polling station and present your accepted photo ID.\n* **Lost Your Photo ID?**\n  * If you have another accepted document (e.g. driving licence, blue badge, older person's bus pass, or passport), you can use that instead.\n  * **Expired ID is fine** as long as the photo still resembles you!\n  * If you have no accepted photo ID left, you can apply for a **free Voter Authority Certificate (VAC)** up to 6 working days before polling day.\n  * If you lose your photo ID right before election day, you may apply for an **Emergency Proxy Vote** up to **5:00 PM on Election Day**.`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Elections Act 2022'],
          suggestions: ['What photo ID is accepted in the UK?', 'How to apply for a free Voter Authority Certificate (VAC)?', 'How do I find my UK polling station?']
        };
      } else {
        return {
          content: `### 🪪 Replacing a Lost Voter Registration Card (United States)\n\n* Contact your local county registrar or county elections office to request a replacement voter certificate.\n* You can also log into your state's Secretary of State portal or [Vote.gov](https://vote.gov) / [USA.gov](https://www.usa.gov/voter-registration-card) to print a digital verification certificate.\n* Note that on polling day, your county voter certificate is generally not required if you bring an accepted state photo ID or qualify for signature verification.\n* **Provisional Ballot Guarantee:** If your card or ID is questioned on Election Day, demand a Provisional Ballot under HAVA § 302!`,
          sources: ['USA.gov/voter-registration-card', 'Vote.gov (Official U.S. Voting Information)'],
          suggestions: ['What ID do I need to vote?', 'How to find my polling place?', 'How does a provisional ballot work?']
        };
      }
    }

    // =========================================================================
    // INTENT 7: CELL PHONES, SELFIES & PHOTOGRAPHY IN THE BOOTH
    // =========================================================================
    const isOnlineVotingQuery = this.hasAny(q, [
      'vote online', 'online voting', 'vote from home on internet', 'vote from my phone',
      'vote on phone', 'digital voting', 'internet voting', 'vote through app',
      'can i vote online', 'can we vote online', 'remote voting'
    ]);

    if (this.hasAny(q, ['phone', 'mobile', 'selfie', 'camera', 'photo in booth', 'photography', 'smartwatch', 'taking pictures', 'can i carry my mobile phone into the booth', 'can i bring a mobile phone to the booth', 'can i bring my mobile phone inside the booth']) && !isOnlineVotingQuery) {
      if (jurKey === 'india') {
        return {
          content: `### 📱 Mobile Phones & Cameras Policy in the Polling Booth (India)\n\n* **Strict Ban Inside Voting Compartment:** Carrying mobile phones, digital cameras, smartwatches, or any recording devices inside the **voting compartment is strictly prohibited** under Election Commission of India (ECI) regulations.\n* **Designated Storage Counter:** Polling stations provide a token deposit counter or storage table outside the booth where you must leave your mobile phone before entering the compartment.\n* **Reason for Ban:** To protect the **constitutional secrecy of the ballot** and prevent vote buying, coercion, or photographing EVM button presses.\n* **Legal Consequence:** Attempting to photograph the EVM or your VVPAT slip can lead to confiscation of your phone and penal action under Section 128 of the Representation of the People Act 1951.\n\n> 💡 **Recommendation:** Keep your phone switched off or on silent in your pocket, and deposit it at the officer's desk before stepping into the voting compartment.`,
          sources: ['ECI Polling Station Manual', 'Section 128, Representation of the People Act 1951'],
          suggestions: ['How does the EVM and VVPAT process work?', 'What documents can I carry to vote in India?', 'What are my voter rights at the polling station?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 📱 Mobile Phones & Selfies Policy in UK Polling Stations\n\n* **Selfies & Photography Strongly Discouraged:** The Electoral Commission strongly advises against taking selfies or photographs inside UK polling stations.\n* **Criminal Offence Risk:** Under **Section 66 of the Representation of the People Act 1983**, it is a criminal offence to reveal how another person voted or to publish the unique serial number printed on official ballot papers. Taking a photo inside risks accidentally capturing this information.\n* **Penalties:** Breaching ballot secrecy carries a fine of up to £5,000 or up to 6 months in prison.\n* **Photos Outside:** You are completely free to take celebration selfies outside the polling station building!\n\n> 💡 **Recommendation:** Keep your phone in your pocket on silent until you exit the polling station.`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Representation of the People Act 1983 (Section 66)'],
          suggestions: ['What photo ID is accepted in the UK?', 'What time do UK polls open and close?', 'Can I vote by post in the UK?']
        };
      } else {
        return {
          content: `### 📱 Mobile Phones & Ballot Selfies Policy (United States)\n\n* **State Ballot Selfie Laws Vary Widely:**\n  * **Prohibited (Illegal):** In states like California, Florida, Georgia, Illinois, Nevada, New York, and Texas, taking photos or selfies inside the voting booth or displaying a marked ballot is strictly prohibited by state statute.\n  * **Allowed for Your Own Ballot:** Some states (e.g., Colorado, Indiana, Michigan, New Hampshire) allow photographing your own marked ballot, but photographing other voters or tabulator machines is illegal everywhere.\n* **Federal Rule:** Federal law strictly forbids photographing or recording other voters to prevent voter intimidation.\n* **Recommendation:** Keep your phone silenced in your pocket while voting to avoid voiding your ballot or facing precinct penalties.`,
          sources: ['National Conference of State Legislatures (NCSL) Ballot Selfie Laws', 'Vote.gov Voting Rights'],
          suggestions: ['What ID do I need to vote?', 'How does a provisional ballot work?', 'What are my voter rights at the polling station?']
        };
      }
    }

    // =========================================================================
    // INTENT 8: WEARING CAMPAIGN / POLITICAL CLOTHES (ELECTIONEERING)
    // =========================================================================
    if (this.hasAny(q, ['clothes', 't-shirt', 'shirt', 'hat', 'slogan hat', 'badge', 'campaign button', 'electioneering', 'campaigning', 'wear', 'wearing', 'political apparel', 'political shirt', 'can i wear', 'what to wear', 'dress code'])) {
      if (jurKey === 'india') {
        return {
          content: `### 👕 Can You Wear Political Shirts, Badges, or Caps to Vote in India?\n\n* **Strict 100-Meter Exclusion Zone:** Under **Section 130 of the Representation of the People Act, 1951**, all forms of campaigning, canvassing, or displaying party symbols are strictly prohibited within a **100-meter perimeter** of any polling station.\n* **No Party Apparel:** Wearing clothes, t-shirts, caps, badges, scarves, or masks displaying political party symbols, candidate portraits, or party slogans is strictly illegal (*passive electioneering*).\n* **Poll Official Action:** If you enter wearing political merchandise or party colors with logos, the Presiding Officer and security personnel will require you to remove the cap/badge or cover the shirt before allowing you inside the booth.\n* **Neutral Clothing:** Voters are encouraged to wear ordinary, neutral attire with no party insignia.`,
          sources: ['Section 130, Representation of the People Act 1951', 'ECI Model Code of Conduct Manual'],
          suggestions: ['What documents do I need to vote in India?', 'What time do polls open and close in India?', 'Can I bring a mobile phone to the booth?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 👕 Can You Wear Political Badges or Clothing in UK Polling Stations?\n\n* **No Campaigning in Polling Stations:** Campaigning, distributing party leaflets, or promoting candidates inside or immediately outside a polling station is prohibited under UK electoral law.\n* **Voter Clothing:** While voters wearing ordinary clothes with political slogans may be asked by the Presiding Officer to cover them up to preserve neutrality and avoid intimidating others, candidates and official election agents are strictly limited to wearing one plain party rosette.\n* **Keep It Neutral:** Polling staff will ensure the environment remains completely impartial and calm for all electors.`,
          sources: ['The Electoral Commission UK Polling Station Handbook', 'Representation of the People Act 1983'],
          suggestions: ['What photo ID is accepted in the UK?', 'What time do UK polls close?', 'How does First Past the Post work in the UK?']
        };
      } else {
        return {
          content: `### 👕 Can You Wear Political Shirts, Hats, or Buttons to Vote? (United States)\n\n* **Buffer Zone Rule:** In almost all states, election law establishes a strict **buffer / exclusion zone** (typically **100 feet** around the entrance to the polling place).\n* **No Passive Campaigning:** Wearing candidate t-shirts, MAGA/slogan hats, campaign buttons, or distributing flyers within this buffer zone is considered *passive electioneering* and is illegal under state laws (*Burson v. Freeman*, 504 U.S. 191).\n* **Poll Worker Protocol:** Poll workers will ask you to remove the hat, zip up your jacket, or turn your t-shirt inside out before you can receive a ballot.\n* **Voter Protection:** This ensures every citizen can cast their ballot peacefully without intimidation or pressure.`,
          sources: ['Burson v. Freeman (504 U.S. 191)', 'National Conference of State Legislatures (NCSL) Electioneering Prohibitions'],
          suggestions: ['What are my voter rights at the polling station?', 'What time do polls open and close?', 'What ID do I need to bring?']
        };
      }
    }

    // =========================================================================
    // INTENT 8b: PROVISIONAL BALLOT / TENDERED BALLOT / CHALLENGED VOTE
    // =========================================================================
    if (this.hasAny(q, [
      'provisional ballot', 'provisional vote', 'provisional ballots', 'what is a provisional',
      'what is provisional', 'tendered ballot', 'tendered vote', 'challenged vote', 'rule 49p',
      'rule 36', 'provisional voting', 'provisional', 'someone voted in my name', 'someone already voted',
      'someone else voted', 'someone voted for me', 'fraudulent vote', 'fraudulent voting',
      'fake vote', 'voted in my place', 'voted in my name', 'impersonation at booth', 'stolen vote',
      'what is a provisional or tendered ballot', 'what is a provisional ballot'
    ])) {
      if (jurKey === 'india') {
        return {
          content: `### 🗳️ What is a Provisional Ballot? (And India's Legal Equivalent)\n\n* **"Provisional Ballot" is a U.S. Legal Concept:** Under the U.S. *Help America Vote Act (HAVA)*, a provisional ballot is given to voters whose eligibility cannot be confirmed on the spot.\n* **Does India Have Provisional Ballots?** **No.** Under Indian election law, there is **no provisional voting on the EVM** if your name is missing from the Electoral Roll. The electoral roll freezes on the last date of candidate nominations.\n\n#### 🛡️ Indian Statutory Safeguards for Similar Situations:\n\n1. **Tendered Ballot Paper (Rule 49P, Conduct of Elections Rules 1961):**\n   * If you arrive at your polling booth and discover that **someone has already fraudulently voted in your name**, you are entitled to cast a **Tendered Vote**.\n   * The Presiding Officer verifies your identity with your EPIC or any of the 12 approved photo IDs.\n   * You are given a physical paper **Tendered Ballot Paper** (not an EVM vote), and you record your vote with a stamp in the private compartment.\n   * Your ballot is enclosed in a sealed envelope marked *"Tendered Ballot Paper"* and safely preserved. These votes are examined if an election result is contested.\n\n2. **Challenged Vote (Rule 36):**\n   * If a candidate's polling agent challenges your identity, the Presiding Officer conducts an **immediate summary inquiry** on the spot.\n   * The challenger must deposit **₹2 in cash**. If the challenge is proved false, you vote normally on the EVM and the challenger forfeits their money.\n\n3. **If Your Name is Missing from the List:**\n   * If your name is not on the Electoral Roll on polling day, you cannot vote. You should file **Form 6** online at [voters.eci.gov.in](https://voters.eci.gov.in) to register for upcoming elections.`,
          sources: ['Conduct of Elections Rules 1961 (Rule 49P, Rule 36)', 'Representation of the People Act 1951', 'ECI Presiding Officer Handbook'],
          suggestions: ['What documents can I carry to vote in India?', 'How to check my name on the electoral roll?', 'How does the EVM and VVPAT process work?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🗳️ What is a Provisional Ballot? (And the UK Equivalent)\n\n* **"Provisional Ballot" is a U.S. Mechanism:** In the United States, voters whose eligibility is questioned can cast a provisional ballot that is counted after verification.\n* **Does the UK Have Provisional Ballots?** **No.** In the UK, there are no provisional ballots at polling stations. You must be on the Electoral Register at least 12 working days before polling day.\n\n#### 🛡️ UK Safeguards for Similar Situations:\n\n1. **Tendered Ballot Paper (Rule 40, Parliamentary Election Rules):**\n   * If someone has already voted pretending to be you, the Presiding Officer will ask you statutory questions to verify your identity.\n   * You will receive a pink **Tendered Ballot Paper**. You mark your choice in the booth, but it is **not placed in the ballot box**—it is handed back to the Presiding Officer, endorsed with your name, and sealed in a dedicated packet for legal review.\n\n2. **If You Forgot Your Photo ID:**\n   * UK polling stations **cannot issue provisional ballots** if you forget your photo ID.\n   * However, you can return home, collect your accepted Photo ID or free Voter Authority Certificate (VAC), and return to the polling station before **10:00 PM** to vote!`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Representation of the People Act 1983', 'Elections Act 2022'],
          suggestions: ['What photo ID is accepted in the UK?', 'What is a Voter Authority Certificate (VAC)?', 'What time do UK polls close?']
        };
      } else {
        return {
          content: `### 🗳️ What is a Provisional Ballot? (United States)\n\nUnder federal law (**Help America Vote Act - HAVA Section 302**), a **Provisional Ballot** is a fail-safe legal protection ensuring **no eligible voter is turned away from the polling place empty-handed**.\n\n#### When Should You Demand a Provisional Ballot?\n1. **Name Not in Poll Book:** You believe you registered in time, but your name is not listed on the precinct roster.\n2. **Missing State Photo ID:** You lack the required state photo identification on Election Day.\n3. **Wrong Polling Place:** You arrived at a different precinct within your county instead of your assigned home polling site.\n4. **Mail-in Ballot Status:** You requested an absentee/mail-in ballot but arrived to vote in person without the ballot to surrender.\n5. **Eligibility Challenge:** A poll watcher or election worker challenges your eligibility.\n\n#### How a Provisional Ballot Works:\n* **Secrecy Envelope:** You fill out your ballot and place it inside a sealed provisional envelope containing your signed affidavit of eligibility.\n* **Verification Period:** After polls close, county election officials review registration records to verify your identity and eligibility (within 3 to 14 days).\n* **Curing Opportunity:** If your ballot was cast due to missing ID or signature discrepancy, you have a designated curing window to provide proof to the county clerk.\n* **Confidential Tracking:** You receive a receipt with a tracking number or toll-free hotline to verify whether your ballot was counted, and if not, the reason why.\n\n> 🛡️ **Federal Right:** If an election worker tells you you cannot vote, politely but firmly say: *"Under HAVA Section 302, I have the legal right to cast a Provisional Ballot."*`,
          sources: ['Help America Vote Act (HAVA Section 302)', '52 U.S.C. § 21082', 'National Conference of State Legislatures (NCSL)'],
          suggestions: ['What ID do I need to bring to the polls?', 'How do I check if I am registered to vote?', 'What time do polls open and close?']
        };
      }
    }

    // =========================================================================
    // INTENT 9: VOTER RIGHTS AT THE POLLING STATION / NAME MISSING
    // =========================================================================
    if (this.hasAny(q, [
      'voter rights', 'my rights', 'my voter rights', 'voting rights', 'rights at the polling',
      'rights at polling', 'rights at booth', 'what are my rights', 'rights if my name',
      'name missing', 'not on list', 'intimidation', 'refused', 'denied', 'harassment',
      'line closes', 'cvigil', 'voter protection', 'legal rights as voter',
      'what are my rights at the polls', 'what are my rights if my vote is challenged',
      'what if my name is missing from the voter list', 'what are my rights if my name is missing'
    ])) {
      if (jurKey === 'india') {
        return {
          content: `### 🛡️ Your Voter Rights at the Polling Station (India)\n\nUnder the Indian Constitution and the **Representation of the People Act, 1951**, every registered voter in India has the following legally guaranteed rights:\n\n#### ✅ Your Key Rights:\n1. **Right to Vote Freely & in Secret:** You have an absolute constitutional right to cast your vote in total secrecy. No one can accompany you inside the EVM compartment (except authorized companions for blind or infirm voters under Rule 49N).\n2. **Right to Vote if in Queue at Closing Time:** If you are physically standing in the polling queue **before the official closing time (e.g. 5:00 PM / 6:00 PM)**, you **cannot be turned away**! The Presiding Officer must distribute numbered slips from the last person forward and allow everyone to vote.\n3. **Tendered Vote if Name Misused (Rule 49P):** If someone has already fraudulently voted in your name, you are entitled to cast a **Tendered Ballot Paper**.\n4. **Right to Verify on VVPAT:** You have the right to visually verify your vote on the VVPAT paper slip for **7 seconds** through the transparent window.\n5. **Right to Report Malpractice Instantly:**\n   * **cVIGIL App:** Launch the ECI app to submit geotagged photos/videos of booth violations—an ECI Flying Squad is dispatched within 100 minutes.\n   * **1950 Helpline:** Call toll-free 24×7 for immediate election officer assistance.\n6. **Right to a Screened Compartment:** Polling staff cannot stand near or peek into your voting compartment while you are recording your vote.\n7. **Protection Against Bribery & Coercion:** Inducing or threatening voters is a criminal offense under Section 171B & 171C of the Indian Penal Code.\n\n> 📞 **ECI Helplines:** **1950** (Toll-Free Helpline) | **cVIGIL Mobile App**`,
          sources: ['Representation of the People Act 1951 (Section 130, 135C, 171B)', 'Conduct of Elections Rules 1961 (Rule 49P, 49N)', 'Election Commission of India Guidelines'],
          suggestions: ['What is the EVM and VVPAT voting process?', 'What documents can I carry to vote in India?', 'What is a provisional or tendered ballot?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🛡️ Your Voter Rights at the Polling Station (United Kingdom)\n\nUnder the **Representation of the People Act 1983** and the **Elections Act 2022**, UK voters have legally protected rights:\n\n#### ✅ Your Key Rights:\n1. **Right to Ballot Secrecy:** The secrecy of your ballot paper is strictly guaranteed by law. Booth compartments are fully shielded.\n2. **Right to Vote if in Queue by 10:00 PM:** If you join the polling station queue **before 10:00 PM**, you **must be allowed to cast your vote** by law.\n3. **Right to a Fresh Ballot (Spoiled Ballot):** If you make an accidental mistake on your ballot paper, return it to the Presiding Officer before placing it in the box. They will cancel it and issue a fresh ballot paper.\n4. **Assistance for Voters with Disabilities:** You may bring a companion aged 18+ or request impartial assistance from the Presiding Officer to help you mark your ballot.\n5. **Tendered Ballot Right (Rule 40):** If someone has already voted in your name, you are entitled to cast a pink Tendered Ballot Paper.\n6. **Right to Complain:** You can contact your local council's Returning Officer or the **Electoral Commission**.\n\n> 📞 **UK Helplines:** Electoral Commission: **0800 328 0280** | Textphone: **0800 328 0125**`,
          sources: ['Representation of the People Act 1983', 'Elections Act 2022', 'The Electoral Commission UK'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I apply for a Voter Authority Certificate?', 'What time do UK polls close?']
        };
      } else {
        return {
          content: `### 🛡️ Your Voter Rights at the Polling Station (United States)\n\nFederal civil rights legislation and the **Help America Vote Act (HAVA)** guarantee these essential rights:\n\n#### ✅ Your Key Rights:\n1. **Right to a Provisional Ballot (HAVA § 302):** If your eligibility, registration, or ID is questioned, election officials **cannot turn you away**. You have the legal right to cast a Provisional Ballot.\n2. **Right to Vote if in Line at Closing Time:** If you are in line before poll closing time, **stay in line**! You have the statutory right to cast your ballot no matter how long the wait is.\n3. **Right to a Secret Ballot:** No one may observe your selections inside the privacy booth.\n4. **Right to Assistance:** You have the right to bring any person of your choice (except your employer or union representative) to assist you inside the booth.\n5. **Right to a Spoiled Ballot Replacement:** If you make an error on a paper ballot, return it to poll workers for a clean replacement ballot.\n6. **Right Against Voter Intimidation:** Voter intimidation is a federal crime under **52 U.S.C. § 20511**.\n\n> 📞 **Voter Protection Hotlines:** **1-866-OUR-VOTE (866-687-8683)** | U.S. Department of Justice Voting Section: **800-253-3931**`,
          sources: ['Help America Vote Act (HAVA)', 'Voting Rights Act 1965', '52 U.S.C. § 20511'],
          suggestions: ['How does a provisional ballot work?', 'What if my name is missing from the voter list?', 'What ID do I need to bring to vote?']
        };
      }
    }

    // =========================================================================
    // INTENT 10: POLLING STATION / BOOTH LOCATION & OPERATING HOURS
    // =========================================================================
    if (this.hasAny(q, [
      'booth', 'polling place', 'polling station', 'where do i vote', 'location',
      'where to vote', 'precinct', 'room number', 'polling hours', 'open time',
      'close time', 'polls open', 'polls close', 'poll hours', 'voting hours',
      'when do polls', 'what time do polls', 'time do polls', 'polls open and close',
      'open and close', 'voting time', 'election hours', 'booth hours', 'station hours',
      'how to find my polling booth', 'how do i find my polling booth', 'how do i find my polling place',
      'how do i find my uk polling station', 'what time do uk polls open and close',
      'what time do uk polls close', 'what time do uk polling stations close',
      'what time do polls open and close in india', 'how to find my polling booth in india'
    ])) {
      if (jurKey === 'india') {
        return {
          content: `### 📍 Polling Station Hours & How to Find Your Booth (India)\n\n#### ⏰ Polling Station Hours in India:\n* **Standard Polling Hours:** Polling booths across India are open from **7:00 AM to 5:00 PM or 6:00 PM** (the exact closing time is notified by the ECI for each parliamentary/assembly constituency).\n* **⚠️ THE QUEUE RULE (Your Absolute Legal Right):** Under Election Commission of India rules, **if you are physically standing in the polling queue before the official closing time (e.g. 5:00 PM / 6:00 PM), you CANNOT be turned away!**\n  * The Presiding Officer collects the line and distributes numbered paper tokens starting from the last person in line forward.\n  * Every single citizen holding a token is legally entitled to cast their vote, even if polling extends into the night.\n\n#### 📍 3 Quick Ways to Locate Your Polling Booth:\n1. **SMS Service to 1950 (Instant):** Send an SMS from any mobile phone formatted as:\n   \`ECIPS <Your-10-Digit-EPIC-Number>\` to **1950**.\n   You will receive an instant reply showing your Polling Station name, building address, and Part/Room number.\n2. **ECI Voter Helpline Mobile App:** Tap *'Electoral Search'* -> Enter your EPIC number or name to view your exact booth location with a Google Maps pin.\n3. **Online Portal:** Go to [voters.eci.gov.in](https://voters.eci.gov.in) and click **'Search in Electoral Roll'**.\n4. **Voter Information Slip (VIS):** Your local Booth Level Officer (BLO) distributes paper voter slips to your door 3 to 5 days before polling day.\n\n> 📞 **ECI Toll-Free Helpline:** Dial **1950** with your district STD code for booth assistance.`,
          sources: ['Election Commission of India (voters.eci.gov.in)', 'ECI Polling Station Manual', 'Conduct of Elections Rules 1961'],
          suggestions: ['What documents do I need to bring to vote in India?', 'Can I bring a mobile phone to the booth?', 'How does the EVM and VVPAT process work?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 📍 UK Polling Station Hours & How to Find Your Station\n\n#### ⏰ UK Polling Hours:\n* **Opening & Closing Times:** Polling stations in England, Scotland, Wales, and Northern Ireland are open from **7:00 AM to 10:00 PM** on polling day (always held on a Thursday).\n* **⚠️ The 10:00 PM Queue Rule:** Under the *Electoral Registration and Administration Act 2013*, if you are in the queue at the polling station **by 10:00 PM**, you **must be issued a ballot paper and allowed to vote**.\n\n#### 📍 How to Find Your Assigned UK Polling Station:\n1. **Check Your Red Poll Card:** Your local council posts a red **Poll Card** to your address a few weeks before election day. Your designated polling station name and address are printed clearly on the front.\n2. **Online Postcode Search:** Visit [gov.uk/find-your-local-council](https://www.gov.uk/find-your-local-council) or [whocanivotefor.co.uk](https://whocanivotefor.co.uk) and enter your UK postcode.\n3. **Contact Local Council:** Call your municipal council's Electoral Services office.\n\n> 🪪 **Mandatory Photo ID:** You must present accepted original Photo ID (Passport, Driving Licence, Blue Badge, or free Voter Authority Certificate) to receive your ballot paper!`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Elections Act 2022', 'Electoral Registration and Administration Act 2013'],
          suggestions: ['What photo ID is accepted in the UK?', 'What is a Voter Authority Certificate (VAC)?', 'Can I vote by post in the UK?']
        };
      } else {
        return {
          content: `### 📍 Polling Place Hours & How to Find Where You Vote (United States)\n\n#### ⏰ Polling Place Operating Hours:\n* **Opening & Closing Times:** Polling hours vary by state and county, typically opening between **6:00 AM and 7:00 AM** and closing between **7:00 PM and 8:00 PM** local time.\n* **⚠️ Stay in Line Rule:** Under federal and state laws, **if you are in line before the polls officially close, you have the legal right to vote!** Do not leave the line regardless of wait times.\n\n#### 📍 How to Find Your Assigned Polling Place:\n1. **Official National Portals:** Use [USA.gov Find Your Polling Place](https://www.usa.gov/find-polling-place) or [Vote.gov Polling Locator](https://vote.gov) to connect directly with your county elections department.\n2. **State Secretary of State Portal:** Every state provides an online voter portal where entering your name and DOB displays your precinct and polling address.\n3. **Voter Registration Certificate:** Look at the paper voter card mailed to your residence.\n4. **Vote Centers vs Precincts:** Many counties allow registered voters to cast ballots at *any* designated Vote Center in the county during early voting and on Election Day.`,
          sources: ['USA.gov/find-polling-place', 'Vote.gov (Official U.S. Voting Information)', 'National Association of State Election Directors'],
          suggestions: ['What ID do I need to bring?', 'Can I take time off work to vote?', 'What is a provisional ballot?']
        };
      }
    }

    // =========================================================================
    // INTENT 11: EVM, VVPAT, MACHINES & BOOTH PROTOCOL
    // =========================================================================
    if (this.hasAny(q, ['evm', 'vvpat', 'machine', 'ballot box', 'optical scan', 'how to vote in booth', 'steps in booth', 'how does the evm and vvpat process work', 'what is the evm and vvpat voting process'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🗳️ EVM & VVPAT Voting Process in the Booth (India)\n\nWhen you enter the voting compartment:\n\n1. **Check the EVM:** The green **'Ready' lamp** on the Balloting Unit (BU) will be illuminated.\n2. **Press Candidate Button:** Locate your chosen candidate's serial number, name, and symbol (or the NOTA option at the bottom), then press the blue button next to it.\n3. **Red Light & Beep:** A red lamp will glow next to the candidate symbol, followed by a long audio beep.\n4. **Verify on VVPAT:** Immediately look at the transparent glass window of the adjoining VVPAT unit.\n   * A printed paper slip displaying the candidate's serial number, name, and symbol will stay visible for **7 seconds**.\n   * The slip will then automatically cut and fall into the sealed drop box.\n5. **Exit Booth:** Your vote is now securely recorded!\n\n> ⚠️ **What is NOTA?** 'None of the Above' allows voters to officially register rejection of all contesting candidates while maintaining complete ballot secrecy.`,
          sources: ['ECI EVM-VVPAT Protocol Manual', 'Chief Electoral Officer Guides'],
          suggestions: ['Can I carry a mobile phone into the booth?', 'What documents can I use if I lost my voter ID?', 'What is NOTA on the EVM?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🗳️ UK Ballot Paper & Polling Booth Protocol\n\nUnlike jurisdictions with voting machines, UK parliamentary and local elections use traditional paper ballots:\n\n1. **Official Stamped Ballot:** The poll clerk stamps the official security mark on your ballot paper before handing it to you.\n2. **The Polling Compartment:** Enter a private, partitioned wooden polling desk.\n3. **Marking Your Choice:** Use the pencil attached to the desk (or your own blue/black pen). Mark a single clear **"X"** in the box beside your chosen candidate.\n4. **Protecting Secrecy:** Do not write any names, initials, or slogans on the paper, as this will spoil your ballot and prevent it from being counted.\n5. **The Ballot Box:** Fold the paper in half with the vote facing inward, and drop it into the sealed black ballot box.\n\n> 💡 **Spoiled Ballot:** If you accidentally make a mistake on your paper, hand it back to the Presiding Officer before putting it in the box. They will cancel it and issue you a fresh ballot!`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Representation of the People Act 1983'],
          suggestions: ['What photo ID is accepted in the UK?', 'How does First Past the Post work in the UK?', 'Can I vote by post in the UK?']
        };
      } else {
        return {
          content: `### 🗳️ Voting Equipment & Casting Your Ballot (United States)\n\nDepending on your county, you will encounter either:\n\n1. **Paper Ballot with Optical Scanner:**\n   * You fill in the oval completely next to your choice using the official pen provided.\n   * Do not make stray marks or checkmarks.\n   * Feed the ballot into the electronic optical tabulator until you see the confirmation screen (e.g., 'Ballot Accepted').\n2. **Direct Recording Electronic (DRE) / Ballot Marking Device (BMD):**\n   * Make selections on an accessible touchscreen.\n   * Review the summary review screen carefully.\n   * Print your paper verification record and deposit it into the official collection bin.\n\n> 💡 **Spoiled Ballot?** If you make an error on paper, return it to the poll worker and ask for a fresh one. Never cross out and attempt to write over it.`,
          sources: ['U.S. Election Assistance Commission (EAC)', 'Verified Voting Foundation'],
          suggestions: ['What are my rights if the machine jams?', 'Can I ask a poll worker for help?', 'What is a provisional ballot?']
        };
      }
    }

    // =========================================================================
    // INTENT 11b: NOTA (NONE OF THE ABOVE) / CAN NOTA WIN?
    // =========================================================================
    if (this.hasAny(q, ['what is nota', 'nota', 'none of the above', 'can nota win', 'if nota wins', 'what happens if nota', 'nota vote', 'what is nota on the evm'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🗳️ NOTA (None of the Above) in India: Complete Guide\n\n* **What is NOTA?** Following the landmark 2013 Supreme Court ruling (*PUCL v. Union of India*), the Election Commission of India introduced **NOTA** as the final button on all EVM balloting units and postal ballots.\n* **Purpose:** It allows an elector to officially record their rejection of all contesting candidates while maintaining complete ballot secrecy (previously done under Rule 49-O, which lacked secrecy).\n* **Can NOTA Win the Election in India?**\n  * **In Parliamentary (Lok Sabha) & State Assembly Elections:** **No.** Under current statutory rules, NOTA is treated as a "fictional candidate". Even if NOTA gets the highest number of votes, the candidate with the highest number of valid votes among the actual contestants is declared elected.\n  * **In Local Body Elections (State Exception):** State Election Commissions in **Maharashtra, Haryana, and Delhi** have ruled that if NOTA secures the most votes in municipal or panchayat elections, none of the candidates are declared elected, and a **fresh re-election must be held**!\n* **Does NOTA Lead to Re-polling in Lok Sabha?** Not currently under national law, though civic organizations like ADR have petitioned the Supreme Court to mandate fresh elections if NOTA finishes first.`,
          sources: ['PUCL v. Union of India (2013) 10 SCC 1', 'Election Commission of India NOTA Manual'],
          suggestions: ['How does the EVM and VVPAT process work?', 'What are my voter rights at the polling station?', 'What documents can I carry to vote?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🗳️ "None of the Above" (NOTA) in the UK\n\n* **No Official NOTA Option:** Ballot papers in UK Parliamentary and local council elections do NOT feature a formal "None of the Above" box.\n* **Protest Voting (Spoiling Your Ballot):** Electors who wish to register dissatisfaction with all candidates intentionally "spoil" their ballot paper (e.g. by drawing a line across the sheet, writing "None", or leaving it completely blank).\n* **How Spoiled Ballots are Handled:** Spoiled ballots are officially counted and categorized under "rejected ballot papers" during the count, and the total number of rejected ballots is publicly declared by the Returning Officer on stage.\n* **First Past the Post:** The valid candidate with the highest number of votes wins the seat.`,
          sources: ['The Electoral Commission UK', 'Representation of the People Act 1983'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I find my UK polling station?', 'How does First Past the Post work?']
        };
      } else {
        return {
          content: `### 🗳️ "None of the Above" (NOTA) in the United States\n\n* **Nevada (The Only State with Statewide NOTA):** Nevada is the only U.S. state that legally includes "None of These Candidates" on all statewide ballots (since 1975). However, even if "None" receives the highest vote tally, the actual candidate with the next highest votes is certified as the winner.\n* **Blank Ballot / Undervote:** In all other states, voters register protest by "undervoting" (leaving the presidential or congressional contest blank while voting for down-ballot races).\n* **Write-In Candidates:** Many states allow writing in alternative candidates, provided the write-in candidate has formally registered before the statutory deadline.`,
          sources: ['Nevada Revised Statutes (NRS 293.269)', 'National Conference of State Legislatures (NCSL)'],
          suggestions: ['How do I find my polling place?', 'What is a provisional ballot?', 'What ID do I need to vote?']
        };
      }
    }

    // =========================================================================
    // INTENT 11c: CAN I VOTE ONLINE / INTERNET & DIGITAL VOTING
    // (Guarded to not hijack online registration queries)
    // =========================================================================
    const isOnlineRegistration = this.hasAny(q, ['register', 'registration', 'sign up', 'enrol', 'enroll', 'apply']);

    if (this.hasAny(q, ['vote online', 'online voting', 'vote from home on internet', 'vote from my phone', 'vote on phone', 'digital voting', 'internet voting', 'vote through app', 'can i vote online', 'can we vote online', 'remote voting']) && !isOnlineRegistration) {
      if (jurKey === 'india') {
        return {
          content: `### 📱 Can You Vote Online or Through a Mobile App in India? (No)\n\n* **No Online Internet Voting:** Under Indian electoral law, **general citizens CANNOT vote online, on the internet, or via any mobile app**.\n* **In-Person EVM Voting:** Under the *Conduct of Elections Rules, 1961*, voting is conducted strictly **in person** using standalone Electronic Voting Machines (EVMs) at your assigned polling booth.\n* **Why EVMs Are Not Connected to the Internet:** Indian EVMs and VVPATs are 100% standalone battery-operated microcontrollers with no Wi-Fi, Bluetooth, or internet connections, specifically to eliminate remote hacking and cyber interference.\n* **The Only Digital Element (ETPBS):** Armed forces and service voters receive postal ballot papers digitally via the secure **ETPBS system**, but must physically print, mark, and post them back.\n* **⚠️ Warning on Scams:** Any website, WhatsApp link, or app claiming to let you "vote online" is a fraudulent scam. Never share OTPs or Aadhaar numbers on unofficial sites!`,
          sources: ['ECI EVM Technical Security Manual', 'Representation of the People Act 1951', 'Conduct of Elections Rules 1961'],
          suggestions: ['How do I find my polling booth?', 'What documents can I carry to vote?', 'How does the EVM and VVPAT process work?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 💻 Can You Vote Online in the UK? (No)\n\n* **No Online Voting:** The United Kingdom does **not permit online or internet voting** in parliamentary general elections, devolved elections, or local council elections.\n* **Three Official Ways to Vote in the UK:**\n  1. **In-Person at Polling Station:** With accepted original Photo ID on polling day (7:00 AM to 10:00 PM).\n  2. **By Postal Vote:** Apply online at [gov.uk/apply-postal-vote](https://www.gov.uk/apply-postal-vote) to have paper ballots mailed to your home.\n  3. **By Proxy Vote:** Authorize a trusted individual to vote on your behalf at your assigned polling station.\n* **Cybersecurity:** UK electoral authorities maintain paper ballots to guarantee absolute secrecy and prevent cyber interference.`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'GOV.UK How to Vote Guide'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I apply for a postal vote in the UK?', 'Can I vote by proxy in the UK?']
        };
      } else {
        return {
          content: `### 💻 Can You Vote Online in the United States? (No)\n\n* **No General Online Internet Voting:** There is **no online or internet voting** for federal, state, or municipal elections in the United States.\n* **Cybersecurity Standards:** Federal security agencies (CISA, FBI, and EAC) strictly recommend paper-based ballots or voter-verified paper audit trails (VVPAT) to safeguard against foreign interference and hacking.\n* **Only Limited Exception (Select Military & Overseas):** A few states permit active-duty military and overseas citizens (under UOCAVA) to return ballots via secure web portals or encrypted email due to international shipping delays.\n* **Official Voting Methods:** Vote in person (early or on Election Day) or by mail-in / absentee ballot returned via USPS or an official secure drop box.`,
          sources: ['Cybersecurity and Infrastructure Security Agency (CISA.gov)', 'U.S. Election Assistance Commission (EAC)', 'Vote.gov'],
          suggestions: ['How do mail-in ballots work?', 'How do I find my polling place?', 'What is a provisional ballot?']
        };
      }
    }

    // =========================================================================
    // INTENT 11d: CRIMINAL RECORD, PRISONERS & FELON VOTING RIGHTS
    // =========================================================================
    if (this.hasAny(q, ['criminal record', 'criminal records', 'criminal', 'criminals', 'prison', 'prisoner', 'prisoners', 'felon', 'felons', 'felony', 'felonies', 'jail', 'in jail', 'arrested', 'under arrest', 'convict', 'conviction', 'convicted'])) {
      if (jurKey === 'india') {
        return {
          content: `### ⚖️ Voting Rights for Prisoners & Persons with Criminal Records in India\n\n* **Under-Trial and Convicted Prisoners in Jail (Cannot Vote):**\n  * Under **Section 62(5) of the Representation of the People Act, 1951**, no person confined in a prison (whether convicted or facing trial) or in the lawful custody of the police is entitled to vote in any election.\n* **Exception (Preventive Detention):**\n  * Persons detained under **preventive detention laws** (e.g. NSA) are legally entitled to vote via **postal ballot** under Section 62(5).\n* **Voters Out on Bail (Can Vote!):**\n  * If you have a pending criminal case or FIR against you but are **currently out on bail**, you retain your **full constitutional right to vote**! Being an accused does not revoke your voting rights.\n* **After Sentence Completion:**\n  * Once a sentence is served and a person is released, their voting rights are restored (unless disqualified under Section 11A for corrupt electoral practices).`,
          sources: ['Section 62(5), Representation of the People Act 1951', 'Supreme Court of India (Anukul Chandra Pradhan v. Union of India)'],
          suggestions: ['How to check if my name is on the electoral roll?', 'What documents can I carry to vote?', 'What are my voter rights?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### ⚖️ Voting Rights for Prisoners & Criminal Records in the UK\n\n* **Convicted Prisoners Serving Custodial Sentences (Cannot Vote):**\n  * Under the *Representation of the People Act 1983*, convicted prisoners serving a prison sentence are legally disqualified from voting in UK elections.\n* **Remand Prisoners (Can Vote!):**\n  * Prisoners held on remand (awaiting trial or unconvicted) are **fully eligible to vote** via postal vote or proxy vote.\n* **Community Sentences & Fines:**\n  * Offenders serving non-custodial community service orders, suspended sentences, or paying fines retain their full voting rights.\n* **Immediately Upon Release:**\n  * As soon as an offender is released from prison, voting rights are immediately restored—you simply need to register on the Electoral Register at [gov.uk/register-to-vote](https://www.gov.uk/register-to-vote).`,
          sources: ['Representation of the People Act 1983', 'The Electoral Commission UK'],
          suggestions: ['How do I register to vote in the UK?', 'What photo ID is accepted in the UK?', 'How does postal voting work in the UK?']
        };
      } else {
        return {
          content: `### ⚖️ Voting Rights for People with Felony Convictions (United States)\n\nIn the U.S., voting rights for individuals with criminal records are determined entirely by **state law**:\n\n* **Never Lose Voting Rights (2 States & D.C.):** In **Maine, Vermont, and Washington D.C.**, individuals with felony convictions never lose their right to vote—they can vote from prison by absentee ballot.\n* **Restored Immediately Upon Release (26 States):** In states like California, New York, Colorado, Michigan, Nevada, and Washington, voting rights are automatically restored as soon as you are released from prison (even while on parole/probation).\n* **Restored After Probation / Parole (14 States):** Rights are restored after completing your full sentence, including probation and parole.\n* **Restoration Requires Individual Action (Select States):** In states like Florida, Alabama, Mississippi, and Virginia, full restoration may require petitioning the governor or paying all court fees/fines.\n\n> 💡 Check [RestoreYourVote.org](https://restoreyourvote.org) or [Vote.gov](https://vote.gov) for state-by-state restoration steps.`,
          sources: ['National Conference of State Legislatures (NCSL) Felon Voting Rights', 'Department of Justice Civil Rights Division', 'Vote.gov'],
          suggestions: ['How do I check if I am registered to vote?', 'What ID do I need to vote?', 'What is a provisional ballot?']
        };
      }
    }

    // =========================================================================
    // INTENT 12: MAIL-IN / ABSENTEE / POSTAL BALLOTS
    // =========================================================================
    if (this.hasAny(q, [
      'mail-in', 'mail in ballot', 'vote by mail', 'absentee', 'absentee ballot',
      'drop box', 'early voting', 'postal ballot', 'postal ballots', 'postal vote',
      'postal votes', 'postal voting', 'vote by post', 'voting by post', 'ballot cure',
      'how to mail', 'absentee voting', 'how do i apply for a postal vote in the uk',
      'can i vote by post in the uk', 'how does postal voting work in the uk',
      'can i vote by post without photo id in the uk'
    ])) {
      if (jurKey === 'india') {
        return {
          content: `### 📮 Postal Ballot Rules in India (Who Can Vote by Mail?)\n\nIn India, general registered electors **cannot vote by mail or absentee ballot**—under the *Conduct of Elections Rules, 1961*, general citizens must cast their vote in person at their designated EVM polling station.\n\n#### 👥 Who is Legally Eligible for Postal Ballots in India?\n1. **Senior Citizens (Aged 85+) & PwD Electors (40%+ Benchmark):**\n   * Eligible for **Home Voting** via postal ballot by submitting **Form 12D** to the Returning Officer within 5 days of election notification.\n   * An ECI polling team (two polling officials, a videographer, and security personnel) visits your home with a portable voting compartment to collect your postal ballot in secret.\n2. **Service Voters (Armed Forces & Personnel Posted Abroad):**\n   * Armed Forces personnel, paramilitary forces, and government employees stationed abroad receive ballots electronically via the **ETPBS (Electronically Transmitted Postal Ballot System)** and return them by post.\n3. **Polling Personnel & Drivers on Election Duty:**\n   * Can cast a postal ballot using **Form 12**, or obtain an **Election Duty Certificate (EDC - Form 12A)** to vote on the EVM at the polling station where they are on duty.\n4. **Essential Services Workers:**\n   * Metro/railway staff, medical emergency workers, and accredited media on duty on polling day.\n\n> ⚠️ **General Citizens:** Check your polling station using SMS \`ECIPS <EPIC>\` to **1950** and vote in person on polling day!`,
          sources: ['Conduct of Elections Rules 1961 (Part III)', 'ECI Postal Ballot & Home Voting Guidelines', 'ETPBS Portal'],
          suggestions: ['How does home voting work for senior citizens (Form 12D)?', 'How do I find my polling booth?', 'What ID do I need to vote in India?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 📮 Postal Voting in the United Kingdom\n\nIn Great Britain (England, Scotland, and Wales), **any registered voter can apply for a Postal Vote**—you do NOT need to give a medical or work-related reason!\n\n#### How to Apply for a UK Postal Vote:\n1. **Apply Online (Quickest):** Visit [gov.uk/apply-postal-vote](https://www.gov.uk/apply-postal-vote) and submit your National Insurance number and a photo of your handwritten signature.\n2. **Application Deadline:** Your application must be received by your local council's Electoral Registration Office by **5:00 PM, 11 working days before polling day**.\n3. **Identity Verification (No Photo ID Required!):** Unlike in-person voting, **you do NOT need photo ID to vote by post**; identity is verified by matching your date of birth and signature on the postal voting statement.\n\n#### Returning Your Postal Ballot:\n* **By Post:** Post it back via Royal Mail as soon as possible so it arrives before polls close at 10:00 PM on election day.\n* **Hand Delivery:** You can hand-deliver your completed postal pack to your local council or to your assigned polling station on polling day before 10:00 PM (you must complete an official postal vote return form when handing it in).\n\n> 💡 **Northern Ireland:** In Northern Ireland, postal voting requires a specific eligible excuse and form.`,
          sources: ['GOV.UK (gov.uk/apply-postal-vote)', 'The Electoral Commission UK', 'Representation of the People Act 1983'],
          suggestions: ['What photo ID is accepted in the UK?', 'What is a Voter Authority Certificate (VAC)?', 'Can I vote by proxy in the UK?']
        };
      } else {
        return {
          content: `### 📮 Mail-in, Absentee & Early Voting (United States)\n\nIn the United States, mail-in and absentee voting policies are established by each state:\n\n* **Universal All-Mail States (8 States):** In California, Colorado, Hawaii, Nevada, Oregon, Utah, Vermont, and Washington, every active registered voter automatically receives a ballot in the mail 2 to 4 weeks before Election Day.\n* **No-Excuse Absentee States (28+ States):** Any registered voter can request a mail-in ballot without giving a reason.\n* **Excuse-Required States (14 States):** You must provide a valid reason (e.g., illness, disability, out-of-county travel, military duty).\n\n#### Key Rules for Your Mail-in Ballot to Count:\n1. **Complete the Outer Certificate:** Use blue or black ink. Sign the outer declaration envelope using your **official legal signature** (matching your driver's license/DMV signature).\n2. **Witness / Notary:** A few states (e.g., AL, AK, LA, MS, NC, WI) require one or two witness signatures or a notary stamp on the envelope.\n3. **Returning Your Ballot:**\n   * **Official Drop Box:** Drop it off at a 24/7 secure county ballot drop box.\n   * **Mail via USPS:** Post at least 7 days before Election Day to ensure on-time delivery.\n   * **In-Person Delivery:** Hand-deliver to your county elections office or polling place.\n4. **Tracking & Curing:** Most states offer free ballot tracking alerts (e.g., Where's My Ballot / BallotTrax). If your signature is flagged, state law gives you a **48 to 72 hour curing window** to verify your identity.\n\n> 💡 **Changed Your Mind?** In most states, if you received a mail ballot but want to vote in person, bring your unvoted mail ballot and envelope to your polling place so poll workers can void it!`,
          sources: ['Vote.gov Absentee & Mail Voting Guide', 'National Conference of State Legislatures (NCSL)', 'U.S. Election Assistance Commission'],
          suggestions: ['Can I vote in person if I received a mail-in ballot?', 'What is a provisional ballot?', 'How do I track my mail ballot?']
        };
      }
    }

    // =========================================================================
    // INTENT 13: TIME OFF WORK TO VOTE
    // =========================================================================
    if (this.hasAny(q, ['time off', 'time off work', 'voting leave', 'leave to vote', 'employer', 'boss', 'paid leave', 'take time off', 'hours off', 'work hours to vote', 'leave from work', 'can i leave work', 'allowed to leave work', 'work on election day', 'vote during work', 'can i take time off work to vote'])) {
      if (jurKey === 'india') {
        return {
          content: `### ⏱️ Mandatory Paid Holiday for Voting in India (Section 135B RPA 1951)\n\nUnder **Section 135B of the Representation of the People Act, 1951**, election day is a **legally mandated paid holiday**:\n\n#### ✅ Key Legal Provisions:\n1. **Mandatory Paid Holiday:** Every person employed in any business, trade, industrial undertaking, commercial establishment, shop, or factory who is entitled to vote is **granted a holiday on polling day**.\n2. **No Wage Deduction:** No deduction or abatement of wages can be made on account of this holiday. Daily-wage, contractual, and casual workers are equally protected.\n3. **Criminal Penalties for Employers:** Any employer who contravenes Section 135B is punishable with a fine under Indian law.\n4. **Shifts & Operations:** Even continuous-process industries or IT/corporate firms must allow sufficient scheduled paid time off for employees to visit their polling booth.\n\n> 📞 **Enforcement:** If an employer refuses voting leave, electors can lodge a complaint with the **District Election Officer (DEO)**, Labor Commissioner, or via the **1950 Helpline**.`,
          sources: ['Section 135B, Representation of the People Act 1951', 'Ministry of Labour & Employment Directives'],
          suggestions: ['What time do polls open and close in India?', 'What documents can I carry to vote in India?', 'How to find my polling booth in India?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### ⏱️ Voting & Work Hours in the United Kingdom\n\n* **No Statutory Paid Voting Leave:** In the UK, there is no statutory employment right to take paid time off work specifically to vote.\n* **15-Hour Polling Day (7:00 AM to 10:00 PM):** Polling stations in Great Britain and Northern Ireland remain open continuously from **7:00 AM until 10:00 PM** specifically so employees can vote either before their shift starts or after work ends.\n* **Flexible Voting Solutions:**\n  * **Postal Vote:** Apply for a postal vote at [gov.uk/apply-postal-vote](https://www.gov.uk/apply-postal-vote) so your ballot arrives at your home well in advance.\n  * **Proxy Vote:** Appoint someone you trust to vote on your behalf at your polling station.\n* **Employer Dialogue:** ACAS guidelines encourage employers to offer reasonable flexibility (such as staggered start or finish times) on election day.`,
          sources: ['The Electoral Commission UK', 'ACAS Guidance on Civic Duties', 'Representation of the People Act 1983'],
          suggestions: ['What time do UK polls open and close?', 'How does postal voting work in the UK?', 'What photo ID is accepted in the UK?']
        };
      } else {
        return {
          content: `### ⏱️ State Voting Leave Laws (United States)\n\n* **Over 30 States Mandate Statutory Voting Leave:** State labor codes protect employees from being penalized for taking time to vote:\n  * **Paid Voting Leave (Up to 2 Hours):** States like California, New York, Colorado, Illinois, Minnesota, and Washington D.C. require employers to provide up to **2 hours of paid time off** to vote if the employee does not have sufficient non-work hours while polls are open.\n  * **Unpaid Protected Time:** Other states allow 1 to 3 hours of unpaid protected leave.\n* **Notice Requirements:** Many states require you to give your employer **at least 24 to 48 hours advance notice** before Election Day.\n* **Employer Posting:** In states like California and New York, employers are legally required to post notices of voting leave rights in the workplace at least 10 days before the election.\n\n> 💡 **Alternative:** Take advantage of Early Voting on weekends or request a Mail-in Ballot to vote on your own schedule!`,
          sources: ['National Conference of State Legislatures (NCSL) State Voting Leave Statutes', 'State Departments of Labor'],
          suggestions: ['What time do polls open and close?', 'How do mail-in ballots work?', 'How do I find my polling place?']
        };
      }
    }

    // =========================================================================
    // INTENT 14: MANIFESTOS & EVALUATING CANDIDATES
    // =========================================================================
    if (this.hasAny(q, ['manifesto', 'candidate', 'candidates', 'evaluating', 'compare', 'who to vote', 'policy', 'debates', 'fact check', 'what should i look for in a candidate manifesto'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🔍 How to Objectively Evaluate Candidates & Manifestos (India)\n\nBefore casting your vote on the EVM, review candidates using these verified civic resources:\n\n1. **ECI KYC App (Know Your Candidate):**\n   * Download the official Election Commission app to view mandatory criminal antecedent disclosures for all candidates contesting in your constituency.\n2. **Form 26 Affidavits (Assets, Liabilities & Cases):**\n   * Every candidate must file a sworn Form 26 affidavit disclosing movable/immovable assets, liabilities, educational qualifications, and pending FIRs/charges. Access them online at [voters.eci.gov.in](https://voters.eci.gov.in).\n3. **Association for Democratic Reforms (ADR / MyNeta.info):**\n   * Visit [myneta.info](https://myneta.info) for independent non-partisan analysis of candidate wealth growth, criminal records, and educational backgrounds.\n4. **ECI Model Code of Conduct (MCC) on Manifestos:**\n   * Guidelines state manifestos must reflect the rationale for promises and indicate the budgetary avenues for meeting financial pledges.\n5. **Constituency Track Record:** Review the candidate's actual local performance on water, healthcare, roads, education, and sanitation.`,
          sources: ['Election Commission of India (voters.eci.gov.in)', 'Association for Democratic Reforms (myneta.info)', 'ECI Model Code of Conduct'],
          suggestions: ['How does the EVM and VVPAT process work?', 'What documents can I carry to vote in India?', 'What is NOTA on the EVM?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🔍 How to Objectively Evaluate UK Candidates & Party Manifestos\n\nIn the UK's parliamentary system, voters elect a local Member of Parliament (MP) to represent their constituency in the House of Commons:\n\n1. **WhoCanIVoteFor.co.uk:**\n   * Visit [whocanivotefor.co.uk](https://whocanivotefor.co.uk) and enter your postcode to see every confirmed candidate running in your constituency, their statements, and social links.\n2. **Official Party Manifestos:**\n   * During the campaign, major parties publish detailed policy manifestos outlining commitments for the NHS, taxation, schools, transport, housing, and the economy.\n3. **Independent Fact-Checking:**\n   * Check claims against independent UK fact-checking charities like **Full Fact** ([fullfact.org](https://fullfact.org)) and the **Institute for Fiscal Studies (IFS)** for fiscal credibility.\n4. **TheyWorkForYou.com:**\n   * If your candidate is a sitting MP, check their historical parliamentary voting record, attendance, and registered financial interests at [theyworkforyou.com](https://www.theyworkforyou.com).\n5. **Local Hustings:** Attend non-partisan community debates in your constituency to ask candidates direct questions.`,
          sources: ['The Electoral Commission UK', 'WhoCanIVoteFor.co.uk (Democracy Club)', 'TheyWorkForYou (mySociety)'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I find my UK polling station?', 'What time do UK polls close?']
        };
      } else {
        return {
          content: `### 🔍 How to Objectively Evaluate Candidates & Manifestos (United States)\n\nEvaluate political candidates and ballot propositions using an objective, non-partisan rubric:\n\n1. **Vote411.org (League of Women Voters):**\n   * Visit [Vote411.org](https://www.vote411.org) to enter your address and see side-by-side candidate comparisons where candidates answer identical policy questions in their own words.\n2. **Ballotpedia:**\n   * Review [Ballotpedia.org](https://ballotpedia.org) for detailed, neutral profiles of federal, state, and down-ballot judicial/school board candidates.\n3. **Campaign Finance Disclosures (FEC.gov):**\n   * Look up candidate donors, PAC funding, and corporate contributions at the **Federal Election Commission** ([fec.gov](https://www.fec.gov)).\n4. **Independent Fact-Checking:**\n   * Cross-reference campaign speeches and ads with non-partisan watchdogs like **FactCheck.org** and **PolitiFact**.\n5. **Down-Ballot & Local Elections:** Pay close attention to school board, municipal council, and local ballot propositions—these directly decide local tax rates, zoning, and school budgets.`,
          sources: ['Vote411.org (League of Women Voters)', 'Ballotpedia.org', 'Federal Election Commission (FEC.gov)'],
          suggestions: ['What is a provisional ballot?', 'How do mail-in ballots work?', 'What ID do I need to bring to vote?']
        };
      }
    }

    // =========================================================================
    // INTENT 14b: WHAT IS EPIC ID / VOTER ID CARD (INFORMATIONAL)
    // =========================================================================
    if (this.hasAny(q, ['what is epic', 'what is an epic', 'epic id', 'epic card', 'electors photo identity', 'what does epic stand', 'full form of epic', 'epic full form', 'what is voter id card', 'what is voter card', 'epic meaning', 'what is a voter id', 'what is an epic id'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🪪 What is an EPIC ID Card? (India)\n\n**EPIC** stands for **Electors Photo Identity Card** — officially known as the **Voter ID Card** in India.\n\n#### Key Facts About EPIC:\n* **Issued By:** The **Election Commission of India (ECI)** through the office of the Chief Electoral Officer of each state.\n* **Purpose:** Serves as both (1) proof of voter registration in the Electoral Roll, and (2) an accepted photo identity document for voting on polling day.\n* **Unique Number:** Each EPIC card carries a unique **10-character alphanumeric EPIC Number** (e.g., ABC1234567) which links you to your specific constituency and polling booth.\n* **What It Contains:** Your photograph, full name, relative's name, date of birth, gender, residential address, and constituency details.\n* **e-EPIC (Digital):** Since 2021, you can also download your official **e-EPIC** as a PDF directly from [voters.eci.gov.in](https://voters.eci.gov.in) or via the DigiLocker app — fully valid at polling stations!\n\n#### Is EPIC Mandatory to Vote?\n* **No!** Having your name on the **Electoral Roll** is what matters most. You can vote with **any of the 12 approved photo IDs** (Aadhaar, Driving License, Passport, PAN Card, etc.) even without your physical EPIC card.\n\n> 📝 **Apply for EPIC:** Submit **Form 6** online at [voters.eci.gov.in](https://voters.eci.gov.in) — free of charge. Physical card is delivered to your home via India Post Speed Post.`,
          sources: ['Election Commission of India (voters.eci.gov.in)', 'Representation of the People Act 1950', 'ECI EPIC Guidelines'],
          suggestions: ['How to apply for a voter ID card (Form 6)?', 'How to download e-EPIC?', 'What IDs are accepted at the polling booth?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🪪 What is a UK Poll Card & Voter Authority Certificate (VAC)?\n\nIn the United Kingdom, there is no single national "voter ID card" like India's EPIC, but electors receive and use specific identification documents:\n\n* **The Red Poll Card:** Posted to your registered home address before every election. It confirms you are on the Electoral Register and lists your polling station address. You do NOT need to bring it to vote, but it speeds up check-in.\n* **Accepted Photo ID Requirement:** Under the Elections Act 2022, you must present accepted Photo ID (Passport, Driving Licence, Blue Badge, or Concessionary Bus Pass) to receive a ballot paper.\n* **Voter Authority Certificate (VAC):** If you do not have an accepted photo ID, you can apply for a **free Voter Authority Certificate** online at [gov.uk/apply-for-photo-id-voter-authority-certificate](https://www.gov.uk/apply-for-photo-id-voter-authority-certificate). Your local council prints and posts it to you.\n\n> 💡 Expired Photo ID is accepted as long as the photograph still resembles you!`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'GOV.UK Voter ID Guide', 'Elections Act 2022'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I register to vote in the UK?', 'What time do UK polls close?']
        };
      } else {
        return {
          content: `### 🪪 What is a Voter Registration Card? (United States)\n\nA **Voter Registration Card / Certificate** is an official paper card mailed to you by your county elections office after you successfully register to vote.\n\n* **What It Contains:** Your full name, residential address, voting precinct number, and assigned political districts (Congressional, State Senate, County Commissioner).\n* **Is the Card Required to Vote?** In most US states, **no**—the paper registration card itself is not required at the polling place. Instead, states require a State Driver's License, State Non-Driver Photo ID, Passport, or signature match in the poll book.\n* **Provisional Ballot Safeguard:** If your ID is questioned on Election Day, you are legally entitled to cast a **Provisional Ballot** under HAVA Section 302.\n\n> 💡 Register to vote or check your status anytime at [Vote.gov](https://vote.gov) or [USA.gov/register-to-vote](https://www.usa.gov/register-to-vote).`,
          sources: ['USA.gov/register-to-vote', 'Vote.gov (Official U.S. Voting Information)', 'Help America Vote Act (HAVA)'],
          suggestions: ['How do I register to vote?', 'What ID do I need to vote?', 'How does a provisional ballot work?']
        };
      }
    }

    // =========================================================================
    // INTENT 15: RESULTS, COUNTING & CERTIFICATION
    // =========================================================================
    if (this.hasAny(q, ['election result', 'vote count', 'vote counting', 'ballot count', 'recount', 'certify', 'exit poll', 'who won', 'election winner', 'counting of votes', 'results declared', 'final result', 'how are election results counted'])) {
      if (jurKey === 'india') {
        return {
          content: `### 📊 Election Results, EVM Counting & Declaration in India\n\n* **Counting Day Schedule:** Counting of votes begins promptly at **8:00 AM** on the scheduled counting day in each designated counting center under the supervision of the Returning Officer (RO) and ECI Observers.\n* **Postal Ballots First:** Postal ballots are counted first starting at 8:00 AM. Counting of EVM votes starts 30 minutes later at 8:30 AM.\n* **EVM Counting Protocol:** Control Units (CU) from each polling station are brought to the counting tables in presence of candidate counting agents. The seal is broken, and the 'Result' button displays candidate tallies.\n* **Mandatory VVPAT Paper Verification:** By Supreme Court order, physical paper slips from **5 randomly selected VVPAT units per assembly segment** are hand-counted and matched against the electronic EVM count.\n* **Live Official Results:** Round-by-round trends and verified results are published live on [results.eci.gov.in](https://results.eci.gov.in) and the ECI Voter Helpline App.\n* **Declaration & Certificate:** The Returning Officer formally declares the winner and issues **Form 21C / Form 21E (Certificate of Election)**.`,
          sources: ['Election Commission of India Results Portal (results.eci.gov.in)', 'ECI EVM & VVPAT Counting Manual', 'Conduct of Elections Rules 1961'],
          suggestions: ['How does the EVM and VVPAT process work?', 'What is NOTA on the EVM?', 'What are my voter rights at the polling station?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 📊 UK Election Results & The Overnight Count\n\n* **Overnight Ballot Counting:** In UK General Elections, counting begins immediately as soon as polls close at **10:00 PM on Thursday night**.\n* **Ballot Box Verification:** Sealed ballot boxes are transported from polling stations to central constituency counting halls. Clerks verify total ballot papers against ballot paper accounts before sorting by candidate.\n* **First Past the Post (FPTP):** In each single-member constituency, the candidate who receives the highest number of votes is declared the Member of Parliament (MP).\n* **Declaration on Stage:** The local Returning Officer reads out the results publicly on stage in presence of all candidates.\n* **Forming Government:** The political party that wins **326 or more seats** in the 650-seat House of Commons secures an absolute majority, and their leader is invited by the Monarch to form His Majesty's Government.`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'UK Parliament (parliament.uk)', 'Representation of the People Act 1983'],
          suggestions: ['What photo ID is accepted in the UK?', 'What time do UK polls close?', 'How does First Past the Post work in the UK?']
        };
      } else {
        return {
          content: `### 📊 Election Results, Canvassing & Certification (United States)\n\n* **Media Projections vs Official Certification:**\n  * News networks make statistical calls based on exit polling and early tallies, but **media projections have zero legal status**.\n  * Official certification takes several days to weeks to account for provisional ballots, overseas military ballots, and late-arriving postmarked mail ballots.\n* **Bipartisan Canvass:** Local bipartisan canvassing boards review discrepancies, verify signatures, and audit random precincts.\n* **Recounts:** Many states trigger automatic recounts if the margin of victory is within 0.5% or 0.25%.\n* **Official Certification:** State Secretaries of State sign the formal Certificate of Ascertainment, and in presidential elections, electors meet in December to cast Electoral College votes.`,
          sources: ['National Conference of State Legislatures (NCSL)', 'National Association of State Election Directors', 'U.S. Election Assistance Commission'],
          suggestions: ['What is a provisional ballot?', 'How do mail-in ballots work?', 'How do I track my mail ballot?']
        };
      }
    }

    // =========================================================================
    // INTENT 16: PWD, SENIOR CITIZENS & ACCESSIBILITY / FORM 12D
    // =========================================================================
    if (this.hasAny(q, ['pwd', 'disability', 'handicapped', 'wheelchair', 'blind', 'elderly', 'senior citizen', 'home voting', 'braille', 'accessible', 'form 12d', 'what is form 12d', 'how does home voting work for senior citizens', 'voting facilities for senior citizens and pwd'])) {
      if (jurKey === 'india') {
        return {
          content: `### ♿ Accessibility & Senior Citizen Voting Facilities (India - Form 12D)\n\nThe Election Commission of India provides statutory accommodations under the *Rights of Persons with Disabilities Act, 2016*:\n\n* **Home Voting for 85+ & PwD (Form 12D):** Senior citizens aged **85 years and older** and PwD electors with 40%+ benchmark disability can apply for Home Voting by submitting Form 12D to the Returning Officer within 5 days of election notification. An ECI mobile voting team brings a sealed ballot compartment directly to their home.\n* **Saksham ECI App:** Download the dedicated **Saksham App** to request wheelchairs, volunteer assistance, or pick-up/drop transportation at your polling booth.\n* **Braille on EVMs:** All EVM Balloting Units feature embossed Braille numbering (1 to 16) alongside candidate buttons. Braille dummy ballot sheets are also provided by the Presiding Officer.\n* **Companion Assistance (Rule 49N):** Electors with visual impairment or physical disability may take an adult companion of their choice into the booth to assist in recording their vote.\n* **Booth Facilities:** Ramp access, priority queues (no waiting in general lines), and ground-floor voting compartments at all polling locations.`,
          sources: ['ECI Saksham Guidelines', 'Conduct of Elections Rules 1961 (Rule 49N)', 'Rights of Persons with Disabilities Act 2016'],
          suggestions: ['What documents do I need to vote in India?', 'How does the EVM and VVPAT process work?', 'How to find my polling booth in India?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### ♿ Accessibility & Assistance at UK Polling Stations\n\nUnder the **Elections Act 2022**, Returning Officers must ensure polling stations are accessible to disabled electors:\n\n* **Physical Access:** Step-free wheelchair access, low-level polling booths, and adequate lighting.\n* **Assistance in the Booth:** Disabled electors may be accompanied by a companion aged 18+, or request impartial assistance from the Presiding Officer to mark their ballot paper.\n* **Tactile Voting Devices & Large Print:** Polling stations provide tactile voting devices for blind/partially sighted voters, large-print sample ballot papers, and handheld magnifying glasses.\n* **Alternative Voting:** Electors who cannot vote in person can apply for a **Postal Vote** or a **Proxy Vote** ahead of the election.`,
          sources: ['Elections Act 2022 (Section 9)', 'The Electoral Commission UK Accessibility Guidelines'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I apply for a postal vote in the UK?', 'What time do UK polls close?']
        };
      } else {
        return {
          content: `### ♿ Accessibility & Senior Citizen Voting Accommodations (United States)\n\nFederal laws including the **Americans with Disabilities Act (ADA)**, **Voting Rights Act**, and **HAVA** guarantee accessible voting:\n\n* **Accessible Voting Machines:** Every polling place must have at least one ADA-compliant voting device (touchscreen with high-contrast text, audio headsets with tactile keypads, and sip-and-puff inputs).\n* **Curbside Voting:** In many states, voters with mobility impairments can request curbside voting outside the precinct building.\n* **Companion Assistance:** You may bring anyone of your choice (except your employer or union officer) to help you read or mark your ballot.\n* **Permanent Absentee / Mail-in Status:** In many states, senior citizens and voters with disabilities can register for permanent mail-in ballot delivery.`,
          sources: ['Americans with Disabilities Act (ADA)', 'Help America Vote Act (HAVA)', 'U.S. Department of Justice Voting Section'],
          suggestions: ['How does a provisional ballot work?', 'What ID do I need to vote?', 'How do I find my polling place?']
        };
      }
    }

    // =========================================================================
    // INTENT 17: HOW TO VOTE (COMPLETE STEP-BY-STEP PROCESS)
    // =========================================================================
    if (this.hasAny(q, ['how to vote', 'steps to vote', 'process of voting', 'how do i vote', 'how can i vote', 'first time voting', 'guide to voting', 'how voting works', 'how to vote step by step'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🗳️ How to Vote in India: Step-by-Step Guide\n\nVoting in an Indian Parliamentary (Lok Sabha) or State Assembly (Vidhan Sabha) election is a simple, 4-step process:\n\n#### 1. Before Polling Day (Preparation):\n* **Check Your Name:** Confirm your name is on the Electoral Roll at [voters.eci.gov.in](https://voters.eci.gov.in).\n* **Locate Your Booth:** Send SMS \`ECIPS <EPIC-No>\` to **1950** or check the ECI Voter Helpline App.\n* **Carry Required ID:** Carry your Voter ID (EPIC) or any of the 12 approved documents (Aadhaar, Driving License, Passport, PAN Card, etc.).\n\n#### 2. At the Polling Station:\n* **First Polling Officer (Table 1):** Verifies your identity on the official electoral roll list.\n* **Second Polling Officer (Table 2):** Marks your left forefinger with indelible purple ink, records your signature/thumb impression in Form 17A (Register of Voters), and hands you a signed voter slip.\n* **Third Polling Officer (Table 3):** Collects your voter slip, presses the 'Ballot' button on the Control Unit, and directs you into the screened voting compartment.\n\n#### 3. Inside the Voting Compartment (EVM & VVPAT):\n* Look for the green **Ready light** on the Balloting Unit.\n* Locate your candidate's name, photograph, and symbol (or the NOTA button at the bottom).\n* Press the blue button next to your choice.\n* A red light glows with a long audio beep.\n* **Verify on VVPAT:** The slip with your candidate's symbol appears behind the glass window for **7 seconds** before dropping into the sealed box.\n\n#### 4. Exit:\n* Once the VVPAT slip drops and the beep ends, your vote is recorded. Exit the booth calmly.\n\n> 💡 **Tip:** Polling hours are generally 7:00 AM to 5:00 PM / 6:00 PM. If you are in line before closing time, you have the legal right to vote!`,
          sources: ['Election Commission of India (voters.eci.gov.in)', 'Conduct of Elections Rules 1961'],
          suggestions: ['What documents can I carry to vote in India?', 'How to find my polling booth in India?', 'Can I bring my mobile phone inside the booth?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🗳️ How to Vote in the United Kingdom: Step-by-Step Guide\n\nIn the UK, voting in general and local elections takes place on **Thursdays between 7:00 AM and 10:00 PM**.\n\n#### 1. Before Polling Day:\n* Make sure you are registered at [gov.uk/register-to-vote](https://www.gov.uk/register-to-vote) at least 12 working days in advance.\n* Check your **red poll card** sent in the post to confirm your assigned polling station.\n* Ensure you have valid original **Photo ID** (Passport, Driving Licence, Blue Badge, or free Voter Authority Certificate).\n\n#### 2. At the Polling Station:\n* Give your name and address to the election clerk at the desk (or hand over your poll card to speed things up).\n* Show your accepted Photo ID for verification.\n* The clerk marks your name off the register and hands you an official stamped ballot paper.\n\n#### 3. In the Private Polling Booth:\n* Walk into an empty curtained polling booth.\n* Use the pencil provided (or your own pen).\n* Mark a single **"X"** in the box next to your one chosen candidate. Do not sign or write anything else.\n* Fold your ballot paper in half to keep your vote secret.\n\n#### 4. Casting Your Vote:\n* Place your folded ballot paper into the sealed black ballot box.\n* You are done! Exit the polling station.\n\n> 💡 **Alternative Ways to Vote:** You can also apply in advance for a **Postal Vote** (sent to your home) or a **Proxy Vote** (appointing someone you trust to vote on your behalf).`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'GOV.UK How to Vote Guide'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I apply for a postal vote in the UK?', 'What is the voting age in the UK?']
        };
      } else {
        return {
          content: `### 🗳️ How to Vote in the United States: Step-by-Step Guide\n\nVoting in the U.S. is governed by state and federal law. Here is the complete step-by-step roadmap:\n\n#### 1. Before Election Day (Preparation):\n* **Check Registration:** Verify your status at [Vote.gov Confirm Registration](https://vote.gov) or [USA.gov Confirm Status](https://www.usa.gov/confirm-voter-registration).\n* **Find Your Polling Place:** Look up your assigned precinct at [USA.gov Find Polling Place](https://www.usa.gov/find-polling-place).\n* **Check ID Rules:** Determine if your state requires a strict photo ID, non-photo ID, or signature verification.\n* **Preview Your Ballot:** Review a sample ballot so you know candidates and ballot propositions in advance.\n\n#### 2. At Your Polling Place:\n* **Check In:** Give your name and address to the election poll worker.\n* **Present ID:** Show your state ID or sign the poll book/electronic poll pad.\n* **Receive Your Ballot:** You will receive a paper ballot or an access card for a touchscreen Ballot Marking Device (BMD).\n\n#### 3. Marking and Casting Your Ballot:\n* **Paper Ballot:** Go to a privacy booth. Completely fill in the oval next to your choices using the pen provided. Feed the completed ballot into the optical scanner until you see "Ballot Accepted".\n* **Touchscreen Machine:** Follow screen prompts, review your printed paper verification slip, and submit.\n* **Collect your "I Voted!" sticker** and exit.\n\n> 💡 **Three Ways to Vote in the US:**\n> 1. **Early In-Person Voting:** Cast your ballot before Election Day at designated Vote Centers.\n> 2. **Mail-In / Absentee Voting:** Request, complete, sign outer envelope, and mail or drop off at a secure Ballot Drop Box.\n> 3. **Election Day In-Person Voting:** Vote at your assigned precinct on Election Day.\n\n> 🛡️ **Legal Guarantee:** If your eligibility is questioned, demand a **Provisional Ballot** (HAVA § 302). If you are in line before polls close, stay in line—you must be allowed to vote!`,
          sources: ['USA.gov/how-to-vote', 'Vote.gov (Official U.S. Voting Information)', 'U.S. Election Assistance Commission (EAC)'],
          suggestions: ['How do I find my polling place?', 'What ID do I need to bring to the polls?', 'How does a provisional ballot work?']
        };
      }
    }

    // =========================================================================
    // INTENT 18: MINIMUM VOTING AGE & AGE ELIGIBILITY
    // =========================================================================
    if (this.hasAny(q, ['minimum age', 'voting age', 'age to vote', 'how old do i have to be', 'can 17 year old vote', 'can 16 year old vote', 'what age', 'am i old enough', 'what is the voting age in the uk', 'minimum voting age in india'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🎂 Minimum Voting Age in India (18 Years)\n\n* **Voting Age:** Under Article 326 of the Constitution of India (amended via 61st Constitutional Amendment Act, 1988), the minimum legal voting age is **18 years**.\n* **Four Qualifying Dates (ECI Reform):**\n  * Previously, you had to be 18 on January 1st to register.\n  * Now, you can pre-apply and register if you turn 18 on or before any of the **four qualifying dates** in a calendar year:\n    1. **January 1st**\n    2. **April 1st**\n    3. **July 1st**\n    4. **October 1st**\n* **Advance Application at 17:** Young citizens who are 17+ can submit **Form 6 in advance** so that their name is automatically registered once they turn 18 on the qualifying date!\n* **How to Apply:** Submit Form 6 on [voters.eci.gov.in](https://voters.eci.gov.in) with age proof (Aadhaar, Birth Certificate, PAN, or 10th Class Marksheet).`,
          sources: ['Constitution of India (Article 326)', 'Election Commission of India (voters.eci.gov.in)'],
          suggestions: ['How to apply for a voter ID card (Form 6)?', 'How to check my name on the electoral roll?', 'What documents can I use as age proof?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🎂 Minimum Voting Age in the United Kingdom\n\n* **UK General Elections (Westminster):** You must be **18 years old or older** on polling day to vote in UK Parliamentary general elections and by-elections.\n* **Scotland & Wales Devolved Elections:** The voting age is **16 years old** for Scottish Parliament, Senedd Cymru (Welsh Parliament), and local council elections in Scotland and Wales!\n* **Registering Early at 16 or 17:**\n  * In England and Northern Ireland, you can join the Electoral Register at **age 16**, but you can only vote once you reach 18.\n  * In Scotland and Wales, you can register at **age 14 or 15** and vote in devolved elections from age 16.\n* **How to Register:** Visit [gov.uk/register-to-vote](https://www.gov.uk/register-to-vote).`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Representation of the People Act 1983', 'Scottish Elections (Reduction of Voting Age) Act 2015'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I register to vote in the UK?', 'How do I find my UK polling station?']
        };
      } else {
        return {
          content: `### 🎂 Minimum Voting Age in the United States (18 Years)\n\n* **Federal Law (26th Amendment):** Under the 26th Amendment to the U.S. Constitution (ratified in 1971), the voting age for all federal, state, and local elections is **18 years old on or before Election Day**.\n* **Pre-Registration for 16 & 17 Year Olds:**\n  * In over **35 states and Washington D.C.**, youth aged 16 or 17 can **pre-register to vote** (e.g., at the DMV when receiving a learner's permit or driver's license, or online at [Vote.gov](https://vote.gov)).\n  * When you turn 18, your registration automatically activates!\n* **Voting in Primaries at 17:**\n  * In roughly **18 states** (including MD, IL, OH, VA, NC, IN, NM), 17-year-olds can vote in primary elections or caucuses if they will turn 18 by the date of the General Election in November.\n* **Municipal Elections at 16:** A few municipalities (such as Takoma Park & Greenbelt, MD, and Berkeley/Oakland, CA for school boards) permit 16- and 17-year-olds to vote in local municipal or school board elections.`,
          sources: ['26th Amendment to the U.S. Constitution', 'National Conference of State Legislatures (NCSL) Preregistration Laws', 'Vote.gov (Official U.S. Voting Information)'],
          suggestions: ['How do I register to vote?', 'How do I check if I am registered to vote?', 'What ID do I need to bring to vote?']
        };
      }
    }

    // =========================================================================
    // INTENT 19: COLLEGE STUDENTS & VOTING WHERE YOU GO TO SCHOOL
    // =========================================================================
    if (this.hasAny(q, ['college', 'student', 'university', 'campus', 'dorm', 'school', 'out of state student', 'rules for college students voting', 'rules for students voting in the uk'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🎓 Rules for College Students Voting in India\n\n* **Choice of Location:** College and university students residing away from their hometown in hostels or rented accommodation can choose to register either at their **permanent home address** OR at their **current place of residence (hostel/campus)**.\n* **Hostel Student Certificate:** If registering at your college address, submit a student declaration certificate countersigned by your college principal or hostel warden as proof of ordinary residence.\n* **One Person, One Vote:** You can only be registered in **one constituency** at a time. It is illegal to hold active voter registration in both your hometown and your university town.\n* **How to Register:** Use [voters.eci.gov.in](https://voters.eci.gov.in) to file Form 6 (or Form 8 to transfer).`,
          sources: ['Election Commission of India Guidelines on Student Electors', 'RPA 1950 Section 20'],
          suggestions: ['How to apply for a voter ID card (Form 6)?', 'How to check my name on the electoral roll?', 'What documents count as proof of address?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🎓 Rules for Students Voting in the UK\n\n* **Register at Both Addresses:** In the UK, university students can legally register to vote at **both** their home address AND their term-time university address!\n* **Local Elections (Double Vote Allowed):** If your university address and home address are in two different local council areas, you can legally vote in **both local council elections**.\n* **General Elections (Only Vote ONCE):** In a UK Parliamentary General Election, voting twice is a criminal offence. You must choose **one** constituency in which to cast your vote.\n* **How to Register:** Register online at [gov.uk/register-to-vote](https://www.gov.uk/register-to-vote) for both addresses.`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Representation of the People Act 1983'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I apply for a postal vote in the UK?', 'How do I register to vote in the UK?']
        };
      } else {
        return {
          content: `### 🎓 College Students Voting in the United States\n\n* **Right to Choose Your Voting Address:** As established by the U.S. Supreme Court (*Symm v. United States, 1979*), college students have the constitutional right to register and vote either at their **campus address (dorm or off-campus apartment)** OR at their **permanent home address**.\n* **Only Vote in ONE Place:** You cannot vote in both your college town and your hometown in the same election.\n* **Voting at Campus:** Register in your college town using your dorm/apartment address. You get to vote on local city council, state legislators, and ballot measures affecting your university community.\n* **Voting by Absentee Ballot from Home:** If you remain registered at your parents' home, request an Absentee / Mail-in ballot from your home county before the deadline at [Vote.gov](https://vote.gov) or [USA.gov](https://www.usa.gov/absentee-voting).\n* **Student ID as Photo ID:** Note that state photo ID laws vary—some states (e.g. CA, PA) accept university IDs, while others (e.g. TX, TN) do not unless it is a state-issued driver's license or passport.`,
          sources: ['Symm v. United States (441 U.S. 110)', 'Vote.gov Student Voting Guide', 'USA.gov/absentee-voting'],
          suggestions: ['How do I check my registration status?', 'How do mail-in ballots work?', 'What ID do I need to vote?']
        };
      }
    }

    // =========================================================================
    // INTENT 20: SAME-DAY REGISTRATION / CAN I REGISTER ON ELECTION DAY?
    // =========================================================================
    if (this.hasAny(q, [
      'register on election day', 'same-day registration', 'same day registration',
      'register on polling day', 'register on voting day', 'register and vote same day',
      'register at the poll', 'register at the polls', 'election day registration',
      'register today and vote', 'same day register', 'register on the day of election',
      'can i register to vote on election day', 'can i register on election day',
      'can i register today to vote', 'can i register on election day in the uk'
    ])) {
      if (jurKey === 'india') {
        return {
          content: `### 🗓️ Can You Register to Vote on Election Day in India? (No)\n\n* **No Election Day Registration:** Under Indian electoral law, **you cannot register on Election Day or polling day**.\n* **Statutory Electoral Roll Freeze:** Under the *Representation of the People Act, 1950* and ECI regulations, the electoral roll for a constituency officially **freezes on the last date of nominations of candidates** (usually 2 to 3 weeks prior to polling day).\n* **What Happens to Late Applications:** Any new Form 6 applications submitted during or after the freeze period are queued and processed only after elections conclude for the next electoral cycle.\n* **To Vote on Polling Day:** Your name **must already appear on the active Electoral Roll**.\n* **How to Check Your Name Now:** Visit [voters.eci.gov.in](https://voters.eci.gov.in) or send SMS \`ECIPS <EPIC-No>\` to **1950**. If your name is listed, you can vote with your Voter ID or any of the 12 approved photo IDs (Aadhaar, DL, Passport, PAN)!`,
          sources: ['Election Commission of India (voters.eci.gov.in)', 'Representation of the People Act 1950', 'Conduct of Elections Rules 1961'],
          suggestions: ['How to check if my name is on the electoral roll?', 'How to apply for a voter ID (Form 6)?', 'What documents can I carry to vote in India?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🗓️ Can You Register to Vote on Election Day in the UK? (No)\n\n* **No Polling Day Registration:** In the United Kingdom, **there is no on-the-day voter registration at polling stations**.\n* **Strict 12 Working Days Cutoff:** By law (*Representation of the People Regulations*), you must register on the Electoral Register at least **12 working days before polling day** (by 11:59 PM).\n* **Missed the Deadline?** If you missed the statutory deadline, you cannot cast a ballot in the current election. However, you can register now so that you are fully eligible for subsequent general, devolved, or local council elections.\n* **How to Register for Future Elections:** It takes only 5 minutes online at [gov.uk/register-to-vote](https://www.gov.uk/register-to-vote) using your National Insurance number.\n* **If You Are Already Registered:** Remember to bring an accepted form of original **Photo ID** (Passport, Driving Licence, Blue Badge, or free Voter Authority Certificate).`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Representation of the People Act 1983', 'GOV.UK Register to Vote'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I register to vote in the UK?', 'How do I find my UK polling station?']
        };
      } else {
        return {
          content: `### 🗓️ Can You Register on Election Day in the United States? (Yes, in 22+ States & D.C.!)\n\nIn the United States, whether you can register on Election Day depends on your state:\n\n#### 1. States with Same-Day Registration (SDR) / Election Day Registration (EDR):\n* In **22 states plus Washington, D.C.**, eligible citizens can register to vote **and cast their ballot on the same day** at their designated polling site or vote center:\n  * **States offering Election Day Registration:** California, Colorado, Connecticut, Hawaii, Idaho, Illinois, Iowa, Maine, Maryland, Michigan, Minnesota, Montana, Nevada, New Hampshire, New Mexico, Utah, Vermont, Virginia, Washington, Wisconsin, Wyoming, and Washington, D.C.\n  * *(Note: North Carolina offers same-day registration during Early Voting, but not on Election Day itself.)*\n\n#### 2. What You Must Bring for Same-Day Registration:\n1. **Proof of Identity:** Government-issued photo ID (State Driver's License, State Non-Driver ID, U.S. Passport, Military ID).\n2. **Proof of Residency:** A document showing your current legal residential address in that voting precinct (e.g., utility bill, bank statement, government check, paycheck, or formal lease agreement).\n\n#### 3. In Non-SDR States (Pre-Registration Deadlines):\n* In states without same-day registration, voter registration typically closes **15 to 30 days before Election Day** (or postmarked by the mail deadline). In those states, you cannot register on Election Day.\n\n> 🛡️ **Federal Protection:** If you believe you registered in time but your name does not appear on the poll list, federal law (*Help America Vote Act - HAVA § 302*) guarantees your right to cast a **Provisional Ballot**!`,
          sources: ['National Conference of State Legislatures (NCSL) Same-Day Registration', 'Vote.gov (Official U.S. Voting Information)', 'Help America Vote Act (HAVA)'],
          suggestions: ['How do I check if I am already registered?', 'What ID do I need to bring to the polls?', 'How does a provisional ballot work?']
        };
      }
    }

    // =========================================================================
    // INTENT 21: DYNAMIC OPEN-DOMAIN CIVIC SYNTHESIZER FOR ANY OTHER QUESTION
    // (Ensures NO question is ever rejected or given a generic brush-off!)
    // =========================================================================
    return this.synthesizeOpenDomainCivicResponse(query, jurKey);
  }

  /**
   * Open-Domain Civic Knowledge Synthesizer
   * Dynamically constructs complete, authoritative, non-partisan step-by-step guidance
   * for any user query regarding elections, voting laws, or procedures.
   */
  synthesizeOpenDomainCivicResponse(query, jurKey) {
    const jur = this.data.jurisdictions[jurKey];
    const cleanQuery = query.replace(/[?.,!]/g, '').trim();

    let suggestions = [];
    if (jurKey === 'india') {
      suggestions = [
        'What ID do I need to vote in India?',
        'How to check my name on the electoral roll?',
        'How does the EVM and VVPAT process work?',
        'How to apply for a voter ID card (Form 6)?'
      ];
    } else if (jurKey === 'uk') {
      suggestions = [
        'What photo ID is accepted at UK polling stations?',
        'How do I register to vote in the UK?',
        'What is a Voter Authority Certificate (VAC)?',
        'How does postal voting work in the UK?'
      ];
    } else {
      suggestions = [
        'What ID do I need to bring to the polls?',
        'How do I check if I am registered to vote?',
        'How does a provisional ballot work?',
        'How do mail-in ballots work?'
      ];
    }

    return {
      content: `### 🗳️ Civic & Election Guidance: ${this.capitalizeWords(cleanQuery)}\n\nRegarding your question **"${escapeHtml(query)}"** in **${jur.name}**:\n\n#### Procedural Analysis & Democratic Rules:\n* In modern constitutional democracies, voting procedures, qualification criteria, and electoral integrity are governed by codified statutory law to guarantee fair, accessible, and transparent franchise.\n* Whether your query pertains to voter eligibility, ballot access, documentation, administrative deadlines, or voting methods, official electoral bodies provide established guidelines to protect your vote.\n\n#### Standard Step-by-Step Guidance:\n1. **Verify Your Official Registration Record:** Always ensure your name is actively included in the Electoral Register at [${jur.portalName}](${jur.officialPortal}).\n2. **Observe Statutory Deadlines:** Electoral requirements (such as voter registration cutoffs, address corrections, and absentee requests) must typically be submitted before election writs or specific nomination dates.\n3. **Prepare Authorized Identification:** Always carry valid civil credentials (such as your government-issued ID card, passport, driver's license, or approved alternative documents).\n4. **Exercise Your Voter Protections:** If you encounter procedural questions on polling day, ask the presiding election officer or call the official civic helpline.\n\n#### Official Portals & Contact Channels:\n* **Official Electoral Portal:** [${jur.portalName}](${jur.officialPortal})\n* **Toll-Free Civic Helpline:** **${jur.hotline}**\n\n> 💡 **Legal Reminder:** If you are physically in line before the poll closing time on election day, you have the statutory legal right to cast your vote!`,
      sources: [jur.portalName, `${jur.name} Statutory Election Rules`, 'Official Electoral Guidelines'],
      suggestions: suggestions
    };
  }

  capitalizeWords(str) {
    return str.replace(/\b\w/g, l => l.toUpperCase());
  }

  hasAny(text, keywords) {
    return keywords.some(keyword => {
      const k = keyword.trim().toLowerCase();
      if (!k) return false;
      if (k.includes(' ')) {
        return text.includes(k);
      }
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
      return regex.test(text);
    });
  }

  generateFollowUpSuggestions(query) {
    const q = query.toLowerCase();
    const jurKey = this.currentJurisdiction;

    if (jurKey === 'india') {
      if (this.hasAny(q, ['create', 'apply', 'make', 'get voter id', 'new voter', 'form 6'])) {
        return ['How to check my name on the electoral roll?', 'What documents can I use as address proof?', 'How to download e-EPIC?'];
      }
      if (this.hasAny(q, ['document', 'accepted id', 'approved id', 'which id', 'what id'])) {
        return ['What documents can I use if I lost my voter ID?', 'How do I find my polling booth?', 'How does the EVM and VVPAT process work?'];
      }
      if (this.hasAny(q, ['nri', 'overseas', 'abroad'])) {
        return ['How to check if my name is on the electoral roll?', 'What are the rules for armed forces voters?', 'How to apply for a voter ID (Form 6)?'];
      }
      if (this.hasAny(q, ['roll', 'list', 'status', 'track'])) {
        return ['How do I track my Form 6 application status?', 'How to apply for a voter ID (Form 6)?', 'What is Form 8 used for?'];
      }
      return ['What ID do I need to vote in India?', 'How to check my name on the electoral roll?', 'How does the EVM and VVPAT process work?', 'How to apply for a voter ID card (Form 6)?'];
    } else if (jurKey === 'uk') {
      if (this.hasAny(q, ['create', 'apply', 'register', 'new voter'])) {
        return ['What photo ID is accepted in the UK?', 'What is a Voter Authority Certificate (VAC)?', 'How do I apply for a postal vote in the UK?'];
      }
      if (this.hasAny(q, ['id', 'photo id', 'document', 'vac'])) {
        return ['How to apply for a free Voter Authority Certificate (VAC)?', 'Can I vote by post without photo ID in the UK?', 'What time do UK polls close?'];
      }
      if (this.hasAny(q, ['postal', 'proxy', 'mail'])) {
        return ['How does postal voting work in the UK?', 'Can I vote by proxy in the UK?', 'What time do UK polls open and close?'];
      }
      return ['What photo ID is accepted at UK polling stations?', 'How do I register to vote in the UK?', 'What is a Voter Authority Certificate (VAC)?', 'How does postal voting work in the UK?'];
    } else {
      // US
      if (this.hasAny(q, ['create', 'apply', 'register', 'sign up'])) {
        return ['How do I check if I am registered to vote?', 'What ID do I need to bring to the polls?', 'How do I find my polling place?'];
      }
      if (this.hasAny(q, ['id', 'photo id', 'document'])) {
        return ['How does a provisional ballot work?', 'How do I find my polling place?', 'Can I register on Election Day?'];
      }
      if (this.hasAny(q, ['mail', 'absentee', 'early voting'])) {
        return ['How do mail-in ballots work?', 'How do I track my mail ballot?', 'Can I vote in person if I received a mail-in ballot?'];
      }
      return ['What ID do I need to bring to the polls?', 'How do I check if I am registered to vote?', 'How does a provisional ballot work?', 'How do mail-in ballots work?'];
    }
  }

  /**
   * Text-To-Speech (TTS) for accessibility
   */
  speakText(text, onStart, onEnd) {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported on this browser.');
      return;
    }

    if (this.isSpeaking) {
      this.stopSpeaking();
      if (onEnd) onEnd();
      return;
    }

    // Strip markdown formatting characters for clean speech
    const cleanText = text
      .replace(/#+/g, '')
      .replace(/[*_`>~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, '. ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ElectionAIEngine;
}

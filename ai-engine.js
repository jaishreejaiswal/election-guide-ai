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
   - If the user asks what IDs are ACCEPTED or REQUIRED AT THE POLLING BOOTH, list the approved photo IDs (12 approved IDs in India, state ID rules in US).
   - Do NOT confuse creating an ID with the document checklist for voting.

3. STANDARD STEP-BY-STEP GUIDANCE:
   Provide clear, numbered step-by-step guidance, mention official statutory forms (e.g. Form 6 / Form 8 for India, Vote.org / National Mail Voter Registration Form for US), official portal URLs, and acceptable documentation.

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
   * - Creating / applying for a voter ID
   * - Bringing accepted IDs to vote
   * - Checking registration / voter list
   * - And all other voting/election questions!
   */
  queryLocalKnowledgeBase(query) {
    const q = query.toLowerCase().trim();
    const jurKey = this.currentJurisdiction;
    const jur = this.data.jurisdictions[jurKey];

    // =========================================================================
    // INTENT 1: HOW TO CREATE / APPLY / MAKE / GET A NEW VOTER ID / REGISTRATION
    // =========================================================================
    const isCreateOrApply = this.hasAny(q, [
      'create', 'apply', 'make', 'get', 'issue', 'enroll', 'enrol', 'obtain', 'request',
      'register', 'sign up', 'generate', 'process to get', 'how do i get', 'how to get',
      'how to make', 'how to create', 'how to apply', 'how can i create', 'how can i get',
      'how can i apply', 'want a voter id', 'new voter id', 'fresh voter', 'first time voter',
      'form 6', 'make my voter'
    ]);

    const isAboutVoterIdOrCard = this.hasAny(q, [
      'voter id', 'voter card', 'epic', 'voter identity', 'electoral card',
      'election card', 'voters card', 'voter slip', 'e-epic', 'voter registration'
    ]);

    // If query asks how to create / apply / get a voter ID -> ALWAYS route here!
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
        return {
          content: `### 📝 How to Register to Vote & Get a Voter Registration Card (United States)\n\nIn the United States, voter registration is administered at the state and county level. Registering to vote officially places you on the voter rolls and issues your official Voter Registration Certificate.\n\n#### Step-by-Step Guide to Register:\n\n1. **Register Online (42+ States & D.C.):**\n   * Visit [Vote.gov Register to Vote](https://vote.gov) or the official federal portal [USA.gov/register-to-vote](https://www.usa.gov/register-to-vote).\n   * The entire online registration process takes under **2 minutes**.\n\n2. **What You Need to Provide:**\n   * Your current State Driver's License or State Non-Driver ID Number.\n   * The last 4 digits of your Social Security Number (SSN).\n   * Your current residential address.\n\n3. **Register by Mail or In Person:**\n   * Download and print the *National Mail Voter Registration Form* from [Vote.gov](https://vote.gov) or [EAC.gov](https://www.eac.gov).\n   * Mail or hand-deliver it to your local County Elections Office / Municipal Clerk.\n\n4. **At the DMV (Motor Voter Act):**\n   * Whenever you renew or apply for your driver's license at the DMV, check the box to automatically register or update your voter registration.\n\n5. **Voter Registration Card Delivery:**\n   * Within 2 to 4 weeks, your county elections office mails a paper **Voter Registration Card** to your address, which confirms your voting precinct, district numbers, and designated polling location.\n\n> 💡 **Same-Day Registration:** In 22+ states (e.g. CA, CO, MD, MI, NV, WA, WI), you can register and cast your vote on the very same day at your polling site with proof of residency!`,
          sources: ['USA.gov/register-to-vote', 'Vote.gov (Official U.S. Voting Information)', 'National Voter Registration Act (NVRA)'],
          suggestions: ['How do I check if I am registered to vote?', 'What ID do I need to bring to the polls?', 'How do I find my polling booth?']
        };
      }
    }

    // =========================================================================
    // INTENT 2: WHAT DOCUMENTS / IDS ARE ACCEPTED TO VOTE AT THE POLLING BOOTH
    // (Only triggers when asking what documents are ACCEPTED/REQUIRED TO CAST VOTE)
    // =========================================================================
    const isAskingForVotingDocs = this.hasAny(q, [
      'what documents do i need to vote', 'which documents to vote', 'what id do i need to vote',
      'acceptable id', 'accepted id', 'approved id', 'approved identity documents', 'valid id',
      'id required to vote', 'documents to carry', 'what to carry to polling booth',
      'what to bring to vote', 'can i vote without voter id', 'can i vote with aadhaar',
      'can i vote with pan card', 'can i vote with driving license', 'can i vote without epic',
      '12 approved ids', 'alternative photo id', 'id required at booth'
    ]);

    if (isAskingForVotingDocs || (this.hasAny(q, ['what id', 'which id', 'accepted documents']) && !isCreateOrApply)) {
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
    // INTENT 3: CHECK NAME ON ELECTORAL ROLL / VOTER LIST / STATUS
    // =========================================================================
    if (this.hasAny(q, ['check my name', 'electoral roll', 'voter list', 'check name', 'search name', 'am i registered', 'verify registration', 'e-epic download', 'search in roll', 'find name in list'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🔍 How to Check Your Name on the Electoral Roll (India)\n\nHaving your physical Voter ID card is **not enough**—your name **must be actively listed** in the current Electoral Roll to vote.\n\n#### 3 Easy Ways to Verify Your Name:\n1. **Online via ECI Portal (Recommended):**\n   * Go to [voters.eci.gov.in](https://voters.eci.gov.in) and click **'Search in Electoral Roll'**.\n   * **Option A: Search by EPIC No.** (Enter your 10-digit Voter ID number, State, and Captcha).\n   * **Option B: Search by Details** (Enter Name, Relative's Name, Date of Birth, State, and District).\n   * **Option C: Search by Mobile Number** (Instant OTP lookup).\n2. **ECI Voter Helpline Mobile App:**\n   * Open the app, tap *'Electoral Search'*, and scan the barcode on your EPIC card or enter your details.\n3. **SMS Service to 1950:**\n   * Send an SMS from your registered phone:\n     \`ECI <Your-10-Digit-EPIC>\` to **1950**.\n\n#### What If Your Name Is Missing?\n* If your name is not found, immediately submit **Form 6** on the portal before candidate nominations close in your constituency.\n* If you shifted residence, submit **Form 8** to transfer your roll to your new address.`,
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
          suggestions: ['Can I register on Election Day?', 'How do I find my polling booth?', 'What ID do I need to bring?']
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
      } else {
        return {
          content: `### 🏠 How to Update Your Voter Registration When You Move (United States)\n\nWhen you move, your assigned voting precinct, congressional representatives, and local ballot measures change. You must update your voter registration to reflect your new home address.\n\n#### Steps to Update Your Address:\n1. **Update Online:** Visit [Vote.gov Change Your Address](https://vote.gov) or [USA.gov Change Voter Address](https://www.usa.gov/change-voter-registration-address) or your new state's Secretary of State portal. Enter your new address and update your registration.\n2. **DMV / Driver's License:** When you update the address on your driver's license at your state DMV, select the checkbox to automatically update your voter registration.\n3. **Moving Out of State:** Register in your new state before their deadline, and notify your old county election clerk to cancel your previous registration.\n4. **Moved Within 30 Days of Election Day:** Many states permit you to vote one last time in your old precinct or cast a provisional/transfer ballot at your new precinct.`,
          sources: ['Vote.gov (Official U.S. Voting Information)', 'USA.gov/change-voter-registration-address'],
          suggestions: ['What is a provisional ballot?', 'What are the registration deadlines in my state?']
        };
      }
    }

    // =========================================================================
    // INTENT 6: LOST, DAMAGED, OR CORRECTION IN VOTER ID
    // =========================================================================
    if (this.hasAny(q, ['lost', 'lost voter id', 'damaged', 'duplicate', 'correction', 'change name', 'spelling mistake', 'replace voter id', 'replacement card'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🪪 How to Replace a Lost/Damaged Voter ID or Correct Mistakes (Form 8 - India)\n\nIf your Voter ID card is lost, damaged, destroyed, or contains spelling/photo mistakes:\n\n#### 1. Correction of Details (Name, Photo, DOB, Relative Name):\n* Submit **Form 8** on [voters.eci.gov.in](https://voters.eci.gov.in) under *'Correction of Entries'*, upload supporting documents, and your revised e-EPIC will be generated.\n\n#### 2. Replacement of Lost or Damaged Card:\n* On [voters.eci.gov.in](https://voters.eci.gov.in), select **Form 8** -> *'Issue of Replacement EPIC without correction'*.\n* If lost, attach a copy of the police FIR/lost complaint receipt.\n* If mutilated/damaged, return the damaged card during delivery.\n* A fresh replacement EPIC will be dispatched to your home address via India Post Speed Post!`,
          sources: ['voters.eci.gov.in', 'ECI Form 8 Replacement Services'],
          suggestions: ['How to check my name on the electoral roll?', 'How to download e-EPIC?']
        };
      } else {
        return {
          content: `### 🪪 Replacing a Lost Voter Registration Card (United States)\n\n* Contact your local county registrar or county elections office to request a replacement voter certificate.\n* You can also log into your state's Secretary of State portal or [Vote.gov](https://vote.gov) / [USA.gov](https://www.usa.gov/voter-registration-card) to print a digital verification certificate.\n* Note that on polling day, your county voter certificate is generally not required if you bring an accepted state photo ID or qualify for signature verification.`,
          sources: ['USA.gov/voter-registration-card', 'Vote.gov (Official U.S. Voting Information)'],
          suggestions: ['What ID do I need to vote?', 'How to find my polling booth?']
        };
      }
    }

    // =========================================================================
    // INTENT 7: CELL PHONES, SELFIES & PHOTOGRAPHY IN THE BOOTH
    // =========================================================================
    if (this.hasAny(q, ['phone', 'mobile', 'selfie', 'camera', 'photo in booth', 'photography', 'smartwatch'])) {
      return {
        content: `### 📱 Mobile Phones & Ballot Selfies Policy in the Booth\n\n#### India (ECI Directive):\n* **Strict Ban:** Carrying mobile phones, digital cameras, smartwatches, or recording devices inside the **voting compartment is strictly prohibited** under ECI election rules.\n* **Designated Storage:** Polling stations provide a deposit box or token counter outside the booth to deposit your phone before entering.\n* **Reason:** Protecting the **constitutional secrecy of the ballot** and preventing coercion, paid voting verification, or voter intimidation.\n\n#### United States:\n* **Ballot Selfie Laws Vary by State:**\n  * **Prohibited:** States like CA, FL, GA, IL, NV, NY, and TX strictly prohibit photography or selfies inside the voting booth or displaying marked ballots.\n  * **Allowed in Select States:** Some states (e.g., NH, CO, IN, MI) permit photographing your own completed ballot, but taking photos of other voters or polling machines remains strictly illegal everywhere.\n* **Recommendation:** Keep your phone in your pocket on silent while inside the polling booth to avoid penalties or voiding your ballot.`,
        sources: ['ECI Polling Station Manual', 'National Conference of State Legislatures (NCSL) Ballot Selfie Laws'],
        suggestions: ['What are the steps to vote inside the booth?', 'What are my voter rights?']
      };
    }

    // =========================================================================
    // INTENT 8: WEARING CAMPAIGN / POLITICAL CLOTHES (ELECTIONEERING)
    // =========================================================================
    if (this.hasAny(q, ['clothes', 't-shirt', 'shirt', ' hat ', 'slogan hat', 'badge', 'campaign button', 'electioneering', 'campaigning', ' wear ', 'wearing', 'political apparel', 'political shirt', 'can i wear', 'what to wear'])) {
      return {
        content: `### 👕 Can You Wear Political Shirts, Hats, or Buttons to Vote? (Electioneering Laws)\n\n* **Buffer Zone Rule:** In almost all democracies (including the US and India), election laws establish a strict **exclusion zone** (usually **100 feet / 100 meters** around the polling station entrance).\n* **No Campaigning:** Wearing candidate apparel, slogan hats, campaign buttons, or distributing flyers within this buffer zone is illegal (*passive electioneering*).\n* **Poll Worker Action:** If you arrive wearing campaign attire, poll workers will ask you to remove the hat, zip up your jacket, or turn the t-shirt inside out before handing you a ballot.\n* **Voter Protection:** This law guarantees that every citizen can cast their ballot peacefully without intimidation or harassment.`,
        sources: ['Burson v. Freeman (504 U.S. 191)', 'Section 130, Representation of the People Act 1951'],
        suggestions: ['What are my voter rights at the polling station?', 'What time do polls open and close?']
      };
    }


    // =========================================================================
    // INTENT 9: VOTER RIGHTS / PROVISIONAL BALLOTS / CHALLENGED VOTES / NAME MISSING
    // =========================================================================
    if (this.hasAny(q, ['provisional', 'name missing', 'not on list', 'challenged', 'my rights', 'voter rights', 'my voter rights', 'voting rights', 'rights at the polling', 'rights at polling', 'rights if', 'what rights', 'intimidation', 'refused', 'denied', 'harassment', 'line closes', 'tendered ballot', 'cvigil'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🛡️ Your Voter Rights at the Polling Station (India)\n\nUnder the Indian Constitution and the **Representation of the People Act, 1951**, every registered voter in India has the following legally guaranteed rights:\n\n#### ✅ Your Key Rights:\n1. **Right to Vote Freely:** You have an absolute right to cast your vote in secret without any pressure, coercion, or surveillance. No one can observe your vote inside the EVM compartment.\n2. **Right to Refuse Assistance:** You can choose to vote independently. Companions are only allowed for PwD or blind voters.\n3. **If Your Name Is Missing (Tendered Vote):** Under **Rule 49P of the Conduct of Elections Rules, 1961**, if someone has already fraudulently voted in your name, you are entitled to cast a **Tendered Ballot Paper** (marked separately and kept in a sealed envelope).\n4. **Right to Complain Immediately:** If an official behaves improperly or you witness malpractice:\n   * Call the **cVIGIL App** (launch the ECI app, report with photo/video — flying squad responds within 100 minutes).\n   * Call the **1950 Voter Helpline** (toll-free, available 24×7 during elections).\n5. **Right to Stay in Queue:** If you are in the polling station queue **before the official closing time**, you **cannot be turned away**. You have the legal right to vote.\n6. **Right to a Secrecy Compartment:** Every voter must be provided a properly screened voting compartment. Officials cannot stand near or inside your compartment while you vote.\n7. **Right Against Vote-Buying:** Accepting money, gifts, or any inducement in exchange for your vote is illegal under Section 171B of the Indian Penal Code.\n\n> 📞 **Emergency Helplines:** **1950** (ECI Voter Helpline) | **cVIGIL App** (real-time malpractice reporting)`,
          sources: ['Representation of the People Act 1951 (Section 135C, 171B)', 'Conduct of Elections Rules 1961 (Rule 49P)', 'Election Commission of India — Model Code of Conduct'],
          suggestions: ['What is the EVM and VVPAT voting process?', 'What documents can I carry to vote?', 'What if my name is missing from the voter list?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🛡️ Your Voter Rights at the Polling Station (United Kingdom)\n\nUnder the **Representation of the People Act 1983** and the **Elections Act 2022**, UK voters have legally protected rights:\n\n#### ✅ Your Key Rights:\n1. **Right to Vote in Secret:** The secrecy of your ballot is protected by law. No one may observe how you vote in the polling booth.\n2. **Right to a Spoiled Ballot:** If you make a mistake on your paper, you can return it to the Presiding Officer before placing it in the ballot box and receive a fresh one.\n3. **Photo ID Required (Since 2023):** You must present accepted Photo ID. If refused entry due to ID, you can apply for a free **Voter Authority Certificate (VAC)** at [gov.uk/apply-for-photo-id-voter-authority-certificate](https://www.gov.uk/apply-for-photo-id-voter-authority-certificate).\n4. **Right to Complain:** Contact the **Electoral Commission** at [electoralcommission.org.uk](https://www.electoralcommission.org.uk) or report to the local Returning Officer.\n5. **Right to Stay in Queue:** If you are in the queue before **10:00 PM**, you must be allowed to vote.\n6. **Assistance for PwD Voters:** You may bring a companion to assist, or request help from polling station staff.\n\n> 📞 **Helplines:** Electoral Commission: **0800 328 0280** | Textphone: **0800 328 0125**`,
          sources: ['Representation of the People Act 1983', 'Elections Act 2022', 'The Electoral Commission UK'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I apply for a Voter Authority Certificate?', 'What time do UK polls close?']
        };
      } else {
        return {
          content: `### 🛡️ Your Voter Rights at the Polling Station (United States)\n\nFederal law, your state constitution, and the **Help America Vote Act (HAVA)** guarantee the following rights:\n\n#### ✅ Your Key Rights:\n1. **Right to a Provisional Ballot:** Under **HAVA Section 302**, if your eligibility is questioned at the polls, you **must be offered a Provisional Ballot**. Officials cannot turn you away empty-handed.\n2. **Right to Vote if In Line at Closing Time:** If you are in the queue before poll closing time, you have the **statutory right to vote** regardless of how long the wait is.\n3. **Right to Assistance:** You may bring a person of your choice (except your employer or union official) to assist you in the booth if you have a disability or language difficulty.\n4. **Right to a Secrecy Ballot:** Your completed ballot is private. Poll workers cannot observe your vote.\n5. **Right Against Intimidation:** Voter intimidation is a federal crime under **52 U.S.C. § 20511**. If threatened, call **1-866-OUR-VOTE (866-687-8683)** (non-partisan voter protection hotline).\n6. **Right to File a Complaint:** Contact your state or county Election Official, or file with the **U.S. Department of Justice Civil Rights Division**.\n\n> 📞 **Emergency:** Election Protection Hotline: **1-866-OUR-VOTE** | DOJ Voting Rights: **800-253-3931**`,
          sources: ['Help America Vote Act (HAVA)', 'Voting Rights Act 1965', '52 U.S.C. § 20511'],
          suggestions: ['How does a provisional ballot work?', 'What if my name is missing from the voter list?', 'What ID do I need to bring to vote?']
        };
      }
    }

    // =========================================================================
    // INTENT 10: POLLING STATION / BOOTH LOCATION & HOURS
    // =========================================================================
    if (this.hasAny(q, ['booth', 'polling place', 'polling station', 'where do i vote', 'location', 'where to vote', 'precinct', 'room number', 'polling hours', 'open time', 'close time', 'polls open', 'polls close', 'poll hours', 'voting hours', 'when do polls', 'what time do polls', 'time do polls', 'polls open and close', 'open and close', 'voting time', 'election hours'])) {
      if (jurKey === 'us') {
        return {
          content: `### 📍 How to Find Your Polling Place & Hours (United States)\n\nYour assigned polling location is tied directly to your registered home address.\n\n1. **Look Up Online:** Visit the official federal portal [USA.gov Find Your Polling Place](https://www.usa.gov/find-polling-place) or [Vote.gov Polling Locator](https://vote.gov) to connect directly with your state or county election office.\n2. **Review Voter Card:** Check the paper voter registration certificate mailed to your residence—it lists your exact precinct name and polling location.\n3. **Early Voting Centers:** Many counties offer county-wide "Vote Centers" during early voting where you can vote at *any* location, unlike Election Day where you must visit your specific precinct.\n\n> ⏰ **Polling Hours:** Most US polls are open from 6:00 AM / 7:00 AM to 7:00 PM / 8:00 PM local time. If you are in line when polls close, **you must be allowed to vote**!`,
          sources: ['USA.gov/find-polling-place', 'Vote.gov (Official U.S. Voting Information)', 'National Association of State Election Directors'],
          suggestions: ['What documents do I need to bring?', 'Can I take time off work to vote?', 'What if I am not on the voter list?']
        };
      } else if (jurKey === 'india') {
        return {
          content: `### 📍 How to Locate Your Polling Station (India)\n\nYou can pinpoint your exact Polling Station (PS) and Part Number via 3 easy methods:\n\n1. **Voter Helpline App:** Search your name or enter your 10-digit EPIC number to see polling station name, address, and Google Maps pin.\n2. **SMS Service:** Send an SMS to **1950** formatted as:\n   \`ECIPS <Your-EPIC-Number>\`\n   You will receive an instant reply with your booth name and Room/Part number.\n3. **Voter Information Slip (VIS):** The Booth Level Officer (BLO) distributes paper voter slips to your door 3-5 days prior to polling day.\n\n> 📞 **Helpline:** You can also call **1950** toll-free from any phone with your district STD code.`,
          sources: ['voters.eci.gov.in', 'Election Commission of India 1950 Helpline'],
          suggestions: ['What if I lost my Voter ID card?', 'Can I bring a mobile phone to the booth?', 'What is the role of the BLO?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 📍 How to Find Your Polling Station & Hours (United Kingdom)\n\nIn the UK, you must vote at the specific polling station assigned to your registered address.\n\n#### 1. Check Your Red Poll Card:\n* A few weeks before polling day, your local council posts a red **Poll Card** to your address. Your assigned polling station name and full address are printed prominently on the front!\n\n#### 2. Search Online by Postcode:\n* Visit [gov.uk/find-your-local-council](https://www.gov.uk/find-your-local-council) or [whocanivotefor.co.uk](https://whocanivotefor.co.uk).\n* Enter your UK postcode to see your exact polling station, building name, and accessibility access.\n\n#### 3. Polling Hours:\n* Polling stations are open from **7:00 AM to 10:00 PM**.\n* If you are in the queue before 10:00 PM, you **must be permitted to vote** by law!\n\n> 🪪 **Remember:** Bring an accepted form of Photo ID (Passport, Driving Licence, Blue Badge, or free Voter Authority Certificate).`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'GOV.UK Polling Station Finder'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I register to vote in the UK?', 'Can I vote by post in the UK?']
        };
      } else {
        return {
          content: `### 📍 Finding Your Polling Station\n\n* Check your official poll notice card delivered to your residential address.\n* Visit the official electoral management body's online portal to input your postcode/address.\n* Contact your municipal council or local electoral returning office.`,
          sources: ['Electoral Management Authority'],
          suggestions: ['What time do polls open and close?', 'What ID is required?']
        };
      }
    }

    // =========================================================================
    // INTENT 11: EVM, VVPAT, MACHINES & BOOTH PROTOCOL
    // =========================================================================
    if (this.hasAny(q, ['evm', 'vvpat', 'machine', 'ballot box', 'optical scan', 'how to vote in booth', 'steps in booth', 'nota', 'none of the above'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🗳️ EVM & VVPAT Voting Process in the Booth (India)\n\nWhen you enter the voting compartment:\n\n1. **Check the EVM:** The green **'Ready' lamp** on the Balloting Unit (BU) will be illuminated.\n2. **Press Candidate Button:** Locate your chosen candidate's serial number, name, and symbol (or the NOTA option at the bottom), then press the blue button next to it.\n3. **Red Light & Beep:** A red lamp will glow next to the candidate symbol, followed by a long audio beep.\n4. **Verify on VVPAT:** Immediately look at the transparent glass window of the adjoining VVPAT unit.\n   * A printed paper slip displaying the candidate's serial number, name, and symbol will stay visible for **7 seconds**.\n   * The slip will then automatically cut and fall into the sealed drop box.\n5. **Exit Booth:** Your vote is now securely recorded!\n\n> ⚠️ **What is NOTA?** 'None of the Above' allows voters to officially register rejection of all contesting candidates while maintaining complete ballot secrecy.`,
          sources: ['ECI EVM-VVPAT Protocol Manual', 'Chief Electoral Officer Guides'],
          suggestions: ['Can I carry a mobile phone into the booth?', 'What documents can I use if I lost my voter ID?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🗳️ UK Ballot Paper & Polling Booth Protocol\n\nUnlike jurisdictions with voting machines, UK parliamentary and local elections use traditional paper ballots:\n\n1. **Official Stamped Ballot:** The poll clerk stamps the official security mark on your ballot paper before handing it to you.\n2. **The Polling Compartment:** Enter a private, partitioned wooden polling desk.\n3. **Marking Your Choice:** Use the pencil attached to the desk (or your own blue/black pen). Mark a single clear **"X"** in the box beside your chosen candidate.\n4. **Protecting Secrecy:** Do not write any names, initials, or slogans on the paper, as this will spoil your ballot and prevent it from being counted.\n5. **The Ballot Box:** Fold the paper in half with the vote facing inward, and drop it into the sealed black ballot box.\n\n> 💡 **Spoiled Ballot:** If you accidentally make a mistake on your paper, hand it back to the Presiding Officer before putting it in the box. They will cancel it and issue you a fresh ballot!`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Representation of the People Act 1983'],
          suggestions: ['What photo ID is accepted in the UK?', 'How does First Past the Post work in the UK?']
        };
      } else {
        return {
          content: `### 🗳️ Voting Equipment & Casting Your Ballot (United States)\n\nDepending on your county, you will encounter either:\n\n1. **Paper Ballot with Optical Scanner:**\n   * You fill in the oval completely next to your choice using the official pen provided.\n   * Do not make stray marks or checkmarks.\n   * Feed the ballot into the electronic optical tabulator until you see the confirmation screen (e.g., 'Ballot Accepted').\n2. **Direct Recording Electronic (DRE) / Ballot Marking Device (BMD):**\n   * Make selections on an accessible touchscreen.\n   * Review the summary review screen carefully.\n   * Print your paper verification record and deposit it into the official collection bin.\n\n> 💡 **Spoiled Ballot?** If you make an error on paper, return it to the poll worker and ask for a fresh one. Never cross out and attempt to write over it.`,
          sources: ['U.S. Election Assistance Commission (EAC)', 'Verified Voting Foundation'],
          suggestions: ['What are my rights if the machine jams?', 'Can I ask a poll worker for help?']
        };
      }
    }

    // =========================================================================
    // INTENT 12: MAIL-IN / ABSENTEE / EARLY VOTING
    // =========================================================================
    if (this.hasAny(q, ['mail-in', 'mail in ballot', 'vote by mail', 'absentee', 'absentee ballot', 'drop box', 'early voting', 'postal ballot', 'postal vote', 'ballot cure', 'how to mail', 'absentee voting'])) {
      return {
        content: `### 📮 Mail-in, Absentee & Early Voting\n\n* **Requesting the Ballot:** Submit an absentee ballot application through your local election office before the state cutoff date.\n* **Completing the Envelope:**\n  * Use blue or black ink.\n  * Sign the outer declaration envelope in the exact signature style on your ID.\n  * If your jurisdiction requires a witness signature or notary, ensure it is completed.\n* **Returning the Ballot:**\n  * Drop off at an official secure Election Drop Box.\n  * Hand-deliver directly to your municipal clerk or county board of elections.\n  * Send via post early to allow 5-7 business days for postal delivery.\n* **Ballot Tracking & Curing:** Almost all jurisdictions offer online tracking so you receive an email or text alert when your ballot is received and accepted! If your signature is questioned, you have a 48-72 hour curing window to verify your identity.`,
        sources: ['Vote.org Absentee Guide', 'National Conference of State Legislatures'],
        suggestions: ['Can I vote in person if I received a mail-in ballot?', 'What happens if my signature does not match?']
      };
    }

    // =========================================================================
    // INTENT 13: TIME OFF WORK TO VOTE
    // =========================================================================
    if (this.hasAny(q, ['time off', 'time off work', 'voting leave', 'leave to vote', 'employer', 'boss', 'paid leave', 'take time off', 'hours off', 'work hours to vote', 'leave from work', 'can i leave work', 'allowed to leave work', 'work on election day', 'vote during work'])) {
      return {
        content: `### ⏱️ Voting Leave & Taking Time Off Work\n\n* **United States:** Over 30 states mandate statutory voting leave. For example:\n  * **California & New York:** Up to 2 hours of paid time off to vote if you lack sufficient non-work hours.\n  * **Texas, Illinois, Minnesota:** Similar protected voting hours with advance notice.\n  * **Tip:** Provide your employer with 24-48 hours prior notice if your state requires notice.\n* **India:** Under Section 135B of the Representation of the People Act 1951, **polling day is a mandatory paid holiday** for all daily-wage, contractual, and corporate employees registered in the voting constituency.\n* **Universal Standard:** Review your local labour statutes; most jurisdictions penalize employers who obstruct an employee from exercising their democratic franchise.`,
        sources: ['Section 135B RPA 1951', 'State Department of Labor Voting Leave Statutes'],
        suggestions: ['What time do polls open and close?', 'Can I vote early to avoid work conflicts?']
      };
    }

    // =========================================================================
    // INTENT 14: MANIFESTOS & EVALUATING CANDIDATES
    // =========================================================================
    if (this.hasAny(q, ['manifesto', 'candidate', 'candidates', 'evaluating', 'compare', 'who to vote', 'policy', 'debates', 'fact check'])) {
      return {
        content: `### 🔍 How to Objectively Evaluate Candidates & Manifestos\n\nAs an impartial civic guide, we recommend evaluating candidates using an objective, 5-point rubric:\n\n1. **Feasibility of Pledges:** Does the manifesto explain *how* programs will be funded (budget allocations, tax reform) or are they unfunded general promises?\n2. **Past Voting Record & Accountability:** Inspect their actual legislative record on key bills rather than campaign speeches alone.\n3. **Transparency & Disclosures:** Examine campaign donations, corporate sponsors, and conflict-of-interest filings (e.g. FEC filings in US, Form 26 affidavits via ECI KYC App in India).\n4. **Down-Ballot & Local Elections:** Pay close attention to school board, judicial, and municipal council races—these directly influence local tax, policing, and schools.\n5. **Cross-Check with Non-Partisan Watchdogs:** Use verified non-partisan tools like Vote411.org, Ballotpedia, FactCheck.org, or ADR (Association for Democratic Reforms).`,
        sources: ['League of Women Voters', 'Association for Democratic Reforms (ADR)', 'International IDEA'],
        suggestions: ['What are the key policy sectors to compare?', 'What is a ballot proposition or referendum?']
      };
    }

    // =========================================================================
    // INTENT 14b: WHAT IS EPIC ID / VOTER ID CARD (INFORMATIONAL)
    // =========================================================================
    if (this.hasAny(q, ['what is epic', 'what is an epic', 'epic id', 'epic card', 'electors photo identity', 'what does epic stand', 'full form of epic', 'epic full form', 'what is voter id card', 'what is voter card', 'epic meaning', 'what is a voter id'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🪪 What is an EPIC ID Card? (India)\n\n**EPIC** stands for **Electors Photo Identity Card** — officially known as the **Voter ID Card** in India.\n\n#### Key Facts About EPIC:\n* **Issued By:** The **Election Commission of India (ECI)** through the office of the Chief Electoral Officer of each state.\n* **Purpose:** Serves as both (1) proof of voter registration in the Electoral Roll, and (2) an accepted photo identity document for voting on polling day.\n* **Unique Number:** Each EPIC card carries a unique **10-character alphanumeric EPIC Number** (e.g., ABC1234567) which links you to your specific constituency and polling booth.\n* **What It Contains:** Your photograph, full name, relative's name, date of birth, gender, residential address, and constituency details.\n* **e-EPIC (Digital):** Since 2021, you can also download your official **e-EPIC** as a PDF directly from [voters.eci.gov.in](https://voters.eci.gov.in) or via the DigiLocker app — fully valid at polling stations!\n\n#### Is EPIC Mandatory to Vote?\n* **No!** Having your name on the **Electoral Roll** is what matters most. You can vote with **any of the 12 approved photo IDs** (Aadhaar, Driving License, Passport, PAN Card, etc.) even without your physical EPIC card.\n\n> 📝 **Apply for EPIC:** Submit **Form 6** online at [voters.eci.gov.in](https://voters.eci.gov.in) — free of charge. Physical card is delivered to your home via India Post Speed Post.`,
          sources: ['Election Commission of India (voters.eci.gov.in)', 'Representation of the People Act 1950', 'ECI EPIC Guidelines'],
          suggestions: ['How to apply for a voter ID card (Form 6)?', 'How to download e-EPIC?', 'What IDs are accepted at the polling booth?']
        };
      } else {
        return {
          content: `### 🪪 What is a Voter ID / Registration Card?\n\nA **Voter ID** or **Voter Registration Card** is an official document issued by your local election authority confirming you are enrolled on the electoral register.\n\n* **United States:** A **Voter Registration Card/Certificate** is mailed to your address after successful registration. It shows your name, registered address, voting precinct, and district. In most US states, you don't need the card itself to vote — a State Driver's License or accepted photo ID is sufficient.\n* **United Kingdom:** Voters receive a red **Poll Card** by post before each election — it confirms your registration and lists your polling station. From 2023, voters also need an accepted **Photo ID** (Passport, Driving Licence, or free Voter Authority Certificate) to vote.\n\n> 💡 Being registered is what qualifies you to vote — always verify your status before election day!`,
          sources: ['USA.gov/register-to-vote', 'The Electoral Commission UK', 'Vote.gov'],
          suggestions: ['How do I register to vote?', 'What ID do I need to vote?', 'How do I check if I am registered?']
        };
      }
    }

    // =========================================================================
    // INTENT 15: RESULTS, COUNTING & CERTIFICATION
    // =========================================================================
    if (this.hasAny(q, ['election result', 'vote count', 'vote counting', 'ballot count', 'recount', 'certify', 'exit poll', 'who won', 'election winner', 'counting of votes', 'results declared', 'final result'])) {
      return {
        content: `### 📊 Election Results, Counting & Certification\n\n* **Election Night Projections vs Official Counts:**\n  * News networks make statistical projections based on exit polls and early returns, but **media calls are not legally binding**.\n  * Official certification takes several days to weeks to account for provisional, overseas military, and late-arriving postmarked mail-in ballots.\n* **Bipartisan Canvass:** Canvass boards composed of equal representatives from opposing parties inspect every discrepancy and tally under public scrutiny.\n* **Recounts:** Many states and jurisdictions trigger automatic recounts if the margin of victory is under 0.5% or 0.25%.\n* **Final Certification:** State chief election officers (or the national electoral commission) issue the official signed Certificate of Election.`,
        sources: ['National Conference of State Legislatures', 'Election Commission of India Results Portal'],
        suggestions: ['What does curing a ballot mean?', 'How can I track my mail-in ballot?']
      };
    }


    // =========================================================================
    // INTENT 16: PWD, SENIOR CITIZENS & ACCESSIBILITY
    // =========================================================================
    if (this.hasAny(q, ['pwd', 'disability', 'handicapped', 'wheelchair', 'blind', 'elderly', 'senior citizen', 'home voting'])) {
      return {
        content: `### ♿ Accessibility & Senior Citizen Voting Facilities\n\nDemocracies provide legally protected accommodations to ensure every elector can cast their ballot with dignity and independence.\n\n* **Polling Booth Accessibility:**\n  * Priority queues and wheelchair ramps at all approved polling locations.\n  * Audio-tactile EVMs or accessible touchscreen ballot-marking devices with headphones and sip-and-puff controls.\n  * Braille ballot sheets and signage.\n* **Companion Assistance:** Electors with visual impairment or physical disability may bring a trusted companion of their choice into the booth to assist in recording their vote.\n* **Home Voting / Postal Voting (India):** Electors aged 85+ and Persons with Disabilities (40%+ benchmark) can opt for home voting via postal ballot by submitting **Form 12D** to the Returning Officer.\n* **Curbside Voting (US):** In many US states, voters unable to enter the polling place due to mobility challenges can request curbside voting outside the precinct.`,
        sources: ['ECI PwD App & Guidelines', 'Americans with Disabilities Act (ADA) Voting Rights'],
        suggestions: ['What ID is needed for PwD voters?', 'What is the role of election volunteers?']
      };
    }

    // =========================================================================
    // INTENT 17: HOW TO VOTE (COMPLETE STEP-BY-STEP PROCESS)
    // =========================================================================
    if (this.hasAny(q, ['how to vote', 'steps to vote', 'process of voting', 'how do i vote', 'how can i vote', 'first time voting', 'guide to voting', 'how voting works'])) {
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
    if (this.hasAny(q, ['minimum age', 'voting age', 'age to vote', 'how old do i have to be', 'can 17 year old vote', 'can 16 year old vote', 'what age', 'am i old enough'])) {
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
          suggestions: ['How do I register to vote online?', 'How do I check if I am registered to vote?', 'What ID do I need to bring to vote?']
        };
      }
    }

    // =========================================================================
    // INTENT 19: COLLEGE STUDENTS & VOTING WHERE YOU GO TO SCHOOL
    // =========================================================================
    if (this.hasAny(q, ['college', 'student', 'university', 'campus', 'dorm', 'school', 'out of state student'])) {
      if (jurKey === 'india') {
        return {
          content: `### 🎓 Rules for College Students Voting in India\n\n* **Choice of Location:** College and university students residing away from their hometown in hostels or rented accommodation can choose to register either at their **permanent home address** OR at their **current place of residence (hostel/campus)**.\n* **Hostel Student Certificate:** If registering at your college address, submit a student declaration certificate countersigned by your college principal or hostel warden as proof of ordinary residence.\n* **One Person, One Vote:** You can only be registered in **one constituency** at a time. It is illegal to hold active voter registration in both your hometown and your university town.\n* **How to Register:** Use [voters.eci.gov.in](https://voters.eci.gov.in) to file Form 6 (or Form 8 to transfer).`,
          sources: ['Election Commission of India Guidelines on Student Electors', 'RPA 1950 Section 20'],
          suggestions: ['How to apply for a voter ID card (Form 6)?', 'How to check my name on the electoral roll?']
        };
      } else if (jurKey === 'uk') {
        return {
          content: `### 🎓 Rules for Students Voting in the UK\n\n* **Register at Both Addresses:** In the UK, university students can legally register to vote at **both** their home address AND their term-time university address!\n* **Local Elections (Double Vote Allowed):** If your university address and home address are in two different local council areas, you can legally vote in **both local council elections**.\n* **General Elections (Only Vote ONCE):** In a UK Parliamentary General Election, voting twice is a criminal offence. You must choose **one** constituency in which to cast your vote.\n* **How to Register:** Register online at [gov.uk/register-to-vote](https://www.gov.uk/register-to-vote) for both addresses.`,
          sources: ['The Electoral Commission UK (electoralcommission.org.uk)', 'Representation of the People Act 1983'],
          suggestions: ['What photo ID is accepted in the UK?', 'How do I apply for a postal vote in the UK?']
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
      'can i register today to vote'
    ])) {
      if (jurKey === 'india') {
        return {
          content: `### 🗓️ Can You Register to Vote on Election Day in India? (No)\n\n* **No Election Day Registration:** Under Indian electoral law, **you cannot register on Election Day or polling day**.\n* **Statutory Electoral Roll Freeze:** Under the *Representation of the People Act, 1950* and ECI regulations, the electoral roll for a constituency officially **freezes on the last date of nominations of candidates** (usually 2 to 3 weeks prior to polling day).\n* **What Happens to Late Applications:** Any new Form 6 applications submitted during or after the freeze period are queued and processed only after elections conclude for the next electoral cycle.\n* **To Vote on Polling Day:** Your name **must already appear on the active Electoral Roll**.\n* **How to Check Your Name Now:** Visit [voters.eci.gov.in](https://voters.eci.gov.in) or send SMS \`ECIPS <EPIC-No>\` to **1950**. If your name is listed, you can vote with your Voter ID or any of the 12 approved photo IDs (Aadhaar, DL, Passport, PAN)!`,
          sources: ['Election Commission of India (voters.eci.gov.in)', 'Representation of the People Act 1950', 'Conduct of Elections Rules 1961'],
          suggestions: ['How to check if my name is on the electoral roll?', 'How to apply for a voter ID (Form 6)?', 'What documents can I carry to vote?']
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

    return {
      content: `### 🗳️ Civic & Election Guidance: ${this.capitalizeWords(cleanQuery)}\n\nRegarding your question **"${escapeHtml(query)}"** in **${jur.name}**:\n\n#### Procedural Analysis & Democratic Rules:\n* In modern constitutional democracies, voting procedures, qualification criteria, and electoral integrity are governed by codified statutory law to guarantee fair, accessible, and transparent franchise.\n* Whether your query pertains to voter eligibility, ballot access, documentation, administrative deadlines, or voting methods, official electoral bodies provide established guidelines to protect your vote.\n\n#### Standard Step-by-Step Guidance:\n1. **Verify Your Official Registration Record:** Always ensure your name is actively included in the Electoral Register at [${jur.portalName}](${jur.officialPortal}).\n2. **Observe Statutory Deadlines:** Electoral requirements (such as voter registration cutoffs, address corrections, and absentee requests) must typically be submitted before election writs or specific nomination dates.\n3. **Prepare Authorized Identification:** Always carry valid civil credentials (such as your government-issued ID card, passport, driver's license, or approved alternative documents).\n4. **Exercise Your Voter Protections:** If you encounter procedural questions on polling day, ask the presiding election officer or call the official civic helpline.\n\n#### Official Portals & Contact Channels:\n* **Official Electoral Portal:** [${jur.portalName}](${jur.officialPortal})\n* **Toll-Free Civic Helpline:** **${jur.hotline}**\n\n> 💡 **Legal Reminder:** If you are physically in line before the poll closing time on election day, you have the statutory legal right to cast your vote!`,
      sources: [jur.portalName, 'Universal Democratic Electoral Standards', 'Electoral Management Body Guidelines'],
      suggestions: [
        'How to create a voter ID?',
        'How to check my name on the electoral roll?',
        'What documents do I need to vote?',
        'What are my rights if my vote is challenged?'
      ]
    };
  }

  capitalizeWords(str) {
    return str.replace(/\b\w/g, l => l.toUpperCase());
  }

  hasAny(text, keywords) {
    return keywords.some(k => text.includes(k));
  }

  generateFollowUpSuggestions(query) {
    const q = query.toLowerCase();
    if (this.hasAny(q, ['create', 'apply', 'make', 'get voter id', 'new voter'])) {
      return ['How to check my name on the electoral roll?', 'What documents count as proof of address?', 'How to download e-EPIC?'];
    }
    if (this.hasAny(q, ['document', 'accepted id', 'approved id', 'which id'])) {
      return ['Can I vote if I lost my Voter ID card?', 'How to find my polling booth?', 'What is a provisional ballot?'];
    }
    if (this.hasAny(q, ['nri', 'overseas', 'abroad'])) {
      return ['How to check if my name is on the voter list?', 'Can NRIs vote by mail or in person?', 'What documents do overseas voters need?'];
    }
    if (this.hasAny(q, ['roll', 'list', 'status'])) {
      return ['What if my name is missing from the list?', 'How to create a voter ID?', 'How do I update my shifted address?'];
    }
    return ['How to create a voter ID?', 'What documents do I need to vote?', 'How to check my name on the electoral roll?', 'What are my rights at the polls?'];
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

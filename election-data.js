/**
 * Election Guide AI - Comprehensive Knowledge Base & Stage Data
 * Multi-jurisdiction support (US, India, United Kingdom)
 */

const ELECTION_DATA = {
  jurisdictions: {
    us: {
      name: "United States (Federal & State General)",
      flag: "🇺🇸",
      votingAge: 18,
      officialPortal: "https://www.usa.gov/voting",
      portalName: "USA.gov/voting (Official U.S. Federal Portal)",
      hotline: "1-866-OUR-VOTE (866-687-8683)",
      stages: [
        {
          id: "registration",
          title: "Voter Registration",
          tagline: "Verify eligibility, register before state deadlines, and secure your ballot access.",
          badge: "Step 1: Foundation",
          icon: "id-card",
          color: "blue",
          milestones: [
            { label: "Online Registration Deadline", detail: "Typically 15 to 30 days before Election Day (varies by state)." },
            { label: "Mail-in Postmark Deadline", detail: "Must be postmarked up to 4 weeks prior to voting day." },
            { label: "Same-Day / Election Day Registration", detail: "Offered in 22+ states and Washington D.C. with proof of residency." }
          ],
          requirements: [
            "U.S. Citizen (by birth or naturalization).",
            "At least 18 years old on or before Election Day (16-17 can pre-register in many states).",
            "Resident of your state and precinct according to local statutory duration.",
            "Not disqualified due to felony conviction (rules vary widely by state)."
          ],
          checklist: [
            { id: "reg_status", text: "Check your current registration status on your Secretary of State website." },
            { id: "reg_address", text: "Update registration if you moved, changed your legal name, or altered party affiliation." },
            { id: "reg_mailin", text: "Request an Absentee or Mail-In Ballot if voting remotely or out-of-state (e.g. college students/military)." }
          ],
          faqs: [
            {
              q: "Can I register to vote if I have no fixed address or am unhoused?",
              a: "Yes! In all 50 states, unhoused individuals can register using a shelter address, cross-streets, or designated community center as their voting address."
            },
            {
              q: "What documents do I need to register online?",
              a: "Most states require a valid State Driver's License or State Non-Driver ID Number, plus the last 4 digits of your Social Security Number (SSN)."
            },
            {
              q: "Can college students vote where they go to school?",
              a: "Yes, college students can choose to register at either their campus address or their permanent home address, but may only vote in one place."
            }
          ]
        },
        {
          id: "candidates",
          title: "Candidates & Manifestos",
          tagline: "Scrutinize policy platforms, track voting records, and decipher campaign pledges objectively.",
          badge: "Step 2: Informed Decision",
          icon: "newspaper",
          color: "purple",
          milestones: [
            { label: "Candidate Debates", detail: "Televised debates between primary winners and independent nominees." },
            { label: "Sample Ballot Release", detail: "Published by county elections offices 3-4 weeks prior to voting." },
            { label: "Campaign Finance Disclosures", detail: "Review major donors on FEC.gov or OpenSecrets.org." }
          ],
          requirements: [
            "Review official party manifestos and candidates' published policy platforms.",
            "Inspect past legislative voting records rather than relying solely on campaign rhetoric.",
            "Identify down-ballot races (judges, school boards, city councils, ballot propositions).",
            "Verify claims using non-partisan fact-checkers (e.g., FactCheck.org, PolitiFact)."
          ],
          checklist: [
            { id: "cand_sample", text: "Download your official sample ballot from your local county election clerk." },
            { id: "cand_issues", text: "Rank your top 3 civic priorities (e.g. economy, healthcare, education, climate)." },
            { id: "cand_downballot", text: "Research local ballot measures and judicial candidates often overlooked at the top of the ticket." }
          ],
          faqs: [
            {
              q: "What is a ballot measure or proposition?",
              a: "A proposed law or constitutional amendment submitted directly to the citizens for approval or rejection, bypassing or supplementing the state legislature."
            },
            {
              q: "Where can I view an unbiased side-by-side candidate comparison?",
              a: "Non-partisan platforms like Vote411.org (League of Women Voters) and Ballotpedia provide candidate questionnaires in their own words."
            }
          ]
        },
        {
          id: "polling",
          title: "Polling Day Steps",
          tagline: "From entering the booth to depositing your ballot—your exact rights and procedure.",
          badge: "Step 3: Casting Your Vote",
          icon: "vote",
          color: "emerald",
          milestones: [
            { label: "Poll Opening Times", detail: "Usually 6:00 AM or 7:00 AM local time." },
            { label: "Peak Voting Hours", detail: "7:00 AM - 9:00 AM and 4:30 PM - 7:00 PM (plan ahead to avoid lines)." },
            { label: "Poll Closing Rule", detail: "If you are in line before poll closing time, you HAVE THE LEGAL RIGHT to vote!" }
          ],
          requirements: [
            "Locate your assigned precinct polling location (it may have shifted since the last cycle).",
            "Bring an accepted ID according to your state laws (photo ID, utility bill, or signature match).",
            "Wear no candidate clothing or political buttons (electioneering is prohibited within 100 feet).",
            "Understand your right to a Provisional Ballot if your name is not on the roster."
          ],
          checklist: [
            { id: "poll_location", text: "Confirm your precise polling station address and polling hours." },
            { id: "poll_id", text: "Pack acceptable photo ID or qualifying utility bill / voter card in your bag." },
            { id: "poll_notes", text: "Bring a handwritten cheat-sheet or sample ballot if allowed by your county rules." }
          ],
          faqs: [
            {
              q: "What if poll workers say I'm not on the registered voter list?",
              a: "Request a provisional ballot! Under federal law (HAVA - Help America Vote Act), you are legally entitled to cast a provisional ballot that will be counted once your eligibility is verified."
            },
            {
              q: "Can I bring my child or request language assistance into the booth?",
              a: "Yes. Federal law permits children to accompany voters, and voters needing disability or language assistance may bring an interpreter or assistant of their choice (other than an employer or union rep)."
            }
          ]
        },
        {
          id: "results",
          title: "Election Results & Certification",
          tagline: "Understanding canvassing, mail-in tallying, exit polls vs certified legal outcomes.",
          badge: "Step 4: Democracy in Action",
          icon: "chart-bar",
          color: "amber",
          milestones: [
            { label: "Election Night Unofficial Counts", detail: "In-person votes counted first; media projections are unofficial." },
            { label: "Canvass & Mail-In Processing", detail: "Days 1 to 14 post-election: processing overseas, military, and cure ballots." },
            { label: "Official State Certification", detail: "State board of elections certifies final signed totals within 2 to 4 weeks." }
          ],
          requirements: [
            "Understand difference between media 'calls/projections' and legal certified counts.",
            "Monitor ballot curing opportunities if your signature was questioned on a mail-in ballot.",
            "Review procedures for automatic recounts when margin is within statutory threshold (often 0.5%).",
            "Hold elected representatives accountable to their manifesto commitments."
          ],
          checklist: [
            { id: "res_track", text: "Track your mail-in ballot acceptance online using your county barcode tracker." },
            { id: "res_cure", text: "Respond within 48-72 hours if you receive a signature cure notification." },
            { id: "res_engage", text: "Save contact info for newly elected local, state, and congressional leaders." }
          ],
          faqs: [
            {
              q: "Why do election results take days or weeks to finalize?",
              a: "Mail-in ballots, provisional ballots, and military/overseas ballots take time to physically verify signatures and process securely under bipartisan observation."
            },
            {
              q: "What does 'curing' a ballot mean?",
              a: "If your signature on a mail-in ballot envelope is missing or does not match state records, election officials notify you to confirm your identity so your vote counts."
            }
          ]
        }
      ]
    },
    india: {
      name: "India (Lok Sabha & Vidhan Sabha)",
      flag: "🇮🇳",
      votingAge: 18,
      officialPortal: "https://voters.eci.gov.in",
      portalName: "ECI National Voter's Service Portal (voters.eci.gov.in)",
      hotline: "1950 (Voter Helpline Toll-Free)",
      stages: [
        {
          id: "registration",
          title: "Voter Registration (Form 6)",
          tagline: "Enrolment in the Electoral Roll and obtaining your EPIC (Voter ID Card).",
          badge: "Step 1: Enrolment",
          icon: "id-card",
          color: "blue",
          milestones: [
            { label: "Continuous Updation", detail: "Applications open throughout the year on the ECI portal / Voter Helpline App." },
            { label: "Qualifying Dates", detail: "January 1, April 1, July 1, and October 1 for citizens turning 18." },
            { label: "Nomination Last Date Cutoff", detail: "Applications must be accepted before candidate nominations close in your constituency." }
          ],
          requirements: [
            "Indian Citizen residing in the constituency.",
            "Attained 18 years of age on any of the 4 qualifying dates of the year.",
            "Form 6 for new voter registration, or Form 8 for shifting of residence / correction.",
            "Proof of Age (Birth Certificate, Aadhaar, PAN, Passport) and Proof of Residence (Electricity bill, Ration card, Passport)."
          ],
          checklist: [
            { id: "in_epic", text: "Verify your name in the Electoral Roll using your EPIC number at voters.eci.gov.in." },
            { id: "in_form8", text: "Submit Form 8 on the Voter Helpline app if you shifted residence to a new assembly." },
            { id: "in_download", text: "Download digital e-EPIC PDF to your smartphone via Digilocker or ECI portal." }
          ],
          faqs: [
            {
              q: "Can I vote if I have an EPIC card but my name is not in the Electoral Roll?",
              a: "NO! Inclusion of your name in the official Electoral Roll (voter list) is mandatory. The physical card alone does not grant voting right without your name in the roll."
            },
            {
              q: "Can Non-Resident Indians (NRIs) vote?",
              a: "Yes, Overseas Electors can register using Form 6A and vote in person at their designated constituency polling station with their original passport."
            }
          ]
        },
        {
          id: "candidates",
          title: "Knowing Candidates & Manifestos",
          tagline: "Scrutinize candidate criminal affidavits, asset declarations (Form 26), and party manifestos.",
          badge: "Step 2: Know Your Candidate",
          icon: "newspaper",
          color: "purple",
          milestones: [
            { label: "Scrutiny of Nominations", detail: "Returning Officer reviews papers and affidavits." },
            { label: "Publication of Form 7A", detail: "Final list of contesting candidates and assigned symbols." },
            { label: "Silent Period (48 Hours)", detail: "Campaigning halts 48 hours prior to conclusion of polling." }
          ],
          requirements: [
            "Review candidate criminal antecedents, assets, and liabilities via the KYC (Know Your Candidate) ECI App.",
            "Understand NOTA (None of the Above) option on the Electronic Voting Machine.",
            "Evaluate party manifestos regarding infrastructure, employment, education, and welfare schemes.",
            "Beware of paid news and unverified social media forwarding during the silent period."
          ],
          checklist: [
            { id: "in_kyc", text: "Download the ECI 'KYC' App to view affidavits of candidates in your constituency." },
            { id: "in_party", text: "Read published manifestos of leading parties and independent promises." },
            { id: "in_nota", text: "Understand the legal impact of NOTA if you feel no candidate is suitable." }
          ],
          faqs: [
            {
              q: "What is the KYC App?",
              a: "The Election Commission's official mobile application where every candidate's criminal records, educational qualification, and financial disclosures (Form 26 affidavit) are displayed publicly."
            },
            {
              q: "Does NOTA have the power to cancel an election?",
              a: "Currently in General/Assembly elections, NOTA acts as a formal record of dissent; even if NOTA gets high votes, the candidate with the highest votes among contesting candidates is declared winner (except in select state local body rules)."
            }
          ]
        },
        {
          id: "polling",
          title: "Polling Day Steps & EVM/VVPAT",
          tagline: "From queuing at the booth to verifying the 7-second slip on the VVPAT screen.",
          badge: "Step 3: Polling Day",
          icon: "vote",
          color: "emerald",
          milestones: [
            { label: "Mock Poll Conducted", detail: "5:30 AM in presence of candidate polling agents." },
            { label: "Polling Commences", detail: "7:00 AM to 5:00 PM / 6:00 PM across all booths." },
            { label: "Token Distribution at Closing", detail: "All electors inside the gate/queue at official closing time are handed tokens and allowed to vote." }
          ],
          requirements: [
            "Check your Polling Station and Part Number via SMS (ECIPS <EPIC> to 1950) or Voter Helpline app.",
            "Bring EPIC card OR any of 12 approved alternative photo IDs (Aadhaar, Driving License, PAN, Passport, MNREGA Job Card, Bank Passbook with photo, etc.).",
            "Mobile phones, cameras, and smartwatches are strictly forbidden inside the voting compartment.",
            "Follow the 3-Officer polling process: Identification -> Inking index finger -> Signing register -> Pressing EVM button."
          ],
          checklist: [
            { id: "in_locate", text: "Verify polling station location & room number using the Voter Helpline app." },
            { id: "in_id12", text: "Carry your EPIC or one of the 12 approved photo ID cards (Aadhaar, DL, Passport)." },
            { id: "in_vvpat", text: "Look at the transparent VVPAT glass for 7 seconds to verify your candidate's name & symbol." }
          ],
          faqs: [
            {
              q: "What if I don't have my physical Voter ID (EPIC) card on polling day?",
              a: "You CAN STILL VOTE as long as your name is on the electoral roll! Just carry any 1 of the 12 alternative photo identity documents approved by ECI (like Aadhaar card, PAN card, Driving License, or Passport)."
            },
            {
              q: "What is VVPAT and how does it work?",
              a: "Voter Verifiable Paper Audit Trail. When you press the blue button on the Balloting Unit, the VVPAT displays a printed paper slip showing the candidate's serial number, name, and symbol for exactly 7 seconds before dropping into a sealed drop box."
            }
          ]
        },
        {
          id: "results",
          title: "Counting & Results Declaration",
          tagline: "EVM seal verification, round-wise postal ballot & EVM counting, Form 20 declaration.",
          badge: "Step 4: Mandate",
          icon: "chart-bar",
          color: "amber",
          milestones: [
            { label: "Postal Ballots Counted First", detail: "8:00 AM on counting day at designated counting centers." },
            { label: "EVM Counting Commences", detail: "8:30 AM round-by-round across counting tables under CCTV." },
            { label: "Mandatory VVPAT Matching", detail: "Random matching of 5 polling stations per assembly segment." }
          ],
          requirements: [
            "Follow official live updates directly on results.eci.gov.in rather than speculative TV graphics.",
            "Understand that candidates or their authorized counting agents verify unique EVM control unit seals before counting begins.",
            "Returning Officer signs Certificate of Election (Form 22) once the final count is accepted."
          ],
          checklist: [
            { id: "in_results", text: "Bookmark results.eci.gov.in for official, verified round-by-round tally." },
            { id: "in_rep", text: "Note your newly elected Member of Parliament (MP) or Legislative Assembly (MLA)." }
          ],
          faqs: [
            {
              q: "How are EVMs secured between polling day and counting day?",
              a: "EVMs and VVPATs are sealed in Strong Rooms secured by 24/7 multi-tier armed security (central paramilitary), continuous CCTV streaming, and double-lock systems monitored by party agents."
            }
          ]
        }
      ]
    },
    uk: {
      name: "United Kingdom (General & Local Elections)",
      flag: "🇬🇧",
      votingAge: 18,
      officialPortal: "https://www.gov.uk/register-to-vote",
      portalName: "GOV.UK — Register to Vote",
      hotline: "Electoral Commission: 0800 328 6187",
      stages: [
        {
          id: "registration",
          title: "Voter Registration",
          tagline: "Register on the UK's electoral register before the deadline to secure your right to vote.",
          badge: "Step 1: Registration",
          icon: "id-card",
          color: "blue",
          milestones: [
            { label: "Online Registration Deadline", detail: "Typically 12 working days before polling day (check GOV.UK for each election)." },
            { label: "Postal Vote Application Deadline", detail: "Must apply at least 7 working days before polling day." },
            { label: "Proxy Vote Deadline", detail: "Must apply at least 7 working days before polling day (emergency proxy: day before)." }
          ],
          requirements: [
            "British, Irish, or qualifying Commonwealth citizen (or EU citizen for local elections in some areas).",
            "At least 18 years old on polling day (16–17 year olds can register but vote only in Scotland/Wales devolved elections).",
            "Resident at a UK address (or a British citizen living overseas — overseas electors can now vote for 15 years, recently extended to lifetime).",
            "Not legally excluded (certain convicted prisoners, mental health-related incapacity orders)."
          ],
          checklist: [
            { id: "uk_reg_check", text: "Check you are on the Electoral Register via your local council website." },
            { id: "uk_reg_online", text: "Register online at gov.uk/register-to-vote (takes ~5 minutes, need National Insurance number)." },
            { id: "uk_postal", text: "Apply for a Postal Vote if you cannot attend in person — ideal for shift workers or travelers." }
          ],
          faqs: [
            {
              q: "Do I need to re-register every year?",
              a: "Yes — the UK uses an annual canvass system. Your local council sends a Household Enquiry Form each autumn. If anything changes (new address, name), update your registration immediately at gov.uk/register-to-vote."
            },
            {
              q: "Can EU citizens vote in UK elections?",
              a: "EU citizens resident in the UK can vote in local council elections and may vote in devolved elections (Scotland, Wales, Northern Ireland), but cannot vote in UK Parliamentary (Westminster) General Elections — only British, Irish, and qualifying Commonwealth citizens can."
            }
          ]
        },
        {
          id: "candidates",
          title: "Candidates & Manifestos",
          tagline: "Research party manifestos, local candidates, and how First Past the Post works.",
          badge: "Step 2: Make an Informed Choice",
          icon: "newspaper",
          color: "purple",
          milestones: [
            { label: "Dissolution of Parliament", detail: "PM advises Monarch to dissolve Parliament — triggers election campaign period (25 working days minimum)." },
            { label: "Candidate Nominations Close", detail: "Deadline for candidates to file nomination papers with returning officer." },
            { label: "Polling Day", detail: "Usually a Thursday — 7:00 AM to 10:00 PM." }
          ],
          requirements: [
            "Understand the First Past the Post (FPTP) voting system — the candidate with the most votes in your constituency wins.",
            "Find your constituency and MP candidates via the Electoral Commission website or WhoCan IVote For.",
            "Read each party's manifesto — focus on NHS, housing, taxation, defence, and climate policies.",
            "Watch leaders' debates on BBC, ITV, and Channel 4 during the campaign period."
          ],
          checklist: [
            { id: "uk_cand_find", text: "Find your constituency at whocanivotefor.co.uk or the Electoral Commission site." },
            { id: "uk_manifesto", text: "Read key party manifestos — BBC, Full Fact, and Which? publish accessible summaries." },
            { id: "uk_tactical", text: "Check tactical voting guides if relevant to your constituency dynamics." }
          ],
          faqs: [
            {
              q: "How does First Past the Post work?",
              a: "The UK is divided into 650 constituencies. Each constituency elects one MP. You vote for one candidate. The candidate with the most votes wins — even if they get less than 50% of the vote. The party that wins the most seats typically forms the government."
            },
            {
              q: "What is a by-election?",
              a: "A by-election is held in a single constituency when the sitting MP resigns, dies, or is disqualified mid-term. The rest of Parliament is unaffected."
            }
          ]
        },
        {
          id: "polling",
          title: "Polling Day Steps",
          tagline: "What to bring, where to go, and how to cast your vote at the UK polling station.",
          badge: "Step 3: Cast Your Vote",
          icon: "vote",
          color: "emerald",
          milestones: [
            { label: "Polling Stations Open", detail: "7:00 AM — arrive early to avoid queues." },
            { label: "Polling Stations Close", detail: "10:00 PM sharp — be in the queue before 10:00 PM to be entitled to vote." }
          ],
          requirements: [
            "Bring valid Photo ID — now mandatory for UK Parliamentary elections since 2023 (Elections Act 2022).",
            "Accepted IDs: UK Passport, UK Driving Licence, Blue Badge, Older/Disabled Person's Bus Pass, PASS card, Armed Forces ID, or a free Voter Authority Certificate (VAC).",
            "Your polling card (the red card sent by the council) — not mandatory but speeds up check-in.",
            "Know your polling station — shown on your polling card or find it at gov.uk/find-your-local-council."
          ],
          checklist: [
            { id: "uk_id", text: "Bring accepted photo ID — check full list at electoralcommission.org.uk." },
            { id: "uk_card", text: "Bring your polling card (the red council card) — optional but helpful." },
            { id: "uk_station", text: "Confirm your polling station address (it may have changed since last time)." },
            { id: "uk_hours", text: "Plan to arrive before 10:00 PM — you must be in the queue before closing time." }
          ],
          faqs: [
            {
              q: "What if I don't have any accepted photo ID?",
              a: "Apply for a free Voter Authority Certificate (VAC) at gov.uk/apply-for-photo-id-voter-authority-certificate before the deadline (usually 6 working days before polling day). It's free and quick."
            },
            {
              q: "How do I mark my ballot paper correctly?",
              a: "In a General Election, put a single X in the box next to your chosen candidate. Do NOT tick, circle, or write anything else — it may spoil your ballot. For local elections with proportional systems, you may rank candidates (1, 2, 3…) — check your ballot instructions."
            }
          ]
        },
        {
          id: "results",
          title: "Election Results & Count",
          tagline: "How votes are counted overnight and how a new government is formed.",
          badge: "Step 4: The Outcome",
          icon: "chart-bar",
          color: "amber",
          milestones: [
            { label: "Count Begins", detail: "Counting starts shortly after 10:00 PM at local count centres — often runs through the night." },
            { label: "First Results Declared", detail: "Fastest constituencies (e.g. Sunderland) declare within an hour of polls closing." },
            { label: "Majority Reached / Hung Parliament", detail: "326 seats needed for an outright majority; otherwise a hung parliament and coalition talks follow." }
          ],
          requirements: [
            "Results declared publicly by the local Returning Officer in each constituency.",
            "National broadcasters (BBC, ITV, Sky) run overnight live results programmes.",
            "The leader of the party able to command a majority is invited to form a government by the Monarch.",
            "Postal and overseas votes are counted alongside in-person votes."
          ],
          checklist: [
            { id: "uk_res_watch", text: "Follow live count coverage on BBC / ITV — results come in by constituency from ~11 PM." },
            { id: "uk_res_local", text: "Check your constituency result on the Electoral Commission results website." }
          ],
          faqs: [
            {
              q: "What happens if no party wins a majority (hung parliament)?",
              a: "The sitting PM has the first right to try to form a government — either alone (minority government) or via a formal coalition or confidence-and-supply agreement with another party. If they cannot, they resign and the Leader of the Opposition is invited to try."
            },
            {
              q: "Can election results be challenged?",
              a: "Yes — via an Election Petition to the Election Court (a division of the High Court). Grounds include bribery, corruption, illegal practices, or a winning candidate being ineligible. This must be filed within 21 days of the result being declared."
            }
          ]
        }
      ]
    }
  },

  // Common quick prompt suggestions for the AI Assistant
  quickPrompts: [
    { text: "What ID do I need to vote?", icon: "id-card" },
    { text: "How do I find my polling booth?", icon: "map-pin" },
    { text: "Can I register on Election Day?", icon: "calendar" },
    { text: "What are my rights if my name is missing?", icon: "shield" },
    { text: "How do mail-in ballots work?", icon: "mail" },
    { text: "What should I look for in a candidate manifesto?", icon: "book-open" },
    { text: "Can I take time off work to vote?", icon: "clock" },
    { text: "What is a provisional ballot?", icon: "file-text" }
  ],

  // Common FAQs for quick search / accordion
  universalFaqs: [
    {
      category: "ID & Documentation",
      q: "What if I don't have a state-issued photo driver's license?",
      a: "In the US, many states accept university IDs, passports, military IDs, concealed carry permits, or utility bills/bank statements with your name and address. In India, ECI approves 12 alternative documents including Aadhaar, PAN card, Driving License, MNREGA card, and Passport."
    },
    {
      category: "Polling Day Rights",
      q: "What happens if the polls close while I am still standing in line?",
      a: "DO NOT LEAVE! Under law in the US and India, if you are physically in line before the official closing time (e.g. 7 PM or 8 PM), election officials MUST allow every single person in line to cast their vote."
    },
    {
      category: "Accessibility & Assistance",
      q: "What accommodations exist for voters with disabilities or visual impairment?",
      a: "Polling stations must feature wheelchair ramps, audio-tactile electronic voting machines, Braille ballot guides, and allow a trusted companion or non-partisan poll worker to assist inside the voting booth."
    },
    {
      category: "Voter Intimidation",
      q: "What should I do if someone challenges, harasses, or intimidates me at the polls?",
      a: "Voter intimidation is a severe crime. Immediately notify the Presiding Officer or Chief Election Judge. In the US, call the Election Protection Hotline at 1-866-OUR-VOTE (866-687-8683). In India, dial the 1950 toll-free election helpline or lodge a complaint on the cVIGIL app."
    },
    {
      category: "Mail-in & Absentee Ballots",
      q: "Can I change my mind and vote in person if I received a mail-in ballot?",
      a: "In most jurisdictions, yes! Bring your unvoted mail-in ballot and envelope to your polling station so poll workers can void/spoil it, allowing you to cast a regular ballot in person."
    }
  ],

  // Manifesto evaluation criteria
  manifestoCriteria: [
    {
      domain: "Healthcare & Well-being",
      keyQuestions: [
        "Does the candidate propose expanding affordable access or insurance coverage?",
        "What specific plans address prescription drug costs, mental health, and emergency infrastructure?"
      ]
    },
    {
      domain: "Economy, Jobs & Cost of Living",
      keyQuestions: [
        "How will their tax proposals affect working families versus large corporations?",
        "What concrete measures exist for inflation control, wage growth, and vocational job creation?"
      ]
    },
    {
      domain: "Education & Youth Opportunities",
      keyQuestions: [
        "What is the funding strategy for public schools, teacher salaries, and student debt relief?",
        "Are there clear policies for STEM education, apprenticeships, and university affordability?"
      ]
    },
    {
      domain: "Climate, Infrastructure & Energy",
      keyQuestions: [
        "Does the manifesto outline actionable targets for clean energy transition and grid resilience?",
        "What investments are earmarked for roads, bridges, public transit, and clean drinking water?"
      ]
    },
    {
      domain: "Civic Rights, Justice & Electoral Integrity",
      keyQuestions: [
        "Will the candidate protect voting rights, judicial independence, and prevent gerrymandering?",
        "What is their policy on criminal justice reform, police accountability, and civil liberties?"
      ]
    }
  ]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ELECTION_DATA;
}

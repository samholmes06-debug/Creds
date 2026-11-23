/* ============================================================================
   Product A launch story: CONTENT
   Everything the page says or shows is in this file. The design and behaviour
   live in index.html and don't need touching.

   Edit by hand, or open editor.html and use the forms (then "Save content.js").

   Files can be referenced by path (as here: "assets/pdfs/PA-CORE-00.pdf") or
   embedded as data: URIs (what the editor produces for the single-file export).
   In text fields, **double asterisks** make bold text.
   ============================================================================ */
window.HUB = {
  schema: 1,

  /* ---- Branding -------------------------------------------------------- */
  brand: {
    productName: "Product A",
    pageTitle: "Product A Launch Story",       // browser tab title
    logo: "assets/logo/placeholder-logo.svg",  // "" shows a dot and the product name instead
    accent: "#f36633",                         // the one brand colour; shades are derived from it
    jobCode: "XX-UK-0000",
    datePrepared: "October 2026",
    mockLabel: "Concept mock-up – not for distribution",  // "" removes the label (for approved versions)
    fonts: {}                                  // optional: { regular, bold, light, italic } font files
  },

  /* ---- Opening screen -------------------------------------------------- */
  hero: {
    eyebrow: "Advance notification · October 2026",
    titleLines: ["Advance", "notification for", "NHS planning"],   // the last line is shown in the accent colour
    lede: "A new treatment option for Condition X is expected in Q2 2027. Read the launch story below, and build the briefing pack your stakeholder needs as you go.",
    note: "For NHS budget holders and formulary decision-makers. Product A does not yet have a UK marketing authorisation."
  },

  /* ---- The core deliverable ---------------------------------------------
     pdf / images: the approved PDF, and one picture per page for the in-page viewer. */
  core: {
    name: "Core launch notification",
    short: "Core launch notification",
    code: "PA-CORE-00",
    pages: 4,                                  // used until a PDF is added; then counted automatically
    blurb: "The core deliverable. Included in every pack.",
    pdf: "assets/pdfs/PA-CORE-00.pdf",
    images: ["assets/pages/PA-CORE-00-1.jpg", "assets/pages/PA-CORE-00-2.jpg", "assets/pages/PA-CORE-00-3.jpg", "assets/pages/PA-CORE-00-4.jpg"],
    draftIntro: "Information to support NHS budget and service planning for a new treatment option in Condition X, expected in Q2 2027.",
    draftNote: "For NHS budget holders and formulary decision-makers. Product A does not yet have a UK marketing authorisation."
  },

  /* ---- Who is being engaged, and why ----------------------------------- */
  builder: {
    title: "Who's this briefing for?",
    intro: "Choose a stakeholder and the type of engagement. We'll recommend modules, put the most relevant chapters first, and you can add more as you read.",
    whoLabel: "I'm engaging",
    engLabel: "For",
    whoPick: "Engaging",
    engPick: "Engagement",
    whoPlaceholder: "Choose stakeholder",
    engPlaceholder: "Choose type"
  },
  stakeholders: [
    { id: "commissioner", label: "ICB commissioner",        plural: "ICB commissioners",             desc: "Budgets and service planning" },
    { id: "pharmacist",   label: "Formulary pharmacist",    plural: "formulary pharmacists",         desc: "Formulary review and policy" },
    { id: "finance",      label: "Finance and procurement", plural: "finance and procurement leads", desc: "Cost, tariff and contracts" },
    { id: "clinical",     label: "Clinical lead",           plural: "clinical leads",                desc: "Pathway and patient care" },
    { id: "trust",        label: "Trust pharmacy",          plural: "trust pharmacy teams",          desc: "Supply, storage and homecare" }
  ],
  engagements: [
    { id: "proactive",      label: "Proactive introduction",  desc: "First contact ahead of launch",     subject: "Advance notification: Product A",                       intro: "I'm writing to share advance information about Product A, a new treatment option for Condition X expected to launch in Q2 2027, to support your planning." },
    { id: "formulary",      label: "Formulary preparation",   desc: "A decision meeting is coming up",   subject: "Product A: information for your formulary review",      intro: "Ahead of your formulary discussions, I've put together the information most relevant to reviewing Product A." },
    { id: "reactive",       label: "Reactive enquiry",        desc: "They've asked a specific question", subject: "Product A: answers to your question",                   intro: "Thank you for your question about Product A. The answers you need are set out below." },
    { id: "implementation", label: "Implementation planning", desc: "Getting ready for launch",          subject: "Product A: preparing for launch",                       intro: "As you prepare for the launch of Product A, these resources set out the practical steps and supply arrangements." }
  ],

  /* ---- Modules: each is one approved PDF -------------------------------
     The summary fields (intro, facts, pointsTitle, points) only feed the draft pages shown
     until the approved PDF is added. */
  modules: [
    { id: "value", name: "Mini value proposition", short: "Value proposition", question: "Why does Product A matter?", code: "PA-MOD-01", pages: 2,
      pdf: "assets/pdfs/PA-MOD-01.pdf", images: ["assets/pages/PA-MOD-01-1.jpg", "assets/pages/PA-MOD-01-2.jpg"],
      intro: "Around 40% of people with Condition X do not reach adequate disease control on current first-line options, and many need frequent hospital visits.",
      facts: [["Pivotal study", "TRIAL-1, Phase III, n=612"], ["Primary endpoint", "Response at week 24"], ["Dosing", "Once monthly, self-administered"]],
      pointsTitle: "Possible resource considerations",
      points: ["Monthly self-administration may reduce infusion-unit appointments compared with Product B.", "No routine therapeutic drug monitoring is expected.", "A budget impact model will be available on request after the MHRA decision."] },
    { id: "pathway", name: "Patient population and pathway", short: "Population & pathway", question: "Who is it for and where does it fit?", code: "PA-MOD-02", pages: 3,
      pdf: "assets/pdfs/PA-MOD-02.pdf", images: ["assets/pages/PA-MOD-02-1.jpg", "assets/pages/PA-MOD-02-2.jpg", "assets/pages/PA-MOD-02-3.jpg"],
      intro: "The expected position of Product A in the current care pathway, and the estimated eligible population.",
      facts: [["England", "8,400 prevalent · 1,100 new a year"], ["Average ICB (1.5m)", "225 prevalent · 30 new a year"], ["Per 100,000", "15 prevalent · 2 new a year"]],
      pointsTitle: "Pathway steps",
      points: ["Step 1 · Referral: primary care", "Step 2 · Diagnosis: specialist clinic", "Step 3 · First line: standard care", "Step 4 · **Product A: proposed second line**", "Step 5 · Follow-up: homecare and review"] },
    { id: "formulary", name: "Formulary and prescribing", short: "Formulary & prescribing", question: "What do formulary committees need to consider?", code: "PA-MOD-03", pages: 2,
      pdf: "assets/pdfs/PA-MOD-03.pdf", images: ["assets/pages/PA-MOD-03-1.jpg", "assets/pages/PA-MOD-03-2.jpg"],
      intro: "",
      facts: [["Anticipated indication", "Adults, moderate to severe Condition X"], ["Prescribing setting", "Specialist initiation, secondary care"], ["Expected NICE route", "Single technology appraisal"]],
      pointsTitle: "Points for formulary committees",
      points: ["A formulary submission pack will be available once the MHRA decision is confirmed.", "NICE technology appraisals carry a 90-day funding requirement after publication.", "Prior approval (for example through Blueteq) may be needed, depending on local policy.", "Additional monitoring in the risk management plan will be confirmed at licensing."] },
    { id: "tariffs", name: "Drug tariffs and pharmacy", short: "Tariffs & pharmacy", question: "What does it cost and how is it supplied?", code: "PA-MOD-04", pages: 2,
      pdf: "assets/pdfs/PA-MOD-04.pdf", images: ["assets/pages/PA-MOD-04-1.jpg", "assets/pages/PA-MOD-04-2.jpg"],
      intro: "",
      facts: [["Indicative list price", "£X,XXX per pack"], ["Tariff status", "Expected high-cost drug"], ["Supply route", "Homecare and wholesaler"], ["Storage", "Refrigerated, 2–8°C"]],
      pointsTitle: "Pharmacy implications",
      points: ["dm+d codes will be available at launch.", "A homecare provider will be appointed through a national framework before launch.", "Product B supply continues during transition, so stock of both may need managing for up to 12 months."] },
    { id: "checklist", name: "Implementation checklist", short: "Implementation checklist", question: "How do we get ready for launch?", code: "PA-MOD-05", pages: 1,
      pdf: "assets/pdfs/PA-MOD-05.pdf", images: ["assets/pages/PA-MOD-05-1.jpg"],
      intro: "Seven practical steps to be ready for launch, with suggested owners.",
      facts: [],
      pointsTitle: "",
      points: ["Add Product A to the formulary review agenda (formulary pharmacist)", "Model local eligible population and budget impact (ICB commissioner)", "Confirm prior-approval process for high-cost drugs (finance lead)", "Agree homecare provider and set-up timeline (trust pharmacy)", "Plan clinical review of current Product B patients (clinical lead)", "Check cold-chain storage capacity (trust pharmacy)", "Brief prescribers once guidance is published (clinical lead)"] },
    { id: "faqs", name: "FAQs", short: "FAQs", question: "What do people commonly ask?", code: "PA-MOD-06", pages: 3,
      pdf: "assets/pdfs/PA-MOD-06.pdf", images: ["assets/pages/PA-MOD-06-1.jpg", "assets/pages/PA-MOD-06-2.jpg", "assets/pages/PA-MOD-06-3.jpg"],
      intro: "Answers to the questions stakeholders ask most.",
      facts: [],
      pointsTitle: "",
      points: ["**When will Product A be available?** Launch is planned for Q2 2027, subject to MHRA authorisation and the NICE appraisal timetable.", "**Will existing Product B patients have to switch?** No patient needs to switch before a clinical review. Product B will remain available for at least 12 months after launch.", "**How will Product A be funded?** It is expected to be a high-cost drug outside the payment system. If NICE recommends it, commissioners must fund it within 90 days.", "**Is there a budget impact model?** Yes, on request after the MHRA decision.", "**Who can initiate treatment?** Specialists in secondary care.", "**How will Product A be supplied?** Through homecare and wholesaler routes.", "**What are the storage requirements?** Refrigerated at 2–8°C.", "**Will a formulary submission pack be available?** Yes, once the MHRA decision is confirmed."] }
  ],

  /* ---- Which modules each choice recommends (in this order) --------------
     recommend[stakeholder id][engagement id] = [module ids] */
  recommend: {
    commissioner: { proactive: ["value"],     formulary: ["pathway", "value"],     reactive: ["faqs"], implementation: ["checklist", "pathway"] },
    pharmacist:   { proactive: ["pathway"],   formulary: ["formulary", "faqs"],    reactive: ["faqs"], implementation: ["checklist", "tariffs"] },
    finance:      { proactive: ["value"],     formulary: ["tariffs", "value"],     reactive: ["faqs"], implementation: ["tariffs", "checklist"] },
    clinical:     { proactive: ["pathway"],   formulary: ["pathway", "formulary"], reactive: ["faqs"], implementation: ["checklist"] },
    trust:        { proactive: ["tariffs"],   formulary: ["formulary", "tariffs"], reactive: ["faqs"], implementation: ["checklist", "tariffs"] }
  },

  /* ---- Key figures (the pinned scene) ----------------------------------- */
  stats: {
    label: "Product A in numbers",
    items: [
      { value: "8,400", suffix: "",   suffixStyle: "small",  countUp: true,  heading: "Estimated eligible patients in England", text: "Adults with moderate to severe Condition X not controlled after first-line therapy. Around 225 in an average ICB.", module: "pathway" },
      { value: "2",     suffix: "nd", suffixStyle: "small",  countUp: false, heading: "Line of therapy", text: "Expected after standard first-line care, started by specialists in secondary care.", module: "formulary" },
      { value: "1",     suffix: "×",  suffixStyle: "accent", countUp: false, heading: "Monthly subcutaneous dose", text: "Self-administered at home, which may reduce infusion-unit appointments compared with Product B.", module: "value" },
      { value: "2–8",   suffix: "°C", suffixStyle: "small",  countUp: false, heading: "Refrigerated storage", text: "Supplied through homecare and wholesaler routes, with dm+d codes available at launch.", module: "tariffs" },
      { value: "90",    suffix: "",   suffixStyle: "small",  countUp: true,  heading: "Days to fund after a positive NICE recommendation", text: "The standard funding requirement for NICE technology appraisals.", module: "faqs" },
      { value: "12",    suffix: "mo", suffixStyle: "small",  countUp: true,  heading: "Planned transition from Product B", text: "Product B stays available while patients are reviewed and moved in a planned way.", module: "checklist" }
    ]
  },

  /* ---- The story, chapter by chapter -------------------------------------
     pin: "first" / "last" keeps a chapter at the start or end; others move for each stakeholder.
     chapterPriority[stakeholder id] = the chapters to bring forward, in order.
     keyCount = how many of those get the "Key for ..." tag. */
  story: {
    title: "The launch story",
    intro: "The core launch notification, chapter by chapter. Each chapter links to a module with more detail, ready to add to your pack.",
    downloadLabel: "Download the core notification"
  },
  chapters: [
    { id: "value", pin: "first", title: "What's coming", module: "value",
      lead: "Product A is a **once-monthly subcutaneous** treatment for adults with moderate to severe Condition X. An application went to the MHRA in March 2026, with a decision expected in **Q1 2027**.",
      facts: [["Dosing", "Once monthly"], ["Route", "Subcutaneous, self-administered"], ["MHRA decision", "Expected Q1 2027"]] },
    { id: "pathway", pin: "", title: "Who it's for", module: "pathway",
      lead: "Adults whose disease is not adequately controlled after first-line therapy. We estimate around **8,400 eligible patients** in England, or roughly 225 in an average ICB.",
      facts: [["England", "8,400 patients"], ["Average ICB", "225 patients"], ["New each year", "1,100 patients"]] },
    { id: "formulary", pin: "", title: "Where it fits", module: "formulary",
      lead: "Expected at the **second-line** stage of the current NICE pathway. Specialists in secondary care would start treatment, with a formulary submission pack following the MHRA decision.",
      facts: [["Line of therapy", "Second line"], ["Initiation", "Specialist, secondary care"], ["NICE route", "Single technology appraisal"]] },
    { id: "tariffs", pin: "", title: "Cost and supply", module: "tariffs",
      lead: "Product A is expected to be a **high-cost drug outside the payment system**. It will be supplied through homecare and wholesaler routes, and stored at 2–8°C.",
      facts: [["Tariff status", "Expected high-cost drug"], ["Supply", "Homecare and wholesaler"], ["Storage", "2–8°C"]] },
    { id: "transition", pin: "", title: "Planned transition", module: "checklist",
      lead: "Product A is intended to replace Product B. Product B stays available for at least **12 months** after launch, and no patient needs to switch before a clinical review.",
      facts: [["Transition", "At least 12 months"], ["Switching", "After clinical review"], ["Stock", "Both products during transition"]] },
    { id: "next", pin: "last", title: "What happens next", module: "faqs",
      lead: "Your account contact can share the modules relevant to you, brief your formulary or medicines optimisation committee, and **update you as MHRA and NICE milestones** are confirmed.",
      facts: [["Formulary pack", "After MHRA decision"], ["Budget model", "On request"], ["Updates", "At each milestone"]] }
  ],
  chapterPriority: {
    commissioner: ["pathway", "tariffs", "formulary", "transition"],
    pharmacist:   ["formulary", "pathway", "tariffs", "transition"],
    finance:      ["tariffs", "pathway", "formulary", "transition"],
    clinical:     ["pathway", "transition", "formulary", "tariffs"],
    trust:        ["tariffs", "transition", "formulary", "pathway"]
  },
  keyCount: 2,

  /* ---- Timeline (state: "done", "now" or "future") ------------------------ */
  timeline: {
    title: "Where we are",
    intro: "Dates are expected and subject to regulatory timelines. We'll update stakeholders as each milestone is confirmed.",
    items: [
      { state: "done",   tag: "Done",     when: "Oct 26", what: "Advance notification issued", text: "This notification shared with NHS budget holders and formulary decision-makers." },
      { state: "now",    tag: "Next",     when: "Q1 27",  what: "MHRA decision expected",      text: "Licence wording confirmed. Formulary submission pack released." },
      { state: "future", tag: "Expected", when: "Q2 27",  what: "NICE technology appraisal",   text: "A positive recommendation starts the 90-day funding requirement." },
      { state: "future", tag: "Planned",  when: "Q2 27",  what: "UK launch",                   text: "Supply through homecare and wholesaler routes. dm+d codes live." },
      { state: "future", tag: "Planned",  when: "+12 mo", what: "Transition from Product B",   text: "Patients reviewed and moved in a planned way. Product B stays available." }
    ]
  },

  /* ---- Pack section, email and footer ------------------------------------ */
  finale: {
    title: "Your pack",
    sub: "Everything you've added, in recommended order. Preview it, download it as one PDF, or send it with an approved email."
  },
  email: {
    closing: "This information is provided to support budget and service planning. Product A does not currently have a UK marketing authorisation.",
    signoff: "Kind regards,\n[Account contact name]\n[Company] · [Phone]"
  },
  legal: {
    title: "Product A advance notification",
    paragraphs: [
      "This information is provided to NHS budget holders and formulary decision-makers to support financial and service planning, in line with the ABPI Code of Practice provisions on advance notification of new medicines. It is not intended for prescribers or patients.",
      "Product A is not licensed in the UK. Its safety and efficacy have not been established by the MHRA. All figures shown are placeholders for this mock-up."
    ]
  },

  /* ---- Veeva CLM (only used when the page runs inside Veeva) -------------- */
  veeva: {
    include: false,                // adds a reference to veeva-library.js in exported files
    emailTemplate: "",             // Approved Email template ID
    fragments: {},                 // Approved Email fragment ID for each document id, e.g. { core: "…", value: "…" }
    pdfSlides: {},                 // optional: key message name of each PDF slide, e.g. { core: "…" }
    presentationId: "",
    trackEvents: true
  }
};

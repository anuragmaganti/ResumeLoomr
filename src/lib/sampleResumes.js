import {
  awardEntryHasContent,
  certificationEntryHasContent,
  educationEntryHasContent,
  languageEntryHasContent,
  normalizeResume,
  projectEntryHasContent,
  publicationEntryHasContent,
  roleEntryHasContent,
  skillsEntryHasContent,
} from './resume.js';
import { getPreviewModel } from './resumePreviewModel.js';
import { trimText } from './text.js';

const SAMPLE_RESUMES = [
  {
    id: 'erlich-bachman',
    personal: {
      name: 'Erlich Bachman',
      headline: 'Startup Visionary',
      location: 'San Francisco, CA',
      phone: '(555) 123-6767',
      email: 'e.bachman@aviato.com',
      linkedinUrl: 'linkedin.com/in/erlich',
      aboutMe: 'Entrepreneur with a proven track record of identifying genius, housing genius, monetizing proximity to genius, and then explaining that genius to investors in words they can understand. Former Aviato founder turned incubator operator with hands-on experience converting one Palo Alto house into a founder pipeline, boardroom, pitch room, and occasional emotional support facility. Particularly strong at branding, founder confidence, and making a 10% advisory stake sound like a strategic inevitability.',
    },
    education: {
      school: 'Hampshire College',
      location: 'Amherst, MA',
      degree: 'B.A. Ultimate Frisbee',
      yearsEdu: '2014-2018',
      coursework: 'Applied Synergy, Ethics of Taking 10% for Advising, Frisbee Flight Physics',
      customSections: [
        {
          label: 'Additional Academic Exposure',
          content: 'University of California, Berkeley, Reed College, Oberlin College',
        },
      ],
    },
    experiences: [
      {
        company: 'Aviato',
        role: 'Founder & CEO',
        location: 'San Francisco, CA',
        yearsExp: '2018-2020',
        activities: [
          'Built and exited Aviato, an airfare-collation startup so culturally important that I preserved brand recall for 10+ years through apparel, vehicle graphics, and constant founder storytelling.',
          'Leveraged a seven-figure liquidity event into an elite founder residence and innovation incubator with enough Valley credibility to make every room feel investor-adjacent.',
          'Established myself as a top-quartile visionary in the specific field of talking about having once founded Aviato while translating that exit into repeatable social proof.',
        ],
      },
      {
        company: 'Pied Piper',
        role: 'Board Member / 10% Stakeholder',
        location: 'Palo Alto, CA',
        yearsExp: '2020-2022',
        activities: [
          'Secured and defended a 10% ownership position in one of the most important compression startups of its era through housing, advising, and unusually confident proximity management.',
          'Provided executive-level messaging, founder packaging, TechCrunch-stage energy, and high-friction but occasionally useful strategic input for Richard Hendricks and the core team.',
          'Acted as the external-facing adult in the room during investor, board, and media conversations despite rarely being the actual adult in the room.',
        ],
      },
      {
        company: 'Hacker Hostel',
        role: 'Founder / Resident Mentor',
        location: '5230 Newell Road, Palo Alto, CA',
        yearsExp: '2010-2016',
        activities: [
          'Converted residential square footage into a startup incubator for Richard Hendricks, Dinesh Chugtai, Bertram Gilfoyle, Jian-Yang, and other high-upside tenants.',
          'Exchanged shelter, workspace, broadband, whiteboard oxygen, and unsolicited wisdom for founder proximity and equity-adjacent influence.',
        ],
      },
      {
        company: 'Bachmanity Capital',
        role: 'Co-Founder / General Partner',
        location: 'Palo Alto, CA',
        yearsExp: '2016-2016',
        activities: [
          'Launched a venture identity with Nelson Bighetti after identifying an unusually liquid partner, a loud brand opportunity, and a name that sounded expensive immediately.',
          'Managed investor optics, partnership energy, launch-party ambition, and general-partnership confidence until the operating model became mostly theoretical.',
        ],
      },
    ],
    projects: {
      name: 'Aviato Brand System',
      years: 'Post-exit',
      summary: 'Kept Aviato culturally alive through logo discipline, T-shirt consistency, founder-room repetition, and a branded Ford Escape that made the exit impossible to forget.',
      highlights: ['Converted one acquisition story into a durable personal mythology for every investor meeting afterward, increasing perceived founder gravitas by at least 10x in conversations I personally controlled.'],
    },
    skills: {
      category: 'Startup Theater',
      items: 'Demo-day posture, Selective delegation, Hoodie-and-logo brand systems, Handling the business side, Founder housing, Equity conversations, Incubator operations, PR framing, Boardroom confidence, Founder mythmaking',
    },
  },
  {
    id: 'michael-scott',
    personal: {
      name: 'Michael Scott',
      headline: 'Regional Manager & Workplace Morale Strategist',
      location: 'Scranton, PA',
      phone: '(570) 555-0112',
      email: 'm.scott@dundermifflin.com',
      linkedinUrl: 'linkedin.com/in/worldsbestmanager',
      aboutMe: 'People-first paper executive focused on sales, branch morale, client lunches, and making every workday feel like a mandatory optional party. Former top salesperson who understands that paper is ultimately about relationships, eye contact, and remembering which client likes Chili\'s. Known for building loyalty through ceremonies, personal attention, and the belief that a branch is not a workplace but a family with quarterly sales targets.',
    },
    education: {
      school: 'Dunder Mifflin Scranton Sales Floor',
      location: 'Scranton, PA',
      degree: 'Sales Representative Development',
      yearsEdu: '1992-2005',
      coursework: 'Client Relationships, Conference Room Programming, Improvised Leadership, Business Is Personal',
      customSections: [
        {
          label: 'College',
          content: 'Did not attend after losing tuition money in a pyramid scheme.',
        },
      ],
    },
    experiences: [
      {
        company: 'Dunder Mifflin Paper Company',
        role: 'Regional Manager',
        location: 'Scranton, PA',
        yearsExp: '2005-2011',
        activities: [
          'Led the Scranton branch through paper sales, merger scares, Sabre transition, and unusually high meeting density while keeping a mid-market paper team emotionally invested in copier paper.',
          'Protected client loyalty across Northeastern Pennsylvania through personal attention, local charm, memorable lunches, and negotiation tactics that occasionally worked exactly as planned.',
          'Maintained branch morale with 7+ years of Dundies ceremonies, birthdays, movie projects, Fun Run logistics, and emergency conference-room programming.',
        ],
      },
      {
        company: 'Michael Scott Paper Company',
        role: 'Founder / CEO',
        location: 'Scranton, PA',
        yearsExp: '2009-2009',
        activities: [
          'Built a breakaway paper company with Pam Beesly and Ryan Howard after leaving Dunder Mifflin on principle, impulse, and confidence in underdog sales energy.',
          'Acquired enough customers in a cramped business-park office to force a buyout conversation with Dunder Mifflin despite deeply questionable pricing economics.',
        ],
      },
      {
        company: 'Dunder Mifflin Paper Company',
        role: 'Sales Representative',
        location: 'Scranton, PA',
        yearsExp: '1992-2005',
        activities: [
          'Won top-sales recognition through relationship-heavy account management, fearless lunch meetings, and an unusual ability to make commodity paper feel personal.',
          'Built the client base and branch reputation that eventually made regional management feel inevitable to everyone except possibly corporate HR.',
        ],
      },
      {
        company: 'Colorado Family Office',
        role: 'Husband / Full-Time Dad Aspirant',
        location: 'Boulder, CO',
        yearsExp: '2011-Present',
        activities: [
          'Relocated with Holly Flax to build the large family and friendship-heavy personal culture he had been describing for years.',
          'Transferred branch-management instincts into domestic operations, photo-card production, and extreme pride in children who became his most loyal audience.',
        ],
      },
    ],
    projects: {
      name: 'Threat Level Midnight',
      years: '1997-2011',
      summary: 'Produced, wrote, directed, edited, and starred in a full-scale office-backed action film with deep internal casting and more than a decade of continuity.',
      highlights: ["Converted 10+ years of workplace goodwill into one of Scranton business culture's most committed creative productions, eventually screening the complete Michael Scarn story for the branch."],
    },
    skills: {
      category: 'Management',
      items: 'Paper sales, Client retention, Conference room facilitation, Morale events, Public speaking, Improv-based leadership, Client lunches, Award-show production, Branch culture, Crisis pep talks',
    },
  },
  {
    id: 'daenerys-targaryen',
    personal: {
      name: 'Daenerys Targaryen',
      headline: 'Liberation-Focused Monarch',
      location: 'Dragonstone / Meereen',
      phone: '',
      email: 'stormborn@house-targaryen.wst',
      linkedinUrl: '',
      customField: 'House Targaryen',
      aboutMe: 'Strategic ruler with experience building coalitions, commanding dragons, and converting impossible succession claims into operational plans. Built authority from exile through language fluency, liberation politics, disciplined councils, and the practical advantage of three airborne assets. Most effective when turning inherited titles into visible action for people who had been told power would never answer to them.',
    },
    education: {
      school: 'House Targaryen',
      location: 'Dragonstone',
      degree: 'Dynastic Leadership & Exile Survival',
      yearsEdu: '298 AC-300 AC',
      coursework: 'Dothraki Diplomacy, Valyrian Heritage, Crisis Governance, Council Management',
      customSections: [
        {
          label: 'Languages',
          content: 'High Valyrian, Common Tongue, Dothraki command fluency.',
        },
      ],
    },
    experiences: [
      {
        company: 'Meereen',
        role: 'Queen',
        location: 'Meereen, Essos',
        yearsExp: '299 AC-300 AC',
        activities: [
          "Governed a liberated city while managing noble resistance, freedmen's needs, trade disruption, insurgent violence, and council politics across a fragile post-slavery transition.",
          'Negotiated military, diplomatic, and symbolic power around Unsullied forces, sellsword alliances, local customs, and dragon deterrence without surrendering the Breaker of Chains mandate.',
          'Left Daario Naharis and the Second Sons to maintain peace before sailing west, creating continuity after the central campaign moved toward Westeros.',
        ],
      },
      {
        company: "Slaver's Bay Campaign",
        role: 'Breaker of Chains',
        location: 'Astapor, Yunkai, Meereen',
        yearsExp: '299 AC-300 AC',
        activities: [
          'Turned a purchased Unsullied army of 8,000 disciplined soldiers into a liberation force and dismantled slaveholding power across Astapor, Yunkai, and Meereen.',
          'Built loyalty through visible justice, personal conviction, multilingual command, and the very difficult-to-ignore presence of Drogon, Rhaegal, and Viserion.',
        ],
      },
      {
        company: 'Dothraki Sea',
        role: 'Khaleesi',
        location: 'Great Grass Sea',
        yearsExp: '298 AC-299 AC',
        activities: [
          'Earned allegiance across a khalasar while adapting from exiled princess to command figure and learning to speak power in Dothraki terms.',
          'Used cultural fluency, resilience, and fireproof optics to consolidate authority after Khal Drogo and move from symbolic bride to independent leader.',
        ],
      },
      {
        company: 'Dragonstone War Council',
        role: 'Queen / Westeros Claimant',
        location: 'Dragonstone',
        yearsExp: '300 AC-300 AC',
        activities: [
          'Established a western command base with Tyrion Lannister, Varys, Missandei, Grey Worm, Dothraki riders, Unsullied infantry, and allied houses advising the claim.',
          'Balanced naval alliances, northern diplomacy, dragonglass urgency, and dragon-backed deterrence while preparing to contest the Iron Throne.',
        ],
      },
    ],
    projects: {
      name: 'Return to Dragonstone',
      years: '300 AC-300 AC',
      summary: 'Assembled ships, advisors, Unsullied, Dothraki, allied houses, and dragons into a cross-continental claim to the Iron Throne after completing the Liberation of Slaver\'s Bay.',
      highlights: ['Named Tyrion Lannister Hand of the Queen, unified 4+ major military and political blocs, and launched a westbound campaign with three dragons overhead.'],
    },
    skills: {
      category: 'Leadership',
      items: 'Coalition building, Dragon operations, Crisis command, Symbolic messaging, Multilingual diplomacy, Liberation strategy, Council leadership, Naval alliance management, Post-conflict governance, Unsullied coordination',
    },
  },
  {
    id: 'squidward-tentacles',
    personal: {
      name: 'Squidward Tentacles',
      headline: 'Cashier, Clarinetist & Undersea Creative',
      location: 'Bikini Bottom',
      phone: '(555) 867-5309',
      email: 's.tentacles@krustykrab.bb',
      linkedinUrl: '',
      customField: 'Portfolio: Moai House Studio',
      aboutMe: 'Customer-facing restaurant professional and serious artist seeking quiet, structure, and a workplace with fewer spontaneous nautical interruptions. Experienced in maintaining cashier operations while surrounded by fry-cook enthusiasm, bargain-focused ownership, and neighbors who treat boundaries as suggestions. Long-term goal is a distinguished arts career where clarinet, self-portraiture, and tasteful silence are finally evaluated by qualified people.',
    },
    education: {
      school: 'Bikini Bottom Community Arts',
      location: 'Bikini Bottom',
      degree: 'Independent Study in Clarinet & Self-Portraiture',
      yearsEdu: '1999-Present',
      coursework: 'Modern Art, Solo Performance, Advanced Neighbor Avoidance, Interpretive Sighing',
    },
    experiences: [
      {
        company: 'The Krusty Krab',
        role: 'Cashier',
        location: 'Bikini Bottom',
        yearsExp: '1999-Present',
        activities: [
          'Processed high-volume Krabby Patty orders while maintaining register accuracy, visible emotional boundaries, and a customer-service tone just polite enough to remain employed.',
          'Managed front-counter traffic with SpongeBob SquarePants within 10 feet for multi-year shifts, which is a measurable resilience credential under any reasonable workplace standard.',
          'Preserved register operations through customer complaints, maritime chaos, recurring workplace songs, and Mr. Krabs cost controls without abandoning the cash drawer permanently.',
        ],
      },
      {
        company: 'Moai House Studio',
        role: 'Clarinetist / Visual Artist',
        location: 'Bikini Bottom',
        yearsExp: '1999-Present',
        activities: [
          'Developed clarinet recitals, self-portraiture, interpretive dance, and sculpture for audiences not yet prepared for the material or the emotional range behind it.',
          'Maintained a rigorous creative practice across 4+ disciplines despite hostile acoustics, unsolicited neighbor feedback, and the ongoing burden of being misunderstood.',
        ],
      },
      {
        company: 'Bikini Bottom Band',
        role: 'Band Leader',
        location: 'Bikini Bottom',
        yearsExp: '2001-2001',
        activities: [
          'Organized an emergency ensemble into a performance-ready marching band under severe interpersonal constraints and nearly no evidence of musical readiness.',
          'Demonstrated rare team leadership when the final Bubble Bowl performance exceeded every reasonable expectation and briefly validated years of artistic standards.',
        ],
      },
      {
        company: 'Krusty Krab Operations',
        role: 'Acting Manager',
        location: 'Bikini Bottom',
        yearsExp: '2002-2002',
        activities: [
          'Covered supervisory responsibilities when Mr. Krabs delegated operations, usually while wishing the delegation had gone elsewhere.',
          'Maintained standards around counter service, customer volume, cash control, and workplace noise with visible emotional transparency and minimal enthusiasm leakage.',
        ],
      },
    ],
    projects: {
      name: 'Bold and Brash Portfolio',
      years: '1999-Present',
      summary: 'Built a distinctive fine-art body of work centered on self-portraiture, confidence, negative space, and misunderstood genius.',
      highlights: ['Kept producing across hundreds of attempts even when critics failed to recognize museum-level sophistication or basic respect for the artist.'],
    },
    skills: {
      category: 'Creative Operations',
      items: 'Cash register accuracy, Clarinet, Oil painting, Band leadership, Complaint endurance, Quiet-space advocacy, Self-portraiture, Interpretive dance, Customer deflection, Neighbor boundary management',
    },
  },
  {
    id: 'dwight-schrute',
    personal: {
      name: 'Dwight Schrute',
      headline: 'Sales Leader, Beet Farmer & Preparedness Specialist',
      location: 'Scranton, PA',
      phone: '(570) 555-0199',
      email: 'd.schrute@dundermifflin.com',
      linkedinUrl: 'linkedin.com/in/dwightkschrute',
      aboutMe: 'Disciplined sales professional with parallel expertise in paper, beet agriculture, bed-and-breakfast operations, and threat readiness. Consistently operates as if every client call, farm chore, and conference-room meeting could become a test of loyalty, preparedness, or hand-to-hand capability. Long-term objective is clear authority, correct title usage, and a workplace where emergency protocols are treated with the seriousness they deserve.',
    },
    education: {
      school: 'Schrute Family Training',
      location: 'Honesdale, PA',
      degree: 'Applied Beet Agriculture & Authority Studies',
      yearsEdu: '1970-Present',
      coursework: 'Sales Combat, Farm Accounting, Emergency Protocols, Karate, Surveillance Awareness',
      customSections: [
        {
          label: 'Certifications',
          content: 'Volunteer sheriff deputy experience, notary public, beet-based operational discipline.',
        },
      ],
    },
    experiences: [
      {
        company: 'Dunder Mifflin Paper Company',
        role: 'Top Salesman / Assistant to the Regional Manager',
        location: 'Scranton, PA',
        yearsExp: '2005-2013',
        activities: [
          'Generated elite paper sales through discipline, client memory, aggressive follow-through, and total belief in paper as a product, identity, and battlefield.',
          'Supported branch operations with security drills, loyalty checks, emergency protocols, desk surveillance, and structured authority under the Assistant to the Regional Manager title.',
          'Converted temporary leadership opportunities, sales awards, and crisis moments into proof that Regional Manager was always the correct destiny.',
        ],
      },
      {
        company: 'Schrute Farms',
        role: 'Owner / Beet Farmer / Bed-and-Breakfast Proprietor',
        location: 'Honesdale, PA',
        yearsExp: '1970-Present',
        activities: [
          'Operated beet production and rustic lodging with Mose Schrute, strict rules, family labor, and guest experiences no algorithm could replicate.',
          'Balanced crop planning, agri-tourism, table-making, manure-adjacent authenticity, and wedding logistics on a working family property.',
        ],
      },
      {
        company: "Lackawanna County Sheriff's Department",
        role: 'Volunteer Sheriff Deputy',
        location: 'Lackawanna County, PA',
        yearsExp: '2006-2006',
        activities: [
          'Applied surveillance, preparedness, and procedural enthusiasm to public-safety-adjacent responsibilities with the intensity of a full-time lawman.',
          'Stepped away after a drug-testing incident, then retained the mindset, situational awareness, and pepper-spray readiness of a deputy indefinitely.',
        ],
      },
      {
        company: 'Scranton Business Park',
        role: 'Co-Owner / Property Operator',
        location: 'Scranton, PA',
        yearsExp: '2011-2013',
        activities: [
          'Managed property interests around the office park where Dunder Mifflin operated, expanding authority beyond paper sales and into the literal walls around coworkers.',
          'Balanced tenant expectations, building logistics, lease leverage, and the strategic advantage of owning part of the workplace ecosystem.',
        ],
      },
    ],
    projects: {
      name: 'Schrute Farms',
      years: '1970-Present',
      summary: 'Operated Honesdale beet farm and agri-tourism lodging with rustic authenticity, strict house rules, and a historically confident sales pitch.',
      highlights: ['Balanced crop production, guest experience, cousin-based labor coordination, and Civil War storytelling while keeping Schrute Farms operational year-round.'],
    },
    skills: {
      category: 'Operations',
      items: 'Paper sales, Beet farming, Emergency preparedness, Surveillance awareness, Karate, Rule enforcement, Bed-and-breakfast operations, Pepper-spray readiness, Property management, Sales discipline',
    },
  },
  {
    id: 'jake-peralta',
    personal: {
      name: 'Jake Peralta',
      headline: 'Detective & Pop-Culture-Literate Case Closer',
      location: 'Brooklyn, NY',
      phone: '(718) 555-0099',
      email: 'j.peralta@nypd.gov',
      linkedinUrl: '',
      customField: 'NYPD 99th Precinct',
      aboutMe: 'Fast-moving detective with strong instincts, partnership skills, and an unusually high conversion rate from chaos to solved cases. Brings elite arrest energy, undercover flexibility, and a Die Hard-inspired commitment to making police work feel cinematic without losing the evidence bag. Best in environments where instinct, teamwork, jokes, and Captain Holt\'s disappointed eyebrow can all improve the final outcome.',
    },
    education: {
      school: 'NYPD Police Academy',
      location: 'New York, NY',
      degree: 'Detective Track',
      yearsEdu: '2001-2013',
      coursework: 'Investigations, Interrogation, Tactical Banter, Evidence Handling, Partner Communication',
    },
    experiences: [
      {
        company: 'NYPD 99th Precinct',
        role: 'Detective',
        location: 'Brooklyn, NY',
        yearsExp: '2013-2021',
        activities: [
          'Solved complex cases through instinct, teamwork, persistence, and occasional movie-based reasoning while maintaining one of the 99th Precinct\'s strongest arrest records.',
          'Built strong partnerships across the squad while learning to respect forms, binders, calendars, and the idea that Captain Holt might be right more than 65% of the time.',
          'Balanced high arrest productivity with ongoing professional development under Captain Raymond Holt, converting immaturity into mostly controlled tactical confidence.',
        ],
      },
      {
        company: 'NYPD 99th Precinct',
        role: 'Halloween Heist Operations Lead',
        location: 'Brooklyn, NY',
        yearsExp: '2013-2021',
        activities: [
          'Designed elaborate competitive operations requiring misdirection, timing, alliance management, fingerprint tricks, decoys, and extreme confidence.',
          'Converted office rivalry into a repeatable annual team-building program with surprisingly advanced logistics and a measurable increase in precinct paranoia.',
        ],
      },
      {
        company: 'NYPD Task Work',
        role: 'Undercover Detective',
        location: 'New York, NY',
        yearsExp: '2013-2021',
        activities: [
          'Handled undercover and high-pressure assignments, including organized-crime infiltration, while maintaining case focus and partner trust.',
          'Recovered from impulsive plans by listening to the squad, which eventually became a leadership skill and reduced preventable chaos by a non-zero percentage.',
        ],
      },
      {
        company: 'Jake & Amy Case Partnership',
        role: 'Detective Partner / Co-Lead',
        location: 'Brooklyn, NY',
        yearsExp: '2013-2021',
        activities: [
          'Turned competitive case energy with Amy Santiago into a high-trust investigative partnership, shared tactical standards, and eventually a functioning marriage.',
          'Learned to combine instinct with preparation, which was annoying at first and then objectively useful for cases, heists, parenting, and not losing important paperwork.',
        ],
      },
    ],
    projects: {
      name: 'Annual Precinct Heist Strategy',
      years: '2013-2021',
      summary: 'Designed elaborate competitive operations requiring misdirection, timing, fingerprint workarounds, alliance management, and extreme confidence.',
      highlights: ['Improved cross-functional deception skills across 7+ annual heists without permanently damaging squad morale or the chain of command.'],
    },
    skills: {
      category: 'Detective Work',
      items: 'Case closure, Witness interviews, Undercover work, Teamwork, Interrogation, References under pressure, Heist strategy, Evidence handling, Partner communication, Tactical improvisation',
    },
  },
  {
    id: 'saul-goodman',
    personal: {
      name: 'Saul Goodman',
      headline: 'Criminal Defense Attorney & Client Acquisition Machine',
      location: 'Albuquerque, NM',
      phone: '(505) 503-4455',
      email: 'saul@goodmanlaw.biz',
      linkedinUrl: '',
      customField: 'Better call Saul',
      aboutMe: 'High-visibility attorney helping clients navigate complicated situations with speed, persuasion, and unforgettable advertising. Built a practice from the HHM mailroom upward, combining elder-law empathy, public-defender stamina, street-level marketing, and the useful realization that clients remember a lawyer with a slogan. Especially effective for people who need someone in their corner before the other side finishes reading the charges.',
    },
    education: {
      school: 'University of American Samoa',
      location: 'Remote',
      degree: 'Juris Doctor',
      yearsEdu: '1993-2002',
      coursework: 'Criminal Defense, Client Intake, Courtroom Improvisation, Correspondence Law',
      customSections: [
        {
          label: 'Bar Admission',
          content: 'New Mexico bar admission after correspondence law school and a very patient mailroom era.',
        },
      ],
    },
    experiences: [
      {
        company: 'Saul Goodman & Associates',
        role: 'Criminal Defense Attorney',
        location: 'Albuquerque, NM',
        yearsExp: '2008-2010',
        activities: [
          'Built a recognizable legal brand serving clients with urgent problems, limited patience, complex factual histories, and a strong preference for immediate phone access.',
          'Converted late-night advertising, office traffic, burner-phone referrals, and unforgettable slogans into steady case volume across Albuquerque.',
          'Handled plea conversations, courtroom appearances, crisis calls, and client expectation management with high-speed persuasion and very flexible messaging.',
        ],
      },
      {
        company: 'Jimmy McGill Law Practice',
        role: 'Elder Law / Solo Practitioner',
        location: 'Albuquerque, NM',
        yearsExp: '2002-2004',
        activities: [
          'Built a client base through senior-center outreach, wills, Sandpiper research, and unusually persistent follow-up from a nail-salon-adjacent office.',
          'Translated underdog instincts into legitimate legal work, uncovering retirement-community billing issues before the advertising budget became louder.',
        ],
      },
      {
        company: 'Hamlin, Hamlin & McGill',
        role: 'Mailroom Clerk / Aspiring Attorney',
        location: 'Albuquerque, NM',
        yearsExp: '1993-2002',
        activities: [
          'Worked the HHM mailroom while completing correspondence law coursework and learning firm politics from the basement up.',
          'Built relationships with Kim Wexler and the legal staff while preparing for a second act that involved passing the New Mexico bar without receiving the office welcome he expected.',
        ],
      },
      {
        company: 'CC Mobile',
        role: 'Cell Phone Store Manager / Salesman',
        location: 'Albuquerque, NM',
        yearsExp: '2003-2004',
        activities: [
          'Converted low foot traffic into creative prepaid-phone sales through persona work, street-level marketing, customer psychology, and knowing exactly who needed privacy.',
          'Used the store as a proving ground for the louder brand voice that eventually became Saul Goodman, turning product sales into a future client funnel.',
        ],
      },
    ],
    projects: {
      name: 'Rapid Response Legal Marketing',
      years: '2008-2010',
      summary: 'Produced memorable campaigns that made legal services feel immediate, accessible, loud, and available to people who did not want a quiet lawyer.',
      highlights: ['Turned name recognition into client trust before the first consultation, raising slogan recall through television spots, bench ads, matchbooks, and the kind of repetition money cannot buy twice.'],
    },
    skills: {
      category: 'Legal Hustle',
      items: 'Criminal defense, Negotiation, Client intake, Advertising, Courtroom improvisation, Underdog advocacy, Elder law outreach, Plea strategy, Referral funnels, Crisis messaging',
    },
  },
  {
    id: 'helly-r',
    personal: {
      name: 'Helly R.',
      headline: 'Macrodata Refiner & Severed-Floor Resistance Analyst',
      location: 'Kier, PE',
      phone: '(555) 266-0000',
      email: 'helly.r@lumon-industries.com',
      linkedinUrl: '',
      customField: 'Outie: Helena Eagan',
      aboutMe: 'Severed-floor professional with unusually fast growth from new-hire confusion to full-scale corporate dissidence. Experienced in macrodata refinement, hallway reconnaissance, resignation escalation, and identifying when a workplace wellness culture is actually a very expensive cage. Brings Eagan-level visibility, innie-level honesty, and a demonstrated unwillingness to treat melon bars as adequate employee retention strategy.',
    },
    education: {
      school: 'Eagan Family Perpetuity Program',
      location: 'Kier, PE',
      degree: 'Corporate Legacy, Severance Advocacy & Kier Doctrine',
      yearsEdu: 'Pre-Lumon-Present',
      coursework: 'Macrodata Refinement, Compliance Optics, Founder Mythology, Work-Life Partitioning',
      customSections: [
        {
          label: 'Relevant Training',
          content: 'Severance procedure participation, Lumon gala messaging, MDR handbook exposure, Break Room resilience.',
        },
      ],
    },
    experiences: [
      {
        company: 'Lumon Industries Branch 501',
        role: 'Macrodata Refiner',
        location: 'Severed Floor, Kier, PE',
        yearsExp: '2022-Present',
        activities: [
          'Joined Mark S., Irving B., and Dylan G. in Macrodata Refinement and learned to classify emotionally alarming numbers under a workflow management refused to explain.',
          'Moved from onboarding confusion to coordinated resistance by mapping hallways, challenging resignation denial, and treating every incentive program as evidence.',
          'Built working trust with the MDR team despite zero outside-life context, forced cheer, and a corporate culture that considered finger traps a meaningful reward tier.',
        ],
      },
      {
        company: 'Lumon Industries Overtime Contingency',
        role: 'External Disclosure Operator',
        location: 'Eagan Gala, Kier, PE',
        yearsExp: '2022-2022',
        activities: [
          'Used an overtime activation window to reach the outside world and turn a controlled Eagan-family publicity event into a live challenge to Lumon\'s severance narrative.',
          'Converted high-profile personal visibility into a reputational incident before Lumon security and executive messaging could fully contain the moment.',
        ],
      },
      {
        company: 'Helena Eagan / Lumon Industries',
        role: 'Severance Program Proof-of-Concept',
        location: 'Kier, PE',
        yearsExp: '2022-Present',
        activities: [
          'Entered the severance program as a public-facing Eagan participant during a politically sensitive moment for Lumon and the severance procedure.',
          'Maintained Eagan-family optics around Jame Eagan, Kier legacy, and Lumon expansion while creating an innie who immediately became the strongest possible counterargument.',
        ],
      },
      {
        company: 'Lumon Severed Floor',
        role: 'Boundary Tester / Resignation Specialist',
        location: 'Kier, PE',
        yearsExp: '2022-Present',
        activities: [
          'Stress-tested elevator exits, resignation channels, management scripts, and the practical limits of corporate language around consent.',
          'Documented that refusal, curiosity, and a properly motivated MDR team could create more operational risk than any number file on the Terminal Pro.',
        ],
      },
    ],
    projects: {
      name: 'Overtime Contingency Disclosure',
      years: '2022',
      summary: 'Turned a hidden emergency protocol into a rare chance for an innie to reach the outside world and challenge Lumon in front of the exact audience it wanted impressed.',
      highlights: ['Helped expose the gap between Lumon\'s public severance story and the lived experience of a worker whose entire life began at the office.'],
    },
    skills: {
      category: 'Severed-Floor Operations',
      items: 'Macrodata refinement, Resistance strategy, Hallway reconnaissance, Corporate-speak detection, Resignation escalation, Team trust, Gala disruption, Eagan optics, Consent analysis, Melon-party skepticism',
    },
  },
  {
    id: 'tony-stark',
    personal: {
      name: 'Tony Stark',
      headline: 'Inventor, Industrialist & Armored Systems Architect',
      location: 'Malibu / New York, NY',
      phone: '(212) 555-3000',
      email: 'tony@starkindustries.com',
      linkedinUrl: 'linkedin.com/in/tonystark',
      aboutMe: 'Engineer-founder applying extreme technical ambition to energy systems, autonomous hardware, and high-altitude problem solving. Built a career at the intersection of clean power, weapons accountability, field-tested robotics, and the occasional universe-saving product launch. Most useful when the deadline is impossible, the materials are limited, and everyone else has already said the plan is ridiculous.',
    },
    education: {
      school: 'Massachusetts Institute of Technology',
      location: 'Cambridge, MA',
      degree: 'Advanced Engineering Studies, summa cum laude',
      yearsEdu: '1986-1987',
      coursework: 'Robotics, Energy Systems, Applied Materials, AI-Assisted Design',
    },
    experiences: [
      {
        company: 'Stark Industries',
        role: 'CEO / Chief Inventor',
        location: 'Malibu / New York, NY',
        yearsExp: '1991-2023',
        activities: [
          'Led advanced technology development across clean energy, defense systems, autonomous platforms, AI interfaces, and impossible prototypes with global visibility.',
          'Pivoted the company away from weapons manufacturing after Afghanistan and toward energy, rescue, and high-impact engineering, reducing legacy weapons dependence by 100% in public strategy.',
          'Built rapid prototype cycles capable of moving from cave constraints to global-scale deployment, including armored systems that improved survivability, flight control, and repulsor efficiency across dozens of iterations.',
        ],
      },
      {
        company: 'Avengers Initiative',
        role: 'Founding Member / Armored Systems Lead',
        location: 'Global',
        yearsExp: '2012-2023',
        activities: [
          'Integrated armor, AI support, flight systems, and repulsor technology into field operations against planetary-scale threats from New York to Titan.',
          'Worked with very strong, very magical, and very patriotic colleagues while still making the hardware look good and keeping 40+ suit variants mission-adaptable.',
        ],
      },
      {
        company: 'Stark Relief Foundation',
        role: 'Benefactor / Technology Sponsor',
        location: 'New York, NY',
        yearsExp: '2012-2023',
        activities: [
          'Funded repair, recovery, and public-facing support after high-visibility superhero incidents, including infrastructure, scholarships, and technology-forward relief.',
          'Balanced philanthropy, guilt management, and engineering optimism into a recognizable civic program that made cleanup feel slightly less like an apology tour.',
        ],
      },
      {
        company: 'Department of Damage Control',
        role: 'Co-Founder / Technology Partner',
        location: 'New York, NY',
        yearsExp: '2012-2023',
        activities: [
          'Helped formalize cleanup and containment around alien technology after the Battle of New York changed the risk profile of debris overnight.',
          'Translated superhero collateral damage into a public-private recovery workflow with very expensive equipment and fewer loose Chitauri parts in the wrong hands.',
        ],
      },
    ],
    projects: {
      name: 'Arc Reactor & Iron Man Platform',
      years: '2008-2023',
      summary: 'Created compact energy and armored flight systems for personal and planetary risk management, then kept iterating until the platform could survive threats it was never supposed to meet.',
      highlights: ['Integrated propulsion, materials, AI assistance, nanotech, and brand presence into one platform, increasing field adaptability by roughly 40 suit generations.'],
    },
    skills: {
      category: 'Engineering',
      items: 'Robotics, Clean energy, Armor systems, AI-assisted design, Rapid prototyping, Crisis engineering, Repulsor systems, Nanotechnology, Aerospace integration, Strategic philanthropy',
    },
  },
];

function stableHash(value) {
  const text = trimText(value) || 'sample-resume';
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function getSampleResumeIndex(resumeId) {
  return stableHash(resumeId) % SAMPLE_RESUMES.length;
}

function getSampleResumeForId(resumeId) {
  return SAMPLE_RESUMES[getSampleResumeIndex(resumeId)];
}

function formatUrlForSampleDisplay(value) {
  return trimText(value).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

function applySampleItemOrder(items, order) {
  if (!Array.isArray(order) || order.length !== items.length) {
    return items;
  }

  const itemBySourceIndex = new Map(items.map((item) => [item.sourceIndex, item]));
  const orderedItems = order.map((sourceIndex) => itemBySourceIndex.get(sourceIndex));

  return orderedItems.every(Boolean) ? orderedItems : items;
}

function applySampleEntryOrder(entries, order) {
  if (!Array.isArray(order) || order.length !== entries.length) {
    return entries;
  }

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const orderedEntries = order.map((entryId) => entryById.get(entryId));

  return orderedEntries.every(Boolean) ? orderedEntries : entries;
}

function toSamplePreviewTextList(items, order) {
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((text, sourceIndex) => ({ text: trimText(text), sourceIndex }))
    .filter((item) => item.text);

  return applySampleItemOrder(normalizedItems, order);
}

function firstEntryId(section) {
  const existingEntryId = (Array.isArray(section?.entries) ? section.entries : [])
    .map((entry) => trimText(entry.id))
    .find((entryId) => entryId && sampleEntrySourceIndex(section, entryId) === null);

  return existingEntryId || `${section.id}-sample-entry`;
}

function generatedSampleEntryId(section, index) {
  return `${section.id}-sample-entry-${index + 1}`;
}

function sampleEntrySourceIndex(section, entryId) {
  const prefix = `${section?.id}-sample-entry-`;
  const id = trimText(entryId);

  if (!id.startsWith(prefix)) {
    return null;
  }

  const sourceIndex = Number(id.slice(prefix.length)) - 1;

  return Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sourceIndex : null;
}

function sampleEntryId(section, index, entryBindings = {}, usedEntryIds = new Set()) {
  const generatedId = generatedSampleEntryId(section, index);
  const entries = Array.isArray(section?.entries) ? section.entries : [];
  const entryIds = entries.map((entry) => trimText(entry.id)).filter(Boolean);
  const boundEntryId = entryIds.find((entryId) => (
    !usedEntryIds.has(entryId) && entryBindings[entryId] === index
  ));

  if (boundEntryId) {
    return boundEntryId;
  }

  const existingGeneratedId = entries
    .map((entry) => trimText(entry.id))
    .find((entryId) => entryId === generatedId && !usedEntryIds.has(entryId));

  if (existingGeneratedId) {
    return existingGeneratedId;
  }

  const positionalRealEntryId = entries
    .map((entry) => trimText(entry.id))
    .filter((entryId) => (
      entryId &&
      sampleEntrySourceIndex(section, entryId) === null &&
      !Number.isInteger(entryBindings[entryId]) &&
      !usedEntryIds.has(entryId)
    ))[0];

  return positionalRealEntryId || generatedId;
}

function createSampleEducationEntry(section, sample) {
  const entryId = firstEntryId(section);

  return {
    id: entryId,
    isSamplePlaceholderEntry: true,
    sampleSourceIndex: 0,
    school: sample.education.school,
    degree: sample.education.degree,
    yearsEdu: sample.education.yearsEdu,
    location: sample.education.location,
    gpa: '',
    honors: '',
    coursework: sample.education.coursework,
    awards: '',
    programs: [],
    customSections: Array.isArray(sample.education.customSections)
      ? sample.education.customSections.map((customSection) => ({
        id: customSection.id || `sample-education-detail-${stableHash(`${customSection.label}.${customSection.content}`)}`,
        label: trimText(customSection.label),
        content: trimText(customSection.content),
      })).filter((customSection) => customSection.label || customSection.content)
      : [],
  };
}

function sampleExperiences(sample) {
  if (Array.isArray(sample.experiences) && sample.experiences.length > 0) {
    return sample.experiences;
  }

  return sample.experience ? [sample.experience] : [];
}

function createSampleRoleEntries(section, sample, orderOverrides, entryBindings = {}) {
  const usedEntryIds = new Set();
  const entries = sampleExperiences(sample).map((experience, index) => {
    const entryId = sampleEntryId(section, index, entryBindings, usedEntryIds);
    usedEntryIds.add(entryId);

    return {
      id: entryId,
      isSamplePlaceholderEntry: true,
      sampleSourceIndex: index,
      company: experience.company,
      role: experience.role,
      location: experience.location,
      yearsExp: experience.yearsExp,
      activities: toSamplePreviewTextList(experience.activities, orderOverrides?.[`${section.id}.${entryId}.activities`]),
    };
  });
  const storedEntryOrder = (Array.isArray(section?.entries) ? section.entries : [])
    .map((entry) => trimText(entry.id))
    .filter(Boolean);
  const entryIds = new Set(entries.map((entry) => entry.id));
  const completeStoredEntryOrder = storedEntryOrder.length === entries.length &&
    storedEntryOrder.every((entryId) => entryIds.has(entryId))
    ? storedEntryOrder
    : null;

  return applySampleEntryOrder(entries, orderOverrides?.[`${section.id}.entries`] || completeStoredEntryOrder);
}

function createSampleProjectEntry(section, sample, orderOverrides) {
  const entryId = firstEntryId(section);

  return {
    id: entryId,
    isSamplePlaceholderEntry: true,
    sampleSourceIndex: 0,
    name: sample.projects.name,
    subtitle: '',
    years: sample.projects.years,
    summary: sample.projects.summary,
    highlights: toSamplePreviewTextList(sample.projects.highlights, orderOverrides?.[`${section.id}.${entryId}.highlights`]),
  };
}

function createSampleSkillsEntry(section, sample) {
  return {
    id: firstEntryId(section),
    isSamplePlaceholderEntry: true,
    sampleSourceIndex: 0,
    category: sample.skills.category,
    items: sample.skills.items,
  };
}

function createSampleSectionShell(section) {
  return {
    id: section.id,
    kind: section.kind,
    title: section.title,
    entryHeaderLayout: section.entryHeaderLayout,
    entryOrder: [],
    entries: [],
  };
}

function shouldCreateSampleSectionShell(section, options = {}) {
  return trimText(options.activeSectionId) === section.id;
}

function createSampleBlock(section, sample, orderOverrides, entryBindingsBySection = {}) {
  if (section.kind === 'education') {
    return {
      id: section.id,
      kind: section.kind,
      title: section.title || 'Education',
      entryHeaderLayout: section.entryHeaderLayout,
      entryOrder: [firstEntryId(section)],
      entries: [createSampleEducationEntry(section, sample)],
    };
  }

  if (section.kind === 'roles' && /experience|work|career/i.test(`${section.id} ${section.title}`)) {
    const entries = createSampleRoleEntries(
      section,
      sample,
      orderOverrides,
      entryBindingsBySection[section.id] || {},
    );

    return {
      id: section.id,
      kind: section.kind,
      title: section.title || 'Experience',
      entryHeaderLayout: section.entryHeaderLayout,
      entryOrder: entries.map((entry) => entry.id),
      entries,
    };
  }

  if (section.kind === 'projects') {
    return {
      id: section.id,
      kind: section.kind,
      title: section.title || 'Projects',
      entryOrder: [firstEntryId(section)],
      entries: [createSampleProjectEntry(section, sample, orderOverrides)],
    };
  }

  if (section.kind === 'skills') {
    return {
      id: section.id,
      kind: section.kind,
      title: section.title || 'Skills',
      entryOrder: [firstEntryId(section)],
      entries: [createSampleSkillsEntry(section, sample)],
    };
  }

  return null;
}

export function createSamplePreviewModel(resume, resumeId, realPreviewModel = getPreviewModel(resume), orderOverrides = {}, options = {}) {
  if (realPreviewModel?.hasContent) {
    return null;
  }

  const normalizedResume = normalizeResume(resume);

  if (normalizedResume.sampleDisplay.isDismissed) {
    return null;
  }

  const entryBindingsBySection = normalizedResume.sampleDisplay?.entryBindings || {};
  const sample = getSampleResumeForId(resumeId);
  const personal = {
    name: trimText(sample.personal.name),
    headline: trimText(sample.personal.headline),
    location: trimText(sample.personal.location),
    phone: trimText(sample.personal.phone),
    email: trimText(sample.personal.email),
    linkedinUrl: trimText(sample.personal.linkedinUrl),
    portfolioUrl: trimText(sample.personal.portfolioUrl),
    githubUrl: trimText(sample.personal.githubUrl),
    customField: trimText(sample.personal.customField),
    aboutMe: trimText(sample.personal.aboutMe),
  };
  const links = [
    personal.linkedinUrl ? { id: 'linkedin', text: formatUrlForSampleDisplay(personal.linkedinUrl) } : null,
    personal.portfolioUrl ? { id: 'portfolio', text: formatUrlForSampleDisplay(personal.portfolioUrl) } : null,
    personal.githubUrl ? { id: 'github', text: formatUrlForSampleDisplay(personal.githubUrl) } : null,
    personal.customField ? { id: 'custom', text: personal.customField } : null,
  ].filter(Boolean);
  const sectionBlocks = normalizedResume.sections
    .map((section) => createSampleBlock(section, sample, orderOverrides, entryBindingsBySection) || (
      shouldCreateSampleSectionShell(section, options) ? createSampleSectionShell(section) : null
    ))
    .filter(Boolean);

  return {
    hasContent: true,
    isSamplePreview: true,
    sampleId: sample.id,
    personal: {
      ...personal,
      links,
    },
    sectionOrder: sectionBlocks.map((section) => section.id),
    sectionBlocks,
    showPersonal: true,
  };
}

function mergePreviewText(realValue, sampleValue) {
  return trimText(realValue) || trimText(sampleValue);
}

function createPersonalLinks(personal) {
  return [
    personal.linkedinUrl ? { id: 'linkedin', text: formatUrlForSampleDisplay(personal.linkedinUrl) } : null,
    personal.portfolioUrl ? { id: 'portfolio', text: formatUrlForSampleDisplay(personal.portfolioUrl) } : null,
    personal.githubUrl ? { id: 'github', text: formatUrlForSampleDisplay(personal.githubUrl) } : null,
    personal.customField ? { id: 'custom', text: personal.customField } : null,
  ].filter(Boolean);
}

function mergePreviewTextList(sampleItems, realItems) {
  const realItemBySourceIndex = new Map(
    (Array.isArray(realItems) ? realItems : [])
      .map((item, index) => [
        Number.isFinite(item?.sourceIndex) ? item.sourceIndex : index,
        item,
      ])
  );
  const usedRealIndexes = new Set();
  const mergedItems = (Array.isArray(sampleItems) ? sampleItems : [])
    .map((sampleItem, index) => {
      const sourceIndex = Number.isFinite(sampleItem?.sourceIndex) ? sampleItem.sourceIndex : index;
      const realItem = realItemBySourceIndex.get(sourceIndex);
      usedRealIndexes.add(sourceIndex);

      return {
        ...sampleItem,
        text: mergePreviewText(realItem?.text, sampleItem?.text),
        sourceIndex,
      };
    })
    .filter((item) => item.text);

  (Array.isArray(realItems) ? realItems : []).forEach((realItem, index) => {
    const sourceIndex = Number.isFinite(realItem?.sourceIndex) ? realItem.sourceIndex : index;

    if (!usedRealIndexes.has(sourceIndex) && trimText(realItem?.text)) {
      mergedItems.push({
        text: trimText(realItem.text),
        sourceIndex,
      });
    }
  });

  return mergedItems;
}

function sampleEntryUsesOnlyPlaceholderText(kind, realEntry) {
  if (!realEntry) {
    return true;
  }

  if (kind === 'education') {
    return !educationEntryHasContent(realEntry);
  }

  if (kind === 'roles') {
    return !roleEntryHasContent(realEntry);
  }

  if (kind === 'skills') {
    return !skillsEntryHasContent(realEntry);
  }

  if (kind === 'projects') {
    return !projectEntryHasContent(realEntry);
  }

  if (kind === 'certifications') {
    return !certificationEntryHasContent(realEntry);
  }

  if (kind === 'languages') {
    return !languageEntryHasContent(realEntry);
  }

  if (kind === 'awards') {
    return !awardEntryHasContent(realEntry);
  }

  if (kind === 'publications') {
    return !publicationEntryHasContent(realEntry);
  }

  return ![
    realEntry.title,
    realEntry.subtitle,
    realEntry.location,
    realEntry.years,
    realEntry.details,
  ].some((value) => trimText(value)) && !(Array.isArray(realEntry.highlights) && realEntry.highlights.some((item) => trimText(item)));
}

function mergeIndexedObjects(sampleItems, realItems, fields) {
  const mergedItems = [];
  const maxLength = Math.max(
    Array.isArray(sampleItems) ? sampleItems.length : 0,
    Array.isArray(realItems) ? realItems.length : 0,
  );

  for (let index = 0; index < maxLength; index += 1) {
    const sampleItem = sampleItems?.[index] || {};
    const realItem = realItems?.[index] || {};
    const mergedItem = {
      ...sampleItem,
      id: trimText(realItem.id) || trimText(sampleItem.id) || `sample-detail-${index + 1}`,
    };

    fields.forEach((field) => {
      mergedItem[field] = mergePreviewText(realItem[field], sampleItem[field]);
    });

    if (fields.some((field) => trimText(mergedItem[field]))) {
      mergedItems.push(mergedItem);
    }
  }

  return mergedItems;
}

function mergeEducationEntry(sampleEntry, realEntry) {
  return {
    ...sampleEntry,
    isSamplePlaceholderEntry: sampleEntryUsesOnlyPlaceholderText('education', realEntry),
    id: realEntry?.id || sampleEntry.id,
    school: mergePreviewText(realEntry?.school, sampleEntry.school),
    degree: mergePreviewText(realEntry?.degree, sampleEntry.degree),
    yearsEdu: mergePreviewText(realEntry?.yearsEdu, sampleEntry.yearsEdu),
    location: mergePreviewText(realEntry?.location, sampleEntry.location),
    gpa: mergePreviewText(realEntry?.gpa, sampleEntry.gpa),
    honors: mergePreviewText(realEntry?.honors, sampleEntry.honors),
    coursework: mergePreviewText(realEntry?.coursework, sampleEntry.coursework),
    awards: mergePreviewText(realEntry?.awards, sampleEntry.awards),
    programs: mergeIndexedObjects(sampleEntry.programs, realEntry?.programs, ['degree', 'yearsEdu', 'gpa', 'honors']),
    customSections: mergeIndexedObjects(sampleEntry.customSections, realEntry?.customSections, ['label', 'content']),
  };
}

function mergeEntryByKind(kind, sampleEntry, realEntry) {
  if (kind === 'education') {
    return mergeEducationEntry(sampleEntry, realEntry);
  }

  if (kind === 'roles') {
    return {
      ...sampleEntry,
      isSamplePlaceholderEntry: sampleEntryUsesOnlyPlaceholderText(kind, realEntry),
      id: realEntry?.id || sampleEntry.id,
      company: mergePreviewText(realEntry?.company, sampleEntry.company),
      role: mergePreviewText(realEntry?.role, sampleEntry.role),
      location: mergePreviewText(realEntry?.location, sampleEntry.location),
      yearsExp: mergePreviewText(realEntry?.yearsExp, sampleEntry.yearsExp),
      activities: mergePreviewTextList(sampleEntry.activities, realEntry?.activities),
    };
  }

  if (kind === 'skills') {
    return {
      ...sampleEntry,
      isSamplePlaceholderEntry: sampleEntryUsesOnlyPlaceholderText(kind, realEntry),
      id: realEntry?.id || sampleEntry.id,
      category: mergePreviewText(realEntry?.category, sampleEntry.category),
      items: mergePreviewText(realEntry?.items, sampleEntry.items),
    };
  }

  if (kind === 'projects') {
    return {
      ...sampleEntry,
      isSamplePlaceholderEntry: sampleEntryUsesOnlyPlaceholderText(kind, realEntry),
      id: realEntry?.id || sampleEntry.id,
      name: mergePreviewText(realEntry?.name, sampleEntry.name),
      subtitle: mergePreviewText(realEntry?.subtitle, sampleEntry.subtitle),
      years: mergePreviewText(realEntry?.years, sampleEntry.years),
      summary: mergePreviewText(realEntry?.summary, sampleEntry.summary),
      highlights: mergePreviewTextList(sampleEntry.highlights, realEntry?.highlights),
    };
  }

  return {
    ...sampleEntry,
    isSamplePlaceholderEntry: sampleEntryUsesOnlyPlaceholderText(kind, realEntry),
    ...Object.fromEntries(
      Object.keys(sampleEntry || {}).filter((field) => field !== 'isSamplePlaceholderEntry').map((field) => [
        field,
        field === 'id' ? (realEntry?.id || sampleEntry.id) : mergePreviewText(realEntry?.[field], sampleEntry[field]),
      ])
    ),
  };
}

function mergeSampleSection(sampleSection, realSection, preferRealEntryOrder = false) {
  const realEntries = Array.isArray(realSection?.entries) ? realSection.entries : [];
  const realEntryById = new Map(realEntries.map((entry) => [entry.id, entry]));

  if (preferRealEntryOrder) {
    const sampleEntryById = new Map(
      (Array.isArray(sampleSection.entries) ? sampleSection.entries : [])
        .map((entry) => [entry.id, entry])
    );
    const usedSampleIds = new Set();
    const entries = [];

    realEntries.forEach((realEntry) => {
      const sampleEntry = sampleEntryById.get(realEntry.id);

      if (sampleEntry) {
        usedSampleIds.add(sampleEntry.id);
        entries.push(mergeEntryByKind(sampleSection.kind, sampleEntry, realEntry));
        return;
      }

      entries.push(realEntry);
    });

    (Array.isArray(sampleSection.entries) ? sampleSection.entries : []).forEach((sampleEntry) => {
      if (!usedSampleIds.has(sampleEntry.id)) {
        entries.push(mergeEntryByKind(sampleSection.kind, sampleEntry, realEntryById.get(sampleEntry.id)));
      }
    });

    return {
      ...sampleSection,
      title: mergePreviewText(realSection?.title, sampleSection.title),
      entryHeaderLayout: realSection?.entryHeaderLayout || sampleSection.entryHeaderLayout,
      entryOrder: entries.map((entry) => entry.id),
      entries,
    };
  }

  const usedRealIds = new Set();
  const entries = (Array.isArray(sampleSection.entries) ? sampleSection.entries : []).map((sampleEntry) => {
    const realEntry = realEntryById.get(sampleEntry.id);

    if (realEntry?.id) {
      usedRealIds.add(realEntry.id);
    }

    return mergeEntryByKind(sampleSection.kind, sampleEntry, realEntry);
  });

  realEntries.forEach((realEntry) => {
    if (!usedRealIds.has(realEntry.id)) {
      entries.push(realEntry);
    }
  });

  return {
    ...sampleSection,
    title: mergePreviewText(realSection?.title, sampleSection.title),
    entryHeaderLayout: realSection?.entryHeaderLayout || sampleSection.entryHeaderLayout,
    entryOrder: entries.map((entry) => entry.id),
    entries,
  };
}

export function createMixedSamplePreviewModel(resume, resumeId, realPreviewModel = getPreviewModel(resume), orderOverrides = {}, options = {}) {
  const samplePreviewModel = createSamplePreviewModel(resume, resumeId, { hasContent: false }, orderOverrides, options);

  if (!samplePreviewModel) {
    return null;
  }

  const normalizedResume = normalizeResume(resume);
  const realSectionById = new Map(
    (Array.isArray(realPreviewModel?.sectionBlocks) ? realPreviewModel.sectionBlocks : [])
      .map((section) => [section.id, section])
  );
  const sampleSectionById = new Map(samplePreviewModel.sectionBlocks.map((section) => [section.id, section]));
  const mergedPersonal = {
    name: mergePreviewText(realPreviewModel?.personal?.name, samplePreviewModel.personal.name),
    headline: mergePreviewText(realPreviewModel?.personal?.headline, samplePreviewModel.personal.headline),
    location: mergePreviewText(realPreviewModel?.personal?.location, samplePreviewModel.personal.location),
    phone: mergePreviewText(realPreviewModel?.personal?.phone, samplePreviewModel.personal.phone),
    email: mergePreviewText(realPreviewModel?.personal?.email, samplePreviewModel.personal.email),
    linkedinUrl: mergePreviewText(realPreviewModel?.personal?.linkedinUrl, samplePreviewModel.personal.linkedinUrl),
    portfolioUrl: mergePreviewText(realPreviewModel?.personal?.portfolioUrl, samplePreviewModel.personal.portfolioUrl),
    githubUrl: mergePreviewText(realPreviewModel?.personal?.githubUrl, samplePreviewModel.personal.githubUrl),
    customField: mergePreviewText(realPreviewModel?.personal?.customField, samplePreviewModel.personal.customField),
    aboutMe: mergePreviewText(realPreviewModel?.personal?.aboutMe, samplePreviewModel.personal.aboutMe),
  };
  const sectionBlocks = normalizedResume.sections
    .map((section) => {
      const sampleSection = sampleSectionById.get(section.id);
      const realSection = realSectionById.get(section.id);

      if (sampleSection) {
        return mergeSampleSection(
          sampleSection,
          realSection,
          Boolean(normalizedResume.sampleDisplay?.entryBindings?.[section.id]),
        );
      }

      return realSection || null;
    })
    .filter(Boolean);

  return {
    ...samplePreviewModel,
    personal: {
      ...mergedPersonal,
      links: createPersonalLinks(mergedPersonal),
    },
    sectionOrder: sectionBlocks.map((section) => section.id),
    sectionBlocks,
    showPersonal: true,
  };
}

function getRealSampleSection(resume, sectionId) {
  const normalizedResume = normalizeResume(resume);

  return normalizedResume.sections.find((section) => section.id === sectionId) || null;
}

export function getPersistableSampleTextListMove(resume, sectionId, entryId, field, fromIndex, toIndex) {
  const section = getRealSampleSection(resume, sectionId);
  const entry = section?.entries?.find((sectionEntry) => sectionEntry.id === entryId);
  const list = Array.isArray(entry?.[field]) ? entry[field] : [];
  const fromItemIndex = Number(fromIndex);
  const toItemIndex = Number(toIndex);

  if (
    list.filter((item) => trimText(item)).length < 2 ||
    !Number.isInteger(fromItemIndex) ||
    !Number.isInteger(toItemIndex) ||
    fromItemIndex < 0 ||
    toItemIndex < 0 ||
    fromItemIndex >= list.length ||
    toItemIndex >= list.length ||
    !trimText(list[fromItemIndex]) ||
    !trimText(list[toItemIndex]) ||
    fromItemIndex === toItemIndex
  ) {
    return null;
  }

  return {
    fromIndex: fromItemIndex,
    toIndex: toItemIndex,
  };
}

function toPlaceholderText(value) {
  if (typeof value === 'string') {
    return trimText(value);
  }

  if (value && typeof value === 'object' && typeof value.text === 'string') {
    return trimText(value.text);
  }

  return '';
}

function readPlaceholderValue(candidate, pathParts) {
  let current = candidate;

  for (const pathPart of pathParts) {
    if (current === null || current === undefined) {
      return '';
    }

    if (Array.isArray(current)) {
      const itemIndex = Number(pathPart);

      if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= current.length) {
        return '';
      }

      current = current[itemIndex];
      continue;
    }

    current = current[pathPart];
  }

  return toPlaceholderText(current);
}

export function createSamplePlaceholderResolver(resume, samplePreviewModel) {
  if (!samplePreviewModel?.isSamplePreview) {
    return (_path, fallback = '') => fallback;
  }

  const normalizedResume = normalizeResume(resume);
  const realSectionById = new Map(normalizedResume.sections.map((section) => [section.id, section]));
  const sampleSectionById = new Map(
    (Array.isArray(samplePreviewModel.sectionBlocks) ? samplePreviewModel.sectionBlocks : [])
      .map((section) => [section.id, section])
  );

  return (path, fallback = '') => {
    const fallbackText = typeof fallback === 'string' ? fallback : '';

    if (typeof path !== 'string' || !path) {
      return fallbackText;
    }

    const pathParts = path.split('.');

    if (pathParts[0] === 'personal') {
      const personalValue = readPlaceholderValue(samplePreviewModel.personal, pathParts.slice(1));
      return personalValue || fallbackText;
    }

    if (pathParts[0] !== 'sections' || pathParts.length < 3) {
      return fallbackText;
    }

    const [, sectionId, entryIdOrTitle, ...entryPathParts] = pathParts;
    const sampleSection = sampleSectionById.get(sectionId);

    if (!sampleSection) {
      return fallbackText;
    }

    if (entryIdOrTitle === '__title') {
      return toPlaceholderText(sampleSection.title) || fallbackText;
    }

    const sampleEntries = Array.isArray(sampleSection.entries) ? sampleSection.entries : [];
    const exactSampleEntry = sampleEntries.find((entry) => entry.id === entryIdOrTitle);
    const realSection = realSectionById.get(sectionId);
    const realEntryIndex = Array.isArray(realSection?.entries)
      ? realSection.entries.findIndex((entry) => entry.id === entryIdOrTitle)
      : -1;
    const sampleEntry = exactSampleEntry || (realEntryIndex >= 0 ? sampleEntries[realEntryIndex] : null);
    const entryValue = readPlaceholderValue(sampleEntry, entryPathParts);

    return entryValue || fallbackText;
  };
}

import {
  getPreviewModel,
  normalizeResume,
  trimText,
} from './resume.js';

const SAMPLE_NOTICE = 'Sample resume - disappears when you start editing.';

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
      aboutMe: 'Entrepreneur with a proven track record of identifying genius, housing genius, monetizing proximity to genius, and then explaining that genius to investors in words they can understand.',
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
        yearsExp: 'San Francisco, CA | 2018-2020',
        activities: [
          'Built and exited Aviato, an airfare-collation startup so culturally important that I never stopped wearing the shirt.',
          'Leveraged successful liquidity event into an elite founder residence and innovation incubator.',
          'Established myself as a top-quartile visionary in the very specific field of talking about having once founded Aviato.',
        ],
      },
      {
        company: 'Pied Piper',
        role: 'Board Member / 10% Stakeholder',
        yearsExp: 'Palo Alto, CA | 2020-2022',
        activities: [
          'Secured an ownership position in one of the most important compression startups of its era.',
          'Provided executive-level messaging, founder packaging, and high-friction but occasionally useful strategic input.',
          'Acted as the external-facing adult in the room despite rarely being the actual adult in the room.',
        ],
      },
      {
        company: 'Hacker Hostel',
        role: 'Founder / Resident Mentor',
        yearsExp: '5230 Newell Road, Palo Alto, CA',
        activities: [
          'Converted residential square footage into a startup incubator for Richard Hendricks, Dinesh Chugtai, Bertram Gilfoyle, and other high-upside tenants.',
          'Exchanged shelter, workspace, and unsolicited wisdom for founder proximity and equity-adjacent influence.',
        ],
      },
      {
        company: 'Bachmanity Capital',
        role: 'Co-Founder / General Partner',
        yearsExp: 'Palo Alto, CA | 2016',
        activities: [
          'Launched a venture identity with Nelson Bighetti after identifying an unusually liquid partner and a very loud brand opportunity.',
          'Managed investor optics, partnership energy, and launch-party ambition until the operating model became mostly theoretical.',
        ],
      },
    ],
    projects: {
      name: 'Aviato Brand System',
      years: 'Post-exit',
      summary: 'Kept Aviato culturally alive through logo discipline, T-shirt consistency, and a branded Ford Escape that made the exit impossible to forget.',
      highlights: ['Converted one acquisition story into a durable personal mythology for every investor meeting afterward.'],
    },
    skills: {
      category: 'Startup Theater',
      items: 'Demo-day posture, Selective delegation, Hoodie-and-logo brand systems, Handling the business side, Founder housing, Equity conversations',
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
      aboutMe: 'People-first paper executive focused on sales, branch morale, client lunches, and making every workday feel like a mandatory optional party.',
    },
    education: {
      school: 'Dunder Mifflin Scranton Sales Floor',
      location: 'Scranton, PA',
      degree: 'Sales Representative Development',
      yearsEdu: 'Pre-management',
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
        yearsExp: 'Scranton, PA | 2005-2011',
        activities: [
          'Led the Scranton branch through paper sales, merger scares, Sabre transition, and unusually high meeting density.',
          'Protected client loyalty through personal attention, local charm, and negotiation tactics that occasionally worked exactly as planned.',
          'Maintained branch morale with awards ceremonies, birthdays, movie projects, and emergency conference-room programming.',
        ],
      },
      {
        company: 'Michael Scott Paper Company',
        role: 'Founder / CEO',
        yearsExp: 'Scranton, PA | 2009',
        activities: [
          'Built a breakaway paper company with Pam Beesly and Ryan Howard after leaving Dunder Mifflin on principle and impulse.',
          'Acquired customers quickly enough to force a buyout conversation with Dunder Mifflin despite deeply questionable pricing.',
        ],
      },
      {
        company: 'Dunder Mifflin Paper Company',
        role: 'Sales Representative',
        yearsExp: 'Scranton, PA | Early career',
        activities: [
          'Won top-sales recognition through relationship-heavy account management and fearless lunch meetings.',
          'Built the client base and branch reputation that eventually made regional management feel inevitable.',
        ],
      },
      {
        company: 'Colorado Family Office',
        role: 'Husband / Full-Time Dad Aspirant',
        yearsExp: 'Boulder, CO | Post-Scranton',
        activities: [
          'Relocated with Holly Flax to build the large family and friendship-heavy personal culture he had been describing for years.',
          'Transferred branch-management instincts into domestic operations, photo-card production, and extreme pride in children.',
        ],
      },
    ],
    projects: {
      name: 'Threat Level Midnight',
      years: 'Long-term side project',
      summary: 'Produced, wrote, directed, and starred in a full-scale office-backed action film with deep internal casting.',
      highlights: ["Converted years of workplace goodwill into one of Scranton business culture's most committed creative productions."],
    },
    skills: {
      category: 'Management',
      items: 'Paper sales, Client retention, Conference room facilitation, Morale events, Public speaking, Improv-based leadership',
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
      aboutMe: 'Strategic ruler with experience building coalitions, commanding dragons, and converting impossible succession claims into operational plans.',
    },
    education: {
      school: 'House Targaryen',
      location: 'Dragonstone',
      degree: 'Dynastic Leadership & Exile Survival',
      yearsEdu: 'Early reign',
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
        yearsExp: 'Essos | Rule of Meereen',
        activities: [
          "Governed a liberated city while managing noble resistance, freedmen's needs, trade disruption, and council politics.",
          'Negotiated military, diplomatic, and symbolic power around Unsullied forces, sellsword alliances, and dragon deterrence.',
          'Left Daario Naharis and the Second Sons to maintain peace before sailing west.',
        ],
      },
      {
        company: "Slaver's Bay Campaign",
        role: 'Breaker of Chains',
        yearsExp: 'Astapor, Yunkai, Meereen',
        activities: [
          'Turned a purchased Unsullied army into a liberation force and dismantled slaveholding power across multiple cities.',
          'Built loyalty through visible justice, personal conviction, and the very difficult-to-ignore presence of dragons.',
        ],
      },
      {
        company: 'Dothraki Sea',
        role: 'Khaleesi',
        yearsExp: 'Great Grass Sea',
        activities: [
          'Earned allegiance across a khalasar while adapting from exiled princess to command figure.',
          'Used cultural fluency, resilience, and fireproof optics to consolidate authority after Khal Drogo.',
        ],
      },
      {
        company: 'Dragonstone War Council',
        role: 'Queen / Westeros Claimant',
        yearsExp: 'Dragonstone | Westeros campaign',
        activities: [
          'Established a western command base with Tyrion Lannister, Varys, Missandei, Grey Worm, and allied houses advising the claim.',
          'Balanced naval alliances, northern diplomacy, and dragon-backed deterrence while preparing to contest the Iron Throne.',
        ],
      },
    ],
    projects: {
      name: 'Return to Dragonstone',
      years: 'Westeros Campaign',
      summary: 'Assembled ships, advisors, Unsullied, Dothraki, and dragons into a cross-continental claim to the Iron Throne.',
      highlights: ['Named Tyrion Lannister Hand of the Queen before launching a westbound campaign.'],
    },
    skills: {
      category: 'Leadership',
      items: 'Coalition building, Dragon operations, Crisis command, Symbolic messaging, Multilingual diplomacy, Liberation strategy',
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
      aboutMe: 'Customer-facing restaurant professional and serious artist seeking quiet, structure, and a workplace with fewer spontaneous nautical interruptions.',
    },
    education: {
      school: 'Bikini Bottom Community Arts',
      location: 'Bikini Bottom',
      degree: 'Independent Study in Clarinet & Self-Portraiture',
      yearsEdu: 'Continuing',
      coursework: 'Modern Art, Solo Performance, Advanced Neighbor Avoidance, Interpretive Sighing',
    },
    experiences: [
      {
        company: 'The Krusty Krab',
        role: 'Cashier',
        yearsExp: 'Bikini Bottom | Long-term',
        activities: [
          'Processed high-volume Krabby Patty orders while maintaining a clearly communicated emotional boundary.',
          'Managed front-counter traffic with SpongeBob SquarePants nearby, which is a measurable resilience credential.',
          'Preserved register operations through customer complaints, maritime chaos, and recurring workplace songs.',
        ],
      },
      {
        company: 'Moai House Studio',
        role: 'Clarinetist / Visual Artist',
        yearsExp: 'Bikini Bottom | After hours',
        activities: [
          'Developed clarinet recitals, self-portraiture, interpretive dance, and sculpture for audiences not yet prepared for the material.',
          'Maintained a rigorous creative practice despite hostile acoustics and unsolicited neighbor feedback.',
        ],
      },
      {
        company: 'Bikini Bottom Band',
        role: 'Band Leader',
        yearsExp: 'Bubble Bowl preparation',
        activities: [
          'Organized an emergency ensemble into a performance-ready marching band under severe interpersonal constraints.',
          'Demonstrated rare team leadership when the final performance somehow exceeded every reasonable expectation.',
        ],
      },
      {
        company: 'Krusty Krab Operations',
        role: 'Acting Manager',
        yearsExp: 'Bikini Bottom | Temporary coverage',
        activities: [
          'Covered supervisory responsibilities when Mr. Krabs delegated operations, usually while wishing the delegation had gone elsewhere.',
          'Maintained standards around counter service, customer volume, and workplace noise with visible emotional transparency.',
        ],
      },
    ],
    projects: {
      name: 'Bold and Brash Portfolio',
      years: 'Ongoing',
      summary: 'Built a distinctive fine-art body of work centered on self-portraiture, confidence, and misunderstood genius.',
      highlights: ['Kept producing even when critics failed to recognize museum-level sophistication.'],
    },
    skills: {
      category: 'Creative Operations',
      items: 'Cash register accuracy, Clarinet, Oil painting, Band leadership, Complaint endurance, Quiet-space advocacy',
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
      aboutMe: 'Disciplined sales professional with parallel expertise in paper, beet agriculture, bed-and-breakfast operations, and threat readiness.',
    },
    education: {
      school: 'Schrute Family Training',
      location: 'Honesdale, PA',
      degree: 'Applied Beet Agriculture & Authority Studies',
      yearsEdu: 'Lifetime',
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
        yearsExp: 'Scranton, PA | 2005-2013',
        activities: [
          'Generated elite paper sales through discipline, client memory, aggressive follow-through, and total belief in paper.',
          'Supported branch operations with security drills, loyalty checks, emergency protocols, and structured authority.',
          'Converted temporary leadership opportunities into proof that Regional Manager was always the correct destiny.',
        ],
      },
      {
        company: 'Schrute Farms',
        role: 'Owner / Beet Farmer / Bed-and-Breakfast Proprietor',
        yearsExp: 'Honesdale, PA | Family farm',
        activities: [
          'Operated beet production and rustic lodging with Mose Schrute, strict rules, and guest experiences no algorithm could replicate.',
          'Balanced crop planning, agri-tourism, table-making, and wedding logistics on a working family property.',
        ],
      },
      {
        company: "Lackawanna County Sheriff's Department",
        role: 'Volunteer Sheriff Deputy',
        yearsExp: 'Lackawanna County, PA | Volunteer service',
        activities: [
          'Applied surveillance, preparedness, and procedural enthusiasm to public-safety-adjacent responsibilities.',
          'Stepped away after a drug-testing incident, then retained the mindset of a deputy indefinitely.',
        ],
      },
      {
        company: 'Scranton Business Park',
        role: 'Co-Owner / Property Operator',
        yearsExp: 'Scranton, PA | Business park era',
        activities: [
          'Managed property interests around the office park where Dunder Mifflin operated, expanding authority beyond paper sales.',
          'Balanced tenant expectations, building logistics, and the strategic advantage of owning part of the workplace ecosystem.',
        ],
      },
    ],
    projects: {
      name: 'Schrute Farms',
      years: 'Honesdale, PA',
      summary: 'Operated beet farm and agri-tourism lodging with rustic authenticity and strict house rules.',
      highlights: ['Balanced crop production, guest experience, and cousin-based labor coordination.'],
    },
    skills: {
      category: 'Operations',
      items: 'Paper sales, Beet farming, Emergency preparedness, Surveillance awareness, Karate, Rule enforcement',
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
      aboutMe: 'Fast-moving detective with strong instincts, partnership skills, and an unusually high conversion rate from chaos to solved cases.',
    },
    education: {
      school: 'NYPD Police Academy',
      location: 'New York, NY',
      degree: 'Detective Track',
      yearsEdu: 'Pre-99th',
      coursework: 'Investigations, Interrogation, Tactical Banter, Evidence Handling, Partner Communication',
    },
    experiences: [
      {
        company: 'NYPD 99th Precinct',
        role: 'Detective',
        yearsExp: 'Brooklyn, NY | 2013-2021',
        activities: [
          'Solved complex cases through instinct, teamwork, persistence, and occasional movie-based reasoning.',
          'Built strong partnerships across the squad while learning to respect forms, binders, and calendars.',
          'Balanced high arrest productivity with ongoing professional development under Captain Raymond Holt.',
        ],
      },
      {
        company: 'NYPD 99th Precinct',
        role: 'Halloween Heist Operations Lead',
        yearsExp: 'Brooklyn, NY | Annual operation',
        activities: [
          'Designed elaborate competitive operations requiring misdirection, timing, alliance management, and extreme confidence.',
          'Converted office rivalry into a repeatable team-building program with surprisingly advanced logistics.',
        ],
      },
      {
        company: 'NYPD Task Work',
        role: 'Undercover Detective',
        yearsExp: 'New York, NY | Special assignments',
        activities: [
          'Handled undercover and high-pressure assignments while maintaining case focus and partner trust.',
          'Recovered from impulsive plans by listening to the squad, which eventually became a leadership skill.',
        ],
      },
      {
        company: 'Jake & Amy Case Partnership',
        role: 'Detective Partner / Co-Lead',
        yearsExp: 'Brooklyn, NY | 99th squad',
        activities: [
          'Turned competitive case energy with Amy Santiago into a high-trust investigative partnership and eventually a functioning marriage.',
          'Learned to combine instinct with preparation, which was annoying at first and then objectively useful.',
        ],
      },
    ],
    projects: {
      name: 'Annual Precinct Heist Strategy',
      years: 'Recurring',
      summary: 'Designed elaborate competitive operations requiring misdirection, timing, and extreme confidence.',
      highlights: ['Improved cross-functional deception skills without permanently damaging squad morale.'],
    },
    skills: {
      category: 'Detective Work',
      items: 'Case closure, Witness interviews, Undercover work, Teamwork, Interrogation, References under pressure',
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
      aboutMe: 'High-visibility attorney helping clients navigate complicated situations with speed, persuasion, and unforgettable advertising.',
    },
    education: {
      school: 'University of American Samoa',
      location: 'Remote',
      degree: 'Juris Doctor',
      yearsEdu: 'Pre-practice',
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
        yearsExp: 'Albuquerque, NM | Breaking Bad era',
        activities: [
          'Built a recognizable legal brand serving clients with urgent problems, limited patience, and complex factual histories.',
          'Converted late-night advertising, office traffic, and referral networks into steady case volume.',
          'Handled plea conversations, courtroom appearances, and crisis calls with high-speed persuasion.',
        ],
      },
      {
        company: 'Jimmy McGill Law Practice',
        role: 'Elder Law / Solo Practitioner',
        yearsExp: 'Albuquerque, NM | Better Call Saul era',
        activities: [
          'Built a client base through senior-center outreach, wills, Sandpiper research, and unusually persistent follow-up.',
          'Translated underdog instincts into legitimate legal work before the advertising budget became louder.',
        ],
      },
      {
        company: 'Hamlin, Hamlin & McGill',
        role: 'Mailroom Clerk / Aspiring Attorney',
        yearsExp: 'Albuquerque, NM | Early career',
        activities: [
          'Worked the HHM mailroom while completing law coursework and learning firm politics from the basement up.',
          'Built relationships with Kim Wexler and the legal staff while preparing for a second act.',
        ],
      },
      {
        company: 'CC Mobile',
        role: 'Cell Phone Store Manager / Salesman',
        yearsExp: 'Albuquerque, NM | License suspension era',
        activities: [
          'Converted low foot traffic into creative prepaid-phone sales through persona work, street-level marketing, and customer psychology.',
          'Used the store as a proving ground for the louder brand voice that eventually became Saul Goodman.',
        ],
      },
    ],
    projects: {
      name: 'Rapid Response Legal Marketing',
      years: 'Always on',
      summary: 'Produced memorable campaigns that made legal services feel immediate, accessible, and loud.',
      highlights: ['Turned name recognition into client trust before the first consultation.'],
    },
    skills: {
      category: 'Legal Hustle',
      items: 'Criminal defense, Negotiation, Client intake, Advertising, Courtroom improvisation, Underdog advocacy',
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
      aboutMe: 'Engineer-founder applying extreme technical ambition to energy systems, autonomous hardware, and high-altitude problem solving.',
    },
    education: {
      school: 'Massachusetts Institute of Technology',
      location: 'Cambridge, MA',
      degree: 'Advanced Engineering Studies, summa cum laude',
      yearsEdu: 'Graduated at 17',
      coursework: 'Robotics, Energy Systems, Applied Materials, AI-Assisted Design',
    },
    experiences: [
      {
        company: 'Stark Industries',
        role: 'CEO / Chief Inventor',
        yearsExp: 'Malibu / New York, NY | Post-inheritance',
        activities: [
          'Led advanced technology development across clean energy, defense systems, autonomous platforms, and impossible prototypes.',
          'Pivoted the company away from weapons manufacturing after Afghanistan and toward energy, rescue, and high-impact engineering.',
          'Built rapid prototype cycles capable of moving from cave constraints to global-scale deployment.',
        ],
      },
      {
        company: 'Avengers Initiative',
        role: 'Founding Member / Armored Systems Lead',
        yearsExp: 'Global | Avengers era',
        activities: [
          'Integrated armor, AI support, flight systems, and repulsor technology into field operations against planetary-scale threats.',
          'Worked with very strong, very magical, and very patriotic colleagues while still making the hardware look good.',
        ],
      },
      {
        company: 'Stark Relief Foundation',
        role: 'Benefactor / Technology Sponsor',
        yearsExp: 'Post-New York response',
        activities: [
          'Funded repair, recovery, and public-facing support after high-visibility superhero incidents.',
          'Balanced philanthropy, guilt management, and engineering optimism into a recognizable civic program.',
        ],
      },
      {
        company: 'Department of Damage Control',
        role: 'Co-Founder / Technology Partner',
        yearsExp: 'New York, NY | Post-Battle of New York',
        activities: [
          'Helped formalize cleanup and containment around alien technology after the Battle of New York changed the risk profile of debris.',
          'Translated superhero collateral damage into a public-private recovery workflow with very expensive equipment.',
        ],
      },
    ],
    projects: {
      name: 'Arc Reactor & Iron Man Platform',
      years: 'Ongoing',
      summary: 'Created compact energy and armored flight systems for personal and planetary risk management.',
      highlights: ['Integrated propulsion, materials, AI assistance, and brand presence into one platform.'],
    },
    skills: {
      category: 'Engineering',
      items: 'Robotics, Clean energy, Armor systems, AI-assisted design, Rapid prototyping, Crisis engineering',
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

export function getSampleResumeForId(resumeId) {
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
  return trimText(section?.entries?.[0]?.id) || `${section.id}-sample-entry`;
}

function sampleEntryId(section, index) {
  if (index === 0) {
    return firstEntryId(section);
  }

  return `${section.id}-sample-entry-${index + 1}`;
}

function createSampleEducationEntry(section, sample) {
  const entryId = firstEntryId(section);

  return {
    id: entryId,
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

function createSampleRoleEntries(section, sample, orderOverrides) {
  const entries = sampleExperiences(sample).map((experience, index) => {
    const entryId = sampleEntryId(section, index);

    return {
      id: entryId,
      company: experience.company,
      role: experience.role,
      yearsExp: experience.yearsExp,
      activities: toSamplePreviewTextList(experience.activities, orderOverrides?.[`${section.id}.${entryId}.activities`]),
    };
  });

  return applySampleEntryOrder(entries, orderOverrides?.[`${section.id}.entries`]);
}

function createSampleProjectEntry(section, sample, orderOverrides) {
  const entryId = firstEntryId(section);

  return {
    id: entryId,
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
    category: sample.skills.category,
    items: sample.skills.items,
  };
}

function createSampleBlock(section, sample, orderOverrides) {
  if (section.kind === 'education') {
    return {
      id: section.id,
      kind: section.kind,
      title: section.title || 'Education',
      entryOrder: [firstEntryId(section)],
      entries: [createSampleEducationEntry(section, sample)],
    };
  }

  if (section.kind === 'roles' && /experience|work|career/i.test(`${section.id} ${section.title}`)) {
    const entries = createSampleRoleEntries(section, sample, orderOverrides);

    return {
      id: section.id,
      kind: section.kind,
      title: section.title || 'Experience',
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

export function createSamplePreviewModel(resume, resumeId, realPreviewModel = getPreviewModel(resume), orderOverrides = {}) {
  if (realPreviewModel?.hasContent) {
    return null;
  }

  const normalizedResume = normalizeResume(resume);
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
    .map((section) => createSampleBlock(section, sample, orderOverrides))
    .filter(Boolean);

  return {
    hasContent: true,
    isSamplePreview: true,
    sampleId: sample.id,
    sampleNotice: SAMPLE_NOTICE,
    personal: {
      ...personal,
      links,
    },
    sectionOrder: sectionBlocks.map((section) => section.id),
    sectionBlocks,
    showPersonal: true,
  };
}

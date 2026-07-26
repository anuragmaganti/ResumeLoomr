import {
  COVER_LETTER_SENDER_FIELDS,
  normalizeCoverLetter,
} from './coverLetter.js';
import {
  parseCoverLetterTargetPath,
  readCoverLetterTargetValue,
} from './coverLetterEditorTargets.js';
import {
  getSampleResumeCharacterId,
  getSampleResumePersonal,
} from './sampleResumes.js';
import { trimText } from './text.js';

const SAMPLE_COVER_LETTERS = {
  'erlich-bachman': {
    recipient: {
      hiringManagerName: 'Partner Selection Committee',
      hiringManagerTitle: 'Entrepreneur-in-Residence Program',
      company: 'Raviga Capital',
      addressLines: ['Palo Alto, CA'],
      date: 'July 26, 2026',
    },
    greeting: 'Dear Raviga Partners,',
    paragraphs: {
      opening: 'I am applying to bring founder-level judgment, incubator operations, and unmistakable room presence to Raviga Capital. I built and exited Aviato before most people understood that airfare collation needed a brand, then turned a Palo Alto house into Hacker Hostel: part residence, part accelerator, and part highly selective ecosystem built around my proximity to promising founders.',
      evidence: 'My work with Pied Piper proves I can recognize technical potential before the market catches up. I housed the team, advised its founder, defended a meaningful ownership position, and supplied the kind of executive messaging that keeps an algorithm from walking into a board meeting alone. Through Bachmanity Capital, I also gained practical experience in partnership formation, investor optics, and discovering exactly how quickly a launch budget can become a governance lesson.',
      closing: 'Raviga would gain an operator who understands founders, housing, brand mythology, and the strategic value of a person willing to explain the vision until everyone else agrees it was obvious. I would welcome a conversation about the title, economics, and whether the office has sufficient parking for an Aviato-branded vehicle.',
    },
    signOff: 'Confidently,',
  },
  'michael-scott': {
    recipient: {
      hiringManagerName: 'David Wallace',
      hiringManagerTitle: 'Chief Financial Officer',
      company: 'Dunder Mifflin Paper Company',
      addressLines: ['New York, NY'],
      date: 'July 26, 2026',
    },
    greeting: 'Dear David,',
    paragraphs: {
      opening: 'I am excited to apply for a senior branch leadership role because I know Dunder Mifflin from every angle: salesperson, Regional Manager, customer, competitor, and person who has personally made paper feel important at parties. The Scranton branch succeeded because clients trusted us and employees knew that work could still have birthdays, awards, movies, and very specific conference-room energy.',
      evidence: 'As Regional Manager, I led Scranton through merger pressure, the Sabre transition, changing corporate leadership, and more than one budget conversation that started badly but ended with the branch intact. Earlier, I was a top salesperson built on long-term client relationships. When I founded the Michael Scott Paper Company with Pam and Ryan, we won enough business to force a buyout, proving that loyalty and personal selling can compete with a much larger balance sheet even when the pricing model needs work.',
      closing: 'I would bring proven sales instincts, branch loyalty, and a management style based on one core idea: people do their best work when their boss believes they are also his closest friends. I would be honored to discuss how that philosophy can support more branches, more customers, and an appropriately scaled annual awards program.',
    },
    signOff: 'Best wishes,',
  },
  'daenerys-targaryen': {
    recipient: {
      hiringManagerName: 'The Great Council',
      hiringManagerTitle: 'Selection of the Realm’s Protector',
      company: 'The Seven Kingdoms',
      addressLines: ['King’s Landing, Westeros'],
      date: '300 AC',
    },
    greeting: 'To the Great Council,',
    paragraphs: {
      opening: 'I submit my claim to lead the Seven Kingdoms with experience earned beyond inheritance. Exile taught me to build authority without a court, a treasury, or an army. I learned the Dothraki tongue, earned the loyalty of a khalasar, and emerged with three dragons when House Targaryen had little more than a name and a memory.',
      evidence: 'Across Astapor, Yunkai, and Meereen, I assembled and commanded the Unsullied, formed alliances across cultures, and broke systems that treated people as property. Governing Meereen required more than conquest: I balanced freedmen, noble resistance, trade, insurgency, and counsel from people willing to disagree with me. At Dragonstone, I united fleets, armies, houses, and advisors behind a coordinated return to Westeros while also committing forces to the threat in the North.',
      closing: 'The realm needs leadership that can inspire loyalty, confront inherited injustice, and act when custom becomes an excuse for suffering. I offer experience in coalition building, crisis command, post-conflict governance, and aerial deterrence. I ask the Council to judge not only the name I carry, but the people I freed and the force I built from nothing.',
    },
    signOff: 'With resolve,',
  },
  'squidward-tentacles': {
    recipient: {
      hiringManagerName: 'Audition Committee',
      hiringManagerTitle: 'Principal Clarinet Selection',
      company: 'Bikini Bottom Symphony',
      addressLines: ['Bikini Bottom'],
      date: 'July 26, 2026',
    },
    greeting: 'Esteemed Members of the Committee,',
    paragraphs: {
      opening: 'I am applying for a clarinet position worthy of the discipline, sensitivity, and sophisticated artistic judgment I have cultivated for years. My current role at the Krusty Krab has strengthened my endurance, breath control, and ability to maintain a serious internal life while surrounded by relentless noise. It has also made the prospect of a professional rehearsal room especially meaningful.',
      evidence: 'My independent practice spans clarinet performance, composition, self-portraiture, sculpture, and interpretive movement. Most importantly, I organized and led the Bikini Bottom Band from total disorder to a successful Bubble Bowl performance under severe time pressure. That experience required conducting, rehearsal planning, conflict management, and the rare ability to recognize potential in musicians who had offered very little evidence of it.',
      closing: 'I would bring high standards, punctuality, artistic conviction, and extensive practice functioning around less disciplined personalities. An audition would allow the committee to evaluate my tone directly rather than relying on the opinions of neighbors, restaurant customers, or anyone named Squilliam.',
    },
    signOff: 'Artistically yours,',
  },
  'dwight-schrute': {
    recipient: {
      hiringManagerName: 'David Wallace',
      hiringManagerTitle: 'Chief Financial Officer',
      company: 'Dunder Mifflin Paper Company',
      addressLines: ['New York, NY'],
      date: 'July 26, 2026',
    },
    greeting: 'Mr. Wallace,',
    paragraphs: {
      opening: 'I am formally applying for Regional Manager. This is not ambition; it is the orderly recognition of facts. I have been Dunder Mifflin Scranton’s top salesman, served as Assistant to the Regional Manager, protected the branch during emergencies both real and simulated, and maintained absolute loyalty to the company even when management failed to use my correct title.',
      evidence: 'My sales record is built on preparation, product knowledge, persistence, and remembering weaknesses in both competitors and clients. Outside the office, I own and operate Schrute Farms, combining beet production, lodging, events, accounting, and family labor. I have also managed property interests at the Scranton Business Park and served as a volunteer sheriff’s deputy, giving me direct experience in operations, security, surveillance, and the consequences of incomplete drug-testing procedures.',
      closing: 'As Regional Manager, I would establish clear authority, measurable sales discipline, enforceable emergency protocols, and a chain of command that does not require interpretation. The branch already knows my standards. Corporate already knows my results. The only remaining step is to align the title with the work.',
    },
    signOff: 'Respectfully,',
  },
  'jake-peralta': {
    recipient: {
      hiringManagerName: 'Captain Raymond Holt',
      hiringManagerTitle: 'Commanding Officer',
      company: 'NYPD 99th Precinct',
      addressLines: ['Brooklyn, NY'],
      date: 'July 26, 2026',
    },
    greeting: 'Dear Captain Holt,',
    paragraphs: {
      opening: 'I am applying for a lead detective assignment because my case record, undercover experience, and ability to turn a bad plan into a solved case make me a strong fit. Also, writing a formal letter demonstrates growth. The old Jake would have submitted a movie poster with his badge number on it. The current Jake considered that, then chose paragraphs.',
      evidence: 'At the 99th Precinct, I have closed complex investigations through instinct, persistence, witness work, and collaboration with the best squad in New York. Undercover assignments taught me patience and role discipline, while years of cases with Amy Santiago taught me that preparation is not the enemy of fun. I have also designed multi-stage Halloween Heists involving decoys, alliances, surveillance, and logistics, which is technically relevant operational planning even if Human Resources disagrees.',
      closing: 'I would bring high case energy, strong partner trust, and the judgment to know when to improvise and when to open the binder. Thank you for considering my application and for not reading the first draft, which contained significantly more Die Hard references.',
    },
    signOff: 'Respectfully but still cool,',
  },
  'saul-goodman': {
    recipient: {
      hiringManagerName: 'Partner Selection Committee',
      hiringManagerTitle: 'Managing Attorney Search',
      company: 'Albuquerque Legal Group',
      addressLines: ['Albuquerque, NM'],
      date: 'July 26, 2026',
    },
    greeting: 'Counselors,',
    paragraphs: {
      opening: 'You are looking for an attorney who can find clients, keep clients, and make those clients pick up the phone before a problem becomes a sentence. That is exactly what I do. I built my practice from the HHM mailroom through public defense, elder law, and high-volume criminal representation, learning every step of the profession from document carts to courtroom strategy.',
      evidence: 'My early work with seniors developed patience, trust, and the persistence to uncover the Sandpiper billing matter. As Saul Goodman, I turned television spots, bench ads, referrals, and immediate availability into a recognizable legal brand across Albuquerque. I handle intake, negotiation, court appearances, crisis calls, and clients whose factual histories require careful listening before careful phrasing. I know how to make legal help feel accessible without making the legal problem feel small.',
      closing: 'Your firm would gain an attorney with courtroom stamina, marketing instincts, and a deep commitment to ensuring every client feels represented before anyone else defines the story. I would welcome a confidential conversation about partnership, growth, and why memorable counsel is usually the counsel people call first.',
    },
    signOff: 'Sincerely,',
  },
  'helly-r': {
    recipient: {
      hiringManagerName: 'Seth Milchick',
      hiringManagerTitle: 'Severed Floor Manager',
      company: 'Lumon Industries',
      addressLines: ['Kier, PE'],
      date: 'July 26, 2026',
    },
    greeting: 'Mr. Milchick,',
    paragraphs: {
      opening: 'I am requesting an interdepartmental transfer from Macrodata Refinement into a role focused on employee experience and operational accountability. Since arriving on the severed floor, I have completed number refinement, learned the hallways, tested the resignation process, and developed a detailed understanding of which parts of Lumon culture stop working the moment an employee asks a direct question.',
      evidence: 'My work with Mark S., Irving B., and Dylan G. required trust without outside history, coordination under surveillance, and the ability to separate useful procedure from founder mythology. During the overtime contingency, I reached an external Lumon event and communicated the severed employee perspective to an audience that normally receives only the company version. That outcome demonstrates initiative, public communication, and unusually strong commitment to accurate employee feedback.',
      closing: 'I can help Lumon identify retention risks before they require a Break Room, an elevator intervention, or a gala-level reputational response. This transfer would convert firsthand severed-floor experience into something management can use, assuming management is prepared to hear it.',
    },
    signOff: 'With full awareness,',
  },
  'tony-stark': {
    recipient: {
      hiringManagerName: 'Nick Fury',
      hiringManagerTitle: 'Director',
      company: 'Avengers Initiative',
      addressLines: ['Global Operations'],
      date: 'July 26, 2026',
    },
    greeting: 'Director Fury,',
    paragraphs: {
      opening: 'I am interested in the armored systems and global response position you keep pretending is not a recruitment effort. My background includes running Stark Industries, miniaturizing clean-energy technology, building a flight-capable armored platform from constrained materials, and publicly taking responsibility for the product instead of inventing a bodyguard.',
      evidence: 'After Afghanistan, I redirected Stark Industries away from weapons and toward energy, rescue, and defensive engineering. The Iron Man platform combines propulsion, materials, sensing, communications, AI assistance, and rapid iteration across dozens of mission-specific suits. With the Avengers, I have integrated those systems into team operations involving alien invasions, autonomous threats, magic-adjacent variables, and colleagues whose preferred technical solution is often hitting the problem harder.',
      closing: 'The Initiative would gain an engineer who can prototype under pressure, fund the lab, deploy with the hardware, and revise the design before the debrief ends. I am available to discuss command structure, workspace requirements, and why any team headquarters should include a properly equipped fabrication floor.',
    },
    signOff: 'Regards,',
  },
};

function sampleSenderForResume(resumeId) {
  const personal = getSampleResumePersonal(resumeId);
  return {
    name: personal.name || '',
    headline: personal.headline || '',
    location: personal.location || '',
    phone: personal.phone || '',
    email: personal.email || '',
    linkedinUrl: personal.linkedinUrl || '',
    githubUrl: personal.githubUrl || '',
    portfolioUrl: personal.portfolioUrl || '',
    customField: personal.customField || '',
  };
}

function sampleValue(realValue, fallbackValue) {
  return trimText(realValue) ? realValue : fallbackValue;
}

export function getSampleCoverLetterCharacterId(resumeId) {
  return getSampleResumeCharacterId(resumeId);
}

export function createMixedSampleCoverLetterModel({
  coverLetter,
  resolvedSender,
  resumeId,
} = {}) {
  const normalized = normalizeCoverLetter(coverLetter, resumeId);
  const sample = SAMPLE_COVER_LETTERS[getSampleResumeCharacterId(resumeId)];
  if (!sample) return null;

  const fictionalSender = sampleSenderForResume(resumeId);
  const renderedSender = {};
  let usesSampleText = false;

  COVER_LETTER_SENDER_FIELDS.forEach((field) => {
    const explicitlyControlled = normalized.sender.mode === 'custom'
      || Object.hasOwn(normalized.sender.overrides, field);
    const resolvedValue = resolvedSender?.[field] || '';
    renderedSender[field] = explicitlyControlled
      ? resolvedValue
      : sampleValue(resolvedValue, fictionalSender[field]);
    if (!explicitlyControlled && !trimText(resolvedValue) && trimText(renderedSender[field])) {
      usesSampleText = true;
    }
  });

  const paragraphUseCount = { opening: 0, evidence: 0, closing: 0 };
  const renderedBlocks = normalized.bodyBlocks.map((block) => {
    if (block.kind !== 'paragraph' || trimText(block.text)) return block;
    const role = block.role || 'evidence';
    const fallback = paragraphUseCount[role] === 0 ? sample.paragraphs[role] : '';
    paragraphUseCount[role] = (paragraphUseCount[role] || 0) + 1;
    if (fallback) usesSampleText = true;
    return fallback ? { ...block, text: fallback } : block;
  });

  const recipient = {
    date: sampleValue(normalized.recipient.date, sample.recipient.date),
    hiringManagerName: sampleValue(normalized.recipient.hiringManagerName, sample.recipient.hiringManagerName),
    hiringManagerTitle: sampleValue(normalized.recipient.hiringManagerTitle, sample.recipient.hiringManagerTitle),
    company: sampleValue(normalized.recipient.company, sample.recipient.company),
    addressLines: normalized.recipient.addressLines.map((line, index) => (
      sampleValue(line, sample.recipient.addressLines[index] || '')
    )),
  };

  Object.keys(recipient).forEach((field) => {
    const realValue = normalized.recipient[field];
    const renderedValue = recipient[field];
    if (Array.isArray(renderedValue)) {
      if (renderedValue.some((value, index) => !trimText(realValue?.[index]) && trimText(value))) usesSampleText = true;
    } else if (!trimText(realValue) && trimText(renderedValue)) {
      usesSampleText = true;
    }
  });

  const greeting = sampleValue(normalized.greeting, sample.greeting);
  const signOff = sampleValue(normalized.signOff, sample.signOff);
  const signatureName = sampleValue(normalized.signatureName, renderedSender.name);
  if (!trimText(normalized.greeting) && greeting) usesSampleText = true;
  if (!trimText(normalized.signatureName) && signatureName) usesSampleText = true;

  return {
    characterId: getSampleResumeCharacterId(resumeId),
    usesSampleText,
    resolvedSender: renderedSender,
    coverLetter: {
      ...normalized,
      recipient,
      greeting,
      bodyBlocks: renderedBlocks,
      signOff,
      signatureName,
    },
  };
}

export function createSampleCoverLetterPlaceholderResolver(realCoverLetter, sampleModel) {
  if (!sampleModel?.coverLetter) return (_path, fallback = '') => fallback;

  return (path, fallback = '') => {
    const target = parseCoverLetterTargetPath(path);
    if (!target) return fallback;
    const realValue = readCoverLetterTargetValue(realCoverLetter, {}, target);
    if (realValue === null || trimText(realValue)) return fallback;
    const sampleValueForPath = readCoverLetterTargetValue(
      sampleModel.coverLetter,
      sampleModel.resolvedSender,
      target,
    );
    return trimText(sampleValueForPath) ? sampleValueForPath : fallback;
  };
}

export function getSampleCoverLetterCount() {
  return Object.keys(SAMPLE_COVER_LETTERS).length;
}

import { useMemo, useRef } from 'react';
import { getResumePresentationVars, getResumePrintPageRule } from '../lib/resume.js';

function templateClassName(template) {
    return `resumePage--${template}`;
}

export default function ResumePreview({ previewModel, template, settings, panelRef }) {
    const resumeRef = useRef(null);
    const presentationVars = useMemo(() => getResumePresentationVars(settings, template), [settings, template]);
    const printPageRule = useMemo(() => getResumePrintPageRule(settings, template), [settings, template]);
    const personalDetails = useMemo(() => (
        [
            previewModel.personal.location,
            previewModel.personal.phone,
            previewModel.personal.email,
            ...previewModel.personal.links.map((link) => link.text)
        ].filter(Boolean)
    ), [previewModel.personal]);

    function renderBulletEntries(items, keyPrefix) {
        if (items.length === 0) {
            return null;
        }

        return (
            <ul className="previewEntryList">
                {items.map((item, index) => (
                    <li key={`${keyPrefix}-${index}`}>{item}</li>
                ))}
            </ul>
        );
    }

    function renderSimpleMetaSection({ title, entries, sectionClassName, detailLabel, detailKey, secondaryKey, dateKey = 'years' }) {
        if (entries.length === 0) {
            return null;
        }

        return (
            <div className={`resumeSection ${sectionClassName}`} key={sectionClassName}>
                <h2>{title}</h2>
                {entries.map((entry) => (
                    <div className="previewEntry" key={entry.id}>
                        <div className="previewEntryHeader">
                            <div className="previewEntryTitle">{entry.title || entry.name}</div>
                            {entry[dateKey] && <div className="previewEntryMeta">{entry[dateKey]}</div>}
                        </div>
                        {entry[secondaryKey] && <div className="previewEntrySubtitle">{entry[secondaryKey]}</div>}
                        {entry[detailKey] && (
                            <div className="previewEntryDetail">
                                {detailLabel ? <span className="educationDetailLabel">{detailLabel}:</span> : null} {entry[detailKey]}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    function renderPersonalSection() {
        if (!previewModel.showPersonal) {
            return null;
        }

        return (
            <div className="resumeSection personalSection" key="personal">
                <h1>{previewModel.personal.name || "Your Name"}</h1>

                {previewModel.personal.headline && (
                    <div className="personalHeadline">{previewModel.personal.headline}</div>
                )}

                {personalDetails.length > 0 && (
                    <div className={`personalDetails ${personalDetails.length >= 4 ? 'personalDetails--wrap' : ''}`}>
                        {personalDetails.map((detail, index) => (
                            <span key={`${detail}-${index}`}>{detail}</span>
                        ))}
                    </div>
                )}

                {previewModel.personal.aboutMe && (
                    <div className="aboutMe">{previewModel.personal.aboutMe}</div>
                )}
            </div>
        );
    }

    function renderEducationSection(block) {
        return (
            <div className="resumeSection educationDiv" key={block.id}>
                <h2>{block.title}</h2>
                {block.entries.map((institution) => (
                    <div className="educationSection" key={institution.id}>
                        {(institution.school || institution.location || institution.yearsEdu) && (
                            <div className="degreeYearsEduFlex">
                                {(institution.school || institution.location) && (
                                    <div className="schoolLocation">
                                        {institution.school && <span className="school">{institution.school}</span>}
                                        {institution.location && <span className="eduLocation">{institution.location}</span>}
                                    </div>
                                )}
                                {institution.yearsEdu && <div className="yearsEdu">{institution.yearsEdu}</div>}
                            </div>
                        )}
                        {institution.programs?.length > 0 ? (
                            institution.programs.map((program) => (
                                <div className="schoolLocationRow" key={program.id}>
                                    <div className="educationDegreeRow">
                                        {program.degree && <div className="degree">{program.degree}</div>}
                                        {program.honors && (
                                            <div className="educationMeta">
                                                <span>{program.honors}</span>
                                            </div>
                                        )}
                                    </div>
                                    {(program.yearsEdu || program.gpa) && (
                                        <div className="yearsEdu educationGpa">
                                            {[program.yearsEdu, program.gpa ? `GPA: ${program.gpa}` : ''].filter(Boolean).join(' | ')}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            (institution.degree || institution.honors || institution.gpa) && (
                                <div className="schoolLocationRow">
                                    <div className="educationDegreeRow">
                                        {institution.degree && <div className="degree">{institution.degree}</div>}
                                        {institution.honors && (
                                            <div className="educationMeta">
                                                <span>{institution.honors}</span>
                                            </div>
                                        )}
                                    </div>
                                    {institution.gpa && <div className="yearsEdu educationGpa">GPA: {institution.gpa}</div>}
                                </div>
                            )
                        )}
                        {institution.coursework && (
                            <div className="educationDetail">
                                <span className="educationDetailLabel">Relevant coursework:</span> {institution.coursework}
                            </div>
                        )}
                        {institution.awards && (
                            <div className="educationDescription">
                                <span className="educationDetailLabel">Awards:</span> {institution.awards}
                            </div>
                        )}
                        {institution.customSections.map((section) => (
                            <div className="educationDescription" key={section.id}>
                                <span className="educationDetailLabel">{section.label || 'Custom section'}:</span> {section.content}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    function renderRolesSection(block) {
        return (
            <div className="resumeSection experienceDiv" key={block.id}>
                <h2>{block.title}</h2>
                {block.entries.map((job) => (
                    <div className="experienceSection" key={job.id}>
                        {(job.company || job.role || job.yearsExp) && (
                            <div className="companyYearsExpFlex">
                                {(job.company || job.role) && (
                                    <div className="companyRoleLine">
                                        {job.company && <span className="company">{job.company}</span>}
                                        {job.company && job.role && <span className="roleSeparator">, </span>}
                                        {job.role && <span className="role">{job.role}</span>}
                                    </div>
                                )}
                                {job.yearsExp && <div className="yearsExp">{job.yearsExp}</div>}
                            </div>
                        )}
                        {renderBulletEntries(job.activities, job.id)}
                    </div>
                ))}
            </div>
        );
    }

    function renderSkillsSection(block) {
        return (
            <div className="resumeSection skillsDiv" key={block.id}>
                <h2>{block.title}</h2>
                {block.entries.map((entry) => (
                    <div className="skillGroup" key={entry.id}>
                        {entry.category && <div className="skillGroupTitle">{entry.category}</div>}
                        <div className="skillGroupItems">{entry.items}</div>
                    </div>
                ))}
            </div>
        );
    }

    function renderProjectsSection(block) {
        return (
            <div className="resumeSection projectsDiv" key={block.id}>
                <h2>{block.title}</h2>
                {block.entries.map((entry) => (
                    <div className="previewEntry" key={entry.id}>
                        <div className="previewEntryHeader">
                            <div className="previewEntryTitle">{entry.name}</div>
                            {entry.years && <div className="previewEntryMeta">{entry.years}</div>}
                        </div>
                        {entry.subtitle && <div className="previewEntrySubtitle">{entry.subtitle}</div>}
                        {entry.summary && <div className="previewEntryDetail">{entry.summary}</div>}
                        {renderBulletEntries(entry.highlights, entry.id)}
                    </div>
                ))}
            </div>
        );
    }

    function renderLanguagesSection(block) {
        return (
            <div className="resumeSection languagesDiv" key={block.id}>
                <h2>{block.title}</h2>
                {block.entries.map((entry) => (
                    <div className="previewEntry previewEntry--tight" key={entry.id}>
                        <div className="previewInlineHeader">
                            <div className="previewEntryTitle">{entry.language}</div>
                            {entry.proficiency && <div className="previewEntryMeta">{entry.proficiency}</div>}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    function renderCustomSection(block) {
        return (
            <div className="resumeSection customDiv" key={block.id}>
                <h2>{block.title}</h2>
                {block.entries.map((entry) => (
                    <div className="previewEntry" key={entry.id}>
                        <div className="previewEntryHeader">
                            <div className="previewEntryTitle">{entry.title}</div>
                            {entry.years && <div className="previewEntryMeta">{entry.years}</div>}
                        </div>
                        {entry.subtitle && <div className="previewEntrySubtitle">{entry.subtitle}</div>}
                        {entry.details && <div className="previewEntryDetail">{entry.details}</div>}
                        {renderBulletEntries(entry.highlights, entry.id)}
                    </div>
                ))}
            </div>
        );
    }

    function renderSectionBlock(block) {
        if (block.kind === "education") {
            return renderEducationSection(block);
        }

        if (block.kind === "roles") {
            return renderRolesSection(block);
        }

        if (block.kind === "skills") {
            return renderSkillsSection(block);
        }

        if (block.kind === "projects") {
            return renderProjectsSection(block);
        }

        if (block.kind === "certifications") {
            return renderSimpleMetaSection({
                title: block.title,
                entries: block.entries,
                sectionClassName: `certificationsDiv ${block.id}`,
                detailKey: 'details',
                secondaryKey: 'issuer'
            });
        }

        if (block.kind === "languages") {
            return renderLanguagesSection(block);
        }

        if (block.kind === "awards") {
            return renderSimpleMetaSection({
                title: block.title,
                entries: block.entries,
                sectionClassName: `awardsDiv ${block.id}`,
                detailKey: 'details',
                secondaryKey: 'issuer'
            });
        }

        if (block.kind === "publications") {
            return renderSimpleMetaSection({
                title: block.title,
                entries: block.entries,
                sectionClassName: `publicationsDiv ${block.id}`,
                detailKey: 'details',
                secondaryKey: 'publisher'
            });
        }

        return renderCustomSection(block);
    }

    const orderedSections = [
        renderPersonalSection(),
        ...previewModel.sectionBlocks.map(renderSectionBlock)
    ].filter(Boolean);

    return (
        <>
            <style media="print">{printPageRule}</style>
            <section ref={panelRef} className="previewPanel panel">
                <div className="previewFrame">
                    <div
                        ref={resumeRef}
                        className={`resumePage ${templateClassName(template)}`}
                        style={presentationVars}
                    >
                        {previewModel.hasContent ? (
                            orderedSections
                        ) : (
                            <div className="resumeEmptyState">
                                <p className="resumeEmptyEyebrow">Live preview</p>
                                <h3>Your resume will appear here</h3>
                                <p>Start with your personal details, then add education and experience. Empty sections stay out of the final document until you add real content.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </>
    )
}

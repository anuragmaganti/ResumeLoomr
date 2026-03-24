import { useMemo, useRef } from 'react';

function templateClassName(template) {
    return `resumePage--${template}`;
}

export default function ResumePreview({ previewModel, sectionOrder, template, panelRef }) {
    const resumeRef = useRef(null);
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

    const orderedSections = sectionOrder.map((sectionId) => {
        if (sectionId === "personal" && previewModel.showPersonal) {
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

        if (sectionId === "education" && previewModel.showEducation) {
            return (
                <div className="resumeSection educationDiv" key="education">
                    <h2>{previewModel.sectionTitles.education}</h2>
                    {previewModel.educationEntries.map((institution) => (
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
                            {(institution.degree || institution.honors || institution.gpa) && (
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

        if (sectionId === "experience" && previewModel.showExperience) {
            return (
                <div className="resumeSection experienceDiv" key="experience">
                    <h2>{previewModel.sectionTitles.experience}</h2>
                    {previewModel.experienceEntries.map((job) => (
                        <div className="experienceSection" key={job.id}>
                            {(job.company || job.yearsExp) && (
                                <div className="companyYearsExpFlex">
                                    {job.company && <div className="company">{job.company}</div>}
                                    {job.yearsExp && <div className="yearsExp">{job.yearsExp}</div>}
                                </div>
                            )}
                            {job.role && <div className="role">{job.role}</div>}
                            {renderBulletEntries(job.activities, job.id)}
                        </div>
                    ))}
                </div>
            );
        }

        if (sectionId === "skills" && previewModel.showSkills) {
            return (
                <div className="resumeSection skillsDiv" key="skills">
                    <h2>{previewModel.sectionTitles.skills}</h2>
                    {previewModel.skillsEntries.map((entry) => (
                        <div className="skillGroup" key={entry.id}>
                            {entry.category && <div className="skillGroupTitle">{entry.category}</div>}
                            <div className="skillGroupItems">{entry.items}</div>
                        </div>
                    ))}
                </div>
            );
        }

        if (sectionId === "projects" && previewModel.showProjects) {
            return (
                <div className="resumeSection projectsDiv" key="projects">
                    <h2>{previewModel.sectionTitles.projects}</h2>
                    {previewModel.projectEntries.map((entry) => (
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

        if (sectionId === "certifications" && previewModel.showCertifications) {
            return renderSimpleMetaSection({
                title: previewModel.sectionTitles.certifications,
                entries: previewModel.certificationEntries,
                sectionClassName: 'certificationsDiv',
                detailKey: 'details',
                secondaryKey: 'issuer'
            });
        }

        if (sectionId === "volunteering" && previewModel.showVolunteering) {
            return (
                <div className="resumeSection volunteeringDiv" key="volunteering">
                    <h2>{previewModel.sectionTitles.volunteering}</h2>
                    {previewModel.volunteeringEntries.map((entry) => (
                        <div className="previewEntry" key={entry.id}>
                            <div className="previewEntryHeader">
                                <div className="previewEntryTitle">{entry.organization}</div>
                                {entry.years && <div className="previewEntryMeta">{entry.years}</div>}
                            </div>
                            {entry.role && <div className="previewEntrySubtitle">{entry.role}</div>}
                            {renderBulletEntries(entry.highlights, entry.id)}
                        </div>
                    ))}
                </div>
            );
        }

        if (sectionId === "leadership" && previewModel.showLeadership) {
            return (
                <div className="resumeSection leadershipDiv" key="leadership">
                    <h2>{previewModel.sectionTitles.leadership}</h2>
                    {previewModel.leadershipEntries.map((entry) => (
                        <div className="previewEntry" key={entry.id}>
                            <div className="previewEntryHeader">
                                <div className="previewEntryTitle">{entry.organization}</div>
                                {entry.years && <div className="previewEntryMeta">{entry.years}</div>}
                            </div>
                            {entry.role && <div className="previewEntrySubtitle">{entry.role}</div>}
                            {renderBulletEntries(entry.highlights, entry.id)}
                        </div>
                    ))}
                </div>
            );
        }

        if (sectionId === "languages" && previewModel.showLanguages) {
            return (
                <div className="resumeSection languagesDiv" key="languages">
                    <h2>{previewModel.sectionTitles.languages}</h2>
                    {previewModel.languageEntries.map((entry) => (
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

        if (sectionId === "awards" && previewModel.showAwards) {
            return renderSimpleMetaSection({
                title: previewModel.sectionTitles.awards,
                entries: previewModel.awardEntries,
                sectionClassName: 'awardsDiv',
                detailKey: 'details',
                secondaryKey: 'issuer'
            });
        }

        if (sectionId === "publications" && previewModel.showPublications) {
            return renderSimpleMetaSection({
                title: previewModel.sectionTitles.publications,
                entries: previewModel.publicationEntries,
                sectionClassName: 'publicationsDiv',
                detailKey: 'details',
                secondaryKey: 'publisher'
            });
        }

        return null;
    }).filter(Boolean);

    return (
        <section ref={panelRef} className="previewPanel panel">
            <div className="previewFrame">
                <div ref={resumeRef} className={`resumePage ${templateClassName(template)}`}>
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
    )
}

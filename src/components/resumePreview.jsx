import { useEffect, useMemo, useRef, useState } from 'react';

const ESTIMATED_SINGLE_PAGE_HEIGHT = 1040;

function templateClassName(template) {
    return `resumePage--${template}`;
}

export default function ResumePreview({ previewModel, sectionOrder, template, templateOptions, onTemplateChange, onPrint, panelRef }) {
    const resumeRef = useRef(null);
    const [estimatedPages, setEstimatedPages] = useState(1);
    const templateLabel = useMemo(
        () => templateOptions.find((option) => option.id === template)?.label ?? 'Modern',
        [template, templateOptions]
    );
    const personalDetails = useMemo(() => (
        [
            previewModel.personal.location,
            previewModel.personal.phone,
            previewModel.personal.email,
            ...previewModel.personal.links.map((link) => link.text)
        ].filter(Boolean)
    ), [previewModel.personal]);

    useEffect(() => {
        const resumeElement = resumeRef.current;

        if (!resumeElement) {
            return undefined;
        }

        function measurePages() {
            const nextPageCount = Math.max(1, Math.ceil(resumeElement.scrollHeight / ESTIMATED_SINGLE_PAGE_HEIGHT));
            setEstimatedPages(nextPageCount);
        }

        measurePages();

        if (typeof ResizeObserver === 'undefined') {
            return undefined;
        }

        const observer = new ResizeObserver(() => {
            measurePages();
        });

        observer.observe(resumeElement);

        return () => observer.disconnect();
    }, [previewModel, template]);

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
                    <h2>Education</h2>
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
                    <h2>Experience</h2>
                    {previewModel.experienceEntries.map((job) => (
                        <div className="experienceSection" key={job.id}>
                            {(job.company || job.yearsExp) && (
                                <div className="companyYearsExpFlex">
                                    {job.company && <div className="company">{job.company}</div>}
                                    {job.yearsExp && <div className="yearsExp">{job.yearsExp}</div>}
                                </div>
                            )}
                            {job.role && <div className="role">{job.role}</div>}
                            {job.activities.length > 0 && (
                                <ul>
                                    {job.activities.map((activity, index) => (
                                        <li key={`${job.id}-${index}`}>{activity}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            );
        }

        return null;
    }).filter(Boolean);

    return (
        <section ref={panelRef} className="previewPanel panel">
            <div className="previewPanelHeader">
                <div className="previewPanelIntro">
                    <p className="kicker">Preview</p>
                    <div className="previewMeta">
                        <span className={`statusBadge ${estimatedPages > 1 ? 'statusBadge--warning' : 'statusBadge--success'}`}>
                            {estimatedPages > 1 ? `Estimated ${estimatedPages} pages` : 'Estimated 1 page'}
                        </span>
                        <span className="statusBadge statusBadge--neutral">{templateLabel} template</span>
                    </div>
                </div>

                <div className="previewToolbar">
                    <label className="toolbarField">
                        <span className="toolbarLabel">Template</span>
                        <select
                            className="toolbarSelect"
                            value={template}
                            onChange={(event) => onTemplateChange(event.target.value)}
                            aria-label="Choose resume template"
                        >
                            {templateOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="toolbarActions">
                        <button type="button" className="button buttonPrimary printButton" onClick={onPrint}>
                            Print resume
                        </button>
                    </div>
                </div>
            </div>

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

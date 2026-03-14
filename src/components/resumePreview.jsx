import { useEffect, useMemo, useRef, useState } from 'react';

const ESTIMATED_SINGLE_PAGE_HEIGHT = 1040;

function templateClassName(template) {
    return `resumePage--${template}`;
}

export default function ResumePreview({ previewModel, template, templateOptions }) {
    const resumeRef = useRef(null);
    const [estimatedPages, setEstimatedPages] = useState(1);
    const templateLabel = useMemo(
        () => templateOptions.find((option) => option.id === template)?.label ?? 'Modern',
        [template, templateOptions]
    );

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

    return (
        <section className="previewPanel panel">
            <div className="previewPanelHeader">
                <p className="kicker">Preview</p>
                <div className="previewMeta">
                    <span className={`statusBadge ${estimatedPages > 1 ? 'statusBadge--warning' : 'statusBadge--success'}`}>
                        {estimatedPages > 1 ? `Estimated ${estimatedPages} pages` : 'Estimated 1 page'}
                    </span>
                    <span className="statusBadge statusBadge--neutral">{templateLabel} template</span>
                </div>
            </div>

            <div className="previewFrame">
                <div ref={resumeRef} className={`resumePage ${templateClassName(template)}`}>
                    {previewModel.hasContent ? (
                        <>
                            {previewModel.showPersonal && (
                                <div className="personalSection">
                                    <h1>{previewModel.personal.name || "Your Name"}</h1>

                                    {(previewModel.personal.phone || previewModel.personal.email) && (
                                        <div className="phoneEmail">
                                            {previewModel.personal.phone && <div>{previewModel.personal.phone}</div>}
                                            {previewModel.personal.email && <div>{previewModel.personal.email}</div>}
                                        </div>
                                    )}

                                    {previewModel.personal.aboutMe && (
                                        <div className="aboutMe">{previewModel.personal.aboutMe}</div>
                                    )}
                                </div>
                            )}

                            {previewModel.showEducation && (
                                <div className="educationDiv">
                                    <h2>Education</h2>
                                    {previewModel.educationEntries.map((institution) => (
                                        <div className="educationSection" key={institution.id}>
                                            <div className="degreeYearsEduFlex">
                                                {institution.degree && <div className="degree">{institution.degree}</div>}
                                                {institution.yearsEdu && <div className="yearsEdu">{institution.yearsEdu}</div>}
                                            </div>
                                            {institution.school && <div className="school">{institution.school}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {previewModel.showExperience && (
                                <div className="experienceDiv">
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
                            )}
                        </>
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

import { useMemo, useRef } from 'react';
import { getResumePresentationVars, getResumePrintPageRule } from '../lib/resume.js';
import {
    createPreviewEditAttributes,
    personalEditorPath,
    sectionEntryEditorPath,
    sectionEntryListEditorPath,
    sectionEntryNestedEditorPath,
    sectionTitleEditorPath,
} from '../lib/editorTargets.js';

function templateClassName(template) {
    return `resumePage--${template}`;
}

const personalLinkFieldMap = {
    linkedin: 'linkedinUrl',
    portfolio: 'portfolioUrl',
    github: 'githubUrl',
    custom: 'customField',
};

export default function ResumePreview({ previewModel, template, settings, panelRef, onEditTarget }) {
    const resumeRef = useRef(null);
    const presentationVars = useMemo(() => getResumePresentationVars(settings, template), [settings, template]);
    const printPageRule = useMemo(() => getResumePrintPageRule(settings, template), [settings, template]);
    const personalDetails = useMemo(() => (
        [
            { text: previewModel.personal.location, field: 'location' },
            { text: previewModel.personal.phone, field: 'phone' },
            { text: previewModel.personal.email, field: 'email' },
            ...previewModel.personal.links.map((link) => ({
                text: link.text,
                field: personalLinkFieldMap[link.id] || 'customField'
            }))
        ].filter((item) => item.text)
    ), [previewModel.personal]);

    function personalTarget(field) {
        return createPreviewEditAttributes({
            sectionId: 'personal',
            field,
            path: personalEditorPath(field),
        });
    }

    function sectionTitleTarget(sectionId) {
        return createPreviewEditAttributes({
            sectionId,
            field: '__title',
            path: sectionTitleEditorPath(sectionId),
        });
    }

    function entryTarget(sectionId, entryId, field) {
        return createPreviewEditAttributes({
            sectionId,
            entryId,
            field,
            path: sectionEntryEditorPath(sectionId, entryId, field),
        });
    }

    function listTarget(sectionId, entryId, field, itemIndex) {
        return createPreviewEditAttributes({
            sectionId,
            entryId,
            field,
            itemIndex,
            path: sectionEntryListEditorPath(sectionId, entryId, field, itemIndex),
        });
    }

    function nestedTarget(sectionId, entryId, nestedPath) {
        const pathParts = nestedPath.split('.');

        return createPreviewEditAttributes({
            sectionId,
            entryId,
            field: pathParts[pathParts.length - 1] || nestedPath,
            nestedPath,
            path: sectionEntryNestedEditorPath(sectionId, entryId, nestedPath),
        });
    }

    function handlePreviewClick(event) {
        if (!onEditTarget) {
            return;
        }

        const targetElement = event.target.closest('[data-edit-section-id][data-edit-path]');

        if (!targetElement || !resumeRef.current?.contains(targetElement)) {
            return;
        }

        onEditTarget({
            sectionId: targetElement.dataset.editSectionId,
            field: targetElement.dataset.editField || '',
            entryId: targetElement.dataset.editEntryId || '',
            itemIndex: targetElement.dataset.editItemIndex ? Number(targetElement.dataset.editItemIndex) : undefined,
            nestedPath: targetElement.dataset.editNestedPath || '',
            path: targetElement.dataset.editPath,
        });
    }

    function renderBulletEntries(items, keyPrefix, createTarget) {
        if (items.length === 0) {
            return null;
        }

        return (
            <ul className="previewEntryList">
                {items.map((item, index) => (
                    <li key={`${keyPrefix}-${index}`} {...(createTarget ? createTarget(index) : {})}>{item}</li>
                ))}
            </ul>
        );
    }

    function renderSimpleMetaSection({
        block,
        sectionClassName,
        detailLabel,
        detailKey,
        secondaryKey,
        dateKey = 'years',
        titleKey = 'title'
    }) {
        const entries = block.entries;

        if (entries.length === 0) {
            return null;
        }

        return (
            <div className={`resumeSection ${sectionClassName}`} key={sectionClassName}>
                <h2 {...sectionTitleTarget(block.id)}>{block.title}</h2>
                {entries.map((entry) => (
                    <div className="previewEntry" key={entry.id}>
                        <div className="previewEntryHeader">
                            <div className="previewEntryTitle" {...entryTarget(block.id, entry.id, titleKey)}>{entry[titleKey]}</div>
                            {entry[dateKey] && (
                                <div className="previewEntryMeta" {...entryTarget(block.id, entry.id, dateKey)}>
                                    {entry[dateKey]}
                                </div>
                            )}
                        </div>
                        {entry[secondaryKey] && (
                            <div className="previewEntrySubtitle" {...entryTarget(block.id, entry.id, secondaryKey)}>
                                {entry[secondaryKey]}
                            </div>
                        )}
                        {entry[detailKey] && (
                            <div className="previewEntryDetail" {...entryTarget(block.id, entry.id, detailKey)}>
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
                <h1 {...personalTarget('name')}>{previewModel.personal.name || "Your Name"}</h1>

                {previewModel.personal.headline && (
                    <div className="personalHeadline" {...personalTarget('headline')}>{previewModel.personal.headline}</div>
                )}

                {personalDetails.length > 0 && (
                    <div className={`personalDetails ${personalDetails.length >= 4 ? 'personalDetails--wrap' : ''}`}>
                        {personalDetails.map((detail, index) => (
                            <span key={`${detail.text}-${index}`} {...personalTarget(detail.field)}>{detail.text}</span>
                        ))}
                    </div>
                )}

                {previewModel.personal.aboutMe && (
                    <div className="aboutMe" {...personalTarget('aboutMe')}>{previewModel.personal.aboutMe}</div>
                )}
            </div>
        );
    }

    function renderEducationSection(block) {
        return (
            <div className="resumeSection educationDiv" key={block.id}>
                <h2 {...sectionTitleTarget(block.id)}>{block.title}</h2>
                {block.entries.map((institution) => (
                    <div className="educationSection" key={institution.id}>
                        {(institution.school || institution.location || institution.yearsEdu) && (
                            <div className="degreeYearsEduFlex">
                                {(institution.school || institution.location) && (
                                    <div className="schoolLocation">
                                        {institution.school && (
                                            <span className="school" {...entryTarget(block.id, institution.id, 'school')}>
                                                {institution.school}
                                            </span>
                                        )}
                                        {institution.location && (
                                            <span className="eduLocation" {...entryTarget(block.id, institution.id, 'location')}>
                                                {institution.location}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {institution.yearsEdu && (
                                    <div className="yearsEdu" {...entryTarget(block.id, institution.id, 'yearsEdu')}>
                                        {institution.yearsEdu}
                                    </div>
                                )}
                            </div>
                        )}
                        {institution.programs?.length > 0 ? (
                            institution.programs.map((program, programIndex) => (
                                <div className="schoolLocationRow" key={program.id}>
                                    <div className="educationDegreeRow">
                                        {program.degree && (
                                            <div
                                                className="degree"
                                                {...nestedTarget(block.id, institution.id, `programs.${programIndex}.degree`)}
                                            >
                                                {program.degree}
                                            </div>
                                        )}
                                        {program.honors && (
                                            <div
                                                className="educationMeta"
                                                {...nestedTarget(block.id, institution.id, `programs.${programIndex}.honors`)}
                                            >
                                                <span>{program.honors}</span>
                                            </div>
                                        )}
                                    </div>
                                    {(program.yearsEdu || program.gpa) && (
                                        <div className="yearsEdu educationGpa">
                                            {program.yearsEdu && (
                                                <span {...nestedTarget(block.id, institution.id, `programs.${programIndex}.yearsEdu`)}>
                                                    {program.yearsEdu}
                                                </span>
                                            )}
                                            {program.yearsEdu && program.gpa ? <span> | </span> : null}
                                            {program.gpa && (
                                                <span {...nestedTarget(block.id, institution.id, `programs.${programIndex}.gpa`)}>
                                                    GPA: {program.gpa}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            (institution.degree || institution.honors || institution.gpa) && (
                                <div className="schoolLocationRow">
                                    <div className="educationDegreeRow">
                                        {institution.degree && (
                                            <div className="degree" {...entryTarget(block.id, institution.id, 'degree')}>
                                                {institution.degree}
                                            </div>
                                        )}
                                        {institution.honors && (
                                            <div className="educationMeta" {...entryTarget(block.id, institution.id, 'honors')}>
                                                <span>{institution.honors}</span>
                                            </div>
                                        )}
                                    </div>
                                    {institution.gpa && (
                                        <div className="yearsEdu educationGpa" {...entryTarget(block.id, institution.id, 'gpa')}>
                                            GPA: {institution.gpa}
                                        </div>
                                    )}
                                </div>
                            )
                        )}
                        {institution.coursework && (
                            <div className="educationDetail" {...entryTarget(block.id, institution.id, 'coursework')}>
                                <span className="educationDetailLabel">Relevant coursework:</span> {institution.coursework}
                            </div>
                        )}
                        {institution.awards && (
                            <div className="educationDescription" {...entryTarget(block.id, institution.id, 'awards')}>
                                <span className="educationDetailLabel">Awards:</span> {institution.awards}
                            </div>
                        )}
                        {institution.customSections.map((section, customSectionIndex) => (
                            <div className="educationDescription" key={section.id}>
                                <span
                                    className="educationDetailLabel"
                                    {...nestedTarget(block.id, institution.id, `customSections.${customSectionIndex}.label`)}
                                >
                                    {section.label || 'Custom section'}:
                                </span>
                                {' '}
                                <span {...nestedTarget(block.id, institution.id, `customSections.${customSectionIndex}.content`)}>
                                    {section.content}
                                </span>
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
                <h2 {...sectionTitleTarget(block.id)}>{block.title}</h2>
                {block.entries.map((job) => (
                    <div className="experienceSection" key={job.id}>
                        {(job.company || job.role || job.yearsExp) && (
                            <div className="companyYearsExpFlex">
                                {(job.company || job.role) && (
                                    <div className="companyRoleLine">
                                        {job.company && (
                                            <span className="company" {...entryTarget(block.id, job.id, 'company')}>
                                                {job.company}
                                            </span>
                                        )}
                                        {job.company && job.role && <span className="roleSeparator">, </span>}
                                        {job.role && (
                                            <span className="role" {...entryTarget(block.id, job.id, 'role')}>
                                                {job.role}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {job.yearsExp && (
                                    <div className="yearsExp" {...entryTarget(block.id, job.id, 'yearsExp')}>
                                        {job.yearsExp}
                                    </div>
                                )}
                            </div>
                        )}
                        {renderBulletEntries(job.activities, job.id, (activityIndex) => (
                            listTarget(block.id, job.id, 'activities', activityIndex)
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    function renderSkillsSection(block) {
        return (
            <div className="resumeSection skillsDiv" key={block.id}>
                <h2 {...sectionTitleTarget(block.id)}>{block.title}</h2>
                {block.entries.map((entry) => (
                    <div className="skillGroup" key={entry.id}>
                        {entry.category && (
                            <div className="skillGroupTitle" {...entryTarget(block.id, entry.id, 'category')}>
                                {entry.category}
                            </div>
                        )}
                        <div className="skillGroupItems" {...entryTarget(block.id, entry.id, 'items')}>{entry.items}</div>
                    </div>
                ))}
            </div>
        );
    }

    function renderProjectsSection(block) {
        return (
            <div className="resumeSection projectsDiv" key={block.id}>
                <h2 {...sectionTitleTarget(block.id)}>{block.title}</h2>
                {block.entries.map((entry) => (
                    <div className="previewEntry" key={entry.id}>
                        <div className="previewEntryHeader">
                            <div className="previewEntryTitle" {...entryTarget(block.id, entry.id, 'name')}>{entry.name}</div>
                            {entry.years && (
                                <div className="previewEntryMeta" {...entryTarget(block.id, entry.id, 'years')}>
                                    {entry.years}
                                </div>
                            )}
                        </div>
                        {entry.subtitle && (
                            <div className="previewEntrySubtitle" {...entryTarget(block.id, entry.id, 'subtitle')}>
                                {entry.subtitle}
                            </div>
                        )}
                        {entry.summary && (
                            <div className="previewEntryDetail" {...entryTarget(block.id, entry.id, 'summary')}>
                                {entry.summary}
                            </div>
                        )}
                        {renderBulletEntries(entry.highlights, entry.id, (highlightIndex) => (
                            listTarget(block.id, entry.id, 'highlights', highlightIndex)
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    function renderLanguagesSection(block) {
        return (
            <div className="resumeSection languagesDiv" key={block.id}>
                <h2 {...sectionTitleTarget(block.id)}>{block.title}</h2>
                {block.entries.map((entry) => (
                    <div className="previewEntry previewEntry--tight" key={entry.id}>
                        <div className="previewInlineHeader">
                            <div className="previewEntryTitle" {...entryTarget(block.id, entry.id, 'language')}>
                                {entry.language}
                            </div>
                            {entry.proficiency && (
                                <div className="previewEntryMeta" {...entryTarget(block.id, entry.id, 'proficiency')}>
                                    {entry.proficiency}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    function renderCustomSection(block) {
        return (
            <div className="resumeSection customDiv" key={block.id}>
                <h2 {...sectionTitleTarget(block.id)}>{block.title}</h2>
                {block.entries.map((entry) => (
                    <div className="previewEntry" key={entry.id}>
                        <div className="previewEntryHeader">
                            <div className="previewEntryTitle" {...entryTarget(block.id, entry.id, 'title')}>{entry.title}</div>
                            {entry.years && (
                                <div className="previewEntryMeta" {...entryTarget(block.id, entry.id, 'years')}>
                                    {entry.years}
                                </div>
                            )}
                        </div>
                        {entry.subtitle && (
                            <div className="previewEntrySubtitle" {...entryTarget(block.id, entry.id, 'subtitle')}>
                                {entry.subtitle}
                            </div>
                        )}
                        {entry.details && (
                            <div className="previewEntryDetail" {...entryTarget(block.id, entry.id, 'details')}>
                                {entry.details}
                            </div>
                        )}
                        {renderBulletEntries(entry.highlights, entry.id, (highlightIndex) => (
                            listTarget(block.id, entry.id, 'highlights', highlightIndex)
                        ))}
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
                block,
                sectionClassName: `certificationsDiv ${block.id}`,
                detailKey: 'details',
                secondaryKey: 'issuer',
                titleKey: 'name'
            });
        }

        if (block.kind === "languages") {
            return renderLanguagesSection(block);
        }

        if (block.kind === "awards") {
            return renderSimpleMetaSection({
                block,
                sectionClassName: `awardsDiv ${block.id}`,
                detailKey: 'details',
                secondaryKey: 'issuer'
            });
        }

        if (block.kind === "publications") {
            return renderSimpleMetaSection({
                block,
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
                        onClick={handlePreviewClick}
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

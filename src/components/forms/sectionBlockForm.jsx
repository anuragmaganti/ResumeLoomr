import AwardsForm from "./awardsForm";
import CertificationsForm from "./certificationsForm";
import CustomBlockForm from "./customBlockForm";
import EducationForm from "./educationForm";
import LanguagesForm from "./languagesForm";
import ProjectsForm from "./projectsForm";
import PublicationsForm from "./publicationsForm";
import RoleBlockForm from "./roleBlockForm";
import SkillsForm from "./skillsForm";

export default function SectionBlockForm({ section, actions, getFieldError, markTouched }) {
  if (!section) {
    return null;
  }

  if (section.kind === 'education') {
    return <EducationForm section={section} actions={actions} getFieldError={getFieldError} markTouched={markTouched} />;
  }

  if (section.kind === 'roles') {
    return <RoleBlockForm section={section} actions={actions} getFieldError={getFieldError} markTouched={markTouched} />;
  }

  if (section.kind === 'skills') {
    return <SkillsForm section={section} actions={actions} getFieldError={getFieldError} markTouched={markTouched} />;
  }

  if (section.kind === 'projects') {
    return <ProjectsForm section={section} actions={actions} getFieldError={getFieldError} markTouched={markTouched} />;
  }

  if (section.kind === 'certifications') {
    return <CertificationsForm section={section} actions={actions} getFieldError={getFieldError} markTouched={markTouched} />;
  }

  if (section.kind === 'languages') {
    return <LanguagesForm section={section} actions={actions} getFieldError={getFieldError} markTouched={markTouched} />;
  }

  if (section.kind === 'awards') {
    return <AwardsForm section={section} actions={actions} getFieldError={getFieldError} markTouched={markTouched} />;
  }

  if (section.kind === 'publications') {
    return <PublicationsForm section={section} actions={actions} getFieldError={getFieldError} markTouched={markTouched} />;
  }

  return <CustomBlockForm section={section} actions={actions} getFieldError={getFieldError} markTouched={markTouched} />;
}

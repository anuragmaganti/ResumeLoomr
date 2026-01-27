import SectionTabs from "./sectionTabs"
import PersonalForm from "./forms/personalForm";
import EducationForm from "./forms/educationForm";
import ExperienceForm from "./forms/experienceForm";

export default function EditorPanel({activeTab,setActiveTab,resume,setResume}) {
    return (
        <div className="editorPanel">
            
            <SectionTabs activeTab={activeTab} setActiveTab={setActiveTab}></SectionTabs>

            {activeTab === "personal" && <PersonalForm personal={resume.personal} setResume={setResume}></PersonalForm>}
            {activeTab === "education" && <EducationForm education={resume.education} setResume={setResume}></EducationForm>}
            {activeTab === "experience" && <ExperienceForm experience={resume.experience} setResume={setResume}></ExperienceForm>}

        </div>
    );
};
import SectionTabs from "./sectionTabs"
import PersonalForm from "./forms/personalForm";
import EducationForm from "./forms/educationForm";
import ExperienceForm from "./forms/experienceForm";

export default function EditorPanel({activeTab,setActiveTab}) {
    return (
        <div>
            <div>Editor Panel</div>
            <SectionTabs activeTab={activeTab} setActiveTab={setActiveTab}></SectionTabs>

            {activeTab === "personal" && <PersonalForm></PersonalForm>}
            {activeTab === "education" && <EducationForm></EducationForm>}
            {activeTab === "experience" && <ExperienceForm></ExperienceForm>}

        </div>
    );
};
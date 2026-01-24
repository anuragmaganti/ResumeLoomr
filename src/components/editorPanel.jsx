import SectionTabs from "./sectionTabs"

export default function EditorPanel({activeTab,setActiveTab}) {
    return (
        <div>
            <div>Editor Panel</div>
            <SectionTabs activeTab={activeTab} setActiveTab={setActiveTab}></SectionTabs>

            {activeTab === "personal" && <div>personal</div>}
            {activeTab === "education" && <div>education</div>}
            {activeTab === "experience" && <div>experience</div>}

        </div>
    );
};
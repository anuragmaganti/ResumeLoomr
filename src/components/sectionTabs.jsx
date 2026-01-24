export default function SectionTabs({activeTab, setActiveTab}) {
    return(
        <div>
            <button onClick={()=>setActiveTab("personal")}>Personal</button>
            <button onClick={()=>setActiveTab("education")}>Education</button>
            <button onClick={()=>setActiveTab("experience")}>Experience</button>
        </div>
    )
}
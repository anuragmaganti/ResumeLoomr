export default function SectionTabs({setActiveTab}) {
    return(
        <div className="tabs">
            <button className="button-55" role="button" onClick={()=>setActiveTab("personal")}>Personal</button>
            <button className="button-55" role="button" onClick={()=>setActiveTab("education")}>Education</button>
            <button className="button-55" role="button" onClick={()=>setActiveTab("experience")}>Experience</button>
        </div>
    )
}
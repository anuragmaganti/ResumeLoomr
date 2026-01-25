import { useState } from "react";

export default function EducationForm() {

    const [educationEntries,setEducationEntries] = useState([
        {id: crypto.randomUUID(), school:"",degree:"",yearsActive:""}
    ])

    function handleSubmit(e) {
        e.preventDefault();
    }

    return (
        <div>
            {educationEntries.map((entry)=>(
            <fieldset key={entry.id}>
                <form onSubmit={handleSubmit}>
                    <label htmlFor={"school"+entry.id}>Institution: </label>
                    <input type="text" id={"school"+entry.id} name="school"/>
                    <div></div>
                    <label htmlFor={"degree"+entry.id}>Degree: </label>
                    <input type="text" id={"degree"+entry.id} name="degree" />
                    <div></div>
                    <label htmlFor={"yearsEdu"+entry.id}>Years active: </label>
                    <input type="text" id={"yearsEdu"+entry.id} name="yearsEdu"/>
                    <div></div>
                    <button type="button" onClick={()=>setEducationEntries(educationEntries.filter(item => item.id !== entry.id))}>Delete</button>
                </form>
                <div>Entry #{entry.id}</div>
            </fieldset>))}
           
            <button type="button" onClick={()=>setEducationEntries([...educationEntries,{id: crypto.randomUUID(),school:"",degree:"",yearsActive:""}])}>Add Another</button>
            <div></div>
            <button type="button">Update</button>

        </div>
    )
}
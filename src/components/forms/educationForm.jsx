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
                    <label htmlFor="school">Institution: </label>
                    <input type="text" id="school" name="school"/>
                    <div></div>
                    <label htmlFor="degree">Degree: </label>
                    <input type="text" id="degree" name="degree" />
                    <div></div>
                    <label htmlFor="yearsEdu">Years active: </label>
                    <input type="text" id="yearsEdu" name="yearsEdu"/>
                    <div></div>
                    <button type="button" onClick={()=>setEducationEntries(educationEntries.filter(item => item.id !== entry.id))}>Delete</button>
                </form>
                <div>Entry #{entry.id}</div>
            </fieldset>))}
           
            <button type="button" onClick={()=>setEducationEntries([...educationEntries,{id: crypto.randomUUID(),school:"",degree:"",yearsActive:""}])}>Add Another</button>
            <div></div>
            <button type="submit">Update</button>

        </div>
    )
}
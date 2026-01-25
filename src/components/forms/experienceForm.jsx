import { useState } from "react";

export default function ExperienceForm() {

    const [experienceEntries,setExperienceEntries] = useState([
            {id: crypto.randomUUID(), company:"",activites:"",yearsExp:""}
        ])

    function handleSubmit(e) {
        e.preventDefault();
    }

    return (
        <div>
            {experienceEntries.map((entry)=> (
                <fieldset key={entry.id}>
                    <form onSubmit={handleSubmit}>
                        <label htmlFor="company">Company: </label>
                        <input type="text" id="company" name="company"/>
                        <div></div>
                        <label htmlFor="activites">Description of activites: </label>
                        <textarea id="activites" name="activites"></textarea>
                        <div></div>
                        <label htmlFor="yearsExp">Years active: </label>
                        <input type="text" id="yearsExp" name="yearsExp"/>
                        <div></div>
                        <button type="button" onClick={()=>setExperienceEntries(experienceEntries.filter(item => item.id !== entry.id))}>Delete</button>
                    </form>
                    <div>Entry #{entry.id}</div>
                </fieldset> ))}

            <button type="button" onClick={()=>setExperienceEntries([...experienceEntries,{id: crypto.randomUUID(),company:"",activites:"",yearsExp:""}])}>Add Another</button>
            <div></div>
            <button type="submit">Update Resume</button>
        </div>
    )
}
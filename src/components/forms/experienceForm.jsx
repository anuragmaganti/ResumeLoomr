export default function ExperienceForm({experience,setResume}) {


    function handleSubmit(e) {
        e.preventDefault();
    }

    // return (
    //     <div>
    //         {experienceEntries.map((entry)=> (
    //         <fieldset key={entry.id}>
    //             <form onSubmit={handleSubmit}>
    //                 <label htmlFor={"company"+entry.id}>Company: </label>
    //                 <input type="text" id={"company"+entry.id} name="company"/>
    //                 <div></div>
    //                 <label htmlFor={"activites"+entry.id}>Description of activites: </label>
    //                 <textarea id={"activites"+entry.id} name="activites"></textarea>
    //                 <div></div>
    //                 <label htmlFor={"yearsExp"+entry.id}>Years active: </label>
    //                 <input type="text" id={"yearsExp"+entry.id} name="yearsExp"/>
    //                 <div></div>
    //                 <button type="button" onClick={()=>setExperienceEntries(experienceEntries.filter(item => item.id !== entry.id))}>Delete</button>
    //             </form>
    //             <div>Entry #{entry.id}</div>
    //         </fieldset> ))}
    //         <button type="button" onClick={()=>setExperienceEntries([...experienceEntries,{id: crypto.randomUUID(),company:"",activites:"",yearsExp:""}])}>Add Another</button>
    //         <div></div>
    //         <button type="button">Update Resume</button>
    //     </div>
    // )

    return (
        <div>
            {experience.map((entry)=>(
            <fieldset key={entry.id}>
                <form onSubmit={handleSubmit}>
                    <label htmlFor={"company"+entry.id}>Company: </label>
                    <input type="text" id={"company"+entry.id} name="company" value={entry.company} onChange={
                        (e)=>setResume(
                            prev => (
                                {...prev,
                                experience: prev.experience.map( item =>
                                    item.id === entry.id ? {...item, company: e.target.value} : item
                                )
                                }
                            )
                            
                        )
                        }/>
                    <div></div>
                    <label htmlFor={"activities"+entry.id}>Activities: </label>
                    <input type="text" id={"activities"+entry.id} name="activities" value={entry.activities} onChange={
                        (e)=>setResume(
                            prev => (
                                {...prev,
                                experience: prev.experience.map( item =>
                                    item.id === entry.id ? {...item, activities: e.target.value} : item
                                )
                                }
                            )
                            
                        )
                        }/>
                    <div></div>
                    <label htmlFor={"yearsExp"+entry.id}>Years active: </label>
                    <input type="text" id={"yearsExp"+entry.id} name="yearsExp"value={entry.yearsExp} onChange={
                        (e)=>setResume(
                            prev => (
                                {...prev,
                                experience: prev.experience.map( item =>
                                    item.id === entry.id ? {...item, yearsExp: e.target.value} : item
                                )
                                }
                            )
                            
                        )
                        }/>
                    <div></div>
                    <button type="button" onClick={()=> setResume(
                        prev => (
                            {...prev,
                                experience: prev.experience.filter(
                                    item => 
                                        item.id !== entry.id
                                )
                            }
                        )
                    )}>Delete</button>

                </form>
                <div>Entry #{entry.id}</div>
            </fieldset>))}
           
            <button type="button" onClick={()=>setResume(
                prev=> (
                    {...prev,
                        experience: [...prev.experience,{id: crypto.randomUUID(),company:"",activities:"",yearsExp:""}]
                    }
                )
            )}>Add Another</button>
            <div></div>
            <button type="button">Update</button>

        </div>
    )
}
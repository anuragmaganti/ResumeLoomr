export default function ExperienceForm({experience,setResume}) {

    function updateActivity(entryId, activityIndex, newValue) {
        setResume(prev => ({
            ...prev,
            experience: prev.experience.map(item =>
            item.id === entryId
                ? {
                    ...item,
                    activities: item.activities.map((activity, i) =>
                    i === activityIndex ? newValue : activity
                    )
                }
                : item
            )
        }));
    }

    function addActivity(entryId) {
        setResume(prev => ({
            ...prev,
            experience: prev.experience.map(item =>
            item.id === entryId
                ? { ...item, activities: [...item.activities, ""] }
                : item
            )
        }));
    }

    function deleteActivity(entryId, activityIndex) {
        setResume(prev => ({
            ...prev,
            experience: prev.experience.map(item =>
            item.id === entryId
                ? {
                    ...item,
                    activities: [
                    ...item.activities.slice(0, activityIndex),
                    ...item.activities.slice(activityIndex + 1)
                    ]
                }
                : item
            )
        }));
    }



    function handleSubmit(e) {
        e.preventDefault();
    }

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
                    {entry.activities.map((activity, activityIndex) => (
                        <div key={activityIndex} >
                            <textarea type="text" value={activity} onChange={(e) => updateActivity(entry.id, activityIndex, e.target.value) }/>
                            <button type="button" onClick={() => deleteActivity(entry.id, activityIndex)}> Delete activity </button>
                        </div>
                    ))}

                    <button type="button" onClick={() => addActivity(entry.id)}>
                    Add activity
                    </button>
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
            </fieldset>))}
           
            <button type="button" onClick={()=>setResume(
                prev=> (
                    {...prev,
                        experience: [...prev.experience,{id: crypto.randomUUID(),company:"",role:"",activities:[""],yearsExp:""}]
                    }
                )
            )}>Add Another</button>
            <div></div>

        </div>
    )
}
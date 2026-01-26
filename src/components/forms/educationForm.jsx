export default function EducationForm({education,setResume}) {


    function handleSubmit(e) {
        e.preventDefault();
    }

    return (
        <div>
            {education.map((entry)=>(
            <fieldset key={entry.id}>
                <form onSubmit={handleSubmit}>
                    <label htmlFor={"school"+entry.id}>Institution: </label>
                    <input type="text" id={"school"+entry.id} name="school" value={entry.school} onChange={
                        (e)=>setResume(
                            prev => (
                                {...prev,
                                education: prev.education.map( item =>
                                    item.id === entry.id ? {...item, school: e.target.value} : item
                                )
                                }
                            )
                            
                        )
                        }/>
                    <div></div>
                    <label htmlFor={"degree"+entry.id}>Degree: </label>
                    <input type="text" id={"degree"+entry.id} name="degree" value={entry.degree} onChange={
                        (e)=>setResume(
                            prev => (
                                {...prev,
                                education: prev.education.map( item =>
                                    item.id === entry.id ? {...item, degree: e.target.value} : item
                                )
                                }
                            )
                            
                        )
                        }/>
                    <div></div>
                    <label htmlFor={"yearsEdu"+entry.id}>Years active: </label>
                    <input type="text" id={"yearsEdu"+entry.id} name="yearsEdu"value={entry.yearsEdu} onChange={
                        (e)=>setResume(
                            prev => (
                                {...prev,
                                education: prev.education.map( item =>
                                    item.id === entry.id ? {...item, yearsEdu: e.target.value} : item
                                )
                                }
                            )
                            
                        )
                        }/>
                    <div></div>
                    <button type="button" onClick={()=> setResume(
                        prev => (
                            {...prev,
                                education: prev.education.filter(
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
                        education: [...prev.education,{id: crypto.randomUUID(),company:"",activites:"",yearsExp:""}]
                    }
                )
            )}>Add Another</button>
            <div></div>
            <button type="button">Update</button>

        </div>
    )
}
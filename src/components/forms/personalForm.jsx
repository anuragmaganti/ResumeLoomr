export default function PersonalForm({personal,setResume}) {

    function handleSubmit(e) {
        e.preventDefault();
    }

    function updatePersonal(e){
        const personalInput=e.target.name;
        const newValue=e.target.value;

        setResume(prev => (
            {...prev, personal: {...prev.personal, [personalInput]:newValue}}
            )
        )
    }


    return (
        <div>
            <fieldset>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="name">First and Last Name: </label>
                    <input type="text" id="name" name="name" value={personal.name} onChange={(e)=> updatePersonal(e)}/>
                    <div></div>
                    <label htmlFor="phone">Phone Number: </label>
                    <input type="text" id="phone" name="phone" value={personal.phone} onChange={(e)=>updatePersonal(e)}/>
                    <div></div>
                    <label htmlFor="email">Email Address: </label>
                    <input type="text" id="email" name="email" value={personal.email} onChange={(e)=>updatePersonal(e)}/>
                    <div></div>
                </form>
            </fieldset>
        </div>
    )
}
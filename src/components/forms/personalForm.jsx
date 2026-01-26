export default function PersonalForm({personal,setResume}) {

    function handleSubmit(e) {
        e.preventDefault();
    }

    return (
        <div>
            <fieldset>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="name">First and Last Name: </label>
                    <input type="text" id="name" name="name" value={personal.name} onChange={(e)=> setResume(prev => (
                        {...prev, personal: {...prev.personal, name:e.target.value}}
                    )
                    )}/>
                    <div></div>
                    <label htmlFor="phone">Phone Number: </label>
                    <input type="text" id="phone" name="phone" value={personal.phone} onChange={(e)=> setResume(prev => (
                        {...prev, personal: {...prev.personal, phone: e.target.value}}
                    )
                    )}/>


                    <div></div>
                    <label htmlFor="email">Email Address: </label>
                    <input type="text" id="email" name="email" value={personal.email} onChange={(e) => setResume(prev => (
                        {...prev,personal: {...prev.personal, email: e.target.value}}
                    )
                    )}/>
                    <div></div>
                    <button type="submit">Update</button>
                </form>
            </fieldset>
        </div>
        
    )
}
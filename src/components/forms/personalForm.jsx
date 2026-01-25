export default function PersonalForm() {

    function handleSubmit(e) {
        e.preventDefault();
    }

    return (
        <div>
            <fieldset>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="name">First and Last Name: </label>
                    <input type="text" id="name" name="name"/>
                    <div></div>
                    <label htmlFor="number">Phone Number: </label>
                    <input type="text" id="number" name="number"/>
                    <div></div>
                    <label htmlFor="email">Email Address: </label>
                    <input type="text" id="email" name="email"/>
                    <div></div>
                    <button type="submit">Update</button>
                </form>
            </fieldset>
        </div>
        
    )
}
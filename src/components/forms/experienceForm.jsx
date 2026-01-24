export default function ExperienceForm() {
    function handleSubmit(e) {
        e.preventDefault();
    }

    return (
        <fieldset>
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
                <button type="submit">Update</button>
            </form>
        </fieldset>
    )
}
export default function EducationForm() {
    function handleSubmit(e) {
        e.preventDefault();
    }

    return (
        <fieldset>
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
                <button type="submit">Update</button>
            </form>
        </fieldset>
    )
}
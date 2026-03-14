function FieldError({ message }) {
    if (!message) {
        return null;
    }

    return <p className="fieldError">{message}</p>;
}

export default function PersonalForm({ personal, actions, getFieldError, markTouched }) {
    return (
        <fieldset className="formSection formSectionSingle">
            <div className="entryHeader">
                <div>
                    <h3>Core information</h3>
                </div>
            </div>

            <form onSubmit={(event) => event.preventDefault()}>
                <div className="field">
                    <label htmlFor="name">Full name</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={personal.name}
                        onChange={(event) => actions.updatePersonalField('name', event.target.value)}
                        onBlur={() => markTouched('personal.name')}
                        placeholder="Jordan Lee"
                    />
                    <FieldError message={getFieldError('personal.name')} />
                </div>

                <div className="fieldGrid fieldGridTwo">
                    <div className="field">
                        <label htmlFor="phone">Phone number</label>
                        <input
                            type="text"
                            id="phone"
                            name="phone"
                            value={personal.phone}
                            onChange={(event) => actions.updatePersonalField('phone', event.target.value)}
                            onBlur={() => markTouched('personal.phone')}
                            placeholder="(555) 123-4567"
                        />
                        <FieldError message={getFieldError('personal.phone')} />
                    </div>

                    <div className="field">
                        <label htmlFor="email">Email address</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={personal.email}
                            onChange={(event) => actions.updatePersonalField('email', event.target.value)}
                            onBlur={() => markTouched('personal.email')}
                            placeholder="jordan@example.com"
                        />
                        <FieldError message={getFieldError('personal.email')} />
                    </div>
                </div>

                <div className="field">
                    <label htmlFor="aboutMe">Professional summary</label>
                    <textarea
                        id="aboutMe"
                        name="aboutMe"
                        value={personal.aboutMe}
                        onChange={(event) => actions.updatePersonalField('aboutMe', event.target.value)}
                        onBlur={() => markTouched('personal.aboutMe')}
                        rows="6"
                        placeholder="Write a short summary that highlights your experience, strengths, and goals."
                    />
                </div>
            </form>
        </fieldset>
    )
}

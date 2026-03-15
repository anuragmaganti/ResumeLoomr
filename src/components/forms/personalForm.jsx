import AutoResizeTextarea from "../autoResizeTextarea";
import FormFieldError from "./formFieldError";

export default function PersonalForm({ personal, actions, getFieldError, markTouched }) {
    return (
        <fieldset className="formSection">
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
                    <FormFieldError message={getFieldError('personal.name')} />
                </div>

                <div className="fieldGrid fieldGridTwo">
                    <div className="field">
                        <label htmlFor="headline">Professional headline</label>
                        <input
                            type="text"
                            id="headline"
                            name="headline"
                            value={personal.headline}
                            onChange={(event) => actions.updatePersonalField('headline', event.target.value)}
                            onBlur={() => markTouched('personal.headline')}
                            placeholder="Frontend Engineer"
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="location">Location</label>
                        <input
                            type="text"
                            id="location"
                            name="location"
                            value={personal.location}
                            onChange={(event) => actions.updatePersonalField('location', event.target.value)}
                            onBlur={() => markTouched('personal.location')}
                            placeholder="New York, NY"
                        />
                    </div>
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
                        <FormFieldError message={getFieldError('personal.phone')} />
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
                        <FormFieldError message={getFieldError('personal.email')} />
                    </div>
                </div>

                <div className="fieldGrid fieldGridTwo">
                    <div className="field">
                        <label htmlFor="linkedinUrl">LinkedIn URL</label>
                        <input
                            type="text"
                            id="linkedinUrl"
                            name="linkedinUrl"
                            value={personal.linkedinUrl}
                            onChange={(event) => actions.updatePersonalField('linkedinUrl', event.target.value)}
                            onBlur={() => markTouched('personal.linkedinUrl')}
                            placeholder="linkedin.com/in/jordanlee"
                        />
                        <FormFieldError message={getFieldError('personal.linkedinUrl')} />
                    </div>

                    <div className="field">
                        <label htmlFor="githubUrl">GitHub URL</label>
                        <input
                            type="text"
                            id="githubUrl"
                            name="githubUrl"
                            value={personal.githubUrl}
                            onChange={(event) => actions.updatePersonalField('githubUrl', event.target.value)}
                            onBlur={() => markTouched('personal.githubUrl')}
                            placeholder="github.com/jordanlee"
                        />
                        <FormFieldError message={getFieldError('personal.githubUrl')} />
                    </div>
                </div>

                <div className="fieldGrid fieldGridTwo">
                    <div className="field">
                        <label htmlFor="portfolioUrl">Portfolio or website</label>
                        <input
                            type="text"
                            id="portfolioUrl"
                            name="portfolioUrl"
                            value={personal.portfolioUrl}
                            onChange={(event) => actions.updatePersonalField('portfolioUrl', event.target.value)}
                            onBlur={() => markTouched('personal.portfolioUrl')}
                            placeholder="jordanlee.com"
                        />
                        <FormFieldError message={getFieldError('personal.portfolioUrl')} />
                    </div>

                    <div className="field">
                        <label htmlFor="customField">Custom field</label>
                        <input
                            type="text"
                            id="customField"
                            name="customField"
                            value={personal.customField}
                            onChange={(event) => actions.updatePersonalField('customField', event.target.value)}
                            onBlur={() => markTouched('personal.customField')}
                            placeholder="Behance: behance.net/jordanlee"
                        />
                    </div>
                </div>

                <div className="field">
                    <label htmlFor="aboutMe">Professional summary</label>
                    <AutoResizeTextarea
                        id="aboutMe"
                        name="aboutMe"
                        value={personal.aboutMe}
                        onChange={(event) => actions.updatePersonalField('aboutMe', event.target.value)}
                        onBlur={() => markTouched('personal.aboutMe')}
                        rows={2}
                        placeholder="Write a short summary that highlights your experience, strengths, and goals."
                    />
                </div>
            </form>
        </fieldset>
    )
}

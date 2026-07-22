import AutoResizeTextarea from "../autoResizeTextarea";
import FormFieldError from "./formFieldError";
import { createEditorTargetAttributes, personalEditorPath } from "../../lib/editorTargets";

export default function PersonalForm({ personal, actions, getFieldError, markTouched, placeholderFor }) {
    const placeholder = (field, fallback) => placeholderFor?.(personalEditorPath(field), fallback) || fallback;

    return (
        <fieldset className="formSection">
            <form onSubmit={(event) => event.preventDefault()}>
                <div className="field">
                    <label htmlFor="name">Full name</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        {...createEditorTargetAttributes(personalEditorPath('name'))}
                        value={personal.name}
                        onChange={(event) => actions.updatePersonalField('name', event.target.value)}
                        onBlur={() => markTouched('personal.name')}
                        placeholder={placeholder('name', 'Jordan Lee')}
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
                            {...createEditorTargetAttributes(personalEditorPath('headline'))}
                            value={personal.headline}
                            onChange={(event) => actions.updatePersonalField('headline', event.target.value)}
                            onBlur={() => markTouched('personal.headline')}
                            placeholder={placeholder('headline', 'Frontend Engineer')}
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="location">Location</label>
                        <input
                            type="text"
                            id="location"
                            name="location"
                            {...createEditorTargetAttributes(personalEditorPath('location'))}
                            value={personal.location}
                            onChange={(event) => actions.updatePersonalField('location', event.target.value)}
                            onBlur={() => markTouched('personal.location')}
                            placeholder={placeholder('location', 'New York, NY')}
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
                            {...createEditorTargetAttributes(personalEditorPath('phone'))}
                            value={personal.phone}
                            onChange={(event) => actions.updatePersonalField('phone', event.target.value)}
                            onBlur={() => markTouched('personal.phone')}
                            placeholder={placeholder('phone', '(555) 123-4567')}
                        />
                        <FormFieldError message={getFieldError('personal.phone')} />
                    </div>

                    <div className="field">
                        <label htmlFor="email">Email address</label>
                        <input
                            type="text"
                            inputMode="email"
                            autoComplete="email"
                            id="email"
                            name="email"
                            {...createEditorTargetAttributes(personalEditorPath('email'))}
                            value={personal.email}
                            onChange={(event) => actions.updatePersonalField('email', event.target.value)}
                            onBlur={() => markTouched('personal.email')}
                            placeholder={placeholder('email', 'jordan@example.com')}
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
                            {...createEditorTargetAttributes(personalEditorPath('linkedinUrl'))}
                            value={personal.linkedinUrl}
                            onChange={(event) => actions.updatePersonalField('linkedinUrl', event.target.value)}
                            onBlur={() => markTouched('personal.linkedinUrl')}
                            placeholder={placeholder('linkedinUrl', 'linkedin.com/in/jordanlee')}
                        />
                        <FormFieldError message={getFieldError('personal.linkedinUrl')} />
                    </div>

                    <div className="field">
                        <label htmlFor="githubUrl">GitHub URL</label>
                        <input
                            type="text"
                            id="githubUrl"
                            name="githubUrl"
                            {...createEditorTargetAttributes(personalEditorPath('githubUrl'))}
                            value={personal.githubUrl}
                            onChange={(event) => actions.updatePersonalField('githubUrl', event.target.value)}
                            onBlur={() => markTouched('personal.githubUrl')}
                            placeholder={placeholder('githubUrl', 'github.com/jordanlee')}
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
                            {...createEditorTargetAttributes(personalEditorPath('portfolioUrl'))}
                            value={personal.portfolioUrl}
                            onChange={(event) => actions.updatePersonalField('portfolioUrl', event.target.value)}
                            onBlur={() => markTouched('personal.portfolioUrl')}
                            placeholder={placeholder('portfolioUrl', 'jordanlee.com')}
                        />
                        <FormFieldError message={getFieldError('personal.portfolioUrl')} />
                    </div>

                    <div className="field">
                        <label htmlFor="customField">Custom field</label>
                        <input
                            type="text"
                            id="customField"
                            name="customField"
                            {...createEditorTargetAttributes(personalEditorPath('customField'))}
                            value={personal.customField}
                            onChange={(event) => actions.updatePersonalField('customField', event.target.value)}
                            onBlur={() => markTouched('personal.customField')}
                            placeholder={placeholder('customField', 'Behance: behance.net/jordanlee')}
                        />
                    </div>
                </div>

                <div className="field">
                    <label htmlFor="aboutMe">Professional summary</label>
                    <AutoResizeTextarea
                        id="aboutMe"
                        name="aboutMe"
                        {...createEditorTargetAttributes(personalEditorPath('aboutMe'))}
                        value={personal.aboutMe}
                        onChange={(event) => actions.updatePersonalField('aboutMe', event.target.value)}
                        onBlur={() => markTouched('personal.aboutMe')}
                        rows={2}
                        placeholder={placeholder('aboutMe', 'Write a short summary that highlights your experience, strengths, and goals.')}
                    />
                </div>
            </form>
        </fieldset>
    )
}

export default function ResumePreview({resume}) {
    return (
        <div>
            <h1>{resume.personal.name}</h1>
            <h2>{resume.personal.phone}</h2>
            <h2>{resume.personal.email}</h2>
        </div>
    )
}
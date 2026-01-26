export default function ResumePreview({resume}) {
    

    return (
        <div>
            <div className="personalSection">
                <h1>{resume.personal.name}</h1>
                <h3>{resume.personal.phone}</h3>
                <h3>{resume.personal.email}</h3>
            </div>

            <div></div>

            <div>
                <h2>Education</h2>
                {resume.education.map((item) => (
                    <div>
                        <div>{item.school}</div>
                        <div>{item.yearsEdu}</div>
                        <div>{item.degree}</div>
                    </div>
                ))}
            </div>

            <div></div>
            
            <div>
                <h2>Experience</h2>
                {resume.experience.map((item) => (
                    <div>
                        <div>{item.company}</div>
                        <div>{item.yearsExp}</div>
                        <div>{item.activities}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}
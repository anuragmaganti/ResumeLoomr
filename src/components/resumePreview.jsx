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
                {resume.education.map((institution) => (
                    <div key={institution.id}>
                        <h3>{institution.school}</h3>
                        <div>{institution.yearsEdu}</div>
                        <div>{institution.degree}</div>
                    </div>
                ))}
            </div>

            <div></div>
            
            <div>
            <h2>Experience</h2>
                {resume.experience.map((job) => (
                    <div key={job.id}>
                    <h3>{job.company}</h3>
                    <div>{job.yearsExp}</div>

                    <ul>
                        {job.activities .filter(a => a.trim() !== "").map((activity, i) => (
                        <li key={i}>{activity}</li>
                        ))}
                    </ul>
                    </div>
                ))}
            </div>

        </div>
    )
}
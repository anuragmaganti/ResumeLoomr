export default function ResumePreview({resume}) {

    return (
        <div className="resumePage">

            <div className="personalSection">
                <h1>{resume.personal.name}</h1>
                <div className="phoneEmail">
                    <div>{resume.personal.phone}</div>
                    <div>{resume.personal.email}</div>
                </div>
                <div className="aboutMe">{resume.personal.aboutMe}</div>
            </div>

            <div className="educationDiv">
                <h2>Education</h2>
                {resume.education.map((institution) => (
                    <div className="educationSection" key={institution.id}>
                        <div className="degreeYearsEduFlex">
                            <div className="degree">{institution.degree}</div>
                            <div className="yearsEdu">{institution.yearsEdu}</div>
                        </div>
                        <div className="school" >{institution.school}</div>
                    </div>
                ))}
            </div>
            
            <div className="experienceDiv">
                <h2>Experience</h2>
                {resume.experience.map((job) => (
                    <div className="experienceSection">
                        <div key={job.id}>
                        <div className="companyYearsExpFlex">
                            <div className="company">{job.company}</div>
                            <div className="yearsExp">{job.yearsExp}</div>
                        </div>
                        <div className="role">{job.role}</div>
                        <ul>
                            {job.activities .filter(a => a.trim() !== "").map((activity, i) => (
                            <div className="activityDiv">
                                <li key={i}>{activity}</li>
                            </div>
                            ))}
                        </ul>
                    </div>
                    </div>
                ))}
            </div>

        </div>
    )
}
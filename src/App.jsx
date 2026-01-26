import { useState } from 'react'
import './App.css'
import Header from './components/header';
import ResumePreview from './components/resumePreview';
import EditorPanel from './components/EditorPanel';


function App() {

  const [resume,setResume] = useState(

  {
  personal:{name:"",phone:"",email:""},
  education:[{id: crypto.randomUUID(), school:"",degree:"",yearsEdu:""}],
  experience:[{id: crypto.randomUUID(),company:"",activites:"",yearsExp:""}]
  }

  );

  const [activeTab,setActiveTab] = useState("personal");

  return (
    <div className="app">
      <Header></Header>
      <div className="main">
        <EditorPanel activeTab={activeTab} setActiveTab={setActiveTab} resume={resume} setResume={setResume}></EditorPanel>
        <ResumePreview></ResumePreview>
      </div>
    </div>
  )
}

export default App
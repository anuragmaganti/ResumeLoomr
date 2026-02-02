import { useState } from 'react'
import './App.css'
import './styles/buttons.css'
import './styles/forms.css'
import './styles/preview.css'
import Header from './components/header';
import ResumePreview from './components/resumePreview';
import EditorPanel from './components/editorPanel';
import { Analytics } from "@vercel/analytics/react";



function App() {

  const [resume,setResume] = useState(

  {
  personal:{name:"",phone:"",email:"",aboutMe:""},
  education:[{id: crypto.randomUUID(), school:"",degree:"",yearsEdu:""}],
  experience:[{id: crypto.randomUUID(),company:"",role:"",activities:[""],yearsExp:""}]
  }

  );

  const [activeTab,setActiveTab] = useState("personal");

  return (
    <div className="app">
      <div className='headerAndPrint'>
        <Header></Header>
       
        <button className="printButton" onClick={() => window.print()}><span class="printIcon"></span></button>
      </div>
      <div className="main">
        <EditorPanel activeTab={activeTab} setActiveTab={setActiveTab} resume={resume} setResume={setResume}></EditorPanel>
        <ResumePreview resume={resume}></ResumePreview>
      </div>
      <Analytics></Analytics>
    </div>
  )
}

export default App
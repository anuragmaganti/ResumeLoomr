import { useState } from 'react'
import './App.css'
import Header from './components/header';
import ResumePreview from './components/resumePreview';
import EditorPanel from './components/EditorPanel';

import resumeObject from "./components/getDataFromResume";
window.resume = resumeObject;



function App() {

  const [resume,setResume] = useState(

  {
  personal:{name:"",phone:"",email:""},
  education:[{id: crypto.randomUUID(), school:"",degree:"",yearsEdu:""}],
  experience:[{id: crypto.randomUUID(),company:"",activities:"",yearsExp:""}]
  }

  );

  const [activeTab,setActiveTab] = useState("personal");

  return (
    <div className="app">
      <Header></Header>
      <div className="main">
        <EditorPanel activeTab={activeTab} setActiveTab={setActiveTab} resume={resume} setResume={setResume}></EditorPanel>
        <ResumePreview resume={resume}></ResumePreview>
      </div>
    </div>
  )
}

export default App
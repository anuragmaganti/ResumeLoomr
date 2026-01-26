import { useState } from 'react'
import './App.css'
import Header from './components/header';
import ResumePreview from './components/resumePreview';
import EditorPanel from './components/EditorPanel';


function App() {

  const [resume,setResume] = useState(

  {
  personal:{name:"",phone:"",email:""},
  education:[{school:"",degree:"",yearsActive:""}],
  experience:[{company:"",activites:"",yearsExp:""}]
  }

  );

  const [activeTab,setActiveTab] = useState("personal");

  return (
    <div className="app">
      <Header></Header>
      <div className="main">
        <EditorPanel activeTab={activeTab} setActiveTab={setActiveTab}></EditorPanel>
        <ResumePreview></ResumePreview>
      </div>
    </div>
  )
}

export default App
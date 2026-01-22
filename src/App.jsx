import { Children, useState } from 'react'
import './App.css'
import Header from './components/header';
import ResumePreview from './components/resumePreview';
import EditorPanel from './components/EditorPanel';

function App() {

  const [activeTab,setActiveTab] = useState("personal");

  return (
    <>
    <Header></Header>
    <div className="main">
      <EditorPanel></EditorPanel>
      <ResumePreview></ResumePreview>
    </div>
    </>
  )
}

export default App

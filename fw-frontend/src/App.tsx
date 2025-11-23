import { Routes, Route } from 'react-router-dom';
import ExpertSelector from './pages/ExpertSelector';
import Analysis from './pages/Analysis';
import ExpertManage from './pages/ExpertManage';
import ExpertEdit from './pages/ExpertEdit';
import Chat from './pages/Chat';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ExpertSelector />} />
      <Route path="/analysis" element={<Analysis />} />
      <Route path="/expert/manage" element={<ExpertManage />} />
      <Route path="/expert/edit" element={<ExpertEdit />} />
      <Route path="/chat" element={<Chat />} />
    </Routes>
  );
}

export default App;


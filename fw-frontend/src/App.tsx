import { Routes, Route } from 'react-router-dom';
import ExpertSelector from './pages/ExpertSelector';
import Analysis from './pages/Analysis';
import ExpertManage from './pages/ExpertManage';
import ExpertEdit from './pages/ExpertEdit';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ExpertSelector />} />
      <Route path="/analysis" element={<Analysis />} />
      <Route path="/expert/manage" element={<ExpertManage />} />
      <Route path="/expert/edit" element={<ExpertEdit />} />
    </Routes>
  );
}

export default App;


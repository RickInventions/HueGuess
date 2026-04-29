import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { CasualPage } from '@/pages/CasualPage';
import { CompetitivePage } from '@/pages/CompetitivePage';
import { ChallengePage } from '@/pages/ChallengePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/casual" element={<CasualPage />} />
          <Route path="/competitive" element={<CompetitivePage />} />
          <Route path="/challenge" element={<ChallengePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
import { Routes, Route, Navigate } from "react-router";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Structure from "./pages/Structure";
import Production from "./pages/Production";
import BatchDetail from "./pages/BatchDetail";
import Transfers from "./pages/Transfers";
import Schedule from "./pages/Schedule";
import Feed from "./pages/Feed";
import Warehouse from "./pages/Warehouse";
import Health from "./pages/Health";
import Economics from "./pages/Economics";
import Erd from "./pages/Erd";
import Analytics from "./pages/Analytics";
import AiAdvisor from "./pages/AiAdvisor";
import Erp from "./pages/Erp";
import NutritionLab from "./pages/NutritionLab";
import CommandCenter from "./pages/CommandCenter";
import Editions from "./pages/Editions";
import Coverage from "./pages/Coverage";
import Integrations from "./pages/Integrations";
import FarmSelect from "./pages/FarmSelect";
import Slaughter from "./pages/Slaughter";
import Obchod from "./pages/Obchod";
import Normy from "./pages/Normy";
import NotFound from "./pages/NotFound";
import { getWorkspace } from "./lib/workspace";

const L = (el: React.ReactNode) =>
  getWorkspace() ? <Layout>{el}</Layout> : <Navigate to="/wybierz-gospodarstwo" replace />;

export default function App() {
  return (
    <Routes>
      <Route path="/wybierz-gospodarstwo" element={<FarmSelect />} />
      <Route path="/" element={L(<Dashboard />)} />
      <Route path="/centrum-decyzji" element={L(<CommandCenter />)} />
      <Route path="/struktura" element={L(<Structure />)} />
      <Route path="/produkcja" element={L(<Production />)} />
      <Route path="/produkcja/:id" element={L(<BatchDetail />)} />
      <Route path="/transfery" element={L(<Transfers />)} />
      <Route path="/harmonogram" element={L(<Schedule />)} />
      <Route path="/zywienie" element={L(<Feed />)} />
      <Route path="/laboratorium-zywienia" element={L(<NutritionLab />)} />
      <Route path="/magazyn" element={L(<Warehouse />)} />
      <Route path="/zdrowie" element={L(<Health />)} />
      <Route path="/ekonomia" element={L(<Economics />)} />
      <Route path="/analityka" element={L(<Analytics />)} />
      <Route path="/ai" element={L(<AiAdvisor />)} />
      <Route path="/erp/:module" element={L(<Erp />)} />
      <Route path="/erp" element={L(<Erp />)} />
      <Route path="/erd" element={L(<Erd />)} />
      <Route path="/wersje" element={L(<Editions />)} />
      <Route path="/raport-architektury" element={L(<Coverage />)} />
      <Route path="/integracje" element={L(<Integrations />)} />
      <Route path="/ubojnia" element={L(<Slaughter />)} />
      <Route path="/obchod" element={L(<Obchod />)} />
      <Route path="/normy" element={L(<Normy />)} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

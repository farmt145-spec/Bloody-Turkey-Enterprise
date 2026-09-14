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
import Reports from "./pages/Reports";
import AdminPanel from "./pages/AdminPanel";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import { useAuth } from "./providers/auth";
import NotFound from "./pages/NotFound";
import { getWorkspace } from "./lib/workspace";

const RequireAuth = ({ el }: { el: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center bg-zinc-950">Loading...</div>;
  return isAuthenticated ? <>{el}</> : <Navigate to="/login" replace />;
};

const RequireWorkspace = ({ el }: { el: React.ReactNode }) =>
  getWorkspace() ? <Layout>{el}</Layout> : <Navigate to="/wybierz-gospodarstwo" replace />;

const AppRoute = (el: React.ReactNode) => <RequireAuth el={<RequireWorkspace el={el} />} />;

export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />
      <Route path="/wybierz-gospodarstwo" element={<RequireAuth el={<FarmSelect />} />} />
      <Route path="/" element={AppRoute(<Dashboard />)} />
      <Route path="/centrum-decyzji" element={AppRoute(<CommandCenter />)} />
      <Route path="/struktura" element={AppRoute(<Structure />)} />
      <Route path="/produkcja" element={AppRoute(<Production />)} />
      <Route path="/produkcja/:id" element={AppRoute(<BatchDetail />)} />
      <Route path="/transfery" element={AppRoute(<Transfers />)} />
      <Route path="/harmonogram" element={AppRoute(<Schedule />)} />
      <Route path="/zywienie" element={AppRoute(<Feed />)} />
      <Route path="/laboratorium-zywienia" element={AppRoute(<NutritionLab />)} />
      <Route path="/magazyn" element={AppRoute(<Warehouse />)} />
      <Route path="/zdrowie" element={AppRoute(<Health />)} />
      <Route path="/ekonomia" element={AppRoute(<Economics />)} />
      <Route path="/analityka" element={AppRoute(<Analytics />)} />
      <Route path="/ai" element={AppRoute(<AiAdvisor />)} />
      <Route path="/erp/:module" element={AppRoute(<Erp />)} />
      <Route path="/erp" element={AppRoute(<Erp />)} />
      <Route path="/erd" element={AppRoute(<Erd />)} />
      <Route path="/wersje" element={AppRoute(<Editions />)} />
      <Route path="/raport-architektury" element={AppRoute(<Coverage />)} />
      <Route path="/integracje" element={AppRoute(<Integrations />)} />
      <Route path="/ubojnia" element={AppRoute(<Slaughter />)} />
      <Route path="/obchod" element={AppRoute(<Obchod />)} />
      <Route path="/normy" element={AppRoute(<Normy />)} />
      <Route path="/admin" element={AppRoute(<AdminPanel />)} />
      <Route path="/raporty" element={AppRoute(<Reports />)} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

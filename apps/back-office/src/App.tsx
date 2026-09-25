import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Shell } from './components/Shell';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ParcelsList } from './pages/ParcelsList';
import { ParcelNew } from './pages/ParcelNew';
import { ParcelDetail } from './pages/ParcelDetail';
import { Tariffs } from './pages/Tariffs';
import { ExchangeRates } from './pages/ExchangeRates';
import { Users } from './pages/Users';
import { Branding } from './pages/Branding';
import { Reports } from './pages/Reports';
import { Cities } from './pages/Cities';
import { DeliveryPartners } from './pages/DeliveryPartners';
import { PartnerSettlements } from './pages/PartnerSettlements';
import { Suppliers } from './pages/Suppliers';
import { OkapiLoader } from './components/OkapiLoader';
import { SupplierPortal } from './pages/SupplierPortal';
import { Profile } from './pages/Profile';
import { Carriers } from './pages/Carriers';
import { Groupages, GroupageDetail } from './pages/Groupages';
import { StaffSupplierParcels } from './pages/StaffSupplierParcels';

function Guard({ perm, children }: { perm?: string; children: React.ReactNode }) {
  const { can } = useAuth();
  if (perm && !can(perm)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const { me, loading, isSupplierOnly, mfaSetupRequired } = useAuth();

  if (loading) {
    return (
      <div className="login-wrap">
        <div className="login-center">
          <OkapiLoader variant="boot" />
        </div>
      </div>
    );
  }
  if (!me) return <Login />;

  // Rôle à MFA obligatoire pas encore configurée — seule /profile est
  // joignable côté API (MfaEnforcementGuard) ; on force cet écran ici aussi
  // pour éviter une navigation vers des pages qui échoueraient en 403.
  if (mfaSetupRequired) {
    return (
      <Shell>
        <Profile />
      </Shell>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={isSupplierOnly ? <Navigate to="/supplier-portal" replace /> : <Dashboard />} />
        <Route
          path="/supplier-portal"
          element={<Guard perm="shipment:read"><SupplierPortal /></Guard>}
        />
        <Route path="/suppliers" element={<Guard perm="supplier:manage"><Suppliers /></Guard>} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/carriers" element={<Guard perm="carrier:manage"><Carriers /></Guard>} />
        <Route path="/parcels" element={<Guard perm="parcel:read"><ParcelsList /></Guard>} />
        <Route path="/parcels/new" element={<Guard perm="parcel:create"><ParcelNew /></Guard>} />
        <Route path="/parcels/:id" element={<Guard perm="parcel:read"><ParcelDetail /></Guard>} />
        <Route path="/groupages" element={<Guard perm="groupage:manage"><Groupages /></Guard>} />
        <Route path="/groupages/:id" element={<Guard perm="groupage:manage"><GroupageDetail /></Guard>} />
        <Route path="/supplier-parcels" element={<Guard perm="supplier-shipment:staff"><StaffSupplierParcels /></Guard>} />
        <Route path="/reports" element={<Guard perm="report:read"><Reports /></Guard>} />
        <Route path="/tariffs" element={<Guard perm="tariff:read"><Tariffs /></Guard>} />
        <Route path="/exchange-rates" element={<Guard perm="fx:read"><ExchangeRates /></Guard>} />
        <Route path="/users" element={<Guard perm="user:manage"><Users /></Guard>} />
        <Route path="/cities" element={<Guard perm="city:write"><Cities /></Guard>} />
        <Route path="/delivery-partners" element={<Guard perm="city:write"><DeliveryPartners /></Guard>} />
        <Route path="/partner-settlements" element={<Guard perm="settlement:read"><PartnerSettlements /></Guard>} />
        <Route path="/branding" element={<Guard perm="config:write"><Branding /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

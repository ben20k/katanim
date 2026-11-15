import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Shop from './pages/Shop.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import NotFound from './pages/NotFound.jsx';

import ManagerLayout from './pages/manager/ManagerLayout.jsx';
import Dashboard from './pages/manager/Dashboard.jsx';
import ManagerOrders from './pages/manager/ManagerOrders.jsx';
import OrderReview from './pages/manager/OrderReview.jsx';
import ManagerProducts from './pages/manager/ManagerProducts.jsx';
import PaymentMethods from './pages/manager/PaymentMethods.jsx';
import ShippingRates from './pages/manager/ShippingRates.jsx';

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Shop />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />

          <Route path="/manager" element={<ProtectedRoute manager><ManagerLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<ManagerOrders />} />
            <Route path="orders/:id" element={<OrderReview />} />
            <Route path="products" element={<ManagerProducts />} />
            <Route path="payment-methods" element={<PaymentMethods />} />
            <Route path="shipping" element={<ShippingRates />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

import { type ReactNode } from 'react';
import { Route, Switch, useLocation } from 'wouter';

import { CartProvider } from '@/lib/cart';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { CartDrawer } from '@/components/cart-drawer';
import { CapturePopup } from '@/components/capture-popup';
import { ScrollToTop } from '@/components/scroll-to-top';

import Home from '@/pages/home';
import Shop from '@/pages/shop';
import Product from '@/pages/product';
import Cart from '@/pages/cart';
import About from '@/pages/about';
import Lookbook from '@/pages/lookbook';
import Sizing from '@/pages/sizing';
import GarmentDyed from '@/pages/garment-dyed';
import { BlogIndex, BlogPost } from '@/pages/blog';
import Contact from '@/pages/contact';
import Account from '@/pages/account';
import OrderSuccess from '@/pages/order-success';
import { Shipping, Terms, Privacy } from '@/pages/legal';
import NotFound from '@/pages/not-found';
import { CATEGORIES } from '@/lib/products';

function Shell({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <ScrollToTop />
      <Header />
      {/* pt matches the fixed header so no page starts underneath it, except
          the home hero which deliberately runs to the top of the screen. */}
      <main>{children}</main>
      <Footer />
      <CartDrawer />
      <CapturePopup />
    </CartProvider>
  );
}

export default function App() {
  const [location] = useLocation();
  return (
    <Shell>
      <div key={location}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/shop" component={Shop} />
          {/* Category routes must be registered BEFORE the product route or a
              first-match router reads /shop/hoodies as a product slug. */}
          {CATEGORIES.map((c) => (
            <Route key={c.slug} path={`/shop/${c.slug}`} component={Shop} />
          ))}
          <Route path="/product/:slug" component={Product} />
          <Route path="/cart" component={Cart} />
          <Route path="/lookbook" component={Lookbook} />
          <Route path="/about" component={About} />
          <Route path="/sizing" component={Sizing} />
          <Route path="/garment-dyed" component={GarmentDyed} />
          <Route path="/blog" component={BlogIndex} />
          <Route path="/blog/:slug" component={BlogPost} />
          <Route path="/contact" component={Contact} />
          <Route path="/account" component={Account} />
          <Route path="/order/success" component={OrderSuccess} />
          <Route path="/shipping" component={Shipping} />
          <Route path="/terms" component={Terms} />
          <Route path="/privacy" component={Privacy} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </Shell>
  );
}

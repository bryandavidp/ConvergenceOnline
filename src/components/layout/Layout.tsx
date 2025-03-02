import * as React from 'react';
import { Outlet } from 'react-router-dom';

const Layout: React.FC = () => {
  return (
    <div>
      <header>Header</header>
      <main><Outlet /></main>
      <footer>Footer</footer>
    </div>
  );
};

export default Layout;

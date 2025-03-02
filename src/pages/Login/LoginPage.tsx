import * as React from 'react';

const LoginPage: React.FC = () => {
  return (
    <div className="login-page">
      <h1>Iniciar Sesión</h1>
      <form>
        <div>
          <label htmlFor="email">Email:</label>
          <input type="email" id="email" />
        </div>
        <div>
          <label htmlFor="password">Contraseña:</label>
          <input type="password" id="password" />
        </div>
        <button type="submit">Iniciar Sesión</button>
      </form>
    </div>
  );
};

export default LoginPage; 
import * as React from 'react';

const RegisterPage: React.FC = () => {
  return (
    <div className="register-page">
      <h1>Registro</h1>
      <form>
        <div>
          <label htmlFor="name">Nombre:</label>
          <input type="text" id="name" />
        </div>
        <div>
          <label htmlFor="email">Email:</label>
          <input type="email" id="email" />
        </div>
        <div>
          <label htmlFor="password">Contraseña:</label>
          <input type="password" id="password" />
        </div>
        <button type="submit">Registrarse</button>
      </form>
    </div>
  );
};

export default RegisterPage; 
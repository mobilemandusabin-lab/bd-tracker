import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, roles, permissions }) => {
  const { user, token } = useSelector((state) => state.auth);

  if (!token) {
    return <Navigate to="/login" />;
  }

  // Permission-based check (new RBAC)
  if (permissions && user) {
    // super_admin always passes
    if (user.role !== 'super_admin') {
      const userPerms = user.permissions || [];
      const hasPermission = permissions.some(p => userPerms.includes(p));
      if (!hasPermission) {
        return <Navigate to="/unauthorized" />;
      }
    }
  }

  // Role-based check (legacy, backward compat)
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
};

export default ProtectedRoute;

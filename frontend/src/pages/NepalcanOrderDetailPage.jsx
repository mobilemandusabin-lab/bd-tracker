import { useParams, useNavigate } from 'react-router-dom';
import NepalcanOrderDetails from '../components/NepalcanOrderDetails';

export default function NepalcanOrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  return <NepalcanOrderDetails orderId={orderId} onBack={() => navigate('/nepalcan-sales')} />;
}

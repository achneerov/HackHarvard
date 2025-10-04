import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function Dashboard() {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const merchantApiKey = localStorage.getItem('merchantApiKey');

      if (!merchantApiKey) {
        navigate('/');
        return;
      }

      try {
        const response = await fetch(`http://localhost:3001/api/dashboard/stats?merchantApiKey=${merchantApiKey}`);
        const data = await response.json();

        if (data.status === 1) {
          setDashboardData(data.data);
        } else {
          console.error('Failed to fetch dashboard data:', data.message);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('merchantAuth');
    localStorage.removeItem('merchantApiKey');
    localStorage.removeItem('merchantEmail');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 mb-2">Loading...</div>
          <p className="text-gray-600">Fetching dashboard data</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 mb-2">Error</div>
          <p className="text-gray-600">Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Merchant Dashboard</h2>
          <div className="flex gap-2">
            <button onClick={() => navigate('/dashboard')} className="px-4 py-2 rounded-md text-sm font-medium bg-purple-600 text-white">Dashboard</button>
            <button onClick={() => navigate('/rules')} className="px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Rules</button>
            <button onClick={handleLogout} className="px-4 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Transaction Overview</h1>
          <p className="text-gray-600">Monitor your merchant transactions and authentication events</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-xl p-6 flex gap-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">📊</div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Total Transactions</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">{dashboardData.totalTransactions}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 flex gap-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl flex-shrink-0">✅</div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Success Rate</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">{dashboardData.successRate}%</p>
              <span className="text-sm text-gray-600">{dashboardData.statusCounts.success} successful</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 flex gap-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center text-2xl flex-shrink-0">⚠️</div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Auth Required</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">{dashboardData.statusCounts.authRequired}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 flex gap-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-2xl flex-shrink-0">❌</div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Failed</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">{dashboardData.statusCounts.failure}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Transaction Timeline (Last 7 Days)</h3>
            {dashboardData.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dashboardData.timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="successful" stroke="#48bb78" strokeWidth={2} />
                  <Line type="monotone" dataKey="failed" stroke="#f56565" strokeWidth={2} />
                  <Line type="monotone" dataKey="flagged" stroke="#ed8936" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No transaction data in the last 7 days
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Location Distribution</h3>
            {dashboardData.locationStats.length > 0 ? (
              <div className="flex flex-col gap-4">
                {dashboardData.locationStats.map((location, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border-l-4 border-purple-600">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-gray-900 text-sm">{location.location}</span>
                      <span className="text-sm text-gray-600">{location.transactions} transactions</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${location.flagged > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                      {location.flagged} flagged
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No location data available
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-5">Success Rate by Customer</h3>
          {dashboardData.customerStats && dashboardData.customerStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardData.customerStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="success" fill="#48bb78" name="Successful" />
                <Bar dataKey="failed" fill="#f56565" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No customer data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

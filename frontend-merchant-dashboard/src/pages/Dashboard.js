import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const transactionData = [
  { date: '10/01', successful: 245, failed: 12, flagged: 8 },
  { date: '10/02', successful: 289, failed: 15, flagged: 11 },
  { date: '10/03', successful: 312, failed: 9, flagged: 6 },
  { date: '10/04', successful: 278, failed: 18, flagged: 14 },
  { date: '10/05', successful: 301, failed: 11, flagged: 9 },
  { date: '10/06', successful: 334, failed: 13, flagged: 7 },
  { date: '10/07', successful: 298, failed: 16, flagged: 12 },
];

const mfaSuccessData = [
  { name: 'Customer A', success: 95, failed: 5 },
  { name: 'Customer B', success: 88, failed: 12 },
  { name: 'Customer C', success: 92, failed: 8 },
  { name: 'Customer D', success: 78, failed: 22 },
  { name: 'Customer E', success: 98, failed: 2 },
];

const riskDistribution = [
  { name: 'Low Risk', value: 68, color: '#48bb78' },
  { name: 'Medium Risk', value: 24, color: '#ed8936' },
  { name: 'High Risk', value: 8, color: '#f56565' },
];

const geoData = [
  { country: 'United States', transactions: 1245, flagged: 23 },
  { country: 'Canada', transactions: 342, flagged: 8 },
  { country: 'United Kingdom', transactions: 289, flagged: 12 },
  { country: 'Germany', transactions: 178, flagged: 15 },
  { country: 'France', transactions: 156, flagged: 6 },
];

const highRiskCustomers = [
  { id: 1, name: 'John Doe', email: 'john@example.com', riskScore: 87, flaggedEvents: 5, lastSeen: '2 hours ago' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', riskScore: 76, flaggedEvents: 3, lastSeen: '5 hours ago' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', riskScore: 71, flaggedEvents: 4, lastSeen: '1 day ago' },
  { id: 4, name: 'Alice Williams', email: 'alice@example.com', riskScore: 68, flaggedEvents: 2, lastSeen: '3 hours ago' },
];

function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('merchantAuth');
    navigate('/');
  };

  const getRiskBadgeColor = (score) => {
    if (score > 80) return 'bg-red-100 text-red-800';
    if (score > 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Security & Transaction Overview</h1>
          <p className="text-gray-600">Monitor your merchant transactions and security insights</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-xl p-6 flex gap-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">📊</div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Total Transactions</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">2,157</p>
              <span className="text-sm text-green-600">+12.5% from last week</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 flex gap-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl flex-shrink-0">✅</div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Success Rate</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">94.2%</p>
              <span className="text-sm text-green-600">+2.1% from last week</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 flex gap-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center text-2xl flex-shrink-0">⚠️</div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Flagged Events</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">67</p>
              <span className="text-sm text-red-600">+5 from yesterday</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 flex gap-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-2xl flex-shrink-0">🚨</div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600 mb-2">High Risk Users</h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">12</p>
              <span className="text-sm text-gray-600">4 new this week</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Transaction Timeline</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={transactionData}>
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
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">MFA Success Rate by Customer</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mfaSuccessData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="success" fill="#48bb78" />
                <Bar dataKey="failed" fill="#f56565" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Geographic Distribution</h3>
            <div className="flex flex-col gap-4">
              {geoData.map((location, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border-l-4 border-purple-600">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-900 text-sm">{location.country}</span>
                    <span className="text-sm text-gray-600">{location.transactions} transactions</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${location.flagged > 10 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {location.flagged} flagged
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 mb-5">High-Risk Customers</h3>
          <div className="overflow-x-auto">
            <div className="hidden md:grid grid-cols-5 gap-4 px-4 py-3 bg-gray-50 rounded-lg font-semibold text-sm text-gray-600 uppercase mb-1">
              <div>Customer</div>
              <div>Risk Score</div>
              <div>Flagged Events</div>
              <div>Last Seen</div>
              <div>Action</div>
            </div>
            {highRiskCustomers.map(customer => (
              <div key={customer.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 px-4 py-4 bg-white hover:bg-gray-50 transition-colors items-center border-b last:border-b-0">
                <div className="flex flex-col gap-1">
                  <strong className="text-gray-900 text-sm">{customer.name}</strong>
                  <span className="text-gray-600 text-sm">{customer.email}</span>
                </div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${getRiskBadgeColor(customer.riskScore)}`}>
                    {customer.riskScore}
                  </span>
                </div>
                <div className="text-sm text-gray-900">{customer.flaggedEvents}</div>
                <div className="text-sm text-gray-600">{customer.lastSeen}</div>
                <div>
                  <button className="px-4 py-1.5 bg-purple-600 text-white rounded-md text-sm font-semibold hover:bg-purple-700 transition-colors">Review</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

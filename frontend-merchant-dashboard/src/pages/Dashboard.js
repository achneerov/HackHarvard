import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

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

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="nav-content">
          <h2>Merchant Dashboard</h2>
          <div className="nav-links">
            <button onClick={() => navigate('/dashboard')} className="nav-link active">Dashboard</button>
            <button onClick={() => navigate('/rules')} className="nav-link">Rules</button>
            <button onClick={handleLogout} className="nav-link logout">Logout</button>
          </div>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h1>Security & Transaction Overview</h1>
          <p>Monitor your merchant transactions and security insights</p>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon" style={{ background: '#bee3f8' }}>📊</div>
            <div className="metric-info">
              <h3>Total Transactions</h3>
              <p className="metric-value">2,157</p>
              <span className="metric-change positive">+12.5% from last week</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon" style={{ background: '#c6f6d5' }}>✅</div>
            <div className="metric-info">
              <h3>Success Rate</h3>
              <p className="metric-value">94.2%</p>
              <span className="metric-change positive">+2.1% from last week</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon" style={{ background: '#fef5e7' }}>⚠️</div>
            <div className="metric-info">
              <h3>Flagged Events</h3>
              <p className="metric-value">67</p>
              <span className="metric-change negative">+5 from yesterday</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon" style={{ background: '#fed7d7' }}>🚨</div>
            <div className="metric-info">
              <h3>High Risk Users</h3>
              <p className="metric-value">12</p>
              <span className="metric-change">4 new this week</span>
            </div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-card wide">
            <h3>Transaction Timeline</h3>
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

          <div className="chart-card">
            <h3>Risk Distribution</h3>
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

        <div className="charts-grid">
          <div className="chart-card wide">
            <h3>MFA Success Rate by Customer</h3>
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

          <div className="chart-card">
            <h3>Geographic Distribution</h3>
            <div className="geo-list">
              {geoData.map((location, idx) => (
                <div key={idx} className="geo-item">
                  <div className="geo-info">
                    <span className="geo-country">{location.country}</span>
                    <span className="geo-transactions">{location.transactions} transactions</span>
                  </div>
                  <span className={`geo-flagged ${location.flagged > 10 ? 'high' : ''}`}>
                    {location.flagged} flagged
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="risk-section">
          <h3>High-Risk Customers</h3>
          <div className="risk-table">
            <div className="risk-table-header">
              <div>Customer</div>
              <div>Risk Score</div>
              <div>Flagged Events</div>
              <div>Last Seen</div>
              <div>Action</div>
            </div>
            {highRiskCustomers.map(customer => (
              <div key={customer.id} className="risk-table-row">
                <div className="customer-info">
                  <strong>{customer.name}</strong>
                  <span>{customer.email}</span>
                </div>
                <div>
                  <span className={`risk-badge ${customer.riskScore > 80 ? 'high' : customer.riskScore > 70 ? 'medium' : 'low'}`}>
                    {customer.riskScore}
                  </span>
                </div>
                <div>{customer.flaggedEvents}</div>
                <div className="last-seen">{customer.lastSeen}</div>
                <div>
                  <button className="action-btn">Review</button>
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

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function Dashboard() {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState('month');

  useEffect(() => {
    const fetchDashboardData = async () => {
      const merchantApiKey = localStorage.getItem('merchantApiKey');

      if (!merchantApiKey) {
        navigate('/');
        return;
      }

      try {
        const response = await fetch(`http://localhost:3001/api/dashboard/stats?merchantApiKey=${merchantApiKey}&timePeriod=${timePeriod}`);
        const data = await response.json();

        if (data.status === 1) {
          console.log('Dashboard data received:', data.data);
          console.log('Risk metrics:', data.data.riskMetrics);
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
  }, [navigate, timePeriod]);

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
            <button onClick={() => navigate('/dashboard')} className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">Dashboard</button>
            <button onClick={() => navigate('/rules')} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">Rules</button>
            <button onClick={handleLogout} className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 hover:shadow-lg transition-all">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Transaction Overview</h1>
            <p className="text-gray-600">Monitor your merchant transactions and authentication events</p>
          </div>
          <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl transition-all">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="border-r border-gray-300 pr-3">
              <label className="text-xs font-medium text-gray-500 block">Time Period</label>
            </div>
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
              className="bg-transparent border-none focus:outline-none focus:ring-0 text-base font-semibold text-gray-900 cursor-pointer appearance-none pr-8 bg-no-repeat bg-right"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                backgroundSize: '1.25rem',
                backgroundPosition: 'right center'
              }}
            >
              <option value="day">Last Day</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-xl p-4 flex gap-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Total Transactions</h3>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.totalTransactions}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 flex gap-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Success Rate</h3>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.successRate}%</p>
              <span className="text-xs text-gray-600">{dashboardData.statusCounts.success} successful</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 flex gap-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Auth Required Rate</h3>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.totalTransactions > 0 ? ((dashboardData.statusCounts.authRequired / dashboardData.totalTransactions) * 100).toFixed(1) : 0}%</p>
              <span className="text-xs text-gray-600">{dashboardData.statusCounts.authRequired} auth required</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 flex gap-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Failure Rate</h3>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.totalTransactions > 0 ? ((dashboardData.statusCounts.failure / dashboardData.totalTransactions) * 100).toFixed(1) : 0}%</p>
              <span className="text-xs text-gray-600">{dashboardData.statusCounts.failure} failed</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Transaction Timeline</h3>
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
                  <Line type="monotone" dataKey="flagged" stroke="#eab308" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No transaction data in the last 7 days
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Top Locations by Transactions</h3>
            {dashboardData.locationStats.length > 0 ? (
              <div className="flex flex-col gap-3">
                {dashboardData.locationStats.map((location, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 hover:shadow-sm transition-all">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                      idx === 1 ? 'bg-gray-200 text-gray-700' :
                      idx === 2 ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 text-sm">{location.location}</div>
                      <div className="text-xs text-gray-600">{location.transactions} transactions</div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${location.flagged > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                      {location.flagged > 0 ? `${location.flagged} Auth Required` : '✓'}
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
          <h3 className="text-lg font-semibold text-gray-900 mb-5">High-Risk Customer Alerts</h3>
          {dashboardData.customerStats && dashboardData.customerStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardData.customerStats
                .map(customer => {
                  const riskData = dashboardData.riskMetrics?.find(r => r.name === customer.name);
                  const merged = { ...customer, ...riskData };
                  // Ensure totalAttempts is the sum of all transaction types
                  merged.totalAttempts = (merged.success || 0) + (merged.failed || 0) + (merged.authRequired || 0);
                  return merged;
                })
                .sort((a, b) => (b.authRequired + b.failed) - (a.authRequired + a.failed))
                .slice(0, 3)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    console.log('Tooltip data:', data);
                    return (
                      <div className="bg-white p-4 border-2 border-gray-300 rounded-xl shadow-2xl max-w-md z-50 relative" style={{ zIndex: 9999 }}>
                        {/* Header */}
                        <div className="mb-3 pb-2 border-b-2 border-gray-200">
                          <p className="font-bold text-base text-gray-900">{data.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Customer Risk Analysis</p>
                        </div>

                        {/* Transaction Status Summary */}
                        <div className="mb-3">
                          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Transaction Summary</h4>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-green-50 rounded-lg p-2 border border-green-200">
                              <div className="text-xl mb-0.5">✓</div>
                              <div className="text-xs text-green-700 font-medium">Successful</div>
                              <div className="text-base font-bold text-green-900">{data.success}</div>
                            </div>
                            <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-200">
                              <div className="text-xl mb-0.5">⚠</div>
                              <div className="text-xs text-yellow-700 font-medium">Auth Req.</div>
                              <div className="text-base font-bold text-yellow-900">{data.authRequired}</div>
                            </div>
                            <div className="bg-red-50 rounded-lg p-2 border border-red-200">
                              <div className="text-xl mb-0.5">✗</div>
                              <div className="text-xs text-red-700 font-medium">Failed</div>
                              <div className="text-base font-bold text-red-900">{data.failed}</div>
                            </div>
                          </div>
                        </div>

                        {/* Activity Metrics */}
                        <div className="mb-3 bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <h4 className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-2">Activity Metrics</h4>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-700">Total Attempts:</span>
                              <span className="font-semibold text-gray-900">{data.totalAttempts || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-700">Locations:</span>
                              <span className="font-semibold text-gray-900">{data.locationCount || 0}</span>
                            </div>
                            <div className="text-xs text-gray-600 bg-white rounded p-1.5 mt-1.5">
                              {data.locations || 'No locations'}
                            </div>
                          </div>
                        </div>

                        {/* Time Analysis & Consecutive Patterns - Combined */}
                        <div className="mb-3 grid grid-cols-2 gap-2">
                          <div className="bg-yellow-50 rounded-lg p-2.5 border border-yellow-200">
                            <h4 className="text-xs font-semibold text-yellow-900 uppercase tracking-wide mb-1.5">Time Analysis</h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-700">Auths:</span>
                                <span className="font-semibold text-gray-900">{data.avgTimeBetweenAuths || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-700">Fails:</span>
                                <span className="font-semibold text-gray-900">{data.avgTimeBetweenFails || 'N/A'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-1.5">Consecutive</h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-700">Max Fails:</span>
                                <span className="font-bold text-red-600">{data.maxConsecutiveFails !== undefined ? data.maxConsecutiveFails : 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-700">Max Success:</span>
                                <span className="font-bold text-green-600">{data.maxConsecutiveSuccesses !== undefined ? data.maxConsecutiveSuccesses : 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-300">
                          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-2">Recent Activity</h4>
                          <div className="space-y-1 text-xs">
                            {data.recentTimestamps && data.recentTimestamps.length > 0 ? (
                              data.recentTimestamps.map((ts, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-gray-700">
                                  <span className="text-blue-500 text-xs">●</span>
                                  <span>{ts}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-500 text-center py-1">No recent activity</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }} wrapperStyle={{ zIndex: 9999 }} />
                <Legend />
                <Bar dataKey="success" fill="#48bb78" name="Successful" />
                <Bar dataKey="authRequired" fill="#eab308" name="Auth Required" />
                <Bar dataKey="failed" fill="#f56565" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No customer data available
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-5">Failed Transaction Locations</h3>
          {dashboardData.locationStats && dashboardData.locationStats.filter(loc => loc.failed > 0).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboardData.locationStats
                .filter(location => location.failed > 0)
                .sort((a, b) => b.failed - a.failed)
                .map((location, idx) => (
                  <div key={idx} className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{location.location}</span>
                      <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
                        {location.failed}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {location.failed} failed transaction{location.failed !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-gray-500 bg-green-50 rounded-lg border border-green-200">
              <div className="text-center">
                <div className="text-2xl mb-2">✓</div>
                <div className="text-sm font-medium text-green-700">No failed transactions from any location</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>
              <p>&copy; 2025 Veritas. All rights reserved.</p>
            </div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Dashboard;

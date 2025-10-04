import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './RulesManagement.css';

function RulesManagement() {
  const navigate = useNavigate();
  const [rules, setRules] = useState([
    { id: 1, name: 'High Risk Transaction', condition: 'amount > 1000', action: 'require_mfa', enabled: true },
    { id: 2, name: 'Foreign Country', condition: 'country != home_country', action: 'flag_review', enabled: true },
  ]);
  const [editingRule, setEditingRule] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', condition: '', action: 'require_mfa', enabled: true });

  const handleLogout = () => {
    localStorage.removeItem('merchantAuth');
    navigate('/');
  };

  const handleEdit = (rule) => {
    setEditingRule(rule.id);
    setFormData(rule);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    setRules(rules.filter(rule => rule.id !== id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingRule) {
      setRules(rules.map(rule => rule.id === editingRule ? { ...formData, id: editingRule } : rule));
    } else {
      setRules([...rules, { ...formData, id: Date.now() }]);
    }
    setFormData({ name: '', condition: '', action: 'require_mfa', enabled: true });
    setEditingRule(null);
    setShowForm(false);
  };

  const toggleRule = (id) => {
    setRules(rules.map(rule => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule));
  };

  const handleCancel = () => {
    setFormData({ name: '', condition: '', action: 'require_mfa', enabled: true });
    setEditingRule(null);
    setShowForm(false);
  };

  return (
    <div className="rules-container">
      <nav className="navbar">
        <div className="nav-content">
          <h2>Merchant Dashboard</h2>
          <div className="nav-links">
            <button onClick={() => navigate('/dashboard')} className="nav-link">Dashboard</button>
            <button onClick={() => navigate('/rules')} className="nav-link active">Rules</button>
            <button onClick={handleLogout} className="nav-link logout">Logout</button>
          </div>
        </div>
      </nav>

      <div className="rules-content">
        <div className="rules-header">
          <div>
            <h1>Transaction Rules</h1>
            <p>Configure fraud detection and authentication rules</p>
          </div>
          <button onClick={() => showForm ? handleCancel() : setShowForm(true)} className="add-rule-btn">
            {showForm ? 'Cancel' : '+ Add Rule'}
          </button>
        </div>

        {showForm && (
          <div className="rule-form-card">
            <h3>{editingRule ? 'Edit Rule' : 'Create New Rule'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Rule Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., High Risk Transaction"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Action</label>
                  <select
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                  >
                    <option value="require_mfa">Require MFA</option>
                    <option value="flag_review">Flag for Review</option>
                    <option value="block">Block Transaction</option>
                    <option value="notify">Send Notification</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Condition</label>
                <input
                  type="text"
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  placeholder="e.g., amount > 1000 OR country != 'US'"
                  required
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="save-btn">
                  {editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="rules-list">
          {rules.map(rule => (
            <div key={rule.id} className={`rule-card ${!rule.enabled ? 'disabled' : ''}`}>
              <div className="rule-header-row">
                <div className="rule-info">
                  <h3>{rule.name}</h3>
                  <span className={`action-badge ${rule.action}`}>
                    {rule.action.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="rule-actions">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => toggleRule(rule.id)}
                    />
                    <span className="slider"></span>
                  </label>
                  <button onClick={() => handleEdit(rule)} className="edit-btn">Edit</button>
                  <button onClick={() => handleDelete(rule.id)} className="delete-btn">Delete</button>
                </div>
              </div>
              <div className="rule-condition">
                <strong>Condition:</strong> {rule.condition}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RulesManagement;

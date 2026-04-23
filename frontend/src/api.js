const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const getAuthHeaders = () => {
  const token = localStorage.getItem("firereach_token");
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

export const discoverCompanies = async (icp) => {
  const response = await fetch(`${API_URL}/api/discover/companies`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ icp }),
  });
  if (!response.ok) throw new Error('Failed to discover companies');
  return response.json();
};

export const discoverLeads = async (icp, company, domain) => {
  const response = await fetch(`${API_URL}/api/discover/leads`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ icp, company, domain }),
  });
  if (!response.ok) throw new Error('Failed to discover leads');
  return response.json();
};

export const discoverAutopilot = async (icp) => {
  const response = await fetch(`${API_URL}/api/discover/autopilot`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ icp }),
  });
  if (!response.ok) throw new Error('Autopilot discovery failed');
  return response.json();
};

export const runDirectAgent = async (icp, company, email, leadName, leadTitle) => {
  const response = await fetch(`${API_URL}/api/jobs/direct`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ icp, company, email, lead_name: leadName, lead_title: leadTitle }),
  });
  if (!response.ok) {
    const err = await response.json().catch(()=>null);
    throw new Error(err?.detail || 'Failed to start direct job');
  }
  return response.json();
};

export const runAgent = async (company, icp, email) => {
  try {
    const response = await fetch(`${API_URL}/run-agent`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ company, icp, email }),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error running agent:', error);
    throw error;
  }
};

export const approveJob = async (jobId, emailDraft = null) => {
  try {
    const response = await fetch(`${API_URL}/api/jobs/${jobId}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email_draft: emailDraft }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error approving job:', error);
    throw error;
  }
};

export const getStats = async () => {
  try {
    const response = await fetch(`${API_URL}/api/stats`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch stats');
    return await response.json();
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw error;
  }
};

export const listCampaigns = async () => {
  const response = await fetch(`${API_URL}/api/campaigns`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to list campaigns');
  return response.json();
};

export const createCampaign = async (name, icp, targetCount) => {
  const response = await fetch(`${API_URL}/api/campaigns`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, icp, target_count: parseInt(targetCount) }),
  });
  if (!response.ok) throw new Error('Failed to create campaign');
  return response.json();
};

export const getWorkspaceSettings = async () => {
  const response = await fetch(`${API_URL}/api/workspace/settings`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch workspace settings');
  return response.json();
};

export const updateWorkspaceSettings = async (settings) => {
  const response = await fetch(`${API_URL}/api/workspace/settings`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error('Failed to update workspace settings');
  return response.json();
};

export const getAnalyticsTrends = async () => {
  const response = await fetch(`${API_URL}/api/analytics/trends`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch analytics');
  return response.json();
};

export const deleteLead = async (id) => {
  const response = await fetch(`${API_URL}/api/leads/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete lead');
  return response.json();
};

export const bulkApproveLeads = async (leadIds) => {
  const response = await fetch(`${API_URL}/api/leads/bulk/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ lead_ids: leadIds }),
  });
  if (!response.ok) throw new Error('Failed to bulk approve leads');
  return response.json();
};

export const getTemplates = async () => {
  const response = await fetch(`${API_URL}/api/workspace/templates`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch templates');
  return response.json();
};

export const createTemplate = async (name, content) => {
  const response = await fetch(`${API_URL}/api/workspace/templates`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, content }),
  });
  if (!response.ok) throw new Error('Failed to save template');
  return response.json();
};






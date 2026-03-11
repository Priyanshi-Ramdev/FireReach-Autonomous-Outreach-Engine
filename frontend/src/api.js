const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const runAgent = async (company, icp, email) => {
  try {
    const response = await fetch(`${API_URL}/run-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

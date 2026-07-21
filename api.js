const API_BASE = window.location.origin;

function request(url, options = {}) {
  const token = localStorage.getItem('iftoToken');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${url}`, {
    credentials: 'same-origin',
    ...options,
    headers
  }).then(async response => {
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = data?.error || 'Erro na requisição.';
      throw new Error(error);
    }
    return data;
  });
}

function loginApi(email, password) {
  return request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

function registerApi(name, email, password, phone) {
  return request('/api/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, phone })
  });
}

function getProfileApi() {
  return request('/api/profile');
}

function updateProfileApi(data) {
  return request('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

function getDevicesApi() {
  return request('/api/devices');
}

function addDeviceApi(name, status) {
  return request('/api/devices', {
    method: 'POST',
    body: JSON.stringify({ name, status })
  });
}

function reserveDeviceApi(deviceId, date, hour) {
  return request(`/api/devices/${deviceId}/reserve`, {
    method: 'POST',
    body: JSON.stringify({ date, hour })
  });
}

function logoutApi() {
  localStorage.removeItem('iftoToken');
}

function setAuthToken(token) {
  localStorage.setItem('iftoToken', token);
}

function getAuthToken() {
  return localStorage.getItem('iftoToken');
}

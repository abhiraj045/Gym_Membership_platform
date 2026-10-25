import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // send the httpOnly session cookie
  headers: { 'X-Requested-With': 'XMLHttpRequest' }, // required by the API's CSRF guard
});

export const errMsg = (e) => {
  const d = e.response?.data?.error;
  if (d?.details?.length && Array.isArray(d.details)) return `${d.message}: ${d.details.map((x) => x.message).join('; ')}`;
  return d?.message || e.message || 'Something went wrong';
};

export const apiBase = api.defaults.baseURL;
export default api;

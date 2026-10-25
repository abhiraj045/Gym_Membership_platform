import axios from 'axios';

// Same-origin requests; axios copies the XSRF-TOKEN cookie into the X-XSRF-TOKEN header automatically.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';
export default api;

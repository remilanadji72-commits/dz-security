export const colors = {
  red: '#e74c3c',
  blue: '#3498db',
  green: '#2ecc71',
  dark: '#2c3e50',
  sidebar: '#2b303b',
};

export const getJoursRestants = (dateFinStr) => {
  const diff = new Date(dateFinStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

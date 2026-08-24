export const getItemAsync = async (key: string): Promise<string | null> => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

export const setItemAsync = async (key: string, value: string): Promise<void> => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value);
  }
};

export const deleteItemAsync = async (key: string): Promise<void> => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key);
  }
};

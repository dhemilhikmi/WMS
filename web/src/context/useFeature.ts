import { useAuth } from './AuthContext';

export const useFeature = (featureName: string): boolean => {
  const { enabledFeatures } = useAuth();
  return enabledFeatures.includes(featureName);
};

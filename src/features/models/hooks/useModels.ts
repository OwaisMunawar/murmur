import { useServices } from '@/composition/ServicesProvider';
import { useStore } from '@/core/hooks/useStore';

export function useModels() {
  const { models } = useServices();
  return useStore(models.store);
}

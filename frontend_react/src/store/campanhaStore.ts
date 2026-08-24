import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Campanha {
  idCampanha: number;
  dataInicio: string;
  dataFim: string;
  ativa: boolean;
  duracaoMeses: number;
}

interface CampanhaState {
  campanhas: Campanha[];
  selectedCampanha: Campanha | null;
  setCampanhas: (campanhas: Campanha[]) => void;
  setSelectedCampanha: (campanha: Campanha | null) => void;
}

export const useCampanhaStore = create<CampanhaState>()(
  persist(
    (set) => ({
      campanhas: [],
      selectedCampanha: null,
      setCampanhas: (campanhas) => set({ campanhas }),
      setSelectedCampanha: (campanha) => set({ selectedCampanha: campanha }),
    }),
    {
      name: 'campanha-storage',
    }
  )
);

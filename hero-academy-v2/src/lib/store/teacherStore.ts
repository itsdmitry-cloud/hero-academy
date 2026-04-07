import { create } from 'zustand';

export interface ClassInfo {
  id: string;
  name: string;
  invite_code: string;
  school_id: string;
}

interface TeacherStore {
  activeClassId: string | null;
  classes: ClassInfo[];
  activeSubject: string | null;
  setActiveClassId: (classId: string) => void;
  setClasses: (classes: ClassInfo[]) => void;
  setActiveSubject: (subject: string) => void;
}

export const useTeacherStore = create<TeacherStore>((set) => ({
  activeClassId: null,
  classes: [],
  activeSubject: null,
  setActiveClassId: (classId: string) => set({ activeClassId: classId }),
  setClasses: (classes: ClassInfo[]) => set({ classes }),
  setActiveSubject: (subject: string) => set({ activeSubject: subject }),
}));


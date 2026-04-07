export type UserRole = 'student' | 'teacher' | 'parent' | 'admin';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  avatar_url: string | null;
  school_id: string | null;
  class_id: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface School {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface Class {
  id: string;
  school_id: string;
  name: string;
  teacher_id: string;
  invite_code: string;
  created_at: string;
}

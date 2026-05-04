-- Добавляем предмет "Математика" в справочник предметов.
-- Используется при создании учителя в админке школ.
INSERT INTO public.subjects (name) VALUES ('Математика')
ON CONFLICT (name) DO NOTHING;

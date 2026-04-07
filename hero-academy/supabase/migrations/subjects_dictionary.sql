-- Создаем таблицу справочник предметов
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Заполняем базовыми школьными предметами
INSERT INTO public.subjects (name) VALUES
('Алгебра'),
('Геометрия'),
('Русский язык'),
('Литература'),
('История'),
('Обществознание'),
('Физика'),
('Химия'),
('Биология'),
('География'),
('Информатика'),
('Английский язык'),
('Физкультура'),
('ОБЖ');

-- Добавляем политику (читать могут все)
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subjects are viewable by everyone" ON public.subjects
    FOR SELECT USING (true);

import WikiClient from './WikiClient';

export const metadata = {
  title: 'Энциклопедия | Hero Academy',
  description: 'Каталог артефактов и правила магической вселенной Hero Academy',
};

export default function Page() {
  return <WikiClient />;
}

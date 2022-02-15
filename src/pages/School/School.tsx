import { useParams } from 'react-router-dom';

// Components
import { School as SchoolInfo } from '@/components/School';
import { NotFound } from '@/pages/404';

export const School: React.FC = () => {
    const params = useParams();
    const id = Number(params.id) || -1;
    const school = OIerDb.schools.find((school) => school.id === id);

    if (!school) return <NotFound />;

    return (
        <>
            <h2>{school.name}</h2>
            <SchoolInfo school={school} />
        </>
    );
};
